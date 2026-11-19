param(
  [Parameter(Mandatory = $true)][int]$Port,
  [string]$OpenHost = "localhost",
  [int]$Tries = 90
)

$ErrorActionPreference = "Continue"
$url = "http://${OpenHost}:${Port}/"

function Open-Url([string]$Target) {
  try {
    Start-Process $Target
    return
  } catch {}
  try {
    cmd.exe /c "start `"`" `"$Target`""
  } catch {}
}

for ($i = 0; $i -lt $Tries; $i++) {
  Start-Sleep -Milliseconds 500
  try {
    $req = [System.Net.HttpWebRequest]::Create($url)
    $req.Proxy = $null
    $req.Timeout = 2000
    $req.Method = "GET"
    $resp = $req.GetResponse()
    $resp.Close()
    Open-Url $url
    exit 0
  } catch {}

  # Fallback: port is listening even if HTTP is still compiling.
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $async = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
    $ok = $async.AsyncWaitHandle.WaitOne(300)
    if ($ok -and $client.Connected) {
      $client.Close()
      if ($i -ge 4) {
        Open-Url $url
        exit 0
      }
    } else {
      $client.Close()
    }
  } catch {}
}

Open-Url $url
exit 0
