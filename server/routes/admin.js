const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { getOnlineClients, isClientOnline } = require('../websocket');

const router = express.Router();

// 所有路由都需要管理员权限
router.use(authenticateToken);
router.use(requireAdmin);

// ===== 用户管理 =====

/**
 * 获取系统中所有的用户列表（管理员和教师）
 * 包含与其关联的学科信息
 * @route GET /users
 */
router.get('/users', (req, res) => {
  db.all(
    `SELECT u.id, u.username, u.name, u.role, u.subject_id, u.created_at,
            s.name as subject_name, s.color as subject_color
     FROM users u
     LEFT JOIN subjects s ON u.subject_id = s.id
     ORDER BY u.role, u.created_at DESC`,
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: '获取用户列表失败' });
      }
      res.json(rows);
    }
  );
});

/**
 * 创建新的教师账户
 * 接收基本信息与密码，密码将进行 bcrypt 散列处理入库
 * @route POST /users
 */
router.post('/users', (req, res) => {
  const { username, password, name, subject_id } = req.body;

  if (!username || !password || !name) {
    return res.status(400).json({ error: '请提供用户名、密码和姓名' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  db.run(
    `INSERT INTO users (username, password, name, role, subject_id) VALUES (?, ?, ?, 'teacher', ?)`,
    [username, hashedPassword, name, subject_id || null],
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: '用户名已存在' });
        }
        return res.status(500).json({ error: '创建用户失败' });
      }
      res.json({
        id: this.lastID,
        username,
        name,
        role: 'teacher',
        message: '老师账户创建成功'
      });
    }
  );
});

/**
 * 更新现有教师账户的信息
 * 支持动态传参更新名称、负责学科或密码等，密码更新自动执行散列
 * @route PUT /users/:id
 */
router.put('/users/:id', (req, res) => {
  const { id } = req.params;
  const { name, subject_id, password } = req.body;

  let updates = [];
  let params = [];

  if (name) {
    updates.push('name = ?');
    params.push(name);
  }
  if (subject_id !== undefined) {
    updates.push('subject_id = ?');
    params.push(subject_id);
  }
  if (password) {
    updates.push('password = ?');
    params.push(bcrypt.hashSync(password, 10));
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: '没有要更新的字段' });
  }

  params.push(id);

  db.run(
    `UPDATE users SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND role = 'teacher'`,
    params,
    function (err) {
      if (err) {
        return res.status(500).json({ error: '更新用户失败' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '用户不存在或是管理员账户' });
      }
      res.json({ message: '用户更新成功' });
    }
  );
});

/**
 * 删除指定的教师账户
 * 保护性设计：通过角色条件防止误删系统管理员
 * @route DELETE /users/:id
 */
router.delete('/users/:id', (req, res) => {
  const { id } = req.params;

  db.run(
    `DELETE FROM users WHERE id = ? AND role = 'teacher'`,
    [id],
    function (err) {
      if (err) {
        return res.status(500).json({ error: '删除用户失败' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '用户不存在或是管理员账户' });
      }
      res.json({ message: '用户删除成功' });
    }
  );
});

// ===== 学科管理 =====

/**
 * 获取系统中所有初始化的学科列表
 * @route GET /subjects
 */
router.get('/subjects', (req, res) => {
  db.all(
    'SELECT * FROM subjects ORDER BY name',
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: '获取学科列表失败' });
      }
      res.json(rows);
    }
  );
});

/**
 * 创建预设外的新学科
 * 包含名称、字母代码以及主题颜色
 * @route POST /subjects
 */
router.post('/subjects', (req, res) => {
  const { name, code, color } = req.body;

  if (!name || !code) {
    return res.status(400).json({ error: '请提供学科名称和代码' });
  }

  db.run(
    'INSERT INTO subjects (name, code, color) VALUES (?, ?, ?)',
    [name, code, color || '#3b82f6'],
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: '学科名称或代码已存在' });
        }
        return res.status(500).json({ error: '创建学科失败' });
      }
      res.json({ id: this.lastID, name, code, color, message: '学科创建成功' });
    }
  );
});

/**
 * 更新指定学科的信息
 * 支持局部更新：仅传入 name、code 或 color 之一也可正常修改
 * @route PUT /subjects/:id
 */
