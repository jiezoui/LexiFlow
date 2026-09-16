"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  BookmarkCheckIcon,
  SearchIcon,
  Volume2Icon,
  RefreshCwIcon,
  DownloadCloudIcon,
  Trash2Icon,
  CheckIcon,
  ClockIcon,
  AlertCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  BookOpenIcon,
  FilmIcon,
  FileTextIcon,
  PenToolIcon,
  CheckCircle2Icon,
  XIcon,
} from "lucide-react"
import { vocabApi, type UserWordCard, type VocabOverview, parseJsonArray, parseIeltsUsage } from "@/lib/api-client"

type FilterTab = "ALL" | "DUE" | "NEW" | "LEARNING" | "MASTERED"

export default function VocabPage() {
  // 核心数据状态
  const [overview, setOverview] = useState<VocabOverview | null>(null)
  const [overviewLoading, setOverviewLoading] = useState<boolean>(true)
  const [cards, setCards] = useState<UserWordCard[]>([])
  const [cardsLoading, setCardsLoading] = useState<boolean>(true)
  const [totalCount, setTotalCount] = useState<number>(0)

  // 筛选与分页状态
  const [activeFilter, setActiveFilter] = useState<FilterTab>("ALL")
  const [searchInput, setSearchInput] = useState<string>("")
  const [debouncedKeyword, setDebouncedKeyword] = useState<string>("")
  const [page, setPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(20)

  // 交互状态
  const [playingId, setPlayingId] = useState<number | null>(null)
  const [mutatingId, setMutatingId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<UserWordCard | null>(null)
  const [isDeleting, setIsDeleting] = useState<boolean>(false)
  const [notice, setNotice] = useState<{ message: string; type: "success" | "info" } | null>(null)

  // 搜索防抖
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedKeyword(searchInput.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [searchInput])

  // 自动淡出提示消息
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 3000)
    return () => clearTimeout(timer)
  }, [notice])

  // 获取生词概览数据
  const loadOverview = useCallback(async () => {
    try {
      setOverviewLoading(true)
      const res = await vocabApi.getOverview()
      setOverview(res)
    } catch (err) {
      console.error("加载生词概览失败:", err)
    } finally {
      setOverviewLoading(false)
    }
  }, [])

  // 获取卡片列表
  const loadCards = useCallback(async () => {
    try {
      setCardsLoading(true)
      const params: Parameters<typeof vocabApi.listCards>[0] = {
        page,
        size: pageSize,
      }

      if (debouncedKeyword) {
        params.keyword = debouncedKeyword
      }

      switch (activeFilter) {
        case "DUE":
          params.isDue = true
          break
        case "NEW":
          params.state = 0
          params.isKnown = 0
          break
        case "LEARNING":
          // 初学强化与复习中 (非新词且未斩词)
          params.state = -1
          break
        case "MASTERED":
          params.isKnown = 1
          break
        case "ALL":
        default:
          break
      }

      const res = await vocabApi.listCards(params)
      setCards(res.records || [])
      setTotalCount(res.total || 0)
    } catch (err) {
      console.error("加载生词列表失败:", err)
      setCards([])
      setTotalCount(0)
    } finally {
      setCardsLoading(false)
    }
  }, [page, pageSize, activeFilter, debouncedKeyword])

  // 初始加载与筛选监听
  useEffect(() => {
    loadOverview()
  }, [loadOverview])

  useEffect(() => {
    loadCards()
  }, [loadCards])

  // 监听全局事件（跨标签页、词书导入/标熟同步等）
  useEffect(() => {
    const handleSync = () => {
      loadOverview()
      loadCards()
    }
    window.addEventListener("lexiflow_wordbook_updated", handleSync)
    window.addEventListener("focus", handleSync)
    window.addEventListener("storage", handleSync)
    return () => {
      window.removeEventListener("lexiflow_wordbook_updated", handleSync)
      window.removeEventListener("focus", handleSync)
      window.removeEventListener("storage", handleSync)
    }
  }, [loadOverview, loadCards])

  // 发音朗读
  const playPronunciation = (card: UserWordCard) => {
    setPlayingId(card.id)
    if (card.audioUs && card.audioUs.startsWith("http")) {
      const audio = new Audio(card.audioUs)
      audio.onended = () => setPlayingId(null)
      audio.onerror = () => {
        fallbackSpeech(card.lemma)
      }
      audio.play().catch(() => fallbackSpeech(card.lemma))
    } else {
      fallbackSpeech(card.lemma)
    }
  }

  const fallbackSpeech = (text: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = "en-US"
      utterance.rate = 0.9
      utterance.onend = () => setPlayingId(null)
      utterance.onerror = () => setPlayingId(null)
      window.speechSynthesis.speak(utterance)
    } else {
      setPlayingId(null)
    }
  }

  // 标熟斩词 / 移回复习流
  const handleToggleKnown = async (card: UserWordCard) => {
    const willBeKnown = card.isKnown === 0
    try {
      setMutatingId(card.id)
      await vocabApi.markKnown(card.id, willBeKnown)

      // 本地乐观更新
      setCards((prev) =>
        prev.map((c) => (c.id === card.id ? { ...c, isKnown: willBeKnown ? 1 : 0 } : c))
      )

      setNotice({
        message: willBeKnown ? `已斩词「${card.lemma}」，移出每日复习流` : `已将「${card.lemma}」移回在学复习流`,
        type: "success",
      })

      // 刷新概览与通知其他模块
      loadOverview()
      window.dispatchEvent(new CustomEvent("lexiflow_wordbook_updated"))
    } catch (err) {
      console.error("更新斩词状态失败:", err)
      setNotice({ message: "操作失败，请稍后重试", type: "info" })
    } finally {
      setMutatingId(null)
    }
  }

  // 确认删除卡片
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    try {
      setIsDeleting(true)
      await vocabApi.deleteCard(deleteTarget.id)
      setCards((prev) => prev.filter((c) => c.id !== deleteTarget.id))
      setTotalCount((prev) => Math.max(0, prev - 1))
      setNotice({ message: `已从生词本中移除「${deleteTarget.lemma}」`, type: "success" })
      setDeleteTarget(null)
      loadOverview()
      window.dispatchEvent(new CustomEvent("lexiflow_wordbook_updated"))
    } catch (err) {
      console.error("删除生词失败:", err)
      setNotice({ message: "删除失败，请重试", type: "info" })
    } finally {
      setIsDeleting(false)
    }
  }

  // 导出 CSV 功能
  const handleExportCsv = () => {
    if (cards.length === 0) {
      setNotice({ message: "当前筛选条件下暂无生词数据可导出", type: "info" })
      return
    }

    const headers = [
      "单词 (Lemma)",
      "美音音标",
      "英音音标",
      "词性",
      "中文释义",
      "英文双解",
      "原生语境例句",
      "例句翻译",
      "来源渠道",
      "记忆状态",
      "稳定性S(天)",
      "认知难度D",
      "预测保留度R",
      "下次复习时间",
      "复习次数",
      "遗忘次数",
      "是否斩词",
      "收录时间",
    ]

    const csvRows = cards.map((card) => [
      `"${(card.lemma || "").replace(/"/g, '""')}"`,
      `"${(card.phoneticUs || "").replace(/"/g, '""')}"`,
      `"${(card.phoneticUk || "").replace(/"/g, '""')}"`,
      `"${(card.pos || "").replace(/"/g, '""')}"`,
      `"${(card.definitionCn || "").replace(/"/g, '""')}"`,
      `"${(card.definitionEn || "").replace(/"/g, '""')}"`,
      `"${(card.contextSentence || "").replace(/"/g, '""')}"`,
      `"${(card.contextTranslation || "").replace(/"/g, '""')}"`,
      `"${(card.source || "").replace(/"/g, '""')}"`,
      `"${(card.stateDescription || getStatusName(card.state)).replace(/"/g, '""')}"`,
      card.stability ?? 0,
      card.difficulty ?? 0,
      card.retrievability ? `${Math.round(card.retrievability * 100)}%` : "100%",
      `"${formatDate(card.dueAt)}"`,
      card.reps ?? 0,
      card.lapses ?? 0,
      card.isKnown === 1 ? "已掌握/斩词" : "在学中",
      `"${formatDate(card.createdAt)}"`,
    ])

    const csvContent = "\uFEFF" + [headers.join(","), ...csvRows.map((r) => r.join(","))].join("\r\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    const dateStr = new Date().toISOString().slice(0, 10)
    a.href = url
    a.download = `LexiFlow_生词导出_${dateStr}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    setNotice({ message: `成功导出 ${cards.length} 条生词档案`, type: "success" })
  }

  // 状态映射辅助
  const getStatusName = (state?: number) => {
    switch (state) {
      case 0:
        return "新词"
      case 1:
        return "初学强化"
      case 2:
        return "长效复习"
      case 3:
        return "重学回炉"
      default:
        return "新词"
    }
  }

  // 日期格式化
  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "--"
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return dateStr
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
    } catch {
      return dateStr
    }
  }

  const formatDueRelative = (dueAtStr?: string, isKnown?: number) => {
    if (isKnown === 1) return "已掌握已斩词"
    if (!dueAtStr) return "待排期"
    try {
      const due = new Date(dueAtStr)
      const now = new Date()
      const diffMs = due.getTime() - now.getTime()
      if (diffMs <= 0) return "已到期待复习"

      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      if (diffHours < 24) {
        return `${diffHours === 0 ? "1小时内" : `${diffHours}小时后`}到期`
      }
      const diffDays = Math.floor(diffHours / 24)
      return `${diffDays}天后到期`
    } catch {
      return "排期中"
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  // 来源渠道图标
  const renderSourceBadge = (source?: string) => {
    switch (source?.toUpperCase()) {
      case "VIDEO":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
            <FilmIcon className="size-3 text-muted-foreground" />
            视听语境切片
          </span>
        )
      case "READING":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
            <FileTextIcon className="size-3 text-muted-foreground" />
            深度阅读采词
          </span>
        )
      case "WORDBOOK":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
            <BookOpenIcon className="size-3 text-muted-foreground" />
            词书库同步
          </span>
        )
      case "MANUAL":
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
            <PenToolIcon className="size-3 text-muted-foreground" />
            手动录入
          </span>
        )
    }
  }

  // 高亮例句中单词
  const highlightWordInSentence = (sentence: string, lemma: string) => {
    if (!sentence) return null
    if (!lemma) return sentence

    try {
      const parts = sentence.split(new RegExp(`(${lemma})`, "gi"))
      return parts.map((part, idx) =>
        part.toLowerCase() === lemma.toLowerCase() ? (
          <mark
            key={idx}
            className="bg-accent text-accent-foreground font-bold px-1 rounded mx-0.5"
          >
            {part}
          </mark>
        ) : (
          part
        )
      )
    } catch {
      return sentence
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 pt-2 max-w-7xl mx-auto w-full">
      {/* 消息轻提示 */}
      {notice && (
        <div className="fixed top-5 right-5 z-50 animate-in fade-in slide-in-from-top-3">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card/95 backdrop-blur-md shadow-lg text-xs font-medium text-foreground">
            <CheckCircle2Icon className="size-4 text-foreground shrink-0" />
            <span>{notice.message}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            生词本与语境切片
          </h1>
        </div>

        {/* 顶部操作条 */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="在生词本中检索单词、释义或例句..."
              className="w-full h-9 pl-9 pr-8 rounded-xl border border-border bg-surface text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <XIcon className="size-3.5" />
              </button>
            )}
          </div>

          <button
            onClick={() => {
              loadOverview()
              loadCards()
            }}
            title="刷新数据"
            className="size-9 rounded-xl border border-border bg-surface flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <RefreshCwIcon className={`size-3.5 ${cardsLoading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={handleExportCsv}
            title="导出当前生词为 CSV 表格"
            className="h-9 px-3 rounded-xl border border-border bg-surface hover:bg-surface/80 flex items-center gap-1.5 text-xs text-foreground font-medium transition-colors shrink-0"
          >
            <DownloadCloudIcon className="size-3.5 text-muted-foreground" />
            <span className="hidden sm:inline">导出 CSV</span>
          </button>
        </div>
      </div>

      {/* FSRS Algorithm Metrics Banner (真实动态统计) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5 p-4 sm:p-5 rounded-2xl border border-border bg-surface/80 backdrop-blur-sm">
        <div>
          <span className="block text-[11px] text-muted-foreground">生词库总容量</span>
          <span className="mt-1 block font-mono text-2xl font-bold text-foreground">
            {overviewLoading ? "--" : overview?.totalWords ?? 0}{" "}
            <span className="text-xs font-normal font-sans text-muted-foreground">词</span>
          </span>
        </div>
        <div>
          <span className="block text-[11px] text-muted-foreground">今日待复习 (Due)</span>
          <span className="mt-1 block font-mono text-2xl font-bold text-foreground">
            {overviewLoading ? "--" : overview?.dueToday ?? 0}{" "}
            <span className="text-xs font-normal font-sans text-muted-foreground">词</span>
          </span>
        </div>
        <div>
          <span className="block text-[11px] text-muted-foreground">新词池 (New)</span>
          <span className="mt-1 block font-mono text-2xl font-bold text-foreground">
            {overviewLoading ? "--" : overview?.newWords ?? 0}{" "}
            <span className="text-xs font-normal font-sans text-muted-foreground">词</span>
          </span>
        </div>
        <div>
          <span className="block text-[11px] text-muted-foreground">长效巩固中 (Learn)</span>
          <span className="mt-1 block font-mono text-2xl font-bold text-foreground">
            {overviewLoading
              ? "--"
              : (overview?.learningWords ?? 0) + (overview?.reviewWords ?? 0) + (overview?.relearningWords ?? 0)}{" "}
            <span className="text-xs font-normal font-sans text-muted-foreground">词</span>
          </span>
        </div>
        <div>
          <span className="block text-[11px] text-muted-foreground">已斩词/已掌握</span>
          <span className="mt-1 block font-mono text-2xl font-bold text-foreground">
            {overviewLoading ? "--" : overview?.masteredWords ?? 0}{" "}
            <span className="text-xs font-normal font-sans text-muted-foreground">词</span>
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => {
            setActiveFilter("ALL")
            setPage(1)
          }}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
            activeFilter === "ALL"
              ? "bg-foreground text-background font-semibold shadow-sm"
              : "bg-surface border border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          全部词条 ({overview?.totalWords ?? 0})
        </button>
        <button
          onClick={() => {
            setActiveFilter("DUE")
            setPage(1)
          }}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
            activeFilter === "DUE"
              ? "bg-foreground text-background font-semibold shadow-sm"
              : "bg-surface border border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          今日到期 ({overview?.dueToday ?? 0})
        </button>
        <button
          onClick={() => {
            setActiveFilter("NEW")
            setPage(1)
          }}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
            activeFilter === "NEW"
              ? "bg-foreground text-background font-semibold shadow-sm"
              : "bg-surface border border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          新词待学 ({overview?.newWords ?? 0})
        </button>
        <button
          onClick={() => {
            setActiveFilter("LEARNING")
            setPage(1)
          }}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
            activeFilter === "LEARNING"
              ? "bg-foreground text-background font-semibold shadow-sm"
              : "bg-surface border border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          巩固复习 ({(overview?.learningWords ?? 0) + (overview?.reviewWords ?? 0)})
        </button>
        <button
          onClick={() => {
            setActiveFilter("MASTERED")
            setPage(1)
          }}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
            activeFilter === "MASTERED"
              ? "bg-foreground text-background font-semibold shadow-sm"
              : "bg-surface border border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          已掌握/已斩词 ({overview?.masteredWords ?? 0})
        </button>
      </div>

      {/* Vocab Cards List */}
      <div className="divide-y divide-border/60 rounded-3xl border border-border bg-card/85 backdrop-blur-sm overflow-hidden shadow-sm">
        {cardsLoading ? (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
            <RefreshCwIcon className="size-6 text-muted-foreground animate-spin" />
            <span className="text-xs text-muted-foreground">正在检索生词档案与 FSRS 留存预测...</span>
          </div>
        ) : cards.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center justify-center gap-3">
            <div className="size-12 rounded-2xl border border-border bg-surface flex items-center justify-center text-muted-foreground">
              <SearchIcon className="size-5" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">暂无符合条件的生词记录</h3>
            <p className="text-xs text-muted-foreground max-w-sm">
              {debouncedKeyword
                ? `未找到与「${debouncedKeyword}」相关的生词或例句，建议尝试其他关键词。`
                : "当前筛选分组下暂无卡片。您可以前往大纲词书库导入词汇，或在阅读与视频中采词。"}
            </p>
            {debouncedKeyword ? (
              <button
                onClick={() => setSearchInput("")}
                className="mt-2 text-xs text-primary font-medium hover:underline"
              >
                清空搜索关键词
              </button>
            ) : (
              <Link
                href="/wordbooks"
                className="mt-2 px-3.5 py-1.5 rounded-xl border border-border bg-surface text-xs text-foreground hover:bg-surface/80 font-medium transition-all"
              >
                浏览大纲词书库
              </Link>
            )}
          </div>
        ) : (
          cards.map((card) => {
            const isDueNow =
              card.isKnown === 0 &&
              card.dueAt &&
              new Date(card.dueAt).getTime() <= new Date().getTime()

            return (
              <div
                key={card.id}
                className="p-5 sm:p-6 transition-colors hover:bg-surface/60 flex flex-col gap-3.5"
              >
                {/* Word Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-wrap items-baseline gap-2.5">
                    <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground font-mono">
                      {card.lemma}
                    </h3>
                    {(card.phoneticUs || card.phoneticUk) && (
                      <span className="font-mono text-xs text-muted-foreground">
                        {card.phoneticUs || card.phoneticUk}
                      </span>
                    )}
                    {card.pos && (
                      <span className="text-xs font-semibold text-muted-foreground font-mono">
                        {card.pos}
                      </span>
                    )}
                    <span className="text-sm text-foreground font-medium">
                      {card.definitionCn || "暂无中文释义"}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* 发音试听 */}
                    <button
                      onClick={() => playPronunciation(card)}
                      title="发音试听 (优先原生音频，备选系统语音)"
                      className="size-8 rounded-lg border border-border bg-surface flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Volume2Icon
                        className={`size-3.5 ${playingId === card.id ? "text-foreground animate-pulse" : ""}`}
                      />
                    </button>

                    {/* 标熟 / 斩词 切换 */}
                    <button
                      onClick={() => handleToggleKnown(card)}
                      disabled={mutatingId === card.id}
                      title={card.isKnown === 1 ? "已斩词（点击移回日常复习）" : "标熟斩词（移出复习流）"}
                      className={`h-8 px-2.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-all ${
                        card.isKnown === 1
                          ? "bg-surface border-border text-muted-foreground hover:text-foreground"
                          : "bg-surface border-border text-foreground hover:bg-surface/80"
                      }`}
                    >
                      {card.isKnown === 1 ? (
                        <>
                          <CheckIcon className="size-3 text-muted-foreground" />
                          <span className="text-[11px]">已斩词</span>
                        </>
                      ) : (
                        <>
                          <BookmarkCheckIcon className="size-3 text-muted-foreground" />
                          <span className="text-[11px]">斩词</span>
                        </>
                      )}
                    </button>

                    {/* 永久移除 */}
                    <button
                      onClick={() => setDeleteTarget(card)}
                      title="从生词本中移除此词"
                      className="size-8 rounded-lg border border-border bg-surface flex items-center justify-center text-muted-foreground hover:text-rose-500 hover:border-rose-500/30 transition-colors"
                    >
                      <Trash2Icon className="size-3.5" />
                    </button>
                  </div>
                </div>

                {/* Context Sentence */}
                <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5">
                  <p className="text-xs sm:text-sm text-foreground leading-relaxed">
                    &ldquo;{highlightWordInSentence(card.contextSentence || "No context sentence recorded.", card.lemma)}&rdquo;
                  </p>

                  {card.contextTranslation && (
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      {card.contextTranslation}
                    </p>
                  )}

                  {(() => {
                    const syns = parseJsonArray(card.synonyms)
                    const ants = parseJsonArray(card.antonyms)
                    const dervs = parseJsonArray(card.derivatives)
                    const ielts = parseIeltsUsage(card.ieltsUsage)
                    const hasRel = syns.length > 0 || ants.length > 0 || dervs.length > 0 || !!ielts

                    if (!hasRel) return null

                    return (
                      <div className="mt-2.5 pt-2 border-t border-border/30 flex flex-wrap items-center gap-1.5 text-[11px]">
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

                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground font-mono">
                    <div className="flex items-center gap-2">
                      {renderSourceBadge(card.source)}
                      <span>•</span>
                      <span>收录于: {formatDate(card.createdAt).slice(0, 10)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <ClockIcon className="size-3 text-muted-foreground" />
                        下次调度:
                      </span>
                      <span
                        className={`font-semibold ${
                          isDueNow ? "text-foreground font-bold" : "text-muted-foreground"
                        }`}
                      >
                        {formatDueRelative(card.dueAt, card.isKnown)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* FSRS Details Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground font-mono pt-0.5">
                  <div className="flex flex-wrap items-center gap-3">
                    <span>
                      稳定性 (S):{" "}
                      <strong className="text-foreground">
                        {card.stability ? `${card.stability.toFixed(1)}d` : "0.0d"}
                      </strong>
                    </span>
                    <span>•</span>
                    <span>
                      难度 (D):{" "}
                      <strong className="text-foreground">
                        {card.difficulty ? card.difficulty.toFixed(1) : "0.0"}
                      </strong>
                    </span>
                    <span>•</span>
                    <span>
                      记忆留存率 (R):{" "}
                      <strong className="text-foreground">
                        {card.retrievability ? `${Math.round(card.retrievability * 100)}%` : "100%"}
                      </strong>
                    </span>
                    {card.reps > 0 && (
                      <>
                        <span>•</span>
                        <span>
                          复习轮次: <strong className="text-foreground">{card.reps}</strong>
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {card.isKnown === 1 ? (
                      <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-muted-foreground font-medium">
                        已掌握 (Mastered)
                      </span>
                    ) : (
                      <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-foreground font-medium">
                        {card.stateDescription || getStatusName(card.state)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* 分页控制栏 */}
      {totalCount > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs text-muted-foreground">
          <div>
            显示第 <span className="font-mono font-medium text-foreground">{(page - 1) * pageSize + 1}</span> 至{" "}
            <span className="font-mono font-medium text-foreground">
              {Math.min(page * pageSize, totalCount)}
            </span>{" "}
            条 · 共 <span className="font-mono font-medium text-foreground">{totalCount}</span> 词档案
          </div>

          <div className="flex items-center gap-3">
            {/* 每页条数选择 */}
            <div className="flex items-center gap-1.5">
              <span>每页</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setPage(1)
                }}
                className="h-8 rounded-lg border border-border bg-surface px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              <span>条</span>
            </div>

            {/* 页码切换 */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="size-8 rounded-lg border border-border bg-surface flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:pointer-events-none transition-colors"
              >
                <ChevronLeftIcon className="size-4" />
              </button>

              <div className="px-2 font-mono text-xs text-foreground font-medium">
                {page} / {totalPages}
              </div>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="size-8 rounded-lg border border-border bg-surface flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:pointer-events-none transition-colors"
              >
                <ChevronRightIcon className="size-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除生词确认弹窗 */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl border border-rose-500/20 bg-rose-500/10 flex items-center justify-center text-rose-500 shrink-0">
                <AlertCircleIcon className="size-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">移除生词卡片确认</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  此操作将从生词本中永久清除该词及其关联语境快照。
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface/60 p-3.5 text-xs text-foreground">
              <div className="font-mono text-sm font-bold text-foreground">{deleteTarget.lemma}</div>
              <div className="text-muted-foreground mt-0.5">{deleteTarget.definitionCn}</div>
              {deleteTarget.contextSentence && (
                <div className="mt-2 text-[11px] text-muted-foreground/80 line-clamp-2 italic">
                  &ldquo;{deleteTarget.contextSentence}&rdquo;
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="h-9 px-4 rounded-xl border border-border bg-surface hover:bg-surface/80 text-xs font-medium text-foreground transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="h-9 px-4 rounded-xl border border-rose-600/30 bg-rose-600 hover:bg-rose-700 text-xs font-semibold text-white transition-colors flex items-center gap-1.5"
              >
                {isDeleting ? <RefreshCwIcon className="size-3.5 animate-spin" /> : null}
                <span>确认移除</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
