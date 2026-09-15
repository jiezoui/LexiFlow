"use client"

import { useEffect, useRef } from "react"

interface AudioWaveformProps {
  isRecording: boolean
  audioStream: MediaStream | null
  className?: string
  barColor?: string
}

export function AudioWaveform({
  isRecording,
  audioStream,
  className = "h-20 w-full",
  barColor = "#10b981", // Emerald primary
}: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)

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

    if (!isRecording || !audioStream) {
      drawIdle()
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {})
        audioContextRef.current = null
      }
      return
    }

    // 录音状态：建立 Web Audio API 音频分析图
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      const audioCtx = new AudioCtx()
      audioContextRef.current = audioCtx

      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 128
      analyser.smoothingTimeConstant = 0.8
      analyserRef.current = analyser

      const source = audioCtx.createMediaStreamSource(audioStream)
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
  }, [isRecording, audioStream, barColor])

  return (
    <div className={`relative flex items-center justify-center overflow-hidden rounded-2xl bg-muted/30 border border-border/60 ${className}`}>
      <canvas
        ref={canvasRef}
        width={480}
        height={80}
        className="w-full h-full object-contain"
      />
      {isRecording && (
        <div className="absolute top-2 right-3 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold animate-pulse">
          <span className="size-1.5 rounded-full bg-emerald-500 animate-ping" />
          REC 实时采集中
        </div>
      )}
    </div>
  )
}
