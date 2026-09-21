"use client"

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react"
import {
  CaptionsIcon,
  MaximizeIcon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
  RotateCwIcon,
  Volume2Icon,
  VolumeXIcon,
} from "lucide-react"
import type { MediaCue } from "@/lib/api-client"

type CaptionMode = "bilingual" | "english" | "hidden"

interface MediaPlayerProps {
  src: string
  title: string
  activeCue: MediaCue | null
  onPlaybackTime: (seconds: number) => void
  onError: (message: string) => void
  onReady: () => void
}

interface TimedWord {
  text: string
  startMs: number
  endMs: number
}

export interface MediaPlayerHandle {
  seekTo: (seconds: number, autoplay?: boolean) => void
  pause?: () => void
}

const HIDE_CONTROLS_DELAY = 1800

const captionModes: Array<{ mode: CaptionMode; label: string }> = [
  { mode: "bilingual", label: "双语" },
  { mode: "english", label: "英文" },
  { mode: "hidden", label: "隐藏" },
]

function estimatedWordTimings(cue: MediaCue): TimedWord[] {
  const words = cue.sourceText.match(/\S+/g) ?? []
  if (!words.length) return []

  const duration = Math.max(words.length, cue.endMs - cue.startMs)
  const weights = words.map((word) => Math.max(1, Math.pow(word.replace(/[^\p{L}\p{N}]/gu, "").length || 1, 0.68)))
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
  let cursor = cue.startMs

  return words.map((word, index) => {
    const startMs = cursor
    const endMs = index === words.length - 1
      ? cue.endMs
      : Math.min(cue.endMs, Math.round(startMs + duration * (weights[index] / totalWeight)))
    cursor = endMs
    return { text: word, startMs, endMs }
  })
}

function cueWordTimings(cue: MediaCue | null): TimedWord[] {
  if (!cue) return []

  if (cue.tokens) {
    try {
      const parsed: unknown = JSON.parse(cue.tokens)
      if (Array.isArray(parsed)) {
        const words = parsed.flatMap((item): TimedWord[] => {
          if (!item || typeof item !== "object") return []
          const token = item as Record<string, unknown>
          const text = typeof token.text === "string"
            ? token.text.trim()
            : typeof token.word === "string"
              ? token.word.trim()
              : ""
          const startMs = typeof token.startMs === "number"
            ? token.startMs
            : typeof token.start === "number"
              ? Math.round(token.start * 1000)
              : Number.NaN
          const endMs = typeof token.endMs === "number"
            ? token.endMs
            : typeof token.end === "number"
              ? Math.round(token.end * 1000)
              : Number.NaN
          return text && Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs
            ? [{ text, startMs, endMs }]
            : []
        })
        if (words.length) return words
      }
    } catch {
      // Legacy cues have no word timing data and use the sentence-level fallback below.
    }
  }

  return estimatedWordTimings(cue)
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00"
  const wholeSeconds = Math.floor(seconds)
  const minutes = Math.floor(wholeSeconds / 60)
  const remaining = wholeSeconds % 60
  return `${minutes}:${String(remaining).padStart(2, "0")}`
}

