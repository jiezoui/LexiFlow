"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  CheckIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  FileTextIcon,
  Loader2Icon,
  PlusIcon,
  RadioIcon,
  RefreshCwIcon,
  SlidersHorizontalIcon,
  Trash2Icon,
  TvIcon,
  UploadIcon,
  XIcon,
} from "lucide-react"
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet"
import {
  channelApi,
  type ChannelSubscription,
  type MediaItem,
} from "@/lib/api-client"
import { ChannelFeedModal } from "@/components/video/channel-feed-modal"

interface ChannelSubscriptionDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mediaItems: MediaItem[]
  activeCreatorFilter: string | null
  onSelectCreatorFilter: (creator: string | null) => void
  onOpenYouTubeImport: () => void
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

const RECOMMENDED_CHANNELS = [
  { handle: "@TED", name: "TED" },
  { handle: "@BBCLearningEnglish", name: "BBC Learning English" },
  { handle: "@hubermanlab", name: "Huberman Lab" },
  { handle: "@vox", name: "Vox" },
  { handle: "@Kurzgesagt", name: "Kurzgesagt" },
]

export function ChannelSubscriptionDrawer({
  open,
  onOpenChange,
  mediaItems,
  activeCreatorFilter,
  onSelectCreatorFilter,
  onOpenYouTubeImport,
  onMediaImported,
  isTitleTransEnabled,
  titleTranslations,
}: ChannelSubscriptionDrawerProps) {
  const [subscriptions, setSubscriptions] = useState<ChannelSubscription[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isManageMode, setIsManageMode] = useState(false)
  const [isAddingChannel, setIsAddingChannel] = useState(false)
  const [channelInput, setChannelInput] = useState("")
  const [isSubscribing, setIsSubscribing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionNotice, setActionNotice] = useState<string | null>(null)

  // Selected channel for feed modal
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null)
  const [isFeedModalOpen, setIsFeedModalOpen] = useState(false)

  // OPML file input
  const opmlInputRef = useRef<HTMLInputElement>(null)
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

  const handleSubscribe = async (inputToUse?: string) => {
    const raw = (inputToUse || channelInput).trim()
    if (!raw) return
    setIsSubscribing(true)
    setActionError(null)
    setActionNotice(null)
    try {
      const created = await channelApi.subscribe(raw)
      setSubscriptions((prev) => {
        const filtered = prev.filter((s) => s.channelId !== created.channelId)
        return [created, ...filtered]
      })
      setChannelInput("")
      setIsAddingChannel(false)
      setActionNotice(`已关注创作者: ${created.channelName}`)
      setTimeout(() => setActionNotice(null), 3000)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "关注频道失败")
    } finally {
      setIsSubscribing(false)
    }
  }

  const handleUnsubscribe = async (channelId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await channelApi.unsubscribe(channelId)
      setSubscriptions((prev) => prev.filter((s) => s.channelId !== channelId))
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

  const handleOpmlFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
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
      if (opmlInputRef.current) opmlInputRef.current.value = ""
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
          <div className="px-5 pt-6 pb-4 border-b border-border bg-muted/30">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold tracking-tight text-foreground">
                    订阅频道
                  </h2>
                  <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-bold text-background">
                    {subscriptions.length}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  跟踪关注的 YouTube 创作者及专栏更新
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsAddingChannel(!isAddingChannel)}
                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer border ${
                    isAddingChannel
                      ? "bg-foreground text-background border-foreground"
                      : "text-muted-foreground border-border hover:text-foreground hover:bg-muted"
                  }`}
                  title="添加频道"
                >
                  <PlusIcon className="size-3.5" />
                  <span>添加</span>
                </button>

                {subscriptions.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsManageMode(!isManageMode)}
                    className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition cursor-pointer border ${
                      isManageMode
                        ? "bg-destructive text-destructive-foreground border-destructive"
                        : "text-muted-foreground border-border hover:text-foreground hover:bg-muted"
                    }`}
                    title="管理关注"
                  >
                    <SlidersHorizontalIcon className="size-3.5" />
                    <span>{isManageMode ? "完成" : "管理"}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
                  aria-label="关闭抽屉"
                >
                  <XIcon className="size-4.5" />
                </button>
              </div>
            </div>

            {/* Notification / Error banner */}
            {actionNotice && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-950/40 border border-emerald-500/30 px-3 py-1.5 text-xs text-emerald-300">
                <CheckIcon className="size-3.5 shrink-0" />
                <span className="truncate">{actionNotice}</span>
              </div>
            )}
            {actionError && (
              <div className="mt-3 flex items-center justify-between rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-1.5 text-xs text-destructive">
                <span className="truncate">{actionError}</span>
                <button
                  type="button"
                  onClick={() => setActionError(null)}
                  className="p-0.5 hover:opacity-75 cursor-pointer"
                >
                  <XIcon className="size-3.5" />
                </button>
              </div>
            )}

            {/* Add Channel Expandable Area */}
            {isAddingChannel && (
              <div className="mt-3 p-3 rounded-xl border border-border bg-card space-y-2.5">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={channelInput}
                    onChange={(e) => setChannelInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleSubscribe()
                    }}
                    placeholder="输入 @handle 或频道链接 (如 @TED)"
                    disabled={isSubscribing}
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-foreground"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => void handleSubscribe()}
                    disabled={isSubscribing || !channelInput.trim()}
                    className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition cursor-pointer disabled:opacity-50"
                  >
                    {isSubscribing ? (
                      <Loader2Icon className="size-3.5 animate-spin" />
                    ) : (
                      <span>关注</span>
                    )}
                  </button>
                </div>

                {/* Quick Recommendation Chips */}
                <div>
                  <p className="text-[11px] text-muted-foreground mb-1.5">快速关注精选英语频道：</p>
                  <div className="flex flex-wrap gap-1.5">
                    {RECOMMENDED_CHANNELS.map((ch) => (
                      <button
                        key={ch.handle}
                        type="button"
                        onClick={() => void handleSubscribe(ch.handle)}
                        disabled={isSubscribing}
                        className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-muted hover:border-foreground/30 transition cursor-pointer disabled:opacity-50"
                      >
                        {ch.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* OPML batch import button */}
                <div className="pt-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>支持从 YouTube 导出文件批量导入：</span>
                  <input
                    ref={opmlInputRef}
                    type="file"
                    accept=".opml,.xml"
                    onChange={(e) => void handleOpmlFileChange(e)}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => opmlInputRef.current?.click()}
                    disabled={isImportingOpml}
                    className="flex items-center gap-1 text-xs text-foreground font-medium hover:underline cursor-pointer disabled:opacity-50"
                  >
                    {isImportingOpml ? (
                      <Loader2Icon className="size-3 animate-spin" />
                    ) : (
                      <UploadIcon className="size-3" />
                    )}
                    <span>OPML 导入</span>
                  </button>
                </div>
              </div>
            )}
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
                  onClick={() => setIsAddingChannel(true)}
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
                    <div className="flex items-center gap-3 min-w-0">
                      <ChannelAvatar avatarUrl={sub.avatarUrl} name={sub.channelName} />
                      <div className="min-w-0">
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
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                          {sub.channelHandle && (
                            <span className="font-mono">{sub.channelHandle}</span>
                          )}
                          <span>·</span>
                          <span>{sub.importedCount} 个已在库</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {isManageMode ? (
                        <button
                          type="button"
                          onClick={(e) => void handleUnsubscribe(sub.channelId, e)}
                          className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10 transition cursor-pointer"
                          title="取消关注"
                        >
                          <Trash2Icon className="size-4" />
                        </button>
                      ) : (
                        <>
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
                        </>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Drawer Footer */}
          <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
            <span>官方 Atom/RSS 直连，免登录免配额</span>
            <button
              type="button"
              onClick={() => {
                onOpenChange(false)
                onOpenYouTubeImport()
              }}
              className="text-foreground font-medium hover:underline cursor-pointer"
            >
              直接导入视频单集
            </button>
          </div>
        </SheetContent>
      </Sheet>

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
