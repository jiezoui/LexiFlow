"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  CircleDotDashedIcon,
  ExternalLinkIcon,
  HeadphonesIcon,
  LanguagesIcon,
  LoaderCircleIcon,
  PlayIcon,
  PlusIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  XIcon,
} from "lucide-react"
import { podcastApi, type PodcastEpisode, type PodcastFeed } from "@/lib/api-client"
import { useTitleTranslation } from "@/lib/title-translation"
import { PodcastDrawer } from "./podcast-drawer"
import { PodcastImportDialog } from "./podcast-import-dialog"

function formatDuration(seconds: number | null): string {
  if (!seconds) return "时长待获取"
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins >= 60) return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  return `${mins}:${String(secs).padStart(2, "0")}`
}

function formatPublishedAt(value: string | null): string {
  if (!value) return "日期未知"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "日期未知"
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "short", day: "numeric" }).format(date)
}

function readableError(error: unknown): string {
  if (!(error instanceof Error)) return "播客库暂时无法加载，请稍后重试。"
  const message = error.message.trim()
  if (!message || /:\s*null$/i.test(message)) return "播客库暂时无法加载，请稍后重试。"
  return message
}

function episodeAction(episode: PodcastEpisode) {
  if (episode.mediaStatus === "PROCESSING") return { label: "查看转写进度", tone: "processing" as const }
  if (episode.mediaStatus === "FAILED") {
    return episode.mediaErrorMessage?.startsWith("SOURCE_AUDIO_UNAVAILABLE:")
      ? { label: "查看原因", tone: "failed" as const }
      : { label: "查看并重试", tone: "failed" as const }
  }
  if (episode.mediaStatus === "READY") {
    return episode.lastPositionSeconds > 0
      ? { label: `继续精听 · ${formatDuration(episode.lastPositionSeconds)}`, tone: "ready" as const }
      : { label: "进入精听", tone: "ready" as const }
  }
  return { label: "开始精听", tone: "new" as const }
}

function EpisodeStatus({ episode }: { episode: PodcastEpisode }) {
  if (episode.mediaStatus === "PROCESSING") {
    return <><LoaderCircleIcon className="size-3.5 animate-spin text-primary" /><span>正在生成精听文本</span></>
  }
  if (episode.mediaStatus === "FAILED") {
    const sourceUnavailable = episode.mediaErrorMessage?.startsWith("SOURCE_AUDIO_UNAVAILABLE:")
    return <><AlertCircleIcon className="size-3.5 text-destructive" /><span>{sourceUnavailable ? "原始音频不可用" : "处理失败"}</span></>
  }
  if (episode.mediaStatus === "READY") {
    return <><CheckCircle2Icon className="size-3.5 text-emerald-600 dark:text-emerald-400" /><span>{episode.completed ? "已完成" : "精听文本就绪"}</span></>
  }
  return <><CircleDotDashedIcon className="size-3.5" /><span>尚未生成精听文本</span></>
}

