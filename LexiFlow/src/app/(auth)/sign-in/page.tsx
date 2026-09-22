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
} from "lucide-react"
import { AuthVisualPanel } from "@/components/login/auth-visual-panel"
import { InteractiveHoverButton } from "@/components/ui/interactive-hover-button"
import { authApi, setToken } from "@/lib/api-client"

export default function SignInPage() {
  const [showPassword, setShowPassword] = React.useState(false)
  const [isTyping, setIsTyping] = React.useState(false)
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [isSuccess, setIsSuccess] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  /**
   * 登录：把账号密码提交到后端换取令牌，成功后写入本地并进入工作台。
   * 令牌由 api-client 统一携带，因此后续所有业务请求都会带上身份。
   */
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const result = await authApi.login(email.trim(), password)
      setToken(result.token)
      setIsSuccess(true)
      setTimeout(() => {
        window.location.replace("/dashboard")
      }, 400)
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法连接服务，请稍后重试")
      setIsLoading(false)
    }
  }

  return (
    /* 左黑右白的固定配色，不跟随全局明暗切换。
       右栏用 .auth-light 把主题变量重新声明为浅色值；
       同时必须显式声明 text-foreground —— 根布局 body 的颜色是按全局主题算好的，
       不重新声明的话，标题/标签/按钮文字会继承全局色，在固定底色上不可读。 */
    <div className="grid min-h-svh bg-white lg:grid-cols-[6fr_4fr]">
      <AuthVisualPanel
        isTyping={isTyping}
        showPassword={showPassword}
        passwordLength={password.length}
        tagline="多模态语境研习 · 把记忆交给 FSRS，把语感交给真实语境"
      />

      {/* ── 右侧登录表单 ── */}
      <div className="auth-light flex items-center justify-center bg-background px-5 py-12 text-foreground xl:px-10">
        <div className="w-full max-w-[420px]">
          {/* 移动端品牌 */}
          <div className="mb-12 flex items-center justify-center gap-2.5 lg:hidden">
            <div className="flex size-9 items-center justify-center overflow-hidden rounded-xl border border-border/40">
              <img src="/logo.png" alt="LexiFlow Logo" className="size-full object-cover" />
            </div>
            <span className="text-base font-bold text-foreground">语脉 · LexiFlow</span>
          </div>

          {/* 标题 */}
          <div className="mb-10 text-center">
            <h1 className="mb-2 text-3xl font-bold tracking-tight">欢迎回来</h1>
            <p className="text-sm text-muted-foreground">登入账号，继续你的研习进度</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                账号
              </label>
              <div className="relative">
                <MailIcon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="email"
                  name="email"
                  type="text"
                  inputMode="email"
                  autoComplete="off"
                  placeholder="用户名或 name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setIsTyping(true)}
                  onBlur={() => setIsTyping(false)}
                  required
                  className="h-12 w-full rounded-xl border border-border/60 bg-background pl-10 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary"
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
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="请输入登录密码"
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
              text={isLoading ? "登入中…" : isSuccess ? "登入成功" : "登入"}
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

          {/* 第三方登录入口（纯前端占位，尚未接入 OAuth） */}
          <div className="relative my-7 flex items-center">
            <div className="flex-1 border-t border-border" />
            <span className="mx-3 text-xs text-muted-foreground">或使用以下方式登录</span>
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

          {/* 注册入口 */}
          <p className="mt-8 text-center text-sm text-muted-foreground">
            还没有账号？{" "}
            <Link
              href="/sign-up"
              className="font-medium text-foreground underline-offset-4 transition-colors hover:underline"
            >
              注册新账号
            </Link>
          </p>

          <div className="mt-8 flex items-center justify-center gap-1.5 text-xs text-muted-foreground/60">
            <ShieldCheckIcon className="size-3.5" />
            <span>凭据经后端校验后再落库，不存放明文密码</span>
          </div>
        </div>
      </div>
    </div>
  )
}
