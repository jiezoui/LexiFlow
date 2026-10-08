"""Summarize P1 raw results and prepare the prespecified 12-case human-rating sample."""

from __future__ import annotations

import argparse
import csv
import json
import random
import statistics
from collections import Counter, defaultdict
from pathlib import Path

from protocol import p0


def total_tokens(usage: dict) -> int | None:
    value = usage.get("total_tokens")
    if value is not None:
        return int(value)
    if "prompt_tokens" in usage and "completion_tokens" in usage:
        return int(usage["prompt_tokens"]) + int(usage["completion_tokens"])
    return None


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("folder", type=Path)
    args = parser.parse_args()
    folder = args.folder
    manifest = json.loads((folder / "manifest.json").read_text(encoding="utf-8"))
    cases = {case["id"]: case for case in manifest["cases"]}
    rows = [json.loads(line) for line in (folder / "runs.jsonl").read_text(encoding="utf-8").splitlines() if line]
    by_case: dict[str, dict[str, dict]] = defaultdict(dict)
    for row in rows:
        if row["group"] in by_case[row["case_id"]]:
            parser.error(f"Duplicate row: {row['case_id']} {row['group']}")
        by_case[row["case_id"]][row["group"]] = row
    groups = tuple(manifest["groups"])
    if set(by_case) != set(cases) or any(set(results) != set(groups) for results in by_case.values()):
        parser.error("Incomplete run: preserve raw JSONL and use a new output for reruns")

    metrics = []
    for case_id in cases:
        for group in groups:
            row = by_case[case_id][group]
            drafts = row["drafts"]
            verdict = row["verdict"]
            token_values = [total_tokens(draft["usage"]) for draft in drafts]
            seconds = [draft["seconds"] for draft in drafts]
            initial_obj, _ = p0.parse_answer(drafts[0]["raw"])
            final_obj, _ = p0.parse_answer(row.get("final_raw", drafts[-1]["raw"]))
            content_changed = bool(row["rewrite_called"] and
                                   initial_obj.get("contentMarked") != final_obj.get("contentMarked"))
            metrics.append({
                "case_id": case_id, "level": cases[case_id]["level"],
                "mix": cases[case_id]["mix"], "group": group,
                "initial_accepted": int(drafts[0]["verdict"]["accepted"]),
                "accepted": int(verdict["accepted"]),
                "target_ok": int(verdict["target_ok"]),
                "length_ok": int(verdict["length_ok"]),
                "sentence_ok": int(verdict["sentence_ok"]),
                "rare_ok": "UNKNOWN" if verdict["rare_ok"] is None else int(verdict["rare_ok"]),
                "translation_ok": int(verdict["translation_ok"]),
                "word_count": verdict["word_count"],
                "rare_rate": verdict["rare_rate"],
                "rewrite_called": int(row["rewrite_called"]),
                "repair_calls": row.get("repair_calls", len(drafts) - 1),
                "content_changed": int(content_changed),
                "api_errors": sum(bool(draft["request_error"]) for draft in drafts),
                "total_tokens": sum(token_values) if all(value is not None for value in token_values) else "UNKNOWN",
                "total_seconds": round(sum(seconds), 3) if all(value is not None for value in seconds) else "UNKNOWN",
                "violations": ";".join(verdict["violations"]),
            })
    with (folder / "metrics.csv").open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(metrics[0]))
        writer.writeheader()
        writer.writerows(metrics)

    summary = {}
    for group in groups:
        selected = [row for row in metrics if row["group"] == group]
        tokens = [row["total_tokens"] for row in selected if isinstance(row["total_tokens"], int)]
        durations = [row["total_seconds"] for row in selected if isinstance(row["total_seconds"], float)]
        summary[group] = {
            "n": len(selected),
            "initial_accepted": sum(row["initial_accepted"] for row in selected),
            "accepted": sum(row["accepted"] for row in selected),
            "target_ok": sum(row["target_ok"] for row in selected),
            "length_ok": sum(row["length_ok"] for row in selected),
            "rare_ok": sum(row["rare_ok"] == 1 for row in selected),
            "sentence_ok": sum(row["sentence_ok"] for row in selected),
            "translation_ok": sum(row["translation_ok"] for row in selected),
            "rewrites": sum(row["rewrite_called"] for row in selected),
            "repair_calls": sum(row["repair_calls"] for row in selected),
            "rewrites_changed_content": sum(row["content_changed"] for row in selected),
            "api_errors": sum(row["api_errors"] for row in selected),
            "mean_tokens": round(statistics.mean(tokens), 1) if len(tokens) == len(selected) else None,
            "mean_seconds": round(statistics.mean(durations), 2) if len(durations) == len(selected) else None,
            "mean_word_count": round(statistics.mean(row["word_count"] for row in selected), 1),
            "by_level": {
                level: {"accepted": sum(row["accepted"] for row in selected if row["level"] == level),
                        "n": sum(row["level"] == level for row in selected)}
                for level in sorted({row["level"] for row in selected})
            },
            "by_mix": {
                mix: {"accepted": sum(row["accepted"] for row in selected if row["mix"] == mix),
                      "n": sum(row["mix"] == mix for row in selected)}
                for mix in sorted({row["mix"] for row in selected})
            },
            "violation_counts": dict(Counter(issue for row in selected for issue in row["violations"].split(";") if issue)),
        }
    if set(groups) == {"A", "B", "C"}:
        summary["paired"] = {
            comparison: dict(Counter(
                f"{int(by_case[case_id][left]['verdict']['accepted'])}->{int(by_case[case_id][right]['verdict']['accepted'])}"
                for case_id in cases))
            for comparison, left, right in (("A_to_C", "A", "C"), ("B_to_C", "B", "C"))
        }
    (folder / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

    if manifest["dataset"] == "holdout":
        sample_ids = [case["id"] for case in manifest["cases"] if case["id"].endswith(("library", "journey"))]
        assert len(sample_ids) == 12
        sample = []
        for case_id in sample_ids:
            for group in groups:
                row = by_case[case_id][group]
                obj, _ = p0.parse_answer(row.get("final_raw", row["drafts"][-1]["raw"]))
                content = p0.MARK.sub(lambda match: match.group(1), str(obj.get("contentMarked") or ""))
                sample.append(({"level": cases[case_id]["level"],
                    "topic": cases[case_id]["topic"],
                    "target_words": ", ".join(cases[case_id]["new_words"] + cases[case_id]["review_words"]),
                    "article": content, "translation": obj.get("translationCn") or "",
                    "rater_id": "", "naturalness_1_to_5": "", "coherence_1_to_5": "",
                    "target_use_1_to_5": "", "translation_faithfulness_1_to_5": "", "notes": "",
                }, case_id, group))
        random.Random(20261008).shuffle(sample)
        blind, key = [], []
        for index, (record, case_id, group) in enumerate(sample, start=1):
            record_id = f"R{index:03d}"
            blind.append({"record_id": record_id, **record})
            key.append({"record_id": record_id, "case_id": case_id, "group": group})
        with (folder / "blind_rating_sheet.csv").open("w", encoding="utf-8-sig", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=list(blind[0]))
            writer.writeheader()
            writer.writerows(blind)
        with (folder / "blind_key_keep_private.csv").open("w", encoding="utf-8-sig", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=list(key[0]))
            writer.writeheader()
            writer.writerows(key)
    print(f"Summarized {len(rows)} results in {folder}")


if __name__ == "__main__":
    main()
