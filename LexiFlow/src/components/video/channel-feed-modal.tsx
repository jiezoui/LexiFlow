"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  CheckIcon,
  ExternalLinkIcon,
  Loader2Icon,
  PlayIcon,
  PlusIcon,
  RefreshCwIcon,
  TvIcon,
  XIcon,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { channelApi, type ChannelFeed, type ChannelFeedItem } from "@/lib/api-client"

interface ChannelFeedModalProps {
  channelId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onMediaImported?: () => void
  isTitleTransEnabled?: boolean
  titleTranslations?: Record<string, string>
}

export function ChannelFeedModal({
  channelId,
  open,
  onOpenChange,
  onMediaImported,
  isTitleTransEnabled = false,
  titleTranslations = {},
}: ChannelFeedModalProps) {
  const [feed, setFeed] = useState<ChannelFeed | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importingVideoId, setImportingVideoId] = useState<string | null>(null)
  const [importSuccessId, setImportSuccessId] = useState<string | null>(null)

  const loadFeed = useCallback(async (id: string, force = false) => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await channelApi.getFeed(id)
      setFeed(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取频道动态失败")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open && channelId) {
      void loadFeed(channelId)
    } else if (!open) {
      setFeed(null)
      setError(null)
      setImportingVideoId(null)
      setImportSuccessId(null)
    }
  }, [open, channelId, loadFeed])

  const handleImport = async (item: ChannelFeedItem) => {
    if (!channelId || item.isImported || importingVideoId) return
    setImportingVideoId(item.videoId)
    try {
      const media = await channelApi.importFeedVideo(channelId, item.videoId)
      // Update local feed item state
      setFeed((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          items: prev.items.map((it) =>
            it.videoId === item.videoId
              ? { ...it, isImported: true, mediaPublicId: media.id }
              : it
          ),
        }
      })
      setImportSuccessId(item.videoId)
      setTimeout(() => setImportSuccessId(null), 3000)
      onMediaImported?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "导入精听视频失败")
    } finally {
      setImportingVideoId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-full max-w-4xl max-h-[85vh] p-0 flex flex-col bg-background text-foreground border border-border shadow-2xl rounded-2xl overflow-hidden sm:max-w-4xl"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border bg-muted/40 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {feed?.avatarUrl ? (
              <img
                src={feed.avatarUrl}
                alt={feed.channelName}
                className="size-10 rounded-full object-cover border border-border shrink-0"
              />
            ) : (
              <div className="size-10 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground shrink-0">
                <TvIcon className="size-5" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base font-bold text-foreground truncate">
                  {feed?.channelName || "创作者最新动态"}
                </DialogTitle>
                {feed?.channelHandle && (
                  <span className="text-xs text-muted-foreground font-mono">
                    {feed.channelHandle}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                官方公共视频动态流 (最近 {feed?.items.length || 0} 条更新)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {channelId && (
              <a
                href={
                  feed?.channelHandle
                    ? `https://www.youtube.com/${feed.channelHandle}`
                    : `https://www.youtube.com/channel/${channelId}`
                }
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted border border-border transition cursor-pointer"
                title="在 YouTube 中打开原频道主页"
              >
                <span>前往频道</span>
                <ExternalLinkIcon className="size-3" />
              </a>
            )}

            {channelId && (
              <button
                type="button"
                onClick={() => void loadFeed(channelId, true)}
                disabled={isLoading}
                className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted border border-border transition cursor-pointer disabled:opacity-50"
                title="刷新动态"
              >
                <RefreshCwIcon className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
              </button>
            )}

            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
              aria-label="关闭"
            >
              <XIcon className="size-4.5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
              <p className="mt-3 text-xs">正在获取创作者最新视频动态...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm font-medium text-destructive">{error}</p>
              <button
                type="button"
                onClick={() => channelId && void loadFeed(channelId, true)}
                className="mt-3 rounded-lg border border-border px-3 py-1 text-xs text-foreground hover:bg-muted transition cursor-pointer"
              >
                重新加载
              </button>
            </div>
          ) : !feed || feed.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <TvIcon className="size-10 text-muted-foreground/50" />
              <p className="mt-3 text-sm font-medium text-foreground">暂无最新动态</p>
              <p className="mt-1 text-xs text-muted-foreground">该频道暂未发布公开视频或 RSS 暂未就绪</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {feed.items.map((item) => {
                const displayTitle =
                  isTitleTransEnabled && titleTranslations[item.title]
                    ? titleTranslations[item.title]
                    : item.title
                const isImporting = importingVideoId === item.videoId
                const isSuccessJustNow = importSuccessId === item.videoId

                return (
                  <div
                    key={item.videoId}
                    className="group relative flex flex-col rounded-xl border border-border bg-card overflow-hidden transition duration-200 hover:border-foreground/30 hover:shadow-md"
                  >
                    {/* Thumbnail 16:9 */}
                    <div className="relative aspect-video w-full overflow-hidden bg-zinc-950">
                      <img
                        src={item.thumbnailUrl}
                        alt={item.title}
                        className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                      {/* Published Time Badge */}
                      <div className="absolute bottom-2 right-2 rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-xs border border-white/10">
                        {item.relativeTimeText}
                      </div>
                      {/* In-library badge if already imported */}
                      {item.isImported && (
                        <div className="absolute top-2 left-2 flex items-center gap-1 rounded-md bg-emerald-950/80 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 backdrop-blur-xs border border-emerald-500/30">
                          <CheckIcon className="size-3" />
                          <span>已在库中</span>
                        </div>
                      )}
                    </div>

                    {/* Metadata & Actions */}
                    <div className="flex flex-1 flex-col justify-between p-4 gap-3">
                      <div>
                        <h4
                          className="line-clamp-2 text-xs font-semibold text-foreground leading-snug tracking-tight"
                          title={item.title}
                        >
                          {displayTitle}
                        </h4>
                        {item.description && (
                          <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground leading-relaxed">
                            {item.description}
                          </p>
                        )}
                      </div>

                      {/* Action Button */}
                      <div className="pt-2 border-t border-border flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {item.videoId}
                        </span>

                        {item.isImported ? (
                          <Link
                            href={item.mediaPublicId ? `/videos/${item.mediaPublicId}` : "/videos"}
                            className="flex items-center gap-1 rounded-lg bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 border border-border transition cursor-pointer"
                          >
                            <PlayIcon className="size-3" />
                            <span>进入精听</span>
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void handleImport(item)}
                            disabled={isImporting}
                            className={`flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-medium transition cursor-pointer ${
                              isSuccessJustNow
                                ? "bg-emerald-600 text-white"
                                : "bg-primary text-primary-foreground hover:bg-primary/90"
                            } disabled:opacity-50`}
                          >
                            {isImporting ? (
                              <>
                                <Loader2Icon className="size-3 animate-spin" />
                                <span>导入中...</span>
                              </>
                            ) : isSuccessJustNow ? (
                              <>
                                <CheckIcon className="size-3" />
                                <span>导入成功</span>
                              </>
                            ) : (
                              <>
                                <PlusIcon className="size-3" />
                                <span>导入精听</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
