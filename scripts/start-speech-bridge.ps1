# ---------------------------------------------------------------------------
# LexiFlow Shadowing / Speech Bridge service launcher
#
# Usage:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\start-speech-bridge.ps1
#   powershell ... -File scripts\start-speech-bridge.ps1 -Port 8100 -Reload
#   powershell ... -File scripts\start-speech-bridge.ps1 -Stop
#
# NOTE: this file is intentionally pure ASCII. Windows PowerShell 5.1 decodes
# .ps1 files with the ANSI code page unless a UTF-8 BOM is present, which
# corrupts non-ASCII comments and can break parsing. Detailed design notes live
# in speech-bridge/speech_bridge/*.py, which are UTF-8 by default.
# ---------------------------------------------------------------------------
[CmdletBinding()]
param(
    [int]$Port = 8100,
    [string]$BindHost = "127.0.0.1",
    [switch]$Reload,
    [switch]$Stop,
    [switch]$Quiet,
    [int]$WaitSeconds = 90
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$VenvPy = Join-Path $RepoRoot "speech-bridge\.venv\Scripts\python.exe"
$ServiceDir = Join-Path $RepoRoot "speech-bridge"
$LogDir = Join-Path $RepoRoot ".deploy-cache\logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

function Get-Listener([int]$p) {
    Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
}

function Stop-Bridge([int]$p) {
    $conns = Get-Listener $p
    if (-not $conns) {
        Write-Host "No listener on port $p" -ForegroundColor Yellow
        return
    }
    $conns | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object {
        $proc = Get-Process -Id $_ -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Host "Stopping PID $($proc.Id) ($($proc.ProcessName))" -ForegroundColor Yellow
            Stop-Process -Id $proc.Id -Force
        }
    }
}

if ($Stop) {
    Stop-Bridge $Port
    exit 0
}

if (-not (Test-Path $VenvPy)) {
    throw "Virtualenv not found. Run scripts\setup-speech-bridge.ps1 first."
}

# Already listening: reuse the existing service instead of starting a second one.
$existing = Get-Listener $Port
if ($existing) {
    $owner = $existing | Select-Object -First 1 -ExpandProperty OwningProcess
    Write-Host "Speech bridge already running on http://${BindHost}:${Port} (PID $owner)" -ForegroundColor Green
    exit 0
}

$env:PYTHONUTF8 = "1"
$env:PYTHONIOENCODING = "utf-8"
$env:LEXIFLOW_SPEECH_HOST = $BindHost
$env:LEXIFLOW_SPEECH_PORT = "$Port"

$OutLog = Join-Path $LogDir "speech-bridge.out.log"
$ErrLog = Join-Path $LogDir "speech-bridge.err.log"

# Launch with a full command line so the service owns its log file handles.
# The launcher itself touches neither stdout nor stderr of the child: on Windows
# a parent that holds a child's pipe/file handle waits for it to close, which
# makes an automated invocation hang until timeout even though the service is up.
$argList = @(
    "-m", "speech_bridge",
    "--host", $BindHost,
    "--port", "$Port",
    "--log-file", $OutLog,
    "--error-log-file", $ErrLog
)
if ($Reload) { $argList += "--reload" }

$quoted = ($argList | ForEach-Object {
    if ($_ -match '[\s"]') { '"' + ($_ -replace '"', '\"') + '"' } else { $_ }
}) -join ' '
$cmdLine = '"{0}" {1}' -f $VenvPy, $quoted

if (-not $Quiet) {
    Write-Host "== Starting LexiFlow speech bridge ==" -ForegroundColor Cyan
    Write-Host "   URL      : http://${BindHost}:${Port}"
    Write-Host "   API docs : http://${BindHost}:${Port}/docs"
    Write-Host "   Health   : http://${BindHost}:${Port}/health"
    Write-Host "   Logs     : $OutLog"
}

$proc = Start-Process -FilePath $VenvPy -ArgumentList $argList `
    -WorkingDirectory $ServiceDir -PassThru -WindowStyle Hidden

# Poll readiness. First start loads / downloads models, so allow a long window.
$deadline = (Get-Date).AddSeconds($WaitSeconds)
$ready = $false
while ((Get-Date) -lt $deadline) {
    if ($proc.HasExited) { break }
    try {
        $r = Invoke-WebRequest -Uri "http://${BindHost}:${Port}/health" -TimeoutSec 3 -UseBasicParsing
        if ($r.StatusCode -eq 200) { $ready = $true; break }
    } catch {
        Start-Sleep -Milliseconds 800
    }
}

if ($ready) {
    Write-Host "Service ready (PID $($proc.Id)) -> http://${BindHost}:${Port}/health" -ForegroundColor Green
    exit 0
}

if ($proc.HasExited) {
    Write-Host "Service exited with code $($proc.ExitCode). Tail of $ErrLog :" -ForegroundColor Red
    Get-Content $ErrLog -Tail 40 -ErrorAction SilentlyContinue
    exit 1
}

Write-Host "Process launched (PID $($proc.Id)) but health check did not pass within ${WaitSeconds}s." -ForegroundColor Yellow
Write-Host "Models may still be loading. Re-check http://${BindHost}:${Port}/health later." -ForegroundColor Yellow
exit 0
