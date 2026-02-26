# 远程作业发布系统 HomeworkPublishSystem

一个完整的作业发布与接收系统, 包含管理后台, 教师网页端和学生桌面客户端.

**免责声明** : 该项目多处使用AI辅助编写, 如您对Vibe Coding有不一样的观点, 您可能并不适合使用本项目

## 功能特性

### 管理后台
-  管理员账户管理
-  老师账户管理（分配学科）
-  学科管理（名称, 颜色标识）
-  班级管理
-  系统统计概览

### 教师网页端
-  发布作业到指定班级或学生
-  学科自动关联（发送的作业会显示学科颜色）
-  实时推送通知
-  查看作业阅读状态

### 学生客户端
-  实时接收作业通知
-  系统托盘后台运行
-  新作业弹窗提醒
-  标记已读/确认收到
-  查看历史作业

## 快速开始

### 1. 启动服务器

```bash
cd server
npm install
npm start
```

服务器将在 http://localhost:3000 启动

默认管理员账户：`admin` / `admin`

### 2. 访问管理后台

打开浏览器访问 http://localhost:3000

1. 使用默认管理员账户登录
2. 创建学科
3. 创建老师账户并分配学科
4. 创建班级

### 3. 教师发布作业

1. 使用老师账户登录 http://localhost:3000
2. 选择发送对象（班级或具体客户端）
3. 输入作业标题和内容
4. 点击发布

### 4. 学生接收作业

```bash
cd client
npm install
npm start
```

1. 首次打开设置服务器地址
2. 保持客户端运行
3. 收到作业时会有系统通知

## 部署指南

### 服务器部署

#### Windows

```bash
cd server
npm install
npm start
```

#### Linux (推荐)

```bash
cd server
npm install
npm install -g pm2
pm2 start server.js --name homework-server
pm2 save
pm2 startup
```

### 前端部署

构建前端静态文件：

```bash
cd web
npm install
npm run build
```

将 `dist` 目录复制到服务器的 `public` 文件夹中.

### 客户端部署

构建可执行文件：

```bash
cd client
npm install
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux
```


## 技术栈

| 组件 | 技术 |
|------|------|
| 后端 | Node.js + Express + SQLite |
| 实时通信 | WebSocket |
| 管理后台 | React + TypeScript + Tailwind CSS |
| 教师端 | React + TypeScript + Tailwind CSS |
| 学生端 | Electron + Vanilla JS |

## 项目结构

```
homework-system/
├── server/              # 后端服务器
│   ├── server.js        # 入口文件
│   ├── database.js      # 数据库初始化
│   ├── middleware/      # 中间件
│   ├── routes/          # API路由
│   └── README.md        # 服务器文档
│
├── web/                 # 前端（管理后台+教师端）
│   ├── src/
│   │   ├── pages/       # 页面组件
│   │   ├── services/    # API服务
│   │   └── types/       # 类型定义
│   └── README.md        # 前端文档
│
├── client/              # 学生桌面客户端
│   ├── main.js          # 主进程
│   ├── preload.js       # 预加载脚本
│   ├── renderer/        # 渲染进程
│   └── README.md        # 客户端文档
│
├── 集成指南.md       # 集成指南
└── README.md            # 本文档
```

## API 文档

### 认证
- `POST /api/auth/login` - 登录
- `GET /api/auth/me` - 获取当前用户

### 管理员
- `GET /api/admin/users` - 获取用户列表
- `POST /api/admin/users` - 创建老师
- `GET /api/admin/subjects` - 获取学科列表
- `POST /api/admin/subjects` - 创建学科
- `GET /api/admin/classes` - 获取班级列表
- `POST /api/admin/classes` - 创建班级
- `GET /api/admin/stats` - 获取统计数据

### 教师
- `GET /api/teacher/classes` - 获取班级列表
- `GET /api/teacher/clients` - 获取在线客户端
- `GET /api/teacher/assignments` - 获取作业列表
- `POST /api/teacher/assignments` - 发布作业

### 客户端
- `POST /api/client/register` - 注册客户端
- `GET /api/client/assignments/:id` - 获取作业列表
- `POST /api/client/assignments/:id/read` - 标记已读

## 配置说明

### 服务器配置

环境变量：
- `PORT` - 服务器端口（默认：3000）
- `JWT_SECRET` - JWT密钥（生产环境请修改）
- `NODE_ENV` - 运行环境

### 客户端配置

首次运行时配置：
- 服务器地址
- 客户端名称
- 所属班级

## 数据备份

SQLite数据库文件位于 `server/data/homework.db`, 建议定期备份.


## 贡献

欢迎提交 Issue 和 Pull Request.


