"use client"

import { useState } from "react"
import { LoaderCircleIcon, VideoIcon } from "lucide-react"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import { mediaApi, type MediaItem } from "@/lib/api-client"

interface YouTubeImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (item: MediaItem) => void
}

function normalizeVideoInput(value: string): string {
  const trimmed = value.trim()
  const sharedUrl = trimmed.match(/https?:\/\/[^\s<>，。！？]+/i)?.[0]
  if (sharedUrl) return sharedUrl.replace(/[)\]}]+$/, "")
  const sharedBvid = trimmed.match(/(?:^|[^A-Za-z0-9])(BV[0-9A-Za-z]{10})(?![A-Za-z0-9])/)
  return sharedBvid?.[1] || trimmed
}

export function YouTubeIcon({ className = "size-4" }: { className?: string }) {
  return <VideoIcon className={className} aria-hidden="true" />
}

export function YouTubeOutlineIcon({ className = "size-5" }: { className?: string }) {
  return <VideoIcon className={className} aria-hidden="true" />
}

export function YouTubeImportDialog({ open, onOpenChange, onSuccess }: YouTubeImportDialogProps) {
  const [url, setUrl] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = normalizeVideoInput(url)
    if (!trimmed) return

    setIsSubmitting(true)
    setErrorMessage("")

    try {
      const result = await mediaApi.importExternal(trimmed)
      setUrl("")
      setErrorMessage("")
      onOpenChange(false)
      onSuccess(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : "导入失败，请检查视频链接格式。"
      setErrorMessage(/youtube|youtu\.be/i.test(message) ? "该视频链接暂时无法导入，请稍后重试。" : message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-2xl p-0 bg-transparent border-0 shadow-none ring-0 focus-visible:outline-none"
      >
        <form onSubmit={handleSubmit} className="relative w-full">
          <div className="relative flex items-center w-full h-14 rounded-2xl bg-[#1e1e20]/95 dark:bg-[#18181b]/95 backdrop-blur-2xl border border-white/10 dark:border-zinc-800 shadow-2xl shadow-black/80 px-4 transition-all focus-within:border-white/20 focus-within:ring-2 focus-within:ring-white/10">
            {/* YouTube Icon */}
            <div className="flex items-center justify-center text-zinc-400 dark:text-zinc-500 shrink-0 mr-3">
              <YouTubeOutlineIcon className="size-5.5" />
            </div>

            {/* Input Field */}
            <input
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                if (errorMessage) setErrorMessage("")
              }}
              onPaste={(event) => {
                const pasted = event.clipboardData.getData("text/plain")
                const normalized = normalizeVideoInput(pasted)
                if (normalized !== pasted.trim()) {
                  event.preventDefault()
                  setUrl(normalized)
                  setErrorMessage("")
                }
              }}
              placeholder="粘贴 B站分享链接、BV 号或已支持的视频链接..."
              className="flex-1 bg-transparent text-sm sm:text-base text-zinc-100 placeholder:text-zinc-500 outline-none border-none font-normal selection:bg-rose-500/30"
              autoFocus
              disabled={isSubmitting}
            />

            {/* Enter Badge / Loading Spinner */}
            <div className="flex items-center shrink-0 ml-2">
              {isSubmitting ? (
                <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-medium px-2 py-1">
                  <LoaderCircleIcon className="size-4 animate-spin text-zinc-300" />
                  <span>导入中...</span>
                </div>
              ) : (
                <button
                  type="submit"
                  disabled={!url.trim()}
                  className="flex items-center gap-1 rounded-lg border border-zinc-600 bg-white/10 px-2.5 py-1 text-xs font-semibold text-zinc-100 transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30 active:scale-95"
                >
                  <span>导入</span>
                </button>
              )}
            </div>
          </div>

          {!errorMessage && (
            <p className="mt-2 px-2 text-xs text-zinc-500">
              {/^BV[0-9A-Za-z]{10}$/.test(normalizeVideoInput(url)) || /(?:^|\.)bilibili\.com|b23\.tv/i.test(normalizeVideoInput(url))
                ? "已识别 B站视频；导入后可上传 SRT/VTT 字幕进行逐句精听。"
                : "支持 B站 BV 号、分享链接和已接入来源的视频链接。"}
            </p>
          )}

          {/* Minimalist error message right beneath the bar */}
          {errorMessage && (
            <div className="mt-2.5 rounded-xl bg-destructive/15 border border-destructive/30 px-3.5 py-2 text-xs text-rose-300 backdrop-blur-md shadow-lg animate-in fade-in slide-in-from-top-1 flex items-center justify-between">
              <span>{errorMessage}</span>
              <button
                type="button"
                onClick={() => setErrorMessage("")}
                className="text-rose-400 hover:text-rose-200 text-xs ml-2 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}
