"""Summarize the frozen A/B/C run and create a blinded human-rating sheet."""

from __future__ import annotations

import argparse
import csv
import json
import random
from collections import defaultdict
from pathlib import Path

from run import MARK, parse_answer


def token_total(usage: dict) -> int | None:
    value = usage.get("total_tokens")
    if value is not None:
        return int(value)
    prompt = usage.get("prompt_tokens")
    completion = usage.get("completion_tokens")
    return int(prompt) + int(completion) if prompt is not None and completion is not None else None


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path, help="Directory containing manifest.json and runs.jsonl")
    args = parser.parse_args()
    folder = args.output
    manifest = json.loads((folder / "manifest.json").read_text(encoding="utf-8"))
    cases = {item["id"]: item for item in manifest["cases"]}
    rows = [json.loads(line) for line in (folder / "runs.jsonl").read_text(encoding="utf-8").splitlines() if line]
    by_case = defaultdict(dict)
    for row in rows:
        key = (row["case_id"], row["group"])
        if row["group"] in by_case[row["case_id"]]:
            parser.error(f"Duplicate result: {key}")
        by_case[row["case_id"]][row["group"]] = row
    if set(by_case) != set(cases) or any(set(grouped) != {"A", "B", "C"} for grouped in by_case.values()):
        parser.error("Incomplete A/B/C run; preserve raw data and rerun into a new output directory")

    detail = []
    for case_id, grouped in by_case.items():
        case = cases[case_id]
        for group in ("A", "B", "C"):
            row = grouped[group]
            verdict = row["verdict"]
            first = grouped["B"] if group == "C" else None
            own_tokens = token_total(row.get("usage") or {})
            first_tokens = token_total(first.get("usage") or {}) if first else None
            total_tokens = (
                first_tokens + own_tokens
                if group == "C" and first_tokens is not None and own_tokens is not None
                else first_tokens if group == "C" and not row.get("rewrite_called")
                else own_tokens if group != "C"
                else None
            )
            first_seconds = first.get("seconds") if first else None
            seconds = row.get("seconds")
            total_seconds = (first_seconds + seconds) if first_seconds is not None and seconds is not None else seconds
            detail.append({
                "case_id": case_id, "level": case["level"], "mix": case["mix"], "group": group,
                "accepted": int(verdict["accepted"]), "target_ok": int(verdict["target_ok"]),
                "length_ok": int(verdict["length_ok"]), "sentence_ok": int(verdict["sentence_ok"]),
                "rare_ok": "UNKNOWN" if verdict["rare_ok"] is None else int(verdict["rare_ok"]),
                "translation_ok": int(verdict["translation_ok"]),
                "word_count": verdict["word_count"], "average_sentence_words": verdict["average_sentence_words"],
                "rare_rate": verdict["rare_rate"], "dictionary_coverage": verdict["dictionary_coverage"],
                "rewrite_called": int(bool(row.get("rewrite_called"))),
                "request_error": row.get("request_error") or "",
                "total_tokens": total_tokens if total_tokens is not None else "UNKNOWN",
                "total_seconds": total_seconds if total_seconds is not None else "UNKNOWN",
                "violations": ";".join(verdict["violations"]),
            })
    path = folder / "metrics.csv"
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(detail[0]))
        writer.writeheader()
        writer.writerows(detail)

    summary = {}
    for group in ("A", "B", "C"):
        selected = [item for item in detail if item["group"] == group]
        summary[group] = {
            "n": len(selected),
            "accepted": sum(item["accepted"] for item in selected),
            "target_ok": sum(item["target_ok"] for item in selected),
            "length_ok": sum(item["length_ok"] for item in selected),
            "sentence_ok": sum(item["sentence_ok"] for item in selected),
            "rare_unknown": sum(item["rare_ok"] == "UNKNOWN" for item in selected),
            "translation_ok": sum(item["translation_ok"] for item in selected),
            "request_errors": sum(bool(item["request_error"]) for item in selected),
            "rewrites": sum(item["rewrite_called"] for item in selected),
        }
    (folder / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

    # The scorer sheet contains no group label or automatic verdict. Keep key private
    # until both raters have independently submitted their scores.
    blind = []
    key = []
    for case_id in sorted(cases):
        for group in ("A", "B", "C"):
            row = by_case[case_id][group]
            obj, _ = parse_answer(row.get("raw") or "")
            marked = str(obj.get("contentMarked") or "")
            content = MARK.sub(lambda m: m.group(1), marked)
            record_id = f"R{len(blind) + 1:03d}"
            blind.append({
                "record_id": record_id, "level": cases[case_id]["level"],
                "topic": cases[case_id]["topic"],
                "target_words": ", ".join(cases[case_id]["new_words"] + cases[case_id]["review_words"]),
                "article": content, "translation": str(obj.get("translationCn") or ""),
                "rater_id": "", "naturalness_1_to_5": "", "coherence_1_to_5": "",
                "target_use_1_to_5": "", "translation_faithfulness_1_to_5": "", "notes": "",
            })
            key.append({"record_id": record_id, "case_id": case_id, "group": group})
    random.Random(20261008).shuffle(blind)
    with (folder / "blind_rating_sheet.csv").open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(blind[0]))
        writer.writeheader()
        writer.writerows(blind)
    with (folder / "blind_key_keep_private.csv").open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(key[0]))
        writer.writeheader()
        writer.writerows(key)
    print(f"Wrote {path}, summary.json, and blinded rating sheets")


if __name__ == "__main__":
    main()
