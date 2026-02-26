# 作业接收客户端

这是一个基于 Electron 的桌面客户端，用于接收老师发布的作业通知。

## 快速开始

### 1. 安装依赖

```bash
cd client
npm install
```

### 2. 开发模式运行

```bash
npm run dev
```

### 3. 构建应用

```bash
# 构建所有平台
npm run build

# 仅构建 Windows
npm run build:win

# 仅构建 macOS
npm run build:mac

# 仅构建 Linux
npm run build:linux
```

## 技术栈

- Electron 28+
- WebSocket
- Axios

## 目录结构

```
client/
├── main.js          # 主进程
├── preload.js       # 预加载脚本
├── renderer/        # 渲染进程
│   ├── index.html   # 主页面
│   ├── style.css    # 样式
│   └── app.js       # 渲染脚本
├── assets/          # 资源文件
│   ├── icon.png     # 应用图标
│   └── tray-icon.png # 托盘图标
└── package.json     # 项目配置
```

