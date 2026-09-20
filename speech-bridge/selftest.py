"""影子跟读语音桥接服务 —— 端到端自检脚本。

依次验证：配置 → espeak 音素化 → ASR 转写 → 音素 CTC 强制对齐 →
三维发音评分 → TTS 参考音合成。每一步都打印可核对的中间结果。

用法::
    python selftest.py                 # 用合成音（espeak-ng）跑通链路
    python selftest.py path/to.wav     # 用指定音频
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "speech-bridge"))

from speech_bridge import assess as assess_mod  # noqa: E402
from speech_bridge import audio as audio_mod  # noqa: E402
from speech_bridge import config  # noqa: E402
from speech_bridge import phonemize as phon_mod  # noqa: E402
from speech_bridge import tts as tts_mod  # noqa: E402

REFERENCE = (
    "The central bank announced a decisive shift in its monetary policy "
    "to curb rising inflationary pressures across the continent."
)


def section(title: str) -> None:
    print()
    print("=" * 78)
    print(f"  {title}")
    print("=" * 78)


def step_1_config() -> None:
    section("1. 运行时配置")
    describe = config.describe()
    print(f"HF 端点      : {describe['hf_endpoint']}")
    print(f"模型缓存     : {describe['model_cache_dir']}")
    print(f"ASR          : {describe['asr']}")
    print(f"音素模型     : {describe['phoneme_model']}")
    print(f"评分权重     : {describe['weights']}")
    print(f"espeak 库    : {describe['espeak']['library_present']}")


def step_2_phonemes() -> None:
    section("2. espeak-ng 音素化（展示 IPA vs 模型音素）")
    status = phon_mod.espeak_status()
    print(f"可用: {status['available']}  语言: {status['languages']}")
    if status["error"]:
        print(f"错误: {status['error']}")

    words = phon_mod.word_phonemes(REFERENCE)
    total_display = total_model = 0
    for wp in words:
        total_display += len(wp.phonemes)
        total_model += len(wp.model_phonemes)
        print(f"  {wp.word:<14} {wp.ipa:<20} 展示{len(wp.phonemes):>2} 模型{len(wp.model_phonemes):>2}")
    print()
    print(f"基准句词数 {len(words)}，展示音素 {total_display}，模型音素 {total_model}")


def make_reference_audio() -> tuple[object, dict]:
    section("3. 合成参考音（同时充当被测音频）")
    t0 = time.time()
    result = tts_mod.synthesize(REFERENCE, speed=0.95)
    wav = result["wav"]
    print(f"引擎        : {result['engine']} ({result['voice']})")
    print(f"采样率      : {result['sample_rate']} Hz")
    print(f"时长        : {result['duration_seconds']} s")
    print(f"WAV 字节数  : {len(wav)}")
    print(f"合成耗时    : {time.time() - t0:.2f} s")

    decoded, sr = audio_mod.decode_audio(wav)
    mono = audio_mod.to_mono_16k(decoded, sr)
    return mono, result


def step_4_asr(mono) -> object:
    section("4. ASR 转写（faster-whisper + 词级时间戳）")
    from speech_bridge import asr as asr_mod

    transcript = asr_mod.transcribe(mono, language="en", initial_prompt=REFERENCE)
    print(f"引擎        : {transcript.engine} / {transcript.model}")
    print(f"语言        : {transcript.language} (p={transcript.language_probability:.2f})")
    print(f"耗时        : {transcript.elapsed_ms} ms")
    print(f"转写文本    : {transcript.text}")
    print()
    for seg in transcript.segments:
        print(f"  段 [{seg.start:.2f} → {seg.end:.2f}] {seg.text}")
        for w in seg.words:
            print(f"      {w.word:<16} {w.start:6.2f}→{w.end:6.2f}  p={w.probability:.3f}")
    return transcript


def step_5_alignment(mono) -> None:
    section("5. 音素级 CTC 强制对齐（GOP）")
    processor, _model = assess_mod.load_phoneme_model()
    words = phon_mod.word_phonemes(REFERENCE)
    flat: list[tuple[str, int]] = []
    for wp in words:
        for ph in wp.model_phonemes or wp.phonemes:
            idx, _key = assess_mod.resolve_phoneme(processor, ph)
            flat.append((ph, idx if idx is not None else -1))

    t0 = time.time()
    try:
        aligned = assess_mod.ctc_forced_align(mono, flat)
    except Exception as exc:  # noqa: BLE001
        print(f"对齐失败: {type(exc).__name__}: {exc}")
        return
    t_elapsed = time.time() - t0
    mapped = sum(1 for _p, i in flat if i >= 0)
    print(f"参考音素 {len(flat)} 个（其中 {mapped} 个可在模型词表中找到）")
    print(f"成功对齐 {len(aligned)} 个，耗时 {t_elapsed:.2f}s")
    print()
    print("  位置  音素   帧区间        后验     排名   音素得分")
    for pos in sorted(aligned):
        ph, f0, f1, post, rank = aligned[pos]
        score = assess_mod.phoneme_score(post, rank)
        print(f"  {pos:>4}  {ph:<6} [{f0:>4},{f1:>4}]   {post:.4f}   {rank:>3}   {score:6.1f}")

    scores = [assess_mod.phoneme_score(v[3], v[4]) for v in aligned.values()]
    if scores:
        print()
        print(f"音素得分: 均值 {sum(scores) / len(scores):.1f}  "
              f"最低 {min(scores):.1f}  最高 {max(scores):.1f}  "
              f"<60 的比例 {sum(1 for s in scores if s < 60) / len(scores):.1%}")


def step_6_assess(mono) -> None:
    section("6. 三维发音评分（完整评测）")
    t0 = time.time()
    result = assess_mod.assess(mono, REFERENCE, language="en")
    elapsed = time.time() - t0

    s = result.scores
    print(f"综合得分    : {s.overall}  →  {result.grade} / {result.grade_label}")
    print(f"  准确度    : {s.accuracy}")
    print(f"  完整度    : {s.completeness}")
    print(f"  流利度    : {s.fluency}")
    print(f"  韵律      : {s.prosody}")
    print()
    print(f"转写文本    : {result.transcribed_text}")
    print(f"词级统计    : {result.counts}")
    print(f"时间统计    : 时长 {result.timing['duration_seconds']}s / "
          f"净语音 {result.timing['speech_duration_seconds']}s / "
          f"{result.timing['words_per_minute']} WPM / "
          f"{result.timing['pause_count']} 处停顿")
    print(f"声学指标    : RMS {result.acoustic['rms_dbfs']}dBFS / "
          f"SNR {result.acoustic['snr_db']}dB / 基频 {result.acoustic['pitch_mean_hz']}Hz")
    print(f"引擎        : {result.engine}")
    print(f"总耗时      : {result.processing_ms} ms (脚本实测 {elapsed:.2f}s)")
    print()
    print("逐词得分：")
    for ws in result.words:
        flag = {"CORRECT": "√", "SUBSTITUTION": "×", "OMISSION": "漏", "INSERTION": "+"}[ws.status]
        print(f"  {flag} {ws.word:<14} {ws.ipa:<20} {ws.score:6.1f}  "
              f"(相似度 {ws.similarity:.2f}, ASR p={ws.asr_probability})")
        bad = [p for p in ws.phonemes if p.status != "GOOD"]
        if bad:
            detail = "  ".join(f"/{p.phoneme}/={p.score:.0f}" for p in bad)
            print(f"        ⚠ {detail}")

    print()
    print("改进建议：")
    for tip in result.suggestions:
        print(f"  [{tip['severity']:<6}] {tip['title']}")
        print(f"           {tip['detail']}")
        if tip.get("practiceWords"):
            print(f"           练习词: {', '.join(tip['practiceWords'])}")


def main() -> int:
    print("语脉 · 影子跟读语音桥接服务 —— 端到端自检")
    print(f"版本 {config.VERSION}")

    step_1_config()
    step_2_phonemes()

    if len(sys.argv) > 1:
        audio_path = Path(sys.argv[1])
        section(f"3. 读取外部音频 {audio_path.name}")
        decoded, sr = audio_mod.decode_audio(audio_path.read_bytes())
        mono = audio_mod.to_mono_16k(decoded, sr)
        print(f"采样率 {sr} → 16k，时长 {mono.size / config.SAMPLE_RATE:.2f}s")
    else:
        mono, _ = make_reference_audio()

    step_4_asr(mono)
    step_5_alignment(mono)
    step_6_assess(mono)

    section("自检完成")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
