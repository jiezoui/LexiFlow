"use client"

import { useMemo, useRef, useState } from "react"
import { CheckIcon, Loader2Icon, PlusIcon, SearchIcon, Trash2Icon, UploadIcon, XIcon } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { ChannelSubscription } from "@/lib/api-client"
import channelCatalog from "@/data/channel-discovery.json"

type DialogMode = "add" | "manage"

interface ChannelSubscriptionDialogProps {
  mode: DialogMode | null
  onOpenChange: (open: boolean) => void
  subscriptions: ChannelSubscription[]
  onSubscribe: (input: string) => Promise<boolean>
  onUnsubscribe: (channelId: string) => Promise<void>
  onImportOpml: (file: File) => Promise<void>
  isSubscribing: boolean
  isImportingOpml: boolean
  error: string | null
  notice: string | null
}

const CATEGORIES = ["全部", "英语学习", "科技", "科学", "商业", "文化"] as const
const RECOMMENDATIONS = channelCatalog.items

export function ChannelSubscriptionDialog({
  mode,
  onOpenChange,
  subscriptions,
  onSubscribe,
  onUnsubscribe,
  onImportOpml,
  isSubscribing,
  isImportingOpml,
  error,
  notice,
}: ChannelSubscriptionDialogProps) {
  const [input, setInput] = useState("")
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("全部")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const recommendations = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    return RECOMMENDATIONS.filter((channel) =>
      (category === "全部" || channel.category === category) &&
      (!normalized || `${channel.name} ${channel.handle} ${channel.description} ${channel.latestTitle}`.toLocaleLowerCase().includes(normalized)))
  }, [category, query])

  const managedSubscriptions = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    return subscriptions.filter((channel) =>
      !normalized || `${channel.channelName} ${channel.channelHandle ?? ""}`.toLocaleLowerCase().includes(normalized))
  }, [query, subscriptions])

  return (
    <Dialog open={mode !== null} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[min(88dvh,48rem)] flex-col gap-0 overflow-hidden rounded-2xl border border-border bg-background p-0 text-foreground shadow-2xl sm:max-w-2xl"
      >
        <DialogHeader className="flex-row items-center justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0 text-left">
            <DialogTitle className="text-base font-bold">{mode === "manage" ? "管理订阅频道" : "发现并订阅频道"}</DialogTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">{mode === "manage" ? `已订阅 ${subscriptions.length} 个频道` : "选择领域或输入频道地址"}</p>
          </div>
          <button type="button" onClick={() => onOpenChange(false)} aria-label="关闭频道弹窗" className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <XIcon className="size-4" />
          </button>
        </DialogHeader>

        {(error || notice) && (
          <div role={error ? "alert" : "status"} className={`mx-5 mt-3 rounded-lg px-3 py-2 text-xs ${error ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"}`}>
            {error || notice}
          </div>
        )}

        <div className="flex items-center gap-2 border-b border-border px-5 py-3">
          <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={mode === "manage" ? "搜索已订阅频道" : "搜索精选频道名称"}
            aria-label={mode === "manage" ? "搜索已订阅频道" : "搜索精选频道"}
            className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {query && <button type="button" onClick={() => setQuery("")} aria-label="清空搜索" className="rounded-md p-1 text-muted-foreground hover:bg-muted"><XIcon className="size-3.5" /></button>}
        </div>

        {mode === "manage" ? (
          <div className="min-h-52 overflow-y-auto p-3 sm:p-4">
            {managedSubscriptions.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">{subscriptions.length ? "没有匹配的频道" : "还没有订阅频道"}</p>
            ) : managedSubscriptions.map((channel) => (
              <div key={channel.channelId} className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-muted/50">
                {channel.avatarUrl ? <img src={channel.avatarUrl} alt="" className="size-10 shrink-0 rounded-xl object-cover" /> : <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-sm font-bold">{channel.channelName.slice(0, 1)}</div>}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{channel.channelName}</p>
                  {channel.channelHandle && <p className="truncate text-xs text-muted-foreground">{channel.channelHandle}</p>}
                </div>
                <button type="button" onClick={() => void onUnsubscribe(channel.channelId)} aria-label={`取消订阅 ${channel.channelName}`} className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-border px-3 text-xs font-medium text-destructive transition hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Trash2Icon className="size-3.5" />取消订阅
                </button>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="grid min-h-52 min-w-0 flex-1 grid-cols-[7rem_minmax(0,1fr)] overflow-hidden sm:grid-cols-[10rem_minmax(0,1fr)]">
              <nav aria-label="频道领域" className="flex flex-col gap-0.5 overflow-y-auto border-r border-border bg-muted/30 p-2 sm:p-3">
                {CATEGORIES.map((item) => (
                  <button key={item} type="button" aria-pressed={category === item} onClick={() => setCategory(item)} className={`rounded-lg px-2.5 py-2 text-left text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${category === item ? "bg-foreground font-semibold text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>{item}</button>
                ))}
              </nav>
              <div className="max-h-96 min-w-0 overflow-y-auto p-2 sm:p-3">
                <p className="px-2 pb-2 text-[11px] text-muted-foreground">精选频道 · {recommendations.length}</p>
                {recommendations.length === 0 ? (
                  <p className="px-3 py-8 text-center text-xs text-muted-foreground">精选列表里没有匹配频道，可在下方输入 @handle 或链接。</p>
                ) : recommendations.map((channel) => {
                  const subscribed = subscriptions.some((item) =>
                    item.channelHandle?.toLowerCase() === channel.handle.toLowerCase() ||
                    item.channelName.toLowerCase() === channel.name.toLowerCase())
                  return (
                    <div key={channel.id} className="flex items-start gap-3 rounded-lg px-2 py-3 hover:bg-muted/50">
                      <img src={channel.image} alt={`${channel.name} 频道头像`} loading="lazy" className="size-11 shrink-0 rounded-xl object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold">{channel.name}</p>
                        <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-muted-foreground">{channel.description || channel.handle}</p>
                        {channel.latestTitle && <p className="mt-1 truncate text-[11px] text-muted-foreground/80">最近更新：{channel.latestTitle}</p>}
                      </div>
                      <button type="button" onClick={() => void onSubscribe(channel.handle)} disabled={subscribed || isSubscribing} aria-label={subscribed ? `已订阅 ${channel.name}` : `订阅 ${channel.name}`} className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border transition hover:bg-foreground hover:text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-45">
                        {subscribed ? <CheckIcon className="size-4" /> : <PlusIcon className="size-4" />}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="space-y-3 border-t border-border p-4 sm:p-5">
              <form onSubmit={(event) => { event.preventDefault(); if (input.trim()) void onSubscribe(input.trim()).then((success) => { if (success) setInput("") }) }} className="flex min-w-0 gap-2">
                <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="输入 @handle 或 YouTube 频道链接" aria-label="频道地址" className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                <button type="submit" disabled={!input.trim() || isSubscribing} className="h-10 shrink-0 whitespace-nowrap rounded-xl bg-foreground px-4 text-xs font-semibold text-background hover:opacity-90 disabled:opacity-40">
                  {isSubscribing ? <Loader2Icon className="size-4 animate-spin" /> : "订阅"}
                </button>
              </form>
              <input ref={fileInputRef} type="file" accept=".opml,.xml" onChange={(event) => { const file = event.target.files?.[0]; if (file) void onImportOpml(file); event.target.value = "" }} className="sr-only" />
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isImportingOpml} className="inline-flex h-8 items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50">
                {isImportingOpml ? <Loader2Icon className="size-3.5 animate-spin" /> : <UploadIcon className="size-3.5" />}
                从 OPML 导入
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
