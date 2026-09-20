"use client"

/**
 * 语脉 · 影子跟读录音 Hook
 *
 * 设计取舍
 * --------
 * 浏览器原生的 `MediaRecorder` 在 Chrome/Edge 上只产出 `audio/webm;codecs=opus`，
 * 服务端要额外解码；而 ASR 与音素模型真正需要的是 **16kHz 单声道 PCM**。
 * 因此这里改用 Web Audio API 直接从音频图取样本：
 *
 *   getUserMedia → MediaStreamSource → ScriptProcessor → Float32 PCM
 *                                                    ↓
 *                                        线性重采样到 16kHz → WAV(PCM16)
 *
 * 好处：
 * - 无需服务端转码，链路少一跳，首字节更快
 * - 采样率、位深、声道数完全受控，避免浏览器差异导致 ASR 抖动
 * - 同时输出实时时域波形（供声波动画）与实时电平（供录音强度指示）
 *
 * 说明：`ScriptProcessorNode` 已被标记为 deprecated，但兼容性最好（无需额外
 * AudioWorklet 模块文件与 `addModule` 异步加载）。对「按住录音」这种短时序
 * 场景完全够用，且在所有目标浏览器上行为一致。
 */

import { useCallback, useEffect, useRef, useState } from "react"

/** 目标采样率：Whisper / wav2vec2 均以此为输入 */
const TARGET_SAMPLE_RATE = 16000
/** ScriptProcessor 缓冲大小（必须是 2 的幂）；4096 @48kHz ≈ 85ms 一块 */
const BUFFER_SIZE = 4096

export interface RecorderState {
  isRecording: boolean
  /** 录音已持续毫秒数 */
  elapsedMs: number
  /** 实时电平 0~1，用于录音强度指示 */
  level: number
  /** 实时时域波形（-1~1），用于声波动画 */
  waveform: Float32Array | null
  error: string | null
}

export interface RecorderResult {
  blob: Blob
  durationMs: number
  sampleRate: number
  /** 录制过程中的峰值电平，用于提示麦克风增益是否合适 */
  peakLevel: number
}

export interface UseShadowingRecorder extends RecorderState {
  start: () => Promise<void>
  stop: () => Promise<RecorderResult | null>
  cancel: () => void
}

function floatTo16BitPCM(input: Float32Array): DataView {
  const buffer = new ArrayBuffer(input.length * 2)
  const view = new DataView(buffer)
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]))
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return view
}

/** 把 16kHz 单声道 PCM 封装成浏览器可播放的标准 WAV。 */
export function encodeWav(samples: Float32Array, sampleRate = TARGET_SAMPLE_RATE): Blob {
  const view = floatTo16BitPCM(samples)
  const header = new ArrayBuffer(44)
  const h = new DataView(header)
  const writeString = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) h.setUint8(offset + i, text.charCodeAt(i))
  }

  writeString(0, "RIFF")
  h.setUint32(4, 36 + view.byteLength, true)
  writeString(8, "WAVE")
  writeString(12, "fmt ")
  h.setUint32(16, 16, true) // PCM chunk size
  h.setUint16(20, 1, true) // PCM
  h.setUint16(22, 1, true) // mono
  h.setUint32(24, sampleRate, true)
  h.setUint32(28, sampleRate * 2, true) // byte rate
  h.setUint16(32, 2, true) // block align
  h.setUint16(34, 16, true) // bits per sample
  writeString(36, "data")
  h.setUint32(40, view.byteLength, true)

  // 注意：`view.buffer` 的静态类型是 ArrayBufferLike（可能是 SharedArrayBuffer），
  // 不能直接作为 BlobPart。这里复制成 Uint8Array 视图，既满足类型又拿到一段
  // 独立的连续内存，避免 Blob 与后续复用共享底层缓冲。
  const payload = new Uint8Array(view.byteLength)
  payload.set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength))

  return new Blob([header, payload], { type: "audio/wav" })
}

/**
 * 线性插值重采样。录音极短时浏览器可能给出与目标一致的采样率，直接返回。
 */
export function resampleLinear(
  input: Float32Array,
  fromRate: number,
  toRate = TARGET_SAMPLE_RATE
): Float32Array {
  if (fromRate === toRate || input.length === 0) return input
  const ratio = fromRate / toRate
  const outLength = Math.max(1, Math.floor(input.length / ratio))
  const output = new Float32Array(outLength)
  for (let i = 0; i < outLength; i++) {
    const pos = i * ratio
    const idx = Math.floor(pos)
    const frac = pos - idx
    const a = input[idx] ?? 0
    const b = input[idx + 1] ?? a
    output[i] = a + (b - a) * frac
  }
  return output
}

