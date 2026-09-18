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
  contextParagraph?: string
  contextParagraphTranslation?: string
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

// 客户端会话级别解析缓存，避免阅读同一篇文章重复查词的重复网络开销，实现 0ms 秒开
const aiSessionCache = new Map<string, AiExplainResult>()

function isThinkingNoise(text?: string | null): boolean {
  if (!text) return false
  const lower = text.toLowerCase()
  return (
    lower.includes("examtips <=") ||
    lower.includes("usagenote <=") ||
    lower.includes("examtips < =") ||
    lower.includes("usagenote < =") ||
    lower.includes("mnemonics <=") ||
    lower.includes("need sentencetranslation") ||
    lower.includes("need contextmeaning") ||
    lower.includes("target sentence likely") ||
    lower.includes("provided two sentences") ||
    lower.includes("we need answer json") ||
    lower.includes("user asks target word") ||
    lower.includes("let's count") ||
    lower.includes("need output valid json") ||
    lower.includes("might be awkward") ||
    lower.includes("need analyze word") ||
    lower.includes("<think>") ||
    lower.includes("</think>") ||
    lower.includes("【严格执行规则】") ||
    lower.includes("严格执行规则") ||
    lower.includes("不超过80字") ||
    lower.includes("不超过25字") ||
    lower.includes("不超过40字") ||
    lower.includes("rawanswer: 若有用户追问") ||
    lower.includes("good. need accurate")
  )
}

function getCleanContextMeaning(
  aiResult: AiExplainResult | null,
  entry: DictEntry | null,
  word: string
): string {
  if (!aiResult) return entry?.definitionCn || word

  const rawMeaning = aiResult.contextMeaning?.trim() || ""

  // 严禁展示思考草稿、解析完成占位符、单词自身或prompt泄漏文本
  if (
    rawMeaning &&
    !isThinkingNoise(rawMeaning) &&
    !rawMeaning.includes("解析完成") &&
    rawMeaning.toLowerCase() !== word.toLowerCase()
  ) {
    const cleaned = rawMeaning.replace(/<[^>]+>/g, "").replace(/^[#*`\s]+|[#*`\s]+$/g, "").trim()
    if (cleaned && !isThinkingNoise(cleaned)) {
      return cleaned
    }
  }

  // 优先降级至离线词典高质量中文释义
  if (entry?.definitionCn && !entry.definitionCn.includes("自定义导入")) {
    return entry.definitionCn
  }

  return word
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
          className="bg-primary/15 text-primary font-bold px-1.5 py-0.5 rounded-md underline decoration-primary decoration-2 underline-offset-2"
        >
          {part}
        </span>
      )
    }
    return part
  })
}

