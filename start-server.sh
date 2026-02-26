#!/bin/bash

echo "=========================================="
echo "    远程作业发布系统 - 服务器启动脚本"
echo "=========================================="
echo ""

# 检查Node.js
echo "[1/3] 检查Node.js环境..."
if ! command -v node &> /dev/null; then
    echo "[错误] 未检测到Node.js，请先安装Node.js 18+"
    exit 1
fi
echo "[OK] Node.js已安装: $(node -v)"

# 安装依赖
echo ""
echo "[2/3] 安装依赖..."
cd server
if [ ! -d "node_modules" ]; then
    npm install
    if [ $? -ne 0 ]; then
        echo "[错误] 依赖安装失败"
        exit 1
    fi
else
    echo "[OK] 依赖已安装"
fi

# 启动服务器
echo ""
echo "[3/3] 启动服务器..."
echo ""
echo "=========================================="
echo "    服务器启动成功！"
echo "    访问地址: http://localhost:3000"
echo "    默认账户: admin / admin"
echo "=========================================="
echo ""
echo "按Ctrl+C停止服务器"
echo ""

npm start
