"use client"

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { CheckIcon, PlayIcon, SearchIcon, VideoIcon, XIcon } from "lucide-react"
import { mediaApi, type MediaItem } from "@/lib/api-client"

type LibraryFilter = "all" | "ready" | "processing"
type LocalImportState = "idle" | "uploading" | "success" | "error" | "cancelled"

const MAX_LOCAL_VIDEO_SIZE = 4 * 1024 * 1024 * 1024
const SUPPORTED_VIDEO_EXTENSIONS = ["mp4", "m4v", "mov", "mkv", "webm", "avi", "ogv", "ogg", "mpeg", "mpg"]

const filters: Array<{ id: LibraryFilter; label: string }> = [
  { id: "all", label: "全部素材" },
  { id: "ready", label: "可以播放" },
  { id: "processing", label: "正在处理" },
]

const statusLabels: Record<string, string> = {
  UPLOADING: "上传中",
  PROCESSING: "处理中",
  WAITING_SUBTITLE: "等待字幕",
  READY: "可以播放",
  FAILED: "处理失败",
}

function formatDuration(seconds: number | null) {
  if (seconds === null) return "待检测"
  const minutes = Math.floor(seconds / 60)
  const remaining = Math.floor(seconds % 60)
  return `${minutes}:${String(remaining).padStart(2, "0")}`
}

function MediaMeta({ media }: { media: MediaItem }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
      <span>{media.source === "LOCAL" ? "本地视频" : media.source}</span>
      <span aria-hidden="true">·</span>
      <span>{formatDuration(media.durationSeconds)}</span>
      {media.wpm !== null && (
        <>
          <span aria-hidden="true">·</span>
          <span>{media.wpm} WPM</span>
        </>
      )}
      <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-foreground">
        {media.level || statusLabels[media.status] || media.status}
      </span>
    </div>
  )
}

