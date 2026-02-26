# 设置UTF-8编码
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "=========================================="
Write-Host "    远程作业发布系统 - 服务器启动脚本"
Write-Host "=========================================="
Write-Host ""

# 检查Node.js
Write-Host "[1/3] 检查Node.js环境..."
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[错误] 未检测到Node.js，请先安装Node.js 18+"
    Read-Host "按回车键退出"
    exit 1
}
$nodeVersion = node -v
Write-Host "[OK] Node.js已安装 (版本: $nodeVersion)"

# 安装依赖
Write-Host ""
Write-Host "[2/3] 安装依赖..."
if (-not (Test-Path -Path "server")) {
    Write-Host "[错误] 未找到server目录，请确认脚本位置"
    Read-Host "按回车键退出"
    exit 1
}
Set-Location -Path "server"

if (-not (Test-Path -Path "node_modules")) {
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[错误] 依赖安装失败"
        Read-Host "按回车键退出"
        exit 1
    }
} else {
    Write-Host "[OK] 依赖已安装"
}

# 启动服务器
Write-Host ""
Write-Host "[3/3] 启动服务器..."
Write-Host ""
Write-Host "=========================================="
Write-Host "    服务器启动成功！"
Write-Host "    访问地址: http://localhost:3000"
Write-Host "    默认账户: admin / admin123"
Write-Host "=========================================="
Write-Host ""
Write-Host "按Ctrl+C停止服务器"
Write-Host ""

npm start

Read-Host "按回车键退出"