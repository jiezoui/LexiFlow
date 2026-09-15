/**
 * 英文形态学还原引擎 (English Morphology & Lemmatizer)
 * 能够自动将英文屈折变化形式（过去式、过去分词、进行时、第三人称单数、复数、比较级/最高级）
 * 还原为基本词形 (Lemma 原型)，并生成标准的形态学中文标注。
 */

export interface LemmatizedResult {
  isInflected: boolean
  baseLemma: string
  inflectionLabel: string
  displayText: string
}

// 常见高频不规则动词/名词/形容词映射表
const IRREGULAR_WORDS: Record<string, { base: string; label: string }> = {
  // 核心动词变化
  was: { base: "be", label: "动词过去式" },
  were: { base: "be", label: "动词过去式" },
  been: { base: "be", label: "动词过去分词" },
  had: { base: "have", label: "动词过去式 动词过去分词" },
  has: { base: "have", label: "第三人称单数" },
  did: { base: "do", label: "动词过去式" },
  done: { base: "do", label: "动词过去分词" },
  does: { base: "do", label: "第三人称单数" },
  went: { base: "go", label: "动词过去式" },
  gone: { base: "go", label: "动词过去分词" },
  goes: { base: "go", label: "第三人称单数" },
  said: { base: "say", label: "动词过去式 动词过去分词" },
  says: { base: "say", label: "第三人称单数" },
  made: { base: "make", label: "动词过去式 动词过去分词" },
  makes: { base: "make", label: "第三人称单数" },
  making: { base: "make", label: "现在分词 动名词" },
  took: { base: "take", label: "动词过去式" },
  taken: { base: "take", label: "动词过去分词" },
  taking: { base: "take", label: "现在分词 动名词" },
  came: { base: "come", label: "动词过去式" },
  coming: { base: "come", label: "现在分词 动名词" },
  saw: { base: "see", label: "动词过去式" },
  seen: { base: "see", label: "动词过去分词" },
  knew: { base: "know", label: "动词过去式" },
  known: { base: "know", label: "动词过去分词" },
  got: { base: "get", label: "动词过去式 动词过去分词" },
  gotten: { base: "get", label: "动词过去分词" },
  getting: { base: "get", label: "现在分词 动名词" },
  gave: { base: "give", label: "动词过去式" },
  given: { base: "give", label: "动词过去分词" },
  giving: { base: "give", label: "现在分词 动名词" },
  found: { base: "find", label: "动词过去式 动词过去分词" },
  thought: { base: "think", label: "动词过去式 动词过去分词" },
  told: { base: "tell", label: "动词过去式 动词过去分词" },
  became: { base: "become", label: "动词过去式" },
  becoming: { base: "become", label: "现在分词 动名词" },
  felt: { base: "feel", label: "动词过去式 动词过去分词" },
  kept: { base: "keep", label: "动词过去式 动词过去分词" },
  held: { base: "hold", label: "动词过去式 动词过去分词" },
  wrote: { base: "write", label: "动词过去式" },
  written: { base: "write", label: "动词过去分词" },
  writing: { base: "write", label: "现在分词 动名词" },
  stood: { base: "stand", label: "动词过去式 动词过去分词" },
  heard: { base: "hear", label: "动词过去式 动词过去分词" },
  brought: { base: "bring", label: "动词过去式 动词过去分词" },
  began: { base: "begin", label: "动词过去式" },
  begun: { base: "begin", label: "动词过去分词" },
  beginning: { base: "begin", label: "现在分词 动名词" },
  sat: { base: "sit", label: "动词过去式 动词过去分词" },
  spoke: { base: "speak", label: "动词过去式" },
  spoken: { base: "speak", label: "动词过去分词" },
  left: { base: "leave", label: "动词过去式 动词过去分词" },
  leaving: { base: "leave", label: "现在分词 动名词" },
  ran: { base: "run", label: "动词过去式" },
  running: { base: "run", label: "现在分词 动名词" },
  lost: { base: "lose", label: "动词过去式 动词过去分词" },
  losing: { base: "lose", label: "现在分词 动名词" },
  paid: { base: "pay", label: "动词过去式 动词过去分词" },
  met: { base: "meet", label: "动词过去式 动词过去分词" },
  sent: { base: "send", label: "动词过去式 动词过去分词" },
  built: { base: "build", label: "动词过去式 动词过去分词" },
  understood: { base: "understand", label: "动词过去式 动词过去分词" },
  drew: { base: "draw", label: "动词过去式" },
  drawn: { base: "draw", label: "动词过去分词" },
  spent: { base: "spend", label: "动词过去式 动词过去分词" },
  fell: { base: "fall", label: "动词过去式" },
  fallen: { base: "fall", label: "动词过去分词" },
  led: { base: "lead", label: "动词过去式 动词过去分词" },
  read: { base: "read", label: "动词过去式 动词过去分词" },
  broke: { base: "break", label: "动词过去式" },
  broken: { base: "break", label: "动词过去分词" },
  chose: { base: "choose", label: "动词过去式" },
  chosen: { base: "choose", label: "动词过去分词" },
  grew: { base: "grow", label: "动词过去式" },
  grown: { base: "grow", label: "动词过去分词" },
  hit: { base: "hit", label: "动词过去式 动词过去分词" },
  hitting: { base: "hit", label: "现在分词 动名词" },

  // 不规则名词复数
  children: { base: "child", label: "名词复数" },
  people: { base: "person", label: "名词复数" },
  men: { base: "man", label: "名词复数" },
  women: { base: "woman", label: "名词复数" },
  feet: { base: "foot", label: "名词复数" },
  teeth: { base: "tooth", label: "名词复数" },
  mice: { base: "mouse", label: "名词复数" },

  // 不规则比较级/最高级
  better: { base: "good / well", label: "比较级" },
  best: { base: "good / well", label: "最高级" },
  worse: { base: "bad / badly", label: "比较级" },
  worst: { base: "bad / badly", label: "最高级" },
  more: { base: "many / much", label: "比较级" },
  most: { base: "many / much", label: "最高级" },
  less: { base: "little", label: "比较级" },
  least: { base: "little", label: "最高级" },
}