export function useShadowingRecorder(): UseShadowingRecorder {
  const [isRecording, setIsRecording] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [level, setLevel] = useState(0)
  const [waveform, setWaveform] = useState<Float32Array | null>(null)
  const [error, setError] = useState<string | null>(null)

  const streamRef = useRef<MediaStream | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const sinkRef = useRef<GainNode | null>(null)

  /** 录音期间累积的原始采样（源采样率） */
  const chunksRef = useRef<Float32Array[]>([])
  const totalSamplesRef = useRef(0)
  const sourceRateRef = useRef(TARGET_SAMPLE_RATE)
  const peakRef = useRef(0)
  const startedAtRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const teardown = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    try {
      processorRef.current?.disconnect()
    } catch {
      /* 已断开 */
    }
    try {
      sourceRef.current?.disconnect()
    } catch {
      /* 已断开 */
    }
    try {
      sinkRef.current?.disconnect()
    } catch {
      /* 已断开 */
    }
    processorRef.current = null
    sourceRef.current = null
    sinkRef.current = null

    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null

    const ctx = ctxRef.current
    ctxRef.current = null
    if (ctx && ctx.state !== "closed") {
      void ctx.close().catch(() => undefined)
    }
  }, [])

  useEffect(() => () => teardown(), [teardown])

  const start = useCallback(async () => {
    setError(null)

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("当前浏览器不支持录音 API（缺少 getUserMedia）")
      return
    }

    // 先做权限预检，给出比 getUserMedia 抛错更友好的提示
    try {
      const perms = (
        navigator as Navigator & {
          permissions?: { query: (d: { name: "microphone" }) => Promise<{ state: string }> }
        }
      ).permissions
      const status = perms ? await perms.query({ name: "microphone" }) : null
      if (status && status.state === "denied") {
        setError("浏览器已拒绝麦克风权限。请点击地址栏的麦克风图标允许后重试。")
        return
      }
    } catch {
      /* permissions API 不可用，继续走 getUserMedia */
    }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      })
    } catch (err: unknown) {
      const name = err instanceof Error ? err.name : ""
      setError(
        name === "NotAllowedError"
          ? "未获得麦克风授权。请允许网站使用麦克风后重试。"
          : name === "NotFoundError"
          ? "未检测到可用的麦克风设备。"
          : `无法访问麦克风：${err instanceof Error ? err.message : String(err)}`
      )
      return
    }

    streamRef.current = stream
    chunksRef.current = []
    totalSamplesRef.current = 0
    peakRef.current = 0

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new AudioCtx()
      ctxRef.current = ctx
      // 自动播放策略可能挂起上下文，录音前显式恢复
      if (ctx.state === "suspended") await ctx.resume()
      sourceRateRef.current = ctx.sampleRate

      const source = ctx.createMediaStreamSource(stream)
      sourceRef.current = source

      const processor = ctx.createScriptProcessor(BUFFER_SIZE, 1, 1)
      processorRef.current = processor

      // ScriptProcessor 必须有输出连接才会持续触发 onaudioprocess；
      // 用一个 0 增益节点接到 destination，避免把麦克风声音回放出来造成啸叫。
      const sink = ctx.createGain()
      sink.gain.value = 0
      sinkRef.current = sink

      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0)
        // 复制一份：inputBuffer 会被复用
        const copy = new Float32Array(input.length)
        copy.set(input)
        chunksRef.current.push(copy)
        totalSamplesRef.current += copy.length

        let peak = 0
        let sumSq = 0
        for (let i = 0; i < copy.length; i++) {
          const v = copy[i]
          const abs = v < 0 ? -v : v
          if (abs > peak) peak = abs
          sumSq += v * v
        }
        const rms = Math.sqrt(sumSq / copy.length)
        if (peak > peakRef.current) peakRef.current = peak
        setLevel(Math.min(1, rms * 3.2))
        setWaveform(copy)
      }

      source.connect(processor)
      processor.connect(sink)
      sink.connect(ctx.destination)

      startedAtRef.current = performance.now()
      setElapsedMs(0)
      setIsRecording(true)
      timerRef.current = setInterval(() => {
        setElapsedMs(Math.round(performance.now() - startedAtRef.current))
      }, 100)
    } catch (err: unknown) {
      teardown()
      setError(`初始化音频图失败：${err instanceof Error ? err.message : String(err)}`)
    }
  }, [teardown])

  const stop = useCallback(async (): Promise<RecorderResult | null> => {
    if (!isRecording) return null

    const durationMs = Math.round(performance.now() - startedAtRef.current)
    setIsRecording(false)
    setLevel(0)
    setWaveform(null)

    // 汇总所有采样块，再统一下采样（比逐块重采样精度更高）
    const total = totalSamplesRef.current
    const merged = new Float32Array(total)
    let offset = 0
    for (const chunk of chunksRef.current) {
      merged.set(chunk, offset)
      offset += chunk.length
    }
    chunksRef.current = []

    const sourceRate = sourceRateRef.current
    const peak = peakRef.current
    teardown()

    if (total === 0) {
      setError("未采集到音频数据，请检查麦克风后重试。")
      return null
    }

    const resampled = resampleLinear(merged, sourceRate, TARGET_SAMPLE_RATE)
    const blob = encodeWav(resampled, TARGET_SAMPLE_RATE)
    return {
      blob,
      durationMs,
      sampleRate: TARGET_SAMPLE_RATE,
      peakLevel: peak,
    }
  }, [isRecording, teardown])

  const cancel = useCallback(() => {
    chunksRef.current = []
    totalSamplesRef.current = 0
    setIsRecording(false)
    setLevel(0)
    setWaveform(null)
    teardown()
  }, [teardown])

  return { isRecording, elapsedMs, level, waveform, error, start, stop, cancel }
}
