#!/usr/bin/env pwsh
# AVM 数据库备份 - Windows 计划任务版本
# 建议: 每天凌晨 3 点执行
#   $action = New-ScheduledTaskAction -Execute "pwsh.exe" -Argument "-File C:\path\to\backup.ps1"
#   $trigger = New-ScheduledTaskTrigger -Daily -At 3am
#   Register-ScheduledTask -TaskName "AVM Daily Backup" -Action $action -Trigger $trigger

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Split-Path -Parent $ScriptDir

Set-Location $BackendDir

# 通过 npm script 调用 (自动读取 DATABASE_URL)
try {
    & npm run backup
    $msg = "✅ AVM 备份成功 $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    Write-Host $msg
    # 可选: 发送飞书/钉钉通知
    # & curl -X POST $env:NOTIFY_WEBHOOK -H 'Content-Type: application/json' -d "{`"msg_type`":`"text`",`"content`":{`"text`":`"$msg`"}}"
}
catch {
    $err = "❌ AVM 备份失败: $_"
    Write-Error $err
    exit 1
}
