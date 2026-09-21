"use client"

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  CheckIcon,
  LanguagesIcon,
  PlayIcon,
  SearchIcon,
  TvIcon,
  VideoIcon,
  XIcon,
  UploadIcon,
} from "lucide-react"
import { channelApi, mediaApi, type MediaItem } from "@/lib/api-client"
import { YouTubeIcon, YouTubeImportDialog } from "@/components/video/youtube-import-dialog"
import { ChannelSubscriptionDrawer } from "@/components/video/channel-subscription-drawer"
import { useTitleTranslation } from "@/lib/title-translation"

type SourceFilter = "all" | "YOUTUBE" | "LOCAL"
type LocalImportState = "idle" | "uploading" | "success" | "error" | "cancelled"

const MAX_LOCAL_VIDEO_SIZE = 4 * 1024 * 1024 * 1024
const SUPPORTED_VIDEO_EXTENSIONS = ["mp4", "m4v", "mov", "mkv", "webm", "avi", "ogv", "ogg", "mpeg", "mpg"]

const sourceTabs: Array<{ id: SourceFilter; label: string }> = [
  { id: "all", label: "全部素材" },
  { id: "YOUTUBE", label: "YouTube" },
  { id: "LOCAL", label: "本地视频" },
]

const statusLabels: Record<string, string> = {
  UPLOADING: "上传中",
  PROCESSING: "处理中",
  WAITING_SUBTITLE: "等待字幕",
  READY: "双语就绪",
  FAILED: "处理失败",
}

function formatDuration(seconds: number | null) {
  if (seconds === null) return "待检测"
  const minutes = Math.floor(seconds / 60)
  const remaining = Math.floor(seconds % 60)
  return `${minutes}:${String(remaining).padStart(2, "0")}`
}

function MediaPoster({ media }: { media: MediaItem }) {
  return (
    <div className="relative size-full overflow-hidden bg-zinc-950 text-zinc-100">
      {media.coverUrl ? (
        <img
          src={media.coverUrl}
          alt={media.title}
          className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="relative flex size-full flex-col justify-between p-4 bg-zinc-900">
          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            <span>{media.source === "YOUTUBE" ? "YouTube" : "本地视频"}</span>
            <span>{statusLabels[media.status] || media.status}</span>
          </div>
          <VideoIcon className="size-8 text-zinc-600 self-center" />
          <div />
        </div>
      )}

      {/* Top badges */}
      <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-xs border border-white/10">
        {media.source === "YOUTUBE" ? (
          <>
            <span className="size-1.5 rounded-full bg-rose-500" />
            <span>YouTube</span>
          </>
        ) : (
          <>
            <span className="size-1.5 rounded-full bg-zinc-400" />
            <span>本地</span>
          </>
        )}
      </div>

      <div className="absolute top-2.5 right-2.5 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-xs border border-white/10">
        {statusLabels[media.status] || media.status}
      </div>

      {/* Bottom right: Duration & WPM */}
      <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5">
        {media.wpm !== null && (
          <span className="rounded-md bg-black/70 px-1.5 py-0.5 font-mono text-[10px] font-bold text-zinc-200 backdrop-blur-xs border border-white/10">
            {media.wpm} WPM
          </span>
        )}
        <span className="rounded-md bg-black/70 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white backdrop-blur-xs border border-white/10">
          {formatDuration(media.durationSeconds)}
        </span>
      </div>
    </div>
  )
}

async function uploadPartWithRetry(uploadId: string, partNumber: number, part: Blob, signal: AbortSignal) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await mediaApi.uploadPart(uploadId, partNumber, part, signal)
    } catch (error) {
      if (signal.aborted || attempt === 2) throw error
      await new Promise((resolve) => window.setTimeout(resolve, 400 * 2 ** attempt))
    }
  }
  throw new Error("分片上传失败")
}

