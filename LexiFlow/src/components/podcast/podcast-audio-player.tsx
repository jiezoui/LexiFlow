"use client"

import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react"
import { HeadphonesIcon, PauseIcon, PlayIcon, RotateCcwIcon, RotateCwIcon, Volume2Icon, VolumeXIcon } from "lucide-react"
import type { MediaCue } from "@/lib/api-client"
import type { MediaPlayerHandle } from "@/components/video/media-player"

interface PodcastAudioPlayerProps {
  src: string
  title: string
  creator: string | null
  coverUrl: string | null
  activeCue: MediaCue | null
  onPlaybackTime: (seconds: number) => void
  onError: (message: string) => void
  onReady: () => void
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00"
  const value = Math.floor(seconds)
  const hours = Math.floor(value / 3600)
  const minutes = Math.floor((value % 3600) / 60)
  const remaining = value % 60
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`
    : `${minutes}:${String(remaining).padStart(2, "0")}`
}

export const PodcastAudioPlayer = forwardRef<MediaPlayerHandle, PodcastAudioPlayerProps>(function PodcastAudioPlayer({
  src,
  title,
  creator,
  coverUrl,
  activeCue,
  onPlaybackTime,
  onError,
  onReady,
}, forwardedRef) {
  const playerRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [bufferedPercent, setBufferedPercent] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)

  const syncTime = useCallback(() => {
    const player = playerRef.current
    if (!player) return
    setCurrentTime(player.currentTime)
    onPlaybackTime(player.currentTime)

    if (player.duration > 0 && player.buffered.length > 0) {
      try {
        const bufferedEnd = player.buffered.end(player.buffered.length - 1)
        setBufferedPercent(Math.min(100, Math.max(0, (bufferedEnd / player.duration) * 100)))
      } catch {
        // ignore if buffered range is temporarily unavailable
      }
    }
  }, [onPlaybackTime])

  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0

  useImperativeHandle(forwardedRef, () => ({
    seekTo: (seconds, autoplay = true) => {
      const player = playerRef.current
      if (!player) return
      const upper = Number.isFinite(player.duration) ? player.duration : seconds
      player.currentTime = Math.max(0, Math.min(upper, seconds))
      syncTime()
      if (autoplay) void player.play()
    },
    pause: () => playerRef.current?.pause(),
  }), [syncTime])

  const togglePlayback = () => {
    const player = playerRef.current
    if (!player) return
    if (player.paused) void player.play()
    else player.pause()
  }

  const seekBy = (seconds: number) => {
    const player = playerRef.current
    if (!player) return
    const upper = Number.isFinite(player.duration) ? player.duration : Number.POSITIVE_INFINITY
    player.currentTime = Math.max(0, Math.min(upper, player.currentTime + seconds))
    syncTime()
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).tagName === "INPUT" || (event.target as HTMLElement).tagName === "SELECT") return
    if (event.code === "Space") {
      event.preventDefault()
      togglePlayback()
    } else if (event.key === "ArrowLeft") {
      event.preventDefault()
      seekBy(-10)
    } else if (event.key === "ArrowRight") {
      event.preventDefault()
      seekBy(10)
    }
  }

  return (
    <div
      className="w-full min-w-0 max-w-4xl rounded-3xl border border-border bg-card p-4 shadow-sm outline-none md:p-6"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label={`${title} 音频播放器`}
    >
      <audio
        ref={playerRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(event) => {
          setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)
          onReady()
        }}
        onDurationChange={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
        onTimeUpdate={syncTime}
        onProgress={syncTime}
        onSeeked={syncTime}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onVolumeChange={(event) => setIsMuted(event.currentTarget.muted || event.currentTarget.volume === 0)}
        onError={() => onError("这个音频源暂时无法在浏览器内播放，可以稍后重试或打开原始音频。")}
      />

      <div className="grid gap-5 sm:grid-cols-[112px_minmax(0,1fr)] sm:items-center">
        <div className="mx-auto flex aspect-square w-28 items-center justify-center overflow-hidden rounded-2xl bg-muted shadow-sm sm:mx-0">
          {coverUrl
            ? <img src={coverUrl} alt="" className="size-full object-cover" />
            : <HeadphonesIcon className="size-10 text-muted-foreground/55" />}
        </div>

        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-muted-foreground">{creator || "播客精听"}</p>
          <h2 className="mt-1 line-clamp-2 text-base font-bold leading-snug text-foreground sm:text-lg">{title}</h2>
          <div className="mt-4 min-h-16 rounded-xl bg-muted/65 px-4 py-3">
            {activeCue ? (
              <>
                <p className="line-clamp-2 text-sm font-semibold leading-6 text-foreground">{activeCue.sourceText}</p>
                {activeCue.translation && <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{activeCue.translation}</p>}
              </>
            ) : (
              <p className="flex min-h-10 items-center text-xs text-muted-foreground">播放音频，精听文本准备好后会在这里跟随当前句。</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div className="group/progress relative flex h-5 items-center cursor-pointer">
          {/* 进度条轨道：底层灰色未播放背景 + 已缓冲进度 + 已播放内容加颜色高亮 */}
          <div className="pointer-events-none absolute inset-x-0 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800 transition-all duration-150 group-hover/progress:h-2">
            {/* 已缓冲进度条 */}
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-zinc-300 dark:bg-zinc-700/60 transition-[width] duration-150"
              style={{ width: `${bufferedPercent}%` }}
            />
            {/* 已播放进度条 (给播放过的内容加颜色高亮显示) */}
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-zinc-900 dark:bg-zinc-100 transition-[width] duration-75"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <input
            type="range"
            min="0"
            max={duration || 0}
            step="0.1"
            value={Math.min(currentTime, duration || currentTime)}
            onChange={(event) => {
              const next = Number(event.currentTarget.value)
              if (playerRef.current) playerRef.current.currentTime = next
              setCurrentTime(next)
              onPlaybackTime(next)
            }}
            className="media-progress absolute inset-x-0 w-full cursor-pointer"
            aria-label="播客播放进度"
          />
        </div>
        <div className="mt-2 flex items-center justify-between font-mono text-[10px] tabular-nums text-muted-foreground">
          <span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-center gap-2 sm:gap-3">
        <button type="button" onClick={() => seekBy(-10)} className="flex size-11 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="后退 10 秒">
          <RotateCcwIcon className="size-4" />
        </button>
        <button type="button" onClick={togglePlayback} className="flex size-13 items-center justify-center rounded-full bg-foreground text-background shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-95" aria-label={isPlaying ? "暂停" : "播放"}>
          {isPlaying ? <PauseIcon className="size-5 fill-current" /> : <PlayIcon className="ml-0.5 size-5 fill-current" />}
        </button>
        <button type="button" onClick={() => seekBy(10)} className="flex size-11 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="前进 10 秒">
          <RotateCwIcon className="size-4" />
        </button>
        <label className="sr-only" htmlFor="podcast-playback-rate">播放速度</label>
        <select
          id="podcast-playback-rate"
          value={playbackRate}
          onChange={(event) => {
            const rate = Number(event.target.value)
            if (playerRef.current) playerRef.current.playbackRate = rate
            setPlaybackRate(rate)
          }}
          className="h-10 rounded-xl border border-border bg-background px-2 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {[0.75, 1, 1.25, 1.5, 2].map((rate) => <option key={rate} value={rate}>{rate}x</option>)}
        </select>
        <button
          type="button"
          onClick={() => {
            if (!playerRef.current) return
            playerRef.current.muted = !playerRef.current.muted
            setIsMuted(playerRef.current.muted)
          }}
          className="flex size-10 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={isMuted ? "取消静音" : "静音"}
        >
          {isMuted ? <VolumeXIcon className="size-4" /> : <Volume2Icon className="size-4" />}
        </button>
      </div>
    </div>
  )
})
