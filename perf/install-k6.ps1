$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$tmp = "$env:TEMP\k6.zip"
$dst = "F:\TraeWork\AVM项目中心\avm-demo\backend\.k6"

# 多镜像源尝试
$urls = @(
  'https://k6.download.fastgit.org/v0.57.0/k6-v0.57.0-windows-amd64.zip',
  'https://mirror.ghproxy.com/https://github.com/grafana/k6/releases/download/v0.57.0/k6-v0.57.0-windows-amd64.zip',
  'https://ghproxy.com/https://github.com/grafana/k6/releases/download/v0.57.0/k6-v0.57.0-windows-amd64.zip',
  'https://github.com/grafana/k6/releases/download/v0.57.0/k6-v0.57.0-windows-amd64.zip'
)

$downloaded = $false
foreach ($url in $urls) {
  try {
    Write-Host "尝试: $url"
    Invoke-WebRequest -Uri $url -OutFile $tmp -UseBasicParsing -TimeoutSec 30
    $size = (Get-Item $tmp).Length
    if ($size -lt 1MB) { Write-Host "文件过小 ($size bytes), 跳过"; continue }
    $downloaded = $true
    Write-Host "下载成功 ($size bytes)"
    break
  } catch {
    Write-Host "失败: $($_.Exception.Message)"
  }
}

if (-not $downloaded) { throw '所有下载源失败' }

if (-not (Test-Path $dst)) { New-Item -ItemType Directory -Path $dst -Force | Out-Null }
Expand-Archive -Path $tmp -DestinationPath $dst -Force

$exe = Get-ChildItem -Path $dst -Recurse -Filter 'k6.exe' | Select-Object -First 1
if ($exe) {
  Move-Item $exe.FullName "$dst\k6.exe" -Force
  Write-Host "k6 已安装: $dst\k6.exe"
  & "$dst\k6.exe" version
} else {
  Write-Host '未找到 k6.exe'
  Get-ChildItem $dst -Recurse
  throw '安装失败'
}
