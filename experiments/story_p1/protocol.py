"""Frozen P1 prompt variants and diagnostic helpers.

The two structured prompt variants mirror the Java service before and after P1.
This is an experiment adapter, not a call into the Java database service.
"""

from __future__ import annotations

from pathlib import Path
import sys

P0_DIR = Path(__file__).resolve().parents[1] / "story_p0"
sys.path.insert(0, str(P0_DIR))
import run as p0  # noqa: E402

GUIDANCE = p0.GUIDANCE
IRREGULAR = {
    "am": "be", "is": "be", "are": "be", "was": "be", "were": "be", "been": "be",
    "said": "say", "went": "go", "gone": "go", "had": "have", "did": "do", "done": "do",
    "made": "make", "got": "get", "gotten": "get", "saw": "see", "seen": "see",
    "took": "take", "taken": "take", "came": "come", "found": "find",
    "knew": "know", "known": "know", "thought": "think", "told": "tell",
    "bought": "buy", "brought": "bring", "met": "meet", "left": "leave",
    "ate": "eat", "eaten": "eat", "gave": "give", "given": "give",
    "wrote": "write", "written": "write", "ran": "run", "spoke": "speak", "spoken": "speak",
}
SYSTEM = """You are a world-class English linguist and language learning material designer.
Your task is to write a cohesive, engaging English story specifically crafted for language learners.
CRITICAL CONSTRAINTS:
1. You must output STRICTLY in JSON format with no additional text or conversational filler.
2. Target vocabulary words MUST be wrapped with the syntax: [[surface_form|dictionary_lemma]].
   Example: "She [[studied|study]] diligently while trying to [[reduce|reduce]] carbon emissions."
3. The surface form is the inflected word used in the sentence, and the dictionary lemma is the base form provided in the target list.
4. The story MUST be natural, grammatically flawless, and logically consistent.
5. Do not write a boring vocabulary list; build a captivating narrative.
6. Vocabulary markers belong ONLY in contentMarked. translationCn must be fluent, natural Chinese prose with no [[...]] markers, English lemmas, or vocabulary glosses.
7. Translate the FINAL English story faithfully, preserving its characters, events, and paragraph boundaries. Separate matching paragraphs with two newline characters.
"""


def initial(case: dict, group: str) -> tuple[str, str]:
    if group == "A":
        return p0.prompts(case, "A")
    new, review = case["new_words"], case["review_words"]
    length = f"Length: {case['min_words']} - {case['max_words']} English words. Develop a coherent article with several paragraphs."
    user = f"""Target CEFR reading difficulty: {case['level']}. {GUIDANCE[case['level']]}
Exam/topic context (not a CEFR equivalence): GENERAL
Theme/Topic: {case['topic']}

NEW VOCABULARY (Each MUST appear naturally at least {case['new_occurrences']} times, in separate parts of the article):
{', '.join(new)}

REVIEW VOCABULARY (Each MUST appear naturally at least {case['review_occurrences']} times):
{', '.join(review)}

REQUIREMENTS:
1. {length}
2. Wrap every single occurrence of the target vocabulary with [[surface|lemma]].
3. Distribute repetitions across the article; avoid repeating the same word in adjacent sentences just to meet a count.
4. Use the specified reading level in sentence structure, cohesion, and supporting vocabulary.
5. Provide an accurate and fluent paragraph-by-paragraph Chinese translation of contentMarked. Translate visible English words, not marker metadata; never copy [[...]] tags into translationCn.
6. Output STRICT JSON format as follows:
{{
  "title": "Creative Story Title",
  "topic": "{case['topic']}",
  "contentMarked": "Story text with [[surface|lemma]] tags...",
  "translationCn": "完整中文对照翻译..."
}}
"""
    return SYSTEM, user


def reasons(case: dict, verdict: dict) -> list[str]:
    issues = []
    if verdict["parse_error"]:
        issues.append("Invalid JSON or missing required story fields")
    if not verdict["length_ok"]:
        issues.append(f"English length {verdict['word_count']} words, required {case['min_words']}-{case['max_words']}")
    for word in case["new_words"]:
        actual = verdict["target_counts"][word]
        if actual < case["new_occurrences"]:
            issues.append(f"{word} (req: {case['new_occurrences']}, actual: {actual})")
    for word in case["review_words"]:
        actual = verdict["target_counts"][word]
        if actual < case["review_occurrences"]:
            issues.append(f"{word} (req: {case['review_occurrences']}, actual: {actual})")
    if not verdict["translation_ok"]:
        issues.append("Missing Chinese translation")
    if not verdict["sentence_ok"] or verdict["rare_ok"] is not True:
        issues.append(f"Sentence length or non-target rare-word rate mismatched {case['level']}")
    return issues


def word_lemmas(clean: str) -> list[str]:
    result = []
    for match in p0.WORD.finditer(clean):
        surface = match.group()
        if surface[0].isupper():
            prefix = clean[:match.start()].rstrip()
            if prefix and prefix[-1] not in ".!?":
                continue
        lower = surface.lower()
        result.append(IRREGULAR.get(lower, p0.stem(lower)))
    return result