router.put('/subjects/:id', (req, res) => {
  const { id } = req.params;
  const { name, code, color } = req.body;

  let updates = [];
  let params = [];

  if (name) {
    updates.push('name = ?');
    params.push(name);
  }
  if (code) {
    updates.push('code = ?');
    params.push(code);
  }
  if (color) {
    updates.push('color = ?');
    params.push(color);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: '没有要更新的字段' });
  }

  params.push(id);

  db.run(
    `UPDATE subjects SET ${updates.join(', ')} WHERE id = ?`,
    params,
    function (err) {
      if (err) {
        return res.status(500).json({ error: '更新学科失败' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '学科不存在' });
      }
      res.json({ message: '学科更新成功' });
    }
  );
});

/**
 * 删除指定的学科
 * 若该学科已被分配给任意教师或作业，由于数据库约束可能会删除失败
 * @route DELETE /subjects/:id
 */
router.delete('/subjects/:id', (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM subjects WHERE id = ?', [id], function (err) {
    if (err) {
      return res.status(500).json({ error: '删除学科失败' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: '学科不存在' });
    }
    res.json({ message: '学科删除成功' });
  });
});

/**
 * 获取所有曾注册过的客户端列表
 * 返回结果包含通过 WebSocket 实时推导的在线(is_online)状态
 * @route GET /clients
 */
router.get('/clients', (req, res) => {
  db.all(
    `SELECT c.client_id, c.name, 
            strftime('%Y-%m-%dT%H:%M:%SZ', c.created_at) as created_at, 
            strftime('%Y-%m-%dT%H:%M:%SZ', c.last_seen) as last_seen
     FROM clients c
     ORDER BY c.created_at DESC`,
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: '获取客户端列表失败' });
      }

      // 添加实时在线状态
      const clientsWithStatus = rows.map(row => ({
        ...row,
        is_online: isClientOnline(row.client_id)
      }));

      res.json(clientsWithStatus);
    }
  );
});

/**
 * 删除指定的客户端
 * 若该客户端有未完成的作业推送，可能会被外键约束阻止删除
 * @route DELETE /clients/:client_id
 */
router.delete('/clients/:client_id', (req, res) => {
  const { client_id } = req.params;

  // 先检查客户端是否存在
  db.get('SELECT client_id FROM clients WHERE client_id = ?', [client_id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: '查询客户端失败' });
    }
    if (!row) {
      return res.status(404).json({ error: '客户端不存在' });
    }

    // 删除客户端（关联的messages和assignments记录会被级联删除或设置约束）
    db.run('DELETE FROM clients WHERE client_id = ?', [client_id], function (err) {
      if (err) {
        if (err.message.includes('FOREIGN KEY constraint failed')) {
          return res.status(400).json({ error: '该客户端有关联的作业记录，无法删除' });
        }
        return res.status(500).json({ error: '删除客户端失败' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '客户端不存在' });
      }
      res.json({ message: '客户端删除成功' });
    });
  });
});

// ===== 统计信息 =====

/**
 * 仪表盘数据统计接口
 * 通过并发执行的多个 Promise 获取总教师数、总学科数和当前实时的在线客户端数
 * @route GET /stats
 */
router.get('/stats', (req, res) => {
  const stats = {};

  Promise.all([
    // 用户统计
    new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM users WHERE role = ?', ['teacher'], (err, row) => {
        if (err) reject(err);
        else {
          stats.teacherCount = row.count;
          resolve();
        }
      });
    }),
    // 学科统计
    new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM subjects', (err, row) => {
        if (err) reject(err);
        else {
          stats.subjectCount = row.count;
          resolve();
        }
      });
    }),
    // 在线客户端统计（实时连接数）
    new Promise((resolve) => {
      stats.clientCount = getOnlineClients().length;
      resolve();
    }),
    // 作业统计
    new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM assignments', (err, row) => {
        if (err) reject(err);
        else {
          stats.assignmentCount = row.count;
          resolve();
        }
      });
    })
  ])
    .then(() => res.json(stats))
    .catch(err => res.status(500).json({ error: '获取统计数据失败' }));
});

module.exports = router;
