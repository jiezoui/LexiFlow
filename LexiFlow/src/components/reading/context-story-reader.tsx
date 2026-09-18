"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeftIcon,
  Volume2Icon,
  VolumeXIcon,
  LanguagesIcon,
  CheckIcon,
  Loader2Icon,
  RotateCcwIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  type ContextStoryDetail,
  type ContextStoryWord,
  contextStoryApi,
} from "@/lib/api-client"
import { WordLookupPopover } from "@/components/reading/word-lookup-popover"

interface ContextStoryReaderProps {
  story: ContextStoryDetail
  onBack?: () => void
}

interface ParsedToken {
  type: "text" | "target"
  text: string
  surface?: string
  lemma?: string
}

export function ContextStoryReader({ story, onBack }: ContextStoryReaderProps) {
  const router = useRouter()

  // 读者标记陌生的目标词集合
  const [tappedLemmas, setTappedLemmas] = useState<Set<string>>(new Set())

  // 双语对照显示开关
  const [showTranslation, setShowTranslation] = useState<boolean>(false)

  // 语音朗读播放状态
  const [isPlayingTts, setIsPlayingTts] = useState<boolean>(false)

  // 单词查词浮窗
  const [lookupTarget, setLookupTarget] = useState<{
    word: string
    sentence: string
    paragraphText?: string
    paragraphTranslation?: string
    rect: DOMRect | null
  } | null>(null)

  // 结算提交状态
  const [submittingFeedback, setSubmittingFeedback] = useState<boolean>(false)
  const [isCompleted, setIsCompleted] = useState<boolean>(false)

  // 开始阅读计时
  const startTimeRef = useRef<number>(Date.now())

  // 解析包含 [[surface|lemma]] 的段落
  const parsedParagraphs = useMemo(() => {
    const rawContent = story.contentMarked || story.contentClean || ""
    const paragraphs = rawContent.split(/\n\s*\n/)

    return paragraphs.map((p) => {
      const tokens: ParsedToken[] = []
      const regex = /\[\[([^\|\]]+)\|([^\|\]]+)\]\]/g
      let lastIdx = 0
      let match: RegExpExecArray | null

      while ((match = regex.exec(p)) !== null) {
        if (match.index > lastIdx) {
          tokens.push({
            type: "text",
            text: p.substring(lastIdx, match.index),
          })
        }
        tokens.push({
          type: "target",
          text: match[1],
          surface: match[1],
          lemma: match[2].toLowerCase().trim(),
        })
        lastIdx = regex.lastIndex
      }

      if (lastIdx < p.length) {
        tokens.push({
          type: "text",
          text: p.substring(lastIdx),
        })
      }

      return {
        tokens,
        cleanText: p.replace(/\[\[([^\|\]]+)\|([^\|\]]+)\]\]/g, "$1"),
      }
    })
  }, [story.contentMarked, story.contentClean])

  // 提取单句上下文
  const extractSentence = (fullText: string, word: string) => {
    if (!fullText) return word
    const sentences = fullText.split(/(?<=[.!?]["'”’]?)\s+/)
    if (sentences.length <= 1) return fullText.trim()
    const cleanW = word.toLowerCase().replace(/[^a-z0-9]/gi, "")
    const regex = new RegExp(`\\b${cleanW}\\b`, "i")
    const matched =
      sentences.find((s) => regex.test(s)) ||
      sentences.find((s) => s.toLowerCase().includes(cleanW))
    return matched ? matched.trim() : fullText.trim()
  }

  // 点击正文中任意普通单词
  const handleWordClick = (
    rawWord: string,
    paragraphText: string,
    paragraphIndex: number,
    e: React.MouseEvent<HTMLElement>
  ) => {
    e.stopPropagation()
    const clean = rawWord.trim().replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, "")
    if (!clean || clean.length < 1) return
    const rect = e.currentTarget.getBoundingClientRect()
    const sentence = extractSentence(paragraphText, clean)
    const pTranslation = story.translationCn?.split(/\n\s*\n/)[paragraphIndex]?.trim() || ""
    setLookupTarget({
      word: clean,
      sentence,
      paragraphText,
      paragraphTranslation: pTranslation,
      rect,
    })
  }

  // 点击目标生词
  const handleTargetWordClick = (
    surface: string,
    lemma: string,
    paragraphText: string,
    paragraphIndex: number,
    e: React.MouseEvent<HTMLElement>
  ) => {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    const sentence = extractSentence(paragraphText, surface || lemma)
    const pTranslation = story.translationCn?.split(/\n\s*\n/)[paragraphIndex]?.trim() || ""

    setLookupTarget({
      word: lemma || surface,
      sentence,
      paragraphText,
      paragraphTranslation: pTranslation,
      rect,
    })

    // 记录为需加固词
    setTappedLemmas((prev) => {
      const next = new Set(prev)
      next.add(lemma.toLowerCase())
      return next
    })
  }

  // 切换目标词的掌握状态
  const toggleLemmaTapped = (lemma: string) => {
    const key = lemma.toLowerCase()
    setTappedLemmas((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  // 原生 Web Speech API 朗读
  const handleToggleTts = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      alert("当前浏览器暂不支持语音合成朗读")
      return
    }

    if (isPlayingTts) {
      window.speechSynthesis.cancel()
      setIsPlayingTts(false)
      return
    }

    const textToRead = story.contentClean || story.contentMarked?.replace(/\[\[([^\|\]]+)\|([^\|\]]+)\]\]/g, "$1") || ""
    if (!textToRead) return

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(textToRead)
    utterance.lang = "en-US"
    utterance.rate = 0.95

    utterance.onstart = () => setIsPlayingTts(true)
    utterance.onend = () => setIsPlayingTts(false)
    utterance.onerror = () => setIsPlayingTts(false)

    window.speechSynthesis.speak(utterance)
  }

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  // 提交研读反馈至 FSRS 记忆引擎
  const handleSubmitFeedback = async () => {
    if (submittingFeedback) return
    setSubmittingFeedback(true)

    try {
      const durationSeconds = Math.max(10, Math.round((Date.now() - startTimeRef.current) / 1000))
      await contextStoryApi.feedback(story.publicId, {
        tappedLemmas: Array.from(tappedLemmas),
        readingDurationSeconds: durationSeconds,
      })
      setIsCompleted(true)
    } catch (err) {
      console.error("提交研读反馈失败:", err)
    } finally {
      setSubmittingFeedback(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 max-w-5xl mx-auto w-full">
      {/* 顶部导航与控制条 */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack || (() => router.push("/reading/story"))}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground h-8 px-2.5 rounded-lg"
          >
            <ArrowLeftIcon className="size-3.5" />
            返回列表
          </Button>
          <div className="h-4 w-px bg-border" />
          <span className="text-xs font-mono font-medium text-muted-foreground">
            {story.targetLevel} · {story.wordCount} 词
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleTts}
            className={`gap-1.5 rounded-lg text-xs h-8 px-3 ${
              isPlayingTts ? "border-primary bg-primary/10 text-primary" : ""
            }`}
          >
            {isPlayingTts ? <VolumeXIcon className="size-3.5" /> : <Volume2Icon className="size-3.5" />}
            {isPlayingTts ? "停止朗读" : "朗读"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTranslation(!showTranslation)}
            className={`gap-1.5 rounded-lg text-xs h-8 px-3 ${
              showTranslation ? "border-primary bg-primary/10 text-primary" : ""
            }`}
          >
            <LanguagesIcon className="size-3.5" />
            {showTranslation ? "隐藏翻译" : "双语对照"}
          </Button>
        </div>
      </div>

      {/* 沉浸式阅读正文 */}
      <article className="rounded-2xl border border-border bg-card p-6 sm:p-10 shadow-xs">
        <header className="border-b border-border/60 pb-5 mb-7">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            {story.title}
          </h1>
          <p className="mt-1.5 text-xs text-muted-foreground font-mono">
            {story.topic} · 目标难度 {story.targetLevel} · 点击正文任意单词查词
          </p>
        </header>

        {/* 文章段落：全词可点击，目标词淡雅标记 */}
        <div className="space-y-6 text-[16px] sm:text-[17px] text-foreground/90 font-serif leading-relaxed tracking-normal">
          {parsedParagraphs.map(({ tokens, cleanText }, pIdx) => (
            <div key={pIdx} className="space-y-2.5">
              <p className="leading-loose">
                {tokens.map((token, tIdx) => {
                  if (token.type === "target" && token.lemma) {
                    const isTapped = tappedLemmas.has(token.lemma.toLowerCase())
                    return (
                      <span
                        key={tIdx}
                        onClick={(e) =>
                          handleTargetWordClick(token.surface || token.text, token.lemma!, cleanText, pIdx, e)
                        }
                        title={`目标词: ${token.lemma}`}
                        className={`inline rounded-xs px-1 py-0.5 mx-0.5 cursor-pointer transition-colors select-text ${
                          isTapped
                            ? "bg-amber-500/15 text-foreground border-b border-amber-500/40 hover:bg-amber-500/25"
                            : "bg-amber-500/8 text-foreground border-b border-amber-500/25 hover:bg-amber-500/18"
                        }`}
                      >
                        {token.surface || token.text}
                      </span>
                    )
                  }

                  // 普通文本段落分词：每一个单词均可点击查词
                  const subTokens = token.text.split(/([a-zA-Z]+(?:'[a-zA-Z]+)?)/g)
                  return (
                    <span key={tIdx}>
                      {subTokens.map((chunk, wIdx) => {
                        const isWord = /^[a-zA-Z]+('[a-zA-Z]+)?$/.test(chunk)
                        if (isWord) {
                          return (
                            <span
                              key={wIdx}
                              onClick={(e) => handleWordClick(chunk, cleanText, pIdx, e)}
                              className="cursor-pointer rounded-xs px-0.5 hover:bg-primary/10 hover:text-primary transition-colors select-text"
                            >
                              {chunk}
                            </span>
                          )
                        }
                        return <span key={wIdx}>{chunk}</span>
                      })}
                    </span>
                  )
                })}
              </p>

              {/* 中文翻译对照：无外框无多余标签，直接自然排布在英文段落下方 */}
              {showTranslation && story.translationCn && (
                <p className="text-sm font-sans text-muted-foreground/80 leading-relaxed pt-0.5 select-text">
                  {story.translationCn.split(/\n\s*\n/)[pIdx] || ""}
                </p>
              )}
            </div>
          ))}
        </div>
      </article>



      {/* 单词查词浮窗 */}
      {lookupTarget && lookupTarget.rect && (
        <WordLookupPopover
          word={lookupTarget.word}
          contextSentence={lookupTarget.sentence}
          contextParagraph={lookupTarget.paragraphText}
          contextParagraphTranslation={lookupTarget.paragraphTranslation}
          anchorRect={lookupTarget.rect}
          onClose={() => setLookupTarget(null)}
        />
      )}
    </div>
  )
}
