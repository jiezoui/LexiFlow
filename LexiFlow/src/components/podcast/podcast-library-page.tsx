"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  HeadphonesIcon,
  PlusIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  LanguagesIcon,
  PlayIcon,
  CheckCircle2Icon,
  XIcon,
  SparklesIcon,
} from "lucide-react"
import { useTitleTranslation } from "@/lib/title-translation"
import { PodcastImportDialog } from "./podcast-import-dialog"
import { PodcastDrawer } from "./podcast-drawer"
import type { PodcastEpisode, PodcastShow } from "./podcast-types"

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins >= 60) {
    const hours = Math.floor(mins / 60)
    const remMins = mins % 60
    return `${hours}:${String(remMins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  }
  return `${mins}:${String(secs).padStart(2, "0")}`
}

export function PodcastLibraryPage() {
  const [episodes, setEpisodes] = useState<PodcastEpisode[]>([])
  const [shows, setShows] = useState<PodcastShow[]>([])
  const [activeTab, setActiveTab] = useState<"all" | "completed" | "uncompleted">("all")
  const [activeShowFilter, setActiveShowFilter] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  const { enabled: isTransEnabled, toggleTranslation, translations, batchTranslateTitles } =
    useTitleTranslation()

  // Load custom podcasts and shows from localStorage
  const reloadData = useCallback(() => {
    try {
      const storedEpisodes = localStorage.getItem("lexiflow_podcast_episodes")
      if (storedEpisodes) {
        setEpisodes(JSON.parse(storedEpisodes))
      }
      const storedShows = localStorage.getItem("lexiflow_podcast_shows")
      if (storedShows) {
        setShows(JSON.parse(storedShows))
      }
    } catch {}
  }, [])

  useEffect(() => {
    reloadData()
  }, [reloadData])

  // Auto-translate titles when enabled
  useEffect(() => {
    if (isTransEnabled && episodes.length > 0) {
      batchTranslateTitles(episodes.map((e) => e.title))
    }
  }, [isTransEnabled, episodes, batchTranslateTitles])

  const filteredEpisodes = useMemo(() => {
    return episodes.filter((item) => {
      if (activeShowFilter && item.showTitle !== activeShowFilter && item.showId !== activeShowFilter) {
        return false
      }
      if (activeTab === "completed" && (item.progressPercentage || 0) < 100) return false
      if (activeTab === "uncompleted" && (item.progressPercentage || 0) >= 100) return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const titleMatch = item.title.toLowerCase().includes(q)
        const showMatch = item.showTitle.toLowerCase().includes(q)
        const authorMatch = item.author.toLowerCase().includes(q)
        const transMatch = translations[item.title]?.toLowerCase().includes(q)
        if (!titleMatch && !showMatch && !authorMatch && !transMatch) return false
      }
      return true
    })
  }, [episodes, activeShowFilter, activeTab, searchQuery, translations])

  const handleImportSuccess = (newShow: PodcastShow, newEpisodes: PodcastEpisode[]) => {
    reloadData()
  }

  const handleRemoveShow = (showId: string) => {
    try {
      const updatedShows = shows.filter((s) => s.id !== showId)
      setShows(updatedShows)
      localStorage.setItem("lexiflow_podcast_shows", JSON.stringify(updatedShows))

      const targetShow = shows.find((s) => s.id === showId)
      if (targetShow) {
        const updatedEpisodes = episodes.filter((e) => e.showTitle !== targetShow.title)
        setEpisodes(updatedEpisodes)
        localStorage.setItem("lexiflow_podcast_episodes", JSON.stringify(updatedEpisodes))
      }

      if (activeShowFilter === showId) setActiveShowFilter(null)
    } catch {}
  }

  return (
    <div className="mx-auto flex w-full max-w-[1480px] flex-1 flex-col gap-6 px-4 pb-12 pt-3 md:px-6">
      {/* Top Bar - LexiFlow Single Row Native Layout */}
      <section className="flex flex-col gap-3.5 border-b border-border pb-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Left: Title & Sub-tabs */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold tracking-tight text-foreground">
              播客精听库
            </h1>
            <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-mono font-medium text-muted-foreground border border-border">
              {filteredEpisodes.length}
            </span>
          </div>

          <div className="flex items-center rounded-xl bg-muted p-1 text-xs font-medium border border-border">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`rounded-lg px-3 py-1 transition cursor-pointer ${
                activeTab === "all"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              全部单集
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("uncompleted")}
              className={`rounded-lg px-3 py-1 transition cursor-pointer ${
                activeTab === "uncompleted"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              未研习
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("completed")}
              className={`rounded-lg px-3 py-1 transition cursor-pointer ${
                activeTab === "completed"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              已掌握
            </button>
          </div>
        </div>

        {/* Right: Same-Row Compact Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setIsImportOpen(true)}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-foreground text-background px-3.5 text-xs font-semibold hover:opacity-90 active:scale-[0.98] transition cursor-pointer shadow-xs"
          >
            <PlusIcon className="size-3.5" />
            <span>添加播客</span>
          </button>

          {/* Title Translation Toggle [中/A] */}
          <button
            type="button"
            onClick={toggleTranslation}
            className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition cursor-pointer active:scale-[0.98] ${
              isTransEnabled
                ? "bg-foreground text-background border-foreground shadow-xs"
                : "bg-background border-border text-foreground hover:bg-muted"
            }`}
            title={isTransEnabled ? "已开启中文标题翻译，点击切回英文" : "点击开启中文标题翻译"}
          >
            <LanguagesIcon className="size-3.5" />
            <span>中 / A</span>
          </button>

          {/* Search Input */}
          <div className="relative w-full sm:w-56">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索播客或单集"
              className="h-9 w-full rounded-xl border border-border bg-background pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-foreground transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <XIcon className="size-3" />
              </button>
            )}
          </div>

          {/* Podcast Subscription Drawer Button */}
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 text-xs font-medium text-foreground hover:bg-muted transition active:scale-[0.98] cursor-pointer"
          >
            <SlidersHorizontalIcon className="size-3.5 text-muted-foreground" />
            <span>已订阅播客</span>
            {shows.length > 0 && (
              <span className="flex size-4.5 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-background">
                {shows.length}
              </span>
            )}
          </button>
        </div>
      </section>

      {/* Active Show Filter Pill */}
      {activeShowFilter && (
        <div className="flex items-center justify-between rounded-xl border border-border bg-muted/60 px-4 py-2 text-xs text-foreground">
          <div className="flex items-center gap-2">
            <HeadphonesIcon className="size-3.5 text-muted-foreground" />
            <span>
              正在筛选播客节目：<strong>{activeShowFilter}</strong>（共 {filteredEpisodes.length} 期）
            </span>
          </div>
          <button
            type="button"
            onClick={() => setActiveShowFilter(null)}
            className="inline-flex items-center gap-1 font-semibold underline underline-offset-2 hover:opacity-80 cursor-pointer text-xs"
          >
            <XIcon className="size-3" />
            <span>清除筛选</span>
          </button>
        </div>
      )}

      {/* Episode Grid - LexiFlow Minimalist Learning Cards */}
      <section>
        {filteredEpisodes.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-border p-8 text-center bg-card/40">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-muted border border-border text-muted-foreground">
              <HeadphonesIcon className="size-6" />
            </div>
            <h3 className="mt-3 text-sm font-semibold text-foreground">暂无播客内容</h3>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground leading-relaxed">
              支持一键收录 VOA Learning English、TED Talks Daily 或自定义 RSS 源，系统将实时抓取单集并切分为 2~8 秒双语精听流。
            </p>
            <button
              type="button"
              onClick={() => setIsImportOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-foreground text-background px-4 py-2 text-xs font-semibold hover:opacity-90 transition cursor-pointer"
            >
              <PlusIcon className="size-3.5" />
              <span>添加首条播客源</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredEpisodes.map((episode) => {
              const displayTitle =
                isTransEnabled && translations[episode.title]
                  ? translations[episode.title]
                  : episode.title

              return (
                <div
                  key={episode.id}
                  className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card p-4 transition hover:-translate-y-0.5 hover:shadow-md hover:border-foreground/20"
                >
                  {/* Poster / Thumbnail if available */}
                  {episode.coverUrl && (
                    <div className="relative aspect-[16/9] w-full mb-3 rounded-xl overflow-hidden bg-zinc-950">
                      <img
                        src={episode.coverUrl}
                        alt={episode.title}
                        className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute top-2 left-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-xs border border-white/10">
                        {episode.showTitle}
                      </div>
                      <div className="absolute bottom-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white backdrop-blur-xs border border-white/10">
                        {formatDuration(episode.durationSeconds)}
                      </div>
                    </div>
                  )}

                  {/* Top: Show & Tags */}
                  <div>
                    {!episode.coverUrl && (
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                        <span className="font-semibold text-foreground truncate max-w-[70%]">
                          {episode.showTitle}
                        </span>
                        <span className="font-mono text-[11px]">
                          {formatDuration(episode.durationSeconds)}
                        </span>
                      </div>
                    )}

                    {/* Title */}
                    <h3 className="line-clamp-2 text-sm font-bold text-foreground group-hover:text-primary transition leading-snug">
                      {displayTitle}
                    </h3>

                    {/* Bilingual Subtitle subtext when translated */}
                    {isTransEnabled && translations[episode.title] && (
                      <p className="mt-1 line-clamp-1 text-xs text-muted-foreground italic font-normal">
                        {episode.title}
                      </p>
                    )}

                    {/* Description excerpt */}
                    {episode.description && (
                      <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground leading-relaxed">
                        {episode.description}
                      </p>
                    )}

                    {/* Meta info: Author & WPM */}
                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="truncate">{episode.author}</span>
                      <span>·</span>
                      <span className="text-[11px]">{episode.pubDate}</span>
                      {episode.wpm && (
                        <>
                          <span>·</span>
                          <span className="font-mono text-[11px]">{episode.wpm} WPM</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Bottom: Progress & Enter Study */}
                  <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CheckCircle2Icon className="size-3.5 text-emerald-500" />
                      <span>音频就绪</span>
                    </div>

                    <a
                      href={episode.audioUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg bg-foreground text-background px-3 py-1 text-xs font-semibold hover:opacity-90 transition cursor-pointer"
                    >
                      <PlayIcon className="size-3 fill-current" />
                      <span>播放音频</span>
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Independent Import Dialog */}
      <PodcastImportDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        onSuccess={handleImportSuccess}
      />

      {/* Podcast Subscription Drawer */}
      <PodcastDrawer
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        shows={shows}
        activeShowFilter={activeShowFilter}
        onSelectShowFilter={setActiveShowFilter}
        onOpenAddPodcast={() => setIsImportOpen(true)}
        onRemoveShow={handleRemoveShow}
      />
    </div>
  )
}
