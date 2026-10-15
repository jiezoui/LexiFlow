import os
import unittest
from unittest.mock import patch

import numpy as np

from speech_bridge import tts


class TtsFallbackTest(unittest.TestCase):
    def test_auto_falls_back_when_online_synthesis_fails(self):
        with patch.dict(os.environ, {"LEXIFLOW_TTS_ENGINE": "auto"}), \
             patch.object(tts, "edge_available", return_value=True), \
             patch.object(tts, "_synthesize_edge", side_effect=RuntimeError("offline")) as online, \
             patch.object(tts, "_synthesize_espeak", return_value=(np.zeros(16000), 16000)) as offline:
            result = tts.synthesize("Practice this sentence.")
        self.assertEqual(result["engine"], "espeak")
        self.assertTrue(result["wav"].startswith(b"RIFF"))
        online.assert_called_once()
        offline.assert_called_once()


if __name__ == "__main__":
    unittest.main()
