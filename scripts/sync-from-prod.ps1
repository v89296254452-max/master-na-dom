# Скачать актуальный проект с прод-сервера в локальную папку.
# Запуск из корня репозитория: .\scripts\sync-from-prod.ps1
# После синка: npm ci && npm run build

$ErrorActionPreference = "Stop"
$Server = "45.130.43.157"
$User = "root"
$HostKey = "SHA256:uhJYre3O4USq3t7xTOl5TAUqFiIYbMZdkJ1eo5mW3Ag"
$RemoteDir = "/var/www/master-na-dom"
$ProjectDir = Split-Path $PSScriptRoot -Parent
$Plink = "$env:USERPROFILE\bin\plink.exe"
$Pscp = "$env:USERPROFILE\bin\pscp.exe"
$Archive = "$ProjectDir\sync-from-prod.tgz"

if (-not (Test-Path $Plink)) { throw "plink not found at $Plink" }
if (-not (Test-Path $Pscp)) { throw "pscp not found at $Pscp" }

$pw = Read-Host "Server password (root@$Server)" -AsSecureString
$Bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($pw)
$Plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto($Bstr)

Write-Host "== [1/4] pack on server =="
& $Plink -ssh "${User}@${Server}" -pw $Plain -hostkey $HostKey -batch `
    "cd $RemoteDir && tar czf /root/sync-from-prod.tgz --exclude='./node_modules' --exclude='./.next' --exclude='./.git' . && ls -lh /root/sync-from-prod.tgz"

Write-Host "== [2/4] download =="
& $Pscp -pw $Plain -hostkey $HostKey -batch "${User}@${Server}:/root/sync-from-prod.tgz" $Archive

Write-Host "== [3/4] extract =="
Set-Location $ProjectDir
tar -xzf $Archive
Remove-Item $Archive -Force

Write-Host "== [4/4] done =="
Write-Host "Next: npm ci && npm run build && npm run start"
Write-Host "Project: $ProjectDir"
