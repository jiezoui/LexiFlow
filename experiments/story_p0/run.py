"""Paired A/B/C story-generation benchmark using an OpenAI-compatible endpoint.

A = ordinary prompt; B = structured production-style prompt; C = B's exact first
draft plus one validation-guided rewrite. Outputs and failures are kept in JSONL.
The script uses only Python's standard library and never writes the API key.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from collections import Counter
from pathlib import Path

from cases import cases

WORD = re.compile(r"[a-zA-Z]+(?:'[a-zA-Z]+)?")
MARK = re.compile(r"\[\[([^|\]]+)\|([^|\]]+)\]\]")
HAN = re.compile(r"[\u3400-\u9fff]")
GUIDANCE = {
    "A2": "Use familiar concrete situations, mostly short direct sentences, and explicit connections between ideas.",
    "B1": "Use clear narration on familiar subjects, moderate sentence length, and explain unfamiliar concepts in context.",
    "B2": "Allow abstract arguments and varied subordinate clauses while keeping the line of reasoning explicit.",
}
RARE_LIMIT = {"A2": (3000, 8), "B1": (5000, 12), "B2": (8000, 18)}
SENTENCE_UPPER = {"A2": 17, "B1": 23, "B2": 31}


def stem(word: str) -> str:
    word = word.lower()
    if len(word) <= 3:
        return word
    if word.endswith("ies") and len(word) > 4:
        return word[:-3] + "y"
    if word.endswith(("shes", "ches", "xes", "ses")):
        return word[:-2]
    if word.endswith("s") and not word.endswith(("ss", "us", "is")):
        return word[:-1]
    if word.endswith("ing"):
        return word[:-4] if len(word) > 5 and word[-4] == word[-5] else word[:-3]
    if word.endswith("ied"):
        return word[:-3] + "y"
    if word.endswith("ed"):
        return word[:-3] if len(word) > 4 and word[-3] == word[-4] else word[:-2]
    return word


def matches(surface: str, lemma: str) -> bool:
    surface, lemma = surface.lower(), lemma.lower()
    if surface == lemma or stem(surface) == lemma:
        return True
    if len(lemma) < 3:
        return False
    if surface in (lemma + "s", lemma + "ed", lemma + "ing"):
        return True
    if lemma.endswith("e") and surface in (lemma + "d", lemma[:-1] + "ing"):
        return True
    if lemma.endswith("y") and len(lemma) > 3 and surface in (lemma[:-1] + "ies", lemma[:-1] + "ied"):
        return True
    return False


def parse_answer(raw: str) -> tuple[dict, str | None]:
    clean = raw.strip()
    if clean.startswith("```json"):
        clean = clean[7:]
    elif clean.startswith("```"):
        clean = clean[3:]
    if clean.endswith("```"):
        clean = clean[:-3]
    try:
        obj = json.loads(clean.strip())
        if isinstance(obj, dict):
            return obj, None
    except json.JSONDecodeError as exc:
        return {}, f"invalid_json:{exc.msg}"
    return {}, "not_json_object"


def load_ranks(path: Path) -> dict[str, int]:
    ranks = {}
    with path.open(encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            word = row.get("word", "").lower()
            if not word or not word.isascii():
                continue
            try:
                frq = int(row.get("frq") or 0)
                bnc = int(row.get("bnc") or 0)
            except ValueError:
                continue
            rank = frq if frq > 0 else bnc if bnc > 0 else 0
            if 0 < rank < 99999:
                ranks[word] = rank
    return ranks


def evaluate(raw: str, case: dict, ranks: dict[str, int]) -> dict:
    obj, parse_error = parse_answer(raw)
    marked = str(obj.get("contentMarked") or "")
    translation = str(obj.get("translationCn") or "")
    clean = MARK.sub(lambda m: m.group(1).strip(), marked)
    tokens = [m.group().lower() for m in WORD.finditer(clean)]
    targets = case["new_words"] + case["review_words"]
    counts = {word: sum(matches(token, word) for token in tokens) for word in targets}
    target_ok = all(counts[word] >= case["new_occurrences"] for word in case["new_words"])
    target_ok &= all(counts[word] >= case["review_occurrences"] for word in case["review_words"])
    length_ok = int(case["min_words"] * 0.9) <= len(tokens) <= int(case["max_words"] * 1.1 + 0.999)
    sentence_lengths = [len(WORD.findall(part)) for part in re.split(r"[.!?]+(?:\s+|$)", clean)]
    sentence_lengths = [n for n in sentence_lengths if n]
    avg_sentence = sum(sentence_lengths) / len(sentence_lengths) if sentence_lengths else 0
    sentence_lower = 10 if case["level"] == "B2" else 0
    sentence_ok = bool(sentence_lengths) and sentence_lower <= avg_sentence <= SENTENCE_UPPER[case["level"]]
    non_target = [stem(w) for w in tokens if len(w) > 2 and stem(w) not in targets]
    known = [ranks[w] for w in non_target if w in ranks]
    coverage = len(known) / len(non_target) if non_target else 0
    rare_rate = None
    rare_ok = None
    if known and coverage >= 0.7:
        threshold, maximum = RARE_LIMIT[case["level"]]
        rare_rate = round(100 * sum(rank > threshold for rank in known) / len(known), 2)
        rare_ok = rare_rate <= maximum
    translation_ok = bool(HAN.search(translation))
    violations = []
    if parse_error:
        violations.append(parse_error)
    if not target_ok:
        violations.append("target_frequency")
    if not length_ok:
        violations.append("length")
    if not sentence_ok:
        violations.append("sentence_length")
    if rare_ok is False:
        violations.append("rare_vocabulary")
    if rare_ok is None:
        violations.append("rare_vocabulary_unverifiable")
    if not translation_ok:
        violations.append("translation")
    return {
        "target_counts": counts, "target_ok": target_ok, "length_ok": length_ok,
        "word_count": len(tokens), "average_sentence_words": round(avg_sentence, 2),
        "sentence_ok": sentence_ok, "dictionary_coverage": round(coverage, 3),
        "rare_rate": rare_rate, "rare_ok": rare_ok, "translation_ok": translation_ok,
        "parse_error": parse_error, "violations": violations, "accepted": not violations,
    }


def prompts(case: dict, group: str, previous: str = "", violations: list[str] | None = None) -> tuple[str, str]:
    new, review = case["new_words"], case["review_words"]
    if group == "A":
        return (
            "You write English learning materials.",
            f"Write an English article for {case['level']} learners about {case['topic']}. "
            f"Include these words naturally: {', '.join(new + review)}. "
            f"Aim for {case['min_words']}-{case['max_words']} words and provide a Chinese translation. "
            'Return JSON with title, topic, contentMarked, and translationCn fields.',
        )
    system = (
        "You are a world-class English linguist and language learning material designer. "
        "Write a cohesive English story for language learners. Output STRICT JSON only. "
        "Wrap target words as [[surface_form|dictionary_lemma]]. "
        "The story must be natural, grammatically sound and logically consistent. "
        "Markers belong only in contentMarked. Provide a faithful Chinese translation with matching paragraph breaks."
    )
    if group == "B":
        user = (
            f"Target CEFR reading difficulty: {case['level']}. {GUIDANCE[case['level']]}\n"
            f"Theme: {case['topic']}\n"
            f"NEW VOCABULARY (each at least {case['new_occurrences']} times): {', '.join(new)}\n"
            f"REVIEW VOCABULARY (each at least {case['review_occurrences']} times): {', '.join(review)}\n"
            f"Length: {case['min_words']}-{case['max_words']} English words. Several coherent paragraphs. "
            "Distribute repetitions; avoid adjacent repetition solely to meet the count. "
            "Wrap every occurrence of target words with [[surface|lemma]]. "
            "Provide a fluent paragraph-by-paragraph Chinese translation without markers. "
            'Return STRICT JSON: {"title":"...","topic":"...","contentMarked":"...","translationCn":"..."}.'
        )
        return system, user
    requirements = [f"{w} >= {case['new_occurrences']}" for w in new]
    requirements += [f"{w} >= {case['review_occurrences']}" for w in review]
    user = (
        f"The previous article failed these checks: {', '.join(violations or [])}. "
        f"Rewrite the complete article at {case['level']} within {case['min_words']}-{case['max_words']} words. "
        f"Preserve the narrative, meet target frequencies ({', '.join(requirements)}), "
        "wrap target words as [[surface|lemma]], and regenerate the aligned natural Chinese translation. "
        'Return STRICT JSON with title, topic, contentMarked, translationCn.\nPREVIOUS STORY:\n' + previous
    )
    return system, user


def call_model(base_url: str, model: str, key: str, system: str, user: str) -> tuple[str, dict, float]:
    endpoint = base_url.rstrip("/") + "/chat/completions"
    body = json.dumps({
        "model": model, "temperature": 0.3, "max_tokens": 5000,
        "thinking": {"type": "disabled"},
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
    }).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if key:
        headers["Authorization"] = "Bearer " + key
    req = urllib.request.Request(endpoint, data=body, headers=headers, method="POST")
    start = time.perf_counter()
    with urllib.request.urlopen(req, timeout=120) as response:
        payload = json.load(response)
    elapsed = round(time.perf_counter() - start, 3)
    content = payload["choices"][0]["message"]["content"]
    if isinstance(content, list):
        content = "".join(part.get("text", "") for part in content if isinstance(part, dict))
    return str(content), payload.get("usage") or {}, elapsed


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="https://api.deepseek.com", help="OpenAI-compatible API base URL")
    parser.add_argument("--model", default="deepseek-flash", help="Exact model ID from the frontend configuration")
    parser.add_argument("--key-env", default="STORY_BENCH_API_KEY", help="Environment variable containing the API key")
    parser.add_argument("--key-file", type=Path, help="Optional local file containing only the API key; keep it outside version control")
    parser.add_argument("--ecdict", type=Path, default=Path(__file__).resolve().parents[2] / "material/ecdict.csv")
    parser.add_argument("--output", type=Path, default=Path(__file__).parent / "results.local")
    parser.add_argument("--limit", type=int, default=24, help="Pilot with 1; full protocol uses 24")
    parser.add_argument("--validate-only", action="store_true", help="Check frozen inputs and evaluator without calling a model")
    args = parser.parse_args()
    frozen = cases()[:args.limit]
    assert args.limit in range(1, 25) and len({c["id"] for c in frozen}) == len(frozen)
    if not args.ecdict.exists():
        parser.error(f"ECDICT CSV missing: {args.ecdict}")
    if not args.validate_only and (not args.base_url or not args.model):
        parser.error("--base-url and --model are required for live generation")
    ranks = load_ranks(args.ecdict)
    args.output.mkdir(parents=True, exist_ok=True)
    output = args.output / "runs.jsonl"
    if not args.validate_only and output.exists():
        parser.error(f"Output already exists: {output}. Use a new --output to keep runs immutable.")
    manifest = {
        "protocol": "story-p0-v1", "cases": frozen, "model": args.model,
        "base_url": args.base_url, "temperature": 0.3, "max_tokens": 5000,
        "thinking": "disabled",
        "ecdict_sha256": sha(args.ecdict), "runner_sha256": sha(Path(__file__)),
        "production_story_service_sha256": sha(Path(__file__).resolve().parents[2] / "server/src/main/java/com/lexiflow/modules/contextual/service/impl/ContextStoryServiceImpl.java"),
        "note": "The benchmark freezes the production-style prompt; compare prompt text against the recorded service hash before claiming exact parity.",
    }
    (args.output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    if args.validate_only:
        sample = '{"contentMarked":"The [[river|river]] changed beside the river.","translationCn":"河流改变了。"}'
        check = evaluate(sample, {**frozen[0], "new_words": ["river"], "review_words": []}, ranks)
        assert check["target_counts"]["river"] == 2
        print(f"Validated {len(frozen)} frozen cases and evaluator; no model calls made.")
        return 0

    key = os.environ.get(args.key_env, "")
    if args.key_file is not None:
        if not args.key_file.is_file():
            parser.error(f"Key file missing: {args.key_file}")
        key = args.key_file.read_text(encoding="utf-8-sig").strip()
    if not key and not args.base_url.startswith(("http://127.0.0.1", "http://localhost")):
        parser.error(f"No API key found in {args.key_env} or --key-file")
    with output.open("w", encoding="utf-8") as handle:
        for case in frozen:
            first = {}
            for group in ("A", "B"):
                system, user = prompts(case, group)
                first[group] = (system, user)
                try:
                    raw, usage, seconds = call_model(args.base_url, args.model, key, system, user)
                    error = None
                except (urllib.error.URLError, ValueError, KeyError, TimeoutError) as exc:
                    raw, usage, seconds, error = "", {}, None, f"{type(exc).__name__}: {exc}"
                verdict = evaluate(raw, case, ranks)
                row = {"case_id": case["id"], "group": group, "prompt": {"system": system, "user": user},
                       "raw": raw, "usage": usage, "seconds": seconds, "request_error": error, "verdict": verdict}
                handle.write(json.dumps(row, ensure_ascii=False) + "\n")
                handle.flush()
                if group == "B":
                    b_raw, b_verdict, b_error = raw, verdict, error
            if b_verdict["accepted"] or b_error:
                row = {"case_id": case["id"], "group": "C", "reused_b_first_draft": True,
                       "rewrite_called": False, "raw": b_raw, "usage": {}, "seconds": 0,
                       "request_error": b_error, "verdict": b_verdict}
            else:
                b_obj, _ = parse_answer(b_raw)
                previous = str(b_obj.get("contentMarked") or b_raw)
                system, user = prompts(case, "C", previous, b_verdict["violations"])
                try:
                    raw, usage, seconds = call_model(args.base_url, args.model, key, system, user)
                    error = None
                except (urllib.error.URLError, ValueError, KeyError, TimeoutError) as exc:
                    raw, usage, seconds, error = "", {}, None, f"{type(exc).__name__}: {exc}"
                row = {"case_id": case["id"], "group": "C", "reused_b_first_draft": True,
                       "rewrite_called": True, "prompt": {"system": system, "user": user},
                       "raw": raw, "usage": usage, "seconds": seconds,
                       "request_error": error, "verdict": evaluate(raw, case, ranks)}
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")
            handle.flush()
            print(f"{case['id']}: A/B/C recorded", flush=True)
    print(f"Raw results: {output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
