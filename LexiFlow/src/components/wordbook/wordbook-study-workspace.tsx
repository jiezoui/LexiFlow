"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  EyeIcon,
  EyeOffIcon,
  Volume2Icon,
  SearchIcon,
  XIcon,
  CheckSquareIcon,
  SquareIcon,
  SparklesIcon,
  FlameIcon,
  BookOpenIcon,
  RefreshCwIcon,
  LayersIcon,
  ClockIcon,
  CheckCircle2Icon,
  ZapIcon,
  CheckCheckIcon,
  ExternalLinkIcon,
  Trash2Icon,
  DownloadCloudIcon,
} from "lucide-react"
import {
  wordbookApi,
  type WordbookStudyItem,
  type WordbookStatusCounts,
  type Wordbook,
  parseJsonArray,
  parseIeltsUsage,
} from "@/lib/api-client"

type StudyStatusKey = "ALL" | "UNLEARNED" | "REVIEWING" | "COMPLETED" | "MASTERED"

interface WordbookStudyWorkspaceProps {
  bookId: number
  onClose?: () => void
  isDrawer?: boolean
}

export function WordbookStudyWorkspace({
  bookId,
  onClose,
  isDrawer = false,
}: WordbookStudyWorkspaceProps) {
  // 词书元数据与状态计数
  const [bookInfo, setBookInfo] = useState<Wordbook | null>(null)
  const [counts, setCounts] = useState<WordbookStatusCounts>({
    allCount: 0,
    unlearnedCount: 0,
    reviewingCount: 0,
    completedCount: 0,
    masteredCount: 0,
    masteredDates: [],
  })

  // 筛选与视图状态
  const [currentStatus, setCurrentStatus] = useState<StudyStatusKey>("ALL")
  const [selectedDate, setSelectedDate] = useState<string>("")
  const [searchKeyword, setSearchKeyword] = useState<string>("")
  const [isMasked, setIsMasked] = useState<boolean>(true) // 默认开启主动回忆盲测模式（纯英文）
  const [expandedWordIds, setExpandedWordIds] = useState<Set<number>>(new Set()) // 盲测模式下单词点击展开窥探

  // 单词列表与分页
  const [words, setWords] = useState<WordbookStudyItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [totalCount, setTotalCount] = useState<number>(0)
  const [page, setPage] = useState<number>(1)
  const pageSize = 50

  // 批量操作状态
  const [isBatchMode, setIsBatchMode] = useState<boolean>(false)
  const [selectedWordIds, setSelectedWordIds] = useState<Set<number>>(new Set())
  const [batchLoading, setBatchLoading] = useState<boolean>(false)

  // 播放状态与交互反馈
  const [playingWord, setPlayingWord] = useState<string | null>(null)
  const [playingSentence, setPlayingSentence] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const activeAudioRef = useRef<HTMLAudioElement | null>(null)

  const router = useRouter()
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false)
  const [isDeleting, setIsDeleting] = useState<boolean>(false)
  const [isPushingCycle, setIsPushingCycle] = useState<boolean>(false)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  const handlePushCycle = async () => {
    try {
      setIsPushingCycle(true)
      const res = await wordbookApi.importToVocab(bookId, 20)
      showToast(res.message || "已成功推入本周期 20 词！")
      await Promise.all([fetchCountsAndMeta(), fetchWordItems()])
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("lexiflow_wordbook_updated", { detail: { bookId } }))
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "推送失败"
      showToast(`推送失败: ${msg}`)
    } finally {
      setIsPushingCycle(false)
    }
  }

  const handleDeleteBook = async () => {
    try {
      setIsDeleting(true)
      await wordbookApi.delete(bookId)
      showToast("🗑️ 词书已删除")
      setShowDeleteModal(false)
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("lexiflow_wordbook_updated", { detail: { bookId } }))
      }
      if (onClose) {
        onClose()
      } else {
        router.push("/wordbooks")
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "删除失败"
      showToast(`删除失败: ${msg}`)
    } finally {
      setIsDeleting(false)
    }
  }

  // 停止所有正在发声的音频
  const stopAllAudio = useCallback(() => {
    if (activeAudioRef.current) {
      activeAudioRef.current.pause()
      activeAudioRef.current.currentTime = 0
      activeAudioRef.current = null
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel()
    }
    setPlayingWord(null)
    setPlayingSentence(null)
  }, [])

  // 播放单播发音 (优先美音音频，备选 Web Speech API)
  const playWordAudio = useCallback(
    (lemma: string, audioUrl?: string) => {
      stopAllAudio()
      setPlayingWord(lemma)

      if (audioUrl) {
        const audio = new Audio(audioUrl)
        activeAudioRef.current = audio
        audio.onended = () => setPlayingWord(null)
        audio.onerror = () => fallbackWebSpeech(lemma)
        audio.play().catch(() => fallbackWebSpeech(lemma))
      } else {
        fallbackWebSpeech(lemma)
      }

      function fallbackWebSpeech(word: string) {
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          const utterance = new SpeechSynthesisUtterance(word)
          utterance.lang = "en-US"
          utterance.rate = 0.95
          utterance.onend = () => setPlayingWord(null)
          utterance.onerror = () => setPlayingWord(null)
          window.speechSynthesis.speak(utterance)
        } else {
          setPlayingWord(null)
        }
      }
    },
    [stopAllAudio]
  )

  // 播放例句朗读
  const playSentenceAudio = useCallback(
    (sentence: string) => {
      if (!sentence) return
      stopAllAudio()
      setPlayingSentence(sentence)

      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const cleanText = sentence.replace(/^[“"']+|[”"']+$/g, "").trim()
        const utterance = new SpeechSynthesisUtterance(cleanText)
        utterance.lang = "en-US"
        utterance.rate = 0.9
        utterance.pitch = 1.0
        utterance.onend = () => setPlayingSentence(null)
        utterance.onerror = () => setPlayingSentence(null)
        window.speechSynthesis.speak(utterance)
      } else {
        setPlayingSentence(null)
      }
    },
    [stopAllAudio]
  )

  // 加载词书基本信息与统计计数
  const fetchCountsAndMeta = useCallback(async () => {
    try {
      const [countData, currentBook] = await Promise.all([
        wordbookApi.getStatusCounts(bookId),
        wordbookApi.getDetail(bookId).catch(() => null),
      ])
      setCounts(countData)
      if (currentBook) {
        setBookInfo(currentBook)
      } else {
        setBookInfo({
          id: bookId,
          title: `词书研习 #${bookId}`,
          description: "专业词库浸润式研习与多维记忆管理",
          category: "EXAM",
          coverUrl: "/covers/cet4.jpg",
          totalWords: countData.allCount,
          learnedWords: countData.reviewingCount + countData.completedCount + countData.masteredCount,
          masteredWords: countData.masteredCount,
          progressPercent: countData.allCount > 0 ? Math.round((countData.masteredCount / countData.allCount) * 100) : 0,
          createdAt: new Date().toISOString(),
        })
      }
    } catch (err) {
      console.warn("Fetch wordbook meta error:", err)
    }
  }, [bookId])

  // 加载单词列表
  const fetchWordItems = useCallback(async () => {
    try {
      setLoading(true)
      const queryParams: {
        page: number
        size: number
        status?: string
        date?: string
        keyword?: string
      } = {
        page,
        size: pageSize,
      }
      if (currentStatus !== "ALL") {
        queryParams.status = currentStatus
      }
      if (selectedDate && currentStatus === "MASTERED") {
        queryParams.date = selectedDate
      }
      if (searchKeyword.trim()) {
        queryParams.keyword = searchKeyword.trim()
      }

      const res = await wordbookApi.getStudyView(bookId, queryParams)
      setWords(res.records || [])
      setTotalCount(res.total || 0)
    } catch (err: unknown) {
      console.error("Fetch word items error:", err)
      const msg = err instanceof Error ? err.message : "请检查网络"
      showToast(`加载失败: ${msg}`)
    } finally {
      setLoading(false)
    }
  }, [bookId, currentStatus, selectedDate, searchKeyword, page])

  useEffect(() => {
    fetchCountsAndMeta()
  }, [fetchCountsAndMeta])

  useEffect(() => {
    fetchWordItems()
  }, [fetchWordItems])

  // 切换分类
  const handleSelectStatus = (status: StudyStatusKey) => {
    setCurrentStatus(status)
    setSelectedDate("")
    setPage(1)
    setSelectedWordIds(new Set())
    setExpandedWordIds(new Set())
  }

  // 切换日期
  const handleSelectDate = (date: string) => {
    setSelectedDate(date)
    setPage(1)
  }

  // 单词点击展开/折叠（在隐蔽模式下）
  const toggleWordExpand = (wordId: number) => {
    setExpandedWordIds((prev) => {
      const next = new Set(prev)
      if (next.has(wordId)) {
        next.delete(wordId)
      } else {
        next.add(wordId)
      }
      return next
    })
  }

  // 批量操作全选 / 取消全选
  const handleToggleSelectAll = () => {
    if (selectedWordIds.size === words.length && words.length > 0) {
      setSelectedWordIds(new Set())
    } else {
      setSelectedWordIds(new Set(words.map((w) => w.wordId)))
    }
  }

  // 批量选择单个单词
  const handleToggleWordSelect = (wordId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedWordIds((prev) => {
      const next = new Set(prev)
      if (next.has(wordId)) {
        next.delete(wordId)
      } else {
        next.add(wordId)
      }
      return next
    })
  }

  // 执行批量动作
  const handleExecuteBatch = async (action: "LEARN" | "MARK_KNOWN" | "RESET") => {
    if (selectedWordIds.size === 0) {
      showToast("请先选择要操作的单词")
      return
    }

    try {
      setBatchLoading(true)
      const res = await wordbookApi.batchAction(bookId, {
        wordIds: Array.from(selectedWordIds),
        action,
      })
      showToast(`🎉 ${res.message}`)
      setSelectedWordIds(new Set())
      await Promise.all([fetchCountsAndMeta(), fetchWordItems()])
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("lexiflow_wordbook_updated", { detail: { bookId } }))
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "后端处理异常"
      showToast(`操作失败: ${msg}`)
    } finally {
      setBatchLoading(false)
    }
  }

  // 导出所选单词为 CSV
  const handleExportSelected = () => {
    const targetWords = selectedWordIds.size > 0
      ? words.filter((w) => selectedWordIds.has(w.wordId))
      : words

    if (targetWords.length === 0) {
      showToast("当前没有可导出的单词")
      return
    }

    const headers = ["Word", "US Phonetic", "POS", "Chinese Definition", "Sample Sentence", "Status"]
    const rows = targetWords.map((w) => [
      `"${w.lemma.replace(/"/g, '""')}"`,
      `"${(w.phoneticUs || "").replace(/"/g, '""')}"`,
      `"${(w.pos || "").replace(/"/g, '""')}"`,
      `"${(w.definitionCn || "").replace(/"/g, '""')}"`,
      `"${(w.sampleSentence || "").replace(/"/g, '""')}"`,
      `"${w.studyStatus}"`,
    ])

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${bookInfo?.title || "LexiFlow_Wordbook"}_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
    showToast(`✅ 已成功导出 ${targetWords.length} 个单词`)
  }

  // 单个快捷操作
  const handleQuickMarkKnown = async (wordId: number, currentKnown: boolean, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await wordbookApi.batchAction(bookId, {
        wordIds: [wordId],
        action: currentKnown ? "RESET" : "MARK_KNOWN",
      })
      showToast(currentKnown ? "已取消标熟" : "⚔️ 已成功斩词标熟！")
      await Promise.all([fetchCountsAndMeta(), fetchWordItems()])
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("lexiflow_wordbook_updated", { detail: { bookId } }))
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "操作异常"
      showToast(`操作失败: ${msg}`)
    }
  }

  // 单个快捷推入学习
  const handleQuickPushLearn = async (wordId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await wordbookApi.batchAction(bookId, {
        wordIds: [wordId],
        action: "LEARN",
      })
      showToast("🚀 已推入今日闪卡研习！")
      await Promise.all([fetchCountsAndMeta(), fetchWordItems()])
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("lexiflow_wordbook_updated", { detail: { bookId } }))
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "操作异常"
      showToast(`操作失败: ${msg}`)
    }
  }

  // 分组数据（当为 MASTERED 且未指定单一日期时，按日期分组展示）
  const groupedWords = useMemo(() => {
    if (currentStatus !== "MASTERED" || selectedDate) {
      return null
    }
    const map = new Map<string, WordbookStudyItem[]>()
    words.forEach((item) => {
      const dateKey = item.masteredDate || "历史标熟"
      if (!map.has(dateKey)) {
        map.set(dateKey, [])
      }
      map.get(dateKey)!.push(item)
    })
    return Array.from(map.entries())
  }, [words, currentStatus, selectedDate])

  const statusCategories: {
    key: StudyStatusKey
    label: string
    count: number
    icon: React.ComponentType<{ className?: string }>
    color: string
  }[] = [
    { key: "ALL", label: "全部", count: counts.allCount, icon: BookOpenIcon, color: "text-foreground" },
    { key: "UNLEARNED", label: "未学习", count: counts.unlearnedCount, icon: ClockIcon, color: "text-sky-500" },
    { key: "REVIEWING", label: "复习中", count: counts.reviewingCount, icon: ZapIcon, color: "text-amber-500" },
    { key: "COMPLETED", label: "复习完成", count: counts.completedCount, icon: CheckCheckIcon, color: "text-emerald-500" },
    { key: "MASTERED", label: "已标熟", count: counts.masteredCount, icon: CheckCircle2Icon, color: "text-purple-500" },
  ]

  return (
    <div className="flex flex-1 flex-col h-full bg-background text-foreground relative overflow-y-auto">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-card/95 border border-primary/30 shadow-2xl text-xs font-semibold backdrop-blur-md animate-in fade-in slide-in-from-top-4">
          <SparklesIcon className="size-4 text-primary animate-spin" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Bar */}
      <header className="border-b border-border/80 bg-card/90 backdrop-blur-md sticky top-0 z-20 px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-extrabold tracking-tight text-foreground flex items-center gap-2">
                <span>{bookInfo?.title || "词书研习"}</span>
                <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  {bookInfo?.category || "EXAM"}
                </span>
              </h1>
              {isDrawer && (
                <Link
                  href={`/wordbooks/${bookId}`}
                  target="_blank"
                  className="text-muted-foreground hover:text-primary transition-colors p-1"
                  title="新标签页打开独立全屏"
                >
                  <ExternalLinkIcon className="size-3.5" />
                </Link>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">
              总词量 {counts.allCount} 词 · 标熟率{" "}
              {counts.allCount > 0 ? Math.round((counts.masteredCount / counts.allCount) * 100) : 0}% · 纯英盲测与发音研习
            </p>
          </div>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              fetchCountsAndMeta()
              fetchWordItems()
            }}
            disabled={loading}
            className="p-2 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground transition-colors"
            title="刷新数据"
          >
            <RefreshCwIcon className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="p-2 rounded-xl border border-border bg-card text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="删除此词书"
            aria-label="删除词书"
          >
            <Trash2Icon className="size-3.5" />
          </button>

          <button
            type="button"
            onClick={handlePushCycle}
            disabled={isPushingCycle || counts.unlearnedCount === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold hover:bg-emerald-500/20 transition-all active:scale-95 disabled:opacity-40 cursor-pointer shadow-2xs"
            title="将未学单词按顺序推入下一学习周期（20 词）至闪卡库"
          >
            <DownloadCloudIcon className={`size-3.5 ${isPushingCycle ? "animate-bounce" : ""}`} />
            <span className="hidden sm:inline">{isPushingCycle ? "推送中..." : "推入周期 (20词)"}</span>
          </button>

          <Link
            href="/cards"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-sm hover:bg-primary/90 transition-all active:scale-95"
          >
            <FlameIcon className="size-3.5" />
            <span className="hidden sm:inline">闪卡研习</span>
          </Link>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors ml-1"
              title="关闭详情 (Esc)"
            >
              <XIcon className="size-4" />
            </button>
          )}
        </div>
      </header>

      {/* Delete Confirmation Modal in Workspace */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md rounded-3xl border border-destructive/30 bg-card p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-2xl bg-destructive/10 text-destructive shrink-0">
                <Trash2Icon className="size-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">确认删除当前词书？</h2>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                  您即将删除「<span className="font-semibold text-foreground">{bookInfo?.title || "此词书"}</span>」。
                  包含 <span className="font-mono font-semibold text-foreground">{counts.allCount}</span> 个词条。
                </p>
                <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-[11px] leading-relaxed">
                  ⚠️ 此操作将永久移除该词书的所有大纲词条。已添加到个人生词本复习的单词将保留在记忆库中，不会丢失。
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleDeleteBook}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-destructive text-destructive-foreground text-xs font-bold shadow-sm hover:bg-destructive/90 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? <RefreshCwIcon className="size-3.5 animate-spin" /> : <Trash2Icon className="size-3.5" />}
                <span>{isDeleting ? "正在删除..." : "确认删除"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Study Body */}
      <div className="p-4 sm:p-6 flex-1 flex flex-col md:flex-row gap-6">
        {/* Left Sidebar */}
        <aside className="w-full md:w-60 shrink-0 flex flex-col gap-4">
          <div className="rounded-3xl border border-border/80 bg-card/90 p-3.5 shadow-sm md:sticky md:top-20">
            <div className="flex items-center justify-between px-2 pb-2.5 border-b border-border/60">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1.5">
                <LayersIcon className="size-3.5 text-primary" /> 分类状态
              </span>
              <span className="text-[11px] font-mono text-muted-foreground">{counts.allCount} 词</span>
            </div>

            <nav className="mt-2.5 flex flex-col gap-1">
              {statusCategories.map((item) => {
                const Icon = item.icon
                const isActive = currentStatus === item.key
                return (
                  <div key={item.key} className="flex flex-col">
                    <button
                      onClick={() => handleSelectStatus(item.key)}
                      className={`flex items-center justify-between px-3 py-2 rounded-2xl text-xs font-medium transition-all text-left ${
                        isActive
                          ? "bg-primary text-primary-foreground font-bold shadow-sm"
                          : "hover:bg-muted text-foreground/80 hover:text-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={`size-3.5 shrink-0 ${isActive ? "text-primary-foreground" : item.color}`} />
                        <span>{item.label}</span>
                      </div>
                      <span className={`text-[11px] font-mono px-1.5 py-0.2 rounded-full ${
                        isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}>
                        {item.count}
                      </span>
                    </button>

                    {item.key === "MASTERED" && isActive && counts.masteredDates.length > 0 && (
                      <div className="mt-1 ml-4 pl-3 border-l-2 border-primary/30 flex flex-col gap-1 py-1">
                        <button
                          onClick={() => handleSelectDate("")}
                          className={`flex items-center justify-between px-2 py-1 rounded-lg text-[11px] ${
                            selectedDate === "" ? "bg-primary/10 text-primary font-bold" : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <span>全部日期</span>
                          <span className="font-mono">{counts.masteredCount}</span>
                        </button>
                        {counts.masteredDates.map((d) => (
                          <button
                            key={d.date}
                            onClick={() => handleSelectDate(d.date)}
                            className={`flex items-center justify-between px-2 py-1 rounded-lg text-[11px] ${
                              selectedDate === d.date ? "bg-primary/15 text-primary font-bold" : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <span className="font-mono">{d.date}</span>
                            <span className="font-mono text-[10px] opacity-80">{d.count}词</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </nav>
          </div>
        </aside>

        {/* Right Canvas */}
        <main className="flex-1 flex flex-col gap-4 min-w-0">
          {/* Toolbar */}
          <div className="rounded-3xl border border-border/80 bg-card/90 p-3 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 shadow-sm">
            <div className="relative flex-1 min-w-[180px] max-w-sm">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => {
                  setSearchKeyword(e.target.value)
                  setPage(1)
                }}
                placeholder="搜索当前分类单词/释义..."
                className="w-full h-8 pl-8 pr-7 rounded-xl border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {searchKeyword && (
                <button
                  onClick={() => setSearchKeyword("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <XIcon className="size-3" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setIsMasked(!isMasked)
                  setExpandedWordIds(new Set())
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                  isMasked
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
                    : "bg-card border-border text-foreground hover:bg-muted"
                }`}
              >
                {isMasked ? <EyeOffIcon className="size-3.5" /> : <EyeIcon className="size-3.5 text-primary" />}
                <span>{isMasked ? "盲测隐蔽中" : "释义全显"}</span>
              </button>

              <button
                onClick={() => {
                  setIsBatchMode(!isBatchMode)
                  setSelectedWordIds(new Set())
                }}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold border ${
                  isBatchMode ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-foreground hover:bg-muted"
                }`}
              >
                <CheckSquareIcon className="size-3.5" />
                <span>{isBatchMode ? "退出批量" : "批量操作"}</span>
              </button>
            </div>
          </div>

          {/* List Content */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 rounded-3xl border border-border/80 bg-card/50">
              <RefreshCwIcon className="size-7 text-primary animate-spin" />
              <p className="mt-2 text-xs text-muted-foreground">正在载入词书状态...</p>
            </div>
          ) : words.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 rounded-3xl border border-dashed border-border bg-card/30 text-center p-6">
              <BookOpenIcon className="size-8 text-muted-foreground/50 mb-2" />
              <p className="text-xs text-muted-foreground">暂无符合条件的单词</p>
            </div>
          ) : groupedWords ? (
            <div className="flex flex-col gap-5">
              {groupedWords.map(([dateKey, groupItems]) => (
                <div key={dateKey} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 px-1">
                    <span className="px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 text-xs font-mono font-bold">
                      {dateKey} ({groupItems.length}词)
                    </span>
                    <div className="flex-1 h-px bg-border/60" />
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {groupItems.map((word) => renderWordCard(word))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {words.map((word) => renderWordCard(word))}
            </div>
          )}

          {/* Pagination */}
          {totalCount > pageSize && (
            <div className="flex items-center justify-between py-2 px-1 text-xs text-muted-foreground">
              <span>共 {totalCount} 词</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-2.5 py-1 rounded-lg border border-border hover:bg-muted disabled:opacity-40 text-xs"
                >
                  上一页
                </button>
                <span className="font-mono text-xs">{page} / {Math.ceil(totalCount / pageSize)}</span>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= Math.ceil(totalCount / pageSize)}
                  className="px-2.5 py-1 rounded-lg border border-border hover:bg-muted disabled:opacity-40 text-xs"
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Floating Batch Bar */}
      {isBatchMode && (
        <div className="sticky bottom-4 mx-auto w-[92%] max-w-2xl p-3 rounded-2xl bg-card/95 border border-primary/30 shadow-2xl backdrop-blur-xl flex items-center justify-between gap-2 z-30 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-2">
            <button onClick={handleToggleSelectAll} className="text-xs font-semibold text-primary hover:underline">
              {selectedWordIds.size === words.length && words.length > 0 ? "取消全选" : "全选本页"}
            </button>
            <span className="text-xs text-muted-foreground">已选 {selectedWordIds.size} 词</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleExecuteBatch("LEARN")}
              disabled={batchLoading || selectedWordIds.size === 0}
              className="px-2.5 py-1 rounded-xl bg-primary text-primary-foreground text-xs font-bold disabled:opacity-40"
            >
              推入研习
            </button>
            <button
              onClick={() => handleExecuteBatch("MARK_KNOWN")}
              disabled={batchLoading || selectedWordIds.size === 0}
              className="px-2.5 py-1 rounded-xl bg-purple-600 text-white text-xs font-bold disabled:opacity-40"
            >
              标熟
            </button>
            <button
              onClick={() => handleExecuteBatch("RESET")}
              disabled={batchLoading || selectedWordIds.size === 0}
              className="px-2.5 py-1 rounded-xl border border-border text-xs disabled:opacity-40"
            >
              移回未学
            </button>
            <button
              onClick={handleExportSelected}
              disabled={words.length === 0}
              className="px-2.5 py-1 rounded-xl border border-border text-xs"
            >
              导出
            </button>
            <button onClick={() => setIsBatchMode(false)} className="p-1 text-muted-foreground hover:text-foreground">
              <XIcon className="size-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )

  function renderWordCard(word: WordbookStudyItem) {
    const isSelected = selectedWordIds.has(word.wordId)
    const isPeeked = expandedWordIds.has(word.wordId)
    const isWordMasked = isMasked && !isPeeked

    return (
      <article
        key={word.wordId}
        onClick={() => isMasked && toggleWordExpand(word.wordId)}
        className={`group rounded-2xl border transition-all p-3 bg-card/90 hover:shadow-sm ${
          isSelected ? "border-primary ring-2 ring-primary/20 bg-primary/5" : "border-border/80 hover:border-primary/40"
        } ${isMasked ? "cursor-pointer" : ""}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 flex-1 min-w-0">
            {isBatchMode && (
              <button onClick={(e) => handleToggleWordSelect(word.wordId, e)} className="mt-0.5 text-muted-foreground hover:text-primary">
                {isSelected ? <CheckSquareIcon className="size-4 text-primary" /> : <SquareIcon className="size-4" />}
              </button>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-bold font-serif tracking-tight text-foreground group-hover:text-primary transition-colors">
                  {word.lemma}
                </span>

                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    playWordAudio(word.lemma, word.audioUs)
                  }}
                  className={`p-1 rounded-lg text-muted-foreground hover:text-primary ${playingWord === word.lemma ? "text-primary animate-pulse" : ""}`}
                  title="发音"
                >
                  <Volume2Icon className="size-3.5" />
                </button>

                {!isWordMasked && (word.phoneticUs || word.phoneticUk) && (
                  <span className="text-xs font-mono text-muted-foreground">
                    [{word.phoneticUs || word.phoneticUk}]
                  </span>
                )}
              </div>

              {isWordMasked ? (
                <div className="mt-1 text-[11px] text-muted-foreground/70 font-sans select-none">
                  <span className="px-1.5 py-0.5 rounded bg-muted/60 border border-dashed border-border/80">
                    点击卡片显示释义
                  </span>
                </div>
              ) : (
                <div className="mt-1.5 flex flex-col gap-1.5 animate-in fade-in duration-150">
                  <div className="text-xs text-foreground flex items-baseline gap-1.5">
                    {word.pos && <span className="font-mono text-primary font-bold text-[11px]">{word.pos}</span>}
                    <span>{word.definitionCn || "暂无释义"}</span>
                  </div>

                  {word.sampleSentence && (
                    <div className="rounded-xl bg-muted/40 p-2.5 border border-border/40 text-xs text-muted-foreground flex flex-col gap-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="italic font-serif leading-relaxed flex-1 text-foreground/90">“{word.sampleSentence}”</p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            playSentenceAudio(word.sampleSentence!)
                          }}
                          className={`p-1 text-muted-foreground hover:text-primary shrink-0 ${playingSentence === word.sampleSentence ? "text-primary animate-pulse" : ""}`}
                          title="朗读例句"
                        >
                          <Volume2Icon className="size-3.5" />
                        </button>
                      </div>
                      {word.sampleTranslation && (
                        <p className="text-[11px] text-muted-foreground font-sans">{word.sampleTranslation}</p>
                      )}
                    </div>
                  )}

                  {(() => {
                    const syns = parseJsonArray(word.synonyms)
                    const ants = parseJsonArray(word.antonyms)
                    const dervs = parseJsonArray(word.derivatives)
                    const ielts = parseIeltsUsage(word.ieltsUsage)
                    const hasRelations = syns.length > 0 || ants.length > 0 || dervs.length > 0 || !!ielts

                    if (!hasRelations) return null

                    return (
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[11px]">
                        {ielts && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium text-[10px]" title={ielts.scene}>
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
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {word.studyStatus === "MASTERED" ? (
              <button
                onClick={(e) => handleQuickMarkKnown(word.wordId, true, e)}
                className="px-2 py-0.5 rounded-lg border border-border text-[10px] text-muted-foreground hover:text-foreground"
              >
                取消标熟
              </button>
            ) : (
              <button
                onClick={(e) => handleQuickMarkKnown(word.wordId, false, e)}
                className="px-2 py-0.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-semibold"
              >
                标熟
              </button>
            )}

            {word.studyStatus === "UNLEARNED" && (
              <button
                onClick={(e) => handleQuickPushLearn(word.wordId, e)}
                className="px-2 py-0.5 rounded-lg bg-primary/10 text-primary text-[10px] font-semibold"
              >
                学习
              </button>
            )}
          </div>
        </div>
      </article>
    )
  }
}
