"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTheme } from "next-themes"
import {
  BellIcon,
  CheckIcon,
  LaptopIcon,
  LoaderIcon,
  MonitorIcon,
  MoonIcon,
  PaletteIcon,
  ShieldIcon,
  SmartphoneIcon,
  SparklesIcon,
  SunIcon,
  TabletIcon,
  UserIcon,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { AiSettingsTab } from "@/components/settings/ai-settings-tab"
import { GithubHeatmap } from "@/components/profile/github-heatmap"
import { cn } from "@/lib/utils"

type TabId = "profile" | "ai" | "security" | "notifications" | "appearance"

const tabs = [
  { id: "profile", label: "个人资料", icon: UserIcon },
  { id: "ai", label: "模型设置", icon: SparklesIcon },
  { id: "security", label: "账号安全", icon: ShieldIcon },
  { id: "notifications", label: "提醒", icon: BellIcon },
  { id: "appearance", label: "外观", icon: PaletteIcon },
] as const

function ProfileTab() {
  const [saving, setSaving] = React.useState(false)
  const [name, setName] = React.useState("Lin Z.")
  const [email, setEmail] = React.useState("lin@lexiflow.local")

  function handleSave() {
    setSaving(true)
    setTimeout(() => setSaving(false), 1200)
  }

  return (
    <div className="space-y-9">
      <section className="space-y-6">
        <div className="flex items-center gap-4">
          <Avatar className="size-14">
            <AvatarImage src="/avatars/user.jpg" alt="用户头像" />
            <AvatarFallback className="text-base">LZ</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-semibold">{name}</p>
            <p className="truncate text-sm text-muted-foreground">{email}</p>
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="settings-name" className="text-sm font-medium">昵称</label>
            <Input id="settings-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-2">
            <label htmlFor="settings-email" className="text-sm font-medium">邮箱</label>
            <Input id="settings-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <LoaderIcon className="size-4 animate-spin" />}
            {saving ? "保存中" : "保存"}
          </Button>
        </div>
      </section>
      <section className="border-t border-border/70 pt-7" aria-label="学习记录">
        <GithubHeatmap />
      </section>
    </div>
  )
}

const mockSessions = [
  { device: "MacBook Pro", icon: LaptopIcon, location: "北京 · 当前设备", lastActive: "当前活跃" },
  { device: "iPhone 15", icon: SmartphoneIcon, location: "上海 · 移动端", lastActive: "2 小时前" },
  { device: "iPad Air", icon: TabletIcon, location: "广州 · 平板端", lastActive: "3 天前" },
]

function SecurityTab() {
  const [twoFA, setTwoFA] = React.useState(true)

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h3 className="text-sm font-semibold">修改密码</h3>
        <div className="space-y-2">
          <label htmlFor="current-pw" className="text-sm font-medium">当前密码</label>
          <Input id="current-pw" type="password" autoComplete="current-password" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="new-pw" className="text-sm font-medium">新密码</label>
            <Input id="new-pw" type="password" autoComplete="new-password" />
          </div>
          <div className="space-y-2">
            <label htmlFor="confirm-pw" className="text-sm font-medium">确认密码</label>
            <Input id="confirm-pw" type="password" autoComplete="new-password" />
          </div>
        </div>
        <div className="flex justify-end"><Button>更新密码</Button></div>
      </section>
      <section className="border-t border-border/70 pt-6">
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="two-fa" className="text-sm font-semibold">双重验证</label>
          <Switch id="two-fa" checked={twoFA} onCheckedChange={setTwoFA} />
        </div>
      </section>
      <section className="space-y-1 border-t border-border/70 pt-6">
        <h3 className="pb-2 text-sm font-semibold">登录设备</h3>
        {mockSessions.map((session) => {
          const Icon = session.icon
          return (
            <div key={session.device} className="flex items-center justify-between gap-3 border-b border-border/60 py-3 last:border-b-0">
              <div className="flex min-w-0 items-center gap-3">
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{session.device}</p>
                  <p className="truncate text-xs text-muted-foreground">{session.location} · {session.lastActive}</p>
                </div>
              </div>
              {session.lastActive !== "当前活跃" && <Button variant="ghost" size="sm" className="shrink-0">下线</Button>}
            </div>
          )
        })}
      </section>
    </div>
  )
}

const notifToggles = [
  { id: "fsrs", label: "FSRS 复习提醒", default: true },
  { id: "daily", label: "每日学习提醒", default: true },
  { id: "push", label: "桌面通知", default: true },
  { id: "security", label: "账号安全通知", default: true },
  { id: "digest", label: "每周报告", default: true },
]

function NotificationsTab() {
  const [settings, setSettings] = React.useState<Record<string, boolean>>(
    () => Object.fromEntries(notifToggles.map((item) => [item.id, item.default])),
  )

  return (
    <div className="divide-y divide-border/70">
      {notifToggles.map((item) => (
        <div key={item.id} className="flex items-center justify-between gap-4 py-4 first:pt-0">
          <label htmlFor={`notification-${item.id}`} className="text-sm font-medium">{item.label}</label>
          <Switch
            id={`notification-${item.id}`}
            checked={settings[item.id]}
            onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, [item.id]: checked }))}
          />
        </div>
      ))}
    </div>
  )
}

function AppearanceTab() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  if (!mounted) return null

  const themes = [
    { id: "light", label: "浅色", icon: SunIcon },
    { id: "dark", label: "深色", icon: MoonIcon },
    { id: "system", label: "跟随系统", icon: MonitorIcon },
  ]

  return (
    <div role="radiogroup" aria-label="外观主题" className="divide-y divide-border/70">
      {themes.map((item) => {
        const Icon = item.icon
        return (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={theme === item.id}
            onClick={() => setTheme(item.id)}
            className="flex w-full items-center justify-between gap-4 py-4 text-left text-sm transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring first:pt-0"
          >
            <span className="flex items-center gap-3"><Icon className="size-4 text-muted-foreground" />{item.label}</span>
            {theme === item.id && <CheckIcon className="size-4" />}
          </button>
        )
      })}
    </div>
  )
}

export function SettingsPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get("tab")
  const activeTab: TabId = tabs.some((tab) => tab.id === tabParam) ? tabParam as TabId : "profile"
  const activeLabel = tabs.find((tab) => tab.id === activeTab)?.label

  const tabContent: Record<TabId, React.ReactNode> = {
    profile: <ProfileTab />,
    ai: <AiSettingsTab />,
    security: <SecurityTab />,
    notifications: <NotificationsTab />,
    appearance: <AppearanceTab />,
  }

  return (
    <div className="w-full pb-10">
      <div className="lg:grid lg:grid-cols-[184px_minmax(0,1fr)] lg:gap-6">
        <nav aria-label="设置分类" className="flex gap-1 overflow-x-auto border-b border-border/70 py-3 lg:block lg:space-y-1 lg:border-b-0 lg:py-7">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                type="button"
                aria-current={activeTab === tab.id ? "page" : undefined}
                onClick={() => router.replace(`/settings?tab=${tab.id}`, { scroll: false })}
                className={cn(
                  "flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:w-full",
                  activeTab === tab.id ? "bg-muted font-semibold text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />{tab.label}
              </button>
            )
          })}
        </nav>
        <main className="min-w-0 w-full max-w-[1520px] pt-6 lg:pt-7">
          <h2 className="mb-6 text-xl font-semibold tracking-tight">{activeLabel}</h2>
          {tabContent[activeTab]}
        </main>
      </div>
    </div>
  )
}
