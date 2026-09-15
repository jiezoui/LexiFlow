/**
 * 语脉 · 词级动态规划强制对齐算法引擎 (Word-level DP Forced Aligner)
 * 基于二维 Levenshtein 代价矩阵与发音编辑容差，精准对齐标准基准句与用户语音识别转录流。
 */

export type AlignmentStatus = "CORRECT" | "SUBSTITUTION" | "OMISSION" | "INSERTION"

export interface AlignedToken {
  /** 标准基准单词 (原词，保留原始大小写用于显示) */
  word: string
  /** 归一化后的小写词元 */
  lemma: string
  /** 对齐判决状态 */
  status: AlignmentStatus
  /** 用户实际读出的单词 (仅在 SUBSTITUTION 或 INSERTION 时有效) */
  actualWord?: string
  /** 相似度得分 (0.0 ~ 1.0) */
  similarity: number
}

export interface AlignmentResult {
  /** 对齐后的词块序列 */
  tokens: AlignedToken[]
  /** 准确度得分 (0 ~ 100) */
  accuracy: number
  /** 完整度得分 (0 ~ 100) */
  completeness: number
  /** 流利度得分 (0 ~ 100) */
  fluency: number
  /** 综合跟读总得分 (0 ~ 100) */
  overallScore: number
  /** 正确单词数 */
  correctCount: number
  /** 误读单词数 */
  substitutionCount: number
  /** 漏读单词数 */
  omissionCount: number
  /** 多读/插入词数 */
  insertionCount: number
  /** 算法计算耗时 (毫秒) */
  processingTimeMs: number
}

/**
 * 字符串字符级 Levenshtein 编辑距离计算
 */
function charEditDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))

  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,      // 删除
          dp[i][j - 1] + 1,      // 插入
          dp[i - 1][j - 1] + 1   // 替换
        )
      }
    }
  }
  return dp[m][n]
}

/**
 * 文本清洗与分词：保留显示原词，并剥离标点生成小写词元
 */
