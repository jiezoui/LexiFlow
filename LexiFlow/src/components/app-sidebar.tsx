"use client"

import * as React from "react"
import Link from "next/link"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  LayoutDashboardIcon,
  BookOpenIcon,
  BookmarkCheckIcon,
  VideoIcon,
  BookMarkedIcon,
  SettingsIcon,
  LifeBuoyIcon,
  SparklesIcon,
  BrainIcon,
  MicIcon,
} from "lucide-react"

const data = {
  user: {
    name: "Lin Z.",
    email: "lin@lexiflow.local",
    avatar: "/avatars/user.jpg",
  },
  navCore: [
    { title: "今日概览", url: "/dashboard", icon: <LayoutDashboardIcon className="size-4" /> },
    { title: "闪卡复习", url: "/cards", icon: <BrainIcon className="size-4" />, badge: "FSRS" },
    { title: "词书库", url: "/wordbooks", icon: <BookOpenIcon className="size-4" /> },
    { title: "生词本", url: "/vocab", icon: <BookmarkCheckIcon className="size-4" />, badge: 84 },
  ],
  navPractice: [
    { title: "影子跟读", url: "/practice/shadowing", icon: <MicIcon className="size-4" />, badge: "AI评测" },
  ],
  navContext: [
    { title: "视频精听", url: "/videos", icon: <VideoIcon className="size-4" /> },
    { title: "阅读库", url: "/reading", icon: <BookMarkedIcon className="size-4" /> },
  ],
  navSecondary: [
    { title: "系统设置", url: "/settings", icon: <SettingsIcon /> },
    { title: "帮助与反馈", url: "/support", icon: <LifeBuoyIcon /> },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar variant="inset" {...props} className="border-r border-border bg-sidebar/95 backdrop-blur-md">
      <SidebarHeader className="pt-4 pb-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/dashboard" />} className="hover:bg-secondary transition-colors">
              <div className="flex aspect-square size-8 items-center justify-center rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 shadow-sm">
                <SparklesIcon className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-extrabold tracking-tight text-[15px] text-foreground">
                    语脉 · LexiFlow
                  </span>
                  <span className="rounded border border-border bg-secondary px-1.5 py-0.2 font-mono text-[9px] font-bold text-foreground">
                    BETA
                  </span>
                </div>
                <span className="truncate text-[11px] text-muted-foreground">
                  多模态语境研习
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="px-1">
        <NavMain items={data.navCore} label="研习主线" />
        <NavMain items={data.navPractice} label="AI 算法工坊" />
        <NavMain items={data.navContext} label="真实语境" />
      </SidebarContent>

      <SidebarFooter className="border-t border-border pt-2 pb-3">
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
