# AEGIS — one-command local demo launcher for Windows (PowerShell).
#
#   ./demo.ps1            boot the Keeper + app, open the browser
#   ./demo.ps1 -Beats     also fire the scripted story once both are up
#
# Nothing here needs an API key or the internet beyond map tiles: the Keeper
# ships deterministic guidance, so the full story runs offline-of-Gemini.
param([switch]$Beats)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$env:WRANGLER_SEND_METRICS = "false"

Write-Host ""
Write-Host "  AEGIS local demo" -ForegroundColor Green
Write-Host "  ----------------"
Write-Host "  Keeper  -> http://localhost:8787   (Cloudflare Worker + Durable Object)"
Write-Host "  App     -> http://localhost:5180   (React + Vite, proxies to the Keeper)"
Write-Host ""

# 1. Keeper (serverless state spine) in its own window
Start-Process powershell -ArgumentList "-NoExit","-Command","cd '$root/keeper'; `$env:WRANGLER_SEND_METRICS='false'; npx wrangler dev --port 8787"
Write-Host "  * Keeper starting..." -ForegroundColor DarkGray

# 2. App (Vite dev server) in its own window
Start-Process powershell -ArgumentList "-NoExit","-Command","cd '$root/app'; npm run dev"
Write-Host "  * App starting..." -ForegroundColor DarkGray

# 3. Wait for the app to answer (Vite picks the first free port from 5180), then open it
Write-Host "  * Waiting for the app to come up..." -ForegroundColor DarkGray
$appUrl = $null
for ($i = 0; $i -lt 40 -and -not $appUrl; $i++) {
  Start-Sleep -Milliseconds 700
  foreach ($port in 5180..5185) {
    try { Invoke-WebRequest "http://localhost:$port" -UseBasicParsing -TimeoutSec 1 | Out-Null; $appUrl = "http://localhost:$port"; break } catch {}
  }
}
if ($appUrl) {
  Start-Process $appUrl
  Write-Host "  * Opened $appUrl" -ForegroundColor Green
} else {
  Write-Host "  ! App did not answer yet — check the Vite window for its URL (usually http://localhost:5180)." -ForegroundColor Yellow
  $appUrl = "http://localhost:5180"
}

# 4. Optionally drive the scripted beats
if ($Beats) {
  Write-Host ""
  Write-Host "  * Firing the demo beats..." -ForegroundColor Green
  Start-Sleep -Seconds 2
  node "$root/scripts/fake-events.mjs" http://localhost:8787 demo
}

Write-Host ""
Write-Host "  Drive the story any time with:" -ForegroundColor Cyan
Write-Host "     node scripts/fake-events.mjs" -ForegroundColor Cyan
Write-Host "  or use the control bar under the phone (Arrive - Trigger quake - Cut the network - Reset)."
Write-Host ""