export function WordLookupPopover({
  word,
  contextSentence = "",
  contextParagraph = "",
  contextParagraphTranslation = "",
  anchorRect,
  onClose,
  onOpenFullDrawer,
  onHarvestChange,
}: WordLookupPopoverProps) {
  const [mounted, setMounted] = useState(false)
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const aiModalRef = useRef<HTMLDivElement | null>(null)

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
  const [lastQuestion, setLastQuestion] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState<AiExplainResult | null>(null)
  const [aiConfig, setAiConfig] = useState(getActiveAiConfig())

  // 例句翻译状态 (当前文章原句语境翻译)
  const [contextTrans, setContextTrans] = useState<string>("")
  const [contextTransLoading, setContextTransLoading] = useState<boolean>(false)

  // 形态学词形还原
  const lemmatized = lemmatize(word)

  // 当打开 AI 解析弹窗且配置有效时，优先命中客户端缓存或拉取解析
  useEffect(() => {
    if (!showAiInsight) return
    const cfg = getActiveAiConfig()
    setAiConfig(cfg)
    if (cfg.isConfigured && !aiResult) {
      const targetSentence = (contextSentence || contextParagraph || entry?.sampleSentence || "").trim()
      const cacheKey = `${cfg.provider}:${cfg.model}:${word}:${targetSentence}`
      const cached = aiSessionCache.get(cacheKey)
      if (cached && cached.contextMeaning && !cached.contextMeaning.includes("解析完成")) {
        setAiResult(cached)
        if (cached.sentenceTranslation && !contextTrans) {
          setContextTrans(cached.sentenceTranslation.trim())
        }
      } else {
        handleRequestAiExplain(cfg)
      }
    }
  }, [showAiInsight, word])

  // 当打开 AI 解析弹窗时，确保文章例句配备高质量中文翻译
  useEffect(() => {
    if (!showAiInsight) return
    if (contextParagraphTranslation) {
      setContextTrans(contextParagraphTranslation.trim())
      return
    }
    const targetSentence = (contextSentence || contextParagraph || entry?.sampleSentence || "").trim()
    if (!targetSentence) return

    // 1. 若词典条目中已有与例句完全一致的原配中文翻译，直接使用
    if (entry?.sampleSentence?.trim() === targetSentence && entry?.sampleTranslation) {
      setContextTrans(entry.sampleTranslation.trim())
      return
    }

    // 2. 若用户生词卡片中已有有效翻译，优先使用
    if (userCard?.contextSentence?.trim() === targetSentence && userCard?.contextTranslation) {
      setContextTrans(userCard.contextTranslation.trim())
      return
    }

    // 3. 否则自动异步调用翻译接口生成精准中文翻译
    if (!contextTrans) {
      setContextTransLoading(true)
      dictApi.translate(targetSentence)
        .then((res) => {
          if (res?.translation && !res.translation.includes("繁忙")) {
            setContextTrans(res.translation.trim())
          }
        })
        .catch(() => {})
        .finally(() => {
          setContextTransLoading(false)
        })
    }
  }, [showAiInsight, contextSentence, contextParagraph, contextParagraphTranslation, entry?.sampleSentence, entry?.sampleTranslation, userCard])

  // 打开 AI 弹窗时锁定底层 body 滚动
  useEffect(() => {
    if (!showAiInsight) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [showAiInsight])

  const handleRequestAiExplain = async (cfg = aiConfig, customQuestion?: string) => {
    if (!cfg.isConfigured) return
    const targetSentence = (contextSentence || contextParagraph || entry?.sampleSentence || "").trim()
    const isDefaultQuery = !customQuestion
    if (customQuestion !== undefined) {
      setLastQuestion(customQuestion.trim())
    }
    const cacheKey = `${cfg.provider}:${cfg.model}:${word}:${targetSentence}`

    // 仅针对无追问的默认全量解析命中前端缓存
    if (isDefaultQuery && aiSessionCache.has(cacheKey)) {
      const cached = aiSessionCache.get(cacheKey)!
      if (cached.contextMeaning && !cached.contextMeaning.includes("解析完成")) {
        setAiResult(cached)
        if (cached.sentenceTranslation && !contextTrans) {
          setContextTrans(cached.sentenceTranslation.trim())
        }
        return
      }
    }

    setAiLoading(true)
    try {
      const res = await aiApi.explainWord({
        word,
        contextSentence: targetSentence,
        question: customQuestion !== undefined ? customQuestion : aiQuestion,
        provider: cfg.provider,
        apiHost: cfg.apiHost,
        apiKey: cfg.apiKey,
        model: cfg.model,
      })
      setAiResult(res)
      if (
        isDefaultQuery &&
        res.contextMeaning &&
        !res.contextMeaning.includes("解析完成") &&
        !res.contextMeaning.includes("失败")
      ) {
        aiSessionCache.set(cacheKey, res)
      }
      // 如果 AI 返回了解析出的整句翻译，同步赋予例句翻译
      if (res.sentenceTranslation && !contextTrans) {
        setContextTrans(res.sentenceTranslation.trim())
      }
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
      // 当 AI 深度解析弹窗打开时，所有点击与划词由 AI 弹窗自身处理，绝不误关闭
      if (showAiInsight) {
        return
      }
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showAiInsight) {
          setShowAiInsight(false)
        } else {
          onClose()
        }
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
        const targetSentence = contextSentence || contextParagraph || entry?.sampleSentence || ""
        let sentenceTrans = contextParagraphTranslation || ""
        if (!sentenceTrans && targetSentence && targetSentence.trim().includes(" ")) {
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
        style={{ top: `${top}px`, left: `${left}px`, display: showAiInsight ? "none" : undefined }}
        className="fixed z-50 w-[330px] sm:w-[350px] rounded-2xl sm:rounded-[22px] border border-border/80 bg-card/95 dark:bg-zinc-900/95 p-4 sm:p-4.5 shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150 text-foreground select-none flex flex-col gap-3"
      >
        {isSentenceMode ? (
          /* ==================== 模式 B：划选长句 / 短语翻译小窗 ==================== */
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <span className="text-[10.5px] font-mono font-bold text-primary flex items-center gap-1">
                <SparklesIcon className="size-3" /> 整句机器翻译
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

            <div className="text-xs text-muted-foreground leading-relaxed italic bg-muted/40 p-2.5 rounded-xl border border-border/40 max-h-24 overflow-y-auto">
              "{word}"
            </div>

            <div className="text-xs sm:text-sm font-medium leading-relaxed text-foreground min-h-[44px] flex items-center">
              {translating ? (
                <div className="flex items-center gap-2 text-muted-foreground text-xs font-mono">
                  <Loader2Icon className="size-3.5 animate-spin text-primary" />
                  <span>正在翻译整句语境...</span>
                </div>
              ) : (
                sentenceTranslation
              )}
            </div>

            {/* 底部 AI 深度精析按钮 */}
            <div className="pt-2 border-t border-border/50 flex items-center justify-between">
              <button
                onClick={() => setShowAiInsight(true)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:opacity-80 transition-opacity cursor-pointer"
              >
                <SparklesIcon className="size-3.5" />
                <span>AI 深度语法解析 →</span>
              </button>
              <span className="text-[10px] font-mono text-muted-foreground">Neural MT</span>
            </div>
          </div>
        ) : (
          /* ==================== 模式 A：苹果原生极简风 单词查词小窗 ==================== */
          <div className="flex flex-col gap-2.5">
            {/* 1. 顶部操作行：单词、标熟、收藏与关闭 */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold tracking-tight text-foreground">
                {entry?.lemma || word}
              </h3>

              <div className="flex items-center gap-1">
                {/* 标熟/斩词按钮 */}
                <button
                  type="button"
                  onClick={handleToggleKnown}
                  className={`size-7 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                    isKnown
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  }`}
                  title={isKnown ? "已标记掌握 (斩词)，点击取消标熟" : "一键标熟 (斩词)，移出复习队列"}
                >
                  <CheckIcon className={`size-3.5 ${isKnown ? "stroke-[2.5]" : ""}`} />
                </button>

                {/* 心形收藏/加入生词本 */}
                <button
                  type="button"
                  onClick={handleToggleHarvest}
                  className={`size-7 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                    isHarvested
                      ? "text-rose-500"
                      : "text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10"
                  }`}
                  title={isHarvested ? "已收录至生词本，点击取消" : "收藏该单词与上下文例句"}
                >
                  <HeartIcon className={`size-3.5 ${isHarvested ? "fill-current" : ""}`} />
                </button>

                {/* 复制 */}
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="size-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
                  title="复制词条释义"
                >
                  {copied ? <CheckCheckIcon className="size-3.5 text-emerald-500" /> : <CopyIcon className="size-3.5" />}
                </button>

                {/* 关闭 */}
                <button
                  type="button"
                  onClick={onClose}
                  className="size-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
                  title="关闭"
                >
                  <XIcon className="size-3.5" />
                </button>
              </div>
            </div>

            {/* 2. 音标与真人发音栏 */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <button
                type="button"
                onClick={() => setAccent(accent === "us" ? "uk" : "us")}
                className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer"
                title="点击切换美音/英音"
              >
                {accent.toUpperCase()}
              </button>

              <span className="font-mono text-xs text-muted-foreground/90 tracking-wide">
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
                title="播放真人发音"
              >
                <Volume2Icon className="size-3.5" />
              </button>

              {/* 词形还原或考纲信息 */}
              {lemmatized.isInflected && (
                <>
                  <span className="text-border">|</span>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    原形: {lemmatized.baseLemma}
                  </span>
                </>
              )}
            </div>

            {/* 3. 释义区：纯粹排版，去除生硬中括号 */}
            <div className="flex flex-col gap-1.5 my-0.5">
              {loading ? (
                <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground py-2">
                  <Loader2Icon className="size-3.5 animate-spin text-primary" />
                  <span>正在精查柯林斯词典...</span>
                </div>
              ) : defItems.length > 0 ? (
                defItems.map((item, idx) => (
                  <div key={idx} className="flex items-baseline gap-2 text-xs leading-relaxed">
                    <span className="font-serif italic font-semibold text-primary shrink-0 w-6">
                      {item.label.replace(/[\[\]]/g, "").trim()}
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
                    : "暂无本地离线释义，可点击右下角调用 AI 解析"}
                </div>
              )}
            </div>

            {/* 4. 语境释义微栏 */}
            {contextSentence && (
              <div className="rounded-xl bg-muted/40 border-l-2 border-primary/60 px-2.5 py-1.5 text-[11.5px] text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">当前句义：</span>
                {getCleanContextMeaning(aiResult, entry, word)}
              </div>
            )}

            {/* 5. 底部信息行：无 Emoji 状态指示点与 AI 深度精析 */}
            <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span
                  className={`size-1.5 rounded-full ${
                    isKnown
                      ? "bg-emerald-500"
                      : userCard
                      ? "bg-primary"
                      : "bg-muted-foreground/30"
                  }`}
                />
                <span>
                  {isKnown
                    ? "已完全掌握"
                    : userCard
                    ? `已复习 ${userCard.reps || 0} 次`
                    : "未收录至生词本"}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setShowAiInsight(true)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:opacity-80 transition-opacity cursor-pointer"
                title="AI 深度语境解析与语法释义"
              >
                <SparklesIcon className="size-3" />
                <span>AI 语境精析 →</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ==================== AI 语境深度解析弹窗 (Centered 2-Column Modal Dialog) ==================== */}
      {showAiInsight && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/45 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => {
            setShowAiInsight(false)
            onClose()
          }}
        >
          {/* 弹出的 2 列模态卡片 */}
          <div
            ref={aiModalRef}
            className="relative w-full max-w-4xl max-h-[85vh] rounded-2xl sm:rounded-3xl border border-border bg-card shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-[1.42fr_1fr] select-text animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
          >
            {/* 左侧：正文阅读区 + 译文对照 (无多余边框与标签，译文自然排布在英文下方) */}
            <div className="p-6 sm:p-7 bg-muted/20 dark:bg-zinc-900/40 flex flex-col gap-4 overflow-y-auto border-b md:border-b-0 md:border-r border-border">
              {/* 英文段落 */}
              <div className="font-serif text-base sm:text-[17px] leading-relaxed text-foreground select-text">
                {renderHighlightedText(
                  contextParagraph || contextSentence || entry?.sampleSentence || `“${word}” 在当前语境中的真实应用`,
                  entry?.lemma || word
                )}
              </div>

              {/* 中文译文：直接放于下方，不加外框，不特意标示标签，沉浸自然 */}
              <div className="text-sm sm:text-[14px] leading-relaxed text-muted-foreground/90 font-sans select-text">
                {contextParagraphTranslation || contextTrans || (
                  contextTransLoading ? (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                      <Loader2Icon className="size-3.5 animate-spin text-primary" />
                      <span>正在获取精准译文...</span>
                    </span>
                  ) : (
                    "正在实时解析当前语境翻译..."
                  )
                )}
              </div>
            </div>

            {/* 右侧：AI 语境工作台 (移除多余顶部栏，词头直出，纯粹聚焦核心字段与近义辨析) */}
            <div className="p-6 sm:p-7 bg-card flex flex-col gap-3.5 overflow-y-auto">
              {/* 顶部词头与操作：单词、词性、发音与关闭 */}
              <div className="flex items-center justify-between pb-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">
                    {entry?.lemma || word}
                  </span>
                  <span className="font-serif italic font-semibold text-sm sm:text-base text-primary">
                    {entry?.pos ? `[${entry.pos.replace(/[\[\]]/g, "").trim()}]` : "[v.]"}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => playPronunciation(entry?.lemma || word, accent === "us" ? entry?.audioUs : entry?.audioUk)}
                    className={`p-1.5 rounded-lg text-muted-foreground hover:text-primary transition-colors cursor-pointer ${
                      isPlayingAudio ? "text-primary animate-pulse" : ""
                    }`}
                    title="播放真人发音"
                  >
                    <Volume2Icon className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAiInsight(false)
                      onClose()
                    }}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors cursor-pointer"
                    title="关闭弹窗"
                  >
                    <XIcon className="size-4" />
                  </button>
                </div>
              </div>

              {/* 未配置 AI 引导 */}
              {!aiConfig.isConfigured ? (
                <div className="p-5 rounded-2xl bg-muted/30 border border-dashed border-border/80 flex flex-col items-center text-center gap-3 my-auto">
                  <div className="size-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                    <AlertCircleIcon className="size-5" />
                  </div>
                  <div className="space-y-1">
                    <h5 className="text-xs font-bold text-foreground">尚未配置 AI 大模型 API Key</h5>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      配置后即可针对当前主干句获得核心释义、句法剖析与近义词辨析。
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
                /* 优雅骨架屏加载状态 */
                <div className="space-y-3 animate-pulse py-2">
                  <div className="rounded-xl border border-border bg-muted/30 p-3.5 space-y-2.5">
                    <div className="h-3.5 bg-muted-foreground/15 rounded w-3/4" />
                    <div className="h-3.5 bg-muted-foreground/15 rounded w-5/6" />
                    <div className="h-3.5 bg-muted-foreground/15 rounded w-1/2" />
                  </div>
                  <div className="rounded-xl bg-muted/30 p-3 h-16" />
                </div>
              ) : (
                /* 核心分析卡片与近义辨析卡片 */
                <div className="flex flex-col gap-3">
                  {/* 核心分析区域 (核心释义、句法成分、常用短语) */}
                  <div className="border border-border/80 rounded-xl p-3.5 bg-muted/30 dark:bg-muted/20 flex flex-col gap-2 text-xs sm:text-[12.5px] leading-relaxed">
                    <div>
                      <span className="font-bold text-foreground">核心释义：</span>
                      <span className="text-foreground/90 font-medium">{getCleanContextMeaning(aiResult, entry, word)}</span>
                    </div>
                    <div>
                      <span className="font-bold text-foreground">句法成分：</span>
                      <span className="text-muted-foreground">
                        {aiResult?.grammarRole && !isThinkingNoise(aiResult.grammarRole)
                          ? aiResult.grammarRole.replace(/<[^>]+>/g, "").trim()
                          : "在当前主干句中充当核心动词与谓语成分"}
                      </span>
                    </div>
                    <div>
                      <span className="font-bold text-foreground">常用短语：</span>
                      <span className="font-mono text-[11px] text-primary font-medium">
                        {aiResult?.collocations && aiResult.collocations.filter((c) => !isThinkingNoise(c)).length > 0
                          ? aiResult.collocations
                              .filter((c) => !isThinkingNoise(c))
                              .slice(0, 3)
                              .map((c) => c.replace(/<[^>]+>/g, "").trim())
                              .join(" · ")
                          : `${entry?.lemma || word} the pace of · ${entry?.lemma || word} transformation`}
                      </span>
                    </div>
                  </div>

                  {/* 近义辨析气泡卡片 */}
                  <div className="bg-muted/40 dark:bg-muted/30 border border-border/40 rounded-xl p-3 text-xs sm:text-[12.5px] leading-relaxed text-muted-foreground">
                    <strong className="text-foreground font-semibold">近义辨析：</strong>
                    <span>
                      {aiResult?.usageNote && !isThinkingNoise(aiResult.usageNote)
                        ? aiResult.usageNote.replace(/<[^>]+>/g, "").trim()
                        : entry?.synonyms
                        ? `近义词辨析参考：${entry.synonyms}`
                        : `${entry?.lemma || word} 强调提升速率或抽象演变，区别于日常通俗物理提速与行政事务提速。`}
                    </span>
                  </div>
                </div>
              )}

              {/* 底部收录按钮 */}
              <div className="mt-auto pt-4 border-t border-border/40">
                <button
                  type="button"
                  onClick={handleToggleHarvest}
                  className={`w-full h-10 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm ${
                    isHarvested
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  }`}
                >
                  {isHarvested ? (
                    <>
                      <CheckIcon className="size-4 stroke-[2.5]" />
                      <span>已收录此语境解析卡片</span>
                    </>
                  ) : (
                    <span>收录此语境解析卡片</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  )
}
