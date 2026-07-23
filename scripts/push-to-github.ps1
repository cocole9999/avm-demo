# 解决 PowerShell + git libcurl 线程池问题: getaddrinfo() thread failed to start
# 通过 ProcessStartInfo 在独立子进程中跑 git,避免被 PowerShell 的子进程重定向阻塞
$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

Write-Host "[1/3] 推送代码到 origin main..."
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "git"
$psi.Arguments = "push -u origin main --verbose"
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.UseShellExecute = $false
$psi.WorkingDirectory = $scriptDir
# 关键: 不在 PowerShell 的 Job 线程池里运行
$psi.EnvironmentVariables["GIT_TERMINAL_PROMPT"] = "0"

$p = [System.Diagnostics.Process]::Start($psi)
$outTask = $p.StandardOutput.ReadToEndAsync()
$errTask = $p.StandardError.ReadToEndAsync()
$p.WaitForExit(60000)  # 60s 超时
$out = $outTask.Result
$err = $errTask.Result

Write-Host "STDOUT:"
Write-Host $out
Write-Host "STDERR:"
Write-Host $err
Write-Host "EXIT: $($p.ExitCode)"

if ($p.ExitCode -ne 0) {
    Write-Host ""
    Write-Host "[2/3] 尝试备用: gh api 推送 (备用通道)..."
    & gh repo view cocole9999/avm-demo 2>&1 | Select-Object -First 5
}

exit $p.ExitCode
