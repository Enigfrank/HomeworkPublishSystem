const { app, BrowserWindow, ipcMain, Tray, Menu, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');
const axios = require('axios');

let mainWindow = null;
let tray = null;
let ws = null;

const configPath = path.join(app.getPath('userData'), 'config.json');

const defaultConfig = {
  clientId: null,
  clientName: '',
  serverURL: 'http://localhost:3000',
  wsURL: 'ws://localhost:3000'
};

let config = { ...defaultConfig };

/**
 * 初始化并加载客户端运行配置
 * 读取存储在用户目录下的 JSON，并在缺失 WebSocket 地址时自动进行 HTTP->WS 的退化回退生成
 */
function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      const savedConfig = JSON.parse(data);
      config = { ...defaultConfig, ...savedConfig };
      // 确保 wsURL 与 serverURL 同步（如果是因为旧版本配置导致缺失）
      if (!config.wsURL && config.serverURL) {
        config.wsURL = config.serverURL.replace('http', 'ws');
      }
      console.log('配置加载成功:', config);
    }
  } catch (err) {
    console.error('加载配置失败:', err);
  }
}

// 获取当前WebSocket状态
ipcMain.handle('get-ws-status', () => {
  if (!ws) return 'disconnected';
  switch (ws.readyState) {
    case WebSocket.CONNECTING: return 'connecting';
    case WebSocket.OPEN: return 'connected';
    case WebSocket.CLOSING: return 'disconnected';
    case WebSocket.CLOSED: return 'disconnected';
    default: return 'disconnected';
  }
});

/**
 * 将内存中的配置修改异步或同步地持久化回磁盘 (config.json)
 */
function saveConfigToFile() {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    console.log('配置保存成功');
  } catch (err) {
    console.error('保存配置失败:', err);
  }
}

// 创建主窗口
/**
 * 初始化并唤起 Electron 的主渲染窗口
 * 控制窗体生命周期并注入 preload.js 环境隔离层
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 900,
    minWidth: 350,
    minHeight: 500,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    // icon: path.join(__dirname, 'assets', 'icon.png'),
    show: false,
    titleBarStyle: 'default'
  });

  // 加载渲染进程
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // 页面加载完成后，如果已配置且未连接，则尝试连接 WebSocket
  mainWindow.webContents.on('did-finish-load', () => {
    if (config.clientId && (!ws || ws.readyState === WebSocket.CLOSED)) {
      connectWebSocket();
    }
  });

  // 开发工具
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // 窗口关闭时隐藏到托盘
  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

/**
 * 在系统状态栏/任务栏右下角创建程序托盘图标
 * 实现后台静默运行以及快捷右键菜单（打开面板、快速控制等）
 */
function createTray() {
  // const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');
  tray = new Tray(iconPath);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      }
    },
    {
      label: '设置',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send('navigate', 'settings');
          mainWindow.show();
        }
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.isQuiting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('作业接收客户端');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    } else {
      createWindow();
    }
  });
}

/**
 * 发起并维持与远端服务器的 WebSocket 长连接
 * 具备完善的自动重连机制与旧实例的安全闭环销毁能力
 */
function connectWebSocket() {
  if (ws) {
    // 移除之前的业务监听器
    ws.removeAllListeners();
    // 关键：添加一个空的错误处理程序，防止 terminate() 触发错误导致进程崩溃
    ws.on('error', () => { });

    try {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.terminate();
      }
    } catch (err) {
      console.error('关闭旧WebSocket失败:', err);
    }
    ws = null;
  }

  if (!config.clientId) {
    console.log('未注册客户端，跳过WebSocket连接');
    return;
  }

  try {
    ws = new WebSocket(config.wsURL);

    ws.on('open', () => {
      console.log('WebSocket连接成功');
      // 注册客户端
      ws.send(JSON.stringify({
        type: 'register',
        client_id: config.clientId
      }));

      if (mainWindow) {
        mainWindow.webContents.send('ws-status', 'connected');
      }
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        handleWebSocketMessage(message);
      } catch (err) {
        console.error('解析WebSocket消息失败:', err);
      }
    });

    ws.on('close', () => {
      console.log('WebSocket连接关闭');
      if (mainWindow) {
        mainWindow.webContents.send('ws-status', 'disconnected');
      }
      // 10秒后重连
      setTimeout(connectWebSocket, 10000);
    });

    ws.on('error', (err) => {
      console.error('WebSocket错误:', err);
      if (mainWindow) {
        mainWindow.webContents.send('ws-status', 'error');
      }
    });
  } catch (err) {
    console.error('创建WebSocket连接失败:', err);
  }
}