function tokenizeText(text: string): { original: string; clean: string }[] {
  if (!text) return []
  const rawTokens = text.trim().split(/\s+/)
  return rawTokens
    .map((token) => {
      const clean = token.toLowerCase().replace(/[^a-z0-9']/g, "")
      return {
        original: token.replace(/^[“"']+|[”"',.?!:;]+$/g, ""),
        clean,
      }
    })
    .filter((t) => t.clean.length > 0)
}

/**
 * 计算两个单词的发音/拼写容差代价
 * 返回 [代价, 相似度]
 */
function calculateWordMatchCost(ref: string, hyp: string): [number, number] {
  if (ref === hyp) {
    return [0.0, 1.0]
  }

  const maxLen = Math.max(ref.length, hyp.length)
  if (maxLen === 0) return [0.0, 1.0]

  const dist = charEditDistance(ref, hyp)
  const similarity = Math.max(0, 1 - dist / maxLen)

  // 若编辑距离 <= 2 且相似度 >= 60%，如单复数、前缀相似或识别细微偏差，给予准正确惩罚
  if (dist <= 2 && similarity >= 0.6) {
    return [0.35, similarity]
  }

  // 完全误读
  return [1.0, similarity]
}

/**
 * 核心算法：基于二维 Levenshtein 动态规划的词级对齐
 * @param referenceText 标准基准文本 (如外刊或卡片例句)
 * @param spokenText 用户语音识别转写的文本
 */
export function alignWords(referenceText: string, spokenText: string): AlignmentResult {
  const t0 = performance.now()

  const refTokens = tokenizeText(referenceText)
  const hypTokens = tokenizeText(spokenText)

  const M = refTokens.length
  const N = hypTokens.length

  // 代价参数定义
  const COST_OMISSION = 1.0   // 漏读代价
  const COST_INSERTION = 0.8  // 多读代价

  // 1. 初始化 (M+1) x (N+1) DP 矩阵
  const D: number[][] = Array.from({ length: M + 1 }, () => Array(N + 1).fill(0))

  for (let i = 0; i <= M; i++) {
    D[i][0] = i * COST_OMISSION
  }
  for (let j = 0; j <= N; j++) {
    D[0][j] = j * COST_INSERTION
  }

  // 2. 状态转移递推
  for (let i = 1; i <= M; i++) {
    const rClean = refTokens[i - 1].clean
    for (let j = 1; j <= N; j++) {
      const hClean = hypTokens[j - 1].clean
      const [matchCost] = calculateWordMatchCost(rClean, hClean)

      D[i][j] = Math.min(
        D[i - 1][j] + COST_OMISSION,            // 漏读
        D[i][j - 1] + COST_INSERTION,           // 多读
        D[i - 1][j - 1] + matchCost             // 匹配或替换
      )
    }
  }

  // 3. 最优对齐路径回溯 (Traceback)
  let i = M
  let j = N
  const reversedTokens: AlignedToken[] = []

  let correctCount = 0
  let substitutionCount = 0
  let omissionCount = 0
  let insertionCount = 0

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const rToken = refTokens[i - 1]
      const hToken = hypTokens[j - 1]
      const [matchCost, sim] = calculateWordMatchCost(rToken.clean, hToken.clean)

      // 判断是由对角线移动转移而来
      if (Math.abs(D[i][j] - (D[i - 1][j - 1] + matchCost)) < 1e-5) {
        if (matchCost === 0.0) {
          reversedTokens.push({
            word: rToken.original,
            lemma: rToken.clean,
            status: "CORRECT",
            similarity: 1.0,
          })
          correctCount++
        } else {
          // 替换或发音偏差
          reversedTokens.push({
            word: rToken.original,
            lemma: rToken.clean,
            status: "SUBSTITUTION",
            actualWord: hToken.original,
            similarity: sim,
          })
          substitutionCount++
        }
        i--
        j--
        continue
      }
    }

    // 判断是否是由上方转移 (漏读 Omission)
    if (i > 0 && Math.abs(D[i][j] - (D[i - 1][j] + COST_OMISSION)) < 1e-5) {
      const rToken = refTokens[i - 1]
      reversedTokens.push({
        word: rToken.original,
        lemma: rToken.clean,
        status: "OMISSION",
        similarity: 0.0,
      })
      omissionCount++
      i--
      continue
    }

    // 否则是由左方转移 (多读/插入 Insertion)
    if (j > 0) {
      const hToken = hypTokens[j - 1]
      reversedTokens.push({
        word: `+${hToken.original}`,
        lemma: hToken.clean,
        status: "INSERTION",
        actualWord: hToken.original,
        similarity: 0.0,
      })
      insertionCount++
      j--
      continue
    }
  }

  const alignedTokens = reversedTokens.reverse()
  const t1 = performance.now()

  // 4. 多维口语量化评分计算
  const totalRef = Math.max(1, M)

  // 准确度
  const accuracy = Math.min(100, Math.round(((correctCount + substitutionCount * 0.3) / totalRef) * 100))

  // 完整度
  const completeness = Math.max(0, Math.min(100, Math.round(((totalRef - omissionCount) / totalRef) * 100)))

  // 流利度
  const fluencyPenalty = Math.min(60, insertionCount * 12 + substitutionCount * 5)
  const fluency = Math.max(20, 100 - fluencyPenalty)

  // 综合总得分
  const overallScore = Math.min(100, Math.max(0, Math.round(accuracy * 0.5 + completeness * 0.3 + fluency * 0.2)))

  return {
    tokens: alignedTokens,
    accuracy,
    completeness,
    fluency,
    overallScore,
    correctCount,
    substitutionCount,
    omissionCount,
    insertionCount,
    processingTimeMs: Math.round(t1 - t0),
  }
}
