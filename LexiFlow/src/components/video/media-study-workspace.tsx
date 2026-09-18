"use client"

import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeftIcon, CaptionsIcon, LanguagesIcon, LoaderCircleIcon, RefreshCwIcon, VideoIcon } from "lucide-react"
import { mediaApi, type MediaCue, type MediaCueTranslation, type MediaItem } from "@/lib/api-client"
import { MediaPlayer, type MediaPlayerHandle } from "@/components/video/media-player"
import { TranscriptRail } from "@/components/video/transcript-rail"
import { YouTubePlayer } from "@/components/video/youtube-player"
import { VideoWordDrawer } from "@/components/video/video-word-drawer"

const statusLabels: Record<string, string> = {
  UPLOADING: "上传中",
  PROCESSING: "正在处理字幕与视频信息",
  WAITING_SUBTITLE: "等待字幕",
  READY: "处理完成",
  FAILED: "处理失败",
}

const translationStatusLabels: Record<string, string> = {
  DISABLED: "仅英文字幕",
  PENDING: "等待翻译",
  TRANSLATING: "正在生成中文",
  READY: "双语字幕已就绪",
  PARTIAL: "部分译文生成失败",
  FAILED: "中文翻译失败",
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

function mergeTranslations(cues: MediaCue[], translations: MediaCueTranslation[]) {
  if (!translations.length) return cues
  const byCueId = new Map(translations.map((translation) => [translation.cueId, translation]))
  return cues.map((cue) => {
    const update = byCueId.get(cue.id)
    return update ? {
      ...cue,
      translation: update.translation,
      translationLang: update.translationLang,
    } : cue
  })
}

export function MediaStudyWorkspace({ mediaId }: { mediaId: string }) {
  const [media, setMedia] = useState<MediaItem | null>(null)
  const [cues, setCues] = useState<MediaCue[]>([])
  const [activeIndex, setActiveIndex] = useState(-1)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [playerError, setPlayerError] = useState("")
  const [isRetryingTranslation, setIsRetryingTranslation] = useState(false)
  const [isReprocessing, setIsReprocessing] = useState(false)
  const [isUploadingSubtitle, setIsUploadingSubtitle] = useState(false)
  const [refreshNonce, setRefreshNonce] = useState(0)
  const [selectedWordTarget, setSelectedWordTarget] = useState<{
    word: string
    cue: MediaCue
  } | null>(null)

  const playerRef = useRef<MediaPlayerHandle>(null)
  const cuesRef = useRef<MediaCue[]>([])
  const activeIndexRef = useRef(-1)
  const currentTimeRef = useRef(0)
  const pollTimerRef = useRef<number | null>(null)
  const subtitleInputRef = useRef<HTMLInputElement>(null)

  const handleWordSelect = useCallback((word: string, cue: MediaCue) => {
    setSelectedWordTarget({ word, cue })
    // 自动暂停视频播放，便于静心查词与跟读学习
    playerRef.current?.pause?.()
  }, [])

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
        const detail = await mediaApi.detail(mediaId)
        const refreshFullTranscript = initial || ["UPLOADING", "PROCESSING"].includes(detail.status)
        const shouldFetchTranslations = ["PENDING", "TRANSLATING", "READY", "PARTIAL"].includes(detail.translationStatus)
        const [transcript, translations] = await Promise.all([
          refreshFullTranscript ? mediaApi.cues(mediaId) : Promise.resolve(cuesRef.current),
          shouldFetchTranslations ? mediaApi.cueTranslations(mediaId) : Promise.resolve([]),
        ])
        if (!active) return

        const nextCues = mergeTranslations(transcript, translations)
        cuesRef.current = nextCues
        setMedia(detail)
        setCues(nextCues)
        setLoadError("")
        const nextIndex = findActiveCueIndex(nextCues, currentTimeRef.current * 1000)
        activeIndexRef.current = nextIndex
        setActiveIndex(nextIndex)

        if (["UPLOADING", "PROCESSING"].includes(detail.status)
          || ["PENDING", "TRANSLATING"].includes(detail.translationStatus)) {
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
  }, [mediaId, refreshNonce])

  const retryTranslation = async () => {
    setIsRetryingTranslation(true)
    try {
      await mediaApi.translate(mediaId)
      setRefreshNonce((value) => value + 1)
    } catch (error) {
      setPlayerError(error instanceof Error ? error.message : "无法重新开始字幕翻译。")
    } finally {
      setIsRetryingTranslation(false)
    }
  }

  const handleReprocess = async () => {
    setIsReprocessing(true)
    setPlayerError("")
    try {
      await mediaApi.reprocess(mediaId)
      setRefreshNonce((value) => value + 1)
    } catch (error) {
      setPlayerError(error instanceof Error ? error.message : "无法重新获取字幕。")
    } finally {
      setIsReprocessing(false)
    }
  }

  const handleSubtitleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    setIsUploadingSubtitle(true)
    setPlayerError("")
    try {
      await mediaApi.uploadSubtitle(mediaId, file, "en")
      setRefreshNonce((value) => value + 1)
    } catch (error) {
      setPlayerError(error instanceof Error ? error.message : "字幕导入失败。")
    } finally {
      setIsUploadingSubtitle(false)
    }
  }

  const handlePlayerReady = useCallback(() => setPlayerError(""), [])

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
              {media.source === "YOUTUBE" ? "YouTube" : "本地视频"} · {media.durationSeconds === null ? (media.source === "YOUTUBE" ? "在线播放" : "时长检测中") : formatTime(media.durationSeconds)} · {statusLabels[media.status] || media.status}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-[11px] text-muted-foreground">
          {media.status === "PROCESSING" && (
            <div className="flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1 text-primary">
              <LoaderCircleIcon className="size-3.5 animate-spin" />
              <span>正在获取与转写字幕...</span>
            </div>
          )}

          {(media.status === "WAITING_SUBTITLE" || media.status === "FAILED") && (
            <button
              type="button"
              onClick={() => void handleReprocess()}
              disabled={isReprocessing}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 font-semibold text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              title="自动探测 YouTube 原生字幕或调用 Whisper 转写"
            >
              <RefreshCwIcon className={`size-3.5 ${isReprocessing ? "animate-spin" : ""}`} />
              <span>获取/转写字幕</span>
            </button>
          )}

          {media.source === "YOUTUBE" && (
            <>
              <input
                ref={subtitleInputRef}
                type="file"
                accept=".srt,.vtt,text/vtt,application/x-subrip"
                onChange={handleSubtitleUpload}
                className="sr-only"
              />
              <button
                type="button"
                onClick={() => subtitleInputRef.current?.click()}
                disabled={isUploadingSubtitle}
                className="flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 font-semibold text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              >
                {isUploadingSubtitle ? <LoaderCircleIcon className="size-3.5 animate-spin" /> : <CaptionsIcon className="size-3.5" />}
                导入本地字幕
              </button>
            </>
          )}

          {media.translationStatus === "TRANSLATING" || media.translationStatus === "PENDING" ? (
            <div className="flex items-center gap-1.5 text-primary">
              <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden="true" />
              <span>{translationStatusLabels[media.translationStatus]} · {media.translationProgress}%</span>
            </div>
          ) : media.translationStatus === "FAILED" || media.translationStatus === "PARTIAL" ? (
            <button
              type="button"
              onClick={() => void retryTranslation()}
              disabled={isRetryingTranslation}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 font-semibold text-rose-600 dark:text-rose-400 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              title={media.translationError || undefined}
            >
              <RefreshCwIcon className={`size-3.5 ${isRetryingTranslation ? "animate-spin" : ""}`} />
              <span>重试翻译</span>
            </button>
          ) : media.translationStatus === "READY" ? (
            <button
              type="button"
              onClick={() => void retryTranslation()}
              disabled={isRetryingTranslation}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 font-semibold text-foreground/85 transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              title="使用当前配置的大模型或本地模型重新生成中文翻译"
            >
              <RefreshCwIcon className={`size-3.5 ${isRetryingTranslation ? "animate-spin" : ""}`} />
              <span>双语就绪 · AI重译</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <LanguagesIcon className="size-3.5" aria-hidden="true" />
              <span>{translationStatusLabels[media.translationStatus] || media.translationStatus}</span>
            </div>
          )}
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-px bg-border lg:grid-cols-[minmax(0,1fr)_380px] lg:grid-rows-1">
        <main className="relative flex min-h-0 min-w-0 items-center justify-center overflow-hidden bg-background p-3 md:p-5">
          {media.playback.type === "YOUTUBE_IFRAME" && media.playback.externalId ? (
            <YouTubePlayer
              ref={playerRef}
              videoId={media.playback.externalId}
              title={media.title}
              activeCue={activeCue}
              onPlaybackTime={updateActiveCue}
              onReady={handlePlayerReady}
              onError={setPlayerError}
            />
          ) : media.playback.url ? (
            <MediaPlayer
              ref={playerRef}
              src={media.playback.url}
              title={media.title}
              activeCue={activeCue}
              onPlaybackTime={updateActiveCue}
              onReady={handlePlayerReady}
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
            <div role="alert" className="absolute bottom-4 left-1/2 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-3 rounded-lg bg-zinc-900/92 px-3 py-2 text-center text-xs text-zinc-200 shadow-lg">
              <span>{playerError}</span>
              {media.source === "YOUTUBE" && media.sourceUrl && (
                <a href={media.sourceUrl} target="_blank" rel="noreferrer" className="shrink-0 font-semibold text-white underline underline-offset-2">
                  前往 YouTube
                </a>
              )}
            </div>
          )}
        </main>

        <div className="relative flex min-h-0 min-w-0 flex-col overflow-hidden bg-background">
          <TranscriptRail
            cues={cues}
            activeIndex={activeIndex}
            onCueSelect={(cue) => playerRef.current?.seekTo(cue.startMs / 1000)}
            onWordSelect={handleWordSelect}
            selectedWord={selectedWordTarget?.word}
            emptyTitle={media.source === "YOUTUBE" ? "尚未导入字幕" : undefined}
            emptyDescription={media.source === "YOUTUBE" ? "导入 SRT 或 VTT 英文字幕后，会自动生成中文翻译并启用字幕跟随。" : undefined}
          />

          {/* 右侧单词精析抽屉 */}
          {selectedWordTarget && (
            <VideoWordDrawer
              word={selectedWordTarget.word}
              cue={selectedWordTarget.cue}
              onClose={() => setSelectedWordTarget(null)}
              onReplayCue={(cue) => {
                playerRef.current?.seekTo(cue.startMs / 1000, true)
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
