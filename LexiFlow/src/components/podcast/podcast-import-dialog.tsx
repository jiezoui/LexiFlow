"use client"

import { useMemo, useState } from "react"
import { CheckIcon, LoaderCircleIcon, PlusIcon, RssIcon, SearchIcon, XIcon } from "lucide-react"
import { podcastApi, type PodcastFeed } from "@/lib/api-client"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import podcastCatalog from "@/data/podcast-discovery.json"

interface PodcastImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (show: PodcastFeed) => void
  subscriptions: PodcastFeed[]
}

const PODCAST_CATEGORIES = ["全部", "英语学习", "商业", "科技", "科学", "心理", "新闻", "文化"] as const

export function PodcastImportDialog({ open, onOpenChange, onSuccess, subscriptions }: PodcastImportDialogProps) {
  const [url, setUrl] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [category, setCategory] = useState<(typeof PODCAST_CATEGORIES)[number]>("全部")
  const [newlySubscribedUrls, setNewlySubscribedUrls] = useState<string[]>([])
  const subscribedUrls = useMemo(() =>
    new Set([...subscriptions.map((show) => show.feedUrl), ...newlySubscribedUrls]),
  [subscriptions, newlySubscribedUrls])
  const results = useMemo(() => {
    const normalized = searchQuery.trim().toLocaleLowerCase()
    return podcastCatalog.items.filter((show) =>
      (category === "全部" || show.category === category) &&
      (!normalized || `${show.title} ${show.author} ${show.description} ${show.latestTitle}`.toLocaleLowerCase().includes(normalized)))
  }, [category, searchQuery])

  const subscribe = async (feedUrl: string) => {
    setIsSubmitting(true)
    setErrorMessage("")
    try {
      const show = await podcastApi.subscribe(feedUrl)
      setNewlySubscribedUrls((previous) => [...previous, feedUrl])
      setUrl("")
      onSuccess?.(show)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "没有读到这个播客，请检查 RSS 地址后重试。")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = url.trim()
    if (!trimmed) return

    await subscribe(trimmed)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[min(90dvh,52rem)] flex-col overflow-hidden rounded-2xl border border-border bg-background p-0 text-foreground shadow-2xl sm:max-w-2xl"
      >
        <DialogHeader className="border-b border-border px-5 pb-4 pt-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-muted text-foreground">
                <RssIcon className="size-4" />
              </div>
              <div className="min-w-0 text-left">
                <DialogTitle className="text-base font-bold text-foreground">发现并订阅播客</DialogTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">选择领域或搜索节目，一键同步节目单</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="关闭添加播客"
            >
              <XIcon className="size-4" />
            </button>
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-border px-5 py-3">
            <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="搜索播客名称或主题"
              aria-label="搜索播客"
              className="h-8 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            {searchQuery && <button type="button" onClick={() => setSearchQuery("")} aria-label="清空播客搜索" className="rounded-md p-1 text-muted-foreground hover:bg-muted"><XIcon className="size-3.5" /></button>}
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-[7rem_minmax(0,1fr)] sm:grid-cols-[10rem_minmax(0,1fr)]">
            <nav aria-label="播客领域" className="flex flex-col gap-0.5 border-r border-border bg-muted/30 p-2 sm:p-3">
              {PODCAST_CATEGORIES.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={category === item}
                  onClick={() => { setCategory(item); setSearchQuery("") }}
                  className={`rounded-lg px-2.5 py-2 text-left text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${category === item ? "bg-foreground font-semibold text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                >
                  {item}
                </button>
              ))}
            </nav>
            <div className="min-h-52 max-h-96 overflow-y-auto p-2 sm:p-3">
              <p className="px-2 pb-2 text-[11px] text-muted-foreground">精选播客 · {results.length}</p>
              {results.length === 0 ? (
                <p className="px-3 py-8 text-center text-xs text-muted-foreground">本地目录里没有匹配节目，仍可在下方输入 RSS 地址。</p>
              ) : results.map((show) => {
                const subscribed = subscribedUrls.has(show.feedUrl)
                return (
                  <div key={show.id} className="flex items-start gap-3 rounded-lg px-2 py-3 hover:bg-muted/50">
                    <img src={show.image} alt={`${show.title} 播客封面`} loading="lazy" className="size-11 shrink-0 rounded-xl object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-foreground">{show.title}</p>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{show.author}{show.episodeCount > 0 ? ` · ${show.episodeCount} 期` : ""}</p>
                      {show.description && <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-muted-foreground">{show.description}</p>}
                      {show.latestTitle && <p className="mt-1 truncate text-[11px] text-muted-foreground/80">最近更新：{show.latestTitle}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => void subscribe(show.feedUrl)}
                      disabled={subscribed || isSubmitting}
                      aria-label={subscribed ? `已订阅 ${show.title}` : `订阅 ${show.title}`}
                      className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border text-foreground transition hover:bg-foreground hover:text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-45"
                    >
                      {subscribed ? <CheckIcon className="size-4" /> : <PlusIcon className="size-4" />}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-2 border-t border-border p-4 sm:p-5">
          <label htmlFor="podcast-feed-url" className="block text-xs font-semibold text-foreground">已有 RSS 地址？直接订阅</label>
          <div className="flex gap-2">
            <input
              id="podcast-feed-url"
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com/podcast/feed.xml"
              className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-xs text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              disabled={isSubmitting}
            />
            <button type="submit" disabled={!url.trim() || isSubmitting} className="rounded-xl bg-foreground px-3 text-xs font-semibold text-background hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40">
              {isSubmitting ? <LoaderCircleIcon className="size-4 animate-spin" /> : "订阅"}
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">订阅只同步节目单；选择单集精听时才会生成逐句文本。</p>
          {errorMessage && <p role="alert" className="text-xs text-destructive">{errorMessage}</p>}
        </form>
      </DialogContent>
    </Dialog>
  )
}
