"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeftIcon, VideoIcon } from "lucide-react"
import { mediaApi, type MediaCue, type MediaItem } from "@/lib/api-client"
import { MediaPlayer, type MediaPlayerHandle } from "@/components/video/media-player"
import { TranscriptRail } from "@/components/video/transcript-rail"

const statusLabels: Record<string, string> = {
  UPLOADING: "上传中",
  PROCESSING: "正在处理字幕与视频信息",
  WAITING_SUBTITLE: "等待字幕",
  READY: "处理完成",
  FAILED: "处理失败",
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const remaining = Math.floor(seconds % 60)
  return `${minutes}:${String(remaining).padStart(2, "0")}`
}

function findActiveCueIndex(cues: MediaCue[], currentMs: number) {
  let low = 0
  let high = cues.length - 1

  while (low <= high) {
    const middle = (low + high) >> 1
    const cue = cues[middle]
    if (currentMs < cue.startMs) {
      high = middle - 1
    } else if (currentMs >= cue.endMs) {
      low = middle + 1
    } else {
      return middle
    }
  }

  return -1
}

export function MediaStudyWorkspace({ mediaId }: { mediaId: string }) {
  const [media, setMedia] = useState<MediaItem | null>(null)
  const [cues, setCues] = useState<MediaCue[]>([])
  const [activeIndex, setActiveIndex] = useState(-1)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [playerError, setPlayerError] = useState("")

  const playerRef = useRef<MediaPlayerHandle>(null)
  const cuesRef = useRef<MediaCue[]>([])
  const activeIndexRef = useRef(-1)
  const currentTimeRef = useRef(0)
  const pollTimerRef = useRef<number | null>(null)

  const updateActiveCue = useCallback((seconds: number) => {
    currentTimeRef.current = seconds
    const nextIndex = findActiveCueIndex(cuesRef.current, seconds * 1000)
    if (nextIndex !== activeIndexRef.current) {
      activeIndexRef.current = nextIndex
      setActiveIndex(nextIndex)
    }
  }, [])

  useEffect(() => {
    let active = true

    const load = async (initial: boolean) => {
      if (initial) setIsLoading(true)
      try {
        const [detail, transcript] = await Promise.all([
          mediaApi.detail(mediaId),
          mediaApi.cues(mediaId),
        ])
        if (!active) return

        cuesRef.current = transcript
        setMedia(detail)
        setCues(transcript)
        setLoadError("")
        const nextIndex = findActiveCueIndex(transcript, currentTimeRef.current * 1000)
        activeIndexRef.current = nextIndex
        setActiveIndex(nextIndex)

        if (["UPLOADING", "PROCESSING"].includes(detail.status)) {
          pollTimerRef.current = window.setTimeout(() => void load(false), 3000)
        }
      } catch (error) {
        if (!active) return
        setLoadError(error instanceof Error ? error.message : "无法读取视频详情。")
      } finally {
        if (active && initial) setIsLoading(false)
      }
    }

    void load(true)
    return () => {
      active = false
      if (pollTimerRef.current !== null) window.clearTimeout(pollTimerRef.current)
    }
  }, [mediaId])

  if (isLoading) {
    return (
      <div className="grid min-h-0 flex-1 gap-px bg-border lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="animate-pulse bg-muted" />
        <div className="animate-pulse bg-background p-5"><div className="h-full rounded-xl bg-muted" /></div>
      </div>
    )
  }

  if (loadError || !media) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
        <VideoIcon className="size-7 text-muted-foreground" />
        <h1 className="mt-3 text-base font-bold">无法打开这个视频</h1>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{loadError || "视频不存在或已经被删除。"}</p>
        <Link href="/videos" className="mt-5 rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">返回视频库</Link>
      </div>
    )
  }

  const activeCue = activeIndex >= 0 ? cues[activeIndex] : null

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/videos" className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border transition hover:bg-muted active:scale-[0.98]" aria-label="返回视频库">
            <ArrowLeftIcon className="size-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold text-foreground sm:text-base">{media.title}</h1>
            <p className="truncate text-[11px] text-muted-foreground">
              本地视频 · {media.durationSeconds === null ? "时长检测中" : formatTime(media.durationSeconds)} · {statusLabels[media.status] || media.status}
            </p>
          </div>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-px bg-border lg:grid-cols-[minmax(0,1fr)_380px] lg:grid-rows-1">
        <main className="relative flex min-h-0 min-w-0 items-center justify-center overflow-hidden bg-background p-3 md:p-5">
          {media.playback.url ? (
            <MediaPlayer
              ref={playerRef}
              src={media.playback.url}
              title={media.title}
              activeCue={activeCue}
              onPlaybackTime={updateActiveCue}
              onReady={() => setPlayerError("")}
              onError={setPlayerError}
            />
          ) : (
            <div className="flex aspect-video w-full max-w-5xl flex-col items-center justify-center rounded-2xl bg-zinc-950 text-center text-zinc-300">
              <VideoIcon className="size-8 text-zinc-500" />
              <p className="mt-3 text-sm font-semibold">播放文件尚未准备好</p>
              <p className="mt-1 text-xs text-zinc-500">页面会自动刷新处理状态。</p>
            </div>
          )}

          {playerError && (
            <p role="alert" className="absolute bottom-4 left-1/2 max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-lg bg-zinc-900/92 px-3 py-2 text-center text-xs text-zinc-200 shadow-lg">
              {playerError}
            </p>
          )}
        </main>

        <TranscriptRail
          cues={cues}
          activeIndex={activeIndex}
          onCueSelect={(cue) => playerRef.current?.seekTo(cue.startMs / 1000)}
        />
      </div>
    </div>
  )
}
