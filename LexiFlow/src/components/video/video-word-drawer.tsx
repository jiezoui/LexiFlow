"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  CheckIcon,
  HeartIcon,
  Volume2Icon,
  XIcon,
  CopyIcon,
  CheckCheckIcon,
  Loader2Icon,
  RotateCcwIcon,
  ArrowLeftIcon,
  PlayIcon,
  BookOpenIcon,
} from "lucide-react"
import {
  dictApi,
  vocabApi,
  parseJsonArray,
  type DictEntry,
  type UserWordCard,
  type MediaCue,
} from "@/lib/api-client"
import { lemmatize } from "@/lib/lemmatizer"

export interface VideoWordDrawerProps {
  word: string
  cue: MediaCue
  onClose: () => void
  onReplayCue?: (cue: MediaCue) => void
}

interface PosDefinition {
  type: "pos" | "domain" | "general"
  label: string
  meaning: string
}

const DOMAIN_MAP: Record<string, string> = {
  计: "计 · 计算机",
  经: "经 · 经济",
  医: "医 · 医学",
  化: "化 · 化学",
  机: "机 · 机械",
  电: "电 · 电子",
  法: "法 · 法律",
  物: "物 · 物理",
  建: "建 · 建筑",
  军: "军 · 军事",
  航: "航 · 航海航空",
  天: "天 · 天文",
  地: "地 · 地理地质",
  体: "体 · 体育",
  数: "数 · 数学",
  语: "语 · 语言学",
  动: "动 · 动物学",
  植: "植 · 植物学",
  网络: "网络",
  口: "口语",
  美: "美式",
  英: "英式",
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const remaining = Math.floor(seconds % 60)
  return `${minutes}:${String(remaining).padStart(2, "0")}`
}

function renderHighlightedText(text: string, targetWord: string) {
  if (!text) return null
  if (!targetWord || !targetWord.trim()) return text

  const cleanTarget = targetWord.trim().toLowerCase()
  const escaped = targetWord.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const regex = new RegExp(`(\\b${escaped}[a-z]*\\b)`, "gi")
  const parts = text.split(regex)

  return parts.map((part, i) => {
    if (part.toLowerCase().startsWith(cleanTarget)) {
      return (
        <span
          key={i}
          className="bg-primary/15 text-primary font-bold px-1 rounded underline decoration-primary decoration-2 underline-offset-2"
        >
          {part}
        </span>
      )
    }
    return part
  })
}

