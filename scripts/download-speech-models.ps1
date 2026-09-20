# ─────────────────────────────────────────────────────────────────────────────
# 语脉 · 影子跟读 —— ASR / 音素模型下载（预热）
#
# 通过 HF 镜像 (hf-mirror.com) 拉取：
#   1. faster-whisper small          —— 词级时间戳 ASR          (~484MB)
#   2. wav2vec2-lv-60-espeak-cv-ft   —— espeak 音素 CTC，GOP   (~1.2GB)
# 全部落在仓库内 .deploy-cache/speech-models，不写系统目录。
# ─────────────────────────────────────────────────────────────────────────────
[CmdletBinding()]
param(
    [ValidateSet("all", "whisper", "phoneme")]
    [string]$Model = "all",
    [string]$HfEndpoint = "https://hf-mirror.com"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$VenvPy = Join-Path $RepoRoot "speech-bridge\.venv\Scripts\python.exe"
$WarmScript = Join-Path $RepoRoot "speech-bridge\warm_models.py"

if (-not (Test-Path $VenvPy)) {
    throw "未找到虚拟环境，请先运行 scripts\setup-speech-bridge.ps1"
}

# 镜像与缓存位置必须与 speech_bridge/config.py 保持一致
$env:HF_ENDPOINT = $HfEndpoint
$env:HF_HUB_DISABLE_XET = "1"
$modelCache = Join-Path $RepoRoot ".deploy-cache\speech-models"
$env:HF_HOME = $modelCache
$env:HF_HUB_CACHE = Join-Path $modelCache "hub"
$env:PYTHONUTF8 = "1"
$env:PYTHONIOENCODING = "utf-8"

Write-Host "== 下载 ASR / 音素模型 ==" -ForegroundColor Cyan
Write-Host "   HF 端点 : $env:HF_ENDPOINT"
Write-Host "   缓存目录: $modelCache"
Write-Host "   目标     : $Model"

& $VenvPy $WarmScript $Model --list-phonemes
exit $LASTEXITCODE
