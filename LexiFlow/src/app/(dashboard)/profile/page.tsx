"use client"

import { GithubHeatmap } from "@/components/profile/github-heatmap"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { SettingsIcon } from "lucide-react"

export default function ProfilePage() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 pt-2 max-w-6xl mx-auto w-full">
      {/* ── 1. Profile Hero Card (GitHub Style) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 p-6 sm:p-8 rounded-3xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-5">
          <Avatar className="size-20 rounded-2xl border-2 border-border shadow-xs">
            <AvatarImage src="/avatars/user.jpg" alt="Lin Z." />
            <AvatarFallback className="text-xl font-bold bg-zinc-950 text-white dark:bg-white dark:text-zinc-950">
              LZ
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                Lin Z.
              </h1>
              <span className="rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs font-mono text-muted-foreground">
                @linz
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2.5 text-xs font-mono text-muted-foreground">
              <span>本地离线优先</span>
              <span className="text-muted-foreground/40">·</span>
              <span>加入于 2026 年 3 月</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/settings">
            <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-xl text-xs">
              <SettingsIcon className="size-3.5" />
              账号设置
            </Button>
          </Link>
        </div>
      </div>

      {/* ── 2. GitHub-Style 52-Week Contribution / Review Heatmap ── */}
      <GithubHeatmap />
    </div>
  )
}
