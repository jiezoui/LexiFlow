// ---------------------------------------------------------------------------
// LexiFlow Seed & Support Data
// ---------------------------------------------------------------------------

// ── Notifications ──────────────────────────────────────────────────────────

export type Notification = {
  id: string
  type: "transaction" | "security" | "system" | "promotion" | "request"
  title: string
  description: string
  time: string
  read: boolean
  icon: string
  actionable?: {
    accept: string
    decline: string
    amount?: string
    from?: string
    fromAvatar?: string
  }
}

export const notifications: Notification[] = [
  {
    id: "n-fsrs-due",
    type: "system",
    title: "今日 FSRS 复习任务已生成",
    description: "您有 18 个生词已到达记忆遗忘临界点，预计耗时 8 分钟完成闪卡复习。",
    time: "刚刚",
    read: false,
    icon: "sparkles",
    actionable: {
      accept: "立即复习",
      decline: "稍后提醒",
    },
  },
  {
    id: "n-media-ready",
    type: "system",
    title: "视频原声字幕与 ASR 对齐完成",
    description: "视频《Steve Jobs Stanford Commencement》已完成 Whisper 离线词级对齐与双语翻译。",
    time: "10 分钟前",
    read: false,
    icon: "check-circle",
  },
  {
    id: "n-milestone",
    type: "promotion",
    title: "研习里程碑达成",
    description: "「CET-6 核心词汇」掌握进度已突破 65%，长期记忆留存率维持在 91.4%。",
    time: "2 小时前",
    read: false,
    icon: "trending-up",
  },
  {
    id: "n-context-capture",
    type: "system",
    title: "外刊语境采词同步",
    description: "在《BBC News》阅读中摘录的 5 个高频专业生词已绑定上下文原句入库。",
    time: "昨天",
    read: true,
    icon: "file-text",
  },
  {
    id: "n-dict-sync",
    type: "security",
    title: "ECDICT 本地离线词库就绪",
    description: "本地 300 万+ 离线词典索引与词形还原数据库加载正常，支持无网极速查词。",
    time: "3 天前",
    read: true,
    icon: "shield-check",
  },
]

// ── Help & Support Data ───────────────────────────────────────────────────

export type FaqItem = {
  id: string
  question: string
  answer: string
  category: "account" | "payments" | "security" | "billing" | "general"
}

export const faqItems: FaqItem[] = [
  {
    id: "faq1",
    category: "account",
    question: "FSRS 记忆间隔算法是如何工作的？",
    answer: "语脉采用现代自由间隔复习算法（FSRS），根据单词的记忆稳定性（S）与难度（D）动态推算最佳复习时点，平均减少 30% 重复做功，抗遗忘保持率可达 90% 以上。",
  },
  {
    id: "faq2",
    category: "general",
    question: "如何导入本地视频进行双语精听？",
    answer: "进入「视频精听」页面，点击上传本地 MP4/MKV 视频，系统将自动进行分片直传，并通过后台媒体 Worker 运行 faster-whisper 提取词级时间戳与双语字幕。",
  },
  {
    id: "faq3",
    category: "general",
    question: "影子跟读（Shadowing）的评测机制是什么？",
    answer: "系统录制您的跟读发音，并在本地或后端针对音准准确度、语流连贯性与节奏起伏进行多维度打分，高亮未读准的单词与辅音连读。",
  },
  {
    id: "faq4",
    category: "general",
    question: "词书与大纲词库如何自由切换？",
    answer: "进入「词书库」页面，可选择 CET-4/6 核心词、考研必考、雅思托福或学术高频词。点击卡片上的「设为主词书」，今日研习队列将自动无缝重排。",
  },
  {
    id: "faq5",
    category: "account",
    question: "在阅读长文时生词是如何自动沉淀的？",
    answer: "在「阅读库」中阅读外刊或长文时，选中生词即可触发秒级浮窗查词，点击「采摘到生词本」后，生词将携带原句语境上下文与译文自动注入 FSRS 今日复习队列。",
  },
  {
    id: "faq6",
    category: "security",
    question: "我的研习记录和个人生词本存储在本地吗？",
    answer: "是的，语脉采用本地优先架构，所有生词本、复习状态、音频切片与热力图记录均受服务端与本地双重持久化保障，保证高可用与数据隐私。",
  },
  {
    id: "faq7",
    category: "general",
    question: "如何调整每日研习的新词与复习通量？",
    answer: "在首页任务看板或系统设置中，可自由调整每日目标新词量（默认 20 词）。FSRS 算法引擎将根据历史遗忘回流情况自动为您规划合理的复习量，避免认知过载。",
  },
  {
    id: "faq8",
    category: "general",
    question: "遇到不熟悉的专业学科词汇怎么办？",
    answer: "语脉内置离线 ECDICT 百万级词典，并支持医学、计算机、商务等 14 类学术学科标签，划词即可获取权威中英双解、词根派生与音标发音。",
  },
  {
    id: "faq9",
    category: "account",
    question: "如何将本地生词本导出？",
    answer: "在生词本页面点击右上角「导出」，即可一键将带有原声切片和上下文例句的卡片导出为 CSV 数据表或 Anki 格式，方便跨平台迁移。",
  },
]

export type SupportTicket = {
  id: string
  subject: string
  status: "open" | "in-progress" | "resolved"
  priority: "low" | "medium" | "high"
  createdAt: string
  lastUpdate: string
}

export const supportTickets: SupportTicket[] = [
  {
    id: "tk1",
    subject: "Whisper 词级强制对齐延迟与长音频切片优化建议",
    status: "in-progress",
    priority: "high",
    createdAt: "2026-09-08",
    lastUpdate: "2026-09-11",
  },
  {
    id: "tk2",
    subject: "请求新增计算机学术论文外刊分级语料库",
    status: "open",
    priority: "medium",
    createdAt: "2026-09-09",
    lastUpdate: "2026-09-10",
  },
  {
    id: "tk3",
    subject: "离线本地词典缓存重构与词形还原规则补充",
    status: "resolved",
    priority: "low",
    createdAt: "2026-09-02",
    lastUpdate: "2026-09-05",
  },
]

export const systemStatus = [
  { name: "FSRS 记忆调度引擎 (Core Algorithm)", status: "operational" as const },
  { name: "Whisper 原声词级对齐服务 (ASR Worker)", status: "operational" as const },
  { name: "多模态视频语境解析管道 (Media Stream)", status: "operational" as const },
  { name: "ECDICT 离线词典检索服务 (Local DB)", status: "operational" as const },
  { name: "TTS 原生声学伴读引擎 (Audio Synthesis)", status: "operational" as const },
]
