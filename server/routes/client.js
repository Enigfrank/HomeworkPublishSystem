const express = require('express');
const { db } = require('../database');
const { v4: uuidv4 } = require('uuid');
const { broadcastToAll } = require('../websocket');

const router = express.Router();

/**
 * 客户端注册与设备更新接口
 * 在客户端初次启动(无ID)时分配 UUID 并记录，或是重连时更新最后的在线时间
 * @route POST /register
 */
router.post('/register', (req, res) => {
  const { client_id, name } = req.body;

  // 如果提供了client_id，更新现有客户端
  if (client_id) {
    db.get('SELECT * FROM clients WHERE client_id = ?', [client_id], (err, row) => {
      if (err) {
        return res.status(500).json({ error: '服务器错误' });
      }

      if (row) {
        // 更新现有客户端
        db.run(
          `UPDATE clients SET name = ?, last_seen = CURRENT_TIMESTAMP WHERE client_id = ?`,
          [name || row.name, client_id],
          (err) => {
            if (err) {
              return res.status(500).json({ error: '更新客户端信息失败' });
            }
            res.json({
              client_id,
              name: name || row.name,
              message: '客户端信息更新成功'
            });
          }
        );
      } else {
        // client_id不存在，创建新记录
        db.run(
          `INSERT INTO clients (client_id, name, last_seen) VALUES (?, ?, CURRENT_TIMESTAMP)`,
          [client_id, name || null],
          (err) => {
            if (err) {
              return res.status(500).json({ error: '注册客户端失败' });
            }
            res.json({
              client_id,
              name,
              message: '客户端注册成功'
            });
          }
        );
      }
    });
  } else {
    // 创建新客户端
    const newClientId = uuidv4();
    const clientIp = req.ip || req.socket.remoteAddress || '未知IP';
    console.log(`收到来自${clientIp}的请求,下发UUID为:${newClientId}`);
    db.run(
      `INSERT INTO clients (client_id, name, last_seen) VALUES (?, ?, CURRENT_TIMESTAMP)`,
      [newClientId, name || null],
      (err) => {
        if (err) {
          return res.status(500).json({ error: '注册客户端失败' });
        }
        res.json({
          client_id: newClientId,
          name,
          message: '客户端注册成功'
        });
      }
    );
  }
});

/**
 * 获取指定客户端(学生机)的基础信息
 * 用于在前端面板显示基本设备标识
 * @route GET /info/:client_id
 */
router.get('/info/:client_id', (req, res) => {
  const { client_id } = req.params;

  db.get(
    `SELECT id, client_id, name, strftime('%Y-%m-%dT%H:%M:%SZ', last_seen) as last_seen, strftime('%Y-%m-%dT%H:%M:%SZ', created_at) as created_at FROM clients WHERE client_id = ?`,
    [client_id],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: '获取客户端信息失败' });
      }
      if (!row) {
        return res.status(404).json({ error: '客户端不存在' });
      }
      res.json(row);
    }
  );
});

/**
 * 获取指定客户端的接收作业列表
 * 支持基于确认状态的过滤 (all, pending, acknowledged)
 * @route GET /assignments/:client_id
 */
router.get('/assignments/:client_id', (req, res) => {
  const { client_id } = req.params;
  const { status = 'all' } = req.query;

  let sql = `
    SELECT a.id, a.title, a.content, a.teacher_id, a.subject_id, a.client_id, a.status,
           strftime('%Y-%m-%dT%H:%M:%SZ', a.created_at) as created_at,
           s.name as subject_name, s.color as subject_color,
           u.name as teacher_name, m.status as message_status,
           strftime('%Y-%m-%dT%H:%M:%SZ', m.acknowledged_at) as acknowledged_at
    FROM messages m
    JOIN assignments a ON m.assignment_id = a.id
    JOIN subjects s ON a.subject_id = s.id
    JOIN users u ON a.teacher_id = u.id
    WHERE m.client_id = ? AND a.status = 'active'
  `;

  const params = [client_id];

  if (status !== 'all') {
    sql += ` AND m.status = ?`;
    params.push(status);
  }

  sql += ` ORDER BY a.created_at DESC`;

  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: '获取作业列表失败' });
    }
    res.json(rows);
  });
});

/**
 * 确认客户端已收到目标作业，并向教师端广播确认事件
 * 重复确认时保留首次确认时间，避免覆盖历史记录
 * @route POST /assignments/:assignment_id/acknowledge
 */
router.post('/assignments/:assignment_id/acknowledge', (req, res) => {
  const { assignment_id } = req.params;
  const { client_id } = req.body;

  if (!client_id) {
    return res.status(400).json({ error: '请提供客户端ID' });
  }

  db.run(
    `UPDATE messages
     SET status = 'acknowledged',
         acknowledged_at = COALESCE(acknowledged_at, CURRENT_TIMESTAMP)
     WHERE assignment_id = ? AND client_id = ?`,
    [assignment_id, client_id],
    function (err) {
      if (err) {
        return res.status(500).json({ error: '确认失败' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '消息不存在' });
      }
      res.json({ message: '已确认收到作业' });

      // 广播状态更新给所有连接（如教师仪表盘）
      broadcastToAll({
        type: 'assignment_acknowledged',
        data: { assignment_id, client_id, status: 'acknowledged' }
      });
    }
  );
});

/**
 * 更新客户端在线状态心跳时间
 * @route POST /heartbeat
 */
router.post('/heartbeat', (req, res) => {
  const { client_id } = req.body;

  if (!client_id) {
    return res.status(400).json({ error: '请提供客户端ID' });
  }

  db.run(
    'UPDATE clients SET last_seen = CURRENT_TIMESTAMP WHERE client_id = ?',
    [client_id],
    function (err) {
      if (err) {
        return res.status(500).json({ error: '更新状态失败' });
      }
      res.json({ message: '状态更新成功' });
    }
  );
});

module.exports = router;
