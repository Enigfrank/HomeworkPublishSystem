const WebSocket = require('ws');

// 存储所有连接的客户端
const clients = new Map();

let wss = null;

/**
 * 将 WebSocket 服务挂载至 Express 底层的 HTTP Server 实例
 * 监听并处理客户端连接、身份登记、心跳维持及断线状态变更
 * @param {import('http').Server} server 
 * @returns {WebSocket.Server} 
 */
function initWebSocketServer(server) {
  wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);

        // 客户端连接
        if (data.type === 'register' && data.client_id) {
          clients.set(data.client_id, ws);
          ws.client_id = data.client_id;
          console.log(`客户端 ${data.client_id} 已连接到WebSocket`);

          // 发送确认
          ws.send(JSON.stringify({
            type: 'registered',
            message: '连接成功'
          }));

          // 广播客户端上线
          broadcastToAll({
            type: 'client_status_changed',
            data: { client_id: data.client_id, status: 'online' }
          });
        }

        // 心跳
        if (data.type === 'heartbeat') {
          console.log(`与客户端 ${data.client_id} 维持心跳`);
          ws.send(JSON.stringify({
            type: 'heartbeat',
            timestamp: Date.now()
          }));
        }
      } catch (err) {
        console.error('WebSocket消息解析错误:', err);
      }
    });

    ws.on('close', () => {
      if (ws.client_id) {
        // 广播客户端下线
        broadcastToAll({
          type: 'client_status_changed',
          data: { client_id: ws.client_id, status: 'offline' }
        });

        clients.delete(ws.client_id);
        console.log(`客户端 ${ws.client_id} 已断开连接`);
      }
    });

    ws.on('error', (err) => {
      console.error('WebSocket错误:', err );
      ws.close();
      console.log(`已自动关闭 ${ws.client_id} 连接`)
    });
  });

  console.log('WebSocket服务器初始化完成!');
  return wss;
}

/**
 * 向一个或多个指定的客户端定点推送 JSON 格式的消息
 * @param {string[]} clientIds 目标客户端的系统分配标识符数组
 * @param {Object} data 待发送的数据对象
 */
function notifyClients(clientIds, data) {
  const message = JSON.stringify(data);

  clientIds.forEach(clientId => {
    const ws = clients.get(clientId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
}

/**
 * 向当前所有已成功登记(携带 client_id)的学生机客户端广播消息
 * @param {Object} data 待发送的数据对象
 */
function broadcast(data) {
  const message = JSON.stringify(data);

  clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
}

/**
 * 向当前 Web 服务器上的**所有**活跃长连接广播消息
 * (包含已注册学生机、未登记客户端及控制台浏览器端)
 * @param {Object} data 
 */
function broadcastToAll(data) {
  if (!wss) return;
  const message = JSON.stringify(data);
  wss.clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
}

/**
 * 获取所有在线客户端ID列表
 * @returns {string[]} 在线客户端ID数组
 */
function getOnlineClients() {
  const onlineClients = [];
  clients.forEach((ws, clientId) => {
    if (ws.readyState === WebSocket.OPEN) {
      onlineClients.push(clientId);
    }
  });
  return onlineClients;
}

/**
 * 检查指定客户端是否在线
 * @param {string} clientId - 客户端ID
 * @returns {boolean} 是否在线
 */
function isClientOnline(clientId) {
  const ws = clients.get(clientId);
  return ws && ws.readyState === WebSocket.OPEN;
}

module.exports = {
  initWebSocketServer,
  notifyClients,
  broadcast,
  broadcastToAll,
  getOnlineClients,
  isClientOnline
};
