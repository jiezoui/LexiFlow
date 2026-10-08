"""Focused regression checks for production pronunciation assessment v2."""

from __future__ import annotations

import itertools
import asyncio
import io
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from speech_bridge import assess
from speech_bridge.asr import Transcript
from speech_bridge.phonemize import WordPhonemes


class ViterbiAlignmentTest(unittest.TestCase):
    def _run(self, probabilities: np.ndarray, labels: list[int]):
        logp = np.log(probabilities)
        audio = np.zeros(3200, dtype=np.float32)
        reference = [(str(label), label) for label in labels]
        model = SimpleNamespace(config=SimpleNamespace(pad_token_id=0))
        with patch.object(assess, "load_phoneme_model", return_value=(None, model)), \
                patch.object(assess, "_log_probs", return_value=logp):
            return assess.ctc_viterbi_align(audio, reference)

    def test_matches_exhaustive_ctc_path(self):
        rng = np.random.default_rng(20261008)
        for labels in ([1], [1, 2], [1, 1], [1, 2, 1]):
            for _ in range(5):
                p = rng.dirichlet([2, 1, 1], size=6)
                best_path, best_logp = None, -np.inf
                for path in itertools.product(range(3), repeat=len(p)):
                    collapsed = [token for i, token in enumerate(path)
                                 if token != 0 and (i == 0 or token != path[i - 1])]
                    if collapsed != list(labels):
                        continue
                    value = sum(np.log(p[t, token]) for t, token in enumerate(path))
                    if value > best_logp:
                        best_path, best_logp = path, value
                self.assertIsNotNone(best_path)
                result = self._run(p, list(labels))
                self.assertEqual(len(result), len(labels))
                for k, label in enumerate(labels):
                    frames = [t for t, token in enumerate(best_path) if token == label
                              and sum(1 for j in range(t + 1)
                                      if best_path[j] != 0
                                      and (j == 0 or best_path[j] != best_path[j - 1])) == k + 1]
                    _, start, end, emission, _ = result[k]
                    self.assertEqual((start, end), (frames[0], frames[-1]))
                    self.assertAlmostEqual(emission, float(np.exp(np.log(p[frames, label]).mean())))

    def test_impossible_repeated_tokens_are_not_dropped(self):
        p = np.tile([0.1, 0.8, 0.1], (2, 1))
        self.assertEqual(self._run(p, [1, 1]), {})


class AssessmentReliabilityTest(unittest.TestCase):
    def test_unreliable_waveforms_request_rerecording(self):
        cases = [(np.zeros(16000, dtype=np.float32), "TOO_QUIET"),
                 (np.ones(16000, dtype=np.float32), "CLIPPING"),
                 (np.ones(1000, dtype=np.float32) * 0.1, "TOO_SHORT")]
        for audio, expected in cases:
            with self.subTest(expected=expected), self.assertRaises(assess.UnreliableRecording) as caught:
                assess.assess(audio, "hello")
            self.assertEqual(caught.exception.code, expected)

    def test_model_failure_has_no_false_phoneme_errors(self):
        t = np.arange(16000) / 16000
        audio = (0.1 * np.sin(2 * np.pi * 220 * t)).astype(np.float32)
        transcript = Transcript("hello", "en", 1.0, 1.0, [], "mock", "mock", 0)
        acoustic = {"duration_seconds": 1.0, "activity": {"speech_ratio": 0.8}}
        wp = WordPhonemes("hello", "h", ["h"], ["h"])
        with patch("speech_bridge.phonemize.word_phonemes", return_value=[wp]), \
                patch.object(assess, "load_phoneme_model", side_effect=RuntimeError("offline")):
            result = assess.assess(audio, "hello", transcript=transcript, acoustic=acoustic)
        self.assertFalse(result.engine["phoneme_alignment"])
        self.assertEqual(result.engine["scoring_method"], "word_level_fallback")
        self.assertEqual(result.counts["evaluated_phonemes"], 0)
        self.assertEqual(result.counts["poor_phonemes"], 0)
        self.assertEqual(result.words[0].phonemes, [])

    def test_api_returns_422_for_silence(self):
        from fastapi import UploadFile
        from speech_bridge.app import score_pronunciation
        from speech_bridge.audio import pcm16_to_wav_bytes

        upload = UploadFile(file=io.BytesIO(pcm16_to_wav_bytes(np.zeros(16000, dtype=np.float32))))
        response = asyncio.run(score_pronunciation(audio=upload, target_text="hello"))
        self.assertEqual(response.status_code, 422)
        self.assertIn(b'TOO_QUIET', response.body)

    def test_major_transcript_mismatch_abstains_before_phoneme_model(self):
        t = np.arange(16000) / 16000
        audio = (0.1 * np.sin(2 * np.pi * 220 * t)).astype(np.float32)
        transcript = Transcript("utterly different phrase", "en", 1.0, 1.0, [], "mock", "mock", 0)
        acoustic = {"duration_seconds": 1.0, "activity": {"speech_ratio": 0.8}}
        with patch.object(assess, "load_phoneme_model") as model:
            with self.assertRaises(assess.UnreliableRecording) as caught:
                assess.assess(audio, "hello world test example", transcript=transcript, acoustic=acoustic)
        self.assertEqual(caught.exception.code, "CONTENT_MISMATCH")
        model.assert_not_called()


if __name__ == "__main__":
    unittest.main()
