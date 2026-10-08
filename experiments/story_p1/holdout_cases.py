"""P1 independent test cases, frozen before any model responses were inspected.

The four themes and target lemmas are disjoint from the P0 themes and lemmas.
Do not edit after the first live P1 test run; version a new file instead.
"""

LEVELS = ("A2", "B1", "B2")
MIXES = ("two_new", "four_new")
TOPICS = {
    "library": {
        "topic": "A community library event",
        "words": ("borrow", "share", "library", "guide", "book", "visitor"),
    },
    "journey": {
        "topic": "A train journey to a new town",
        "words": ("journey", "ticket", "schedule", "arrive", "station", "explore"),
    },
    "market": {
        "topic": "Shopping at a weekend food market",
        "words": ("fresh", "select", "recipe", "taste", "customer", "seller"),
    },
    "sports": {
        "topic": "A neighborhood sports day",
        "words": ("team", "goal", "train", "challenge", "match", "celebrate"),
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
