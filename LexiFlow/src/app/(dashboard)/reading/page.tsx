"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import {
  BookOpenIcon,
  SparklesIcon,
  SearchIcon,
  RefreshCwIcon,
  EyeIcon,
  ClockIcon,
  BookmarkPlusIcon,
  CheckCircle2Icon,
  ExternalLinkIcon,
  Volume2Icon,
  XIcon,
  LayersIcon,
  FileTextIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Share2Icon,
  TypeIcon,
  PaletteIcon,
} from "lucide-react"
import {
  readingApi,
  dictApi,
  vocabApi,
  type ReadingArticle,
  type ReadingArticleDetail,
  type ChannelStat,
  type DictEntry,
} from "@/lib/api-client"
import { WordLookupPopover } from "@/components/reading/word-lookup-popover"
import { lemmatize } from "@/lib/lemmatizer"

type ThemeMode = "paper" | "sepia" | "dark"
type FontMode = "serif" | "sans"

export default function ReadingPage() {
  // 核心数据状态
  const [articles, setArticles] = useState<ReadingArticle[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [totalCount, setTotalCount] = useState<number>(0)
  const [channels, setChannels] = useState<ChannelStat[]>([])
  const [activeChannel, setActiveChannel] = useState<string>("ALL")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [debouncedKeyword, setDebouncedKeyword] = useState<string>("")
  const [page, setPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(12)

  // 同步与提示状态
  const [syncing, setSyncing] = useState<boolean>(false)
  const [notice, setNotice] = useState<{ message: string; type: "success" | "info" } | null>(null)

  // 研读抽屉状态
  const [activeArticleId, setActiveArticleId] = useState<number | null>(null)
  const [detail, setDetail] = useState<ReadingArticleDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState<boolean>(false)
  const [isClosing, setIsClosing] = useState<boolean>(false)
  const [mounted, setMounted] = useState<boolean>(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // 研读器个性化设置
  const [readerTheme, setReaderTheme] = useState<ThemeMode>("paper")
  const [fontMode, setFontMode] = useState<FontMode>("serif")
  const [fontSize, setFontSize] = useState<"sm" | "base" | "lg">("base")

  // 行间查词与即时采词浮层
  const [lookupWord, setLookupWord] = useState<string | null>(null)
  const [lookupContextSentence, setLookupContextSentence] = useState<string>("")
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
  const [harvestedWords, setHarvestedWords] = useState<Set<string>>(new Set())

  // 搜索防抖
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedKeyword(searchQuery.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // 自动淡出提示消息
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 3000)
    return () => clearTimeout(timer)
  }, [notice])

  // 加载频道统计
  const loadChannels = useCallback(async () => {
    try {
      const stats = await readingApi.getChannels()
      setChannels(stats || [])
    } catch (e) {
      console.error("加载频道列表失败:", e)
    }
  }, [])

  // 加载文章列表
  const loadArticles = useCallback(async () => {
    try {
      setLoading(true)
      const res = await readingApi.listArticles({
        channel: activeChannel,
        keyword: debouncedKeyword,
        page,
        size: pageSize,
      })
      setArticles(res.records || [])
      setTotalCount(res.total || 0)
    } catch (e) {
      console.error("加载外刊列表失败:", e)
      setArticles([])
      setTotalCount(0)
    } finally {
      setLoading(false)
    }
  }, [activeChannel, debouncedKeyword, page, pageSize])

  useEffect(() => {
    loadChannels()
  }, [loadChannels])

  useEffect(() => {
    loadArticles()
  }, [loadArticles])

  // 触发拉取最新 BBC 资讯
  const handleSyncBbc = async () => {
    try {
      setSyncing(true)
      const res = await readingApi.sync(activeChannel === "ALL" ? undefined : activeChannel)
      setNotice({ message: res.message || "BBC 外刊资讯同步完成", type: "success" })
      loadChannels()
      loadArticles()
    } catch (e) {
      console.error("同步 BBC 失败:", e)
      setNotice({ message: "同步失败，请检查网络或稍后重试", type: "info" })
    } finally {
      setSyncing(false)
    }
  }

  // 打开正文研读抽屉
  const handleOpenArticle = async (id: number) => {
    setIsClosing(false)
    setActiveArticleId(id)
    setLookupWord(null)
    setHarvestedWords(new Set())
    try {
      setDetailLoading(true)
      const res = await readingApi.getDetail(id)
      setDetail(res)

      // 自动提取正文所有词汇与形态学原型，批量查询生词本状态并恢复背景色
      if (res && res.paragraphs && res.paragraphs.length > 0) {
        const candidateWords = new Set<string>()
        for (const p of res.paragraphs) {
          const tokens = p.split(/(\s+|[.,!?;:"()]+)/)
          for (const t of tokens) {
            if (/^[a-zA-Z'-]{2,}$/.test(t)) {
              const lower = t.toLowerCase()
              candidateWords.add(lower)
              const lem = lemmatize(t)
              if (lem.baseLemma) {
                candidateWords.add(lem.baseLemma.toLowerCase())
              }
            }
          }
        }

        if (candidateWords.size > 0) {
          vocabApi.checkHarvested(Array.from(candidateWords)).then((harvestedList) => {
            if (harvestedList && harvestedList.length > 0) {
              setHarvestedWords(new Set(harvestedList.map((w) => w.toLowerCase())))
            }
          }).catch((err) => {
            console.warn("批量检查生词状态失败:", err)
          })
        }
      }
    } catch (e) {
      console.error("加载文章详情失败:", e)
      setNotice({ message: "加载文章失败", type: "info" })
    } finally {
      setDetailLoading(false)
    }
  }

  // 关闭正文抽屉（右侧平滑滑出退场动画）
  const handleCloseReader = useCallback(() => {
    if (isClosing) return
    setIsClosing(true)
    setTimeout(() => {
      setActiveArticleId(null)
      setDetail(null)
      setLookupWord(null)
      setAnchorRect(null)
      setHarvestedWords(new Set())
      setIsClosing(false)
    }, 240)
  }, [isClosing])

  // 抽屉展开时锁定背景滚动并支持 Esc 键快捷退出
  useEffect(() => {
    if (!activeArticleId) return

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleCloseReader()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [activeArticleId, handleCloseReader])

  // 点击正文中任意英文单词或划词
  const handleWordClick = (rawWord: string, sentence: string, rect?: DOMRect) => {
    const cleanWord = rawWord.trim()
    if (!cleanWord || cleanWord.length < 2) return

    setLookupWord(cleanWord)
    setLookupContextSentence(sentence.trim())
    if (rect) {
      setAnchorRect(rect)
    }
  }

  // 划选长句 / 短语翻译监听
  const handleSelectionMouseUp = () => {
    if (typeof window === "undefined") return
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) return
    const text = sel.toString().trim()
    if (text.length > 2 && text.includes(" ")) {
      try {
        const range = sel.getRangeAt(0)
        const rect = range.getBoundingClientRect()
        if (rect && rect.width > 0) {
          handleWordClick(text, text, rect)
        }
      } catch {}
    }
  }

  const fallbackSpeech = (text: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.lang = "en-US"
      u.rate = 0.9
      window.speechSynthesis.speak(u)
    }
  }

  // 相对发布时间格式化
  const formatPublishedAgo = (dateStr?: string) => {
    if (!dateStr) return "BBC News"
    try {
      const d = new Date(dateStr)
      const now = new Date()
      const diffMinutes = Math.floor((now.getTime() - d.getTime()) / (1000 * 60))
      if (diffMinutes < 60) {
        return `${Math.max(1, diffMinutes)} 分钟前`
      }
      const diffHours = Math.floor(diffMinutes / 60)
      if (diffHours < 24) {
        return `${diffHours} 小时前`
      }
      const diffDays = Math.floor(diffHours / 24)
      return `${diffDays} 天前`
    } catch {
      return dateStr.slice(0, 10)
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  // 难度徽章样式映射
  const getCefrBadge = (level?: string) => {
    switch (level?.toUpperCase()) {
      case "C2":
        return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
      case "C1":
        return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
      case "B2":
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
      case "B1":
      default:
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 pt-2 max-w-7xl mx-auto w-full">
      {/* 提示反馈气泡 */}
      {notice && (
        <div className="fixed top-5 right-5 z-50 animate-in fade-in slide-in-from-top-3">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card/95 backdrop-blur-md shadow-xl text-xs font-medium text-foreground">
            <CheckCircle2Icon className="size-4 text-foreground shrink-0" />
            <span>{notice.message}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono tracking-wider text-muted-foreground font-semibold uppercase">
            Editorial Immersion · BBC 全球期刊实时研读库
          </div>
          <h1 className="mt-0.5 text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            沉浸式深度外刊研读
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            实时聚合 BBC 权威新闻流，自动评估 CEFR 语言难度。阅读中点击任意单词即时查词并一键沉淀语境入库。
          </p>
        </div>

        {/* 顶部操作条 */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="检索外刊标题或正文..."
              className="w-full h-9 pl-9 pr-8 rounded-xl border border-border bg-surface text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <XIcon className="size-3.5" />
              </button>
            )}
          </div>

          <button
            onClick={handleSyncBbc}
            disabled={syncing}
            className="h-9 px-3.5 rounded-xl border border-border bg-surface hover:bg-surface/80 flex items-center gap-2 text-xs font-medium text-foreground transition-all shadow-sm shrink-0 disabled:opacity-50"
          >
            <RefreshCwIcon className={`size-3.5 ${syncing ? "animate-spin" : ""}`} />
            <span>{syncing ? "正在拉取 BBC..." : "同步最新资讯"}</span>
          </button>
        </div>
      </div>

      {/* 频道分类切换器 (Channel Pills) */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-3">
        {channels.length > 0
          ? channels.map((ch) => (
              <button
                key={ch.code}
                onClick={() => {
                  setActiveChannel(ch.code)
                  setPage(1)
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
                  activeChannel === ch.code
                    ? "bg-foreground text-background font-semibold shadow-sm"
                    : "bg-surface border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>{ch.name}</span>
                <span className="text-[10px] opacity-75 font-mono">({ch.articleCount})</span>
              </button>
            ))
          : ["ALL", "WORLD", "TECH", "BUSINESS", "SCIENCE", "ENTERTAINMENT"].map((code) => (
              <button
                key={code}
                onClick={() => {
                  setActiveChannel(code)
                  setPage(1)
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  activeChannel === code
                    ? "bg-foreground text-background font-semibold"
                    : "bg-surface border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {code}
              </button>
            ))}
      </div>

      {/* Magazine Bento Grid (杂志货架式陈列) */}
      {loading ? (
        <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
          <RefreshCwIcon className="size-6 text-muted-foreground animate-spin" />
          <span className="text-xs text-muted-foreground">正在加载 BBC 权威外刊与 CEFR 难度评估...</span>
        </div>
      ) : articles.length === 0 ? (
        <div className="py-20 text-center flex flex-col items-center justify-center gap-3 border border-border rounded-3xl bg-surface/50">
          <div className="size-12 rounded-2xl border border-border bg-surface flex items-center justify-center text-muted-foreground">
            <BookOpenIcon className="size-5" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">暂无符合条件的外刊文章</h3>
          <p className="text-xs text-muted-foreground max-w-sm">
            {debouncedKeyword
              ? `未检索到包含「${debouncedKeyword}」的报道，请尝试更换检索词。`
              : "当前分类下暂无已收录的 BBC 新闻资讯，点击右上角即可一键拉取最新期刊报道。"}
          </p>
          <button
            onClick={handleSyncBbc}
            disabled={syncing}
            className="mt-2 h-9 px-4 rounded-xl border border-border bg-surface hover:bg-surface/80 text-xs font-semibold text-foreground transition-all flex items-center gap-2"
          >
            <RefreshCwIcon className={`size-3.5 ${syncing ? "animate-spin" : ""}`} />
            <span>一键同步 BBC 最新报道</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {articles.map((art) => (
            <article
              key={art.id}
              onClick={() => handleOpenArticle(art.id)}
              className="group flex flex-col justify-between rounded-3xl border border-border bg-card/85 backdrop-blur-sm overflow-hidden transition-all duration-200 hover:shadow-lg hover:border-foreground/30 cursor-pointer"
            >
              {/* Cover Image */}
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted/40">
                {art.coverUrl ? (
                  <img
                    src={art.coverUrl}
                    alt={art.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-muted-foreground/50 font-mono text-xs">
                    BBC News
                  </div>
                )}

                {/* Badges on Cover */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono tracking-wide uppercase bg-background/85 backdrop-blur-md text-foreground border border-border/50">
                    {art.channel}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold font-mono border ${getCefrBadge(
                      art.cefrLevel
                    )} backdrop-blur-md`}
                  >
                    CEFR {art.cefrLevel || "B2"}
                  </span>
                </div>

                <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded-md text-[10px] font-mono text-white bg-black/60 backdrop-blur-md">
                  {art.readMinutes} min · {art.wordCount} 词
                </div>
              </div>

              {/* Content Body */}
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <div className="text-[11px] font-mono text-muted-foreground flex items-center gap-1">
                    <ClockIcon className="size-3" />
                    <span>{formatPublishedAgo(art.publishedAt)}</span>
                    <span>·</span>
                    <span>{art.sourceName}</span>
                  </div>

                  <h3 className="mt-2 text-base font-bold text-foreground tracking-tight line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                    {art.title}
                  </h3>

                  <p className="mt-2 text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                    {art.summary}
                  </p>
                </div>

                {/* Target Vocab Chips */}
                <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between">
                  <div className="flex flex-wrap items-center gap-1">
                    {(art.targetWords || []).slice(0, 3).map((w, idx) => (
                      <span
                        key={idx}
                        className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface border border-border text-muted-foreground"
                      >
                        {w}
                      </span>
                    ))}
                  </div>

                  <button className="text-xs font-semibold text-foreground flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    <span>研读</span>
                    <EyeIcon className="size-3" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* 分页控制栏 */}
      {totalCount > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs text-muted-foreground">
          <div>
            显示第 <span className="font-mono font-medium text-foreground">{(page - 1) * pageSize + 1}</span> 至{" "}
            <span className="font-mono font-medium text-foreground">
              {Math.min(page * pageSize, totalCount)}
            </span>{" "}
            篇 · 共 <span className="font-mono font-medium text-foreground">{totalCount}</span> 篇外刊报道
          </div>

          <div className="flex items-center gap-3">
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

      {/* ========================================================================= */}
      {/* 沉浸式纸感外刊研读器 (Zen Reader Drawer - 从右侧展开动画 & 点击左侧模糊区域直接退出) */}
      {/* ========================================================================= */}
      {mounted && activeArticleId && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex justify-end overflow-hidden"
        >
          {/* 左侧高斯模糊遮罩背景 (Backdrop Blur Mask) - 点击直接退出 */}
          <div
            onClick={handleCloseReader}
            className={`fixed inset-0 bg-background/50 dark:bg-black/65 backdrop-blur-md transition-opacity cursor-pointer ${
              isClosing
                ? "animate-out fade-out duration-250 fill-mode-forwards"
                : "animate-in fade-in duration-300"
            }`}
            aria-label="点击左侧模糊区域退出阅读"
            title="点击左侧模糊区域退出阅读"
          />

          {/* 右侧抽屉主面板 (Slide-over Drawer Container) - 从右侧展开动画 */}
          <div
            onClick={(e) => e.stopPropagation()}
            className={`relative z-10 w-full max-w-4xl h-full flex flex-col shadow-2xl border-l border-border/70 transition-colors ${
              isClosing
                ? "animate-out slide-out-to-right duration-250 ease-in fill-mode-forwards"
                : "animate-in slide-in-from-right duration-300 ease-out"
            } ${
              readerTheme === "sepia"
                ? "bg-[#FBF0D9] text-[#2C2523]"
                : readerTheme === "dark"
                ? "bg-[#18181B] text-[#FAFAFA]"
                : "bg-background text-foreground"
            }`}
          >
            {/* Reader Top Controls */}
            <div
              className={`px-6 py-3.5 border-b flex items-center justify-between gap-4 shrink-0 transition-colors ${
                readerTheme === "sepia"
                  ? "border-[#E8DEC7] bg-[#F4E9CF]/60"
                  : readerTheme === "dark"
                  ? "border-zinc-800 bg-zinc-900/60"
                  : "border-border bg-surface/80"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold uppercase tracking-wider">
                  BBC News · {detail?.channel}
                </span>
                <span className="text-xs opacity-60">|</span>
                <span className="text-xs opacity-75 font-mono">
                  CEFR {detail?.cefrLevel} · {detail?.wordCount} 词
                </span>
              </div>

              {/* Controls Toolbar */}
              <div className="flex items-center gap-2">
                {/* Font Toggle */}
                <button
                  onClick={() => setFontMode((f) => (f === "serif" ? "sans" : "serif"))}
                  className="px-2.5 py-1 rounded-lg border border-current/20 text-xs font-mono font-medium hover:bg-current/10 transition-colors"
                  title="切换衬线/现代字体"
                >
                  {fontMode === "serif" ? "衬线 (Serif)" : "黑体 (Sans)"}
                </button>

                {/* Font Size */}
                <div className="flex items-center border border-current/20 rounded-lg overflow-hidden text-xs">
                  <button
                    onClick={() => setFontSize("sm")}
                    className={`px-2 py-1 font-mono ${fontSize === "sm" ? "bg-current/20 font-bold" : ""}`}
                  >
                    A-
                  </button>
                  <button
                    onClick={() => setFontSize("base")}
                    className={`px-2 py-1 font-mono border-x border-current/20 ${
                      fontSize === "base" ? "bg-current/20 font-bold" : ""
                    }`}
                  >
                    A
                  </button>
                  <button
                    onClick={() => setFontSize("lg")}
                    className={`px-2 py-1 font-mono ${fontSize === "lg" ? "bg-current/20 font-bold" : ""}`}
                  >
                    A+
                  </button>
                </div>

                {/* Theme Selector */}
                <div className="flex items-center border border-current/20 rounded-lg overflow-hidden text-xs">
                  <button
                    onClick={() => setReaderTheme("paper")}
                    className={`px-2 py-1 ${readerTheme === "paper" ? "bg-current/20 font-bold" : ""}`}
                    title="纸白模式"
                  >
                    纸白
                  </button>
                  <button
                    onClick={() => setReaderTheme("sepia")}
                    className={`px-2 py-1 border-x border-current/20 ${
                      readerTheme === "sepia" ? "bg-current/20 font-bold" : ""
                    }`}
                    title="护眼羊皮纸"
                  >
                    护眼
                  </button>
                  <button
                    onClick={() => setReaderTheme("dark")}
                    className={`px-2 py-1 ${readerTheme === "dark" ? "bg-current/20 font-bold" : ""}`}
                    title="暗黑杂志"
                  >
                    暗夜
                  </button>
                </div>

                {/* Original Link */}
                {detail?.link && (
                  <a
                    href={detail.link}
                    target="_blank"
                    rel="noreferrer"
                    className="size-8 rounded-lg border border-current/20 flex items-center justify-center hover:bg-current/10 transition-colors"
                    title="跳转至 BBC 原文链接"
                  >
                    <ExternalLinkIcon className="size-3.5" />
                  </a>
                )}

                {/* Close */}
                <button
                  onClick={handleCloseReader}
                  className="size-8 rounded-lg border border-current/20 flex items-center justify-center hover:bg-current/10 transition-colors ml-1"
                >
                  <XIcon className="size-4" />
                </button>
              </div>
            </div>

            {/* Reader Content Scroll */}
            <div className="flex-1 overflow-y-auto p-6 md:p-12 max-w-3xl mx-auto w-full">
              {detailLoading ? (
                <div className="py-24 text-center flex flex-col items-center justify-center gap-3">
                  <RefreshCwIcon className="size-8 animate-spin opacity-50" />
                  <span className="text-xs font-mono">正在渲染纯净外刊版式与排版字形...</span>
                </div>
              ) : detail ? (
                <article className="flex flex-col gap-6">
                  {/* Headline */}
                  <h1
                    className={`text-2xl md:text-3xl font-extrabold tracking-tight leading-tight ${
                      fontMode === "serif" ? "font-serif" : "font-sans"
                    }`}
                  >
                    {detail.title}
                  </h1>

                  {/* Metadata */}
                  <div className="flex flex-wrap items-center gap-3 text-xs opacity-75 font-mono pb-2 border-b border-current/15">
                    <span>来源: {detail.sourceName}</span>
                    <span>•</span>
                    <span>发布于: {formatPublishedAgo(detail.publishedAt)}</span>
                    <span>•</span>
                    <span>预计耗时: {detail.readMinutes} 分钟</span>
                  </div>

                  {/* Featured Cover */}
                  {detail.coverUrl && (
                    <div className="rounded-2xl overflow-hidden shadow-md my-2 aspect-[16/9] w-full bg-black/10">
                      <img
                        src={detail.coverUrl}
                        alt={detail.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  {/* Target Vocab Prompts */}
                  {detail.targetWords && detail.targetWords.length > 0 && (
                    <div className="p-3.5 rounded-xl border border-current/20 bg-current/5 flex items-center gap-2 text-xs">
                      <SparklesIcon className="size-4 shrink-0" />
                      <span className="font-semibold">核心考纲研读词汇:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {detail.targetWords.map((w, i) => (
                          <span
                            key={i}
                            onClick={(e) => {
                              e.stopPropagation()
                              const rect = e.currentTarget.getBoundingClientRect()
                              handleWordClick(w, detail.summary, rect)
                            }}
                            className="underline underline-offset-2 cursor-pointer hover:font-bold transition-all"
                          >
                            {w}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Paragraphs with Clickable Words */}
                  <div
                    onMouseUp={handleSelectionMouseUp}
                    className={`flex flex-col gap-5 leading-loose text-justify select-text ${
                      fontMode === "serif" ? "font-serif" : "font-sans"
                    } ${
                      fontSize === "sm"
                        ? "text-sm"
                        : fontSize === "lg"
                        ? "text-lg"
                        : "text-base"
                    }`}
                  >
                    {detail.paragraphs.map((para, pIdx) => {
                      // 将段落分词为词语和标点符号，赋予单词点击事件
                      const tokens = para.split(/(\s+|[.,!?;:"()]+)/)

                      return (
                        <p key={pIdx} className="leading-relaxed">
                          {tokens.map((token, tIdx) => {
                            const isWord = /^[a-zA-Z'-]+$/.test(token)
                            if (!isWord) return <span key={tIdx}>{token}</span>

                            const clean = token.toLowerCase()
                            const lem = lemmatize(token)
                            const base = lem.baseLemma ? lem.baseLemma.toLowerCase() : clean
                            const isTarget =
                              detail.targetWords?.map((x) => x.toLowerCase()).includes(clean)
                            const isHarvested = harvestedWords.has(clean) || harvestedWords.has(base)

                            return (
                              <span
                                key={tIdx}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  const rect = e.currentTarget.getBoundingClientRect()
                                  handleWordClick(token, para, rect)
                                }}
                                className={`cursor-pointer rounded px-0.5 transition-colors ${
                                  isHarvested
                                    ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold"
                                    : isTarget
                                    ? "underline decoration-current/40 hover:bg-current/15 font-semibold"
                                    : "hover:bg-current/15"
                                }`}
                                title="点击查词"
                              >
                                {token}
                              </span>
                            )
                          })}
                        </p>
                      )
                    })}
                  </div>
                </article>
              ) : null}
            </div>

            {/* 智能悬浮词典卡片 & 选句即查小窗 (基于单词/选区位置定位) */}
            {lookupWord && anchorRect && (
              <WordLookupPopover
                word={lookupWord}
                contextSentence={lookupContextSentence}
                anchorRect={anchorRect}
                onClose={() => {
                  setLookupWord(null)
                  setAnchorRect(null)
                }}
                onHarvestChange={(lemma, isHarvested) => {
                  setHarvestedWords((prev) => {
                    const next = new Set(prev)
                    if (isHarvested) {
                      next.add(lemma.toLowerCase())
                    } else {
                      next.delete(lemma.toLowerCase())
                    }
                    return next
                  })
                }}
              />
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
