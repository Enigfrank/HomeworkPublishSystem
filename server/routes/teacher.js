const express = require('express');
const { db } = require('../database');
const { authenticateToken, requireTeacher } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// 所有路由都需要教师权限
router.use(authenticateToken);
router.use(requireTeacher);

/**
 * 获取所有客户端（包含在线状态）
 */
router.get('/clients', (req, res) => {
  const { getOnlineClients } = require('../websocket');
  const onlineClientIds = getOnlineClients();

  db.all(
    `SELECT * FROM clients ORDER BY name`,
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: '获取客户端列表失败' });
      }

      const clientsWithStatus = rows.map(client => ({
        ...client,
        is_online: onlineClientIds.includes(client.client_id)
      }));

      res.json(clientsWithStatus);
    }
  );
});

/**
 * 教师发布新作业接口
 * 接收标题、内容及目标客户端对象数组，开启数据库级事务插入多条派发及关联系统通知记录
 * 若全部插入成功，借助 WebSocket 向所有指定客户端实时推送事件
 * @route POST /assignments
 */
router.post('/assignments', (req, res) => {
  const { title, content, client_ids } = req.body;
  const teacher_id = req.user.id;
  const subject_id = req.user.subject_id;

  if (!title || !content) {
    return res.status(400).json({ error: '请提供作业标题和内容' });
  }

  if (!client_ids || client_ids.length === 0) {
    return res.status(400).json({ error: '请选择发送对象（具体客户端）' });
  }

  if (!subject_id) {
    return res.status(400).json({ error: '您还没有分配教学学科，请联系管理员' });
  }

  // 开始事务
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    // 创建作业
    db.run(
      `INSERT INTO assignments (title, content, teacher_id, subject_id, client_id)
       VALUES (?, ?, ?, ?, ?)`,
      [title, content, teacher_id, subject_id, JSON.stringify(client_ids)],
      function (err) {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: '创建作业失败' });
        }

        const assignmentId = this.lastID;

        // 获取目标客户端列表
        let targetClients = client_ids;

        const processMessages = () => {
          if (targetClients.length === 0) {
            db.run('COMMIT');
            return res.json({
              id: assignmentId,
              message: '作业发布成功',
              targetCount: 0
            });
          }

          // 为每个客户端创建消息记录
          const insertPromises = targetClients.map(clientId => {
            return new Promise((resolve, reject) => {
              db.run(
                'INSERT INTO messages (assignment_id, client_id) VALUES (?, ?)',
                [assignmentId, clientId],
                (err) => {
                  if (err) reject(err);
                  else resolve();
                }
              );
            });
          });

          Promise.all(insertPromises)
            .then(() => {
              db.run('COMMIT');

              // 通过WebSocket通知客户端
              const { notifyClients } = require('../websocket');
              notifyClients(targetClients, {
                type: 'new_assignment',
                data: {
                  id: assignmentId,
                  title,
                  content,
                  subject: req.user.subject_name,
                  subject_color: req.user.subject_color,
                  teacher: req.user.name,
                  created_at: new Date().toISOString()
                }
              });

              res.json({
                id: assignmentId,
                message: '作业发布成功',
                targetCount: targetClients.length
              });
            })
            .catch(err => {
              db.run('ROLLBACK');
              res.status(500).json({ error: '创建消息记录失败' });
            });
        };

        processMessages();
      }
    );
  });
});

/**
 * 分页获取当前教师已发布的历史作业记录
 * 内置对作业各项查看维度(下发总数/已读总数)的统计查询
 * @route GET /assignments
 */
