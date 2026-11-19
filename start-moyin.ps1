$ErrorActionPreference = "Continue"
$Root = [System.IO.Path]::GetFullPath($PSScriptRoot).TrimEnd('\')
Set-Location -LiteralPath $Root
$Marker = Join-Path $Root ".moyin-dev-port"
# Prefer 3001 so Firework (prefers 3000) can coexist.
$PreferredPort = 3001
$PortStart = 3000
$PortEnd = 3010
$RootKey = $Root.ToLowerInvariant()
# "墨引" via codepoints so Windows PowerShell 5.1 parses this UTF-8 script safely.
$MoyinBrand = ([char]0x58A8).ToString() + ([char]0x5F15).ToString()

function Test-IsMoyinCommand([string]$CommandLine) {
  if (-not $CommandLine) { return $false }
  $cmd = $CommandLine.ToLowerInvariant().Replace("/", "\")
  if (-not $cmd.Contains($RootKey)) { return $false }
  if ($cmd.Contains("\next\dist\bin\next")) { return $true }
  if ($cmd.Contains("\next\dist\server\lib\start-server.js")) { return $true }
  if ($cmd.Contains("\node_modules\next\dist\bin\next")) { return $true }
  return $false
}

function Get-MoyinNodeProcesses {
  return @(
    Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
      Where-Object { Test-IsMoyinCommand ([string]$_.CommandLine) }
  )
}

function Get-PortFromCommandLine([string]$CommandLine) {
  if ($CommandLine -match '(?i)(?:-p|--port)\s+(\d{2,5})') {
    return [int]$Matches[1]
  }
  return $null
}

function Get-ListeningPortSet {
  $set = New-Object 'System.Collections.Generic.HashSet[int]'
  foreach ($line in (netstat -ano)) {
    if ($line -notmatch 'LISTENING') { continue }
    if ($line -match ':(\d+)\s') { [void]$set.Add([int]$Matches[1]) }
  }
  return $set
}

function Test-PortListening([int]$Port) {
  return (Get-ListeningPortSet).Contains($Port)
}

function Get-ListeningPortsForProcess([int]$ProcessId) {
  $ports = New-Object System.Collections.Generic.List[int]
  try {
    $conns = Get-NetTCPConnection -OwningProcess $ProcessId -State Listen -ErrorAction SilentlyContinue
    foreach ($c in $conns) {
      $port = [int]$c.LocalPort
      if ($port -ge $PortStart -and $port -le $PortEnd) {
        if (-not $ports.Contains($port)) { $ports.Add($port) }
      }
    }
  } catch {}
  return @($ports)
}

function Test-IsMoyinHttp([int]$Port) {
  try {
    $req = [System.Net.HttpWebRequest]::Create("http://127.0.0.1:$Port/")
    $req.Proxy = $null
    $req.Timeout = 2500
    $req.ReadWriteTimeout = 2500
    $req.Method = "GET"
    $resp = $req.GetResponse()
    $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
    $html = $reader.ReadToEnd()
    $reader.Close()
    $resp.Close()
    if ($html.Contains($MoyinBrand)) { return $true }
    if ($html.Contains("moyin_session")) { return $true }
    return $false
  } catch {
    return $false
  }
}

function Stop-MoyinProcesses {
  $victims = Get-MoyinNodeProcesses
  foreach ($v in $victims) {
    try { Stop-Process -Id ([int]$v.ProcessId) -Force -ErrorAction SilentlyContinue } catch {}
  }
  if ($victims.Count -gt 0) { Start-Sleep -Milliseconds 800 }
  return $victims.Count
}

function Find-RunningMoyinPort {
  Write-Host "  [1/2] Checking whether Moyin is already running..."

  $procs = Get-MoyinNodeProcesses
  $candidates = New-Object System.Collections.Generic.List[int]

  foreach ($proc in $procs) {
    $fromCmd = Get-PortFromCommandLine ([string]$proc.CommandLine)
    if ($null -ne $fromCmd -and (Test-PortListening $fromCmd) -and -not $candidates.Contains($fromCmd)) {
      $candidates.Add($fromCmd)
    }
    foreach ($p in (Get-ListeningPortsForProcess ([int]$proc.ProcessId))) {
      if (-not $candidates.Contains($p)) { $candidates.Add($p) }
    }
  }

  if (Test-Path -LiteralPath $Marker) {
    $raw = (Get-Content -LiteralPath $Marker -ErrorAction SilentlyContinue | Select-Object -First 1)
    $marked = 0
    if ([int]::TryParse("$raw", [ref]$marked) -and (Test-PortListening $marked) -and -not $candidates.Contains($marked)) {
      $candidates.Add($marked)
    }
  }

  if ($candidates.Count -eq 0) {
    if ($procs.Count -gt 0) {
      Write-Host "  Moyin process found, but no listening port yet."
    } else {
      Write-Host "  Not running."
    }
    return $null
  }

  foreach ($port in $candidates) {
    Write-Host "  Probing port $port ..."
    if (Test-IsMoyinHttp $port) {
      Write-Host "  Healthy Moyin instance found on port $port"
      return $port
    }
    Write-Host "  Port $port is not Moyin (other app or hung) — ignored."
  }

  if ($procs.Count -gt 0) {
    $killed = Stop-MoyinProcesses
    Write-Host "  Cleaned up $killed stale Moyin process(es). Will start fresh."
  }
  if (Test-Path -LiteralPath $Marker) {
    Remove-Item -LiteralPath $Marker -Force -ErrorAction SilentlyContinue
  }
  return $null
}

function Find-FreePort {
  Write-Host "  [2/2] Looking for a free port (prefer $PreferredPort, range $PortStart-$PortEnd)..."
  $listening = Get-ListeningPortSet

  $order = New-Object System.Collections.Generic.List[int]
  if (-not $order.Contains($PreferredPort)) { $order.Add($PreferredPort) }
  for ($port = $PortStart; $port -le $PortEnd; $port++) {
    if (-not $order.Contains($port)) { $order.Add($port) }
  }

  foreach ($port in $order) {
    if (-not $listening.Contains($port)) {
      Write-Host "  Using free port $port"
      return $port
    }
    Write-Host "  Port $port is busy"
  }
  return $null
}

function Open-Url([string]$Url) {
  try {
    Start-Process $Url
    return $true
  } catch {
    try {
      cmd.exe /c "start `"`" `"$Url`""
      return $true
    } catch {
      return $false
    }
  }
}

Write-Host ""
Write-Host "  Moyin one-click start"
Write-Host "  Preferred port: $PreferredPort (Firework usually takes 3000)"
Write-Host ""

$env:MOYIN_SELF_STARTED = "0"
# Keep exit-hook quotes simple so Windows PowerShell parses reliably.
Register-EngineEvent -SourceIdentifier ([System.Management.Automation.PsEngineEvent]::Exiting) -Action {
  try {
    if ($env:MOYIN_SELF_STARTED -ne '1') { return }
    $procs = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue
    foreach ($p in $procs) {
      $cmd = [string]$p.CommandLine
      if (-not $cmd) { continue }
      $low = $cmd.ToLowerInvariant()
      if ($low.IndexOf('d:\ai\cursor_workfile\zimeiti') -lt 0) { continue }
      if ($low.IndexOf('\next\dist\bin\next') -lt 0 -and $low.IndexOf('\next\dist\server\lib\start-server.js') -lt 0) { continue }
      Stop-Process -Id ([int]$p.ProcessId) -Force -ErrorAction SilentlyContinue
    }
  } catch {}
} | Out-Null

$existing = Find-RunningMoyinPort
if ($null -ne $existing) {
  $url = "http://localhost:$existing/"
  Write-Host "  Already running. Opening: $url"
  Set-Content -LiteralPath $Marker -Value "$existing" -Encoding ascii
  Open-Url $url | Out-Null
  Start-Sleep -Seconds 2
  exit 0
}

if (-not (Test-Path -LiteralPath (Join-Path $Root "node_modules"))) {
  Write-Host "  Installing dependencies..."
  & npm.cmd install
  if ($LASTEXITCODE -ne 0) {
    Write-Host "  npm install failed."
    Read-Host "Press Enter to exit"
    exit 1
  }
}

$port = Find-FreePort
if ($null -eq $port) {
  Write-Host "  Ports $PortStart-$PortEnd are all busy."
  Write-Host "  Tip: Firework prefers 3000; Moyin prefers $PreferredPort. Close one, or free a port in range."
  Read-Host "Press Enter to exit"
  exit 1
}

$url = "http://localhost:$port/"
Set-Content -LiteralPath $Marker -Value "$port" -Encoding ascii
Write-Host "  Starting on: $url"
Write-Host "  Browser will open when ready."
Write-Host "  Stop: Ctrl+C"
Write-Host ""

$opener = Join-Path $Root "open-when-ready.ps1"
Start-Process -FilePath "powershell.exe" -WindowStyle Hidden -ArgumentList @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-File", $opener,
  "-Port", "$port",
  "-OpenHost", "localhost"
) | Out-Null

$env:MOYIN_SELF_STARTED = "1"
& npm.cmd run dev -- -p $port
$code = $LASTEXITCODE

Write-Host ""
Write-Host "  Server stopped."
if ($code -ne 0) {
  Read-Host "Press Enter to exit"
  exit $code
}
exit 0
