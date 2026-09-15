"use client"

import { useState, useEffect, useCallback, useRef, Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import {
  BookOpenIcon,
  CheckCircle2Icon,
  SearchIcon,
  SparklesIcon,
  DownloadCloudIcon,
  UploadCloudIcon,
  RefreshCwIcon,
  CheckIcon,
  XIcon,
  FileTextIcon,
  ChevronRightIcon,
  AlertCircleIcon,
  Trash2Icon,
  ClockIcon,
  LayersIcon,
} from "lucide-react"
import { wordbookApi, type Wordbook } from "@/lib/api-client"
import { WordbookStudyDrawer } from "@/components/wordbook/wordbook-study-drawer"

function WordbooksPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  // 从 URL Query 读取当前打开的词库 ID
  const activeBookIdQuery = searchParams.get("bookId")
  const activeBookId = activeBookIdQuery ? Number(activeBookIdQuery) : null

  const [selectedCategory, setSelectedCategory] = useState<string>("全部")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [books, setBooks] = useState<Wordbook[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [primaryId, setPrimaryId] = useState<number>(1)
  const [clickHistory, setClickHistory] = useState<Record<number, number>>({})
  const [deleteTarget, setDeleteTarget] = useState<Wordbook | null>(null)
  const [isDeleting, setIsDeleting] = useState<boolean>(false)
  const [importingId, setImportingId] = useState<number | null>(null)
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null)
  const [batchModalTarget, setBatchModalTarget] = useState<Wordbook | null>(null)

  // 从 localStorage 恢复主词书设定与点击历史事件记录
  useEffect(() => {
    try {
      const savedPrimary = localStorage.getItem("lexiflow_primary_wordbook_id")
      if (savedPrimary) {
        setPrimaryId(Number(savedPrimary))
      }
      const savedHistory = localStorage.getItem("lexiflow_wordbook_click_history")
      if (savedHistory) {
        setClickHistory(JSON.parse(savedHistory))
      }
    } catch {}
  }, [])

  // 记录词书点击事件
  const recordWordbookClick = (bookId: number) => {
    const now = Date.now()
    setClickHistory((prev) => {
      const next = { ...prev, [bookId]: now }
      try {
        localStorage.setItem("lexiflow_wordbook_click_history", JSON.stringify(next))
      } catch {}
      return next
    })
  }

  // 设为当前学习词书（自动置顶到首位并持久化）
  const handleSetPrimary = (bookId: number) => {
    setPrimaryId(bookId)
    try {
      localStorage.setItem("lexiflow_primary_wordbook_id", String(bookId))
    } catch {}
    recordWordbookClick(bookId)
    const book = books.find((b) => b.id === bookId)
    setImportSuccessMsg(`⭐ 已将「${book?.title || "所选词书"}」设为当前主研习词书，已置顶排在第 1 位！`)
    setTimeout(() => setImportSuccessMsg(null), 3500)
  }

  // 确认删除词书
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    try {
      setIsDeleting(true)
      await wordbookApi.delete(deleteTarget.id)

      // 如果被删除的词书恰好是当前主词书，重新指定下一本词书
      if (deleteTarget.id === primaryId) {
        const remaining = books.filter((b) => b.id !== deleteTarget.id)
        if (remaining.length > 0) {
          setPrimaryId(remaining[0].id)
          try {
            localStorage.setItem("lexiflow_primary_wordbook_id", String(remaining[0].id))
          } catch {}
        }
      }

      // 从点击历史中清除
      setClickHistory((prev) => {
        const next = { ...prev }
        delete next[deleteTarget.id]
        try {
          localStorage.setItem("lexiflow_wordbook_click_history", JSON.stringify(next))
        } catch {}
        return next
      })

      // 如果当前抽屉打开的是被删除词书，关闭抽屉
      if (activeBookId === deleteTarget.id) {
        handleCloseDrawer()
      }

      setImportSuccessMsg(`🗑️ 词书「${deleteTarget.title}」已安全删除！`)
      setTimeout(() => setImportSuccessMsg(null), 4000)
      setDeleteTarget(null)
      await loadWordbooks()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "删除失败，请稍后重试"
      alert(`删除失败: ${msg}`)
    } finally {
      setIsDeleting(false)
    }
  }

  // 格式化相对点击/研习时间
  const formatRelativeTime = (timestamp?: number) => {
    if (!timestamp) return null
    const diff = Date.now() - timestamp
    if (diff < 60 * 1000) return "刚刚研习"
    if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))} 分钟前访问`
    if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))} 小时前访问`
    if (diff < 7 * 24 * 60 * 60 * 1000) return `${Math.floor(diff / (24 * 60 * 60 * 1000))} 天前访问`
    return new Date(timestamp).toLocaleDateString("zh-CN")
  }

  // 导入词书弹窗状态
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadTitle, setUploadTitle] = useState<string>("")
  const [uploadCategory, setUploadCategory] = useState<string>("EXAM")
  const [uploadTags, setUploadTags] = useState<string>("")
  const [uploadDesc, setUploadDesc] = useState<string>("")
  const [isUploading, setIsUploading] = useState<boolean>(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const categories = ["全部", "EXAM", "COLLOQUIAL", "PROFESSIONAL", "ACADEMIC"]

  const loadWordbooks = useCallback(async () => {
    try {
      setLoading(true)
      const data = await wordbookApi.list()
      setBooks(data || [])
    } catch (e) {
      console.warn("Fetch wordbooks error:", e)
      setBooks([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadWordbooks()

    const handleWordbookUpdate = () => {
      loadWordbooks()
    }

    window.addEventListener("lexiflow_wordbook_updated", handleWordbookUpdate)

    return () => {
      window.removeEventListener("lexiflow_wordbook_updated", handleWordbookUpdate)
    }
  }, [loadWordbooks])

  // 打开抽屉/浮层 (同步推入 URL query 并记录点击历史事件)
  const handleOpenDrawer = (bookId: number) => {
    recordWordbookClick(bookId)
    const params = new URLSearchParams(searchParams.toString())
    params.set("bookId", String(bookId))
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  // 关闭抽屉/浮层
  const handleCloseDrawer = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("bookId")
    const newQuery = params.toString()
    router.push(newQuery ? `${pathname}?${newQuery}` : pathname, { scroll: false })
    loadWordbooks()
  }

  const handleImportToVocab = async (bookId: number, limit = 20) => {
    try {
      recordWordbookClick(bookId)
      setImportingId(bookId)
      const res = await wordbookApi.importToVocab(bookId, limit)
      setImportSuccessMsg(res.message || "已成功推入生词本，加入 FSRS 记忆队列！")
      setTimeout(() => setImportSuccessMsg(null), 5000)
      setBatchModalTarget(null)
      await loadWordbooks()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "请确认后端服务正常运行"
      alert(`导入失败: ${msg}`)
    } finally {
      setImportingId(null)
    }
  }

  const ALLOWED_EXTENSIONS = ["csv", "txt", "tsv", "json"]

  // 处理文件选中与严格格式校验
  const handleFileChange = (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase() || ""
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setUploadError(`文件格式不被支持（.${ext || "未知"}）！系统仅接收 .csv, .txt, .tsv, .json 格式文件。`)
      setUploadFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }

    if (file.size === 0) {
      setUploadError("文件内容为空，请选择有效的词汇文件！")
      setUploadFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }

    if (file.size > 15 * 1024 * 1024) {
      setUploadError("文件大小超出限制，单文件不能超过 15MB！")
      setUploadFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }

    setUploadFile(file)
    setUploadError(null)
    if (!uploadTitle.trim()) {
      const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ")
      setUploadTitle(cleanName)
    }
  }

  // 提交上传词书
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadFile) {
      setUploadError("请选择需要上传的词书文件 (.csv, .txt, .tsv, .json)")
      return
    }
    if (!uploadTitle.trim()) {
      setUploadError("请输入词书名称")
      return
    }

    try {
      setIsUploading(true)
      setUploadError(null)

      const formData = new FormData()
      formData.append("file", uploadFile)
      formData.append("title", uploadTitle.trim())
      formData.append("category", uploadCategory)
      if (uploadDesc.trim()) formData.append("description", uploadDesc.trim())
      if (uploadTags.trim()) formData.append("tags", uploadTags.trim())

      const newBook = await wordbookApi.upload(formData)
      setIsUploadModalOpen(false)
      setUploadFile(null)
      setUploadTitle("")
      setUploadDesc("")
      setUploadTags("")
      setImportSuccessMsg(`🎉 自定义词书「${newBook.title}」导入成功！共计 ${newBook.totalWords} 词`)
      setTimeout(() => setImportSuccessMsg(null), 5000)
      await loadWordbooks()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "词书解析失败，请检查文件格式"
      setUploadError(msg)
    } finally {
      setIsUploading(false)
    }
  }

  const filteredBooks = books.filter((b) => {
    const matchCat =
      selectedCategory === "全部" ||
      b.category === selectedCategory ||
      (selectedCategory === "EXAM" && b.category === "EXAM")
    const matchQuery =
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.description.toLowerCase().includes(searchQuery.toLowerCase())
    return matchCat && matchQuery
  })

  // 严格排序规则：
  // 1. 当前主研习词书 (primaryId) 永远排在第一位 (TOP 1)
  // 2. 其他词书根据点击/访问的历史事件时间戳倒序排序 (最近点击排在前面)
  // 3. 兜底按 ID 正序
  const sortedBooks = [...filteredBooks].sort((a, b) => {
    if (a.id === primaryId) return -1
    if (b.id === primaryId) return 1

    const aTime = clickHistory[a.id] || 0
    const bTime = clickHistory[b.id] || 0
    if (aTime !== bTime) {
      return bTime - aTime
    }

    return a.id - b.id
  })

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 pt-2 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono tracking-wider text-primary font-semibold uppercase flex items-center gap-1.5">
            <SparklesIcon className="size-3.5" /> Curated Repositories · 权威考纲与自建词库
          </div>
          <h1 className="mt-0.5 text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            词书研习库
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            内置考纲标准词库与自定义词书导入。当前主学习词书自动置顶，其他词书根据最近点击历史智能排序。
          </p>
        </div>

        {/* Actions: Search + Upload Button */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="relative w-full sm:w-64">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索词书标题或简介..."
              className="w-full h-9 pl-9 pr-3 rounded-xl border border-border bg-card text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <button
            onClick={() => {
              setIsUploadModalOpen(true)
              setUploadError(null)
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-sm hover:bg-primary/90 transition-all active:scale-95 shrink-0 cursor-pointer"
          >
            <UploadCloudIcon className="size-4" />
            <span>导入自定义词书</span>
          </button>
        </div>
      </div>

      {/* Floating Success Alert */}
      {importSuccessMsg && (
        <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckIcon className="size-4 shrink-0" />
            <span>{importSuccessMsg}</span>
          </div>
          <Link
            href="/cards"
            className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors text-[11px]"
          >
            去复习闪卡 &rarr;
          </Link>
        </div>
      )}

      {/* Category Pills & Refresh */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
        <div className="flex items-center gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 cursor-pointer ${
                selectedCategory === cat
                  ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat === "全部"
                ? "全部"
                : cat === "EXAM"
                ? "考试大纲 (CET/考研)"
                : cat === "COLLOQUIAL"
                ? "日常高频口语"
                : cat === "PROFESSIONAL"
                ? "行业专业"
                : "学术科研"}
            </button>
          ))}
        </div>

        <button
          onClick={loadWordbooks}
          disabled={loading}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 cursor-pointer"
          title="刷新词书数据"
        >
          <RefreshCwIcon className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">刷新</span>
        </button>
      </div>

      {/* Grid of Wordbooks */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {sortedBooks.map((book) => {
          const isPrimary = book.id === primaryId
          const progress =
            book.progressPercent ??
            (book.totalWords > 0
              ? Math.round(((book.masteredWords || 0) / book.totalWords) * 1000) / 10
              : 0)
          const isImporting = importingId === book.id
          const lastClickedTime = clickHistory[book.id]

          return (
            <article
              key={book.id}
              className={`relative flex flex-col justify-between rounded-3xl border bg-card/90 p-6 backdrop-blur-sm transition-all hover:shadow-lg hover:border-primary/40 group ${
                isPrimary ? "border-primary ring-2 ring-primary/20 bg-primary/[0.02]" : "border-border"
              }`}
            >
              <div>
                {/* Top badges */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      {book.category}
                    </span>
                    {isPrimary && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                        <SparklesIcon className="size-2.5 fill-amber-500 text-amber-500" />
                        当前主研习 · TOP 1
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {!isPrimary && (
                      <button
                        type="button"
                        onClick={() => handleSetPrimary(book.id)}
                        className="text-[11px] text-muted-foreground hover:text-primary transition-colors cursor-pointer px-1.5 py-0.5 rounded hover:bg-muted font-medium"
                        title="设为当前主学习词书（将置顶至第 1 位）"
                      >
                        设为当前学习
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(book)}
                      className="p-1 rounded-lg text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                      title="删除此词书"
                      aria-label="删除词书"
                    >
                      <Trash2Icon className="size-3.5" />
                    </button>
                  </div>
                </div>

                {/* Title (Clickable button directly opens Drawer) */}
                <button
                  type="button"
                  onClick={() => handleOpenDrawer(book.id)}
                  className="mt-4 w-full text-left flex items-center justify-between text-lg font-bold text-foreground tracking-tight hover:text-primary transition-colors cursor-pointer"
                >
                  <span>{book.title}</span>
                  <ChevronRightIcon className="size-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-primary" />
                </button>

                {/* Description */}
                <p className="mt-2 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  {book.description}
                </p>

                {/* Meta stats tags */}
                <div className="mt-3.5 flex flex-wrap gap-2 text-[10px] font-mono text-muted-foreground">
                  <span className="rounded-md bg-muted px-2 py-0.5">
                    在学: {book.learnedWords ?? 0} 词
                  </span>
                  <span className="rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold px-2 py-0.5">
                    已斩词: {book.masteredWords ?? 0} 词
                  </span>
                </div>
              </div>

              {/* Progress & Bottom Actions */}
              <div className="mt-6 pt-4 border-t border-border/70">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="font-mono font-bold text-foreground text-sm">
                    {progress}% <span className="font-normal text-[11px] text-muted-foreground">标熟进度</span>
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    已标熟 {(book.masteredWords || 0).toLocaleString()} / {book.totalWords.toLocaleString()} 词
                  </span>
                </div>

                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                {/* Action buttons */}
                <div className="mt-4 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenDrawer(book.id)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all active:scale-95 shadow-sm cursor-pointer"
                  >
                    <BookOpenIcon className="size-3.5" />
                    <span>展开研习词库</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleImportToVocab(book.id, 20)}
                      disabled={isImporting}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-2xs"
                      title="推入当前学习周期（下一组 20 词）至闪卡研习"
                    >
                      <DownloadCloudIcon className={`size-3.5 ${isImporting ? "animate-bounce" : ""}`} />
                      <span>{isImporting ? "推送中..." : "推入周期 (20词)"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setBatchModalTarget(book)}
                      className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                      title="选择推入周期批次 (20/40/100词/全量)"
                    >
                      <LayersIcon className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </article>
          )
        })}
      </div>

      {/* 真实空状态引导看板 (当数据库无词书或筛选无结果时展示) */}
      {!loading && sortedBooks.length === 0 && (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-3xl border border-dashed border-border bg-card/40 my-2">
          <div className="p-4 rounded-3xl bg-muted/60 text-muted-foreground mb-4">
            <BookOpenIcon className="size-8 stroke-[1.5]" />
          </div>
          <h3 className="text-base font-bold text-foreground">
            {searchQuery || selectedCategory !== "全部" ? "未匹配到相关词书" : "词书库暂无词书"}
          </h3>
          <p className="mt-1.5 text-xs text-muted-foreground max-w-md leading-relaxed">
            {searchQuery || selectedCategory !== "全部"
              ? "没有找到符合当前筛选条件的词书，可尝试更换搜索关键词或选择「全部」分类"
              : "当前数据库中尚未录入任何词书。你可以点击右上角「导入词书」上传专属的 .csv / .txt / .json 词汇表，开启个性化研习。"}
          </p>
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
          >
            <UploadCloudIcon className="size-4" />
            <span>立即导入第一本词书</span>
          </button>
        </div>
      )}

      {/* Upload Custom Wordbook Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95">
            <button
              onClick={() => setIsUploadModalOpen(false)}
              className="absolute right-5 top-5 p-1 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <XIcon className="size-5" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-2xl bg-primary/10 text-primary">
                <UploadCloudIcon className="size-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">导入自定义词书</h2>
                <p className="text-xs text-muted-foreground">
                  适配各类学习软件导出的 .csv, .txt, .tsv, .json 格式文件
                </p>
              </div>
            </div>

            {uploadError && (
              <div className="mt-4 p-3 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                <AlertCircleIcon className="size-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            <form onSubmit={handleUploadSubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  词书文件 (支持 .csv / .txt / .tsv / .json)
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleFileChange(e.dataTransfer.files[0])
                    }
                  }}
                  className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all ${
                    uploadFile
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40 hover:bg-muted/40"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt,.tsv,.json"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileChange(e.target.files[0])
                      }
                    }}
                  />
                  {uploadFile ? (
                    <div className="flex items-center justify-center gap-2 text-xs text-foreground font-medium">
                      <FileTextIcon className="size-5 text-primary" />
                      <div className="text-left">
                        <p className="font-bold">{uploadFile.name}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">
                          {(uploadFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-2 text-muted-foreground">
                      <UploadCloudIcon className="size-8 text-primary/70 mb-1" />
                      <p className="text-xs font-medium text-foreground">
                        点击或将词书文件拖拽至此处
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        支持每行一个单词、CSV 分隔文本，或通用 JSON 词库数组/对象
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  词书名称 *
                </label>
                <input
                  type="text"
                  required
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="例如：GRE 核心高频3000词"
                  className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    所属分类
                  </label>
                  <select
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="EXAM">考试大纲 (EXAM)</option>
                    <option value="COLLOQUIAL">日常口语 (COLLOQUIAL)</option>
                    <option value="PROFESSIONAL">行业专业 (PROFESSIONAL)</option>
                    <option value="ACADEMIC">学术科研 (ACADEMIC)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    标签 (逗号分隔)
                  </label>
                  <input
                    type="text"
                    value={uploadTags}
                    onChange={(e) => setUploadTags(e.target.value)}
                    placeholder="GRE, 进阶, 核心"
                    className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  词书简介 (可选)
                </label>
                <textarea
                  rows={2}
                  value={uploadDesc}
                  onChange={(e) => setUploadDesc(e.target.value)}
                  placeholder="简述词书来源、适用人群或研习目标..."
                  className="w-full p-2.5 rounded-xl border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isUploading || !uploadFile}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <SparklesIcon className={`size-3.5 ${isUploading ? "animate-spin" : ""}`} />
                  <span>{isUploading ? "智能解析匹配中..." : "开始解析并生成词库"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Batch Cycle Import Modal */}
      {batchModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95">
            <button
              onClick={() => setBatchModalTarget(null)}
              className="absolute right-5 top-5 p-1 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <XIcon className="size-4" />
            </button>

            <div className="flex items-center gap-2.5 mb-2">
              <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <LayersIcon className="size-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">分阶段推入闪卡研习</h3>
                <p className="text-xs text-muted-foreground font-medium">「{batchModalTarget.title}」</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed mt-2 mb-4">
              建议按认知周期分批推进，避免一次性注入海量生词造成复习过载。每完成一个周期，可随时在此继续推入下一批。
            </p>

            <div className="space-y-2.5">
              <button
                type="button"
                disabled={importingId === batchModalTarget.id}
                onClick={() => handleImportToVocab(batchModalTarget.id, 20)}
                className="w-full flex items-center justify-between p-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/15 transition-all text-left cursor-pointer group"
              >
                <div>
                  <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <span>标准周期 · 20 词</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-500/20 font-normal">强烈推荐</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">符合艾宾浩斯与 FSRS 每日最佳认知通量，轻松无积压</div>
                </div>
                <ChevronRightIcon className="size-4 text-emerald-500 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </button>

              <button
                type="button"
                disabled={importingId === batchModalTarget.id}
                onClick={() => handleImportToVocab(batchModalTarget.id, 40)}
                className="w-full flex items-center justify-between p-3 rounded-2xl border border-border/80 bg-background hover:bg-muted/60 transition-all text-left cursor-pointer group"
              >
                <div>
                  <div className="text-xs font-bold text-foreground">双倍周期 · 40 词</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">适合周末集中研习或备考阶段攻坚</div>
                </div>
                <ChevronRightIcon className="size-4 text-muted-foreground opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </button>

              <button
                type="button"
                disabled={importingId === batchModalTarget.id}
                onClick={() => handleImportToVocab(batchModalTarget.id, 100)}
                className="w-full flex items-center justify-between p-3 rounded-2xl border border-border/80 bg-background hover:bg-muted/60 transition-all text-left cursor-pointer group"
              >
                <div>
                  <div className="text-xs font-bold text-foreground">大批次冲刺 · 100 词</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">适合词汇量较大、做快速筛查的研习者</div>
                </div>
                <ChevronRightIcon className="size-4 text-muted-foreground opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </button>

              <button
                type="button"
                disabled={importingId === batchModalTarget.id}
                onClick={() => handleImportToVocab(batchModalTarget.id, -1)}
                className="w-full flex items-center justify-between p-3 rounded-2xl border border-border/60 bg-muted/20 hover:bg-muted/40 transition-all text-left cursor-pointer group"
              >
                <div>
                  <div className="text-xs font-semibold text-muted-foreground">全量推入剩余未学 (一次性)</div>
                  <div className="text-[11px] text-muted-foreground/80 mt-0.5">采用后台 200ms 批量写入引擎，但可能导致生词本较长</div>
                </div>
                <ChevronRightIcon className="size-4 text-muted-foreground opacity-40 group-hover:opacity-80 transition-all" />
              </button>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setBatchModalTarget(null)}
                className="px-4 py-1.5 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Wordbook Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md rounded-3xl border border-destructive/30 bg-card p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-2xl bg-destructive/10 text-destructive shrink-0">
                <Trash2Icon className="size-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">确认删除词书？</h2>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                  您即将删除词书「<span className="font-semibold text-foreground">{deleteTarget.title}</span>」。
                  该词书共收录 <span className="font-mono font-semibold text-foreground">{deleteTarget.totalWords}</span> 个词条。
                </p>
                <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-[11px] leading-relaxed">
                  ⚠️ 此操作将永久移除该词书的所有大纲词条。已添加到个人生词本复习的单词将保留在记忆库中，不会丢失。
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
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

      {/* 词书详情沉浸式抽屉/浮层 (URL Query 驱动) */}
      <WordbookStudyDrawer
        bookId={activeBookId}
        isOpen={activeBookId !== null}
        onClose={handleCloseDrawer}
      />
    </div>
  )
}

export default function WordbooksPage() {
  return (
    <Suspense fallback={null}>
      <WordbooksPageContent />
    </Suspense>
  )
}