router.get('/assignments', (req, res) => {
  const teacher_id = req.user.id;
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  db.all(
    `SELECT a.id, a.title, a.content, a.teacher_id, a.subject_id, a.client_id, a.status,
            strftime('%Y-%m-%dT%H:%M:%SZ', a.created_at) as created_at,
            s.name as subject_name, s.color as subject_color,
            (SELECT COUNT(*) FROM messages WHERE assignment_id = a.id) as recipient_count,
            (SELECT COUNT(*) FROM messages WHERE assignment_id = a.id AND status = 'read') as read_count
     FROM assignments a
     JOIN subjects s ON a.subject_id = s.id
     WHERE a.teacher_id = ?
     ORDER BY a.created_at DESC
     LIMIT ? OFFSET ?`,
    [teacher_id, parseInt(limit), parseInt(offset)],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: '获取作业列表失败' });
      }

      // 获取总数
      db.get(
        'SELECT COUNT(*) as total FROM assignments WHERE teacher_id = ?',
        [teacher_id],
        (err, countRow) => {
          if (err) {
            return res.status(500).json({ error: '获取作业总数失败' });
          }
          res.json({
            assignments: rows,
            pagination: {
              page: parseInt(page),
              limit: parseInt(limit),
              total: countRow.total,
              totalPages: Math.ceil(countRow.total / limit)
            }
          });
        }
      );
    }
  );
});

/**
 * 获取具体某次下发作业的详细信息（含具体投递情况）
 * 数据返回包括该作业本身及每条投递消息(Message)的抵达/阅读详情
 * @route GET /assignments/:id
 */
router.get('/assignments/:id', (req, res) => {
  const { id } = req.params;
  const teacher_id = req.user.id;

  db.get(
    `SELECT a.id, a.title, a.content, a.teacher_id, a.subject_id, a.client_id, a.status,
            strftime('%Y-%m-%dT%H:%M:%SZ', a.created_at) as created_at,
            s.name as subject_name, s.color as subject_color
     FROM assignments a
     JOIN subjects s ON a.subject_id = s.id
     WHERE a.id = ? AND a.teacher_id = ?`,
    [id, teacher_id],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: '获取作业详情失败' });
      }
      if (!row) {
        return res.status(404).json({ error: '作业不存在' });
      }

      // 获取接收情况
      db.all(
        `SELECT m.id, m.assignment_id, m.client_id, m.status,
                strftime('%Y-%m-%dT%H:%M:%SZ', m.created_at) as created_at,
                strftime('%Y-%m-%dT%H:%M:%SZ', m.read_at) as read_at,
                c.name as client_name
         FROM messages m
         LEFT JOIN clients c ON m.client_id = c.client_id
         WHERE m.assignment_id = ?
         ORDER BY m.status, m.created_at DESC`,
        [id],
        (err, messages) => {
          if (err) {
            return res.status(500).json({ error: '获取接收情况失败' });
          }
          res.json({ ...row, messages });
        }
      );
    }
  );
});

/**
 * 取消当前教师先前发布的某个作业
 * 除了改变数据库条目状态为 cancelled，还会实时广播使得在线客户端同步撤下此作业卡片
 * @route PUT /assignments/:id/cancel
 */
router.put('/assignments/:id/cancel', (req, res) => {
  const { id } = req.params;
  const teacher_id = req.user.id;

  db.run(
    `UPDATE assignments SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP 
     WHERE id = ? AND teacher_id = ?`,
    [id, teacher_id],
    function (err) {
      if (err) {
        return res.status(500).json({ error: '取消作业失败' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '作业不存在' });
      }
      res.json({ message: '作业已取消' });

      // 通过WebSocket通知客户端作业已取消
      const { broadcastToAll } = require('../websocket');
      broadcastToAll({
        type: 'assignment_cancelled',
        data: { assignment_id: parseInt(id) }
      });
    }
  );
});

/**
 * 获取当前教师所属学科的基础信息(名及颜色)
 * 用于在前端面板呈现主题色与学科名标识
 * @route GET /my-subject
 */
router.get('/my-subject', (req, res) => {
  if (!req.user.subject_id) {
    return res.json({ subject: null });
  }

  db.get(
    'SELECT * FROM subjects WHERE id = ?',
    [req.user.subject_id],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: '获取学科信息失败' });
      }
      res.json({ subject: row });
    }
  );
});

module.exports = router;
