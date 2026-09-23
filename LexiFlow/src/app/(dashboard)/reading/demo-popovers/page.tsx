"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ArrowLeftIcon,
  Volume2Icon,
  BookmarkIcon,
  BookmarkCheckIcon,
  SparklesIcon,
  BookOpenIcon,
  CopyIcon,
  CheckIcon,
  XIcon,
  Maximize2Icon,
  ExternalLinkIcon,
  SlidersHorizontalIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"

// Mock 查词数据用于对比验证
const MOCK_DATA = {
  word: "accelerate",
  phoneticUs: "/əkˈseləreɪt/",
  phoneticUk: "/əkˈseləreɪt/",
  sentence: "Technological innovations rapidly accelerate the transformation of modern research paradigms.",
  posDefs: [
    { pos: "vt.", meaning: "使加快，促进；增加…的速度" },
    { pos: "vi.", meaning: "加速，加快；增加速度" },
  ],
  contextMeaning: "在当前句中表示“加速推动（科研范式的转型）”，作谓语动词",
  cefr: "CET-4 / B2",
  freqRank: 2450,
  reps: 3,
  isHarvested: false,
}

export default function PopoverDemoShowcasePage() {
  const [selectedStyle, setSelectedStyle] = useState<"apple" | "linear" | "reader" | "compact">("apple")
  const [accent, setAccent] = useState<"us" | "uk">("us")
  const [harvested, setHarvested] = useState<boolean>(false)
  const [copied, setCopied] = useState<boolean>(false)

  const handleCopy = () => {
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const playAudio = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance(MOCK_DATA.word)
      u.lang = accent === "us" ? "en-US" : "en-GB"
      window.speechSynthesis.speak(u)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-8 p-4 sm:p-8 max-w-6xl mx-auto w-full">
      {/* 顶部导航 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1 text-xs text-muted-foreground">
            <Link href="/reading/story" className="hover:text-foreground flex items-center gap-1 transition-colors">
              <ArrowLeftIcon className="size-3" /> 语境研读
            </Link>
            <span>/</span>
            <span className="font-mono text-foreground font-semibold">UI LAB</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            查词浮窗 (Word Popover) 重构方案评选
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            我们设计了 4 种不同美学取向的轻量查词组件，已全部剔除彩色荧光标签与杂乱 Emoji，请对比视觉质感并挑选。
          </p>
        </div>

        {/* 风格切换标签 */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-card p-1">
          <button
            onClick={() => setSelectedStyle("apple")}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors font-medium ${
              selectedStyle === "apple" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            方案 A: 苹果词典极简风
          </button>
          <button
            onClick={() => setSelectedStyle("linear")}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors font-medium ${
              selectedStyle === "linear" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            方案 B: Linear 现代极客风
          </button>
          <button
            onClick={() => setSelectedStyle("reader")}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors font-medium ${
              selectedStyle === "reader" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            方案 C: Readwise 纸墨精读风
          </button>
          <button
            onClick={() => setSelectedStyle("compact")}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors font-medium ${
              selectedStyle === "compact" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            方案 D: 超轻量胶囊风
          </button>
        </div>
      </div>

      {/* 4 个 Demo 平铺横向全景对比 */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-foreground font-mono">
          全景效果对比 (四套方案静态横评)
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 items-start">
          {/* ============================================================
              方案 A: 苹果系统词典风 (Apple Dictionary Style)
              特点: 纯粹衬线排版，行内发音，极度克制，纸书印刷质感
          ============================================================ */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="font-bold text-primary">方案 A · 苹果词典极简风</span>
              <span className="text-[11px] text-muted-foreground">推荐</span>
            </div>
            <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-md space-y-3 relative text-foreground">
              {/* 词头与发音 */}
              <div className="flex items-start justify-between border-b border-border/40 pb-2.5">
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-serif font-bold tracking-tight text-foreground">
                      {MOCK_DATA.word}
                    </span>
                    <button
                      onClick={playAudio}
                      className="inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      title="点击发音"
                    >
                      <span>{accent === "us" ? MOCK_DATA.phoneticUs : MOCK_DATA.phoneticUk}</span>
                      <Volume2Icon className="size-3" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground mt-0.5">
                    <span className="cursor-pointer hover:underline" onClick={() => setAccent(accent === "us" ? "uk" : "us")}>
                      [{accent.toUpperCase()}] 切换
                    </span>
                    <span>·</span>
                    <span>{MOCK_DATA.cefr}</span>
                  </div>
                </div>

                <button
                  onClick={() => setHarvested(!harvested)}
                  className="rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                  title="加入生词本"
                >
                  {harvested ? <BookmarkCheckIcon className="size-4 text-primary" /> : <BookmarkIcon className="size-4" />}
                </button>
              </div>

              {/* 释义区 */}
              <div className="space-y-1.5 text-xs leading-relaxed">
                {MOCK_DATA.posDefs.map((d, i) => (
                  <div key={i} className="flex items-baseline gap-2">
                    <span className="font-serif italic font-semibold text-muted-foreground shrink-0 w-6">
                      {d.pos}
                    </span>
                    <span className="text-foreground/90">{d.meaning}</span>
                  </div>
                ))}
              </div>

              {/* 语境释义微栏 */}
              <div className="rounded-lg bg-muted/40 p-2 text-[11px] text-muted-foreground border-l-2 border-primary/50 leading-relaxed">
                <span className="font-semibold text-foreground">当前句义: </span>
                {MOCK_DATA.contextMeaning}
              </div>

              {/* 底部轻量信息 */}
              <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground pt-1 border-t border-border/40">
                <span>复习 {MOCK_DATA.reps} 次 · FSRS 正常</span>
                <span className="text-primary hover:underline cursor-pointer">AI 精解 →</span>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground leading-normal">
              <strong>设计哲学</strong>：苹果系统级排版，字体考究，中性低饱和度，如同翻阅实体柯林斯词典。
            </p>
          </div>

          {/* ============================================================
              方案 B: Linear 现代极客风 (Linear / HUD Style)
              特点: 毛玻璃微透，等宽字符，细边框，精致数据徽标
          ============================================================ */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="font-bold text-foreground">方案 B · Linear 现代极客风</span>
              <span className="text-[11px] text-muted-foreground">精致</span>
            </div>
            <div className="rounded-2xl border border-border bg-card/95 backdrop-blur-md p-4 shadow-lg space-y-3 relative text-foreground">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-mono text-base font-bold text-foreground tracking-tight">
                      {MOCK_DATA.word}
                    </h3>
                    <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[9px] font-semibold text-muted-foreground">
                      B2
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 font-mono text-[11px] text-muted-foreground">
                    <span className="cursor-pointer hover:text-foreground" onClick={playAudio}>
                      {MOCK_DATA.phoneticUs}
                    </span>
                    <button onClick={playAudio} className="p-0.5 hover:text-primary">
                      <Volume2Icon className="size-3" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={handleCopy}
                    className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    {copied ? <CheckIcon className="size-3.5 text-emerald-500" /> : <CopyIcon className="size-3.5" />}
                  </button>
                  <button
                    onClick={() => setHarvested(!harvested)}
                    className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
                  >
                    {harvested ? <BookmarkCheckIcon className="size-3.5 text-primary" /> : <BookmarkIcon className="size-3.5" />}
                  </button>
                </div>
              </div>

              {/* 释义卡片 */}
              <div className="rounded-xl border border-border/60 bg-muted/20 p-2.5 space-y-1.5">
                {MOCK_DATA.posDefs.map((d, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-xs">
                    <span className="font-mono text-[10px] font-bold text-primary shrink-0 bg-primary/10 px-1 rounded">
                      {d.pos}
                    </span>
                    <span className="text-foreground/90 text-[11px]">{d.meaning}</span>
                  </div>
                ))}
              </div>

              {/* 语境 */}
              <div className="text-[11px] font-mono text-muted-foreground flex items-center justify-between">
                <span>词频位: #{MOCK_DATA.freqRank}</span>
                <span className="rounded px-1 py-0.2 bg-secondary text-[10px]">语境动词</span>
              </div>

              {/* 底部按钮栏 */}
              <div className="flex items-center gap-2 pt-1 border-t border-border/40">
                <Button size="sm" variant="outline" className="h-7 text-[11px] font-mono flex-1 rounded-lg">
                  <BookOpenIcon className="size-3 mr-1" /> 词书详情
                </Button>
                <Button size="sm" className="h-7 text-[11px] font-mono flex-1 rounded-lg gap-1">
                  <SparklesIcon className="size-3" /> AI 语境分析
                </Button>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground leading-normal">
              <strong>设计哲学</strong>：Linear / Vercel 开发者风格，纯正工程美学，等宽字符与微交互层次分明。
            </p>
          </div>

          {/* ============================================================
              方案 C: Readwise 纸墨精读风 (Readwise Reader Style)
              特点: 深度阅读友好，卡片层次温润，专注阅读心流
          ============================================================ */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="font-bold text-foreground">方案 C · Readwise 纸墨精读风</span>
              <span className="text-[11px] text-muted-foreground">沉浸</span>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3 relative text-foreground">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-2">
                  <span className="text-base font-serif font-bold text-foreground">
                    {MOCK_DATA.word}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {MOCK_DATA.phoneticUs}
                  </span>
                </div>
                <button
                  onClick={() => setHarvested(!harvested)}
                  className={`text-xs font-medium px-2 py-0.5 rounded-md border transition-colors ${
                    harvested
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {harvested ? "已收藏" : "+ 生词本"}
                </button>
              </div>

              {/* 中英双解列表 */}
              <div className="space-y-2 text-xs border-y border-border/50 py-2">
                <div>
                  <span className="font-mono font-semibold text-muted-foreground mr-2">vt. / vi.</span>
                  <span className="font-medium text-foreground">加速，使加快，促进</span>
                </div>
                <p className="text-[11px] text-muted-foreground italic font-serif">
                  &ldquo;to happen or to make something happen faster or sooner&rdquo;
                </p>
              </div>

              {/* 句子高亮回放 */}
              <div className="text-[11px] leading-relaxed text-muted-foreground bg-muted/20 p-2 rounded-xl">
                <span className="text-foreground font-semibold">例句: </span>
                {MOCK_DATA.sentence}
              </div>

              <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                <span>朗读发音 (快捷键 V)</span>
                <span className="cursor-pointer hover:underline text-foreground">深入学习 ↗</span>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground leading-normal">
              <strong>设计哲学</strong>：Readwise / Medium 风格，提供英英权威双解与整句语境映射，专注沉浸精读。
            </p>
          </div>

          {/* ============================================================
              方案 D: 超轻量极简胶囊风 (Ultra-Compact Tooltip Style)
              特点: 极简极小，不遮挡正文视线，扫读极快
          ============================================================ */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="font-bold text-foreground">方案 D · 超轻量胶囊风</span>
              <span className="text-[11px] text-muted-foreground">极速</span>
            </div>
            <div className="rounded-xl border border-border bg-card p-3 shadow-md space-y-2 relative text-foreground">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-foreground">
                    {MOCK_DATA.word}
                  </span>
                  <button onClick={playAudio} className="text-muted-foreground hover:text-primary">
                    <Volume2Icon className="size-3.5" />
                  </button>
                </div>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {MOCK_DATA.phoneticUs}
                </span>
              </div>

              <p className="text-xs text-foreground/90 font-medium leading-snug">
                v. 加速，促进；增加…的速度
              </p>

              <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[10px] font-mono">
                <span
                  onClick={() => setHarvested(!harvested)}
                  className="cursor-pointer text-primary hover:underline"
                >
                  {harvested ? "✓ 已在生词本" : "+ 加入生词本"}
                </span>
                <span className="text-muted-foreground hover:text-foreground cursor-pointer">
                  AI语境义 →
                </span>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground leading-normal">
              <strong>设计哲学</strong>：深得 Google Dictionary / DeepL 浮动插件精髓，面积最小，扫读毫无遮挡感。
            </p>
          </div>
        </div>
      </div>

      {/* 实时动态沙盒测试区 */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground">
              交互沙盒测试 (在当前文章段落中预览您选择的样式)
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              上方点击切换【方案 A / B / C / D】，下方实时体验该样式在实际文本旁浮动展示的真实质感。
            </p>
          </div>
          <span className="font-mono text-xs px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground font-semibold">
            当前激活: {selectedStyle.toUpperCase()}
          </span>
        </div>

        {/* 模拟段落 */}
        <div className="rounded-xl border border-border/80 bg-background p-6 font-serif text-base leading-loose text-foreground/90 relative">
          <p>
            In modern scientific explorations, researchers must continually{" "}
            <span className="bg-primary/10 text-primary font-mono px-1 py-0.5 rounded cursor-pointer underline decoration-primary/40 font-semibold">
              accelerate
            </span>{" "}
            their multidisciplinary collaborations. By establishing a coherent{" "}
            <span className="bg-amber-500/10 text-foreground px-1 py-0.5 rounded border-b border-amber-500/30">
              arrangement
            </span>{" "}
            of shared data, scientists can create an uninterrupted{" "}
            <span className="bg-amber-500/10 text-foreground px-1 py-0.5 rounded border-b border-amber-500/30">
              flow
            </span>{" "}
            of valuable insights.
          </p>
        </div>
      </div>
    </div>
  )
}