export const MediaPlayer = forwardRef<MediaPlayerHandle, MediaPlayerProps>(function MediaPlayer({
  src,
  title,
  activeCue,
  onPlaybackTime,
  onError,
  onReady,
}: MediaPlayerProps, forwardedRef) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [duration, setDuration] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [captionMode, setCaptionMode] = useState<CaptionMode>("bilingual")
  const timedWords = useMemo(() => cueWordTimings(activeCue), [activeCue])

  const playerRef = useRef<HTMLVideoElement>(null)
  const shellRef = useRef<HTMLDivElement>(null)
  const progressInputRef = useRef<HTMLInputElement>(null)
  const playedRef = useRef<HTMLDivElement>(null)
  const bufferedRef = useRef<HTMLDivElement>(null)
  const currentTimeLabelRef = useRef<HTMLSpanElement>(null)
  const hideTimerRef = useRef<number | null>(null)
  const frameRef = useRef<number | null>(null)
  const isSeekingRef = useRef(false)
  const timedWordsRef = useRef<TimedWord[]>([])
  const karaokeWordRefs = useRef<Array<HTMLSpanElement | null>>([])
  const karaokeFillRefs = useRef<Array<HTMLSpanElement | null>>([])
  const reducedMotionRef = useRef(false)

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }, [])

  const queueControlsHide = useCallback(() => {
    clearHideTimer()
    if (!playerRef.current?.paused) {
      hideTimerRef.current = window.setTimeout(() => {
        if (!shellRef.current?.matches(":focus-within")) setControlsVisible(false)
      }, HIDE_CONTROLS_DELAY)
    }
  }, [clearHideTimer])

  const revealControls = useCallback(() => {
    setControlsVisible(true)
    queueControlsHide()
  }, [queueControlsHide])

  const syncKaraoke = useCallback((currentSeconds: number) => {
    const currentMs = currentSeconds * 1000
    timedWordsRef.current.forEach((word, index) => {
      const element = karaokeWordRefs.current[index]
      const fill = karaokeFillRefs.current[index]
      if (!element || !fill) return

      if (currentMs < word.startMs) {
        element.dataset.state = "upcoming"
        fill.style.width = "0%"
      } else if (currentMs >= word.endMs) {
        element.dataset.state = "spoken"
        fill.style.width = "0%"
      } else {
        element.dataset.state = "active"
        const duration = Math.max(1, word.endMs - word.startMs)
        const progress = reducedMotionRef.current ? 1 : Math.min(1, Math.max(0, (currentMs - word.startMs) / duration))
        fill.style.width = `${progress * 100}%`
      }
    })
  }, [])

  const syncVisualState = useCallback(() => {
    const player = playerRef.current
    if (!player) return

    const safeDuration = Number.isFinite(player.duration) ? player.duration : duration
    const currentTime = player.currentTime
    const progress = safeDuration > 0 ? Math.min(100, (currentTime / safeDuration) * 100) : 0

    if (!isSeekingRef.current && progressInputRef.current) {
      progressInputRef.current.max = String(safeDuration || 0)
      progressInputRef.current.value = String(currentTime)
    }
    if (playedRef.current) playedRef.current.style.transform = `scaleX(${progress / 100})`
    if (currentTimeLabelRef.current) currentTimeLabelRef.current.textContent = formatTime(currentTime)

    if (bufferedRef.current && safeDuration > 0 && player.buffered.length) {
      const bufferedEnd = player.buffered.end(player.buffered.length - 1)
      bufferedRef.current.style.transform = `scaleX(${Math.min(1, bufferedEnd / safeDuration)})`
    }

    syncKaraoke(currentTime)
    onPlaybackTime(currentTime)
  }, [duration, onPlaybackTime, syncKaraoke])

  useImperativeHandle(forwardedRef, () => ({
    seekTo: (seconds, autoplay = true) => {
      const player = playerRef.current
      if (!player) return
      player.currentTime = Math.max(0, Math.min(Number.isFinite(player.duration) ? player.duration : seconds, seconds))
      syncVisualState()
      revealControls()
      if (autoplay) void player.play()
    },
    pause: () => {
      playerRef.current?.pause()
    },
  }), [revealControls, syncVisualState])

  const stopClock = useCallback(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
  }, [])

  const startClock = useCallback(() => {
    stopClock()
    const tick = () => {
      syncVisualState()
      if (!playerRef.current?.paused) frameRef.current = window.requestAnimationFrame(tick)
    }
    frameRef.current = window.requestAnimationFrame(tick)
  }, [stopClock, syncVisualState])

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const updatePreference = () => { reducedMotionRef.current = mediaQuery.matches }
    updatePreference()
    mediaQuery.addEventListener("change", updatePreference)
    return () => mediaQuery.removeEventListener("change", updatePreference)
  }, [])

  useEffect(() => {
    timedWordsRef.current = timedWords
    karaokeWordRefs.current.length = timedWords.length
    karaokeFillRefs.current.length = timedWords.length
    syncKaraoke(playerRef.current?.currentTime ?? 0)
  }, [syncKaraoke, timedWords])

  useEffect(() => {
    return () => {
      stopClock()
      clearHideTimer()
    }
  }, [clearHideTimer, stopClock])

  const togglePlayback = useCallback(() => {
    const player = playerRef.current
    if (!player) return
    if (player.paused) {
      void player.play()
    } else {
      player.pause()
    }
  }, [])

  const seekBy = useCallback((seconds: number) => {
    const player = playerRef.current
    if (!player) return
    const limit = Number.isFinite(player.duration) ? player.duration : Number.POSITIVE_INFINITY
    player.currentTime = Math.max(0, Math.min(limit, player.currentTime + seconds))
    syncVisualState()
    revealControls()
  }, [revealControls, syncVisualState])

  const handleProgressInput = (value: string) => {
    const player = playerRef.current
    if (!player) return
    const nextTime = Number(value)
    player.currentTime = nextTime
    if (playedRef.current && duration > 0) {
      playedRef.current.style.transform = `scaleX(${Math.min(1, nextTime / duration)})`
    }
    if (currentTimeLabelRef.current) currentTimeLabelRef.current.textContent = formatTime(nextTime)
    onPlaybackTime(nextTime)
  }

  const toggleMute = () => {
    const player = playerRef.current
    if (!player) return
    player.muted = !player.muted
    setIsMuted(player.muted)
  }

  const changePlaybackRate = (rate: number) => {
    const player = playerRef.current
    if (!player) return
    player.playbackRate = rate
    setPlaybackRate(rate)
  }

  const cycleCaptionMode = () => {
    const currentIndex = captionModes.findIndex((item) => item.mode === captionMode)
    setCaptionMode(captionModes[(currentIndex + 1) % captionModes.length].mode)
  }

  const toggleFullscreen = async () => {
    if (!shellRef.current) return
    if (document.fullscreenElement) {
      await document.exitFullscreen()
    } else {
      await shellRef.current.requestFullscreen()
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    if (["INPUT", "SELECT", "BUTTON"].includes(target.tagName)) return

    if (event.code === "Space") {
      event.preventDefault()
      togglePlayback()
    } else if (event.key === "ArrowLeft") {
      event.preventDefault()
      seekBy(-5)
    } else if (event.key === "ArrowRight") {
      event.preventDefault()
      seekBy(5)
    }
  }

  const showEnglish = captionMode !== "hidden" && activeCue
  const showTranslation = captionMode === "bilingual" && activeCue?.translation

  return (
    <div
      ref={shellRef}
      className="group/player relative aspect-video w-full max-w-5xl overflow-hidden rounded-2xl bg-zinc-950 shadow-xl shadow-zinc-950/20 outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onPointerMove={revealControls}
      onPointerDown={revealControls}
      onFocusCapture={() => {
        clearHideTimer()
        setControlsVisible(true)
      }}
      onBlurCapture={() => queueControlsHide()}
      aria-label={`${title} 视频播放器`}
    >
      <video
        ref={playerRef}
        src={src}
        preload="metadata"
        playsInline
        className="h-full w-full bg-zinc-950 object-contain"
        onClick={togglePlayback}
        onDoubleClick={() => void toggleFullscreen()}
        onLoadedMetadata={(event) => {
          const nextDuration = Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0
          setDuration(nextDuration)
          syncVisualState()
          onReady()
        }}
        onDurationChange={(event) => {
          const nextDuration = Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0
          setDuration(nextDuration)
        }}
        onProgress={syncVisualState}
        onSeeked={syncVisualState}
        onTimeUpdate={syncVisualState}
        onPlay={() => {
          setIsPlaying(true)
          startClock()
          queueControlsHide()
        }}
        onPause={() => {
          setIsPlaying(false)
          stopClock()
          setControlsVisible(true)
          clearHideTimer()
          syncVisualState()
        }}
        onEnded={() => {
          setIsPlaying(false)
          stopClock()
          setControlsVisible(true)
        }}
        onVolumeChange={(event) => setIsMuted(event.currentTarget.muted || event.currentTarget.volume === 0)}
        onError={() => onError("浏览器无法播放该编码；如果视频仍在处理，请等待转码完成后重试。")}
      />

      {!isPlaying && (
        <button
          type="button"
          onClick={togglePlayback}
          className="absolute left-1/2 top-1/2 flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-zinc-50/92 text-zinc-950 shadow-lg transition duration-200 ease-out hover:scale-105 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 active:scale-95"
          aria-label="播放视频"
        >
          <PlayIcon className="ml-0.5 size-6 fill-current" />
        </button>
      )}

      {(showEnglish || showTranslation) && (
        <div className="pointer-events-none absolute inset-x-5 bottom-[4.75rem] text-center text-zinc-50 [text-shadow:0_2px_7px_rgba(0,0,0,.98),0_0_2px_rgba(0,0,0,.95)] sm:inset-x-10">
          {showEnglish && (
            <p className="text-sm font-semibold leading-6 sm:text-base" aria-label={activeCue.sourceText}>
              {timedWords.map((word, index) => (
                <span key={`${word.startMs}-${index}`} aria-hidden="true">
                  <span
                    ref={(element) => { karaokeWordRefs.current[index] = element }}
                    className="karaoke-word relative inline-block"
                    data-state="upcoming"
                  >
                    <span className="karaoke-word-base">{word.text}</span>
                    <span
                      ref={(element) => { karaokeFillRefs.current[index] = element }}
                      className="karaoke-word-fill absolute inset-y-0 left-0 overflow-hidden whitespace-nowrap"
                    >
                      {word.text}
                    </span>
                  </span>
                  {index < timedWords.length - 1 ? " " : null}
                </span>
              ))}
            </p>
          )}
          {showTranslation && <p className="mt-0.5 text-xs font-medium leading-5 text-zinc-100 sm:text-sm">{activeCue.translation}</p>}
        </div>
      )}

      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-zinc-950/95 via-zinc-950/52 to-transparent px-3 pb-3 pt-16 transition-opacity duration-200 ease-out sm:px-4 ${controlsVisible || !isPlaying ? "opacity-100" : "opacity-0"}`}
        aria-hidden={!controlsVisible && isPlaying}
        inert={!controlsVisible && isPlaying ? true : undefined}
      >
        <div className={controlsVisible || !isPlaying ? "pointer-events-auto" : "pointer-events-none"}>
          <div className="relative flex h-5 items-center">
            <div className="pointer-events-none absolute inset-x-0 h-1 overflow-hidden rounded-full bg-zinc-50/25">
              <div ref={bufferedRef} className="absolute inset-y-0 left-0 w-full origin-left scale-x-0 bg-zinc-50/30" />
              <div ref={playedRef} className="absolute inset-y-0 left-0 w-full origin-left scale-x-0 bg-zinc-50" />
            </div>
            <input
              ref={progressInputRef}
              type="range"
              min="0"
              max={duration || 0}
              step="0.01"
              defaultValue="0"
              className="media-progress absolute inset-x-0 w-full"
              aria-label="视频播放进度"
              onPointerDown={() => {
                isSeekingRef.current = true
                clearHideTimer()
              }}
              onPointerUp={() => {
                isSeekingRef.current = false
                syncVisualState()
                queueControlsHide()
              }}
              onInput={(event) => handleProgressInput(event.currentTarget.value)}
            />
          </div>

          <div className="flex items-center gap-1 text-zinc-50">
            <button type="button" className="video-control" onClick={togglePlayback} aria-label={isPlaying ? "暂停" : "播放"}>
              {isPlaying ? <PauseIcon className="size-4 fill-current" /> : <PlayIcon className="ml-px size-4 fill-current" />}
            </button>
            <button type="button" className="video-control hidden sm:inline-flex" onClick={() => seekBy(-5)} aria-label="后退 5 秒">
              <RotateCcwIcon className="size-4" />
            </button>
            <button type="button" className="video-control hidden sm:inline-flex" onClick={() => seekBy(5)} aria-label="前进 5 秒">
              <RotateCwIcon className="size-4" />
            </button>
            <span className="ml-1 whitespace-nowrap text-[11px] font-medium tabular-nums text-zinc-200">
              <span ref={currentTimeLabelRef}>0:00</span>
              <span className="mx-1 text-zinc-500">/</span>
              <span>{formatTime(duration)}</span>
            </span>

            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                className="video-control xl:hidden"
                onClick={cycleCaptionMode}
                aria-label={`字幕：${captionModes.find((item) => item.mode === captionMode)?.label}，点击切换`}
                title={`字幕：${captionModes.find((item) => item.mode === captionMode)?.label}`}
              >
                <CaptionsIcon className="size-4" />
              </button>
              <div className="hidden items-center rounded-lg bg-zinc-900/55 p-0.5 text-[10px] font-semibold xl:flex" aria-label="字幕显示方式">
                {captionModes.map(({ mode, label }) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setCaptionMode(mode)}
                    className={`h-7 rounded-md px-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-50 ${captionMode === mode ? "bg-zinc-50 text-zinc-950" : "text-zinc-300 hover:text-zinc-50"}`}
                    aria-pressed={captionMode === mode}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="sr-only" htmlFor="video-playback-rate">播放速度</label>
              <select
                id="video-playback-rate"
                value={playbackRate}
                onChange={(event) => changePlaybackRate(Number(event.target.value))}
                className="h-8 rounded-lg bg-zinc-900/60 px-2 text-[11px] font-semibold text-zinc-50 outline-none transition-colors hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-50"
                aria-label="播放速度"
              >
                {[0.75, 1, 1.25, 1.5, 2].map((rate) => <option key={rate} value={rate}>{rate}x</option>)}
              </select>
              <button type="button" className="video-control" onClick={toggleMute} aria-label={isMuted ? "取消静音" : "静音"}>
                {isMuted ? <VolumeXIcon className="size-4" /> : <Volume2Icon className="size-4" />}
              </button>
              <button type="button" className="video-control" onClick={() => void toggleFullscreen()} aria-label="全屏播放">
                <MaximizeIcon className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})
