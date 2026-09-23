"use client"

import { ChangeEvent, type CSSProperties, useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { AlertCircleIcon, ArrowLeftIcon, CaptionsIcon, ExternalLinkIcon, HeadphonesIcon, LoaderCircleIcon, RefreshCwIcon, VideoIcon } from "lucide-react"
import { mediaApi, shadowingApi, type MediaCue, type MediaCueTranslation, type MediaItem } from "@/lib/api-client"
import { MediaPlayer, type MediaPlayerHandle } from "@/components/video/media-player"
import { TranscriptRail } from "@/components/video/transcript-rail"
import { YouTubePlayer } from "@/components/video/youtube-player"
import { VideoWordDrawer } from "@/components/video/video-word-drawer"
import { PodcastAudioPlayer } from "@/components/podcast/podcast-audio-player"

const statusLabels: Record<string, string> = {
  UPLOADING: "上传中",
  PROCESSING: "转写中",
  WAITING_SUBTITLE: "准备转写",
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

const unavailableAudioPrefix = "SOURCE_AUDIO_UNAVAILABLE:"

const processingStageLabels: Record<string, string> = {
  VALIDATING: "检查媒体",
  FETCHING_METADATA: "读取媒体信息",
  UPLOADING: "等待上传完成",
  PROBING: "分析音频",
  TRANSCODING: "准备音频",
  ACQUIRING_SUBTITLE: "查找可用字幕",
  DOWNLOADING_AUDIO: "获取音频",
  DOWNLOADING_MODEL: "准备识别模型",
  TRANSCRIBING: "逐句识别语音",
  NORMALIZING: "整理字幕",
  TRANSLATING: "生成中文译文",
  TOKENIZING: "对齐单词时间",
  FINALIZING: "即将完成",
  READY: "处理完成",
}

function automaticStage(source: string) {
  if (source === "PODCAST") return "DOWNLOADING_AUDIO"
  if (source === "YOUTUBE") return "ACQUIRING_SUBTITLE"
  return "PROBING"
}

function TranscriptionProgress({ media, isPodcast }: { media: MediaItem; isPodcast: boolean }) {
  const progress = Math.min(100, Math.max(0, media.processingProgress || 0))
  const stage = media.processingDetail || processingStageLabels[media.processingStage || ""] || "准备转写"

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-12 text-center" aria-live="polite">
      <div className="w-full max-w-md">
        <div className="mx-auto flex h-16 items-center justify-center gap-3 font-mono text-sm font-semibold tracking-[0.18em]" aria-hidden="true">
          <span className="text-muted-foreground/55">AUDIO</span>
          <span className="text-muted-foreground/35">→</span>
          <span className="flex items-center text-foreground">
            {"TEXT".split("").map((letter, index) => (
              <span
                key={letter + index}
                className="transcription-letter"
                style={{ "--letter-index": index } as CSSProperties}
              >
                {letter}
              </span>
            ))}
            <span className="transcription-caret" />
          </span>
        </div>

        <h2 className="mt-4 text-lg font-bold tracking-tight text-foreground">
          正在生成{isPodcast ? "精听文本" : "字幕"}
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-xs leading-6 text-muted-foreground">
          转写完成后即可播放，字幕会自动出现。
        </p>

        <div className="mx-auto mt-7 max-w-sm text-left">
          <div className="flex items-center justify-between gap-4 text-xs">
            <span className="truncate font-medium text-foreground">{stage}</span>
            <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
              {progress > 0 ? `${progress}%` : "排队中"}
            </span>
          </div>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
            {progress > 0 ? (
              <div className="h-full rounded-full bg-foreground transition-[width] duration-300 ease-out" style={{ width: `${progress}%` }} />
            ) : (
              <div className="transcription-progress-indeterminate h-full w-1/4 rounded-full bg-foreground" />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function TranscriptionFailure({
  media,
  isPodcast,
  isRetrying,
  onRetry,
}: {
  media: MediaItem
  isPodcast: boolean
  isRetrying: boolean
  onRetry: () => void
}) {
  const sourceUnavailable = media.errorMessage?.startsWith(unavailableAudioPrefix)
  const message = sourceUnavailable
    ? media.errorMessage?.slice(unavailableAudioPrefix.length).trim()
    : media.errorMessage || "转写没有完成，请稍后重试。"

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-12 text-center">
      <div className="max-w-sm">
        <AlertCircleIcon className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
        <h2 className="mt-4 text-base font-bold text-foreground">
          {sourceUnavailable ? "原始音频不可用" : `${isPodcast ? "精听文本" : "字幕"}生成失败`}
        </h2>
        <p className="mt-2 text-xs leading-6 text-muted-foreground">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          disabled={isRetrying}
          className="mt-5 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCwIcon className={`size-3.5 ${isRetrying ? "animate-spin" : ""}`} />
          重新检查
        </button>
      </div>
    </div>
  )
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

export function MediaStudyWorkspace({ mediaId, mode = "video" }: { mediaId: string; mode?: "video" | "podcast" }) {
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
  const [favoriteState, setFavoriteState] = useState<{
    mediaId: string
    items: Record<string, number>
    pendingCueId: number | null
    error: string
  } | null>(null)
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
  const autoTranscriptionMediaRef = useRef<string | null>(null)

  useEffect(() => {
    let active = true
    void shadowingApi.mediaFavorites(mediaId)
      .then((items) => {
        if (active) setFavoriteState({ mediaId, items, pendingCueId: null, error: "" })
      })
      .catch((error) => {
        if (active) setFavoriteState({
          mediaId,
          items: {},
          pendingCueId: null,
          error: error instanceof Error ? `收藏状态加载失败：${error.message}` : "收藏状态加载失败",
        })
      })
    return () => { active = false }
  }, [mediaId])

  const toggleFavorite = async (cue: MediaCue) => {
    if (favoriteState?.mediaId !== mediaId || favoriteState.pendingCueId !== null) return
    const savedId = favoriteState.items[cue.id]
    setFavoriteState((current) => current?.mediaId === mediaId
      ? { ...current, pendingCueId: cue.id, error: "" } : current)
    try {
      let sentenceId: number | null
      if (savedId) {
        await shadowingApi.deleteSentence(savedId)
        sentenceId = null
      } else {
        sentenceId = (await shadowingApi.saveMediaCue(mediaId, cue.id)).id
      }
      setFavoriteState((current) => {
        if (current?.mediaId !== mediaId) return current
        const items = { ...current.items }
        if (sentenceId === null) delete items[cue.id]
        else items[cue.id] = sentenceId
        return { ...current, items }
      })
    } catch (error) {
      setFavoriteState((current) => current?.mediaId === mediaId
        ? { ...current, error: error instanceof Error ? error.message : "收藏操作失败，请重试" }
        : current)
    } finally {
      setFavoriteState((current) => current?.mediaId === mediaId
        ? { ...current, pendingCueId: null }
        : current)
    }
  }

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
        const refreshFullTranscript = initial || cuesRef.current.length === 0
          || ["UPLOADING", "PROCESSING"].includes(detail.status)
        const shouldFetchTranslations = ["PENDING", "TRANSLATING", "READY", "PARTIAL"].includes(detail.translationStatus)
        const [transcript, translations] = await Promise.all([
          refreshFullTranscript ? mediaApi.cues(mediaId) : Promise.resolve(cuesRef.current),
          shouldFetchTranslations ? mediaApi.cueTranslations(mediaId) : Promise.resolve([]),
        ])
        if (!active) return

        const nextCues = mergeTranslations(transcript, translations)
        let visibleDetail = detail
        const hasNoTranscript = nextCues.length === 0 && detail.subtitleStatus !== "READY"
        const sourceAudioUnavailable = detail.errorMessage?.startsWith(unavailableAudioPrefix)
        const canAutomaticallyStart = ["WAITING_SUBTITLE", "FAILED", "READY"].includes(detail.status)
          && !sourceAudioUnavailable
        if (initial && hasNoTranscript && canAutomaticallyStart
          && autoTranscriptionMediaRef.current !== mediaId) {
          autoTranscriptionMediaRef.current = mediaId
          try {
            await mediaApi.reprocess(mediaId)
            visibleDetail = {
              ...detail,
              status: "PROCESSING",
              processingStage: automaticStage(detail.source),
              processingProgress: 0,
              processingDetail: "转写任务已自动开始",
              errorMessage: null,
            }
          } catch (error) {
            visibleDetail = {
              ...detail,
              status: "FAILED",
              errorMessage: error instanceof Error
                ? `未能自动开始转写：${error.message}`
                : "未能自动开始转写，请手动重试。",
            }
          }
        }
        cuesRef.current = nextCues
        setMedia(visibleDetail)
        setCues(nextCues)
        setLoadError("")
        const nextIndex = findActiveCueIndex(nextCues, currentTimeRef.current * 1000)
        activeIndexRef.current = nextIndex
        setActiveIndex(nextIndex)

        if ((visibleDetail.status !== "FAILED"
          && !(visibleDetail.status === "READY" && visibleDetail.subtitleStatus === "READY" && nextCues.length > 0))
          || ["PENDING", "TRANSLATING"].includes(visibleDetail.translationStatus)) {
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
    setMedia((current) => current ? {
      ...current,
      status: "PROCESSING",
      processingProgress: 0,
      processingDetail: "转写任务已开始",
      errorMessage: null,
    } : current)
    try {
      await mediaApi.reprocess(mediaId)
      setRefreshNonce((value) => value + 1)
    } catch (error) {
      setMedia((current) => current ? {
        ...current,
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "无法重新获取字幕。",
      } : current)
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
    const isPodcastMode = mode === "podcast"
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
        {isPodcastMode ? <HeadphonesIcon className="size-7 text-muted-foreground" /> : <VideoIcon className="size-7 text-muted-foreground" />}
        <h1 className="mt-3 text-base font-bold">无法打开这个{isPodcastMode ? "播客" : "视频"}</h1>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{loadError || `${isPodcastMode ? "播客" : "视频"}不存在或已经被删除。`}</p>
        <Link href={isPodcastMode ? "/podcasts" : "/videos"} className="mt-5 rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">返回{isPodcastMode ? "播客" : "视频"}库</Link>
      </div>
    )
  }

  const activeCue = activeIndex >= 0 ? cues[activeIndex] : null
  const isPodcast = mode === "podcast" || media.source === "PODCAST"
  const transcriptReady = media.status === "READY" && media.subtitleStatus === "READY" && cues.length > 0
  const transcriptionFailed = media.status === "FAILED"

  return (
    <div className={`flex min-w-0 max-w-full flex-1 flex-col ${isPodcast ? "overflow-visible lg:min-h-0 lg:overflow-hidden" : "min-h-0 overflow-hidden"}`}>
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link href={isPodcast ? "/podcasts" : "/videos"} className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]" aria-label={`返回${isPodcast ? "播客" : "视频"}库`}>
            <ArrowLeftIcon className="size-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold text-foreground sm:text-base">{media.title}</h1>
            <p className="truncate text-[11px] text-muted-foreground">
              {isPodcast ? (media.creator || "播客") : media.source === "YOUTUBE" ? "YouTube" : "本地视频"} · {media.durationSeconds === null ? (media.source === "YOUTUBE" || isPodcast ? "在线播放" : "时长检测中") : formatTime(media.durationSeconds)} · {statusLabels[media.status] || media.status}
            </p>
          </div>
        </div>
        <div className="hidden shrink-0 items-center gap-2 text-[11px] text-muted-foreground md:flex">
          {(media.status === "WAITING_SUBTITLE" || media.status === "FAILED") && (
            <button
              type="button"
              onClick={() => void handleReprocess()}
              disabled={isReprocessing}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 font-semibold text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              title={isPodcast ? "重新调用 Whisper 生成播客精听文本" : "自动探测 YouTube 原生字幕或调用 Whisper 转写"}
            >
              <RefreshCwIcon className={`size-3.5 ${isReprocessing ? "animate-spin" : ""}`} />
              <span>重试转写</span>
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

          {isPodcast && media.sourceUrl && (
            <a
              href={media.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="hidden h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 font-semibold text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex"
              title="打开原始音频"
            >
              <ExternalLinkIcon className="size-3.5" />
              <span>原始音频</span>
            </a>
          )}

          {media.status === "READY" && (media.translationStatus === "TRANSLATING" || media.translationStatus === "PENDING") ? (
            <div className="flex items-center gap-1.5 text-primary">
              <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden="true" />
              <span>{translationStatusLabels[media.translationStatus]} · {media.translationProgress}%</span>
            </div>
          ) : media.status === "READY" && (media.translationStatus === "FAILED" || media.translationStatus === "PARTIAL") ? (
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
          ) : media.status === "READY" && media.translationStatus === "READY" ? (
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
          ) : null}
        </div>
      </header>

      <div className={isPodcast
        ? "grid min-h-0 min-w-0 max-w-full flex-1 gap-px overflow-y-auto overflow-x-hidden bg-border lg:grid-cols-[minmax(0,1fr)_380px] lg:grid-rows-1 lg:overflow-hidden"
        : "grid min-h-0 flex-1 grid-rows-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-px bg-border lg:grid-cols-[minmax(0,1fr)_380px] lg:grid-rows-1"
      }>
        <main className={`relative flex min-h-0 min-w-0 max-w-full justify-center bg-background p-3 md:p-5 ${isPodcast ? "items-start overflow-visible lg:items-center lg:overflow-hidden" : "items-center overflow-hidden"}`}>
          {!transcriptReady ? (
            <div className="flex aspect-video w-full max-w-5xl flex-col items-center justify-center rounded-2xl bg-zinc-950 px-6 text-center text-zinc-300">
              {transcriptionFailed ? <AlertCircleIcon className="size-7 text-zinc-500" /> : <LoaderCircleIcon className="size-7 animate-spin text-zinc-400" />}
              <p className="mt-3 text-sm font-semibold">{transcriptionFailed ? "字幕生成失败" : "字幕生成完成后即可播放"}</p>
            </div>
          ) : isPodcast && media.playback.url ? (
            <PodcastAudioPlayer
              ref={playerRef}
              src={media.playback.url}
              title={media.title}
              creator={media.creator}
              coverUrl={media.coverUrl}
              activeCue={activeCue}
              onPlaybackTime={updateActiveCue}
              onReady={handlePlayerReady}
              onError={setPlayerError}
            />
          ) : media.playback.type === "YOUTUBE_IFRAME" && media.playback.externalId ? (
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
              {isPodcast ? <HeadphonesIcon className="size-8 text-zinc-500" /> : <VideoIcon className="size-8 text-zinc-500" />}
              <p className="mt-3 text-sm font-semibold">播放文件尚未准备好</p>
              <p className="mt-1 text-xs text-zinc-500">页面会自动刷新处理状态。</p>
            </div>
          )}

          {playerError && (
            <div role="alert" className="absolute bottom-4 left-1/2 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-3 rounded-lg bg-zinc-900/92 px-3 py-2 text-center text-xs text-zinc-200 shadow-lg">
              <span>{playerError}</span>
              {(media.source === "YOUTUBE" || isPodcast) && media.sourceUrl && (
                <a href={media.sourceUrl} target="_blank" rel="noreferrer" className="shrink-0 font-semibold text-white underline underline-offset-2">
                  {isPodcast ? "打开原始音频" : "前往 YouTube"}
                </a>
              )}
            </div>
          )}
        </main>

        <div className={`relative flex min-w-0 flex-col overflow-hidden bg-background ${isPodcast ? "min-h-[55vh] lg:min-h-0" : "min-h-0"}`}>
          {transcriptionFailed ? (
            <TranscriptionFailure
              media={media}
              isPodcast={isPodcast}
              isRetrying={isReprocessing}
              onRetry={() => void handleReprocess()}
            />
          ) : !transcriptReady ? (
            <TranscriptionProgress media={media} isPodcast={isPodcast} />
          ) : (
            <TranscriptRail
              mediaId={mediaId}
              cues={cues}
              activeIndex={activeIndex}
              onCueSelect={(cue) => playerRef.current?.seekTo(cue.startMs / 1000)}
              favoriteSentenceIds={favoriteState?.mediaId === mediaId ? favoriteState.items : undefined}
              favoritePendingCueId={favoriteState?.mediaId === mediaId ? favoriteState.pendingCueId : null}
              favoriteError={favoriteState?.mediaId === mediaId ? favoriteState.error : undefined}
              onFavoriteToggle={favoriteState?.mediaId === mediaId ? (cue) => void toggleFavorite(cue) : undefined}
              onWordSelect={handleWordSelect}
              selectedWord={selectedWordTarget?.word}
              emptyTitle={isPodcast ? "精听文本正在准备" : media.source === "YOUTUBE" ? "尚未导入字幕" : undefined}
              emptyDescription={isPodcast ? "识别完成后，这里会自动出现逐句文本。" : media.source === "YOUTUBE" ? "导入 SRT 或 VTT 英文字幕后，会自动生成中文翻译并启用字幕跟随。" : undefined}
            />
          )}

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