export function VideoLibraryPage() {
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all")
  const [activeCreatorFilter, setActiveCreatorFilter] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [libraryError, setLibraryError] = useState("")
  const [isYouTubeDialogOpen, setIsYouTubeDialogOpen] = useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [subscribedCount, setSubscribedCount] = useState(0)

  const [localImportState, setLocalImportState] = useState<LocalImportState>("idle")
  const [localUploadProgress, setLocalUploadProgress] = useState(0)
  const [localImportError, setLocalImportError] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadAbortRef = useRef<AbortController | null>(null)

  // Title translation hook
  const {
    enabled: isTransEnabled,
    toggleTranslation,
    translations,
    batchTranslateTitles,
  } = useTitleTranslation()

  const loadMedia = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true)
    try {
      const items = await mediaApi.list()
      setMediaItems(items)
      setLibraryError("")
    } catch (error) {
      setLibraryError(error instanceof Error ? error.message : "读取视频库失败")
    } finally {
      if (showLoading) setIsLoading(false)
    }
  }, [])

  const loadSubscriptionsCount = useCallback(async () => {
    try {
      const list = await channelApi.listSubscriptions()
      setSubscribedCount(list.length)
    } catch {
      // fallback
    }
  }, [])

  useEffect(() => {
    void loadMedia()
    void loadSubscriptionsCount()
  }, [loadMedia, loadSubscriptionsCount])

  // Batch translate titles when translation is enabled
  useEffect(() => {
    if (isTransEnabled && mediaItems.length > 0) {
      batchTranslateTitles(mediaItems.map((m) => m.title))
    }
  }, [isTransEnabled, mediaItems, batchTranslateTitles])

  const uniqueCreatorsCount = useMemo(() => {
    const creators = new Set(
      mediaItems.map((item) => item.creator?.trim()).filter((c): c is string => Boolean(c))
    )
    return creators.size
  }, [mediaItems])

  const visibleMedia = useMemo(() => {
    return mediaItems.filter((item) => {
      // Source filter
      if (sourceFilter !== "all" && item.source !== sourceFilter) {
        return false
      }
      // Creator filter
      if (activeCreatorFilter && item.creator?.toLowerCase() !== activeCreatorFilter.toLowerCase()) {
        return false
      }
      // Search query (matches title, creator, or translated title)
      if (query.trim()) {
        const q = query.toLowerCase()
        const titleMatch = item.title.toLowerCase().includes(q)
        const creatorMatch = item.creator?.toLowerCase().includes(q)
        const transMatch = translations[item.title]?.toLowerCase().includes(q)
        if (!titleMatch && !creatorMatch && !transMatch) return false
      }
      return true
    })
  }, [mediaItems, sourceFilter, activeCreatorFilter, query, translations])

  const handleLocalFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const ext = file.name.split(".").pop()?.toLowerCase() || ""
    if (!SUPPORTED_VIDEO_EXTENSIONS.includes(ext)) {
      setLocalImportState("error")
      setLocalImportError("不支持该文件格式，请选择主流视频文件。")
      event.target.value = ""
      return
    }

    if (file.size > MAX_LOCAL_VIDEO_SIZE) {
      setLocalImportState("error")
      setLocalImportError("视频文件体积超过 4GB 上限。")
      event.target.value = ""
      return
    }

    const abortController = new AbortController()
    uploadAbortRef.current = abortController
    setLocalImportState("uploading")
    setLocalUploadProgress(0)
    setLocalImportError("")

    try {
      const session = await mediaApi.createUpload(file, abortController.signal)
      const partSize = session.partSize || 8 * 1024 * 1024
      const totalParts = Math.max(1, Math.ceil(file.size / partSize))

      for (let partNumber = 1; partNumber <= totalParts; partNumber += 1) {
        if (abortController.signal.aborted) throw new Error("UPLOAD_ABORTED")
        const start = (partNumber - 1) * partSize
        const end = Math.min(file.size, start + partSize)
        const chunk = file.slice(start, end)

        await uploadPartWithRetry(session.uploadId, partNumber, chunk, abortController.signal)
        const percent = Math.floor((partNumber / totalParts) * 100)
        setLocalUploadProgress(percent)
      }

      await mediaApi.completeUpload(session.uploadId, abortController.signal)
      setLocalImportState("success")
      setLocalUploadProgress(100)
      await loadMedia(false)
      window.setTimeout(() => setLocalImportState("idle"), 2500)
    } catch (error) {
      if (abortController.signal.aborted) {
        setLocalImportState("cancelled")
      } else {
        setLocalImportState("error")
        setLocalImportError(error instanceof Error ? error.message : "本地视频导入失败")
      }
    } finally {
      uploadAbortRef.current = null
      event.target.value = ""
    }
  }

  const handleLocalImportClick = () => {
    if (localImportState === "uploading") {
      uploadAbortRef.current?.abort()
      return
    }
    setLocalImportError("")
    fileInputRef.current?.click()
  }

  return (
    <div className="mx-auto flex w-full max-w-[1480px] flex-1 flex-col gap-6 px-4 pb-12 pt-3 md:px-6">
      {/* Top Bar - LexiFlow Single-Row Native Layout */}
      <section className="flex flex-col gap-3.5 border-b border-border pb-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Left: Title & Source Segmented Tabs */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold tracking-tight text-foreground">
              视频精听库
            </h1>
            <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-mono font-medium text-muted-foreground border border-border">
              {visibleMedia.length}
            </span>
          </div>

          <div className="flex items-center rounded-xl bg-muted p-1 text-xs font-medium border border-border">
            {sourceTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSourceFilter(tab.id)}
                className={`rounded-lg px-3 py-1 transition cursor-pointer ${
                  sourceFilter === tab.id
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Same-Row Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* YouTube Import Button */}
          <button
            type="button"
            onClick={() => setIsYouTubeDialogOpen(true)}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-foreground text-background px-3.5 text-xs font-semibold hover:opacity-90 active:scale-[0.98] transition cursor-pointer shadow-xs"
            aria-label="导入 YouTube 视频"
          >
            <YouTubeIcon className="size-3.5" />
            <span>导入 YouTube</span>
          </button>

          {/* Local Video Import Button */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp4,.m4v,.mov,.mkv,.webm,.avi,.ogv,.ogg,.mpeg,.mpg,video/*"
            onChange={handleLocalFile}
            className="sr-only"
          />
          <button
            type="button"
            onClick={handleLocalImportClick}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-border bg-card hover:bg-muted px-3 text-xs font-semibold text-foreground active:scale-[0.98] transition cursor-pointer shadow-xs"
            aria-label={localImportState === "uploading" ? "取消本地上传" : "导入本地视频"}
          >
            {localImportState === "uploading" ? (
              <>
                <XIcon className="size-3.5" />
                <span>取消上传 {localUploadProgress}%</span>
              </>
            ) : localImportState === "success" ? (
              <>
                <CheckIcon className="size-3.5 text-emerald-500" />
                <span>已导入</span>
              </>
            ) : (
              <>
                <UploadIcon className="size-3.5" />
                <span>本地视频</span>
              </>
            )}
          </button>

          {/* Title Translation Toggle [中 / A] */}
          <button
            type="button"
            onClick={toggleTranslation}
            className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition cursor-pointer active:scale-[0.98] ${
              isTransEnabled
                ? "bg-foreground text-background border-foreground shadow-xs"
                : "bg-background border-border text-foreground hover:bg-muted"
            }`}
            title={isTransEnabled ? "已开启中文标题，点击切回英文" : "点击开启中文标题翻译"}
          >
            <LanguagesIcon className="size-3.5" />
            <span>中 / A</span>
          </button>

          {/* Search Box */}
          <div className="relative w-full sm:w-56">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索视频或创作者"
              className="h-9 w-full rounded-xl border border-border bg-background pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-foreground transition"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <XIcon className="size-3" />
              </button>
            )}
          </div>

          {/* Channel Subscription Drawer Button */}
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 text-xs font-medium text-foreground hover:bg-muted transition active:scale-[0.98] cursor-pointer"
          >
            <TvIcon className="size-3.5 text-muted-foreground" />
            <span>订阅频道</span>
            {(subscribedCount > 0 || uniqueCreatorsCount > 0) && (
              <span className="flex size-4.5 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-background">
                {subscribedCount > 0 ? subscribedCount : uniqueCreatorsCount}
              </span>
            )}
          </button>
        </div>
      </section>

      {/* Active Creator Filter Pill */}
      {activeCreatorFilter && (
        <div className="flex items-center justify-between rounded-xl border border-border bg-muted/60 px-4 py-2 text-xs text-foreground">
          <div className="flex items-center gap-2">
            <TvIcon className="size-3.5 text-muted-foreground" />
            <span>
              正在筛选频道：<strong>{activeCreatorFilter}</strong>（共 {visibleMedia.length} 篇）
            </span>
          </div>
          <button
            type="button"
            onClick={() => setActiveCreatorFilter(null)}
            className="inline-flex items-center gap-1 font-semibold underline underline-offset-2 hover:opacity-80 cursor-pointer text-xs"
          >
            <XIcon className="size-3" />
            <span>清除筛选</span>
          </button>
        </div>
      )}

      {/* Local upload error notices */}
      {localImportState === "uploading" && (
        <div className="h-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full origin-left bg-foreground transition-transform duration-300 ease-out"
            style={{ transform: `scaleX(${localUploadProgress / 100})` }}
          />
        </div>
      )}
      {localImportState === "error" && (
        <p className="text-xs font-medium text-destructive">{localImportError}</p>
      )}

      {/* Video Cards Grid - LexiFlow 3-Column Minimalist Study Grid */}
      <section>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 animate-pulse rounded-2xl bg-muted border border-border" />
            ))}
          </div>
        ) : libraryError ? (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border p-8 text-center bg-card/40">
            <VideoIcon className="size-6 text-muted-foreground" />
            <h3 className="mt-3 text-sm font-semibold text-foreground">视频库读取失败</h3>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">{libraryError}</p>
            <button
              type="button"
              onClick={() => void loadMedia()}
              className="mt-4 text-xs font-semibold underline cursor-pointer text-foreground"
            >
              重新加载
            </button>
          </div>
        ) : visibleMedia.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-border p-8 text-center bg-card/40">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-muted border border-border text-muted-foreground">
              <VideoIcon className="size-6" />
            </div>
            <h3 className="mt-3 text-sm font-semibold text-foreground">视频库暂无内容</h3>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground leading-relaxed">
              {query || sourceFilter !== "all" || activeCreatorFilter
                ? "未检索到匹配的视频，尝试清空筛选条件。"
                : "点击“导入 YouTube”或“本地视频”即可开始双语精听与生词研习。"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {visibleMedia.map((media) => {
              const displayTitle =
                isTransEnabled && translations[media.title]
                  ? translations[media.title]
                  : media.title

              return (
                <Link
                  key={media.id}
                  href={`/videos/${media.id}`}
                  className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card shadow-xs transition hover:-translate-y-0.5 hover:shadow-md hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {/* 16:9 Thumbnail Poster */}
                  <div className="aspect-[16/9] w-full overflow-hidden">
                    <MediaPoster media={media} />
                  </div>

                  {/* Card Content Beneath Poster */}
                  <div className="flex flex-1 flex-col justify-between p-4">
                    <div>
                      {/* Title: Supports Bilingual Translation Toggle */}
                      <h3 className="line-clamp-2 text-sm font-bold text-foreground group-hover:text-primary transition leading-snug">
                        {displayTitle}
                      </h3>

                      {/* When title translation is active, show original English title as subtext */}
                      {isTransEnabled && translations[media.title] && (
                        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground font-normal italic">
                          {media.title}
                        </p>
                      )}
                    </div>

                    {/* Creator & Meta line */}
                    <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                      <span className="truncate max-w-[65%] font-medium text-foreground">
                        {media.creator || (media.source === "YOUTUBE" ? "YouTube" : "本地导入")}
                      </span>

                      <div className="flex items-center gap-1 font-semibold text-foreground group-hover:translate-x-0.5 transition-transform">
                        <PlayIcon className="size-3 fill-current" />
                        <span className="text-[11px]">精听</span>
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* YouTube Import Dialog */}
      <YouTubeImportDialog
        open={isYouTubeDialogOpen}
        onOpenChange={setIsYouTubeDialogOpen}
        onSuccess={() => void loadMedia(false)}
      />

      {/* Channel Subscription Drawer */}
      <ChannelSubscriptionDrawer
        open={isDrawerOpen}
        onOpenChange={(open) => {
          setIsDrawerOpen(open)
          if (!open) {
            void loadSubscriptionsCount()
            void loadMedia(false)
          }
        }}
        mediaItems={mediaItems}
        activeCreatorFilter={activeCreatorFilter}
        onSelectCreatorFilter={setActiveCreatorFilter}
        onOpenYouTubeImport={() => setIsYouTubeDialogOpen(true)}
        onMediaImported={() => {
          void loadMedia(false)
          void loadSubscriptionsCount()
        }}
        isTitleTransEnabled={isTransEnabled}
        titleTranslations={translations}
      />
    </div>
  )
}
