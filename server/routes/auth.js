const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../database');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

/**
 * 用户登录接口
 * 验证接收到的用户名和密码，若成功则签发并返回 JWT 令牌及其携带的基础信息
 * @route POST /login
 */
router.post('/login', (req, res) => {
  const { username, password, autoLogin } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: '请提供用户名和密码' });
  }

  db.get(
    `SELECT u.*, s.name as subject_name, s.color as subject_color
     FROM users u
     LEFT JOIN subjects s ON u.subject_id = s.id
     WHERE u.username = ?`,
    [username],
    (err, user) => {
      if (err) {
        return res.status(500).json({ error: '服务器错误' });
      }

      if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ error: '用户名或密码错误' });
      }

      const tokenExpiresIn = autoLogin ? '7d' : '24h';

      const token = jwt.sign(
        {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
          subject_id: user.subject_id,
          subject_name: user.subject_name,
          subject_color: user.subject_color
        },
        JWT_SECRET,
        { expiresIn: tokenExpiresIn }
      );

      res.json({
        token,
        autoLogin: !!autoLogin,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
          first_login: user.first_login === 1,
          subject: user.subject_name ? {
            id: user.subject_id,
            name: user.subject_name,
            color: user.subject_color
          } : null
        }
      });
    }
  );
});

/**
 * 获取当前已登录用户信息接口
 * 核心逻辑为提取并解码 Authorization 请求头中的 JWT 令牌
 * @route GET /me
 */
router.get('/me', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '未提供访问令牌' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: '令牌无效' });
    }
    res.json({ user });
  });
});

/**
 * 修改当前用户密码接口
 * 验证访问令牌有效性后，比对旧密码并在匹配成功时执行新密码的哈希更新
 * @route POST /change-password
 */
/**
 * 修改当前用户密码接口
 * 验证访问令牌有效性后，比对旧密码并在匹配成功时执行新密码的哈希更新
 * 如果是首次登录修改密码，将 first_login 重置为 0
 * @route POST /change-password
 */
router.post('/change-password', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '未提供访问令牌' });
  }

  const { oldPassword, newPassword, isFirstLogin } = req.body;

  if (!newPassword) {
    return res.status(400).json({ error: '请提供新密码' });
  }

  // 首次登录修改密码时不需要旧密码
  if (!isFirstLogin && !oldPassword) {
    return res.status(400).json({ error: '请提供旧密码和新密码' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: '令牌无效' });
    }

    db.get('SELECT * FROM users WHERE id = ?', [user.id], (err, dbUser) => {
      if (err || !dbUser) {
        return res.status(500).json({ error: '服务器错误' });
      }

      // 非首次登录修改时需要验证旧密码
      if (!isFirstLogin && !bcrypt.compareSync(oldPassword, dbUser.password)) {
        return res.status(401).json({ error: '旧密码错误' });
      }

      const hashedPassword = bcrypt.hashSync(newPassword, 10);
      
      // 如果是首次登录，同时重置 first_login 字段
      const updateSql = isFirstLogin
        ? 'UPDATE users SET password = ?, first_login = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        : 'UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
      
      db.run(
        updateSql,
        [hashedPassword, user.id],
        (err) => {
          if (err) {
            return res.status(500).json({ error: '修改密码失败' });
          }
          res.json({ message: '密码修改成功', first_login_reset: !!isFirstLogin });
        }
      );
    });
  });
});

module.exports = router;
