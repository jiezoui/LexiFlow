"use client"

import { useState } from "react"
import { LoaderCircleIcon } from "lucide-react"
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

export function YouTubeIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  )
}

export function YouTubeOutlineIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect width="20" height="15" x="2" y="4.5" rx="4" />
      <polygon points="10 9 15 12 10 15 10 9" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function YouTubeImportDialog({ open, onOpenChange, onSuccess }: YouTubeImportDialogProps) {
  const [url, setUrl] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed) return

    setIsSubmitting(true)
    setErrorMessage("")

    try {
      const result = await mediaApi.importYouTube(trimmed)
      setUrl("")
      setErrorMessage("")
      onOpenChange(false)
      onSuccess(result)
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "导入失败，请检查 YouTube 链接格式是否正确。"
      )
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
              placeholder="粘贴 YouTube 链接或输入视频 ID..."
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
                  className="flex items-center gap-1 rounded-lg bg-zinc-800/90 hover:bg-zinc-700/90 px-2.5 py-1 text-xs font-medium text-zinc-400 hover:text-zinc-200 border border-zinc-700/50 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed select-none active:scale-95"
                >
                  <span>Enter</span>
                  <span className="text-[10px]">↵</span>
                </button>
              )}
            </div>
          </div>

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
