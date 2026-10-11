# ゴルフ練習ノートを入れる (Windows)。install.bat から動かす。
$ErrorActionPreference = 'Stop'
function Pause-Exit($msg) { Write-Host ''; Write-Host $msg -ForegroundColor Yellow; Read-Host 'Enter キーで閉じます'; exit 1 }

Write-Host '=== ゴルフ練習ノートを入れます（10分ほどかかることがあります） ===' -ForegroundColor Green
$src = Join-Path $PSScriptRoot 'pc'
if (-not (Test-Path (Join-Path $src 'server.py'))) { Pause-Exit 'pc フォルダが見つかりません。ZIP を全部展開（すべて展開）してから、もう一度 install.bat を実行してください。' }
$dst = Join-Path $env:USERPROFILE 'GolfPracticeApp'

if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
  Pause-Exit 'winget が見つかりません。Microsoft Store で「アプリ インストーラー」を入れて（更新して）から、もう一度実行してください。'
}

function Find-Python {
  foreach ($p in @("$env:LOCALAPPDATA\Programs\Python\Python312\python.exe", "$env:ProgramFiles\Python312\python.exe")) {
    if (Test-Path $p) { return $p }
  }
  return $null
}

Write-Host '1/4 Python を確認しています…'
$python = Find-Python
if (-not $python) {
  Write-Host '    Python 3.12 を入れます（画面が出たら「はい」を押してください）'
  winget install -e --id Python.Python.3.12 --scope user --accept-package-agreements --accept-source-agreements
  $python = Find-Python
}
if (-not $python) { Pause-Exit 'Python を入れられませんでした。パソコンを再起動して、もう一度 install.bat を実行してください。' }

Write-Host '2/4 ffmpeg（動画を扱う道具）を確認しています…'
$hasFfmpeg = (Get-Command ffmpeg -ErrorAction SilentlyContinue) -or (Test-Path "$env:LOCALAPPDATA\Microsoft\WinGet\Links\ffmpeg.exe")
if (-not $hasFfmpeg) {
  winget install -e --id Gyan.FFmpeg --accept-package-agreements --accept-source-agreements
}

Write-Host "3/4 アプリを $dst に入れています…"
New-Item -ItemType Directory -Force -Path $dst | Out-Null
Get-ChildItem -Path $src | Where-Object { $_.Name -notin @('data', 'config.json') } | ForEach-Object {
  Copy-Item -Path $_.FullName -Destination $dst -Recurse -Force
}
& $python -m pip install --disable-pip-version-check -q google-genai numpy pillow
& $python -m pip install --disable-pip-version-check -q mediapipe
if ($LASTEXITCODE -ne 0) { Write-Host '    [!] 姿勢の計測の部品（mediapipe）を入れられませんでした。ほかの機能は使えます。' -ForegroundColor Yellow }

Write-Host '4/4 デスクトップにアイコンを作っています…'
$ws = New-Object -ComObject WScript.Shell
$lnk = $ws.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Desktop')) 'ゴルフ練習ノート.lnk'))
$lnk.TargetPath = Join-Path $dst 'start.bat'
$lnk.WorkingDirectory = $dst
$lnk.IconLocation = "$env:SystemRoot\System32\shell32.dll,137"
$lnk.Save()

# 入れたばかりの Python を、このあと起動するアプリから見えるようにする
$env:Path = "$env:LOCALAPPDATA\Programs\Python\Launcher;" + (Split-Path $python) + ";$env:LOCALAPPDATA\Microsoft\WinGet\Links;$env:Path"
Write-Host ''
Write-Host '入れ終わりました。アプリを起動します。次からはデスクトップの「ゴルフ練習ノート」をダブルクリックしてください。' -ForegroundColor Green
Start-Process -FilePath (Join-Path $dst 'start.bat') -WorkingDirectory $dst
