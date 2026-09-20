"use client"

import { useEffect, useRef } from "react"

interface AudioWaveformProps {
  isRecording: boolean
  /** 直接订阅 MediaStream 时使用；若已在上层采集 PCM，可传 null 并改用 waveform/level */
  audioStream: MediaStream | null
  className?: string
  barColor?: string
  /** 实时时域波形（-1~1）。传入后按真实采样绘制，优先于 audioStream。 */
  waveform?: Float32Array | null
  /** 实时响度电平 0~1，用于整体亮度调制 */
  level?: number
  /** 录音时长毫秒（显示在 REC 胶囊里） */
  elapsedMs?: number
}

export function AudioWaveform({
  isRecording,
  audioStream,
  className = "h-20 w-full",
  barColor = "#10b981", // Emerald primary
  waveform = null,
  level = 0,
  elapsedMs = 0,
}: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  // PCM 模式下由上层推送波形：用 ref 暂存最新一帧，避免每个音频块都触发 React 重渲染
  const latestRef = useRef<Float32Array | null>(null)
  const levelRef = useRef(0)

  // PCM 模式下由上层推送波形。这两处「在 effect 里写 ref」是刻意为之：
  // 音频块以 ~85ms 的频率到达，若直接进 state 会触发高频重渲染；
  // 这里只把最新值镜像到 ref，由 requestAnimationFrame 循环按需读取。
  useEffect(() => {
    latestRef.current = waveform
    levelRef.current = level
  }, [waveform, level])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // 绘制空闲默认基准线
    const drawIdle = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const centerY = canvas.height / 2
      const barCount = 48
      const barWidth = canvas.width / barCount
      const spacing = 2

      ctx.fillStyle = "rgba(156, 163, 175, 0.25)"
      for (let i = 0; i < barCount; i++) {
        const x = i * barWidth + spacing / 2
        const h = Math.sin((i / barCount) * Math.PI) * 6 + 3
        ctx.fillRect(x, centerY - h / 2, barWidth - spacing, h)
      }
    }

    if (!isRecording) {
      drawIdle()
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {})
        audioContextRef.current = null
      }
      return
    }

    /** 用上层推来的 PCM 采样绘制实时波形。 */
    const renderFromPcm = () => {
      const samples = latestRef.current
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const centerY = canvas.height / 2
      const barCount = 56
      const barWidth = canvas.width / barCount
      const spacing = 2
      const lvl = levelRef.current

      if (!samples || samples.length === 0) {
        drawIdle()
      } else {
        const step = Math.max(1, Math.floor(samples.length / barCount))
        for (let i = 0; i < barCount; i++) {
          let peak = 0
          const start = i * step
          for (let j = start; j < Math.min(start + step, samples.length); j++) {
            const v = samples[j] < 0 ? -samples[j] : samples[j]
            if (v > peak) peak = v
          }
          const h = Math.max(3, peak * canvas.height * 0.92)
          const x = i * barWidth + spacing / 2
          const alpha = Math.max(0.3, Math.min(1, 0.35 + peak * 1.6))
          ctx.fillStyle = `rgba(16, 185, 129, ${alpha})`
          ctx.beginPath()
          if (typeof ctx.roundRect === "function") {
            ctx.roundRect(x, centerY - h / 2, barWidth - spacing, h, 3)
            ctx.fill()
          } else {
            ctx.fillRect(x, centerY - h / 2, barWidth - spacing, h)
          }
        }
        // 电平指示底线
        ctx.fillStyle = "rgba(16, 185, 129, 0.25)"
        ctx.fillRect(0, canvas.height - 2, canvas.width * Math.min(1, lvl), 2)
      }
      animFrameRef.current = requestAnimationFrame(renderFromPcm)
    }

    // 若上层直接给了 PCM，走自绘路径，无需再建 AudioContext
    if (waveform !== null || level > 0) {
      renderFromPcm()
      return () => {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      }
    }

    // 否则订阅 MediaStream（保留对旧调用方的兼容）
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const audioCtx = new AudioCtx()
      audioContextRef.current = audioCtx

      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 128
      analyser.smoothingTimeConstant = 0.8
      analyserRef.current = analyser

      const source = audioCtx.createMediaStreamSource(audioStream as MediaStream)
      source.connect(analyser)
      sourceRef.current = source

      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)

      const renderLoop = () => {
        analyser.getByteFrequencyData(dataArray)
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        const centerY = canvas.height / 2
        const barCount = 42
        const barWidth = canvas.width / barCount
        const spacing = 2.5

        for (let i = 0; i < barCount; i++) {
          const dataIdx = Math.floor((i / barCount) * bufferLength)
          const value = dataArray[dataIdx] || 0
          const percent = value / 255
          // 动态柱状高度 (至少 4px)
          const h = Math.max(4, percent * (canvas.height * 0.85))
          const x = i * barWidth + spacing / 2

          // 渐变色彩计算：能量越高色彩越亮
          const alpha = Math.max(0.35, percent * 1.0)
          ctx.fillStyle = isRecording ? `rgba(16, 185, 129, ${alpha})` : barColor
          ctx.beginPath()
          // 绘制圆角胶囊柱
          if (typeof ctx.roundRect === "function") {
            ctx.roundRect(x, centerY - h / 2, barWidth - spacing, h, 3)
            ctx.fill()
          } else {
            ctx.fillRect(x, centerY - h / 2, barWidth - spacing, h)
          }
        }

        animFrameRef.current = requestAnimationFrame(renderLoop)
      }

      renderLoop()
    } catch (e) {
      console.warn("AudioContext init error:", e)
      drawIdle()
    }

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {})
      }
    }
  }, [isRecording, audioStream, barColor, waveform, level])

  const seconds = Math.floor(elapsedMs / 1000)

  return (
    <div className={`relative flex items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-muted/30 ${className}`}>
      <canvas
        ref={canvasRef}
        width={480}
        height={80}
        className="h-full w-full object-contain"
      />
      {isRecording && (
        <div className="absolute top-2 right-3 flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-600 animate-pulse dark:text-emerald-400">
          <span className="size-1.5 animate-ping rounded-full bg-emerald-500" />
          REC {String(Math.floor(seconds / 60)).padStart(2, "0")}:
          {String(seconds % 60).padStart(2, "0")}
        </div>
      )}
    </div>
  )
}
