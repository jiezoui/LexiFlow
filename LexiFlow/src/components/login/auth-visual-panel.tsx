"use client"

import * as React from "react"
import Link from "next/link"
import { AnimatedCharacters } from "@/components/login/animated-characters"

interface AuthVisualPanelProps {
  /** 表单获得焦点时角色会互相对视 */
  isTyping?: boolean
  /** 密码处于可见状态时，紫色角色会偷看 */
  showPassword?: boolean
  passwordLength?: number
  /** 底部一句话说明 */
  tagline: string
}

/**
 * 登录/注册页共用的左侧展示区：
 * 纯黑底 + 中心白色光晕，几何角色站在光里。两个页面共用一份，避免样式漂移。
 */
export function AuthVisualPanel({
  isTyping = false,
  showPassword = false,
  passwordLength = 0,
  tagline,
}: AuthVisualPanelProps) {
  return (
    <div className="relative hidden flex-col overflow-hidden bg-black p-8 lg:flex xl:p-10">
      {/* 中心白色光晕：把角色从纯黑里托出来 */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_62%,rgba(255,255,255,0.26),transparent_62%)]" />
      <div className="pointer-events-none absolute left-1/2 top-[58%] size-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/14 blur-[130px]" />
      <div className="pointer-events-none absolute left-1/2 top-[64%] size-[280px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 blur-[80px]" />
      {/* 细网格纹理 */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:22px_22px]" />

      {/* 品牌标识 */}
      <Link href="/dashboard" className="relative z-20 flex items-center gap-2.5">
        <div className="flex size-8 items-center justify-center overflow-hidden rounded-xl border border-white/20 bg-white/5 shadow-xs">
          <img src="/logo.png" alt="LexiFlow Logo" className="size-full object-cover" />
        </div>
        <span className="text-sm font-bold tracking-tight text-white">语脉 · LexiFlow</span>
      </Link>

      {/* 角色区：横向居中、纵向压在下方，留出上方呼吸空间。
          两个必须注意的点：
          1) 组件画布是 550×400，但角色只占左侧 450px，右侧 100px 是空白，
             用 -mr-[100px] 收掉，居中才算的是角色真实占用宽度，否则放大后左边缘会被裁。
          2) scale 只是视觉变换、不改变布局盒，若用默认 origin 放大后会向下溢出、
             压住底部文案；改成 origin-bottom 让放大只朝上生长，脚底始终贴住基线。 */}
      <div className="relative z-20 flex flex-1 items-end justify-center">
        <div className="origin-bottom scale-[1.35]">
          <div className="-mr-[100px]">
            <AnimatedCharacters
              isTyping={isTyping}
              showPassword={showPassword}
              passwordLength={passwordLength}
            />
          </div>
        </div>
      </div>

      <p className="relative z-30 max-w-sm text-xs leading-relaxed text-zinc-400">{tagline}</p>
    </div>
  )
}
