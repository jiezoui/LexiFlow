"""Run frozen P1 A/B/C story experiments without touching the application DB."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

from holdout_cases import cases as holdout_cases
from protocol import evaluate, initial, p0, rewrite
from repair_policy import combine, mode as repair_mode, prompt as repair_prompt

ROOT = Path(__file__).resolve().parents[2]
DEV_IDS = (
    "a2_two_new_campus", "a2_four_new_environment",
    "b1_two_new_technology", "b1_four_new_health",
    "b2_two_new_campus", "b2_four_new_environment",
    "b1_two_new_campus", "b2_four_new_health",
)


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def call_model(base_url: str, model: str, key: str, system: str, user: str) -> tuple[str, dict, float]:
    body = json.dumps({
        "model": model, "temperature": 0.3, "max_tokens": 5000,
        "thinking": {"type": "disabled"}, "enable_thinking": False,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
    }).encode("utf-8")
    request = urllib.request.Request(
        base_url.rstrip("/") + "/chat/completions", data=body, method="POST",
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + key},
    )
    started = time.perf_counter()
    with urllib.request.urlopen(request, timeout=120) as response:
        payload = json.load(response)
    content = payload["choices"][0]["message"]["content"]
    return str(content), payload.get("usage") or {}, round(time.perf_counter() - started, 3)


def model_step(base_url: str, model: str, key: str, case: dict, stage: str,
               system: str, user: str, ranks: dict[str, int]) -> dict:
    try:
        raw, usage, seconds = call_model(base_url, model, key, system, user)
        error = None
    except (urllib.error.URLError, ValueError, KeyError, TimeoutError) as exc:
        raw, usage, seconds, error = "", {}, None, f"{type(exc).__name__}: {exc}"
    return {
        "stage": stage, "prompt": {"system": system, "user": user},
        "raw": raw, "usage": usage, "seconds": seconds,
        "request_error": error, "verdict": evaluate(raw, case, ranks),
    }


def select_cases(dataset: str) -> list[dict]:
    if dataset == "holdout":
        return holdout_cases()
    previous = {case["id"]: case for case in p0.cases()}
    if dataset == "dev_all":
        return list(previous.values())
    return [previous[case_id] for case_id in DEV_IDS]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", choices=("dev", "dev_all", "holdout"), default="dev")
    parser.add_argument("--groups", default="BC", help="Combination of A, B, C; holdout protocol uses ABC")
    parser.add_argument("--limit", type=int, help="Development pilot only; never truncate holdout")
    parser.add_argument("--base-url", default="https://api.deepseek.com")
    parser.add_argument("--model", default="deepseek-flash")
    parser.add_argument("--key-file", type=Path, default=Path(__file__).parent / "credentials.local")
    parser.add_argument("--ecdict", type=Path, default=ROOT / "material/ecdict.csv")
    parser.add_argument("--output", type=Path, default=Path(__file__).parent / "dev.local")
    parser.add_argument("--validate-only", action="store_true")
    args = parser.parse_args()
    groups = tuple(dict.fromkeys(args.groups.upper()))
    if not groups or any(group not in "ABC" for group in groups):
        parser.error("--groups must contain A, B, or C only")
    if "C" in groups and ("B" not in groups or groups.index("B") > groups.index("C")):
        parser.error("Group C reuses B's first draft; --groups must include B before C")
    if args.dataset == "holdout" and (args.limit is not None or groups != ("A", "B", "C")):
        parser.error("Holdout must run all 24 cases with --groups ABC and no --limit")
    selected = select_cases(args.dataset)
    if args.limit is not None:
        if not 1 <= args.limit <= len(selected):
            parser.error("--limit outside development dataset size")
        selected = selected[:args.limit]
    if not args.ecdict.is_file():
        parser.error(f"Missing ECDICT: {args.ecdict}")
    if not args.validate_only and not args.key_file.is_file():
        parser.error(f"Missing ignored local key file: {args.key_file}")
    if len({case["id"] for case in selected}) != len(selected):
        parser.error("Duplicate case IDs")
    ranks = p0.load_ranks(args.ecdict)
    args.output.mkdir(parents=True, exist_ok=True)
    raw_path = args.output / "runs.jsonl"
    if not args.validate_only and raw_path.exists():
        parser.error(f"Results already exist: {raw_path}; use a new output directory")
    manifest = {
        "protocol": "story-p1-v3", "dataset": args.dataset, "groups": groups,
        "cases": selected, "model": args.model, "base_url": args.base_url,
        "temperature": 0.3, "max_tokens": 5000, "thinking": "disabled",
        "runner_sha256": sha(Path(__file__)),
        "protocol_sha256": sha(Path(__file__).parent / "protocol.py"),
        "repair_policy_sha256": sha(Path(__file__).parent / "repair_policy.py"),
        "case_file_sha256": sha(Path(__file__).parent / "holdout_cases.py"),
        "ecdict_sha256": sha(args.ecdict),
        "production_service_sha256": sha(ROOT / "server/src/main/java/com/lexiflow/modules/contextual/service/impl/ContextStoryServiceImpl.java"),
        "note": "B and C share the exact first draft. B uses old rewrite; C uses failure-aware repair with at most two repair calls. Model calls and ECDICT scoring bypass the Java service and DB.",
    }
    (args.output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    if args.validate_only:
        for case in selected:
            for group in groups:
                system, user = initial(case, group)
                assert system and user and case["topic"] in user
        print(f"Validated {len(selected)} {args.dataset} cases and prompts without model calls.")
        return 0

    key = args.key_file.read_text(encoding="utf-8-sig").strip()
    if not key:
        parser.error("Local key file is empty")
    with raw_path.open("w", encoding="utf-8") as handle:
        for case in selected:
            status = []
            first_b = None
            for group in groups:
                if group == "C":
                    drafts = [dict(first_b)]
                else:
                    system, user = initial(case, group)
                    drafts = [model_step(args.base_url, args.model, key, case, "initial", system, user, ranks)]
                first = drafts[0]
                if group == "B":
                    first_b = first
                final_raw = first["raw"]
                final_verdict = first["verdict"]
                if group == "B" and not first["verdict"]["accepted"] and not first["request_error"]:
                    parsed, _ = p0.parse_answer(first["raw"])
                    previous = str(parsed.get("contentMarked") or first["raw"])
                    system, user = rewrite(case, group, previous, first["verdict"], ranks)
                    drafts.append(model_step(args.base_url, args.model, key, case, "rewrite", system, user, ranks))
                    final_raw = drafts[-1]["raw"]
                    final_verdict = drafts[-1]["verdict"]
                if group == "C" and not first["verdict"]["accepted"] and not first["request_error"]:
                    for attempt in range(2):
                        chosen = repair_mode(final_verdict, case)
                        if attempt == 1 and chosen != "append":
                            break
                        parsed, _ = p0.parse_answer(final_raw)
                        previous = str(parsed.get("contentMarked") or final_raw)
                        system, user = repair_prompt(case, chosen, previous, final_verdict, ranks)
                        step = model_step(args.base_url, args.model, key, case, chosen, system, user, ranks)
                        drafts.append(step)
                        if step["request_error"]:
                            final_raw = step["raw"]
                            final_verdict = step["verdict"]
                            break
                        final_raw = combine(chosen, step["raw"], final_raw)
                        final_verdict = evaluate(final_raw, case, ranks)
                        step["materialized_raw"] = final_raw
                        step["verdict"] = final_verdict
                        if final_verdict["accepted"]:
                            break
                row = {
                    "case_id": case["id"], "group": group, "drafts": drafts,
                    "reused_b_first_draft": group == "C",
                    "repair_calls": len(drafts) - 1,
                    "rewrite_called": len(drafts) > 1,
                    "final_raw": final_raw,
                    "request_error": drafts[-1]["request_error"], "verdict": final_verdict,
                }
                handle.write(json.dumps(row, ensure_ascii=False) + "\n")
                handle.flush()
                status.append(f"{group}:{int(final_verdict['accepted'])}")
            print(f"{case['id']}: {' '.join(status)}", flush=True)
    print(f"Raw results: {raw_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
