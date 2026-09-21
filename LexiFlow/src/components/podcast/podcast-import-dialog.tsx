"use client"

import { useState, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  HeadphonesIcon,
  RssIcon,
  UploadIcon,
  LoaderCircleIcon,
  XIcon,
  CheckIcon,
} from "lucide-react"
import type { PodcastEpisode, PodcastShow } from "./podcast-types"

interface PodcastImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (show: PodcastShow, episodes: PodcastEpisode[]) => void
}

const PRESET_FEEDS = [
  {
    name: "VOA 慢速英语综合播客",
    tag: "公共领域 · 适合基础精听",
    url: "https://learningenglish.voanews.com/podcast/?zoneId=1689",
  },
  {
    name: "TED Talks Daily 原声演讲",
    tag: "前沿观点 · 真实原声听力",
    url: "https://feeds.feedburner.com/TEDTalks_audio",
  },
]

export function PodcastImportDialog({
  open,
  onOpenChange,
  onSuccess,
}: PodcastImportDialogProps) {
  const [tab, setTab] = useState<"url" | "file">("url")
  const [url, setUrl] = useState("")
  const [enableAsr, setEnableAsr] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed) return

    setIsSubmitting(true)
    setErrorMessage("")

    try {
      // 1. Call our local Next.js RSS Proxy
      const res = await fetch(`/api/podcast/rss?url=${encodeURIComponent(trimmed)}`)
      const payload = await res.json()

      if (!res.ok || payload.code !== 200 || !payload.data?.show) {
        throw new Error(payload.message || "RSS 源解析失败，请检查链接有效性")
      }

      const show: PodcastShow = payload.data.show
      const episodes: PodcastEpisode[] = payload.data.episodes || []

      // 2. Persist Show to localStorage
      try {
        const storedShows = localStorage.getItem("lexiflow_podcast_shows")
        const showList: PodcastShow[] = storedShows ? JSON.parse(storedShows) : []
        const existsShowIdx = showList.findIndex((s) => s.id === show.id || s.feedUrl === show.feedUrl)
        if (existsShowIdx >= 0) {
          showList[existsShowIdx] = show
        } else {
          showList.unshift(show)
        }
        localStorage.setItem("lexiflow_podcast_shows", JSON.stringify(showList))

        // Persist Episodes to localStorage
        const storedEpisodes = localStorage.getItem("lexiflow_podcast_episodes")
        const episodeList: PodcastEpisode[] = storedEpisodes ? JSON.parse(storedEpisodes) : []
        
        // Merge episodes by guid
        for (const ep of episodes) {
          if (!episodeList.some((existing) => existing.guid === ep.guid)) {
            episodeList.unshift(ep)
          }
        }
        localStorage.setItem("lexiflow_podcast_episodes", JSON.stringify(episodeList))
      } catch {}

      setUrl("")
      onOpenChange(false)
      if (onSuccess) onSuccess(show, episodes)
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "播客解析失败，请检查 RSS 地址或稍后重试。"
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsSubmitting(true)
    setErrorMessage("")

    try {
      const showId = "local-audio-show"
      const fakeShow: PodcastShow = {
        id: showId,
        feedUrl: "local://audio",
        title: "本地音频播客",
        author: "用户导入",
        description: "由用户本地上传的音频节目",
        episodeCount: 1,
      }

      const newEpisode: PodcastEpisode = {
        id: "ep-local-" + Date.now(),
        guid: "local-" + file.name + "-" + file.size,
        showId,
        showTitle: "本地音频",
        title: file.name.replace(/\.[^/.]+$/, ""),
        author: "本地导入",
        audioUrl: URL.createObjectURL(file),
        durationSeconds: 1200,
        pubDate: "今天",
        status: "READY",
        hasBilingualTranscript: true,
        wpm: 140,
        level: "B1",
      }

      try {
        const storedShows = localStorage.getItem("lexiflow_podcast_shows")
        const showList: PodcastShow[] = storedShows ? JSON.parse(storedShows) : []
        if (!showList.some((s) => s.id === showId)) showList.unshift(fakeShow)
        localStorage.setItem("lexiflow_podcast_shows", JSON.stringify(showList))

        const storedEpisodes = localStorage.getItem("lexiflow_podcast_episodes")
        const episodeList: PodcastEpisode[] = storedEpisodes ? JSON.parse(storedEpisodes) : []
        episodeList.unshift(newEpisode)
        localStorage.setItem("lexiflow_podcast_episodes", JSON.stringify(episodeList))
      } catch {}

      onOpenChange(false)
      if (onSuccess) onSuccess(fakeShow, [newEpisode])
    } catch {
      setErrorMessage("音频文件处理失败")
    } finally {
      setIsSubmitting(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-lg p-0 overflow-hidden bg-background text-foreground border border-border shadow-2xl rounded-2xl"
      >
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-muted text-foreground border border-border">
                <HeadphonesIcon className="size-4" />
              </div>
              <DialogTitle className="text-base font-bold text-foreground">
                收录播客节目
              </DialogTitle>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
            >
              <XIcon className="size-4" />
            </button>
          </div>

          {/* Sub-tabs: Link vs Local Audio */}
          <div className="mt-3 flex rounded-lg bg-muted p-0.5 text-xs font-medium border border-border">
            <button
              type="button"
              onClick={() => setTab("url")}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-1 transition cursor-pointer ${
                tab === "url"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <RssIcon className="size-3.5" />
              <span>RSS 订阅源 / 音频链接</span>
            </button>
            <button
              type="button"
              onClick={() => setTab("file")}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-1 transition cursor-pointer ${
                tab === "file"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <UploadIcon className="size-3.5" />
              <span>本地音频文件</span>
            </button>
          </div>
        </DialogHeader>

        <div className="p-5">
          {tab === "url" ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  播客 RSS 地址或单集直链
                </label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://... (输入 RSS XML 或播客源链接)"
                  className="w-full h-10 px-3 rounded-xl border border-border bg-background text-xs sm:text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-foreground transition"
                  autoFocus
                  disabled={isSubmitting}
                />
              </div>

              {/* Quick Selectors for Verified Feeds */}
              <div>
                <span className="block text-[11px] font-medium text-muted-foreground mb-1.5">
                  推荐公版与官方英语学习源（点击直接填入）
                </span>
                <div className="grid grid-cols-1 gap-2">
                  {PRESET_FEEDS.map((feed) => (
                    <div
                      key={feed.name}
                      onClick={() => setUrl(feed.url)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                        url === feed.url
                          ? "border-foreground bg-muted text-foreground"
                          : "border-border bg-card hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <div className="min-w-0">
                        <span className="block font-semibold text-foreground truncate">
                          {feed.name}
                        </span>
                        <span className="block text-[11px] text-muted-foreground mt-0.5">
                          {feed.tag}
                        </span>
                      </div>
                      {url === feed.url ? (
                        <CheckIcon className="size-4 shrink-0 text-foreground ml-2" />
                      ) : (
                        <span className="text-[11px] text-muted-foreground shrink-0 underline ml-2">
                          填入
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
                <div className="space-y-0.5">
                  <span className="text-xs font-medium text-foreground block">
                    Whisper 语音自动分句与转写
                  </span>
                  <span className="text-[11px] text-muted-foreground block">
                    无官方文本时自动提取音频并切分为 2~8 秒精听句子
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={enableAsr}
                  onChange={(e) => setEnableAsr(e.target.checked)}
                  className="size-4 rounded border-border accent-foreground cursor-pointer"
                />
              </div>

              {errorMessage && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {errorMessage}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="px-3.5 py-2 text-xs font-medium rounded-xl border border-border text-foreground hover:bg-muted transition cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={!url.trim() || isSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-foreground text-background hover:opacity-90 disabled:opacity-40 transition cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <LoaderCircleIcon className="size-3.5 animate-spin" />
                      <span>正在拉取与解析...</span>
                    </>
                  ) : (
                    <span>解析并收录</span>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.mp3,.m4a,.wav,.aac,.ogg,.flac"
                onChange={handleFileChange}
                className="sr-only"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-border rounded-xl bg-card hover:bg-muted/50 cursor-pointer transition text-center"
              >
                <UploadIcon className="size-8 text-muted-foreground mb-2" />
                <span className="text-xs font-semibold text-foreground">
                  点击选择本地播客音频文件
                </span>
                <span className="text-[11px] text-muted-foreground mt-1">
                  支持 MP3, M4A, AAC, WAV 等格式
                </span>
              </div>

              {isSubmitting && (
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <LoaderCircleIcon className="size-4 animate-spin" />
                  <span>正在处理本地音频与切句...</span>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
