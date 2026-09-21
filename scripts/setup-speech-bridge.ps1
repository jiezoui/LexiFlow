# ─────────────────────────────────────────────────────────────────────────────
# 语脉 · LexiFlow 影子跟读语音桥接服务 —— Python 环境一键安装
#
# 在仓库内创建隔离的 venv，安装 ASR / 音素识别 / 音频处理依赖。
# 不污染系统 Python，不修改注册表。
# ─────────────────────────────────────────────────────────────────────────────
[CmdletBinding()]
param(
    [string]$Python = "python",
    [string]$VenvDir = "",
    [switch]$SkipTorch
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
if (-not $VenvDir) { $VenvDir = Join-Path $RepoRoot "speech-bridge\.venv" }

Write-Host "== 语脉影子跟读 · 语音桥接环境安装 ==" -ForegroundColor Cyan
Write-Host "   仓库根目录 : $RepoRoot"
Write-Host "   虚拟环境   : $VenvDir"

# ── 1. 创建 venv ────────────────────────────────────────────────────────────
if (-not (Test-Path (Join-Path $VenvDir "Scripts\python.exe"))) {
    Write-Host "`n[1/4] 创建 Python 虚拟环境 ..." -ForegroundColor Yellow
    & $Python -m venv $VenvDir
    if ($LASTEXITCODE -ne 0) { throw "venv 创建失败" }
} else {
    Write-Host "`n[1/4] 虚拟环境已存在，跳过创建" -ForegroundColor Green
}

$py = Join-Path $VenvDir "Scripts\python.exe"
$pipArgs = @("-m", "pip", "install", "--disable-pip-version-check", "--no-input")

# ── 2. 升级 pip ─────────────────────────────────────────────────────────────
Write-Host "`n[2/4] 升级 pip / setuptools / wheel ..." -ForegroundColor Yellow
& $py @pipArgs --upgrade pip setuptools wheel
if ($LASTEXITCODE -ne 0) { throw "pip 升级失败" }

# ── 3. 安装依赖 ─────────────────────────────────────────────────────────────
# numpy 固定 <2 以兼容 torchaudio / librosa / ctranslate2 内核
Write-Host "`n[3/4] 安装核心依赖（numpy / 音频 IO / Web 框架）..." -ForegroundColor Yellow
& $py @pipArgs "numpy>=1.24,<2" "soundfile>=0.12" "fastapi>=0.111" "uvicorn[standard]>=0.30" `
    "python-multipart>=0.0.9" "requests>=2.32"
if ($LASTEXITCODE -ne 0) { throw "核心依赖安装失败" }

if (-not $SkipTorch) {
    # torch 2.3.x 是最后一个官方提供 cp310 Windows wheel 且与 ctranslate2 无冲突的稳定线
    Write-Host "`n[3/4] 安装 PyTorch (CPU, ~200MB) ..." -ForegroundColor Yellow
    & $py @pipArgs "torch==2.3.1" "torchaudio==2.3.1" `
        --index-url https://download.pytorch.org/whl/cpu
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  官方 CPU 源失败，回退 PyPI ..." -ForegroundColor DarkYellow
        & $py @pipArgs "torch==2.3.1" "torchaudio==2.3.1"
        if ($LASTEXITCODE -ne 0) { throw "PyTorch 安装失败" }
    }
}

Write-Host "`n[3/4] 安装 ASR / 音素识别 / 发音评测依赖 ..." -ForegroundColor Yellow
& $py @pipArgs "transformers>=4.40,<4.47" "faster-whisper>=1.0.3" "ctranslate2>=4.3" `
    "phonemizer>=3.3" "librosa>=0.10.2" "scipy>=1.11"
if ($LASTEXITCODE -ne 0) { throw "ASR 依赖安装失败" }

# ── 4. 校验 ─────────────────────────────────────────────────────────────────
Write-Host "`n[4/4] 校验关键模块 ..." -ForegroundColor Yellow
$verify = @'
import importlib, sys
mods = ["numpy","soundfile","torch","torchaudio","transformers","faster_whisper",
        "ctranslate2","librosa","scipy","fastapi","uvicorn","phonemizer"]
bad = []
for m in mods:
    try:
        mod = importlib.import_module(m)
        print("  OK   %-16s %s" % (m, getattr(mod, "__version__", "?")))
    except Exception as e:
        print("  FAIL %-16s %s: %s" % (m, type(e).__name__, e))
        bad.append(m)
print()
print("MISSING:", bad if bad else "none")
sys.exit(1 if bad else 0)
'@
$verify | & $py -
$code = $LASTEXITCODE

Write-Host ""
if ($code -eq 0) {
    Write-Host "== 环境就绪 ==" -ForegroundColor Green
    Write-Host "   解释器: $py"
} else {
    Write-Host "== 环境安装未完整，见上方 MISSING 列表 ==" -ForegroundColor Red
}
exit $code