export function VideoWordDrawer({
  word,
  cue,
  onClose,
  onReplayCue,
}: VideoWordDrawerProps) {
  const [activeWord, setActiveWord] = useState(word)
  const [entry, setEntry] = useState<DictEntry | null>(null)
  const [userCard, setUserCard] = useState<UserWordCard | null>(null)
  const [loading, setLoading] = useState(true)
  const [isHarvested, setIsHarvested] = useState(false)
  const [isKnown, setIsKnown] = useState(false)
  const [accent, setAccent] = useState<"us" | "uk">("us")
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  const [copied, setCopied] = useState(false)

  const drawerRef = useRef<HTMLDivElement>(null)
  const lemmatized = lemmatize(activeWord)

  useEffect(() => {
    setActiveWord(word)
  }, [word])

  // 播放发音
  const playPronunciation = useCallback((audioWord: string, specificUrl?: string) => {
    if (typeof window === "undefined") return
    setIsPlayingAudio(true)

    const url =
      specificUrl && specificUrl.startsWith("http")
        ? specificUrl
        : `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(audioWord)}&type=${accent === "us" ? 2 : 1}`

    const audio = new Audio(url)
    audio.onended = () => setIsPlayingAudio(false)
    audio.onerror = () => {
      if ("speechSynthesis" in window) {
        const u = new SpeechSynthesisUtterance(audioWord)
        u.lang = accent === "us" ? "en-US" : "en-GB"
        u.onend = () => setIsPlayingAudio(false)
        u.onerror = () => setIsPlayingAudio(false)
        window.speechSynthesis.speak(u)
      } else {
        setIsPlayingAudio(false)
      }
    }
    audio.play().catch(() => setIsPlayingAudio(false))
  }, [accent])

  // 加载词条详情
  useEffect(() => {
    let cancelled = false
    const loadData = async () => {
      setLoading(true)
      const searchLemma = lemmatized.baseLemma || activeWord.toLowerCase().trim()
      const rawWord = activeWord.toLowerCase().trim()

      try {
        const [dictRes, cardRes] = await Promise.all([
          dictApi.getByLemma(searchLemma).catch(async () => {
            if (searchLemma !== rawWord) {
              return await dictApi.getByLemma(rawWord).catch(() => null)
            }
            return null
          }),
          vocabApi.getCardByLemma(searchLemma).catch(() => null),
        ])

        let finalCard = cardRes
        if (!finalCard && searchLemma !== rawWord) {
          finalCard = await vocabApi.getCardByLemma(rawWord).catch(() => null)
        }
        if (!finalCard && dictRes?.lemma) {
          const dictLemma = dictRes.lemma.toLowerCase().trim()
          if (dictLemma !== searchLemma && dictLemma !== rawWord) {
            finalCard = await vocabApi.getCardByLemma(dictLemma).catch(() => null)
          }
        }

        if (!cancelled) {
          setEntry(dictRes)
          setUserCard(finalCard)
          setIsHarvested(!!finalCard)
          setIsKnown(finalCard ? finalCard.isKnown === 1 : false)

          if (dictRes) {
            playPronunciation(dictRes.lemma, dictRes.audioUs)
          }
        }
      } catch (err) {
        console.warn("加载词条详情失败:", err)
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadData()
    return () => {
      cancelled = true
    }
  }, [activeWord, lemmatized.baseLemma, playPronunciation])

  // Esc 键关闭抽屉
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [onClose])

  // 一键入库 / 移除生词本
  const handleToggleHarvest = async () => {
    const targetLemma = lemmatized.baseLemma || activeWord.toLowerCase().trim()
    try {
      if (isHarvested && userCard) {
        await vocabApi.deleteCard(userCard.id)
        setIsHarvested(false)
        setUserCard(null)
      } else {
        const newCard = await vocabApi.addCard({
          lemma: targetLemma,
          wordId: entry?.id,
          source: "VIDEO",
          contextSentence: cue.sourceText,
          contextTranslation: cue.translation || "",
        })
        setIsHarvested(true)
        setUserCard(newCard)
      }
      window.dispatchEvent(new CustomEvent("lexiflow_wordbook_updated"))
    } catch (e) {
      console.error("切换生词本状态失败:", e)
    }
  }

  // 一键标熟 / 斩词
  const handleToggleKnown = async () => {
    const targetLemma = lemmatized.baseLemma || activeWord.toLowerCase().trim()
    const nextKnown = !isKnown
    try {
      const res = await vocabApi.toggleKnown(targetLemma, nextKnown)
      setIsKnown(nextKnown)
      setUserCard(res)
      if (nextKnown) {
        setIsHarvested(true)
      }
      window.dispatchEvent(new CustomEvent("lexiflow_wordbook_updated"))
    } catch (e) {
      console.error("切换标熟状态失败:", e)
    }
  }

  // 复制词条
  const handleCopyText = () => {
    const textToCopy = `${entry?.lemma || activeWord} [${entry?.phoneticUs || ""}]\n${entry?.definitionCn || ""}\n台词: ${cue.sourceText}\n译文: ${cue.translation || ""}`
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // 解析词性与释义
  const parseDefinitions = (defText?: string): PosDefinition[] => {
    if (!defText) return []
    if (defText.includes("自定义导入词条") && !defText.includes("\n")) {
      return []
    }
    const lines = defText.split("\n").map((l) => l.trim()).filter(Boolean)
    const result: PosDefinition[] = []

    for (const line of lines) {
      if (line.includes("自定义导入词条")) continue

      const domainMatch = line.match(/^\[([^\]]+)\]\s*(.*)$/)
      if (domainMatch) {
        const rawTag = domainMatch[1].trim()
        const fullLabel = DOMAIN_MAP[rawTag] || rawTag
        result.push({
          type: "domain",
          label: fullLabel,
          meaning: domainMatch[2].trim(),
        })
        continue
      }

      const posMatch = line.match(/^([a-z]+[.]|[a-z]+\/[a-z]+[.]|[a-z]+[.]?)\s+(.*)$/i)
      if (posMatch && !domainMatch) {
        let rawPos = posMatch[1].toLowerCase().trim()
        if (!rawPos.endsWith(".")) rawPos += "."
        if (rawPos === "a.") rawPos = "adj."
        if (rawPos === "ad.") rawPos = "adv."
        result.push({
          type: "pos",
          label: rawPos,
          meaning: posMatch[2].trim(),
        })
        continue
      }

      result.push({
        type: "general",
        label: "释",
        meaning: line,
      })
    }

    return result.slice(0, 5)
  }

  const defItems = parseDefinitions(entry?.definitionCn)

  return (
    <aside
      ref={drawerRef}
      className="absolute inset-0 z-30 flex flex-col bg-card border-l border-border shadow-2xl animate-in slide-in-from-right duration-200 overflow-hidden select-text"
      aria-label="单词精析侧抽屉"
    >
      {/* 1. 顶部操作栏 */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4 bg-muted/20">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer py-1 px-1.5 -ml-1.5 rounded-lg hover:bg-muted/60"
          title="返回字幕列表 (Esc)"
        >
          <ArrowLeftIcon className="size-3.5" />
          <span>返回字幕列表</span>
        </button>

        <div className="flex items-center gap-1">
          {/* 标熟按钮 */}
          <button
            type="button"
            onClick={handleToggleKnown}
            className={`size-7 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
              isKnown
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            }`}
            title={isKnown ? "已标记熟词 (点击取消)" : "一键标熟 (斩词)"}
          >
            <CheckIcon className={`size-3.5 ${isKnown ? "stroke-[2.5]" : ""}`} />
          </button>

          {/* 收藏生词本 */}
          <button
            type="button"
            onClick={handleToggleHarvest}
            className={`size-7 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
              isHarvested
                ? "text-rose-500"
                : "text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10"
            }`}
            title={isHarvested ? "已收录至生词本 (点击移出)" : "收录至生词本"}
          >
            <HeartIcon className={`size-3.5 ${isHarvested ? "fill-current" : ""}`} />
          </button>

          {/* 复制 */}
          <button
            type="button"
            onClick={handleCopyText}
            className="size-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
            title="复制词条"
          >
            {copied ? <CheckCheckIcon className="size-3.5 text-emerald-500" /> : <CopyIcon className="size-3.5" />}
          </button>

          {/* 关闭按钮 */}
          <button
            type="button"
            onClick={onClose}
            className="size-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
            title="关闭抽屉"
          >
            <XIcon className="size-3.5" />
          </button>
        </div>
      </div>

      {/* 2. 抽屉滚动内容区 */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4">
        {/* 词头与发音 */}
        <div className="flex flex-col gap-2 pb-1 border-b border-border/50">
          <div className="flex items-baseline gap-2.5 flex-wrap">
            <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
              {entry?.lemma || activeWord}
            </h2>
            <span className="font-serif italic font-semibold text-sm text-primary">
              {entry?.pos ? `[${entry.pos.replace(/[\[\]]/g, "").trim()}]` : ""}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <button
              type="button"
              onClick={() => setAccent(accent === "us" ? "uk" : "us")}
              className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer"
              title="切换美音 / 英音"
            >
              {accent.toUpperCase()}
            </button>

            <span className="font-mono text-xs text-muted-foreground tracking-wide">
              {accent === "us"
                ? entry?.phoneticUs && entry.phoneticUs !== `/${activeWord.toLowerCase()}/`
                  ? entry.phoneticUs
                  : "/.../"
                : entry?.phoneticUk && entry.phoneticUk !== `/${activeWord.toLowerCase()}/`
                ? entry.phoneticUk
                : "/.../"}
            </span>

            <button
              type="button"
              onClick={() => playPronunciation(entry?.lemma || activeWord, accent === "us" ? entry?.audioUs : entry?.audioUk)}
              className={`p-1 rounded-md text-muted-foreground hover:text-primary transition-colors cursor-pointer ${
                isPlayingAudio ? "text-primary animate-pulse" : ""
              }`}
              title="播放真人发音"
            >
              <Volume2Icon className="size-4" />
            </button>

            {lemmatized.isInflected && (
              <>
                <span className="text-border">|</span>
                <span className="text-[11px] font-mono text-muted-foreground">
                  原形: {lemmatized.baseLemma}
                </span>
              </>
            )}
          </div>
        </div>

        {/* 权威词典释义 */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
            <span className="flex items-center gap-1">
              <BookOpenIcon className="size-3" /> 权威词典释义
            </span>
            {entry?.tags ? (
              <span className="font-mono text-[10px] text-primary/80 font-medium truncate max-w-[150px]">
                {entry.tags.replace(/,/g, " · ")}
              </span>
            ) : null}
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground py-3">
              <Loader2Icon className="size-3.5 animate-spin text-primary" />
              <span>正在检索词典释义...</span>
            </div>
          ) : defItems.length > 0 ? (
            <div className="rounded-xl border border-border/80 bg-muted/30 p-3 flex flex-col gap-2">
              {defItems.map((item, idx) => (
                <div key={idx} className="flex items-baseline gap-2 text-xs leading-relaxed">
                  <span className="font-serif italic font-semibold text-primary shrink-0 w-7">
                    {item.label.replace(/[\[\]]/g, "").trim()}
                  </span>
                  <span className="text-foreground/90 font-medium">
                    {item.meaning}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-3 text-xs text-muted-foreground">
              {entry?.definitionCn && !entry.definitionCn.includes("自定义导入词条")
                ? entry.definitionCn
                : "暂无离线中文释义"}
            </div>
          )}
        </div>

        {/* 当前视频台词原句语境与重播 */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
            <span>当前视频台词原句</span>
            <span className="font-mono text-[10px] text-primary">
              {formatTime(cue.startMs / 1000)}
            </span>
          </div>

          <div className="rounded-xl border border-border/80 bg-muted/40 p-3.5 flex flex-col gap-2.5">
            {/* 英文台词 */}
            <p className="text-xs sm:text-[13px] font-serif leading-relaxed text-foreground select-text">
              “{renderHighlightedText(cue.sourceText, word)}”
            </p>

            {/* 中文翻译 */}
            {cue.translation && (
              <p className="text-xs leading-relaxed text-muted-foreground font-sans select-text border-t border-border/40 pt-2">
                {cue.translation}
              </p>
            )}

            {/* 重听本句按钮 */}
            {onReplayCue && (
              <div className="pt-1 flex justify-end">
                <button
                  type="button"
                  onClick={() => onReplayCue(cue)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer"
                  title="跳转至本句开始时间并重放"
                >
                  <RotateCcwIcon className="size-3" />
                  <span>重听本句 ({formatTime(cue.startMs / 1000)})</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 同近义词与反义词扩展 */}
        {(() => {
          const synonymList = parseJsonArray(entry?.synonyms)
          const antonymList = parseJsonArray(entry?.antonyms)
          if (synonymList.length === 0 && antonymList.length === 0) return null

          return (
            <div className="flex flex-col gap-2.5 rounded-xl border border-border/70 bg-muted/20 p-3">
              {synonymList.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                    <span>同近义词 ({synonymList.length})</span>
                    <span className="text-[10px] text-muted-foreground/70">点击可切换查词</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {synonymList.map((syn, idx) => (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => setActiveWord(syn)}
                        className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                          activeWord.toLowerCase() === syn.toLowerCase()
                            ? "bg-primary/15 text-primary border-primary/40 font-semibold shadow-xs"
                            : "bg-muted/50 hover:bg-primary/10 hover:text-primary hover:border-primary/30 text-foreground/85 border-border/50"
                        }`}
                        title={`点击查词: ${syn}`}
                      >
                        {syn}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {antonymList.length > 0 && (
                <div className="flex flex-col gap-1.5 border-t border-border/40 pt-2">
                  <span className="text-[11px] font-semibold text-muted-foreground">反义词</span>
                  <div className="flex flex-wrap gap-1.5">
                    {antonymList.map((ant, idx) => (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => setActiveWord(ant)}
                        className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-muted/40 hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/30 text-foreground/80 border border-border/50 transition-colors cursor-pointer"
                        title={`点击查词: ${ant}`}
                      >
                        {ant}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })()}
      </div>

      {/* 3. 底部收录动作区 */}
      <div className="mt-auto p-4 border-t border-border/50 bg-muted/10">
        <button
          type="button"
          onClick={handleToggleHarvest}
          className={`w-full h-9 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${
            isHarvested
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          }`}
        >
          {isHarvested ? (
            <>
              <CheckIcon className="size-3.5 stroke-[2.5]" />
              <span>已收录此视频生词卡片</span>
            </>
          ) : (
            <>
              <HeartIcon className="size-3.5" />
              <span>收录此生词至生词本</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
