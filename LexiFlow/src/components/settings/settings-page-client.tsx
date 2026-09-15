"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  UserIcon,
  ShieldIcon,
  BellIcon,
  PaletteIcon,
  LoaderIcon,
  MonitorIcon,
  SunIcon,
  MoonIcon,
  CheckIcon,
  SmartphoneIcon,
  LaptopIcon,
  TabletIcon,
  SparklesIcon,
} from "lucide-react"
import { GithubHeatmap } from "@/components/profile/github-heatmap"
import { AiSettingsTab } from "@/components/settings/ai-settings-tab"

type TabId = "profile" | "ai" | "security" | "notifications" | "appearance"

const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "profile", label: "个人中心", icon: <UserIcon className="size-4" /> },
  { id: "ai", label: "AI 助理与模型", icon: <SparklesIcon className="size-4 text-primary" /> },
  { id: "security", label: "账号安全", icon: <ShieldIcon className="size-4" /> },
  { id: "notifications", label: "研习提醒", icon: <BellIcon className="size-4" /> },
  { id: "appearance", label: "界面外观", icon: <PaletteIcon className="size-4" /> },
]

// ── Profile Tab ──────────────────────────────────────────────────────────────

function ProfileTab() {
  const [saving, setSaving] = React.useState(false)
  const [name, setName] = React.useState("Lin Z.")
  const [email, setEmail] = React.useState("lin@lexiflow.local")

  function handleSave() {
    setSaving(true)
    setTimeout(() => setSaving(false), 1200)
  }

  return (
    <div className="space-y-6">
      {/* 1. GitHub-style Contribution Heatmap */}
      <GithubHeatmap />

      {/* 2. Basic Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle>个人基本信息</CardTitle>
          <CardDescription>管理你的语脉研习者资料与本地偏好</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="size-16">
              <AvatarImage src="/avatars/user.jpg" alt="User avatar" />
              <AvatarFallback className="text-lg">LZ</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-foreground">{name}</p>
              <p className="text-sm text-muted-foreground">{email}</p>
              <span className="inline-block mt-1 text-[11px] font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded-full border border-border">
                离线优先个人工作区
              </span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="name">
                用户名 / 研习者昵称
              </label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="email">
                电子邮箱
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving && <LoaderIcon className="size-4 animate-spin" />}
              {saving ? "保存中..." : "保存资料"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Security Tab ─────────────────────────────────────────────────────────────

const mockSessions = [
  { device: "MacBook Pro", icon: <LaptopIcon className="size-4" />, location: "北京 · 当前设备", lastActive: "当前活跃" },
  { device: "iPhone 15", icon: <SmartphoneIcon className="size-4" />, location: "上海 · 移动端", lastActive: "2 小时前" },
  { device: "iPad Air", icon: <TabletIcon className="size-4" />, location: "广州 · 平板端", lastActive: "3 天前" },
]

function SecurityTab() {
  const [twoFA, setTwoFA] = React.useState(true)

  return (
    <div className="space-y-6">
      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle>修改登录密码</CardTitle>
          <CardDescription>
            定期更换安全密码以保护研习数据与生词本安全
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="current-pw">
              当前密码
            </label>
            <Input id="current-pw" type="password" placeholder="请输入当前密码" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="new-pw">
                新密码
              </label>
              <Input id="new-pw" type="password" placeholder="请输入新密码" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="confirm-pw">
                确认新密码
              </label>
              <Input id="confirm-pw" type="password" placeholder="请再次输入新密码" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button>更新密码</Button>
          </div>
        </CardContent>
      </Card>

      {/* Two-Factor */}
      <Card>
        <CardHeader>
          <CardTitle>双重身份验证 (2FA)</CardTitle>
          <CardDescription>
            为您的语脉研习账号添加二次验证保护
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {twoFA ? "已启用" : "已停用"}
              </p>
              <p className="text-sm text-muted-foreground">
                {twoFA
                  ? "您的账号已处于 2FA 双重身份验证保护中"
                  : "开启 2FA 可显著提升个人研习数据安全"}
              </p>
            </div>
            <Switch checked={twoFA} onCheckedChange={setTwoFA} />
          </div>
        </CardContent>
      </Card>

      {/* Sessions */}
      <Card>
        <CardHeader>
          <CardTitle>活跃登录设备</CardTitle>
          <CardDescription>
            查看并管理当前已登录该语脉账号的终端与客户端
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {mockSessions.map((s) => (
            <div
              key={s.device}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-full bg-muted">
                  {s.icon}
                </div>
                <div>
                  <p className="text-sm font-medium">{s.device}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.location} &middot; {s.lastActive}
                  </p>
                </div>
              </div>
              {s.lastActive !== "当前活跃" && (
                <Button variant="outline" size="sm">
                  下线设备
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Notifications Tab ────────────────────────────────────────────────────────

const notifToggles = [
  { id: "fsrs", label: "FSRS 抗遗忘临界唤醒", description: "当生词衰减触达 90% 期望召回目标阈值时主动提醒", default: true },
  { id: "daily", label: "每日研习打卡提醒", description: "每天 20:00 准时推送今日待复习生词队列与通量小结", default: true },
  { id: "push", label: "系统桌面即时推送", description: "在电脑桌面或移动端接收复习弹窗提示", default: true },
  { id: "security", label: "账号与数据安全通知", description: "异地登录、密码修改或数据导入导出事件提醒", default: true },
  { id: "digest", label: "每周研习认知周报", description: "每周日晚汇总记忆半衰期延伸曲线与多模态采词成果", default: true },
]

function NotificationsTab() {
  const [settings, setSettings] = React.useState<Record<string, boolean>>(
    () => Object.fromEntries(notifToggles.map((t) => [t.id, t.default]))
  )

  function toggle(id: string) {
    setSettings((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>研习提醒与消息偏好</CardTitle>
        <CardDescription>
          自由配置抗遗忘临界唤醒、每日打卡与数据简报推送频率
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {notifToggles.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between rounded-lg px-1 py-3"
          >
            <div className="space-y-0.5">
              <p className="text-sm font-medium">{t.label}</p>
              <p className="text-sm text-muted-foreground">{t.description}</p>
            </div>
            <Switch
              checked={settings[t.id]}
              onCheckedChange={() => toggle(t.id)}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// ── Appearance Tab ───────────────────────────────────────────────────────────

function AppearanceTab() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  const themes: { id: string; label: string; icon: React.ReactNode }[] = [
    { id: "light", label: "浅色模式 (极简纸感)", icon: <SunIcon className="size-5" /> },
    { id: "dark", label: "深色模式 (黑曜石)", icon: <MoonIcon className="size-5" /> },
    { id: "system", label: "跟随系统外观", icon: <MonitorIcon className="size-5" /> },
  ]

  if (!mounted) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>界面与主题外观</CardTitle>
        <CardDescription>
          自定义语脉在当前设备上的显示主题与视觉色彩系统
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-3">
          {themes.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t.id)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-lg border-2 p-6 transition-all hover:bg-muted/50",
                theme === t.id
                  ? "border-primary ring-2 ring-primary/20"
                  : "border-border"
              )}
            >
              {t.icon}
              <span className="text-sm font-medium">{t.label}</span>
              {theme === t.id && (
                <CheckIcon className="size-4 text-primary" />
              )}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ── Main Settings Page ───────────────────────────────────────────────────────

export function SettingsPageClient() {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get("tab")
  const [activeTab, setActiveTab] = React.useState<TabId>(
    tabs.some((t) => t.id === tabParam) ? (tabParam as TabId) : "profile"
  )

  const tabContent: Record<TabId, React.ReactNode> = {
    profile: <ProfileTab />,
    ai: <AiSettingsTab />,
    security: <SecurityTab />,
    notifications: <NotificationsTab />,
    appearance: <AppearanceTab />,
  }

  return (
    <div className="flex flex-1 flex-col gap-4 lg:flex-row lg:gap-6">
      {/* Left nav (desktop) */}
      <nav className="hidden w-52 shrink-0 flex-col gap-1 lg:flex">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? "secondary" : "ghost"}
            size="sm"
            className={cn(
              "justify-start gap-2",
              activeTab === tab.id && "font-semibold"
            )}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            {tab.label}
          </Button>
        ))}
      </nav>

      {/* Mobile tab bar */}
      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-2 lg:hidden">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? "secondary" : "ghost"}
            size="sm"
            className="shrink-0 gap-1.5 text-xs"
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Content — full width */}
      <div className="min-w-0 flex-1">{tabContent[activeTab]}</div>
    </div>
  )
}