/**
 * 将任意英文单词执行形态学还原
 * @param rawWord 原始单词 (如 reported, studies, running)
 */
export function lemmatize(rawWord: string): LemmatizedResult {
  const word = rawWord.trim().toLowerCase()
  if (!word || word.length < 3) {
    return { isInflected: false, baseLemma: word, inflectionLabel: "", displayText: "" }
  }

  // 1. 优先查不规则映射表
  if (IRREGULAR_WORDS[word]) {
    const item = IRREGULAR_WORDS[word]
    return {
      isInflected: true,
      baseLemma: item.base,
      inflectionLabel: item.label,
      displayText: `${item.base} ( ${item.label} )`,
    }
  }

  // 2. -ied 过去式/过去分词 (如 studied -> study, carried -> carry)
  if (word.endsWith("ied") && word.length > 4) {
    const base = word.slice(0, -3) + "y"
    return {
      isInflected: true,
      baseLemma: base,
      inflectionLabel: "动词过去式 动词过去分词",
      displayText: `${base} ( 动词过去式 动词过去分词 )`,
    }
  }

  // 3. -ies 第三人称单数或名词复数 (如 studies -> study, countries -> country)
  if (word.endsWith("ies") && word.length > 4) {
    const base = word.slice(0, -3) + "y"
    return {
      isInflected: true,
      baseLemma: base,
      inflectionLabel: "复数 第三人称单数",
      displayText: `${base} ( 复数 第三人称单数 )`,
    }
  }

  // 4. 双写辅音 + ed (如 stopped -> stop, dropped -> drop, planned -> plan)
  const doubleEdMatch = word.match(/^([b-df-hj-np-tv-z]+[aeiou])([b-df-hj-np-tv-z])\2ed$/)
  if (doubleEdMatch && word.length > 5) {
    const base = word.slice(0, -3) // 去掉双写的辅音和一个 ed
    return {
      isInflected: true,
      baseLemma: base,
      inflectionLabel: "动词过去式 动词过去分词",
      displayText: `${base} ( 动词过去式 动词过去分词 )`,
    }
  }

  // 5. -ed 过去式/分词 (如 reported -> report, evacuated -> evacuate)
  if (word.endsWith("ed") && word.length > 4) {
    const baseWithoutEd = word.slice(0, -2)
    const baseWithE = word.slice(0, -1) // e.g. evacuated -> evacuate

    const likelyEndsWithE = /[ctszv]e$/.test(baseWithE)
    const base = likelyEndsWithE ? baseWithE : baseWithoutEd

    return {
      isInflected: true,
      baseLemma: base,
      inflectionLabel: "动词过去式 动词过去分词",
      displayText: `${base} ( 动词过去式 动词过去分词 )`,
    }
  }

  // 6. 双写辅音 + ing (如 stopping -> stop, running -> run)
  const doubleIngMatch = word.match(/^([b-df-hj-np-tv-z]+[aeiou])([b-df-hj-np-tv-z])\2ing$/)
  if (doubleIngMatch && word.length > 5) {
    const base = word.slice(0, -4)
    return {
      isInflected: true,
      baseLemma: base,
      inflectionLabel: "现在分词 动名词",
      displayText: `${base} ( 现在分词 动名词 )`,
    }
  }

  // 7. -ing 进行时 (如 reporting -> report, making -> make)
  if (word.endsWith("ing") && word.length > 5) {
    const baseWithoutIng = word.slice(0, -3)
    const baseWithE = baseWithoutIng + "e"
    const likelyEndsWithE = /[ctszv]e$/.test(baseWithE)
    const base = likelyEndsWithE ? baseWithE : baseWithoutIng

    return {
      isInflected: true,
      baseLemma: base,
      inflectionLabel: "现在分词 动名词",
      displayText: `${base} ( 现在分词 动名词 )`,
    }
  }

  // 8. -es 第三人称单数或名词复数 (如 watches -> watch, boxes -> box)
  if (word.endsWith("es") && (word.endsWith("shes") || word.endsWith("ches") || word.endsWith("xes") || word.endsWith("sses"))) {
    const base = word.slice(0, -2)
    return {
      isInflected: true,
      baseLemma: base,
      inflectionLabel: "复数 第三人称单数",
      displayText: `${base} ( 复数 第三人称单数 )`,
    }
  }

  // 9. -est 最高级 (如 fastest -> fast, tallest -> tall)
  if (word.endsWith("est") && word.length > 5) {
    const base = word.slice(0, -3)
    return {
      isInflected: true,
      baseLemma: base,
      inflectionLabel: "形容词最高级",
      displayText: `${base} ( 形容词最高级 )`,
    }
  }

  // 10. -er 比较级 (如 faster -> fast, longer -> long)
  if (word.endsWith("er") && word.length > 5 && !["after", "other", "under", "never", "water", "paper", "order"].includes(word)) {
    const base = word.slice(0, -2)
    return {
      isInflected: true,
      baseLemma: base,
      inflectionLabel: "形容词比较级",
      displayText: `${base} ( 形容词比较级 )`,
    }
  }

  // 11. 普通复数 / 三单 -s (如 officials -> official, trains -> train, reports -> report)
  if (word.endsWith("s") && word.length > 4 && !word.endsWith("ss") && !word.endsWith("us") && !word.endsWith("is")) {
    const base = word.slice(0, -1)
    return {
      isInflected: true,
      baseLemma: base,
      inflectionLabel: "复数 第三人称单数",
      displayText: `${base} ( 复数 第三人称单数 )`,
    }
  }

  return { isInflected: false, baseLemma: word, inflectionLabel: "", displayText: "" }
}