function MediaPoster({ media, compact = false }: { media: MediaItem; compact?: boolean }) {
  return (
    <div className="relative flex size-full overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.1)_1px,transparent_1px)] [background-size:42px_42px]" />
      <div className="absolute -right-10 -top-16 size-44 rounded-full bg-zinc-600/70" />
      <div className="absolute -bottom-24 -left-12 size-48 rounded-full border-[22px] border-zinc-700/50" />
      <div className={`relative flex w-full flex-col justify-between ${compact ? "p-4" : "p-6"}`}>
        <div className="flex items-center justify-between font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
          <span>Local media</span>
          <span>{statusLabels[media.status] || media.status}</span>
        </div>
        <h3 className={`${compact ? "max-w-[15ch] text-xl" : "max-w-[18ch] text-4xl"} font-extrabold leading-[1.02] tracking-tight`}>
          {media.title}
        </h3>
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
  const [activeFilter, setActiveFilter] = useState<LibraryFilter>("all")
  const [query, setQuery] = useState("")
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [libraryError, setLibraryError] = useState("")
  const [localImportState, setLocalImportState] = useState<LocalImportState>("idle")
  const [localUploadProgress, setLocalUploadProgress] = useState(0)
  const [localImportError, setLocalImportError] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadAbortRef = useRef<AbortController | null>(null)

  const loadMedia = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true)
    try {
      const items = await mediaApi.list()
      setMediaItems(items)
      setLibraryError("")
    } catch (error) {
      setLibraryError(error instanceof Error ? error.message : "无法读取视频库。")
    } finally {
      if (showLoading) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadMedia()
  }, [loadMedia])

  const visibleMedia = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return mediaItems.filter((media) => {
      const matchesFilter =
        activeFilter === "all" ||
        (activeFilter === "ready" && ["READY", "WAITING_SUBTITLE"].includes(media.status)) ||
        (activeFilter === "processing" && ["UPLOADING", "PROCESSING"].includes(media.status))
      const matchesQuery = !normalizedQuery ||
        `${media.title} ${media.creator || ""} ${media.source}`.toLowerCase().includes(normalizedQuery)
      return matchesFilter && matchesQuery
    })
  }, [activeFilter, mediaItems, query])

  const leadMedia = visibleMedia[0]
  const restMedia = visibleMedia.slice(1)

  const handleLocalFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    const extension = file.name.split(".").pop()?.toLowerCase() ?? ""
    if (!SUPPORTED_VIDEO_EXTENSIONS.includes(extension)) {
      setLocalImportState("error")
      setLocalImportError("请选择 MP4、MOV、MKV、WebM、AVI、OGV 或 MPEG 视频。")
      return
    }
    if (file.size <= 0 || file.size > MAX_LOCAL_VIDEO_SIZE) {
      setLocalImportState("error")
      setLocalImportError("视频必须大于 0 字节且不超过 4GB。")
      return
    }

    const controller = new AbortController()
    uploadAbortRef.current = controller
    setLocalImportState("uploading")
    setLocalUploadProgress(0)
    setLocalImportError("")

    try {
      const session = await mediaApi.createUpload(file, controller.signal)
      for (let partNumber = 1; partNumber <= session.totalParts; partNumber += 1) {
        const start = (partNumber - 1) * session.partSize
        const end = Math.min(start + session.partSize, file.size)
        await uploadPartWithRetry(session.uploadId, partNumber, file.slice(start, end), controller.signal)
        setLocalUploadProgress(Math.round((end / file.size) * 100))
      }
      await mediaApi.completeUpload(session.uploadId, controller.signal)
      setLocalUploadProgress(100)
      setLocalImportState("success")
      await loadMedia(false)
    } catch (error) {
      if (controller.signal.aborted) {
        setLocalImportState("cancelled")
        setLocalImportError("")
      } else {
        setLocalImportState("error")
        setLocalImportError(error instanceof Error ? error.message : "本地视频上传失败，请稍后重试。")
      }
    } finally {
      uploadAbortRef.current = null
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
    <div className="mx-auto flex w-full max-w-[1480px] flex-1 flex-col gap-7 px-4 pb-10 pt-2 md:px-6">
      <section className="flex flex-col gap-5 border-b border-border pb-6 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-2xl">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Video immersion</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">从真实语境开始精听</h1>
          <p className="mt-2 max-w-[65ch] text-sm leading-6 text-muted-foreground">
            导入本地视频后即可播放。字幕、转码和语音识别会在后台处理，不影响兼容视频直接预览。
          </p>
        </div>

        <div className="w-full max-w-sm">
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
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-85 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-auto"
            aria-label={localImportState === "uploading" ? "取消本地视频上传" : "导入本地视频"}
          >
            {localImportState === "uploading" ? <XIcon className="size-4" /> :
              localImportState === "success" ? <CheckIcon className="size-4" /> : <VideoIcon className="size-4" />}
            {localImportState === "uploading" ? `取消上传 ${localUploadProgress}%` :
              localImportState === "success" ? "已导入，继续添加" : "导入本地视频"}
          </button>
          {localImportState === "uploading" && (
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted" aria-label={`本地视频已上传 ${localUploadProgress}%`}>
              <div className="h-full origin-left bg-foreground transition-transform duration-300 ease-out" style={{ transform: `scaleX(${localUploadProgress / 100})` }} />
            </div>
          )}
          {localImportState === "error" && <p role="alert" className="mt-2 text-xs font-medium text-destructive">{localImportError}</p>}
          {localImportState === "cancelled" && <p className="mt-2 text-xs text-muted-foreground">上传已取消，可以重新选择视频。</p>}
        </div>
      </section>

      <section aria-labelledby="library-heading">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1 overflow-x-auto" role="tablist" aria-label="视频筛选">
            {filters.map((filter) => (
              <button
                key={filter.id}
                type="button"
                role="tab"
                aria-selected={activeFilter === filter.id}
                onClick={() => setActiveFilter(filter.id)}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${activeFilter === filter.id ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <label className="relative w-full sm:w-72">
            <span className="sr-only">搜索视频</span>
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索已导入的视频"
              className="h-9 w-full rounded-xl border border-border bg-background pl-9 pr-9 text-sm outline-none transition focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-ring/20"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground" aria-label="清空搜索">
                <XIcon className="size-3.5" />
              </button>
            )}
          </label>
        </div>

        <div className="mt-5">
          <h2 id="library-heading" className="text-lg font-bold tracking-tight text-foreground">你的视频库</h2>
          <p className="mt-1 text-xs text-muted-foreground">{visibleMedia.length} 段已导入内容</p>
        </div>

        {isLoading ? (
          <div className="mt-4 grid gap-5 lg:grid-cols-12" aria-label="正在加载视频库">
            <div className="h-[410px] animate-pulse rounded-2xl bg-muted lg:col-span-7" />
            <div className="grid gap-5 sm:grid-cols-2 lg:col-span-5">
              <div className="h-64 animate-pulse rounded-2xl bg-muted" />
              <div className="h-64 animate-pulse rounded-2xl bg-muted" />
            </div>
          </div>
        ) : libraryError ? (
          <div className="mt-4 flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border px-6 text-center">
            <VideoIcon className="size-6 text-muted-foreground" />
            <h3 className="mt-3 text-sm font-semibold">视频库读取失败</h3>
            <p className="mt-1 max-w-md text-xs text-muted-foreground">{libraryError}</p>
            <button type="button" onClick={() => void loadMedia()} className="mt-4 text-sm font-semibold hover:underline">重新加载</button>
          </div>
        ) : leadMedia ? (
          <div className="mt-4 grid items-start gap-5 lg:grid-cols-12">
            <Link href={`/videos/${leadMedia.id}`} className="group self-start overflow-hidden rounded-2xl border border-border bg-card shadow-xs transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:col-span-7">
              <div className="aspect-[16/8.8] overflow-hidden"><MediaPoster media={leadMedia} /></div>
              <div className="flex items-start justify-between gap-5 p-5">
                <div className="min-w-0">
                  <MediaMeta media={leadMedia} />
                  <h3 className="mt-2 text-xl font-bold tracking-tight text-foreground">{leadMedia.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{leadMedia.status === "FAILED" ? leadMedia.errorMessage || "视频处理失败" : statusLabels[leadMedia.status] || "已导入本地视频"}</p>
                </div>
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition group-hover:scale-105">
                  <PlayIcon className="size-4 fill-current translate-x-px" />
                </span>
              </div>
            </Link>

            <div className="grid gap-5 sm:grid-cols-2 lg:col-span-5">
              {restMedia.map((media) => (
                <Link key={media.id} href={`/videos/${media.id}`} className="group overflow-hidden rounded-2xl border border-border bg-card shadow-xs transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <div className="aspect-[16/10] overflow-hidden"><MediaPoster media={media} compact /></div>
                  <div className="p-4">
                    <MediaMeta media={media} />
                    <h3 className="mt-2 line-clamp-2 text-sm font-bold leading-5 text-foreground">{media.title}</h3>
                    <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{media.creator || "本地导入"}</span>
                      <span>{statusLabels[media.status] || media.status}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-4 flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-border px-6 text-center">
            <VideoIcon className="size-6 text-muted-foreground" />
            <h3 className="mt-3 text-sm font-semibold">视频库还是空的</h3>
            <p className="mt-1 text-xs text-muted-foreground">{query || activeFilter !== "all" ? "清空搜索或切换筛选条件后再试。" : "点击“导入本地视频”开始播放测试。"}</p>
          </div>
        )}
      </section>
    </div>
  )
}