def evaluate(raw: str, case: dict, ranks: dict[str, int]) -> dict:
    verdict = p0.evaluate(raw, case, ranks)
    parsed, _ = p0.parse_answer(raw)
    marked = str(parsed.get("contentMarked") or "")
    clean = p0.MARK.sub(lambda match: match.group(1).strip(), marked)
    targets = set(case["new_words"] + case["review_words"])
    tokens = [word for word in word_lemmas(clean) if len(word) > 2 and word not in targets]
    known = [ranks[word] for word in tokens if word in ranks]
    coverage = len(known) / len(tokens) if tokens else 0
    rare_rate = None
    rare_ok = None
    if known and coverage >= 0.7:
        threshold, maximum = p0.RARE_LIMIT[case["level"]]
        rare_rate = round(100 * sum(rank > threshold for rank in known) / len(known), 2)
        rare_ok = rare_rate <= maximum
    violations = []
    if verdict["parse_error"]:
        violations.append(verdict["parse_error"])
    if not verdict["target_ok"]:
        violations.append("target_frequency")
    if not verdict["length_ok"]:
        violations.append("length")
    if not verdict["sentence_ok"]:
        violations.append("sentence_length")
    if rare_ok is False:
        violations.append("rare_vocabulary")
    elif rare_ok is None:
        violations.append("rare_vocabulary_unverifiable")
    if not verdict["translation_ok"]:
        violations.append("translation")
    verdict.update({
        "dictionary_coverage": round(coverage, 3), "rare_rate": rare_rate,
        "rare_ok": rare_ok, "violations": violations, "accepted": not violations,
    })
    return verdict


def rare_words(previous: str, case: dict, ranks: dict[str, int]) -> list[str]:
    clean = p0.MARK.sub(lambda match: match.group(1).strip(), previous)
    targets = set(case["new_words"] + case["review_words"])
    threshold = p0.RARE_LIMIT[case["level"]][0]
    result = []
    for lemma in word_lemmas(clean):
        if lemma not in targets and ranks.get(lemma, 0) > threshold and lemma not in result:
            result.append(lemma)
    return result[:12]


def rewrite(case: dict, group: str, previous: str, verdict: dict, ranks: dict[str, int]) -> tuple[str, str]:
    requirements = ", ".join(
        [f"{word} >= {case['new_occurrences']}" for word in case["new_words"]]
        + [f"{word} >= {case['review_occurrences']}" for word in case["review_words"]]
    )
    intro = f"""The previous article did not meet the following checks:
{'; '.join(reasons(case, verdict))}

Please rewrite the complete article at CEFR {case['level']}, within {case['min_words']}-{case['max_words']} English words.
"""
    if group == "B":
        body = f"""RULES:
1. Preserve the original narrative storyline and characters.
2. Naturally integrate every target word with [[surface|lemma]] markers.
3. Meet each minimum frequency exactly or exceed it: {requirements}.
4. Regenerate translationCn from the rewritten English story. Use natural Chinese with the same paragraph breaks, and no [[...]] markers or English lemma hints.
5. Return STRICT JSON:
{{
  "title": "Story Title",
  "topic": "Topic",
  "contentMarked": "Rewritten story with [[surface|lemma]] tags...",
  "translationCn": "中文对照翻译..."
}}
"""
    else:
        count = verdict["word_count"]
        target = (case["min_words"] + case["max_words"]) // 2
        minimum = int(case["min_words"] * 0.9)
        maximum = int(case["max_words"] * 1.1 + 0.999)
        if count < minimum:
            length_action = (
                f"The English draft has {count} words; the accepted minimum is {minimum}. "
                f"Add at least {target - count} useful English words, aiming for about {target} words. "
                "Add new concrete events or explanations across paragraphs."
            )
        elif count > maximum:
            length_action = (
                f"The English draft has {count} words; the accepted maximum is {maximum}. "
                f"Remove at least {count - target} English words without removing required target-word occurrences."
            )
        else:
            length_action = f"The English draft has {count} words; keep it within {case['min_words']}-{case['max_words']} English words."
        rare = rare_words(previous, case, ranks) if verdict["rare_ok"] is False else []
        vocabulary_action = (
            f"Current non-target rare-word rate: {verdict['rare_rate']}%. "
            + (f"Consider simpler alternatives for non-target words such as: {', '.join(rare)}." if rare else "")
            if verdict["rare_ok"] is False else ""
        )
        body = f"""MEASURED CORRECTIONS:
{length_action}
{vocabulary_action}
RULES:
1. Keep the original topic and characters, but change contentMarked substantially. Do not copy the previous English draft verbatim. When it is too short, add at least two meaningful events or explanations rather than padding repeated sentences.
2. Naturally integrate every target word with [[surface|lemma]] markers.
3. Meet each minimum frequency exactly or exceed it: {requirements}.
4. Use simpler familiar words where the difficulty check failed, without replacing required target words. Split overly long sentences when needed.
5. Regenerate translationCn from the rewritten English story. Use natural Chinese with the same paragraph breaks, and no [[...]] markers or English lemma hints.
6. Return STRICT JSON:
{{
  "title": "Story Title",
  "topic": "Topic",
  "contentMarked": "Rewritten story with [[surface|lemma]] tags...",
  "translationCn": "中文对照翻译..."
}}
"""
    return SYSTEM, intro + body + f"\nPREVIOUS STORY:\n{previous}\n"
