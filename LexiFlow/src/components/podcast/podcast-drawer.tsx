"use client"

import { useState } from "react"
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet"
import {
  HeadphonesIcon,
  PlusIcon,
  XIcon,
  Trash2Icon,
  CheckIcon,
} from "lucide-react"
import type { PodcastShow } from "./podcast-types"

interface PodcastDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  shows: PodcastShow[]
  activeShowFilter: string | null
  onSelectShowFilter: (showId: string | null) => void
  onOpenAddPodcast: () => void
  onRemoveShow?: (showId: string) => void
}

export function PodcastDrawer({
  open,
  onOpenChange,
  shows,
  activeShowFilter,
  onSelectShowFilter,
  onOpenAddPodcast,
  onRemoveShow,
}: PodcastDrawerProps) {
  const [isManageMode, setIsManageMode] = useState(false)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full sm:max-w-md p-0 flex flex-col bg-background text-foreground border-l border-border shadow-xl"
      >
        <div className="px-5 pt-6 pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-foreground">
                已订阅播客
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                已订阅 {shows.length} 个节目
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {shows.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsManageMode(!isManageMode)}
                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer border ${
                    isManageMode
                      ? "bg-foreground text-background border-foreground"
                      : "text-muted-foreground border-border hover:text-foreground hover:bg-muted"
                  }`}
                >
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
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
          {shows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center px-4">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-muted border border-border text-muted-foreground">
                <HeadphonesIcon className="size-5" />
              </div>
              <h3 className="mt-3 text-sm font-semibold text-foreground">暂无订阅播客</h3>
              <p className="mt-1 text-xs text-muted-foreground max-w-xs leading-relaxed">
                输入 RSS 源或音频链接后，播客节目将在此归档，支持离线音频同步与双语字幕精听。
              </p>
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false)
                  onOpenAddPodcast()
                }}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-border bg-card hover:bg-muted px-3.5 py-1.5 text-xs font-semibold text-foreground transition cursor-pointer"
              >
                <PlusIcon className="size-3.5" />
                <span>添加播客</span>
              </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              {shows.map((show) => {
                const isSelected = activeShowFilter === show.id

                return (
                  <div
                    key={show.id}
                    onClick={() => {
                      onSelectShowFilter(isSelected ? null : show.id)
                      onOpenChange(false)
                    }}
                    className={`group relative flex items-center justify-between rounded-xl p-3 transition-colors cursor-pointer border ${
                      isSelected
                        ? "bg-muted border-foreground/30 shadow-xs"
                        : "bg-card border-border hover:bg-muted/60"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted border border-border text-foreground font-bold text-xs">
                        {show.title.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-foreground">
                          {show.title}
                        </span>
                        <span className="block text-xs text-muted-foreground mt-0.5">
                          {show.author} · {show.episodeCount} 期精听
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isSelected && (
                        <span className="flex items-center gap-1 rounded-md bg-foreground text-background px-2 py-0.5 text-[11px] font-medium">
                          <CheckIcon className="size-3" />
                          <span>已选</span>
                        </span>
                      )}
                      {isManageMode && onRemoveShow && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onRemoveShow(show.id)
                          }}
                          className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition cursor-pointer"
                          title="取消订阅"
                        >
                          <Trash2Icon className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border bg-card flex items-center justify-between">
          <span className="text-xs text-muted-foreground">收录新播客？</span>
          <button
            type="button"
            onClick={() => {
              onOpenChange(false)
              onOpenAddPodcast()
            }}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-background hover:bg-muted px-3 py-1.5 text-xs font-semibold text-foreground transition cursor-pointer"
          >
            <PlusIcon className="size-3.5" />
            <span>添加播客</span>
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
