const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');

const { initDatabase, migrateDatabase, createDefaultAdmin, createDefaultSubjects } = require('./database');
const { initWebSocketServer } = require('./websocket');

// 导入路由
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const teacherRoutes = require('./routes/teacher');
const clientRoutes = require('./routes/client');

const app = express();
const server = http.createServer(app);

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务（用于部署前端）
app.use(express.static(path.join(__dirname, 'public')));

// API路由
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/client', clientRoutes);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// 前端路由（所有非API请求都返回index.html）
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ error: '服务器内部错误' });
});

// 初始化
const PORT = process.env.PORT || 3000;

/**
 * 作为后台服务主控入口，协调数据库构建和通信服务挂载
 * 并在初始化成功后在标准输出打印本地监听端口信息及凭证提示
 * @returns {Promise<void>}
 */
async function startServer() {
  try {
    // 初始化数据库
    await initDatabase();
    await migrateDatabase(); // 执行数据库迁移
    await createDefaultAdmin();
    await createDefaultSubjects();

    // 初始化WebSocket
    initWebSocketServer(server);

    // 启动服务器
    server.listen(PORT, () => {
      console.log('='.repeat(50));
      console.log('🚀 远程作业发布系统服务器已启动');
      console.log('='.repeat(50));
      console.log(`📡 HTTP服务器: http://localhost:${PORT}`);
      console.log(`🔌 WebSocket服务器: ws://localhost:${PORT}`);
      console.log('='.repeat(50));
      console.log('默认管理员账户:');
      console.log('  用户名: admin');
      console.log('  密码: admin');
      console.log('='.repeat(50));
    });
  } catch (err) {
    console.error('服务器启动失败:', err);
    process.exit(1);
  }
}

startServer();
