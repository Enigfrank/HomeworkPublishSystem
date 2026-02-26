/**
 * API 封装模块
 * 统一处理与 Electron 主进程的通信
 */

export const api = {
    // 配置
    /** 获取本地存储配置数据 */
    getConfig: () => window.electronAPI.getConfig(),
    /** 持久化最新配置到本地磁盘 */
    saveConfig: (config) => window.electronAPI.saveConfig(config),

    // 注册
    /** 握手/注册最新连接客户端 ID 等信息 */
    registerClient: (data) => window.electronAPI.registerClient(data),

    // 作业
    getAssignments: (clientId, status) => window.electronAPI.getAssignments(clientId, status),
    markRead: (id, clientId) => window.electronAPI.markRead(id, clientId),
    acknowledge: (id, clientId) => window.electronAPI.acknowledge(id, clientId),
    getUnreadCount: (clientId) => window.electronAPI.getUnreadCount(clientId),

    // 连接
    testConnection: (url) => window.electronAPI.testConnection(url),
    getWsStatus: () => window.electronAPI.getWsStatus(),

    // 事件注册封装
    onNewAssignment: (cb) => window.electronAPI.onNewAssignment(cb),
    onAssignmentCancelled: (cb) => window.electronAPI.onAssignmentCancelled(cb),
    onWsStatus: (cb) => window.electronAPI.onWsStatus(cb),
    onNavigate: (cb) => window.electronAPI.onNavigate(cb)
};
