"""One-call, failure-aware repair: append for short-only drafts, regenerate otherwise."""

from __future__ import annotations

import json

from protocol import GUIDANCE, SYSTEM, p0, rare_words, reasons


def mode(verdict: dict, case: dict) -> str:
    minimum = int(case["min_words"] * 0.9)
    if (verdict["violations"] == ["length"] and 0 < verdict["word_count"] < minimum
            and verdict["translation_ok"] and verdict["target_ok"]):
        return "append"
    return "fresh"


def prompt(case: dict, repair_mode: str, previous: str, verdict: dict,
           ranks: dict[str, int]) -> tuple[str, str]:
    requirements = ", ".join(
        [f"{word} >= {case['new_occurrences']}" for word in case["new_words"]]
        + [f"{word} >= {case['review_occurrences']}" for word in case["review_words"]]
    )
    if repair_mode == "append":
        current = verdict["word_count"]
        target = (case["min_words"] + case["max_words"]) // 2
        maximum = int(case["max_words"] * 1.1 + 0.999)
        low = max(25, target - current - 10)
        high = min(maximum - current, target - current + 10)
        if high < low:
            high = low
        user = f"""Continue the existing English story with new ending paragraph(s).
The existing English article has {current} words. Add {low}-{high} NEW English words to reach about {target} total English words. Count only English, not the Chinese translation or [[surface|lemma]] metadata.
Write new concrete events or explanations that fit the existing story. Do not repeat or paraphrase old sentences. Keep language at CEFR {case['level']}; {GUIDANCE[case['level']]}
Do not remove existing target-word occurrences. If a target word appears in the addition, mark it as [[surface|lemma]].
Return STRICT JSON ONLY with these two fields:
{{"additionalParagraphEn":"new English paragraph(s)","additionalParagraphCn":"对应的新中文段落"}}
The Chinese text must faithfully translate the addition and use matching paragraph breaks.
EXISTING ENGLISH STORY:
{previous}
"""
        return SYSTEM, user

    avoid = rare_words(previous, case, ranks) if verdict["rare_ok"] is False else []
    avoid_text = ", ".join(avoid) if avoid else "none identified"
    target = (case["min_words"] + case["max_words"]) // 2
    user = f"""Create a FRESH English learning article from scratch. Discard the failed draft; do not copy it.
Topic: {case['topic']}
CEFR: {case['level']}. {GUIDANCE[case['level']]}
The previous attempt failed these checks: {'; '.join(reasons(case, verdict))}.
Write {case['min_words']}-{case['max_words']} English words in contentMarked, aiming for about {target}. Use coherent paragraphs with a new concrete event or idea in each. Use familiar high-frequency words except the required target words. Avoid these non-target words when possible: {avoid_text}.
Target word minimum occurrences: {requirements}. Distribute them naturally; mark all occurrences [[surface|lemma]].
Return STRICT JSON with title, topic, contentMarked, translationCn. The Chinese translation must match the final English paragraphs without markers.
"""
    return SYSTEM, user


def combine(repair_mode: str, repair_raw: str, previous_raw: str) -> str:
    if repair_mode != "append":
        return repair_raw
    previous, previous_error = p0.parse_answer(previous_raw)
    patch, patch_error = p0.parse_answer(repair_raw)
    if previous_error or patch_error:
        return previous_raw
    extra_en = str(patch.get("additionalParagraphEn") or "").strip()
    extra_cn = str(patch.get("additionalParagraphCn") or "").strip()
    if not extra_en or not extra_cn:
        return previous_raw
    result = dict(previous)
    result["contentMarked"] = str(previous.get("contentMarked") or "").rstrip() + "\n\n" + extra_en
    result["translationCn"] = str(previous.get("translationCn") or "").rstrip() + "\n\n" + extra_cn
    return json.dumps(result, ensure_ascii=False)
