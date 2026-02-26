const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'data', 'homework.db');

// 确保数据目录存在
const fs = require('fs');
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH);

/**
 * 异步初始化数据库表结构并返回 Promise
 * 包含：users, subjects, clients, assignments, messages 表
 * @returns {Promise<void>} 成功时 resolve，失败时 reject
 */
function initDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // 用户表（管理员和老师）
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin', 'teacher')),
        subject_id INTEGER,
        first_login INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (subject_id) REFERENCES subjects(id)
      )`);

      // 学科表
      db.run(`CREATE TABLE IF NOT EXISTS subjects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        code TEXT UNIQUE NOT NULL,
        color TEXT DEFAULT '#3b82f6',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // 学生/客户端表
      db.run(`CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id TEXT UNIQUE NOT NULL,
        name TEXT,
        last_seen DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // 作业表
      db.run(`CREATE TABLE IF NOT EXISTS assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        teacher_id INTEGER NOT NULL,
        subject_id INTEGER NOT NULL,
        client_id TEXT,
        status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'cancelled')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (teacher_id) REFERENCES users(id),
        FOREIGN KEY (subject_id) REFERENCES subjects(id)
      )`);

      // 消息表（用于实时推送）
      db.run(`CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        assignment_id INTEGER NOT NULL,
        client_id TEXT NOT NULL,
        status TEXT DEFAULT 'unread' CHECK(status IN ('unread', 'read', 'acknowledged')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        read_at DATETIME,
        FOREIGN KEY (assignment_id) REFERENCES assignments(id)
      )`);

      console.log('数据库表初始化完成');
      resolve();
    });
  });
}

/**
 * 数据库迁移：添加 first_login 列到已存在的 users 表
 * 用于兼容旧版本数据库
 * @returns {Promise<void>}
 */
async function migrateDatabase() {
  return new Promise((resolve, reject) => {
    // 检查 users 表是否已存在 first_login 列
    db.all(`PRAGMA table_info(users)`, (err, columns) => {
      if (err) {
        console.error('检查表结构失败:', err);
        reject(err);
        return;
      }
      
      const hasFirstLogin = columns.some((col) => col.name === 'first_login');
      
      if (!hasFirstLogin) {
        // 添加 first_login 列，默认值为 0（已修改过密码）
        db.run(`ALTER TABLE users ADD COLUMN first_login INTEGER DEFAULT 0`, async (err) => {
          if (err) {
            console.error('添加 first_login 列失败:', err);
            reject(err);
            return;
          }
          console.log('数据库迁移完成：已添加 first_login 列');
          
          // 将 admin 用户的 first_login 设为 1（需要修改密码）
          try {
            await new Promise((res, rej) => {
              db.run(`UPDATE users SET first_login = 1 WHERE username = 'admin' AND role = 'admin'`, (err) => {
                if (err) rej(err);
                else res();
              });
            });
            console.log('已标记 admin 用户为首次登录状态');
          } catch (e) {
            console.error('设置 admin 首次登录状态失败:', e);
          }
          
          resolve();
        });
      } else {
        resolve();
      }
    });
  });
}

/**
 * 检查并创建内置默认超级管理员账户 (admin/admin)
 * 该方法具备幂等性，已存在则忽略
 * @returns {Promise<void>}
 */
async function createDefaultAdmin() {
  return new Promise((resolve, reject) => {
    const defaultPassword = bcrypt.hashSync('admin', 10);
    db.run(
      `INSERT OR IGNORE INTO users (username, password, name, role, first_login) VALUES (?, ?, ?, ?, ?)`,
      ['admin', defaultPassword, '系统管理员', 'admin', 1],
      function (err) {
        if (err) {
          console.error('创建默认管理员失败:', err);
          reject(err);
        } else {
          if (this.changes > 0) {
            console.log('默认管理员账户创建成功 (用户名: admin, 密码: admin)');
          }
          resolve();
        }
      }
    );
  });
}

/**
 * 检查并静态初始化九大基础学科信息
 * 由于外键约束依赖，通常在系统首次部署时运行
 * @returns {Promise<void>}
 */
async function createDefaultSubjects() {
  // 先检查学科表是否已有数据
  const count = await new Promise((resolve, reject) => {
    db.get(`SELECT COUNT(*) as count FROM subjects`, (err, row) => {
      if (err) reject(err);
      else resolve(row.count);
    });
  });

  // 如果学科表已有数据，则不再插入
  if (count > 0) {
    console.log('学科表已有数据，跳过默认学科创建');
    return;
  }

  const subjects = [
    { name: '语文', code: 'chinese', color: '#ef4444' },
    { name: '数学', code: 'math', color: '#3b82f6' },
    { name: '英语', code: 'english', color: '#8b5cf6' },
    { name: '物理', code: 'physics', color: '#06b6d4' },
    { name: '化学', code: 'chemistry', color: '#10b981' },
    { name: '生物', code: 'biology', color: '#22c55e' },
    { name: '历史', code: 'history', color: '#f59e0b' },
    { name: '地理', code: 'geography', color: '#84cc16' },
    { name: '政治', code: 'politics', color: '#ec4899' }
  ];

  for (const subject of subjects) {
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO subjects (name, code, color) VALUES (?, ?, ?)`,
        [subject.name, subject.code, subject.color],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }
  console.log('默认学科创建完成');
}

module.exports = {
  db,
  initDatabase,
  migrateDatabase,
  createDefaultAdmin,
  createDefaultSubjects
};
