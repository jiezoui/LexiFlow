"use client"

import { useState } from "react"
import {
  VideoIcon,
  PlayIcon,
  PlusIcon,
  SparklesIcon,
  Volume2Icon,
  SubtitlesIcon,
  MicIcon,
  RotateCcwIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"

interface DemoVideo {
  id: string
  title: string
  source: string
  duration: string
  level: "B2" | "C1" | "C2"
  wpm: number
  vocabCount: number
  gradient: string
  currentSentence: string
  translation: string
}

const demoVideos: DemoVideo[] = [
  {
    id: "v-1",
    title: "The economics of attention · Lex Fridman #402",
    source: "YouTube",
    duration: "14:28",
    level: "C1",
    wpm: 155,
    vocabCount: 18,
    gradient: "linear-gradient(145deg, #d4e3d8 0%, #6c9180 50%, #254d46 100%)",
    currentSentence: "Algorithmic architecture should never provoke involuntary dopamine loops.",
    translation: "算法架构绝不应诱发非自主的多巴胺奖赏回路。",
  },
  {
    id: "v-2",
    title: "Andrew Huberman: Master Your Sleep and Circadian Rhythm",
    source: "Podcast / Bilibili",
    duration: "21:05",
    level: "B2",
    wpm: 142,
    vocabCount: 12,
    gradient: "linear-gradient(145deg, #d9e1d2 0%, #879c68 52%, #3e523a 100%)",
    currentSentence: "Circadian cues calibrate metabolic homeostasis through neural pathways.",
    translation: "昼夜节律线索通过神经通路精确校准人体的代谢稳态。",
  },
  {
    id: "v-3",
    title: "Steve Jobs Stanford Commencement Speech 2005",
    source: "Classic Archival",
    duration: "15:04",
    level: "B2",
    wpm: 130,
    vocabCount: 9,
    gradient: "linear-gradient(145deg, #e5d7c9 0%, #b58768 52%, #634b40 100%)",
    currentSentence: "You can't connect the dots looking forward; you can only connect them looking backwards.",
    translation: "你无法预见性地将点滴连结；只有在回溯过往时，它们才清晰成线。",
  },
]

export default function VideosPage() {
  const [videoUrl, setVideoUrl] = useState("")
  const [activeVideo, setActiveVideo] = useState<DemoVideo>(demoVideos[0])
  const [isPlaying, setIsPlaying] = useState(false)

  const handleImport = (e: React.FormEvent) => {
    e.preventDefault()
    if (!videoUrl) return
    alert(`已提交解析任务: ${videoUrl}\nWhisper 正在提取多语种时间轴并匹配生词库...`)
    setVideoUrl("")
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 pt-2 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div>
        <div className="text-[11px] font-mono tracking-wider text-primary font-semibold uppercase">
          Multimodal Immersion · 多模态音视频精听工作台
        </div>
        <h1 className="mt-0.5 text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
          视频精听与影子跟读
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
          基于 OpenAI Whisper 本地字幕对齐与 ECDICT 毫秒划词，在真实母语演讲中感受发音韵律。
        </p>
      </div>

      {/* Video Import Input Bar */}
      <form
        onSubmit={handleImport}
        className="flex flex-col sm:flex-row items-center gap-3 p-2.5 sm:p-3 rounded-2xl border border-border bg-card/85 backdrop-blur-sm shadow-sm"
      >
        <div className="relative flex-1 w-full">
          <VideoIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="粘贴 YouTube、Bilibili 或本地媒体链接 (如 https://www.bilibili.com/video/...)"
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-border bg-surface text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <Button
          type="submit"
          className="w-full sm:w-auto h-10 px-5 rounded-xl text-xs font-bold gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <SparklesIcon className="size-4" />
          解析字幕并采词
        </Button>
      </form>

      {/* Active Video Player & Cue Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Player Stage (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div
            className="relative aspect-video w-full rounded-3xl overflow-hidden shadow-md flex items-center justify-center text-white"
            style={{ background: activeVideo.gradient }}
          >
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="size-16 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center hover:scale-110 hover:bg-black/60 transition-all"
            >
              <PlayIcon className="size-7 fill-white translate-x-0.5" />
            </button>

            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs font-mono bg-black/50 backdrop-blur-sm px-4 py-2 rounded-xl">
              <span>02:14 / {activeVideo.duration}</span>
              <span className="rounded bg-primary/80 px-2 py-0.5 text-[10px] font-semibold text-white">
                Whisper 离线加速对齐 (1.0x)
              </span>
            </div>
          </div>

          {/* Active Cue subtitle card adhering strictly to 06-UI guidelines */}
          <div className="rounded-2xl border-l-4 border-l-primary border border-border bg-accent/20 p-5 backdrop-blur-sm transition-all">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
              <span className="flex items-center gap-1.5 font-bold text-primary">
                <SubtitlesIcon className="size-3.5" /> 当前同步英文字幕 (Active Cue)
              </span>
              <span>00:14.32</span>
            </div>

            <p className="mt-3 font-sans text-base sm:text-lg font-bold text-foreground leading-relaxed">
              Algorithmic architecture should never{" "}
              <mark className="rounded bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 text-foreground font-extrabold ring-1 ring-zinc-400 dark:ring-zinc-600 cursor-pointer" title="考纲重点词 · provoke [点击加生词本]">
                provoke
              </mark>{" "}
              involuntary dopamine loops.
            </p>

            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
              {activeVideo.translation}
            </p>

            <div className="mt-4 flex items-center gap-2 pt-3 border-t border-border/50">
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 rounded-lg">
                <RotateCcwIcon className="size-3" /> 重听当前句 (A)
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 rounded-lg">
                <MicIcon className="size-3 text-primary" /> 影子跟读评测 (Space)
              </Button>
            </div>
          </div>
        </div>

        {/* Right: Featured Video List (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          <div className="flex items-center justify-between pb-1">
            <h3 className="text-sm font-bold text-foreground">推荐精听语料</h3>
            <span className="text-xs text-muted-foreground font-mono">3 个语境集</span>
          </div>

          <div className="flex flex-col gap-3">
            {demoVideos.map((video) => (
              <div
                key={video.id}
                onClick={() => setActiveVideo(video)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  activeVideo.id === video.id
                    ? "border-primary bg-card/90 shadow-sm ring-1 ring-primary/20"
                    : "border-border bg-card/60 hover:bg-card/90 hover:border-border/80"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="size-10 rounded-xl shrink-0 flex items-center justify-center text-white"
                    style={{ background: video.gradient }}
                  >
                    <PlayIcon className="size-4 fill-current translate-x-0.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs sm:text-sm font-bold text-foreground truncate">
                      {video.title}
                    </h4>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                      <span>{video.duration}</span>
                      <span>•</span>
                      <span className="rounded bg-muted px-1.5 py-0.2 font-bold text-primary">
                        {video.level}
                      </span>
                      <span>•</span>
                      <span>{video.wpm} WPM</span>
                      <span>•</span>
                      <span className="text-warm font-semibold">+{video.vocabCount} 核心词</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
