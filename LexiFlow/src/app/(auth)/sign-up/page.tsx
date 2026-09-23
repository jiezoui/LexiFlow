"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import {
  MailIcon,
  LockIcon,
  EyeIcon,
  EyeOffIcon,
  Loader2Icon,
  CheckIcon,
  ShieldCheckIcon,
  UserIcon,
  AtSignIcon,
} from "lucide-react"
import { AuthVisualPanel } from "@/components/login/auth-visual-panel"
import { InteractiveHoverButton } from "@/components/ui/interactive-hover-button"
import { authApi } from "@/lib/api-client"

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,30}$/

export default function SignUpPage() {
  const [showPassword, setShowPassword] = React.useState(false)
  const [isTyping, setIsTyping] = React.useState(false)
  const [nickname, setNickname] = React.useState("")
  const [username, setUsername] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [isSuccess, setIsSuccess] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  /**
   * 注册：字段约束与后端 RegisterRequest 保持一致，
   * 前端先做一次校验是为了少一次往返，真正的判断仍以后端为准。
   */
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    if (!USERNAME_PATTERN.test(username.trim())) {
      setError("用户名需为 3-30 位的字母、数字或下划线")
      return
    }
    if (password.length < 6) {
      setError("密码长度不少于 6 位")
      return
    }

    setIsLoading(true)
    try {
      await authApi.register({
        username: username.trim(),
        email: email.trim(),
        password,
        nickname: nickname.trim() || undefined,
      })
      setIsSuccess(true)
      setTimeout(() => {
        window.location.replace("/sign-in")
      }, 900)
    } catch (err) {
      setError(err instanceof Error ? err.message : "注册失败，请稍后重试")
      setIsLoading(false)
    }
  }

  const inputClass =
    "h-12 w-full rounded-xl border border-border/60 bg-background pl-10 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary"

  return (
    /* 左黑右白的固定配色，不跟随全局明暗切换，与登录页保持一致 */
    <div className="grid min-h-svh bg-white lg:grid-cols-[6fr_4fr]">
      <AuthVisualPanel
        isTyping={isTyping}
        showPassword={showPassword}
        passwordLength={password.length}
        tagline="建号即开通 FSRS 记忆调度 · 生词本与多模态语料库随账号同步"
      />

      {/* ── 右侧注册表单 ── */}
      <div className="auth-light flex items-center justify-center bg-background px-5 py-12 text-foreground xl:px-10">
        <div className="w-full max-w-[420px]">
          <div className="mb-10 flex items-center justify-center gap-2.5 lg:hidden">
            <div className="flex size-9 items-center justify-center overflow-hidden rounded-xl border border-border/40">
              <img src="/logo.png" alt="LexiFlow Logo" className="size-full object-cover" />
            </div>
            <span className="text-base font-bold text-foreground">语脉 · LexiFlow</span>
          </div>

          <div className="mb-10 text-center">
            <h1 className="mb-2 text-3xl font-bold tracking-tight">创建账号</h1>
            <p className="text-sm text-muted-foreground">几分钟即可开始你的语境研习</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="nickname" className="text-sm font-medium">
                昵称 <span className="text-muted-foreground">（可选）</span>
              </label>
              <div className="relative">
                <UserIcon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="nickname"
                  type="text"
                  autoComplete="nickname"
                  placeholder="显示在个人主页的名字"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  onFocus={() => setIsTyping(true)}
                  onBlur={() => setIsTyping(false)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-medium">
                用户名
              </label>
              <div className="relative">
                <AtSignIcon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  placeholder="3-30 位字母、数字或下划线"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onFocus={() => setIsTyping(true)}
                  onBlur={() => setIsTyping(false)}
                  required
                  className={inputClass}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                邮箱
              </label>
              <div className="relative">
                <MailIcon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setIsTyping(true)}
                  onBlur={() => setIsTyping(false)}
                  required
                  className={inputClass}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                密码
              </label>
              <div className="relative">
                <LockIcon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="至少 6 位"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setIsTyping(true)}
                  onBlur={() => setIsTyping(false)}
                  required
                  className="h-12 w-full rounded-xl border border-border/60 bg-background pl-10 pr-11 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "隐藏密码" : "显示密码"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <InteractiveHoverButton
              type="submit"
              text={isLoading ? "创建中…" : isSuccess ? "创建成功，正在跳转" : "创建账号"}
              disabled={isLoading || isSuccess}
              className="h-12 w-full text-base font-medium disabled:cursor-not-allowed disabled:opacity-70"
              icon={
                isLoading ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : isSuccess ? (
                  <CheckIcon className="size-4" />
                ) : undefined
              }
            />
          </form>

          {/* 第三方注册入口（纯前端占位，尚未接入 OAuth） */}
          <div className="relative my-7 flex items-center">
            <div className="flex-1 border-t border-border" />
            <span className="mx-3 text-xs text-muted-foreground">或使用以下方式注册</span>
            <div className="flex-1 border-t border-border" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className="flex h-11 items-center justify-center gap-2 rounded-full border border-border bg-background text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Image src="/logos/google-com.png" alt="" width={16} height={16} className="size-4" />
              <span>Google</span>
            </button>
            <button
              type="button"
              className="flex h-11 items-center justify-center gap-2 rounded-full border border-border bg-background text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Image src="/logos/apple-com.png" alt="" width={16} height={16} className="size-4" />
              <span>Apple</span>
            </button>
          </div>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            已经有账号了？{" "}
            <Link
              href="/sign-in"
              className="font-medium text-foreground underline-offset-4 transition-colors hover:underline"
            >
              直接登入
            </Link>
          </p>

          <div className="mt-8 flex items-center justify-center gap-1.5 text-xs text-muted-foreground/60">
            <ShieldCheckIcon className="size-3.5" />
            <span>密码经后端加密存储，不会以明文落库</span>
          </div>
        </div>
      </div>
    </div>
  )
}
