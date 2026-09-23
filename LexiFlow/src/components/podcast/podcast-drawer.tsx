"use client"

import { useState } from "react"
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  HeadphonesIcon,
  PlusIcon,
  XIcon,
  Trash2Icon,
  CheckIcon,
  SearchIcon,
  SlidersHorizontalIcon,
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
  actionError?: string
}

export function PodcastDrawer({
  open,
  onOpenChange,
  shows,
  activeShowFilter,
  onSelectShowFilter,
  onOpenAddPodcast,
  onRemoveShow,
  actionError,
}: PodcastDrawerProps) {
  const [manageOpen, setManageOpen] = useState(false)
  const [manageQuery, setManageQuery] = useState("")
  const managedShows = shows.filter((show) =>
    `${show.title} ${show.author ?? ""}`.toLocaleLowerCase().includes(manageQuery.trim().toLocaleLowerCase()))

  const openAdd = () => {
    onOpenChange(false)
    setManageOpen(false)
    onOpenAddPodcast()
  }

  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full sm:max-w-md p-0 flex flex-col bg-background text-foreground border-l border-border shadow-xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="whitespace-nowrap text-base font-bold tracking-tight">订阅播客</h2>
            <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-bold text-background">{shows.length}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button type="button" onClick={openAdd} className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-border px-2.5 text-xs font-medium transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <PlusIcon className="size-3.5 shrink-0 max-[360px]:hidden" />添加
            </button>
            <button type="button" onClick={() => { onOpenChange(false); setManageQuery(""); setManageOpen(true) }} className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-border px-2.5 text-xs font-medium transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <SlidersHorizontalIcon className="size-3.5 shrink-0 max-[360px]:hidden" />管理
            </button>
            <button type="button" onClick={() => onOpenChange(false)} className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="关闭侧栏">
              <XIcon className="size-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
          {shows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center px-4">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-muted border border-border text-muted-foreground">
                <HeadphonesIcon className="size-5" />
              </div>
              <h3 className="mt-3 text-sm font-semibold text-foreground">暂无订阅播客</h3>
              <button
                type="button"
                onClick={openAdd}
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
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted border border-border text-foreground font-bold text-xs">
                        {show.title.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-foreground">
                          {show.title}
                        </span>
                        {show.author && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{show.author}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isSelected && (
                        <span className="flex items-center gap-1 rounded-md bg-foreground text-background px-2 py-0.5 text-[11px] font-medium">
                          <CheckIcon className="size-3" />
                          <span>已选</span>
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </SheetContent>
    </Sheet>
    <Dialog open={manageOpen} onOpenChange={setManageOpen}>
      <DialogContent showCloseButton={false} className="flex max-h-[min(88dvh,48rem)] flex-col gap-0 overflow-hidden rounded-2xl border border-border bg-background p-0 text-foreground shadow-2xl sm:max-w-2xl">
        <DialogHeader className="flex-row items-center justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0 text-left">
            <DialogTitle className="text-base font-bold">管理订阅播客</DialogTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">已订阅 {shows.length} 个节目</p>
          </div>
          <button type="button" onClick={() => setManageOpen(false)} aria-label="关闭播客管理" className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><XIcon className="size-4" /></button>
        </DialogHeader>
        <div className="flex items-center gap-2 border-b border-border px-5 py-3">
          <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
          <input value={manageQuery} onChange={(event) => setManageQuery(event.target.value)} placeholder="搜索已订阅播客" aria-label="搜索已订阅播客" className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          {manageQuery && <button type="button" onClick={() => setManageQuery("")} aria-label="清空搜索" className="rounded-md p-1 text-muted-foreground hover:bg-muted"><XIcon className="size-3.5" /></button>}
        </div>
        {actionError && <p role="alert" className="mx-5 mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{actionError}</p>}
        <div className="min-h-52 overflow-y-auto p-3 sm:p-4">
          {managedShows.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">{shows.length ? "没有匹配的播客" : "还没有订阅播客"}</p>
          ) : managedShows.map((show) => (
            <div key={show.id} className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-muted/50">
              {show.coverUrl ? <img src={show.coverUrl} alt="" className="size-10 shrink-0 rounded-xl object-cover" /> : <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-xs font-bold">{show.title.slice(0, 2)}</div>}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{show.title}</p>
                {show.author && <p className="truncate text-xs text-muted-foreground">{show.author}</p>}
              </div>
              {onRemoveShow && <button type="button" onClick={() => onRemoveShow(show.id)} aria-label={`取消订阅 ${show.title}`} className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-border px-3 text-xs font-medium text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Trash2Icon className="size-3.5" />取消订阅</button>}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
    </>
  )
}
