"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  LayoutDashboardIcon,
  BookOpenIcon,
  BookmarkCheckIcon,
  VideoIcon,
  BookMarkedIcon,
  SettingsIcon,
  LifeBuoyIcon,
  MoonIcon,
  SunIcon,
  MonitorIcon,
  SparklesIcon,
  ExternalLinkIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { wordbookApi, vocabApi, type Wordbook, type UserWordCard } from "@/lib/api-client"

const NAV_PAGES = [
  { label: "今日概览 (Today's Mission)", icon: LayoutDashboardIcon, href: "/dashboard" },
  { label: "词书库 (Wordbooks)", icon: BookOpenIcon, href: "/wordbooks" },
  { label: "生词本 (Vocabulary)", icon: BookmarkCheckIcon, href: "/vocab" },
  { label: "视频精听 (Video Shadowing)", icon: VideoIcon, href: "/videos" },
  { label: "阅读库 (Context Reading)", icon: BookMarkedIcon, href: "/reading" },
  { label: "偏好设置 (Settings)", icon: SettingsIcon, href: "/settings" },
  { label: "帮助与说明 (Support)", icon: LifeBuoyIcon, href: "/support" },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [realWordbooks, setRealWordbooks] = useState<Wordbook[]>([])
  const [realVocab, setRealVocab] = useState<UserWordCard[]>([])
  const router = useRouter()
  const { setTheme } = useTheme()

  useEffect(() => {
    if (open) {
      wordbookApi.list().then(setRealWordbooks).catch(() => {})
      vocabApi.listCards({ page: 1, size: 8 }).then(res => setRealVocab(res.records || [])).catch(() => {})
    }
  }, [open])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const run = useCallback(
    (fn: () => void) => {
      setOpen(false)
      fn()
    },
    []
  )

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="全局命令与语料搜索"
    >
      <CommandInput placeholder="输入命令、跳转页面或搜索生词库..." />
      <CommandList>
        <CommandEmpty>未找到相关指令或语料。</CommandEmpty>

        <CommandGroup heading="工作台导航">
          {NAV_PAGES.map((page) => (
            <CommandItem
              key={page.href}
              onSelect={() => run(() => router.push(page.href))}
            >
              <page.icon className="mr-2 size-4" />
              <span>{page.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {realVocab.length > 0 && (
          <>
            <CommandGroup heading="生词本快速定位">
              {realVocab.map((item) => (
                <CommandItem
                  key={item.id}
                  onSelect={() => run(() => router.push(`/vocab?search=${encodeURIComponent(item.lemma)}`))}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-foreground">{item.lemma}</span>
                    <span className="text-xs text-muted-foreground truncate max-w-[220px]">
                      {item.contextTranslation || "已收录"}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono rounded bg-accent px-1.5 py-0.5 text-primary">
                    {item.isKnown ? "已斩词" : `稳定性 ${item.stability}天`}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {realWordbooks.length > 0 && (
          <>
            <CommandGroup heading="词书库">
              {realWordbooks.map((book) => (
                <CommandItem
                  key={book.id}
                  onSelect={() => run(() => router.push(`/wordbooks?bookId=${book.id}`))}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <BookOpenIcon className="size-3.5 text-muted-foreground" />
                    <span className="font-medium text-sm">{book.title}</span>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {book.learnedWords || 0} / {book.totalWords} 词
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading="主题切换">
          <CommandItem onSelect={() => run(() => setTheme("light"))}>
            <SunIcon className="mr-2 size-4" />
            浅色模式（自然纸感）
          </CommandItem>
          <CommandItem onSelect={() => run(() => setTheme("dark"))}>
            <MoonIcon className="mr-2 size-4" />
            深色模式（深松墨黑）
          </CommandItem>
          <CommandItem onSelect={() => run(() => setTheme("system"))}>
            <MonitorIcon className="mr-2 size-4" />
            跟随系统
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
