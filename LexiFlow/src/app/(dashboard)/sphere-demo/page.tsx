import { Metadata } from "next"
import Link from "next/link"
import { ArrowLeftIcon, SparklesIcon, ExternalLinkIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ParticleWordSphere } from "@/components/auth/particle-word-sphere"

export const metadata: Metadata = {
  title: "3D 单词与字母粒子球体 Demo | 语脉 · LexiFlow",
  description: "基于 Fibonacci 球面分布、3D 空间自转与 ParticleText 粒子字形汇聚算法的独立演示",
}

export default function SphereDemoPage() {
  return (
    <div className="relative flex h-[calc(100vh-4rem)] w-full flex-col overflow-hidden rounded-2xl border bg-zinc-950 text-white shadow-2xl">
      {/* Top Header Controls */}
      <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-auto">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" render={<Link href="/sign-in" />} className="gap-1.5 border-white/20 bg-black/40 text-xs text-white backdrop-blur-md hover:bg-white/10 hover:text-white">
            <ArrowLeftIcon className="size-3.5" />
            返回登录页对比
          </Button>

          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300 backdrop-blur-md sm:flex">
            <SparklesIcon className="size-3.5 text-sky-400" />
            <span>3D 单词粒子球体 · 独立概念原型</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/sphere-demo.html"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md transition-colors hover:bg-white/20"
          >
            <span>新标签页全屏独立打开</span>
            <ExternalLinkIcon className="size-3" />
          </a>
        </div>
      </div>

      {/* Main 3D Particle Word Canvas */}
      <div className="relative flex-1 w-full h-full">
        <ParticleWordSphere
          className="w-full h-full"
          showControls={true}
          autoRotateSpeed={0.0032}
          interactive={true}
        />
      </div>
    </div>
  )
}
