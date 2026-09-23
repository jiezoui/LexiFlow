"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import {
  SparklesIcon,
  Volume2Icon,
  RotateCcwIcon,
  CheckCircle2Icon,
  XCircleIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  ClockIcon,
  PartyPopperIcon,
  RefreshCwIcon,
  CheckIcon,
  SlidersHorizontalIcon,
  VolumeXIcon,
  FlameIcon,
  LayersIcon,
  AwardIcon,
  ZapIcon,
  MicIcon,
  XIcon,
  KeyboardIcon,
  Trash2Icon,
} from "lucide-react"
import {
  reviewApi,
  type ReviewQueueCard,
  type NewWordQuiz,
  type TodayReviewSummary,
  parseJsonArray,
  parseIeltsUsage,
} from "@/lib/api-client"
import { KeystrokeCardPanel } from "@/components/practice/keystroke-card-panel"

type StudyMode = "REVIEW" | "LEARN"

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export default function CardsPage() {
  const [activeMode, setActiveMode] = useState<StudyMode>("REVIEW")

  // 本轮会话中已完成的卡片追踪 (供学完/复习完后开启单词默写)
  const [completedReviewCards, setCompletedReviewCards] = useState<ReviewQueueCard[]>([])
  const [completedLearnCards, setCompletedLearnCards] = useState<NewWordQuiz[]>([])

  // 通关挑战会话状态 (阶段完成后的高价值加固考核)
  const [challengeSession, setChallengeSession] = useState<{
    active: boolean
    sourceType: "AFTER_REVIEW" | "AFTER_LEARN"
    cards: ReviewQueueCard[]
    currentIndex: number
  }>({
    active: false,
    sourceType: "AFTER_REVIEW",
    cards: [],
    currentIndex: 0,
  })

  // 语音状态管理 (包含单词真人原声与例句高保真朗读)
  const [autoSpeak, setAutoSpeak] = useState<boolean>(true)
  const [isPlayingWord, setIsPlayingWord] = useState<boolean>(false)
  const [isPlayingSentence, setIsPlayingSentence] = useState<boolean>(false)
  const activeAudioRef = useRef<HTMLAudioElement | null>(null)

  // 1. 复习模式状态
  const [reviewQueue, setReviewQueue] = useState<ReviewQueueCard[]>([])
  const [reviewIndex, setReviewIndex] = useState<number>(0)
  const [isFlipped, setIsFlipped] = useState<boolean>(false)

  // 2. 背新词模式状态
  const [learnQueue, setLearnQueue] = useState<NewWordQuiz[]>([])
  const [learnIndex, setLearnIndex] = useState<number>(0)
  const [selectedOptionKey, setSelectedOptionKey] = useState<string | null>(null)
  const [showLearnDetail, setShowLearnDetail] = useState<boolean>(false)
  const [isOptionCorrect, setIsOptionCorrect] = useState<boolean | null>(null)

  // 答对自动流转定时器与状态
  const autoAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [isAutoAdvancing, setIsAutoAdvancing] = useState<boolean>(false)
  const isOptionCorrectRef = useRef<boolean | null>(null)

  // 回退查看已学单词偏移量 (0 为当前新词, -1 为前 1 词, -2 为前 2 词，严格最多回退 2 词)
  const [learnRewindOffset, setLearnRewindOffset] = useState<number>(0)

  // 每次研习新词数量设定 (用户可自定义每组词数，默认 10 词/组，持久化至 localStorage)
  const [learnBatchSize, setLearnBatchSize] = useState<number>(10)
  const [showBatchModal, setShowBatchModal] = useState<boolean>(false)
  const [customBatchInput, setCustomBatchInput] = useState<string>("10")

  // 客户端挂载后从 localStorage 安全恢复自定义组容量，杜绝 SSR 水合不一致
  useEffect(() => {
    try {
      const saved = localStorage.getItem("lexiflow_learn_batch_size")
      if (saved) {
        const val = parseInt(saved, 10)
        if (!isNaN(val) && val > 0) {
          const clamped = Math.min(100, Math.max(3, val))
          setLearnBatchSize(clamped)
          setCustomBatchInput(String(clamped))
        }
      }
    } catch {}
  }, [])

  // 本组新词是否研习完毕 (用于锁定展示结算通关看板的两个模块)
  const [isLearnGroupCompleted, setIsLearnGroupCompleted] = useState<boolean>(false)

  // 清空闪卡弹窗与操作状态 (区分复习与新词)
  const [showClearModal, setShowClearModal] = useState<boolean>(false)
  const [clearingCards, setClearingCards] = useState<boolean>(false)

  // 全局状态
  const [loading, setLoading] = useState<boolean>(true)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [todaySummary, setTodaySummary] = useState<TodayReviewSummary | null>(null)
  const [lastFeedback, setLastFeedback] = useState<string | null>(null)
  const [sessionCount, setSessionCount] = useState<number>(0)

  // 立即停止所有正在播放的语音 (避免重叠串音)
  const stopAllAudio = useCallback(() => {
    if (activeAudioRef.current) {
      activeAudioRef.current.pause()
      activeAudioRef.current.currentTime = 0
      activeAudioRef.current = null
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel()
    }
    setIsPlayingWord(false)
    setIsPlayingSentence(false)
  }, [])

  // 页面卸载或重置时停止播放与清理定时器
  useEffect(() => {
    return () => {
      stopAllAudio()
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current)
        autoAdvanceTimerRef.current = null
      }
    }
  }, [stopAllAudio])

  // 加载数据 (支持传入自定义批次大小，内建 4s 看门狗超时保护杜绝死锁)
  const loadAllQueues = useCallback(
    async (customBatchSize?: number) => {
      // 设立 4s 看门狗超时保护，防止极端网络波动或死锁导致无休止转圈
      let watchdogTimer: NodeJS.Timeout | null = null
      const timeoutPromise = new Promise<{ isTimeout: true }>((resolve) => {
        watchdogTimer = setTimeout(() => resolve({ isTimeout: true }), 4000)
      })

      try {
        setLoading(true)
        stopAllAudio()
        const targetBatchSize = customBatchSize || learnBatchSize
        const fetchPromise = Promise.all([
          reviewApi.getQueue(30).catch(() => [] as ReviewQueueCard[]),
          reviewApi.getNewQueue(targetBatchSize).catch(() => [] as NewWordQuiz[]),
          reviewApi.getTodaySummary().catch(() => null),
        ])

        const res = await Promise.race([fetchPromise, timeoutPromise])
        if (watchdogTimer) clearTimeout(watchdogTimer)

        if ("isTimeout" in res) {
          console.warn("loadAllQueues watchdog triggered: API response took longer than 4000ms")
          return
        }

        const [revCards, learnCards, summary] = res

        setReviewQueue(revCards || [])
        setLearnQueue(learnCards || [])
        setTodaySummary(summary)

        setReviewIndex(0)
        setIsFlipped(false)
        setLearnIndex(0)
        setIsLearnGroupCompleted(false)
        resetLearnState()
      } catch (e) {
        console.warn("Failed to load review/learn queues:", e)
      } finally {
        if (watchdogTimer) clearTimeout(watchdogTimer)
        setLoading(false)
      }
    },
    [stopAllAudio, learnBatchSize]
  )

  useEffect(() => {
    loadAllQueues()
  }, [loadAllQueues])

  const resetLearnState = () => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current)
      autoAdvanceTimerRef.current = null
    }
    setIsAutoAdvancing(false)
    setSelectedOptionKey(null)
    setShowLearnDetail(false)
    setIsOptionCorrect(null)
    isOptionCorrectRef.current = null
    setLearnRewindOffset(0)
  }

  // 保存并应用每组单词数量设定
  const handleSaveBatchSize = (newSize: number) => {
    const cleanSize = Math.max(3, Math.min(100, Math.floor(newSize)))
    setLearnBatchSize(cleanSize)
    setCustomBatchInput(String(cleanSize))
    try {
      localStorage.setItem("lexiflow_learn_batch_size", String(cleanSize))
    } catch {}
    setShowBatchModal(false)
    setLastFeedback(`已设定每次研习新词数量为 ${cleanSize} 词/组`)
    setTimeout(() => setLastFeedback(null), 3000)

    // 重新拉取新词队列并从头开始研习
    loadAllQueues(cleanSize)
  }

  // 清空闪卡队列处理函数 (支持仅清空当前模式或一键彻底净空全部闪卡)
  const handleConfirmClearCards = async (clearAll: boolean = false) => {
    if (clearingCards) return
    try {
      setClearingCards(true)
      stopAllAudio()
      if (clearAll) {
        const res = await reviewApi.clearAllCards()
        setReviewQueue([])
        setReviewIndex(0)
        setIsFlipped(false)
        setCompletedReviewCards([])
        setLearnQueue([])
        setLearnIndex(0)
        resetLearnState()
        setCompletedLearnCards([])
        setIsLearnGroupCompleted(false)
        setLastFeedback(res.message || "已成功彻底清空全部闪卡")
      } else if (activeMode === "REVIEW") {
        const res = await reviewApi.clearReviewQueue()
        setReviewQueue([])
        setReviewIndex(0)
        setIsFlipped(false)
        setCompletedReviewCards([])
        setLastFeedback(res.message || "已成功清空复习闪卡")
      } else {
        const res = await reviewApi.clearNewWordsQueue()
        setLearnQueue([])
        setLearnIndex(0)
        resetLearnState()
        setCompletedLearnCards([])
        setIsLearnGroupCompleted(false)
        setLastFeedback(res.message || "已成功清空未学新词闪卡")
      }
      setTimeout(() => setLastFeedback(null), 3500)
      setShowClearModal(false)
      await loadAllQueues(learnBatchSize)
    } catch (err: unknown) {
      alert(`清空闪卡失败: ${getErrorMessage(err, "服务异常")}`)
    } finally {
      setClearingCards(false)
    }
  }

  // 播放单词原声发音：权威真人原声 CDN + 浏览器 Web Speech API 降级
  const playWordAudio = useCallback(
    (word: string, onEnded?: () => void, accent: "us" | "uk" = "us") => {
      if (!word || typeof window === "undefined") return

      stopAllAudio()
      setIsPlayingWord(true)

      const audioUrl = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=${accent === "us" ? 2 : 1}`
      const audio = new Audio(audioUrl)
      activeAudioRef.current = audio

      let finished = false
      const triggerEnd = () => {
        if (finished) return
        finished = true
        setIsPlayingWord(false)
        activeAudioRef.current = null
        onEnded?.()
      }

      audio.onended = triggerEnd
      audio.onerror = () => {
        if ("speechSynthesis" in window) {
          const utterance = new SpeechSynthesisUtterance(word)
          utterance.lang = accent === "us" ? "en-US" : "en-GB"
          utterance.rate = 0.92
          utterance.onend = triggerEnd
          utterance.onerror = triggerEnd
          window.speechSynthesis.speak(utterance)
        } else {
          triggerEnd()
        }
      }

      audio.play().catch(() => {
        if ("speechSynthesis" in window) {
          const utterance = new SpeechSynthesisUtterance(word)
          utterance.lang = accent === "us" ? "en-US" : "en-GB"
          utterance.rate = 0.92
          utterance.onend = triggerEnd
          utterance.onerror = triggerEnd
          window.speechSynthesis.speak(utterance)
        } else {
          triggerEnd()
        }
      })
    },
    [stopAllAudio]
  )

  // 播放例句朗读 (高平稳自然度 Web Speech API，支持任意单句单点重播)
  const playSentenceAudio = useCallback(
    (sentence: string, onEnded?: () => void) => {
      if (!sentence || typeof window === "undefined") return

      stopAllAudio()
      setIsPlayingSentence(true)

      if ("speechSynthesis" in window) {
        // 清理首尾可能残留的引号
        const cleanText = sentence.replace(/^[“"']+|[”"']+$/g, "").trim()
        const utterance = new SpeechSynthesisUtterance(cleanText)
        utterance.lang = "en-US"
        utterance.rate = 0.88 // 设定为 0.88x 适中语速，确保连读弱读清晰可闻
        utterance.pitch = 1.0

        let finished = false
        const triggerEnd = () => {
          if (finished) return
          finished = true
          setIsPlayingSentence(false)
          onEnded?.()
        }

        utterance.onend = triggerEnd
        utterance.onerror = triggerEnd
        window.speechSynthesis.speak(utterance)
      } else {
        setIsPlayingSentence(false)
        onEnded?.()
      }
    },
    [stopAllAudio]
  )

  // 链式播放：播放完单词读音后，自然延迟 300ms 紧接着朗读下方例句
  const playWordThenSentence = useCallback(
    (word: string, sentence?: string | null) => {
      if (!autoSpeak) return
      playWordAudio(word, () => {
        if (sentence && sentence.trim().length > 0) {
          const timer = setTimeout(() => {
            playSentenceAudio(sentence)
          }, 300)
          return () => clearTimeout(timer)
        }
      })
    },
    [autoSpeak, playWordAudio, playSentenceAudio]
  )

  const currentReviewCard = reviewQueue[reviewIndex]
  const currentLearnCard = learnQueue[learnIndex]

  // 回退查看已学词状态：最多只可回退查看前两个已学单词 (offset: 0 为当前新词, -1 为前 1 词, -2 为前 2 词)
  const maxRewindCount = Math.min(2, learnIndex)
  const displayingLearnCard =
    learnRewindOffset < 0 && learnIndex + learnRewindOffset >= 0
      ? learnQueue[learnIndex + learnRewindOffset]
      : currentLearnCard

  // 新词模式：初次进入新卡片或回退查看已学词时自动播音单词一次
  useEffect(() => {
    if (activeMode === "LEARN" && displayingLearnCard && autoSpeak) {
      const timer = setTimeout(() => {
        playWordAudio(displayingLearnCard.lemma)
      }, 350)
      return () => clearTimeout(timer)
    }
  }, [activeMode, learnIndex, learnRewindOffset, displayingLearnCard?.cardId, autoSpeak, playWordAudio])

  // 复习模式：翻转展示释义瞬间，同步自动播音
  const handleFlipCard = () => {
    const nextFlipped = !isFlipped
    setIsFlipped(nextFlipped)
    if (nextFlipped && autoSpeak && currentReviewCard) {
      playWordAudio(currentReviewCard.lemma)
    }
  }

  // 提交复习评分
  const handleReviewRating = async (rating: 1 | 2 | 3 | 4) => {
    if (!currentReviewCard || submitting) return
    try {
      setSubmitting(true)
      stopAllAudio()
      const res = await reviewApi.submitRating({
        cardId: currentReviewCard.cardId,
        rating,
        reviewDurationMs: 3000,
      })

      const ratingLabel = rating === 1 ? "遗忘重学" : rating === 2 ? "困难" : rating === 3 ? "良好" : "简单"
      setLastFeedback(`已记录 [${currentReviewCard.lemma}] · 评分: ${ratingLabel} · 调度至: ${res.intervalText} 后`)
      setTimeout(() => setLastFeedback(null), 3000)

      setSessionCount((prev) => prev + 1)
      setIsFlipped(false)

      // 记录到本轮已完成复习列表 (供阶段通关考核调用)
      setCompletedReviewCards((prev) => {
        if (prev.some((c) => c.cardId === currentReviewCard.cardId)) return prev
        return [...prev, currentReviewCard]
      })

      if (reviewIndex + 1 < reviewQueue.length) {
        setReviewIndex((prev) => prev + 1)
      } else {
        await loadAllQueues()
      }
    } catch (err: unknown) {
      alert(`评分提交失败: ${getErrorMessage(err, "服务异常")}`)
    } finally {
      setSubmitting(false)
    }
  }

  // 新词转复习卡片适配器 (供学完新词后的单词默写调用)
  const convertQuizToReviewCard = (quiz: NewWordQuiz): ReviewQueueCard => ({
    cardId: quiz.cardId,
    wordId: quiz.wordId,
    lemma: quiz.lemma,
    phoneticUs: quiz.phoneticUs,
    phoneticUk: quiz.phoneticUk,
    pos: quiz.pos,
    definitionCn: quiz.definitionCn,
    definitionEn: "",
    audioUs: quiz.audioUs,
    contextSentence: quiz.sampleSentence,
    contextTranslation: quiz.sampleTranslation,
    source: "WORDBOOK",
    state: 0,
    stability: 0.5,
    difficulty: 5.0,
    reps: 0,
    nextIntervals: { 1: "10m", 2: "1d", 3: "3d", 4: "6d" },
  })

  // 启动阶段终极通关击键考核 (在复习完或学完后触发)
  const startKeystrokeChallenge = (sourceType: "AFTER_REVIEW" | "AFTER_LEARN") => {
    let targetCards: ReviewQueueCard[] = []
    if (sourceType === "AFTER_REVIEW") {
      targetCards = completedReviewCards.length > 0 ? completedReviewCards : reviewQueue
    } else {
      targetCards = completedLearnCards.length > 0
        ? completedLearnCards.map(convertQuizToReviewCard)
        : learnQueue.map(convertQuizToReviewCard)
    }

    if (targetCards.length === 0) {
      alert("当前没有可供考核的单词，请先进行一轮复习或研习！")
      return
    }

    stopAllAudio()
    setChallengeSession({
      active: true,
      sourceType,
      cards: targetCards,
      currentIndex: 0,
    })
  }

  // 巩固复习模式：独立一键直接默单词 (跳过翻卡，直接开启击键拼写加固)
  const handleDirectReviewDictation = useCallback((fromCurrent: boolean = true) => {
    let targetCards: ReviewQueueCard[] = []
    if (reviewQueue.length > 0) {
      targetCards = fromCurrent && reviewIndex > 0
        ? reviewQueue.slice(reviewIndex)
        : reviewQueue
    } else if (completedReviewCards.length > 0) {
      targetCards = completedReviewCards
    }

    if (targetCards.length === 0) {
      alert("当前复习队列中暂无可默写的单词，请先在词书库导入词书或添加生词！")
      return
    }

    stopAllAudio()
    setChallengeSession({
      active: true,
      sourceType: "AFTER_REVIEW",
      cards: targetCards,
      currentIndex: 0,
    })
  }, [reviewQueue, reviewIndex, completedReviewCards, stopAllAudio])

  // 退出阶段击键默写考核，平滑回到常规卡片流
  const exitChallenge = useCallback(() => {
    stopAllAudio()
    setChallengeSession({ active: false, sourceType: "AFTER_REVIEW", cards: [], currentIndex: 0 })
    setIsLearnGroupCompleted(false)
    setCompletedLearnCards([])
  }, [stopAllAudio])

  // 通关考核中的单卡完成
  const handleChallengeComplete = async (
    rating: 1 | 2 | 3 | 4,
    telemetry: { reactionTimeMs: number; typingDurationMs: number; backspaces: number; hints: number }
  ) => {
    const currentCard = challengeSession.cards[challengeSession.currentIndex]
    if (!currentCard || submitting) return
    try {
      setSubmitting(true)
      stopAllAudio()
      const totalDuration = telemetry.reactionTimeMs + telemetry.typingDurationMs
      const res = await reviewApi.submitRating({
        cardId: currentCard.cardId,
        rating,
        reviewDurationMs: totalDuration,
      })

      const ratingLabel = rating === 1 ? "遗忘" : rating === 2 ? "困难" : rating === 3 ? "良好" : "简单"
      setLastFeedback(
        `默写完成 [${currentCard.lemma}] · 评级: ${ratingLabel} · 调度至: ${res.intervalText} 后`
      )
      setTimeout(() => setLastFeedback(null), 3000)

      setTimeout(() => {
        if (challengeSession.currentIndex + 1 < challengeSession.cards.length) {
          setChallengeSession((prev) => ({ ...prev, currentIndex: prev.currentIndex + 1 }))
        } else {
          // 全部通关！
          setChallengeSession({ active: false, sourceType: "AFTER_REVIEW", cards: [], currentIndex: 0 })
          setLastFeedback("本轮单词默写全部完成，记忆参数已同步更新。")
          setIsLearnGroupCompleted(false)
          setCompletedLearnCards([])
          loadAllQueues(learnBatchSize)
        }
      }, 750)
    } catch (err: unknown) {
      alert(`考核提交失败: ${getErrorMessage(err, "服务异常")}`)
    } finally {
      setSubmitting(false)
    }
  }

  // 通关考核中的单卡认输
  const handleChallengeGiveUp = async () => {
    const currentCard = challengeSession.cards[challengeSession.currentIndex]
    if (!currentCard || submitting) return
    try {
      setSubmitting(true)
      stopAllAudio()
      await reviewApi.submitRating({
        cardId: currentCard.cardId,
        rating: 1,
        reviewDurationMs: 3500,
      })
      setTimeout(() => {
        if (challengeSession.currentIndex + 1 < challengeSession.cards.length) {
          setChallengeSession((prev) => ({ ...prev, currentIndex: prev.currentIndex + 1 }))
        } else {
          setChallengeSession({ active: false, sourceType: "AFTER_REVIEW", cards: [], currentIndex: 0 })
          setIsLearnGroupCompleted(false)
          setCompletedLearnCards([])
          loadAllQueues(learnBatchSize)
        }
      }, 750)
    } catch (err: unknown) {
      alert(`操作失败: ${getErrorMessage(err, "服务异常")}`)
    } finally {
      setSubmitting(false)
    }
  }

  // 回退查看已学单词 (严格限制最多回退查看前 2 个已学单词)
  const handleRewindLearnWord = useCallback(() => {
    if (learnIndex === 0) return
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current)
      autoAdvanceTimerRef.current = null
      setIsAutoAdvancing(false)
    }
    const maxRewind = Math.min(2, learnIndex)
    setLearnRewindOffset((prev) => {
      const next = prev - 1
      return next < -maxRewind ? -maxRewind : next
    })
  }, [learnIndex])

  // 回退查看中向后翻看
  const handleAdvanceLearnWord = useCallback(() => {
    setLearnRewindOffset((prev) => {
      if (prev >= 0) return 0
      const next = prev + 1
      return next > 0 ? 0 : next
    })
  }, [])

  // 从回退模式返回当前正在学习的新词进度
  const handleReturnToCurrentLearn = useCallback(() => {
    setLearnRewindOffset(0)
  }, [])

  // 新词模式：提交进入下一个词 (支持手动点击或答对后 900ms 自动流转)
  const handleNextNewWord = useCallback(async (overrideIsCorrect?: boolean) => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current)
      autoAdvanceTimerRef.current = null
    }
    setIsAutoAdvancing(false)

    // 如果当前处于回退查看已学词模式，点击或按 Enter 恢复至当前最新学习进度
    if (learnRewindOffset < 0) {
      setLearnRewindOffset(0)
      return
    }

    if (!currentLearnCard || submitting) return
    try {
      setSubmitting(true)
      stopAllAudio()
      const finalCorrect =
        overrideIsCorrect !== undefined
          ? overrideIsCorrect
          : (isOptionCorrectRef.current ?? isOptionCorrect ?? false)
      const action = finalCorrect ? "LEARNED" : "AGAIN"
      await reviewApi.submitNewWord({
        cardId: currentLearnCard.cardId,
        action,
        durationMs: 2500,
      })

      setLastFeedback(
        finalCorrect
          ? `已纳管新词 [${currentLearnCard.lemma}] · 纳入明日复习`
          : `↺ 已记录 [${currentLearnCard.lemma}] · 需重点回炉加固`
      )
      setTimeout(() => setLastFeedback(null), 3000)

      setSessionCount((prev) => prev + 1)
      setCompletedLearnCards((prev) => {
        if (prev.some((c) => c.cardId === currentLearnCard.cardId)) return prev
        return [...prev, currentLearnCard]
      })
      resetLearnState()

      if (learnIndex + 1 < learnQueue.length) {
        setLearnIndex((prev) => prev + 1)
      } else {
        // 本组单词全部学完！进入阶段通关看板，保留两个核心模块供用户选择
        setIsLearnGroupCompleted(true)
        reviewApi.getTodaySummary().then(setTodaySummary).catch(() => {})
      }
    } catch (err: unknown) {
      alert(`新词提交失败: ${getErrorMessage(err, "服务异常")}`)
    } finally {
      setSubmitting(false)
    }
  }, [
    currentLearnCard,
    submitting,
    isOptionCorrect,
    learnRewindOffset,
    learnIndex,
    learnQueue.length,
    stopAllAudio,
  ])

  // 新词模式：用户选择释义选项
  const handleSelectOption = useCallback((key: string, isCorrect: boolean) => {
    if (showLearnDetail || learnRewindOffset < 0) return
    setSelectedOptionKey(key)
    setIsOptionCorrect(isCorrect)
    isOptionCorrectRef.current = isCorrect
    setShowLearnDetail(true)

    if (!isCorrect) {
      // 答错了：不自动跳转，让用户看全解析，播放完单词读音之后再播放下面的例句
      setIsAutoAdvancing(false)
      if (currentLearnCard) {
        playWordThenSentence(currentLearnCard.lemma, currentLearnCard.sampleSentence)
      }
    } else {
      // 答对了：播放单词原声，等待 900ms 直接自动流转跳转到下一个单词
      if (autoSpeak && currentLearnCard) {
        playWordAudio(currentLearnCard.lemma)
      }
      setIsAutoAdvancing(true)
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current)
      }
      autoAdvanceTimerRef.current = setTimeout(() => {
        handleNextNewWord(true)
      }, 900)
    }
  }, [
    showLearnDetail,
    learnRewindOffset,
    currentLearnCard,
    autoSpeak,
    playWordAudio,
    playWordThenSentence,
    handleNextNewWord,
  ])

  // 新词模式：点击「不认识 / 看详解」
  const handleShowExplanation = useCallback(() => {
    if (showLearnDetail || learnRewindOffset < 0) return
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current)
      autoAdvanceTimerRef.current = null
    }
    setIsAutoAdvancing(false)
    setIsOptionCorrect(false)
    isOptionCorrectRef.current = false
    setShowLearnDetail(true)

    // 不认识同样执行：播放完单词读音之后再播放下面的例句，不自动流转，需手动跳转
    if (currentLearnCard) {
      playWordThenSentence(currentLearnCard.lemma, currentLearnCard.sampleSentence)
    }
  }, [showLearnDetail, learnRewindOffset, currentLearnCard, playWordThenSentence])

  // 新词模式：点击「已熟练 / 直接斩词」
  const handleKillWord = useCallback(async () => {
    if (learnRewindOffset < 0) {
      setLearnRewindOffset(0)
      return
    }
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current)
      autoAdvanceTimerRef.current = null
    }
    setIsAutoAdvancing(false)

    if (!currentLearnCard || submitting) return
    try {
      setSubmitting(true)
      stopAllAudio()
      await reviewApi.submitNewWord({
        cardId: currentLearnCard.cardId,
        action: "KNOWN",
        durationMs: 1500,
      })

      setLastFeedback(`已斩词 [${currentLearnCard.lemma}] · 永久移出复习流`)
      setTimeout(() => setLastFeedback(null), 3000)

      setSessionCount((prev) => prev + 1)
      resetLearnState()

      if (learnIndex + 1 < learnQueue.length) {
        setLearnIndex((prev) => prev + 1)
      } else {
        // 本组单词全部学完！进入阶段通关看板，保留两个核心模块供用户选择
        setIsLearnGroupCompleted(true)
        reviewApi.getTodaySummary().then(setTodaySummary).catch(() => {})
      }
    } catch (err: unknown) {
      alert(`斩词操作失败: ${getErrorMessage(err, "服务异常")}`)
    } finally {
      setSubmitting(false)
    }
  }, [
    learnRewindOffset,
    currentLearnCard,
    submitting,
    learnIndex,
    learnQueue.length,
    stopAllAudio,
  ])

  // 键盘快捷键监听
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      if (challengeSession.active) {
        return
      }

      // 通用音频快捷键：按 W 重播单词，按 S 重播例句
      const keyUpper = e.key.toUpperCase()
      if (keyUpper === "W") {
        e.preventDefault()
        if (activeMode === "REVIEW" && currentReviewCard) {
          playWordAudio(currentReviewCard.lemma)
        } else if (activeMode === "LEARN" && displayingLearnCard) {
          playWordAudio(displayingLearnCard.lemma)
        }
        return
      }

      if (keyUpper === "S") {
        e.preventDefault()
        if (activeMode === "REVIEW" && isFlipped && currentReviewCard?.contextSentence) {
          playSentenceAudio(currentReviewCard.contextSentence)
        } else if (
          activeMode === "LEARN" &&
          (showLearnDetail || learnRewindOffset < 0) &&
          displayingLearnCard?.sampleSentence
        ) {
          playSentenceAudio(displayingLearnCard.sampleSentence)
        }
        return
      }

      // 复习模式快捷键
      if (activeMode === "REVIEW") {
        if (keyUpper === "D") {
          e.preventDefault()
          handleDirectReviewDictation(true)
          return
        }
        if (e.code === "Space") {
          e.preventDefault()
          handleFlipCard()
        } else if (isFlipped) {
          if (e.key === "1") handleReviewRating(1)
          if (e.key === "2") handleReviewRating(2)
          if (e.key === "3") handleReviewRating(3)
          if (e.key === "4") handleReviewRating(4)
        }
      }

      // 背新词模式快捷键
      if (activeMode === "LEARN" && displayingLearnCard) {
        // 回退查看已学词状态下
        if (learnRewindOffset < 0) {
          if (e.key === "ArrowLeft") {
            e.preventDefault()
            handleRewindLearnWord()
          } else if (e.key === "ArrowRight") {
            e.preventDefault()
            handleAdvanceLearnWord()
          } else if (e.code === "Space" || e.code === "Enter" || e.key === "Escape") {
            e.preventDefault()
            handleReturnToCurrentLearn()
          }
          return
        }

        // 正常学习中支持按左箭头回看
        if (e.key === "ArrowLeft" && learnIndex > 0) {
          e.preventDefault()
          handleRewindLearnWord()
          return
        }

        if (!showLearnDetail) {
          // 选项选择 A/B/C/D 或 1/2/3/4
          const opt = currentLearnCard?.options.find(
            (o, idx) => o.key === keyUpper || String(idx + 1) === e.key
          )
          if (opt) {
            handleSelectOption(opt.key, opt.isCorrect)
          } else if (e.code === "Space" || e.key === "0") {
            e.preventDefault()
            handleShowExplanation()
          } else if (keyUpper === "K") {
            handleKillWord()
          }
        } else {
          // 已展开释义时，按 Space 或 Enter 直接进入下一个词 (若正在倒计时则提前跳过)
          if (e.code === "Space" || e.code === "Enter") {
            e.preventDefault()
            handleNextNewWord()
          }
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [
    activeMode,
    isFlipped,
    showLearnDetail,
    learnRewindOffset,
    learnIndex,
    currentReviewCard,
    currentLearnCard,
    displayingLearnCard,
    submitting,
    isOptionCorrect,
    challengeSession.active,
    playWordAudio,
    playSentenceAudio,
    handleNextNewWord,
    handleSelectOption,
    handleShowExplanation,
    handleKillWord,
    handleReviewRating,
    handleRewindLearnWord,
    handleAdvanceLearnWord,
    handleReturnToCurrentLearn,
    handleDirectReviewDictation,
  ])

  return (
    <div className="flex flex-1 flex-col gap-2.5 sm:gap-3 p-2.5 md:p-3.5 pt-1 max-w-5xl mx-auto w-full">
      {/* ── 顶部顶栏：标题 + 双模切换器 (Segmented Control) + 指标浮标 ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
        <div className="flex-1 text-center">
          <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-foreground">
            语脉 · 记忆训练场
          </h1>
        </div>

        {/* 统计指标浮标 */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="rounded-2xl border border-border bg-card px-2.5 py-1 text-right shadow-2xs">
            <span className="text-[10px] font-mono text-muted-foreground block">
              {activeMode === "REVIEW" ? "待复习" : "新词池"}
            </span>
            <span className="text-sm font-bold font-mono text-foreground">
              {activeMode === "REVIEW"
                ? reviewQueue.length - reviewIndex
                : learnQueue.length - learnIndex}
            </span>
          </div>
          <div className="rounded-2xl border border-border bg-card px-2.5 py-1 text-right shadow-2xs">
            <span className="text-[10px] font-mono text-muted-foreground block">本轮已巩固</span>
            <span className="text-sm font-bold font-mono text-primary">+{sessionCount}</span>
          </div>
          <button
            onClick={() => loadAllQueues()}
            disabled={loading}
            className="p-1.5 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground transition-colors shadow-2xs"
            title="刷新队列"
          >
            <RefreshCwIcon className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* ── 模式切换分段按钮 + 自动播音开关 ── */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 p-1 sm:p-1.5 rounded-2xl border border-border/80 bg-muted/40 backdrop-blur-sm">
        {/* Dual Mode Switcher */}
        <div className="flex items-center gap-1 bg-card/80 p-1 rounded-xl border border-border/60">
          <button
            onClick={() => {
              if (challengeSession.active) {
                exitChallenge()
              }
              setActiveMode("REVIEW")
              setIsFlipped(false)
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeMode === "REVIEW" || challengeSession.active
                ? "bg-primary text-primary-foreground shadow-sm scale-100"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <RotateCcwIcon className="size-3.5" />
            <span>巩固复习</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeMode === "REVIEW" || challengeSession.active
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {Math.max(0, reviewQueue.length - reviewIndex)}
            </span>
          </button>

          <button
            onClick={() => {
              if (challengeSession.active) {
                exitChallenge()
              }
              setActiveMode("LEARN")
              resetLearnState()
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeMode === "LEARN" && !challengeSession.active
                ? "bg-primary text-primary-foreground shadow-sm scale-100"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <SparklesIcon className="size-3.5" />
            <span>研习新词</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeMode === "LEARN" && !challengeSession.active
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {Math.max(0, learnQueue.length - learnIndex)}
            </span>
          </button>
        </div>

        {/* 工具栏右侧：清空闪卡 + 自动播音开关 */}
        <div className="flex items-center gap-2">
          {/* 清空闪卡按键 (严格区分复习 vs 新词模式两个独立逻辑) */}
          <button
            type="button"
            onClick={() => setShowClearModal(true)}
            disabled={loading || clearingCards}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono transition-all border border-border/80 bg-card/80 hover:bg-rose-500/10 hover:border-rose-500/40 text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 shadow-2xs hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
            title={activeMode === "REVIEW" ? "清空当前复习闪卡队列" : "清空当前未学新词闪卡队列"}
          >
            <Trash2Icon className="size-3.5 text-rose-500/80" />
            <span>清空闪卡</span>
          </button>

          <button
            onClick={() => setAutoSpeak(!autoSpeak)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono transition-colors border ${
              autoSpeak
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground"
            }`}
            title={autoSpeak ? "已开启同步自动播音" : "已静音自动播音"}
          >
            {autoSpeak ? (
              <>
                <Volume2Icon className="size-3.5" />
                <span>声学同步 · 自动播音 [开]</span>
              </>
            ) : (
              <>
                <VolumeXIcon className="size-3.5" />
                <span>自动播音 [已关]</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── 核心工作区主体 ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[420px] rounded-3xl border border-border bg-card/60 backdrop-blur-sm">
          <RefreshCwIcon className="size-8 text-primary animate-spin" />
          <p className="mt-3 text-sm text-muted-foreground font-mono">
            正在拉取{activeMode === "REVIEW" ? "复习卡片" : "新词研习"}队列...
          </p>
        </div>
      ) : challengeSession.active ? (
        /* ==================== 模式 X：阶段强化 · 单词默写工作区 (归属复习强化，卡内聚合状态防滚动) ==================== */
        <div className="w-full">
          <KeystrokeCardPanel
            key={`${challengeSession.sourceType}-${challengeSession.cards[challengeSession.currentIndex].cardId}`}
            card={challengeSession.cards[challengeSession.currentIndex]}
            currentIndex={challengeSession.currentIndex}
            totalCards={challengeSession.cards.length}
            sourceType={challengeSession.sourceType}
            submitting={submitting}
            onComplete={handleChallengeComplete}
            onGiveUp={handleChallengeGiveUp}
            onExit={exitChallenge}
            playWordAudio={playWordAudio}
            playSentenceAudio={playSentenceAudio}
          />
        </div>
      ) : activeMode === "REVIEW" ? (
        /* ==================== 模式 A：巩固复习工作区 (FSRS) ==================== */
        reviewQueue.length === 0 || !currentReviewCard ? (
          completedReviewCards.length > 0 ? (
            /* 阶段完成结算看板：仅在刚刚完成了一轮复习打卡时呈现 */
            <div className="flex flex-col items-center justify-center text-center p-6 sm:p-10 min-h-[420px] rounded-3xl border border-border bg-gradient-to-b from-card via-card/95 to-card/90 shadow-md">
              <div className="size-14 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-3 ring-8 ring-emerald-500/5">
                <PartyPopperIcon className="size-7" />
              </div>
              <div className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                Review Session Complete · 阶段性记忆稳固
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight mt-1">
                今日复习队列初轮提取完成！
              </h2>
              <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground max-w-lg leading-relaxed">
                认知记忆节点已全部唤醒并打卡完成。推荐通过拼写默写或口语跟读进一步固化肌肉记忆：
              </p>

              {/* 3 个高价值通关选项卡 */}
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3.5 w-full max-w-2xl text-left">
                {/* 选项 1: 单词默写 */}
                <button
                  onClick={() => startKeystrokeChallenge("AFTER_REVIEW")}
                  className="group p-4 sm:p-5 rounded-2xl border-2 border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/70 transition-all flex flex-col justify-between shadow-xs hover:scale-[1.02] active:scale-[0.98]"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="size-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                        <ZapIcon className="size-4" />
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold">
                        拼写加固
                      </span>
                    </div>
                    <h4 className="font-bold text-sm text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400">
                      开始单词默写
                    </h4>
                    <p className="mt-1 text-[11px] text-muted-foreground leading-normal">
                      默写刚才复习过的 {completedReviewCards.length} 个单词，检验拼写并强化肌肉记忆
                    </p>
                  </div>
                  <div className="mt-3.5 flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400">
                    <span>开始默写</span>
                    <ArrowRightIcon className="size-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>

                {/* 选项 2: 影子跟读 */}
                <Link
                  href="/practice/shadowing"
                  className="group p-5 rounded-2xl border border-border bg-card hover:border-primary/50 hover:bg-muted/40 transition-all flex flex-col justify-between shadow-xs hover:scale-[1.02] active:scale-[0.98]"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                        <MicIcon className="size-4" />
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-bold">
                        多模态
                      </span>
                    </div>
                    <h4 className="font-bold text-sm text-foreground group-hover:text-primary">
                      前往影子跟读工坊
                    </h4>
                    <p className="mt-1 text-[11px] text-muted-foreground leading-normal">
                      模仿原声语流语调，自研词级动态规划即时纠错发音
                    </p>
                  </div>
                  <div className="mt-4 flex items-center gap-1 text-xs font-bold text-primary">
                    <span>开始跟读训练</span>
                    <ArrowRightIcon className="size-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>

                {/* 选项 3: 研习新词 */}
                <button
                  onClick={() => {
                    setActiveMode("LEARN")
                    resetLearnState()
                  }}
                  className="group p-5 rounded-2xl border border-border bg-card hover:border-primary/50 hover:bg-muted/40 transition-all flex flex-col justify-between shadow-xs hover:scale-[1.02] active:scale-[0.98]"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="size-8 rounded-xl bg-muted text-foreground flex items-center justify-center">
                        <SparklesIcon className="size-4" />
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-bold">
                        新词池
                      </span>
                    </div>
                    <h4 className="font-bold text-sm text-foreground group-hover:text-primary">
                      开启研习新词
                    </h4>
                    <p className="mt-1 text-[11px] text-muted-foreground leading-normal">
                      进入新词认知识记阶段，继续扩展词汇知识图谱
                    </p>
                  </div>
                  <div className="mt-4 flex items-center gap-1 text-xs font-bold text-muted-foreground group-hover:text-foreground">
                    <span>去识记新词</span>
                    <ArrowRightIcon className="size-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>
              </div>
            </div>
          ) : (
            /* 复习闪卡为空状态看板 (队列为空且未复习过卡片) */
            <div className="flex flex-col items-center justify-center text-center p-8 sm:p-12 min-h-[420px] rounded-3xl border border-border bg-card shadow-xs">
              <div className="size-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-4 ring-8 ring-emerald-500/5">
                <CheckCircle2Icon className="size-8" />
              </div>
              <div className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">
                Review Queue Clear · 复习队列暂无待复习单词
              </div>
              <h3 className="text-xl sm:text-2xl font-extrabold text-foreground">今日暂无待巩固复习的单词闪卡</h3>
              <p className="mt-2 text-xs sm:text-sm text-muted-foreground max-w-md leading-relaxed">
                太棒了！当前复习队列已全部清空，或今日所有到期卡片均已稳固。您可以切换至「研习新词」开始学习新单词，或前往词书库挑选导入新词书。
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => {
                    setActiveMode("LEARN")
                    resetLearnState()
                  }}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all shadow-xs flex items-center gap-1.5 hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <SparklesIcon className="size-3.5" />
                  <span>前往研习新词</span>
                </button>
                <Link
                  href="/wordbooks"
                  className="px-4 py-2 rounded-xl border border-border text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-muted transition-all flex items-center gap-1.5 shadow-2xs hover:scale-105 active:scale-95"
                >
                  <LayersIcon className="size-3.5" />
                  <span>去词书库挑选</span>
                </Link>
                <button
                  onClick={() => loadAllQueues()}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-muted transition-all flex items-center gap-1.5 shadow-2xs hover:scale-105 active:scale-95 cursor-pointer"
                  title="重新检查复习队列"
                >
                  <RefreshCwIcon className="size-3.5" />
                  <span>刷新检查</span>
                </button>
              </div>
            </div>
          )
        ) : (
          /* 复习卡片内部形态：纯净 3D 翻转卡片 (紧凑防滚动排版) */
          <div className="flex flex-col gap-3 sm:gap-3.5">
            <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
              <span>第 {reviewIndex + 1} / {reviewQueue.length} 张复习卡片 · S = {currentReviewCard.stability}d</span>
              <span className="text-[11px] font-mono text-primary font-bold">间隔复习加固</span>
            </div>

            {/* 3D 翻转卡片 */}
            <div
              onClick={handleFlipCard}
              className="group relative cursor-pointer min-h-[330px] sm:min-h-[350px] w-full rounded-3xl border border-border/80 bg-gradient-to-b from-card via-card/95 to-card/90 p-5 sm:p-6 shadow-lg transition-all hover:border-primary/50 flex flex-col justify-between select-none"
            >
              {/* 卡片顶栏元数据 */}
              <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-primary/10 text-primary">
                    {currentReviewCard.source || "WORDBOOK"}
                  </span>
                  <span className="text-xs font-mono text-muted-foreground">
                    {isFlipped ? "卡片背面 · 释义解析" : "卡片正面 · 记忆主动提取"}
                  </span>
                </div>

                {/* 顶栏右侧：小喇叭 + 每组词量 + 直接默单词 */}
                <div className="flex items-center gap-2">
                  {/* 小喇叭原声音频 */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      playWordAudio(currentReviewCard.lemma, undefined, "us")
                    }}
                    className={`p-1.5 sm:p-2 rounded-xl transition-all ${
                      isPlayingWord
                        ? "bg-primary text-primary-foreground scale-110 shadow-sm"
                        : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                    title="朗读单词原声 (快捷键 W)"
                  >
                    <Volume2Icon className={`size-4 ${isPlayingWord ? "animate-pulse" : ""}`} />
                  </button>

                  {/* 自定义每组词量设定 (迁移至卡内，支持即时修改) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setCustomBatchInput(String(learnBatchSize))
                      setShowBatchModal(true)
                    }}
                    className="px-2.5 py-1 rounded-xl bg-muted/60 hover:bg-muted text-xs font-mono text-muted-foreground hover:text-foreground transition-all flex items-center gap-1.5 border border-border/50 shadow-2xs hover:scale-105 active:scale-95 cursor-pointer"
                    title="自定义每组词量"
                  >
                    <SlidersHorizontalIcon className="size-3 text-primary" />
                    <span>每组 {learnBatchSize} 词</span>
                  </button>

                  {/* 直接默单词按钮 (迁移至卡内，支持快捷键 D) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDirectReviewDictation(true)
                    }}
                    className="px-2.5 py-1 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 transition-all shadow-2xs hover:scale-105 active:scale-95 cursor-pointer"
                    title="直接默写当前卡片及后续待复习词汇 (快捷键 D)"
                  >
                    <KeyboardIcon className="size-3.5 text-amber-500" />
                    <span>直接默单词</span>
                    <kbd className="hidden sm:inline-block rounded bg-amber-500/20 px-1.5 py-0.2 font-mono text-[9px] font-bold">
                      D
                    </kbd>
                  </button>
                </div>
              </div>

              {/* 卡片中心主体内容 */}
              <div className="py-2.5 sm:py-3.5 flex flex-col items-center justify-center text-center">
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-foreground font-serif">
                  {currentReviewCard.lemma}
                </h2>
                {currentReviewCard.phoneticUs && (
                  <p className="mt-1.5 font-mono text-xs sm:text-sm text-muted-foreground tracking-wide">
                    {currentReviewCard.phoneticUs}
                  </p>
                )}

                {/* 翻转后展示背面 */}
                {isFlipped ? (
                  <div className="mt-3 w-full max-w-xl animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-baseline justify-center gap-2 text-primary font-bold text-sm sm:text-base">
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-primary/10">
                        {currentReviewCard.pos || "n."}
                      </span>
                      <span>{currentReviewCard.definitionCn}</span>
                    </div>

                    {currentReviewCard.definitionEn && (
                      <p className="mt-1 text-xs sm:text-sm text-muted-foreground italic max-w-lg">
                        &ldquo;{currentReviewCard.definitionEn}&rdquo;
                      </p>
                    )}

                    {currentReviewCard.contextSentence && (
                      <div className="mt-2.5 text-left p-3 sm:p-3.5 rounded-xl bg-muted/40 border border-border/60 transition-all hover:border-primary/40 max-h-[95px] sm:max-h-[110px] overflow-y-auto">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
                            <SparklesIcon className="size-3 text-primary" />
                            <span>Context · 原生语境快照</span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              playSentenceAudio(currentReviewCard.contextSentence!)
                            }}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold transition-all ${
                              isPlayingSentence
                                ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/30 animate-pulse"
                                : "bg-primary/10 text-primary hover:bg-primary/20 hover:scale-105"
                            }`}
                            title="点击朗读原生语境句 (快捷键 S)"
                          >
                            <Volume2Icon className={`size-3 ${isPlayingSentence ? "animate-bounce" : ""}`} />
                            <span className="text-[10px]">{isPlayingSentence ? "朗读中..." : "朗读原句"}</span>
                            <kbd className="hidden sm:inline-block rounded bg-primary-foreground/20 px-1 py-0.2 font-mono text-[9px]">
                              S
                            </kbd>
                          </button>
                        </div>
                        <p className="text-xs sm:text-sm text-foreground leading-relaxed font-serif">
                          {currentReviewCard.contextSentence}
                        </p>
                        {currentReviewCard.contextTranslation && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {currentReviewCard.contextTranslation}
                          </p>
                        )}
                      </div>
                    )}

                    {(() => {
                      const syns = parseJsonArray(currentReviewCard.synonyms)
                      const ants = parseJsonArray(currentReviewCard.antonyms)
                      const dervs = parseJsonArray(currentReviewCard.derivatives)
                      const ielts = parseIeltsUsage(currentReviewCard.ieltsUsage)
                      const hasRel = syns.length > 0 || ants.length > 0 || dervs.length > 0 || !!ielts

                      if (!hasRel) return null

                      return (
                        <div className="mt-2 text-left flex flex-wrap items-center gap-1.5 text-[11px]">
                          {ielts && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium text-[10px]" title={ielts.scene}>
                              {ielts.label}
                            </span>
                          )}
                          {dervs.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-muted-foreground">
                              <b className="font-semibold text-[10px] text-primary/80">派生:</b>
                              {dervs.slice(0, 3).map((d) => (
                                <span key={d} className="px-1.5 py-0.5 rounded bg-primary/5 text-primary/90 font-mono text-[10px] border border-primary/20">
                                  {d}
                                </span>
                              ))}
                            </span>
                          )}
                          {syns.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-muted-foreground">
                              <b className="font-semibold text-[10px] text-emerald-600 dark:text-emerald-400">近:</b>
                              {syns.slice(0, 3).map((s) => (
                                <span key={s} className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-sans text-[10px]">
                                  {s}
                                </span>
                              ))}
                            </span>
                          )}
                          {ants.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-muted-foreground">
                              <b className="font-semibold text-[10px] text-rose-500 dark:text-rose-400">反:</b>
                              {ants.slice(0, 2).map((a) => (
                                <span key={a} className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-500 dark:text-rose-400 font-sans text-[10px]">
                                  {a}
                                </span>
                              ))}
                            </span>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                ) : (
                  currentReviewCard.contextSentence && (
                    <div className="mt-3 max-w-lg text-xs sm:text-sm text-muted-foreground leading-relaxed italic line-clamp-2">
                      &ldquo;{currentReviewCard.contextSentence}&rdquo;
                    </div>
                  )
                )}
              </div>

              {/* 卡片底栏提示 */}
              <div className="flex items-center justify-center gap-1.5 pt-3 border-t border-border/60 text-xs text-muted-foreground">
                <RotateCcwIcon className="size-3" />
                <span>
                  {isFlipped
                    ? autoSpeak
                      ? "释义已播音 · 按 [1-4] 评分 · [D] 默此词 · [W] 读词 · [S] 读句"
                      : "按 [1-4] 评分 · [D] 默此词 · [W] 读词 · [S] 读句"
                    : "点击卡片或按空格键 [Space] 翻转释义 · [D] 直接默单词 · [W] 读词"}
                </span>
              </div>
            </div>

            {/* 4 档 FSRS 科学评分按钮组 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <button
                onClick={() => handleReviewRating(1)}
                disabled={submitting}
                className="flex flex-col items-center justify-center p-2 sm:p-2.5 rounded-2xl border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/15 text-rose-600 dark:text-rose-400 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
              >
                <div className="flex items-center gap-1 text-xs font-extrabold">
                  <span className="font-mono text-[10px] opacity-70">[1]</span>
                  <span>遗忘 · Again</span>
                </div>
                <span className="text-[11px] font-mono font-bold mt-0.5 text-rose-500">
                  {currentReviewCard.nextIntervals?.[1] || "10m"}
                </span>
              </button>

              <button
                onClick={() => handleReviewRating(2)}
                disabled={submitting}
                className="flex flex-col items-center justify-center p-2 sm:p-2.5 rounded-2xl border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/15 text-amber-600 dark:text-amber-400 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
              >
                <div className="flex items-center gap-1 text-xs font-extrabold">
                  <span className="font-mono text-[10px] opacity-70">[2]</span>
                  <span>困难 · Hard</span>
                </div>
                <span className="text-[11px] font-mono font-bold mt-0.5 text-amber-500">
                  {currentReviewCard.nextIntervals?.[2] || "1d"}
                </span>
              </button>

              <button
                onClick={() => handleReviewRating(3)}
                disabled={submitting}
                className="flex flex-col items-center justify-center p-2 sm:p-2.5 rounded-2xl border border-sky-500/20 bg-sky-500/5 hover:bg-sky-500/15 text-sky-600 dark:text-sky-400 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
              >
                <div className="flex items-center gap-1 text-xs font-extrabold">
                  <span className="font-mono text-[10px] opacity-70">[3]</span>
                  <span>良好 · Good</span>
                </div>
                <span className="text-[11px] font-mono font-bold mt-0.5 text-sky-500">
                  {currentReviewCard.nextIntervals?.[3] || "3d"}
                </span>
              </button>

              <button
                onClick={() => handleReviewRating(4)}
                disabled={submitting}
                className="flex flex-col items-center justify-center p-2 sm:p-2.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
              >
                <div className="flex items-center gap-1 text-xs font-extrabold">
                  <span className="font-mono text-[10px] opacity-70">[4]</span>
                  <span>简单 · Easy</span>
                </div>
                <span className="text-[11px] font-mono font-bold mt-0.5 text-emerald-500">
                  {currentReviewCard.nextIntervals?.[4] || "6d"}
                </span>
              </button>
            </div>
          </div>
        )
      ) : (
        /* ==================== 模式 B：背新单词工作区 (四选一辨义 + 斩词跳过) ==================== */
        isLearnGroupCompleted ? (
          /* 阶段完成结算看板：本组新词研习完毕！保留剩下的两个核心模块 */
          <div className="flex flex-col items-center justify-center text-center p-6 sm:p-10 min-h-[420px] rounded-3xl border border-border bg-gradient-to-b from-card via-card/95 to-card/90 shadow-md animate-in fade-in zoom-in-95 duration-200">
            <div className="size-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3 ring-8 ring-primary/5">
              <AwardIcon className="size-7" />
            </div>
            <div className="text-xs font-mono font-bold text-primary uppercase tracking-wider">
              Group Completed · 本组 ({completedLearnCards.length || learnBatchSize} 词) 研习完毕
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight mt-1">
              本组新词研习完毕！
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground max-w-lg leading-relaxed">
              新词已完成四选一辨析与释义认知输入。建议立即进行单词默写强化肌肉记忆：
            </p>

            {/* 2 个核心保留模块 */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full max-w-xl text-left">
              {/* 模块 1: 新词单词默写 */}
              <button
                onClick={() => startKeystrokeChallenge("AFTER_LEARN")}
                className="group p-4 sm:p-5 rounded-2xl border-2 border-primary/40 bg-primary/5 hover:bg-primary/10 hover:border-primary/70 transition-all flex flex-col justify-between shadow-xs hover:scale-[1.02] active:scale-[0.98]"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="size-8 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
                      <ZapIcon className="size-4" />
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/20 text-primary font-bold">
                      拼写加固
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-foreground group-hover:text-primary">
                    开始新词默写
                  </h4>
                  <p className="mt-1 text-[11px] text-muted-foreground leading-normal">
                    默写刚才初学的新词，检验拼写并强化肌肉记忆
                  </p>
                </div>
                <div className="mt-3.5 flex items-center gap-1 text-xs font-bold text-primary">
                  <span>开始默写</span>
                  <ArrowRightIcon className="size-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>

              {/* 模块 2: 切换至巩固复习 */}
              <button
                onClick={() => {
                  setActiveMode("REVIEW")
                  setIsFlipped(false)
                  setIsLearnGroupCompleted(false)
                }}
                className="group p-5 rounded-2xl border border-border bg-card hover:border-primary/50 hover:bg-muted/40 transition-all flex flex-col justify-between shadow-xs hover:scale-[1.02] active:scale-[0.98]"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="size-8 rounded-xl bg-muted text-foreground flex items-center justify-center">
                      <RotateCcwIcon className="size-4" />
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-bold">
                      复习流
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-foreground group-hover:text-primary">
                    切换至巩固复习
                  </h4>
                  <p className="mt-1 text-[11px] text-muted-foreground leading-normal">
                    去巩固今日到期的其他复习卡片，保持艾宾浩斯稳固度
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-1 text-xs font-bold text-muted-foreground group-hover:text-foreground">
                  <span>去巩固复习</span>
                  <ArrowRightIcon className="size-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            </div>

            {/* 补充快捷操作：直接研习下一组或微调词量 */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => {
                  setIsLearnGroupCompleted(false)
                  setCompletedLearnCards([])
                  loadAllQueues(learnBatchSize)
                }}
                className="px-4 py-2 rounded-xl border border-border bg-card hover:bg-muted text-xs font-mono text-muted-foreground hover:text-foreground transition-all flex items-center gap-1.5 shadow-2xs"
              >
                <SparklesIcon className="size-3.5 text-primary" />
                <span>直接研习下一组 ({learnBatchSize} 词)</span>
              </button>
              <button
                onClick={() => {
                  setCustomBatchInput(String(learnBatchSize))
                  setShowBatchModal(true)
                }}
                className="px-3 py-2 rounded-xl border border-border/60 hover:border-border text-xs font-mono text-muted-foreground hover:text-foreground transition-all flex items-center gap-1"
              >
                <SlidersHorizontalIcon className="size-3" />
                <span>调整每组词量 ({learnBatchSize})</span>
              </button>
            </div>
          </div>
        ) : learnQueue.length === 0 || !displayingLearnCard ? (
          /* 新词池为空 */
          <div className="flex flex-col items-center justify-center text-center p-8 sm:p-12 min-h-[400px] rounded-3xl border border-border bg-card shadow-xs">
            <div className="size-16 rounded-full bg-muted text-muted-foreground flex items-center justify-center mb-4">
              <SparklesIcon className="size-8" />
            </div>
            <h3 className="text-xl font-bold text-foreground">词库新词池暂无待学词汇</h3>
            <p className="mt-2 text-xs sm:text-sm text-muted-foreground max-w-md">
              所有词汇已进入复习流或已标熟。您可以去词书库挑选新词书导入，或在文章阅读中划词采词。
            </p>
            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={() => {
                  setActiveMode("REVIEW")
                  setIsFlipped(false)
                }}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors shadow-xs"
              >
                去巩固复习
              </button>
              <Link
                href="/wordbooks"
                className="px-4 py-2 rounded-xl border border-border text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                去词书库挑选
              </Link>
            </div>
          </div>
        ) : (
          /* 背新词认知工作台主体 (舒适大卡片排版，四选一饱满大气，视口高利用率) */
          <div className="flex flex-col gap-2 sm:gap-2.5">
            <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
              <span>第 {learnIndex + 1} / {learnQueue.length} 个新词</span>

              {learnRewindOffset < 0 ? (
                <span className="text-amber-500 dark:text-amber-400 font-bold flex items-center gap-1">
                  <span>⏪ 回顾已学词模式 (前 {Math.abs(learnRewindOffset)} 词 · 上限 2 词)</span>
                </span>
              ) : (
                <span className="text-primary font-bold">新词初识编码阶段 (Encoding)</span>
              )}
            </div>

            {/* 新词大卡片 */}
            <div className="relative w-full rounded-3xl border border-border/80 bg-gradient-to-b from-card via-card/95 to-card/90 p-3.5 sm:p-4 md:p-5 shadow-lg flex flex-col justify-between">
              {/* 卡片顶栏 */}
              <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
                <div className="flex items-center gap-2">
                  {learnRewindOffset < 0 ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                      REWIND · 已学回顾 (前 {Math.abs(learnRewindOffset)} 词)
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      NEW WORD
                    </span>
                  )}
                  {displayingLearnCard.tags && (
                    <span className="text-[10px] font-mono text-muted-foreground">
                      #{displayingLearnCard.tags}
                    </span>
                  )}
                </div>

                {/* 顶栏右侧：小喇叭 + 每组词量选择 + 上一个回退功能 */}
                <div className="flex items-center gap-2">
                  {/* 小喇叭原声音频 */}
                  <button
                    type="button"
                    onClick={() => playWordAudio(displayingLearnCard.lemma, undefined, "us")}
                    className={`p-1.5 sm:p-2 rounded-xl transition-all ${
                      isPlayingWord
                        ? "bg-primary text-primary-foreground scale-110 shadow-sm"
                        : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                    title="朗读标准原声 (快捷键 W)"
                  >
                    <Volume2Icon className={`size-4 ${isPlayingWord ? "animate-pulse" : ""}`} />
                  </button>

                  {/* 迁移功能 1: 每组单词数量设定 */}
                  <button
                    type="button"
                    onClick={() => {
                      setCustomBatchInput(String(learnBatchSize))
                      setShowBatchModal(true)
                    }}
                    className="px-2.5 py-1 rounded-xl bg-muted/60 hover:bg-muted text-xs font-mono text-muted-foreground hover:text-foreground transition-all flex items-center gap-1.5 border border-border/50 shadow-2xs hover:scale-105 active:scale-95 cursor-pointer"
                    title="自定义每组学习数量"
                  >
                    <SlidersHorizontalIcon className="size-3 text-primary" />
                    <span>每组 {learnBatchSize} 词</span>
                  </button>

                  {/* 迁移功能 2: 回退「上一个」按钮（严格限制最多回退 2 词） */}
                  <button
                    type="button"
                    onClick={handleRewindLearnWord}
                    disabled={learnIndex === 0 || learnRewindOffset <= -maxRewindCount}
                    className={`px-2.5 py-1 rounded-xl text-xs font-mono flex items-center gap-1.5 border transition-all shadow-2xs ${
                      learnIndex === 0 || learnRewindOffset <= -maxRewindCount
                        ? "opacity-40 cursor-not-allowed border-border/40 text-muted-foreground"
                        : "bg-muted/60 hover:bg-primary/10 hover:text-primary hover:border-primary/40 text-muted-foreground border-border/50 hover:scale-105 active:scale-95 cursor-pointer"
                    }`}
                    title={
                      learnIndex === 0
                        ? "刚开始研习，暂无上一词"
                        : learnRewindOffset <= -maxRewindCount
                        ? `已达上限（最多只可回退查看前 ${maxRewindCount} 个已学单词）`
                        : `回退查看上一个已学词（快捷键 ←）`
                    }
                  >
                    <RotateCcwIcon className="size-3" />
                    <span>
                      {learnRewindOffset < 0
                        ? `已回退 (${Math.abs(learnRewindOffset)}/${maxRewindCount})`
                        : `上一个 (${maxRewindCount}/2)`}
                    </span>
                  </button>

                  {/* 回退模式下一键返回当前学习进度 */}
                  {learnRewindOffset < 0 && (
                    <button
                      type="button"
                      onClick={handleReturnToCurrentLearn}
                      className="px-2.5 py-1 rounded-xl text-xs font-mono bg-primary text-primary-foreground hover:bg-primary/90 transition-all flex items-center gap-1 shadow-xs hover:scale-105 active:scale-95 cursor-pointer"
                      title="返回当前正在学习的新词 (快捷键 Enter / Space)"
                    >
                      <span>返回进度 →</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 卡片中心：单词展示 */}
              <div className="py-1.5 sm:py-2 flex flex-col items-center justify-center text-center">
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-foreground font-serif">
                  {displayingLearnCard.lemma}
                </h2>
                {displayingLearnCard.phoneticUs && (
                  <p className="mt-0.5 font-mono text-xs sm:text-sm text-muted-foreground tracking-wide">
                    {displayingLearnCard.phoneticUs}
                  </p>
                )}
              </div>

              {/* 核心辨义区：四选一中文释义选择题（全状态保留展示，高度紧凑精致防拉伸） */}
              <div className="my-1.5 sm:my-2 grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5 w-full max-w-2xl mx-auto">
                {displayingLearnCard.options.map((opt) => {
                  const isSelected = selectedOptionKey === opt.key
                  let btnStyle = "border-border/80 bg-card hover:border-primary/50 hover:bg-muted/30"

                  if (learnRewindOffset < 0) {
                    if (opt.isCorrect) {
                      btnStyle = "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold shadow-sm ring-1 ring-emerald-500/20"
                    } else {
                      btnStyle = "opacity-40 border-border bg-muted/20"
                    }
                  } else if (showLearnDetail) {
                    if (opt.isCorrect) {
                      btnStyle = "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold shadow-sm ring-1 ring-emerald-500/20"
                    } else if (isSelected && !opt.isCorrect) {
                      btnStyle = "border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400 ring-1 ring-rose-500/20"
                    } else {
                      btnStyle = "opacity-40 border-border bg-muted/20"
                    }
                  }

                  const isReadOnlyOrDetail = learnRewindOffset < 0 || showLearnDetail

                  return (
                    <button
                      key={opt.key}
                      onClick={() => handleSelectOption(opt.key, opt.isCorrect)}
                      disabled={isReadOnlyOrDetail}
                      className={`flex items-center gap-2 sm:gap-2.5 px-3 py-2 sm:py-2.5 rounded-xl border text-left text-xs sm:text-sm font-medium transition-all min-h-[38px] sm:min-h-[42px] shadow-2xs ${
                        !isReadOnlyOrDetail
                          ? "active:scale-[0.99] hover:shadow-xs cursor-pointer"
                          : "cursor-default"
                      } ${btnStyle}`}
                    >
                      <span className="flex items-center justify-center size-5.5 sm:size-6 rounded-lg bg-muted text-xs font-mono font-bold shrink-0">
                        {opt.key}
                      </span>
                      <span className="flex-1 truncate leading-normal">{opt.text}</span>
                      {isReadOnlyOrDetail && opt.isCorrect && (
                        <CheckIcon className="size-4 text-emerald-500 shrink-0" />
                      )}
                      {learnRewindOffset === 0 && showLearnDetail && isSelected && !opt.isCorrect && (
                        <XCircleIcon className="size-4 text-rose-500 shrink-0" />
                      )}
                    </button>
                  )
                })}
              </div>

              {/* 答案解析展开区（答完/查看详解，或处于回退查看已学词时显示） */}
              {learnRewindOffset < 0 || showLearnDetail ? (
                <div className="mt-2 pt-2 border-t border-border/60 animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs sm:text-sm">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                        {displayingLearnCard.pos}
                      </span>
                      <span className="font-bold text-foreground text-sm sm:text-base">
                        {displayingLearnCard.definitionCn}
                      </span>
                    </div>

                    {displayingLearnCard.definitionEn && (
                      <span className="text-xs sm:text-sm text-muted-foreground italic truncate max-w-sm">
                        &ldquo;{displayingLearnCard.definitionEn}&rdquo;
                      </span>
                    )}
                  </div>

                  {displayingLearnCard.sampleSentence && (
                    <div className="mt-1.5 text-left p-2.5 sm:p-3 rounded-xl bg-muted/40 border border-border/60 transition-all hover:border-primary/40 shadow-2xs max-h-[72px] sm:max-h-[82px] overflow-y-auto">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-mono font-bold tracking-wider text-primary uppercase">
                          <SparklesIcon className="size-3.5" />
                          <span>Context Sentence · 语境真题例句</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => playSentenceAudio(displayingLearnCard.sampleSentence!)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold transition-all ${
                            isPlayingSentence
                              ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/30 animate-pulse"
                              : "bg-primary/10 text-primary hover:bg-primary/20 hover:scale-105"
                          }`}
                          title="点击再次播放例句 (快捷键 S)"
                        >
                          <Volume2Icon className={`size-3.5 ${isPlayingSentence ? "animate-bounce" : ""}`} />
                          <span className="text-[11px]">{isPlayingSentence ? "朗读中..." : "重听例句"}</span>
                          <kbd className="hidden sm:inline-block rounded bg-primary-foreground/20 px-1 py-0.2 font-mono text-[9px]">
                            S
                          </kbd>
                        </button>
                      </div>
                      <p className="text-xs sm:text-sm text-foreground leading-relaxed font-serif">
                        {displayingLearnCard.sampleSentence}
                      </p>
                      {displayingLearnCard.sampleTranslation && (
                        <p className="mt-0.5 text-xs text-muted-foreground font-sans">
                          {displayingLearnCard.sampleTranslation}
                        </p>
                      )}
                    </div>
                  )}

                  {(() => {
                    const syns = parseJsonArray(displayingLearnCard.synonyms)
                    const ants = parseJsonArray(displayingLearnCard.antonyms)
                    const dervs = parseJsonArray(displayingLearnCard.derivatives)
                    const ielts = parseIeltsUsage(displayingLearnCard.ieltsUsage)
                    const hasRel = syns.length > 0 || ants.length > 0 || dervs.length > 0 || !!ielts

                    if (!hasRel) return null

                    return (
                      <div className="mt-1.5 text-left flex flex-wrap items-center gap-1.5 text-[11px]">
                        {ielts && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium text-[10px]" title={ielts.scene}>
                            {ielts.label}
                          </span>
                        )}
                        {dervs.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <b className="font-semibold text-[10px] text-primary/80">派生:</b>
                            {dervs.slice(0, 3).map((d) => (
                              <span key={d} className="px-1.5 py-0.5 rounded bg-primary/5 text-primary/90 font-mono text-[10px] border border-primary/20">
                                {d}
                              </span>
                            ))}
                          </span>
                        )}
                        {syns.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <b className="font-semibold text-[10px] text-emerald-600 dark:text-emerald-400">近:</b>
                            {syns.slice(0, 3).map((s) => (
                              <span key={s} className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-sans text-[10px]">
                                {s}
                              </span>
                            ))}
                          </span>
                        )}
                        {ants.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <b className="font-semibold text-[10px] text-rose-500 dark:text-rose-400">反:</b>
                            {ants.slice(0, 2).map((a) => (
                              <span key={a} className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-500 dark:text-rose-400 font-sans text-[10px]">
                                {a}
                              </span>
                            ))}
                          </span>
                        )}
                      </div>
                    )
                  })()}
                </div>
              ) : null}

              {/* 底部辅助与控制栏 */}
              <div className="mt-2 pt-2 border-t border-border/60 flex flex-wrap items-center justify-between gap-2.5 text-xs sm:text-sm">
                {learnRewindOffset < 0 ? (
                  /* 回退查看模式底部操作栏 */
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleRewindLearnWord}
                        disabled={learnRewindOffset <= -maxRewindCount}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs transition-all ${
                          learnRewindOffset <= -maxRewindCount
                            ? "opacity-40 cursor-not-allowed border-border/40 text-muted-foreground"
                            : "border-border text-foreground hover:bg-muted cursor-pointer"
                        }`}
                        title={learnRewindOffset <= -maxRewindCount ? "最多只可回退前两个已学单词" : "查看更前一个已学词"}
                      >
                        <ArrowLeftIcon className="size-3.5" />
                        <span>更早前一词 ({Math.abs(learnRewindOffset)}/{maxRewindCount})</span>
                      </button>

                      {learnRewindOffset < -1 && (
                        <button
                          type="button"
                          onClick={handleAdvanceLearnWord}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-border text-xs text-foreground hover:bg-muted transition-all cursor-pointer"
                        >
                          <span>后一词</span>
                          <ArrowRightIcon className="size-3.5" />
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleReturnToCurrentLearn}
                      className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs sm:text-sm shadow-md hover:bg-primary/90 transition-all cursor-pointer"
                    >
                      <span>返回当前学习进度</span>
                      <kbd className="hidden sm:inline rounded bg-primary-foreground/20 px-1.5 py-0.2 font-mono text-[9px]">
                        Enter
                      </kbd>
                      <ArrowRightIcon className="size-4" />
                    </button>
                  </div>
                ) : (
                  /* 正常学习模式底部操作栏 */
                  <>
                    <div className="flex items-center gap-2">
                      {!showLearnDetail ? (
                        <>
                          <button
                            onClick={handleShowExplanation}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors font-medium cursor-pointer"
                          >
                            <span>不认识 / 看详解</span>
                            <kbd className="hidden sm:inline rounded bg-muted px-1.5 py-0.2 font-mono text-[9px]">
                              Space
                            </kbd>
                          </button>

                          <button
                            onClick={handleKillWord}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs text-muted-foreground hover:text-rose-500 transition-colors cursor-pointer"
                            title="太简单或早已熟练，直接斩词不复习"
                          >
                            <span>熟练斩词 (跳过)</span>
                            <kbd className="hidden sm:inline rounded bg-muted px-1.5 py-0.2 font-mono text-[9px]">
                              K
                            </kbd>
                          </button>
                        </>
                      ) : (
                        <div className="flex items-center gap-2">
                          {isOptionCorrect ? (
                            <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2Icon className="size-4 shrink-0 animate-bounce" />
                              <span className="animate-pulse">
                                回答正确！900ms 极速流转下一词...
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs sm:text-sm font-semibold text-muted-foreground">
                              需手动加固理解 · 已同步朗读 · 按 [S] 重听例句 · 确认后按 [Enter] 继续
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 下一个词按钮 (选完或查看全解后激活) */}
                    {showLearnDetail && (
                      <button
                        onClick={() => handleNextNewWord()}
                        disabled={submitting}
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all animate-in fade-in cursor-pointer ${
                          isOptionCorrect
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                            : "bg-primary text-primary-foreground hover:opacity-95"
                        }`}
                      >
                        <span>{isOptionCorrect ? "立即进入下一词" : "已理解 · 下一个新词"}</span>
                        <kbd className="hidden sm:inline rounded bg-black/20 dark:bg-white/20 px-1.5 py-0.2 font-mono text-[9px]">
                          Enter
                        </kbd>
                        <ArrowRightIcon className="size-4" />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )
      )}

      {/* ── 每次研习单词数量设定弹窗 (自定义每组词量) ── */}
      {showBatchModal && (
        <div
          onClick={() => setShowBatchModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl text-left animate-in zoom-in-95 duration-200"
          >
            {/* 弹窗顶栏 */}
            <div className="flex items-center justify-between pb-4 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <span className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <SlidersHorizontalIcon className="size-4" />
                </span>
                <div>
                  <h3 className="font-extrabold text-base text-foreground">每组研习词量设定</h3>
                  <p className="text-[10px] font-mono text-muted-foreground uppercase">Batch Size Configuration</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBatchModal(false)}
                className="size-8 rounded-xl border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
              >
                <XIcon className="size-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                设定每次研习新词时每组卡片的容量。每学完一组词汇，系统将自动触发结算通关看板（单词默写或切换复习），科学契合短期认知记忆跨度。
              </p>

              {/* 推荐预设档位 */}
              <div>
                <label className="text-[11px] font-mono font-bold text-muted-foreground block mb-2">
                  快速预设档位 (PRESETS)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[5, 10, 15, 20].map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => handleSaveBatchSize(size)}
                      className={`py-2 px-2 rounded-xl border text-xs font-mono font-bold transition-all ${
                        learnBatchSize === size
                          ? "border-primary bg-primary text-primary-foreground shadow-sm"
                          : "border-border bg-muted/40 text-foreground hover:bg-muted hover:border-primary/40"
                      }`}
                    >
                      {size} 词
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {[25, 30].map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => handleSaveBatchSize(size)}
                      className={`py-2 px-2.5 rounded-xl border text-xs font-mono font-bold transition-all ${
                        learnBatchSize === size
                          ? "border-primary bg-primary text-primary-foreground shadow-sm"
                          : "border-border bg-muted/40 text-foreground hover:bg-muted hover:border-primary/40"
                      }`}
                    >
                      {size} 词 / 组
                    </button>
                  ))}
                </div>
              </div>

              {/* 自定义词数输入 */}
              <div className="pt-3 border-t border-border/60">
                <label className="text-[11px] font-mono font-bold text-muted-foreground block mb-2">
                  自定义每组词数 (3 ~ 100 词)
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min={3}
                      max={100}
                      value={customBatchInput}
                      onChange={(e) => setCustomBatchInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const parsed = parseInt(customBatchInput, 10)
                          if (!isNaN(parsed) && parsed >= 3 && parsed <= 100) {
                            handleSaveBatchSize(parsed)
                          } else {
                            alert("请输入 3 ~ 100 之间的词量数值")
                          }
                        }
                      }}
                      className="w-full h-10 px-3.5 rounded-xl border border-border bg-background text-sm font-mono font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      placeholder="如 12"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground pointer-events-none">
                      词/组
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const parsed = parseInt(customBatchInput, 10)
                      if (!isNaN(parsed) && parsed >= 3 && parsed <= 100) {
                        handleSaveBatchSize(parsed)
                      } else {
                        alert("请输入 3 ~ 100 之间的词量数值")
                      }
                    }}
                    className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors shadow-xs shrink-0"
                  >
                    应用设定
                  </button>
                </div>
              </div>

              {/* 科学说明 */}
              <div className="p-3 rounded-2xl bg-primary/5 border border-primary/15 text-[11px] text-muted-foreground leading-relaxed flex items-start gap-2">
                <span>
                  <strong>认知心理学建议</strong>：每组 10~15 词最符合工作记忆广度（米勒法则）。学完一组后立刻进行单词默写检验，短时记忆向长时记忆转化率提升 40% 以上。
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 清空闪卡二次确认弹窗 (严格隔离区分复习模式与研习新词模式) ── */}
      {showClearModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => !clearingCards && setShowClearModal(false)}
        >
          <div
            className="relative w-full max-w-md rounded-3xl border border-rose-500/20 bg-card/95 p-6 shadow-2xl backdrop-blur-md animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="size-10 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-500/20">
                  <Trash2Icon className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    {activeMode === "REVIEW" ? "清空复习闪卡" : "清空未学新词"}
                  </h3>
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold mt-0.5">
                    {activeMode === "REVIEW" ? "复习模式 · 独立清空" : "研习新词 · 独立清空"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                disabled={clearingCards}
                className="size-8 rounded-full border border-border bg-muted/30 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors disabled:opacity-40 cursor-pointer"
              >
                <XIcon className="size-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs text-muted-foreground leading-relaxed">
              <p>
                {activeMode === "REVIEW" ? (
                  <>
                    确定要清空当前的<strong className="text-foreground">「复习闪卡队列」</strong>（共{" "}
                    <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                      {Math.max(0, reviewQueue.length - reviewIndex)}
                    </span>{" "}
                    词）吗？
                  </>
                ) : (
                  <>
                    确定要清空当前的<strong className="text-foreground">「未学新词闪卡」</strong>（共{" "}
                    <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                      {Math.max(0, learnQueue.length - learnIndex)}
                    </span>{" "}
                    词）吗？
                  </>
                )}
              </p>

              <div className="p-3 rounded-2xl bg-muted/50 border border-border/80 text-[11px] space-y-1.5 font-sans">
                {activeMode === "REVIEW" ? (
                  <>
                    <div className="flex items-center gap-1.5 text-foreground font-semibold">
                      <span className="size-1.5 rounded-full bg-rose-500"></span>
                      <span>复习独立逻辑：</span>
                    </div>
                    <p className="text-muted-foreground pl-3">
                      仅清理待复习词条（学习中、复习中与再学习），<strong>完全不会影响</strong>未学习的新词库与已掌握单词。
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5 text-foreground font-semibold">
                      <span className="size-1.5 rounded-full bg-rose-500"></span>
                      <span>新词独立逻辑：</span>
                    </div>
                    <p className="text-muted-foreground pl-3">
                      仅清理当前尚未研习的新生词闪卡，<strong>完全不会影响</strong>任何复习流中的旧单词或历史复习进度。
                    </p>
                  </>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => handleConfirmClearCards(true)}
                  disabled={clearingCards}
                  className="px-3 py-2 rounded-xl border border-rose-500/30 hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer text-center"
                  title="彻底清空当前用户所有复习闪卡与未学新词卡片，恢复绝对空白"
                >
                  彻底净空全部 (复习+新词)
                </button>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowClearModal(false)}
                    disabled={clearingCards}
                    className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConfirmClearCards(false)}
                    disabled={clearingCards}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {clearingCards ? (
                      <>
                        <RefreshCwIcon className="size-3.5 animate-spin" />
                        <span>正在清空...</span>
                      </>
                    ) : (
                      <>
                        <Trash2Icon className="size-3.5" />
                        <span>清空当前{activeMode === "REVIEW" ? "复习" : "新词"}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 全局悬浮灵动胶囊反馈 (Floating HUD Toast · 0 布局抖动与挤压) ── */}
      {lastFeedback && (
        <aside
          aria-live="polite"
          className="fixed top-5 left-1/2 -translate-x-1/2 z-50 pointer-events-auto flex items-center gap-2.5 px-4 py-2 rounded-full border border-border/80 bg-card/95 dark:bg-zinc-900/95 backdrop-blur-md shadow-2xl text-xs font-semibold animate-in fade-in slide-in-from-top-3 duration-200 ring-1 ring-border/50 max-w-[90vw]"
        >
          <span
            className={`size-6 rounded-full flex items-center justify-center shrink-0 ${
              lastFeedback.includes("遗忘") || lastFeedback.includes("Again")
                ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                : lastFeedback.includes("困难") || lastFeedback.includes("Hard")
                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                : lastFeedback.includes("良好") || lastFeedback.includes("Good")
                ? "bg-sky-500/15 text-sky-600 dark:text-sky-400"
                : lastFeedback.includes("盲打熟练")
                ? "bg-violet-500/15 text-violet-600 dark:text-violet-400"
                : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {lastFeedback.includes("遗忘") || lastFeedback.includes("Again") ? (
              <RotateCcwIcon className="size-3.5" />
            ) : lastFeedback.includes("困难") || lastFeedback.includes("Hard") ? (
              <ClockIcon className="size-3.5" />
            ) : lastFeedback.includes("良好") || lastFeedback.includes("Good") ? (
              <CheckCircle2Icon className="size-3.5" />
            ) : lastFeedback.includes("盲打熟练") ? (
              <ZapIcon className="size-3.5" />
            ) : (
              <CheckCircle2Icon className="size-3.5" />
            )}
          </span>
          <span className="text-foreground tracking-tight whitespace-nowrap overflow-hidden text-ellipsis max-w-[400px]">
            {lastFeedback}
          </span>
          <button
            type="button"
            onClick={() => setLastFeedback(null)}
            className="size-4 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition-colors ml-1 shrink-0"
            title="关闭提示"
          >
            <XIcon className="size-3" />
          </button>
        </aside>
      )}
    </div>
  )
}
