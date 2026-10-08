"""Frozen v1 benchmark cases: 3 levels × 2 vocabulary mixes × 4 topics.

The mixes are fixed study scenarios, not a test of the production word selector.
Each case has six distinct target lemmas. Do not edit after viewing model outputs;
create v2 instead.
"""

LEVELS = ("A2", "B1", "B2")
MIXES = ("two_new", "four_new")
TOPICS = {
    "campus": {
        "topic": "A campus volunteer project",
        "words": ("organize", "support", "resource", "practice", "improve", "community"),
    },
    "environment": {
        "topic": "A neighborhood environmental project",
        "words": ("reduce", "recycle", "protect", "impact", "local", "change"),
    },
    "technology": {
        "topic": "Using technology to solve an everyday problem",
        "words": ("design", "device", "connect", "information", "solve", "result"),
    },
    "health": {
        "topic": "A healthy daily routine",
        "words": ("balance", "habit", "energy", "regular", "prepare", "benefit"),
    },
}


def cases():
    result = []
    for level in LEVELS:
        for mix in MIXES:
            for key, spec in TOPICS.items():
                words = list(spec["words"])
                new_count = 2 if mix == "two_new" else 4
                result.append({
                    "id": f"{level.lower()}_{mix}_{key}",
                    "level": level,
                    "mix": mix,
                    "topic": spec["topic"],
                    "new_words": words[:new_count],
                    "review_words": words[new_count:],
                    "min_words": 350,
                    "max_words": 450,
                    "new_occurrences": 2,
                    "review_occurrences": 1,
                })
    assert len(result) == 24
    return result
