"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { createPortal } from "react-dom"
import {
  CheckIcon,
  HeartIcon,
  Volume2Icon,
  SparklesIcon,
  BookOpenIcon,
  SettingsIcon,
  CopyIcon,
  CheckCheckIcon,
  XIcon,
  Loader2Icon,
  BotIcon,
  SendIcon,
  AlertCircleIcon,
  ExternalLinkIcon,
} from "lucide-react"
import Link from "next/link"
import {
  dictApi,
  vocabApi,
  aiApi,
  type DictEntry,
  type UserWordCard,
  type AiExplainResult,
} from "@/lib/api-client"
import { lemmatize } from "@/lib/lemmatizer"
import { getActiveAiConfig } from "@/lib/ai-config"

export interface WordLookupPopoverProps {
  word: string
  contextSentence?: string
  anchorRect: DOMRect | null
  onClose: () => void
  onOpenFullDrawer?: (word: string) => void
  onHarvestChange?: (lemma: string, harvested: boolean) => void
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

export function WordLookupPopover({
  word,
  contextSentence = "",
  anchorRect,
  onClose,
  onOpenFullDrawer,
  onHarvestChange,
}: WordLookupPopoverProps) {
  const [mounted, setMounted] = useState(false)
  const popoverRef = useRef<HTMLDivElement | null>(null)

  // 核心数据状态
  const [entry, setEntry] = useState<DictEntry | null>(null)
  const [userCard, setUserCard] = useState<UserWordCard | null>(null)
  const [loading, setLoading] = useState(true)
  const [isHarvested, setIsHarvested] = useState(false)
  const [isKnown, setIsKnown] = useState(false)
  const [accent, setAccent] = useState<"us" | "uk">("us")
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  const [copied, setCopied] = useState(false)

  // 长句模式与整句机器翻译状态
  const isSentenceMode = word.trim().includes(" ") || word.length > 25
  const [sentenceTranslation, setSentenceTranslation] = useState<string | null>(null)
  const [translating, setTranslating] = useState(false)

  // AI 语境深度解析抽屉/弹窗状态
  const [showAiInsight, setShowAiInsight] = useState(false)
  const [aiQuestion, setAiQuestion] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState<AiExplainResult | null>(null)
  const [aiConfig, setAiConfig] = useState(getActiveAiConfig())

  // 形态学词形还原
  const lemmatized = lemmatize(word)

  // 当打开 AI 解析弹窗且配置有效时，自动拉取真实解析
  useEffect(() => {
    if (!showAiInsight) return
    const cfg = getActiveAiConfig()
    setAiConfig(cfg)
    if (cfg.isConfigured && !aiResult) {
      handleRequestAiExplain(cfg)
    }
  }, [showAiInsight, word])

  const handleRequestAiExplain = async (cfg = aiConfig, customQuestion?: string) => {
    if (!cfg.isConfigured) return
    setAiLoading(true)
    try {
      const res = await aiApi.explainWord({
        word,
        contextSentence: contextSentence || entry?.sampleSentence || "",
        question: customQuestion !== undefined ? customQuestion : aiQuestion,
        provider: cfg.provider,
        apiHost: cfg.apiHost,
        apiKey: cfg.apiKey,
        model: cfg.model,
      })
      setAiResult(res)
    } catch (e: any) {
      setAiResult({
        word,
        contextMeaning: "AI 解析服务暂时不可用",
        grammarRole: "",
        collocations: [],
        examTips: "",
        mnemonics: "",
        rawAnswer: e?.message || "请检查网络或在「设置 -> AI 模型」中测试 API Key 连通性",
      })
    } finally {
      setAiLoading(false)
    }
  }

  useEffect(() => {
    setMounted(true)
  }, [])

  // 点击外部关闭弹窗与 Esc 键退出
  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }
    const handleScroll = () => {
      // 若用户正在看 AI 深度解析弹窗，不因底层轻微滚动而关闭
      if (!showAiInsight) {
        onClose()
      }
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    window.addEventListener("scroll", handleScroll, true)
    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("scroll", handleScroll, true)
    }
  }, [onClose, showAiInsight])

  // 播放原声发音
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

  // 加载词条数据与用户记忆状态
  useEffect(() => {
    let cancelled = false
    const loadData = async () => {
      setLoading(true)

      // 1. 如果是长句子或短语，走整句机器翻译逻辑
      if (isSentenceMode) {
        try {
          setTranslating(true)
          const res = await dictApi.translate(word)
          if (!cancelled) {
            setSentenceTranslation(res.translation || "暂无翻译")
          }
        } catch {
          if (!cancelled) {
            setSentenceTranslation("（整句翻译请求超时，点击下方可使用 AI 语境精析）")
          }
        } finally {
          if (!cancelled) {
            setTranslating(false)
            setLoading(false)
          }
        }
        return
      }

      // 2. 单词精查逻辑：优先查原型或原词
      const searchLemma = lemmatized.baseLemma || word.toLowerCase().trim()
      const rawWord = word.toLowerCase().trim()

      try {
        // 并行拉取词典释义与当前用户的生词卡片记忆进度
        const [dictRes, primaryCardRes] = await Promise.all([
          dictApi.getByLemma(searchLemma).catch(async () => {
            // 若原形未查到，尝试查原始输入
            if (searchLemma !== rawWord) {
              return await dictApi.getByLemma(rawWord).catch(() => null)
            }
            return null
          }),
          vocabApi.getCardByLemma(searchLemma).catch(() => null),
        ])

        let finalCard = primaryCardRes
        // 容错 1：若原型未直接命中且与原词不同，查原词
        if (!finalCard && searchLemma !== rawWord) {
          finalCard = await vocabApi.getCardByLemma(rawWord).catch(() => null)
        }
        // 容错 2：若词典返回的词条原型与上述均不同，查词典权威原型
        if (!finalCard && dictRes && dictRes.lemma) {
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
          if (finalCard) {
            onHarvestChange?.(searchLemma, true)
            onHarvestChange?.(rawWord, true)
            if (dictRes?.lemma) onHarvestChange?.(dictRes.lemma, true)
          }

          // 默认自动播音一次
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
  }, [word, isSentenceMode, lemmatized.baseLemma, playPronunciation])

  // 一键入库 / 移除生词本 (心形收藏)
  const handleToggleHarvest = async () => {
    const targetLemma = lemmatized.baseLemma || word.toLowerCase().trim()
    const rawWord = word.toLowerCase().trim()
    try {
      if (isHarvested && userCard) {
        // 取消收藏
        await vocabApi.deleteCard(userCard.id)
        setIsHarvested(false)
        setUserCard(null)
        onHarvestChange?.(targetLemma, false)
        onHarvestChange?.(rawWord, false)
      } else {
        // 采录入库: 若为文章整句例句，自动请求整句机器翻译填充中文意思
        const targetSentence = contextSentence || entry?.sampleSentence || ""
        let sentenceTrans = ""
        if (targetSentence && targetSentence.trim().includes(" ")) {
          try {
            const transRes = await dictApi.translate(targetSentence.trim())
            if (transRes && transRes.translation && !transRes.translation.includes("繁忙")) {
              sentenceTrans = transRes.translation.trim()
            }
          } catch {}
        }
        if (!sentenceTrans) {
          sentenceTrans = entry?.sampleTranslation || ""
        }

        const newCard = await vocabApi.addCard({
          lemma: targetLemma,
          wordId: entry?.id,
          source: "READING",
          contextSentence: targetSentence,
          contextTranslation: sentenceTrans,
        })
        setIsHarvested(true)
        setUserCard(newCard)
        onHarvestChange?.(targetLemma, true)
        onHarvestChange?.(rawWord, true)
        if (entry?.lemma) {
          onHarvestChange?.(entry.lemma.toLowerCase().trim(), true)
        }
      }
      window.dispatchEvent(new CustomEvent("lexiflow_wordbook_updated"))
    } catch (e) {
      console.error("切换生词本状态失败:", e)
    }
  }

  // 一键标熟 / 斩词 (对勾按钮)
  const handleToggleKnown = async () => {
    const targetLemma = lemmatized.baseLemma || word.toLowerCase().trim()
    const nextKnown = !isKnown
    try {
      const res = await vocabApi.toggleKnown(targetLemma, nextKnown)
      setIsKnown(nextKnown)
      setUserCard(res)
      if (nextKnown) {
        setIsHarvested(true)
        onHarvestChange?.(targetLemma, true)
      }
      window.dispatchEvent(new CustomEvent("lexiflow_wordbook_updated"))
    } catch (e) {
      console.error("切换标熟状态失败:", e)
    }
  }

  // 复制当前释义或句子
  const handleCopyText = () => {
    const textToCopy = isSentenceMode
      ? `${word}\n${sentenceTranslation || ""}`
      : `${entry?.lemma || word} [${entry?.phoneticUs || ""}]\n${entry?.definitionCn || ""}`

    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // 解析多词性与专业领域结构化释义
  const parseDefinitions = (defText?: string): PosDefinition[] => {
    if (!defText) return []
    if (defText.includes("自定义导入词条") && !defText.includes("\n")) {
      return []
    }
    const lines = defText.split("\n").map((l) => l.trim()).filter(Boolean)
    const result: PosDefinition[] = []

    for (const line of lines) {
      if (line.includes("自定义导入词条")) continue

      // 1. 匹配专业领域/行业标签 [计] / [经] / [医] / [网络] / [化] / [法] 等
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

      // 2. 匹配以 v. / vt. / vi. / n. / adj. / a. / adv. / ad. / prep. / conj. / pron. / web. 等开头的标准词性行
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

      // 3. 一般无前缀释义行
      result.push({
        type: "general",
        label: "释",
        meaning: line,
      })
    }

    return result.slice(0, 4) // 最多展示前 4 个代表性释义，保持浮窗精巧
  }

  if (!mounted || !anchorRect) return null

  // 悬浮气泡视口就近坐标计算与碰撞边界检测
  const popoverWidth = 330
  const popoverEstimatedHeight = isSentenceMode ? 220 : 260

  let top = anchorRect.bottom + 8
  let left = anchorRect.left - 12

  // 右侧边界碰撞检测 (防止超出浏览器右侧)
  if (left + popoverWidth > window.innerWidth - 16) {
    left = Math.max(16, window.innerWidth - popoverWidth - 16)
  }
  if (left < 16) {
    left = 16
  }

  // 底部边界碰撞检测 (若下方空间不足，向上翻折)
  if (anchorRect.bottom + popoverEstimatedHeight > window.innerHeight && anchorRect.top > popoverEstimatedHeight + 16) {
    top = Math.max(16, anchorRect.top - popoverEstimatedHeight - 8)
  }

  const defItems = parseDefinitions(entry?.definitionCn)

  return createPortal(
    <>
      <div
        ref={popoverRef}
        style={{ top: `${top}px`, left: `${left}px` }}
        className="fixed z-50 w-[330px] sm:w-[350px] rounded-3xl border border-border/80 bg-card/95 dark:bg-zinc-900/95 p-4 sm:p-4.5 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 text-foreground select-none"
      >
        {isSentenceMode ? (
          /* ==================== 模式 B：划选长句 / 短语翻译小窗 ==================== */
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-primary font-bold flex items-center gap-1">
                <SparklesIcon className="size-3" /> 划句机器翻译 · MT Engine
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleCopyText}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                  title="复制原文与译文"
                >
                  {copied ? <CheckCheckIcon className="size-3.5 text-emerald-500" /> : <CopyIcon className="size-3.5" />}
                </button>
                <button
                  onClick={onClose}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                >
                  <XIcon className="size-3.5" />
                </button>
              </div>
            </div>

            <div className="text-xs text-muted-foreground leading-relaxed italic bg-muted/40 p-2.5 rounded-2xl border border-border/40 max-h-24 overflow-y-auto">
              "{word}"
            </div>

            <div className="text-xs sm:text-sm font-medium leading-relaxed text-foreground min-h-[48px] flex items-center">
              {translating ? (
                <div className="flex items-center gap-2 text-muted-foreground text-xs font-mono">
                  <Loader2Icon className="size-3.5 animate-spin text-primary" />
                  <span>正在翻译整句语境...</span>
                </div>
              ) : (
                sentenceTranslation
              )}
            </div>

            {/* 底部 AI 深度语境精析按钮 */}
            <div className="pt-1 border-t border-border/50 flex items-center justify-between">
              <button
                onClick={() => setShowAiInsight(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-semibold bg-gradient-to-r from-violet-500/10 via-fuchsia-500/10 to-amber-500/10 text-violet-600 dark:text-violet-400 hover:opacity-90 border border-violet-500/20 transition-all cursor-pointer"
              >
                <SparklesIcon className="size-3 text-fuchsia-500" />
                <span>AI 深度语法解析</span>
              </button>

              <span className="text-[10px] font-mono text-muted-foreground">Google / Bing NMT</span>
            </div>
          </div>
        ) : (
          /* ==================== 模式 A：单词就近快查小窗 (1:1 参考图) ==================== */
          <div className="flex flex-col gap-2.5">
            {/* 1. 顶部操作行：单词 + [✔ 标熟] + [♡ 收藏] */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold tracking-tight text-foreground">
                {entry?.lemma || word}
              </h3>

              <div className="flex items-center gap-1.5">
                {/* 标熟/斩词按钮 */}
                <button
                  type="button"
                  onClick={handleToggleKnown}
                  className={`size-7 rounded-xl flex items-center justify-center transition-all cursor-pointer border ${
                    isKnown
                      ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 scale-105"
                      : "bg-muted/50 border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                  title={isKnown ? "已标记完全掌握 (斩词)，点击取消标熟" : "一键标熟 (斩词)，移出后续复习队列"}
                >
                  <CheckIcon className={`size-3.5 ${isKnown ? "stroke-[2.5]" : ""}`} />
                </button>

                {/* 心形收藏/加入生词本 */}
                <button
                  type="button"
                  onClick={handleToggleHarvest}
                  className={`size-7 rounded-xl flex items-center justify-center transition-all cursor-pointer border ${
                    isHarvested
                      ? "bg-rose-500/15 border-rose-500/40 text-rose-500 scale-105"
                      : "bg-muted/50 border-border/60 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10"
                  }`}
                  title={isHarvested ? "已收录至生词本，点击取消" : "收藏该单词与上下文例句入生词库"}
                >
                  <HeartIcon className={`size-3.5 ${isHarvested ? "fill-current" : ""}`} />
                </button>
              </div>
            </div>

            {/* 2. 音标与真人发音栏 */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAccent(accent === "us" ? "uk" : "us")}
                className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="点击切换美音/英音"
              >
                {accent.toUpperCase()}
              </button>

              <span className="font-mono text-xs text-muted-foreground tracking-wide">
                {accent === "us"
                  ? entry?.phoneticUs && entry.phoneticUs !== `/${word.toLowerCase()}/`
                    ? entry.phoneticUs
                    : "/.../"
                  : entry?.phoneticUk && entry.phoneticUk !== `/${word.toLowerCase()}/`
                  ? entry.phoneticUk
                  : "/.../"}
              </span>

              <button
                type="button"
                onClick={() => playPronunciation(entry?.lemma || word, accent === "us" ? entry?.audioUs : entry?.audioUk)}
                className={`p-1 rounded-md text-muted-foreground hover:text-primary transition-colors cursor-pointer ${
                  isPlayingAudio ? "text-primary animate-pulse" : ""
                }`}
                title="播放纯正真人发音"
              >
                <Volume2Icon className="size-3.5" />
              </button>
            </div>

            {/* 3. 多词性结构化释义 (紫色独立小胶囊 / 青色专业领域标签) */}
            <div className="flex flex-col gap-1.5 my-0.5">
              {loading ? (
                <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground py-2">
                  <Loader2Icon className="size-3.5 animate-spin text-primary" />
                  <span>正在精查柯林斯词典...</span>
                </div>
              ) : defItems.length > 0 ? (
                defItems.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs leading-snug">
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold shrink-0 select-none ${
                        item.type === "domain"
                          ? "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400"
                          : item.type === "pos"
                          ? "bg-purple-500/15 text-purple-600 dark:text-purple-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {item.type === "pos" ? `[ ${item.label} ]` : `[ ${item.label} ]`}
                    </span>
                    <span className="text-foreground/90 font-medium">
                      {item.meaning}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-xs text-muted-foreground py-1">
                  {entry?.definitionCn && !entry.definitionCn.includes("自定义导入词条")
                    ? entry.definitionCn
                    : "暂无本地离线释义，可点击右下角 ✨ 调起 AI 解析"}
                </div>
              )}
            </div>

            {/* 4. 形态学原型还原 (Lemmatization) */}
            {lemmatized.isInflected && (
              <div className="text-[11px] font-mono text-muted-foreground/85 bg-muted/30 px-2 py-1 rounded-xl border border-border/40 flex items-center justify-between">
                <span>{lemmatized.displayText}</span>
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60">原型还原</span>
              </div>
            )}

            {/* 5. 底部工具状态栏：⏱ 复习次数 + [✨ AI] + [📖 词典抽屉] + [⚙ 设置] */}
            <div className="flex items-center justify-between pt-2 border-t border-border/60">
              {/* 记忆复习状态 */}
              <div className="flex items-center gap-1.5">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                    isKnown
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                      : userCard
                      ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20"
                      : "bg-muted text-muted-foreground border-border/40"
                  }`}
                >
                  <span>⏱</span>
                  <span>{isKnown ? "已斩词" : userCard ? `复习 ${userCard.reps || 0} 次` : "未入库"}</span>
                </span>
              </div>

              {/* 右侧功能图标组 */}
              <div className="flex items-center gap-1.5">
                {/* AI 语境精析按钮 (彩虹渐变微边框) */}
                <button
                  type="button"
                  onClick={() => setShowAiInsight(true)}
                  className="size-7 rounded-xl p-[1px] bg-gradient-to-tr from-violet-500 via-fuchsia-500 to-amber-500 transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                  title="AI 深度语境解析与语法释义"
                >
                  <div className="size-full bg-card rounded-[11px] flex items-center justify-center text-foreground hover:bg-muted/40 transition-colors">
                    <SparklesIcon className="size-3.5 text-fuchsia-500" />
                  </div>
                </button>

                {/* 词典抽屉详情 */}
                {onOpenFullDrawer && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenFullDrawer(entry?.lemma || word)
                      onClose()
                    }}
                    className="size-7 rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                    title="在右侧展开完整词典详情与真题例句"
                  >
                    <BookOpenIcon className="size-3.5" />
                  </button>
                )}

                {/* 设置图标 */}
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="size-7 rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                  title="复制词条释义"
                >
                  {copied ? <CheckCheckIcon className="size-3.5 text-emerald-500" /> : <CopyIcon className="size-3.5" />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ==================== AI 语境深度解析弹窗 (支持真实大模型驱动 & 未配置引导) ==================== */}
      {showAiInsight && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowAiInsight(false)}
        >
          <div
            className="relative w-full max-w-lg max-h-[85vh] flex flex-col rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-2xl animate-in zoom-in-95 duration-200 space-y-3.5 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 顶栏 */}
            <div className="flex items-center justify-between border-b border-border/60 pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-xl bg-gradient-to-tr from-violet-500 to-fuchsia-500 text-white flex items-center justify-center shadow-xs">
                  <BotIcon className="size-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-foreground">AI 语境深度解析与辨析</h4>
                    {aiConfig.isConfigured && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-medium">
                        {aiConfig.model}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground block">
                    Contextual AI Insights · 语法与考点深挖
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowAiInsight(false)}
                className="size-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 flex items-center justify-center transition-colors cursor-pointer"
              >
                <XIcon className="size-4" />
              </button>
            </div>

            {/* 原文语境呈现 */}
            <div className="bg-muted/40 p-3 rounded-2xl border border-border/50 text-xs space-y-1 shrink-0">
              <span className="text-[10px] font-mono text-muted-foreground uppercase block font-semibold">
                当前文章例句语境 (Context Sentence)
              </span>
              <p className="text-foreground italic leading-relaxed line-clamp-3">
                "{contextSentence || entry?.sampleSentence || "No casualties were reported after the strike at Yahodyn, which hit the train..."}"
              </p>
            </div>

            {/* 核心内容展示区 (滚动容器) */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {!aiConfig.isConfigured ? (
                /* 未配置 API Key 引导状态 */
                <div className="p-5 rounded-2xl bg-muted/30 border border-dashed border-border/80 flex flex-col items-center text-center gap-3 my-2">
                  <div className="size-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                    <AlertCircleIcon className="size-5" />
                  </div>
                  <div className="space-y-1">
                    <h5 className="text-xs font-bold text-foreground">尚未配置 AI 大模型 API Key</h5>
                    <p className="text-[11px] text-muted-foreground leading-relaxed max-w-sm">
                      语脉支持接入 DeepSeek、硅基流动、OpenAI、Claude 或本地 Ollama。配置后即可对文章原句展开专属语法时态剖析与真题搭配拓展。
                    </p>
                  </div>
                  <Link
                    href="/settings?tab=ai"
                    onClick={() => {
                      setShowAiInsight(false)
                      onClose()
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer shadow-sm"
                  >
                    <span>前往设置中心配置 API Key</span>
                    <ExternalLinkIcon className="size-3" />
                  </Link>
                </div>
              ) : aiLoading ? (
                /* 加载动效 */
                <div className="p-8 rounded-2xl bg-gradient-to-b from-primary/5 to-transparent border border-primary/20 flex flex-col items-center justify-center gap-3 text-center">
                  <Loader2Icon className="size-6 animate-spin text-primary" />
                  <div className="space-y-0.5">
                    <span className="text-xs font-medium text-foreground">
                      正在调用 [{aiConfig.model}] 进行语境深度解析...
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground block">
                      剖析句法功能、被动语态、核心搭配与考纲要点
                    </span>
                  </div>
                </div>
              ) : aiResult ? (
                /* 真实 AI 解析呈现 */
                <div className="space-y-2.5">
                  <div className="p-3.5 rounded-2xl bg-gradient-to-b from-primary/5 to-transparent border border-primary/20 text-xs space-y-2.5 leading-relaxed">
                    <div className="font-bold text-primary flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <SparklesIcon className="size-3.5" />
                        <span>核心用法语义解析：[{word}]</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRequestAiExplain(aiConfig)}
                        className="text-[10px] font-mono text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                        title="重新生成"
                      >
                        重新解析
                      </button>
                    </div>

                    <p className="text-foreground/90 font-medium">
                      {aiResult.contextMeaning}
                    </p>

                    {aiResult.grammarRole && (
                      <div className="text-[11px] text-muted-foreground bg-muted/30 p-2 rounded-xl border border-border/40">
                        <span className="font-semibold text-foreground mr-1">句法成分:</span>
                        {aiResult.grammarRole}
                      </div>
                    )}

                    {aiResult.collocations && aiResult.collocations.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[10px] font-mono uppercase text-muted-foreground font-semibold">
                          推荐高频搭配:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {aiResult.collocations.map((c, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded-md bg-muted text-foreground text-[11px] font-medium border border-border/50"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {aiResult.examTips && (
                      <div className="text-[11px] text-muted-foreground">
                        <span className="font-semibold text-foreground mr-1">考点考纲:</span>
                        {aiResult.examTips}
                      </div>
                    )}

                    {aiResult.mnemonics && (
                      <div className="text-[11px] text-muted-foreground">
                        <span className="font-semibold text-foreground mr-1">助记建议:</span>
                        {aiResult.mnemonics}
                      </div>
                    )}

                    {aiResult.rawAnswer && (
                      <div className="pt-2 border-t border-border/40 text-[11px] text-foreground leading-relaxed whitespace-pre-line">
                        {aiResult.rawAnswer}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            {/* 提问交互栏 */}
            {aiConfig.isConfigured && (
              <div className="flex items-center gap-2 pt-1 shrink-0 border-t border-border/40">
                <input
                  type="text"
                  value={aiQuestion}
                  onChange={(e) => setAiQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !aiLoading && aiQuestion.trim()) {
                      handleRequestAiExplain(aiConfig, aiQuestion.trim())
                      setAiQuestion("")
                    }
                  }}
                  placeholder="对该词在该句的用法有疑问？输入追问 (回车发送)..."
                  className="flex-1 h-9 px-3.5 rounded-xl border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  type="button"
                  disabled={aiLoading || !aiQuestion.trim()}
                  onClick={() => {
                    if (!aiQuestion.trim()) return
                    handleRequestAiExplain(aiConfig, aiQuestion.trim())
                    setAiQuestion("")
                  }}
                  className="h-9 px-3.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1 hover:bg-primary/90 disabled:opacity-50 transition-all cursor-pointer shrink-0"
                >
                  {aiLoading ? (
                    <Loader2Icon className="size-3 animate-spin" />
                  ) : (
                    <SendIcon className="size-3" />
                  )}
                  <span>{aiLoading ? "解析中" : "追问"}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>,
    document.body
  )
}
