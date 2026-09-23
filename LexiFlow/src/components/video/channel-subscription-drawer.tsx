"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Loader2Icon,
  PlusIcon,
  RadioIcon,
  SlidersHorizontalIcon,
  TvIcon,
  XIcon,
} from "lucide-react"
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet"
import {
  channelApi,
  type ChannelSubscription,
} from "@/lib/api-client"
import { ChannelFeedModal } from "@/components/video/channel-feed-modal"
import { ChannelSubscriptionDialog } from "@/components/video/channel-subscription-dialog"

interface ChannelSubscriptionDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  activeCreatorFilter: string | null
  onSelectCreatorFilter: (creator: string | null) => void
  onMediaImported?: () => void
  isTitleTransEnabled?: boolean
  titleTranslations?: Record<string, string>
}

function ChannelAvatar({
  avatarUrl,
  name,
}: {
  avatarUrl: string | null
  name: string
}) {
  const [imgError, setImgError] = useState(false)
  const initials = (name || "C")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("")

  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        onError={() => setImgError(true)}
        className="size-10 shrink-0 rounded-xl object-cover border border-border"
      />
    )
  }

  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-xs font-bold text-foreground border border-border">
      {initials || "C"}
    </div>
  )
}

export function ChannelSubscriptionDrawer({
  open,
  onOpenChange,
  activeCreatorFilter,
  onSelectCreatorFilter,
  onMediaImported,
  isTitleTransEnabled,
  titleTranslations,
}: ChannelSubscriptionDrawerProps) {
  const [subscriptions, setSubscriptions] = useState<ChannelSubscription[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [dialogMode, setDialogMode] = useState<"add" | "manage" | null>(null)
  const [isSubscribing, setIsSubscribing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionNotice, setActionNotice] = useState<string | null>(null)

  // Selected channel for feed modal
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null)
  const [isFeedModalOpen, setIsFeedModalOpen] = useState(false)

  const [isImportingOpml, setIsImportingOpml] = useState(false)

  const loadSubscriptions = useCallback(async () => {
    setIsLoading(true)
    try {
      const list = await channelApi.listSubscriptions()
      setSubscriptions(list)
    } catch {
      // Graceful fallback
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      void loadSubscriptions()
      setActionError(null)
      setActionNotice(null)
    }
  }, [open, loadSubscriptions])

  const openDialog = (mode: "add" | "manage") => {
    onOpenChange(false)
    setDialogMode(mode)
  }

  const handleSubscribe = async (inputToUse: string) => {
    const raw = inputToUse.trim()
    if (!raw) return false
    setIsSubscribing(true)
    setActionError(null)
    setActionNotice(null)
    try {
      const created = await channelApi.subscribe(raw)
      setSubscriptions((prev) => {
        const filtered = prev.filter((s) => s.channelId !== created.channelId)
        return [created, ...filtered]
      })
      setActionNotice(`已关注创作者: ${created.channelName}`)
      setTimeout(() => setActionNotice(null), 3000)
      return true
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "关注频道失败")
      return false
    } finally {
      setIsSubscribing(false)
    }
  }

  const handleUnsubscribe = async (channelId: string) => {
    setActionError(null)
    try {
      await channelApi.unsubscribe(channelId)
      setSubscriptions((prev) => prev.filter((s) => s.channelId !== channelId))
      setActionNotice("已取消订阅")
      if (activeCreatorFilter && subscriptions.find((s) => s.channelId === channelId)?.channelName.toLowerCase() === activeCreatorFilter.toLowerCase()) {
        onSelectCreatorFilter(null)
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "取消关注失败")
    }
  }

  const handleOpenFeed = (channelId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setSelectedChannelId(channelId)
    setIsFeedModalOpen(true)
  }

  const handleFilterCreator = (channelName: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (activeCreatorFilter?.toLowerCase() === channelName.toLowerCase()) {
      onSelectCreatorFilter(null)
    } else {
      onSelectCreatorFilter(channelName)
      onOpenChange(false)
    }
  }

  const handleOpmlImport = async (file: File) => {
    setIsImportingOpml(true)
    setActionError(null)
    try {
      const res = await channelApi.importOpml(file)
      setActionNotice(`成功批量导入 ${res.importedCount} 个订阅频道`)
      setTimeout(() => setActionNotice(null), 4000)
      void loadSubscriptions()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "OPML 导入失败")
    } finally {
      setIsImportingOpml(false)
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="w-full sm:max-w-md p-0 flex flex-col bg-background text-foreground border-l border-border shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="whitespace-nowrap text-base font-bold tracking-tight">订阅频道</h2>
              <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-bold text-background">{subscriptions.length}</span>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button type="button" onClick={() => openDialog("add")} className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-border px-2.5 text-xs font-medium transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="添加频道">
                <PlusIcon className="size-3.5 shrink-0 max-[360px]:hidden" /><span>添加</span>
              </button>
              <button type="button" onClick={() => openDialog("manage")} className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-border px-2.5 text-xs font-medium transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="管理频道">
                <SlidersHorizontalIcon className="size-3.5 shrink-0 max-[360px]:hidden" /><span>管理</span>
              </button>
              <button type="button" onClick={() => onOpenChange(false)} className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="关闭侧栏">
                <XIcon className="size-4" />
              </button>
            </div>
          </div>

          {/* Subscribed Channels List */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
            {isLoading && subscriptions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <Loader2Icon className="size-6 animate-spin" />
                <p className="mt-2 text-xs">正在加载订阅频道...</p>
              </div>
            ) : subscriptions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center px-4">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-muted border border-border text-muted-foreground">
                  <TvIcon className="size-6" />
                </div>
                <h3 className="mt-3 text-sm font-semibold text-foreground">暂无关注频道</h3>
                <p className="mt-1 text-xs text-muted-foreground max-w-xs leading-relaxed">
                  关注 YouTube 英语创作者后，可在此实时查看最新单集动态，一键导入精听库。
                </p>
                <button
                  type="button"
                  onClick={() => openDialog("add")}
                  className="mt-4 flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition cursor-pointer"
                >
                  <PlusIcon className="size-3.5" />
                  <span>添加首个频道</span>
                </button>
              </div>
            ) : (
              subscriptions.map((sub) => {
                const isFiltered =
                  activeCreatorFilter?.toLowerCase() === sub.channelName.toLowerCase()

                return (
                  <div
                    key={sub.channelId}
                    onClick={() => handleOpenFeed(sub.channelId)}
                    className={`group relative flex items-center justify-between rounded-xl border p-3 transition cursor-pointer ${
                      isFiltered
                        ? "border-foreground bg-muted/60 shadow-xs"
                        : "border-border bg-card hover:border-foreground/30 hover:bg-muted/30"
                    }`}
                  >
                    {/* Left: Avatar & Info */}
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <ChannelAvatar avatarUrl={sub.avatarUrl} name={sub.channelName} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-semibold text-foreground truncate">
                            {sub.channelName}
                          </h4>
                          {isFiltered && (
                            <span className="rounded-md bg-foreground px-1.5 py-0.2 text-[9px] font-bold text-background shrink-0">
                              筛选中
                            </span>
                          )}
                        </div>
                        {sub.channelHandle && <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">{sub.channelHandle}</p>}
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="ml-2 flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => handleFilterCreator(sub.channelName, e)}
                            className={`rounded-lg px-2 py-1 text-[11px] font-medium border transition cursor-pointer ${
                              isFiltered
                                ? "bg-foreground text-background border-foreground"
                                : "text-muted-foreground border-border hover:text-foreground hover:bg-muted"
                            }`}
                            title="在视频库中筛选该作者"
                          >
                            {isFiltered ? "清除" : "筛选"}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleOpenFeed(sub.channelId, e)}
                            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border transition cursor-pointer"
                            title="查看最新视频动态"
                          >
                            <RadioIcon className="size-3" />
                            <span>动态</span>
                          </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>

        </SheetContent>
      </Sheet>

      <ChannelSubscriptionDialog
        key={dialogMode ?? "closed"}
        mode={dialogMode}
        onOpenChange={(nextOpen) => { if (!nextOpen) setDialogMode(null) }}
        subscriptions={subscriptions}
        onSubscribe={handleSubscribe}
        onUnsubscribe={handleUnsubscribe}
        onImportOpml={handleOpmlImport}
        isSubscribing={isSubscribing}
        isImportingOpml={isImportingOpml}
        error={actionError}
        notice={actionNotice}
      />

      {/* Channel Feed Modal for dynamic video discovery */}
      <ChannelFeedModal
        channelId={selectedChannelId}
        open={isFeedModalOpen}
        onOpenChange={setIsFeedModalOpen}
        onMediaImported={() => {
          onMediaImported?.()
          void loadSubscriptions()
        }}
        isTitleTransEnabled={isTitleTransEnabled}
        titleTranslations={titleTranslations}
      />
    </>
  )
}