export function PodcastLibraryPage() {
  const [episodes, setEpisodes] = useState<PodcastEpisode[]>([])
  const [shows, setShows] = useState<PodcastFeed[]>([])
  const [activeTab, setActiveTab] = useState<"all" | "completed" | "uncompleted">("all")
  const [activeShowFilter, setActiveShowFilter] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState("")

  const { enabled: isTransEnabled, toggleTranslation, translations, batchTranslateTitles } = useTitleTranslation()

  const reloadData = useCallback(async () => {
    setLoadError("")
    try {
      const [nextEpisodes, nextShows] = await Promise.all([
        podcastApi.listEpisodes(),
        podcastApi.listSubscriptions(),
      ])
      setEpisodes(nextEpisodes)
      setShows(nextShows)
    } catch (error) {
      setLoadError(readableError(error))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { void reloadData() }, [reloadData])

  useEffect(() => {
    if (isTransEnabled && episodes.length > 0) void batchTranslateTitles(episodes.map((episode) => episode.title))
  }, [batchTranslateTitles, episodes, isTransEnabled])

  const activeShow = shows.find((show) => show.id === activeShowFilter)
  const filteredEpisodes = useMemo(() => episodes.filter((episode) => {
    if (activeShowFilter && episode.showId !== activeShowFilter) return false
    if (activeTab === "completed" && !episode.completed) return false
    if (activeTab === "uncompleted" && episode.completed) return false
    const query = searchQuery.trim().toLowerCase()
    if (!query) return true
    return [episode.title, episode.showTitle, episode.author || "", translations[episode.title] || ""]
      .some((value) => value.toLowerCase().includes(query))
  }), [activeShowFilter, activeTab, episodes, searchQuery, translations])

  const handleRemoveShow = async (showId: string) => {
    try {
      await podcastApi.unsubscribe(showId)
      if (activeShowFilter === showId) setActiveShowFilter(null)
      await reloadData()
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "取消订阅失败，请稍后重试。")
    }
  }

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[1480px] flex-1 flex-col gap-6 overflow-x-hidden px-4 pb-12 pt-3 md:px-6">
      <section className="flex flex-col gap-4 border-b border-border pb-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold tracking-tight text-foreground">播客精听库</h1>
            <span className="rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-xs font-medium text-muted-foreground">
              {filteredEpisodes.length}
            </span>
          </div>
          <div className="flex items-center rounded-xl border border-border bg-muted p-1 text-xs font-medium" role="tablist" aria-label="筛选播客单集">
            {([
              ["all", "全部单集"],
              ["uncompleted", "未完成"],
              ["completed", "已完成"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={activeTab === value}
                onClick={() => setActiveTab(value)}
                className={`min-h-8 rounded-lg px-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${activeTab === value
                  ? "bg-background font-semibold text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid w-full grid-cols-[auto_auto] items-center justify-start gap-2.5 xl:w-auto xl:grid-cols-[auto_auto_14rem_auto] xl:flex-none">
          <button
            type="button"
            onClick={() => setIsImportOpen(true)}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-foreground px-3.5 text-xs font-semibold text-background shadow-xs transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.98]"
          >
            <PlusIcon className="size-3.5" />
            <span>添加 RSS</span>
          </button>
          <button
            type="button"
            onClick={toggleTranslation}
            className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] ${isTransEnabled
              ? "border-foreground bg-foreground text-background shadow-xs"
              : "border-border bg-background text-foreground hover:bg-muted"
            }`}
            aria-pressed={isTransEnabled}
            title={isTransEnabled ? "显示英文原标题" : "翻译单集标题"}
          >
            <LanguagesIcon className="size-3.5" />
            <span>中 / A</span>
          </button>
          <div className="relative col-span-2 w-full xl:col-span-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="搜索节目或单集"
              aria-label="搜索节目或单集"
              className="h-10 w-full rounded-xl border border-border bg-background pl-8 pr-9 text-xs text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery("")} className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="清空搜索">
                <XIcon className="size-3.5" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 text-xs font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
          >
            <SlidersHorizontalIcon className="size-3.5 text-muted-foreground" />
            <span>订阅管理</span>
            {shows.length > 0 && <span className="flex size-5 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-background">{shows.length}</span>}
          </button>
        </div>
      </section>

      {activeShowFilter && (
        <div className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-muted/65 px-4 text-xs text-foreground">
          <div className="flex min-w-0 items-center gap-2">
            <HeadphonesIcon className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">正在查看 <strong>{activeShow?.title || "所选节目"}</strong>，共 {filteredEpisodes.length} 期</span>
          </div>
          <button type="button" onClick={() => setActiveShowFilter(null)} className="flex min-h-9 shrink-0 items-center gap-1 rounded-lg px-2 font-semibold hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <XIcon className="size-3" />清除筛选
          </button>
        </div>
      )}

      {loadError && episodes.length > 0 && (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
          <span>{loadError}</span>
          <button type="button" onClick={() => { setIsLoading(true); void reloadData() }} className="min-h-9 shrink-0 rounded-lg border border-destructive/30 px-3 text-xs font-semibold hover:bg-destructive/10">重新加载</button>
        </div>
      )}

      <section aria-busy={isLoading}>
        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((item) => <div key={item} className="h-80 animate-pulse rounded-2xl border border-border bg-muted/60" />)}
          </div>
        ) : loadError && episodes.length === 0 ? (
          <div role="alert" className="mx-auto flex min-h-80 w-full max-w-xl flex-col items-center justify-center px-6 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive"><AlertCircleIcon className="size-5" /></div>
            <h2 className="mt-4 text-sm font-bold text-foreground">播客库暂时无法加载</h2>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">{loadError}</p>
            <button type="button" onClick={() => { setIsLoading(true); void reloadData() }} className="mt-5 min-h-10 rounded-xl bg-foreground px-4 text-xs font-semibold text-background transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">重新加载</button>
          </div>
        ) : filteredEpisodes.length === 0 ? (
          <div className="mx-auto flex min-h-80 w-full max-w-xl flex-col items-center justify-center px-6 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground"><HeadphonesIcon className="size-5" /></div>
            <h2 className="mt-4 text-sm font-bold text-foreground">{episodes.length ? "没有符合条件的单集" : "还没有订阅播客"}</h2>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
              {episodes.length ? "清除筛选或换一个关键词试试。" : "添加公开 RSS，先同步节目单，再选择想学习的单集生成精听文本。"}
            </p>
            {!episodes.length && (
              <button type="button" onClick={() => setIsImportOpen(true)} className="mt-5 inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-foreground px-4 text-xs font-semibold text-background transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                <PlusIcon className="size-3.5" />添加首个 RSS
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredEpisodes.map((episode) => {
              const displayTitle = isTransEnabled && translations[episode.title] ? translations[episode.title] : episode.title
              const action = episodeAction(episode)
              return (
                <article key={episode.id} className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card transition duration-200 ease-out hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md">
                  <div className="relative aspect-[16/8.5] overflow-hidden bg-muted">
                    {episode.coverUrl ? (
                      <img src={episode.coverUrl} alt="" loading="lazy" className="size-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.025]" />
                    ) : (
                      <div className="flex size-full items-center justify-center"><HeadphonesIcon className="size-9 text-muted-foreground/45" /></div>
                    )}
                    <span className="absolute left-2 top-2 max-w-[75%] truncate rounded-md bg-zinc-950/75 px-2 py-1 text-[10px] font-semibold text-zinc-50">{episode.showTitle}</span>
                    <span className="absolute bottom-2 right-2 rounded-md bg-zinc-950/75 px-2 py-1 font-mono text-[10px] font-semibold text-zinc-50">{formatDuration(episode.durationSeconds)}</span>
                  </div>

                  <div className="flex flex-1 flex-col p-4">
                    <h2 className="line-clamp-2 text-sm font-bold leading-snug text-foreground">{displayTitle}</h2>
                    {isTransEnabled && translations[episode.title] && <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{episode.title}</p>}
                    {episode.description && <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{episode.description}</p>}
                    <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="truncate">{episode.author || episode.showTitle}</span><span aria-hidden="true">·</span><span className="shrink-0">{formatPublishedAt(episode.publishedAt)}</span>
                    </div>

                    <div className="mt-auto flex flex-col items-stretch gap-2.5 border-t border-border pt-3 xl:flex-row xl:items-center xl:justify-between">
                      <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground"><EpisodeStatus episode={episode} /></div>
                      <div className="flex min-w-0 items-center gap-1 xl:shrink-0">
                        <a href={episode.sourcePageUrl || episode.audioUrl} target="_blank" rel="noopener noreferrer" className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="打开原始节目页面" title="打开原始节目页面">
                          <ExternalLinkIcon className="size-3.5" />
                        </a>
                        <Link href={`/podcasts/${encodeURIComponent(episode.id)}`} className={`inline-flex min-h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 xl:flex-none ${action.tone === "failed"
                          ? "bg-destructive text-destructive-foreground hover:opacity-90"
                          : action.tone === "processing"
                            ? "border border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
                            : "bg-foreground text-background hover:opacity-90"
                        }`}>
                          {action.tone === "processing" ? <LoaderCircleIcon className="size-3 animate-spin" /> : <PlayIcon className="size-3 fill-current" />}
                          <span className="truncate">{action.label}</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <PodcastImportDialog key={isImportOpen ? "open" : "closed"} open={isImportOpen} onOpenChange={setIsImportOpen} onSuccess={() => void reloadData()} subscriptions={shows} />
      <PodcastDrawer
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        shows={shows}
        activeShowFilter={activeShowFilter}
        onSelectShowFilter={setActiveShowFilter}
        onOpenAddPodcast={() => setIsImportOpen(true)}
        onRemoveShow={(showId) => void handleRemoveShow(showId)}
        actionError={loadError}
      />
    </div>
  )
}
