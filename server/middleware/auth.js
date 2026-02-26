const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'zyzi*Q=wkpHkK=^}}U948~5WYq]hZ}';

/**
 * Express 权限拦截中间件：验证请求头部中的 JWT 令牌
 * 验证失败则拦截并返回 401/403 错误，成功则在 req.user 中注入解析后的用户信息供下游路由使用
 * @param {Object} req 
 * @param {Object} res 
 * @param {Function} next 
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '未提供访问令牌' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: '令牌无效或已过期' });
    }
    req.user = user;
    next();
  });
}

/**
 * Express 角色校验中间件：验证当前已登录用户是否为系统管理员
 * 依赖于 authenticateToken 注入的 req.user 对象
 * @param {Object} req 
 * @param {Object} res 
 * @param {Function} next 
 */
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '需要管理员权限' });
  }
  next();
}

/**
 * Express 角色校验中间件：验证当前已登录用户是否具有教师(或以上)权限
 * @param {Object} req 
 * @param {Object} res 
 * @param {Function} next 
 */
function requireTeacher(req, res, next) {
  if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
    return res.status(403).json({ error: '需要教师权限' });
  }
  next();
}

module.exports = {
  authenticateToken,
  requireAdmin,
  requireTeacher,
  JWT_SECRET
};
