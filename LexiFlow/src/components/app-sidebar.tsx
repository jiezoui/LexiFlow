"use client"

import * as React from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from "@/components/ui/sidebar"
import { authApi, getToken, vocabApi } from "@/lib/api-client"
import {
  BarChart3Icon,
  BookOpenIcon,
  BookmarkCheckIcon,
  BrainIcon,
  HeadphonesIcon,
  LayoutDashboardIcon,
  NewspaperIcon,
  PodcastIcon,
  SparklesIcon,
  TargetIcon,
  VideoIcon,
} from "lucide-react"

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const router = useRouter()
  const [vocabCount, setVocabCount] = React.useState<number | undefined>()
  const [user, setUser] = React.useState({ name: "用户", email: "", avatar: "" })

  React.useEffect(() => {
    let mounted = true
    if (getToken()) {
      void authApi.getMe()
        .then((profile) => {
          if (mounted) {
            setUser({
              name: profile.nickname || profile.username,
              email: profile.email,
              avatar: profile.avatar || "",
            })
          }
        })
        .catch(() => {})
    }
    return () => { mounted = false }
  }, [])

  React.useEffect(() => {
    let mounted = true
    const refreshCount = () => {
      void vocabApi.getOverview()
        .then((overview) => {
          if (mounted) setVocabCount(overview.totalWords)
        })
        .catch(() => {
          if (mounted) setVocabCount(undefined)
        })
    }

    refreshCount()
    window.addEventListener("lexiflow_wordbook_updated", refreshCount)
    window.addEventListener("focus", refreshCount)
    return () => {
      mounted = false
      window.removeEventListener("lexiflow_wordbook_updated", refreshCount)
      window.removeEventListener("focus", refreshCount)
    }
  }, [])

  const items = [
    { title: "今日概览", url: "/dashboard", icon: <LayoutDashboardIcon /> },
    { title: "学习计划", url: "/plan", icon: <TargetIcon /> },
    { title: "闪卡复习", url: "/cards", icon: <BrainIcon /> },
    { title: "词书库", url: "/wordbooks", icon: <BookOpenIcon /> },
    { title: "生词本", url: "/vocab", icon: <BookmarkCheckIcon />, badge: vocabCount },
    { title: "语境文章", url: "/reading/story", icon: <SparklesIcon /> },
    { title: "外刊研读", url: "/reading", icon: <NewspaperIcon /> },
    { title: "视频精听", url: "/videos", icon: <VideoIcon /> },
    { title: "影子跟读", url: "/practice/shadowing", icon: <HeadphonesIcon /> },
    { title: "播客订阅", url: "/podcasts", icon: <PodcastIcon /> },
    { title: "数据统计", url: "/dashboard/analytics", icon: <BarChart3Icon /> },
  ]

  return (
    <Sidebar variant="inset" {...props} className="border-r border-sidebar-border bg-sidebar">
      <SidebarHeader className="px-5 pb-4 pt-5">
        <div
          role="button"
          tabIndex={0}
          onClick={() => router.push("/dashboard")}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") router.push("/dashboard") }}
          className="flex cursor-pointer items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <Image src="/logo.png" alt="语脉 Logo" width={36} height={36} className="size-9 rounded-lg object-cover" />
          <span className="truncate text-[15px] font-bold tracking-tight text-sidebar-foreground">语脉 · LexiFlow</span>
        </div>
      </SidebarHeader>
      <SidebarContent className="px-3 pt-1">
        <NavMain items={items} />
        <div className="mt-auto px-4 pb-4 pt-6 text-muted-foreground/70">
          <div className="mb-4 h-px w-12 bg-sidebar-border" />
          <p className="text-xs leading-[1.5]">语言，<br />让你看见更大的世界。</p>
          <p className="mt-2 text-[10px]">A more fluent you.</p>
        </div>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border px-3 py-4">
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
