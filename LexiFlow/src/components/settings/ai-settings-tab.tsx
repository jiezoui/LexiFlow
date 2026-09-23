"use client"

import * as React from "react"
import {
  SparklesIcon,
  CheckIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
  EyeIcon,
  EyeOffIcon,
  ExternalLinkIcon,
  RefreshCwIcon,
  ZapIcon,
  KeyIcon,
  ServerIcon,
  CpuIcon,
  ShieldCheckIcon,
  SlidersIcon,
  RotateCcwIcon,
  SaveIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import {
  AI_PROVIDER_PRESETS,
  type AiProviderId,
  type AiSettings,
  getAiSettings,
  saveAiSettings,
  getDefaultAiSettings,
} from "@/lib/ai-config"
import { aiApi, type AiTestConnectionResult } from "@/lib/api-client"

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export function AiSettingsTab() {
  const [settings, setSettings] = React.useState<AiSettings>(getDefaultAiSettings())
  const [showKey, setShowKey] = React.useState(false)
  const [testing, setTesting] = React.useState(false)
  const [testResult, setTestResult] = React.useState<AiTestConnectionResult | null>(null)
  const [fetchingModels, setFetchingModels] = React.useState(false)
  const [fetchedModels, setFetchedModels] = React.useState<string[]>([])
  const [savedSuccess, setSavedSuccess] = React.useState(false)
  const [customModelInput, setCustomModelInput] = React.useState("")

  // 初始化加载本地配置
  React.useEffect(() => {
    const loaded = getAiSettings()
    setSettings(loaded)
  }, [])

  const activeProvider = settings.activeProvider
  const preset = AI_PROVIDER_PRESETS[activeProvider]
  const currentProviderConfig = settings.providers[activeProvider] || {
    apiKey: "",
    apiHost: preset.defaultHost,
    selectedModel: preset.defaultModel,
    customModels: [],
  }

  // 切换供应商
  const handleSelectProvider = (pid: AiProviderId) => {
    setSettings((prev) => ({
      ...prev,
      activeProvider: pid,
    }))
    setTestResult(null)
    setFetchedModels([])
  }

  // 更新当前供应商的某项配置
  const updateCurrentConfig = (updates: Partial<typeof currentProviderConfig>) => {
    setSettings((prev) => ({
      ...prev,
      providers: {
        ...prev.providers,
        [activeProvider]: {
          ...currentProviderConfig,
          ...updates,
        },
      },
    }))
    setTestResult(null)
  }

  // 保存设置
  const handleSave = () => {
    saveAiSettings(settings)
    setSavedSuccess(true)
    setTimeout(() => setSavedSuccess(false), 2000)
  }

  // 重置当前供应商为默认
  const handleResetProvider = () => {
    updateCurrentConfig({
      apiHost: preset.defaultHost,
      selectedModel: preset.defaultModel,
    })
    setTestResult(null)
  }

  // 连通性测试 (类似 Chatbox handleCheckApiKey)
  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await aiApi.testConnection({
        provider: activeProvider,
        apiHost: currentProviderConfig.apiHost,
        apiKey: currentProviderConfig.apiKey,
        model: currentProviderConfig.selectedModel,
      })
      setTestResult(res)
    } catch (e: unknown) {
      setTestResult({
        success: false,
        latencyMs: 0,
        model: currentProviderConfig.selectedModel,
        message: getErrorMessage(e, "网络请求异常，无法连接代理后端"),
      })
    } finally {
      setTesting(false)
    }
  }

  // 动态拉取模型列表 (类似 Chatbox handleFetchModels)
  const handleFetchModels = async () => {
    setFetchingModels(true)
    try {
      const models = await aiApi.fetchModels({
        provider: activeProvider,
        apiHost: currentProviderConfig.apiHost,
        apiKey: currentProviderConfig.apiKey,
      })
      if (models && models.length > 0) {
        setFetchedModels(models)
      } else {
        alert("未检索到模型列表，请确认 Base URL 与 API Key 是否支持 /models 规范。")
      }
    } catch (e: unknown) {
      alert("拉取模型失败: " + getErrorMessage(e, "网络错误"))
    } finally {
      setFetchingModels(false)
    }
  }

  // 添加自定义模型
  const handleAddCustomModel = () => {
    const trimmed = customModelInput.trim()
    if (!trimmed) return
    const customList = currentProviderConfig.customModels || []
    if (!customList.includes(trimmed)) {
      updateCurrentConfig({
        customModels: [...customList, trimmed],
        selectedModel: trimmed,
      })
    } else {
      updateCurrentConfig({ selectedModel: trimmed })
    }
    setCustomModelInput("")
  }

  // 合并展示的模型清单 (预置推荐 + 用户自填 + 动态拉取)
  const allAvailableModels = React.useMemo(() => {
    const set = new Set<string>()
    preset.presetModels.forEach((m) => set.add(m))
    ;(currentProviderConfig.customModels || []).forEach((m) => set.add(m))
    fetchedModels.forEach((m) => set.add(m))
    if (currentProviderConfig.selectedModel) {
      set.add(currentProviderConfig.selectedModel)
    }
    return Array.from(set)
  }, [preset.presetModels, currentProviderConfig.customModels, currentProviderConfig.selectedModel, fetchedModels])

  return (
    <div className="space-y-6">
      {/* 1. 顶栏隐私安全与说明卡片 */}
      <Card className="border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-lg flex items-center gap-2">
                <SparklesIcon className="size-5 text-primary animate-pulse" />
                <span>AI 助理与大语言模型中心</span>
              </CardTitle>
              <CardDescription>
                统一管理大模型凭据，为深度外刊阅读语境精析、词汇助记拓展提供强大 AI 驱动力
              </CardDescription>
            </div>
            <Badge variant="outline" className="flex items-center gap-1 py-1 px-2.5 font-mono text-[11px] bg-background/80 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 self-start sm:self-auto">
              <ShieldCheckIcon className="size-3.5" />
              <span>Local-First · 本地优先隐私安全</span>
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-xs text-muted-foreground leading-relaxed">
            所有 API Key 凭据均经过前端加密直接保存在当前设备浏览器的本地安全沙箱中（无任何服务器泄露风险），仅在您主动发起语境解析或测试时经由轻量安全网关代理发送给目标服务商。
          </p>
        </CardContent>
      </Card>

      {/* 2. 供应商选择网格 (Provider Selector) */}
      <div className="space-y-2.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
          选择模型供应商 (Model Provider)
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {(Object.keys(AI_PROVIDER_PRESETS) as AiProviderId[]).map((pid) => {
            const p = AI_PROVIDER_PRESETS[pid]
            const isSelected = activeProvider === pid
            const hasKey = !!settings.providers[pid]?.apiKey

            return (
              <button
                key={pid}
                type="button"
                onClick={() => handleSelectProvider(pid)}
                className={`relative flex flex-col items-start p-3 rounded-2xl border text-left transition-all cursor-pointer select-none ${
                  isSelected
                    ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary"
                    : "border-border/70 bg-card hover:bg-muted/50 hover:border-border"
                }`}
              >
                {p.badge && (
                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full mb-1.5 font-medium ${
                    isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    {p.badge}
                  </span>
                )}
                <span className="text-xs font-bold text-foreground leading-snug line-clamp-1">
                  {p.name.split(" ")[0]}
                </span>
                <span className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                  {pid === "ollama" ? "本地无需 Key" : hasKey ? "● 已配置 Key" : "○ 待配置"}
                </span>

                {isSelected && (
                  <div className="absolute top-2 right-2 size-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                    <CheckIcon className="size-2.5 stroke-[3]" />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* 3. 核心凭据配置卡片 */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <CardTitle className="text-base flex items-center gap-2">
                <span>{preset.name} 参数设置</span>
              </CardTitle>
              <CardDescription className="text-xs">
                {preset.description}
              </CardDescription>
            </div>

            {preset.apiKeyUrl && (
              <a
                href={preset.apiKeyUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
              >
                <span>获取 API Key</span>
                <ExternalLinkIcon className="size-3" />
              </a>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* API Key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold flex items-center gap-1.5">
                <KeyIcon className="size-3.5 text-muted-foreground" />
                <span>API 密钥 (API Key)</span>
              </label>
              {activeProvider === "ollama" && (
                <span className="text-[11px] text-muted-foreground">Ollama 本地部署无需真实 Key</span>
              )}
            </div>

            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                placeholder={activeProvider === "ollama" ? "ollama (本地免鉴权)" : "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}
                value={currentProviderConfig.apiKey}
                onChange={(e) => updateCurrentConfig({ apiKey: e.target.value })}
                className="font-mono text-xs pr-10"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 transition-colors"
                title={showKey ? "隐藏密钥" : "显示密钥"}
              >
                {showKey ? <EyeOffIcon className="size-3.5" /> : <EyeIcon className="size-3.5" />}
              </button>
            </div>
          </div>

          {/* Base URL (API Host) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold flex items-center gap-1.5">
                <ServerIcon className="size-3.5 text-muted-foreground" />
                <span>接口地址 (Base URL)</span>
              </label>
              <button
                type="button"
                onClick={handleResetProvider}
                className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                title="重置为官方推荐 Base URL"
              >
                <RotateCcwIcon className="size-2.5" />
                <span>恢复默认地址</span>
              </button>
            </div>
            <Input
              type="text"
              placeholder={preset.defaultHost}
              value={currentProviderConfig.apiHost}
              onChange={(e) => updateCurrentConfig({ apiHost: e.target.value })}
              className="font-mono text-xs"
            />
            <span className="text-[11px] text-muted-foreground block">
              支持填写第三方反向代理、云中转网关或局域网私有端口。
            </span>
          </div>

          {/* Model Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold flex items-center gap-1.5">
                <CpuIcon className="size-3.5 text-muted-foreground" />
                <span>主用模型 (Model ID)</span>
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleFetchModels}
                disabled={fetchingModels || (activeProvider !== "ollama" && !currentProviderConfig.apiKey)}
                className="h-6 text-[11px] px-2 text-muted-foreground hover:text-primary gap-1"
              >
                <RefreshCwIcon className={`size-3 ${fetchingModels ? "animate-spin" : ""}`} />
                <span>{fetchingModels ? "拉取中..." : "获取可用模型"}</span>
              </Button>
            </div>

            {/* 模型快速选择胶囊组 */}
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1 bg-muted/20 rounded-xl border border-border/40">
              {allAvailableModels.map((m) => {
                const isCur = currentProviderConfig.selectedModel === m
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => updateCurrentConfig({ selectedModel: m })}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                      isCur
                        ? "bg-primary text-primary-foreground font-bold shadow-xs scale-102"
                        : "bg-background/80 text-muted-foreground hover:text-foreground border border-border/60 hover:bg-muted"
                    }`}
                  >
                    {m}
                  </button>
                )
              })}
            </div>

            {/* 手动输入补充模型 */}
            <div className="flex items-center gap-2 pt-1">
              <Input
                type="text"
                placeholder="不在列表？手动输入自定义模型 ID..."
                value={customModelInput}
                onChange={(e) => setCustomModelInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddCustomModel()}
                className="font-mono text-xs h-8 flex-1"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleAddCustomModel}
                disabled={!customModelInput.trim()}
                className="h-8 text-xs font-medium"
              >
                设为当前模型
              </Button>
            </div>
          </div>

          {/* 连通性测试按钮与反馈面板 (Chatbox 核心体验) */}
          <div className="pt-2 border-t border-border/60 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                onClick={handleTestConnection}
                disabled={testing || (activeProvider !== "ollama" && !currentProviderConfig.apiKey)}
                className="gap-1.5 cursor-pointer text-xs h-9 px-4 font-semibold"
              >
                {testing ? (
                  <RefreshCwIcon className="size-3.5 animate-spin" />
                ) : (
                  <ZapIcon className="size-3.5 text-amber-300 fill-amber-300" />
                )}
                <span>{testing ? "正在探测连通性..." : "测试模型连通性 (Check)"}</span>
              </Button>

              <span className="text-[11px] font-mono text-muted-foreground">
                当前模型: <strong className="text-foreground">{currentProviderConfig.selectedModel || "未选择"}</strong>
              </span>
            </div>

            {/* 测试结果反馈栏 */}
            {testResult && (
              <div
                className={`p-3 rounded-xl border text-xs leading-relaxed animate-in fade-in duration-150 flex items-start gap-2.5 ${
                  testResult.success
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300"
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2Icon className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircleIcon className="size-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="space-y-0.5 flex-1">
                  <div className="font-semibold flex items-center justify-between">
                    <span>{testResult.success ? "连通测试成功！" : "连通测试失败"}</span>
                    {testResult.latencyMs > 0 && (
                      <span className="font-mono text-[10px] opacity-80">{testResult.latencyMs} ms</span>
                    )}
                  </div>
                  <p className="text-[11px] opacity-90 break-all font-mono">
                    {testResult.message}
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 4. 业务应用与功能联动开关 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <SlidersIcon className="size-4 text-muted-foreground" />
            <span>AI 业务应用场景联动</span>
          </CardTitle>
          <CardDescription className="text-xs">
            控制 AI 深度解析在各个研习模块中的自动启用与交互形式
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">深度外刊阅读 AI 语境解析</p>
              <p className="text-xs text-muted-foreground">
                在阅读文章点击单词或长句时，启用 AI 语法成分、时态语态与原句深度用法的实时精析
              </p>
            </div>
            <Switch
              checked={settings.enableReadingAi}
              onCheckedChange={(c) => setSettings({ ...settings, enableReadingAi: c })}
            />
          </div>

          <div className="flex items-center justify-between border-t border-border/50 pt-3">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">单词闪卡智能助记与造句</p>
              <p className="text-xs text-muted-foreground">
                在闪卡研习与默写通关中，智能生成词根记忆口诀与地道例句拓展
              </p>
            </div>
            <Switch
              checked={settings.enableFlashcardAi}
              onCheckedChange={(c) => setSettings({ ...settings, enableFlashcardAi: c })}
            />
          </div>
        </CardContent>
      </Card>

      {/* 5. 底部保存操作栏 */}
      <div className="flex items-center justify-between pt-2">
        <Button
          type="button"
          onClick={handleSave}
          className="gap-2 font-semibold text-xs px-6 cursor-pointer"
        >
          {savedSuccess ? <CheckIcon className="size-4 text-emerald-400" /> : <SaveIcon className="size-4" />}
          <span>{savedSuccess ? "已成功保存并生效！" : "保存 AI 模型配置"}</span>
        </Button>

        <span className="text-[11px] font-mono text-muted-foreground">
          配置将即时同步至阅读器与闪卡模块
        </span>
      </div>
    </div>
  )
}