/**
 * 集中式处理自服务器下发的业务级 WebSocket 消息
 * 实现如新作业下发、撤回等的本地系统级通知与向渲染进程的数据转发
 * @param {Object} message JSON 格式解析后的消息实体
 */
function handleWebSocketMessage(message) {
  console.log('收到消息:', message);

  switch (message.type) {
    case 'new_assignment':
      // 显示系统通知
      showNotification('新作业', `${message.data.subject} - ${message.data.title}`);

      // 通知渲染进程
      if (mainWindow) {
        mainWindow.webContents.send('new-assignment', message.data);
      }
      break;

    case 'assignment_cancelled':
      // 通知渲染进程重新加载作业列表
      if (mainWindow) {
        mainWindow.webContents.send('assignment-cancelled', message.data);
      }
      break;

    case 'registered':
      console.log('WebSocket注册成功');
      break;

    case 'heartbeat':
      // 心跳响应
      break;
  }
}

/**
 * 调用操作系统级别的原生全局推送通知
 * 允许用户点击右下的气泡直达唤起隐藏在后台的主面板
 * @param {string} title 通知标题
 * @param {string} body 通知主体文本
 */
function showNotification(title, body) {
  if (Notification.isSupported()) {
    const notification = new Notification({
      title,
      body,
      icon: path.join(__dirname, 'assets', 'icon.png')
    });

    notification.on('click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });

    notification.show();
  }
}

// IPC处理程序

// 获取配置
ipcMain.handle('get-config', () => {
  return config;
});

// 保存配置
ipcMain.handle('save-config', (event, newConfig) => {
  config = { ...config, ...newConfig };
  saveConfigToFile();

  if (config.clientId) {
    connectWebSocket();
  }

  return config;
});

ipcMain.handle('register-client', async (event, data) => {
  try {
    const response = await axios.post(`${config.serverURL}/api/client/register`, data);
    const result = response.data;

    if (result.client_id) {
      config.clientId = result.client_id;
      config.clientName = data.name || '';
      saveConfigToFile();
      connectWebSocket();
    }

    return result;
  } catch (err) {
    console.error('注册客户端失败:', err);
    throw err;
  }
});

// 获取作业列表
ipcMain.handle('get-assignments', async (event, clientId, status) => {
  try {
    const url = `${config.serverURL}/api/client/assignments/${clientId}${status ? `?status=${status}` : ''}`;
    const response = await axios.get(url);
    return response.data;
  } catch (err) {
    console.error('获取作业列表失败:', err);
    throw err;
  }
});

// 标记已读
ipcMain.handle('mark-read', async (event, assignmentId, clientId) => {
  try {
    const response = await axios.post(
      `${config.serverURL}/api/client/assignments/${assignmentId}/read`,
      { client_id: clientId }
    );
    return response.data;
  } catch (err) {
    console.error('标记已读失败:', err);
    throw err;
  }
});

// 确认收到
ipcMain.handle('acknowledge', async (event, assignmentId, clientId) => {
  try {
    const response = await axios.post(
      `${config.serverURL}/api/client/assignments/${assignmentId}/acknowledge`,
      { client_id: clientId }
    );
    return response.data;
  } catch (err) {
    console.error('确认失败:', err);
    throw err;
  }
});

// 获取未读数量
ipcMain.handle('get-unread-count', async (event, clientId) => {
  try {
    const response = await axios.get(`${config.serverURL}/api/client/unread-count/${clientId}`);
    return response.data;
  } catch (err) {
    console.error('获取未读数量失败:', err);
    throw err;
  }
});

// 测试连接
ipcMain.handle('test-connection', async (event, serverURL) => {
  try {
    const response = await axios.get(`${serverURL}/api/health`, { timeout: 5000 });
    return response.data;
  } catch (err) {
    console.error('测试连接失败:', err);
    throw err;
  }
});

// 应用就绪
app.whenReady().then(() => {
  loadConfig();
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 退出应用
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  app.isQuiting = true;
  if (ws) {
    ws.close();
  }
});

// 阻止多个实例
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show();
      mainWindow.focus();
    }
  });
}
