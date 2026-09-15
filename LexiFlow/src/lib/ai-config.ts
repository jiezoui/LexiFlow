/**
 * AI 助理与模型供应商配置管理 (Local-First 优先设计，借鉴 Chatbox 架构)
 */

export type AiProviderId =
  | "deepseek"
  | "openai"
  | "siliconflow"
  | "claude"
  | "ollama"
  | "custom"

export interface ProviderPreset {
  id: AiProviderId
  name: string
  description: string
  defaultHost: string
  defaultModel: string
  presetModels: string[]
  apiKeyUrl?: string
  docsUrl?: string
  badge?: string
}

export const AI_PROVIDER_PRESETS: Record<AiProviderId, ProviderPreset> = {
  deepseek: {
    id: "deepseek",
    name: "DeepSeek (深度求索)",
    description: "高性价比、推理与多语言表现卓越的国产领军模型",
    defaultHost: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    presetModels: ["deepseek-chat", "deepseek-reasoner"],
    apiKeyUrl: "https://platform.deepseek.com/api_keys",
    docsUrl: "https://platform.deepseek.com/docs",
    badge: "推荐 · 超高性价比",
  },
  siliconflow: {
    id: "siliconflow",
    name: "SiliconFlow (硅基流动)",
    description: "国内顶级大模型聚合托管平台，支持 DeepSeek-V3/R1、Qwen2.5 等",
    defaultHost: "https://api.siliconflow.cn/v1",
    defaultModel: "deepseek-ai/DeepSeek-V3",
    presetModels: [
      "deepseek-ai/DeepSeek-V3",
      "deepseek-ai/DeepSeek-R1",
      "Qwen/Qwen2.5-72B-Instruct",
      "THUDM/glm-4-9b-chat",
    ],
    apiKeyUrl: "https://cloud.siliconflow.cn/account/ak",
    docsUrl: "https://docs.siliconflow.cn",
    badge: "高可用稳定",
  },
  openai: {
    id: "openai",
    name: "OpenAI",
    description: "行业标杆模型，提供极高精准度的多语言理解与分析能力",
    defaultHost: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    presetModels: ["gpt-4o-mini", "gpt-4o", "o3-mini", "gpt-3.5-turbo"],
    apiKeyUrl: "https://platform.openai.com/api-keys",
    docsUrl: "https://platform.openai.com/docs",
    badge: "官方直连",
  },
  claude: {
    id: "claude",
    name: "Anthropic Claude",
    description: "卓越的文学审美、学术长文本解析与细微语境辨析能力",
    defaultHost: "https://api.anthropic.com/v1",
    defaultModel: "claude-3-5-sonnet-20241022",
    presetModels: [
      "claude-3-5-sonnet-20241022",
      "claude-3-5-haiku-20241022",
      "claude-3-opus-20240229",
    ],
    apiKeyUrl: "https://console.anthropic.com/settings/keys",
    docsUrl: "https://docs.anthropic.com",
    badge: "语境辨析专家",
  },
  ollama: {
    id: "ollama",
    name: "Ollama (本地私有化模型)",
    description: "本地运行，完全离线与零数据泄露风险，免 API Key 消费",
    defaultHost: "http://localhost:11434/v1",
    defaultModel: "deepseek-r1:8b",
    presetModels: ["deepseek-r1:8b", "qwen2.5:7b", "llama3.2:3b", "gemma2:9b"],
    apiKeyUrl: undefined,
    docsUrl: "https://ollama.com",
    badge: "本地离线 · 免Key",
  },
  custom: {
    id: "custom",
    name: "自定义 (OpenAI 兼容反代 / 专有网关)",
    description: "支持任意兼容 OpenAI /chat/completions 规范的自建或中转 API",
    defaultHost: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    presetModels: ["gpt-4o-mini", "deepseek-chat", "claude-3-5-sonnet"],
    apiKeyUrl: undefined,
    badge: "自由扩展",
  },
}

export interface SingleProviderConfig {
  apiKey: string
  apiHost: string
  selectedModel: string
  customModels: string[]
}

export interface AiSettings {
  activeProvider: AiProviderId
  providers: Record<AiProviderId, SingleProviderConfig>
  enableReadingAi: boolean
  enableFlashcardAi: boolean
  temperature: number
}

const STORAGE_KEY = "lexiflow_ai_settings_v1"

export function getDefaultAiSettings(): AiSettings {
  const providers: Record<AiProviderId, SingleProviderConfig> = {
    deepseek: {
      apiKey: "",
      apiHost: AI_PROVIDER_PRESETS.deepseek.defaultHost,
      selectedModel: AI_PROVIDER_PRESETS.deepseek.defaultModel,
      customModels: [],
    },
    siliconflow: {
      apiKey: "",
      apiHost: AI_PROVIDER_PRESETS.siliconflow.defaultHost,
      selectedModel: AI_PROVIDER_PRESETS.siliconflow.defaultModel,
      customModels: [],
    },
    openai: {
      apiKey: "",
      apiHost: AI_PROVIDER_PRESETS.openai.defaultHost,
      selectedModel: AI_PROVIDER_PRESETS.openai.defaultModel,
      customModels: [],
    },
    claude: {
      apiKey: "",
      apiHost: AI_PROVIDER_PRESETS.claude.defaultHost,
      selectedModel: AI_PROVIDER_PRESETS.claude.defaultModel,
      customModels: [],
    },
    ollama: {
      apiKey: "ollama",
      apiHost: AI_PROVIDER_PRESETS.ollama.defaultHost,
      selectedModel: AI_PROVIDER_PRESETS.ollama.defaultModel,
      customModels: [],
    },
    custom: {
      apiKey: "",
      apiHost: "https://api.openai.com/v1",
      selectedModel: "gpt-4o-mini",
      customModels: [],
    },
  }

  return {
    activeProvider: "deepseek",
    providers,
    enableReadingAi: true,
    enableFlashcardAi: true,
    temperature: 0.3,
  }
}

export function getAiSettings(): AiSettings {
  if (typeof window === "undefined") {
    return getDefaultAiSettings()
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return getDefaultAiSettings()
    const parsed = JSON.parse(raw)
    const defaults = getDefaultAiSettings()

    return {
      ...defaults,
      ...parsed,
      providers: {
        ...defaults.providers,
        ...(parsed.providers || {}),
      },
    }
  } catch (e) {
    console.warn("读取 AI 配置失败，使用默认值:", e)
    return getDefaultAiSettings()
  }
}

export function saveAiSettings(settings: AiSettings): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    // 派发全局变更事件，通知所有打开的组件无缝同步
    window.dispatchEvent(new CustomEvent("lexiflow_ai_settings_updated", { detail: settings }))
  } catch (e) {
    console.error("保存 AI 配置失败:", e)
  }
}

export function getActiveAiConfig(): {
  provider: AiProviderId
  apiHost: string
  apiKey: string
  model: string
  isConfigured: boolean
} {
  const settings = getAiSettings()
  const provider = settings.activeProvider
  const pConfig = settings.providers[provider] || getDefaultAiSettings().providers[provider]
  const preset = AI_PROVIDER_PRESETS[provider]

  const apiHost = pConfig.apiHost || preset.defaultHost
  const apiKey = pConfig.apiKey || ""
  const model = pConfig.selectedModel || preset.defaultModel

  // Ollama 本地运行不需要必填 key
  const isConfigured = provider === "ollama" ? true : apiKey.trim().length > 0

  return {
    provider,
    apiHost,
    apiKey,
    model,
    isConfigured,
  }
}
