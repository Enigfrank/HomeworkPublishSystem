const { contextBridge, ipcRenderer } = require('electron');

// 暴露API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 配置相关
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),

  // 客户端注册
  registerClient: (data) => ipcRenderer.invoke('register-client', data),

  // 作业相关
  getAssignments: (clientId, status) => ipcRenderer.invoke('get-assignments', clientId, status),
  markRead: (assignmentId, clientId) => ipcRenderer.invoke('mark-read', assignmentId, clientId),
  acknowledge: (assignmentId, clientId) => ipcRenderer.invoke('acknowledge', assignmentId, clientId),
  getUnreadCount: (clientId) => ipcRenderer.invoke('get-unread-count', clientId),

  // 连接测试与状态
  testConnection: (serverURL) => ipcRenderer.invoke('test-connection', serverURL),
  getWsStatus: () => ipcRenderer.invoke('get-ws-status'),

  // 事件监听
  onNewAssignment: (callback) => ipcRenderer.on('new-assignment', (event, data) => callback(data)),
  onAssignmentCancelled: (callback) => ipcRenderer.on('assignment-cancelled', (event, data) => callback(data)),
  onWsStatus: (callback) => ipcRenderer.on('ws-status', (event, status) => callback(status)),
  onNavigate: (callback) => ipcRenderer.on('navigate', (event, page) => callback(page)),

  // 移除监听
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});
