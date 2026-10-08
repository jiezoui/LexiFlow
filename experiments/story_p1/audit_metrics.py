"""Re-evaluate saved P0/P1 model outputs after irregular-word normalization.

This never changes raw experimental records; it writes a separate sensitivity audit.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

from protocol import evaluate, p0

ROOT = Path(__file__).resolve().parents[2]


def audit(folder: Path, ranks: dict[str, int]) -> dict:
    manifest = json.loads((folder / "manifest.json").read_text(encoding="utf-8"))
    cases = {case["id"]: case for case in manifest["cases"]}
    rows = [json.loads(line) for line in (folder / "runs.jsonl").read_text(encoding="utf-8").splitlines() if line]
    groups: dict[str, dict] = {}
    changes = []
    for row in rows:
        group = row["group"]
        old = row["verdict"]
        raw = row.get("final_raw", row["drafts"][-1]["raw"] if "drafts" in row else row["raw"])
        new = evaluate(raw, cases[row["case_id"]], ranks)
        item = groups.setdefault(group, {"n": 0, "original_accepted": 0, "corrected_accepted": 0,
                                         "original_rare_ok": 0, "corrected_rare_ok": 0})
        item["n"] += 1
        item["original_accepted"] += int(old["accepted"])
        item["corrected_accepted"] += int(new["accepted"])
        item["original_rare_ok"] += int(old["rare_ok"] is True)
        item["corrected_rare_ok"] += int(new["rare_ok"] is True)
        if old["accepted"] != new["accepted"] or old["rare_ok"] != new["rare_ok"]:
            changes.append({
                "case_id": row["case_id"], "group": group,
                "old_accepted": old["accepted"], "new_accepted": new["accepted"],
                "old_rare_rate": old["rare_rate"], "new_rare_rate": new["rare_rate"],
                "old_violations": old["violations"], "new_violations": new["violations"],
            })
    return {"folder": str(folder), "groups": groups, "changes": changes}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("folders", nargs="+", type=Path)
    parser.add_argument("--output", type=Path, default=Path(__file__).parent / "metric_audit.local.json")
    args = parser.parse_args()
    ranks = p0.load_ranks(ROOT / "material/ecdict.csv")
    result = [audit(folder, ranks) for folder in args.folders]
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    for item in result:
        print(item["folder"], item["groups"], "changed cases:", len(item["changes"]))


if __name__ == "__main__":
    main()
