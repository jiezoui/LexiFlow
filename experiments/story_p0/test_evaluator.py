import unittest

from cases import cases
from run import evaluate, prompts


class StoryBenchmarkEvaluatorTest(unittest.TestCase):
    def setUp(self):
        self.case = {**cases()[0], "new_words": ["river"], "review_words": []}

    def test_counts_visible_words_even_without_markers(self):
        raw = '{"contentMarked":"The river changed beside the river.","translationCn":"河流改变了。"}'
        verdict = evaluate(raw, self.case, {})
        self.assertEqual(verdict["target_counts"]["river"], 2)
        self.assertIn("rare_vocabulary_unverifiable", verdict["violations"])

    def test_false_marker_does_not_create_a_target_occurrence(self):
        raw = '{"contentMarked":"The [[table|river]] was large.","translationCn":"桌子很大。"}'
        verdict = evaluate(raw, self.case, {})
        self.assertEqual(verdict["target_counts"]["river"], 0)
        self.assertFalse(verdict["target_ok"])

    def test_rewrite_uses_the_same_target_set_and_failure_reasons(self):
        _, prompt = prompts(self.case, "C", "draft text", ["target_frequency", "length"])
        self.assertIn("target_frequency", prompt)
        self.assertIn("river >= 2", prompt)
        self.assertIn("draft text", prompt)


if __name__ == "__main__":
    unittest.main()
