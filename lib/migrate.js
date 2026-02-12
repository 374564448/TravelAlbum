const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./db');

/**
 * 数据迁移：初始化管理员账号 + 导入 locations.json
 */
function migrate() {
  // ===== 初始化管理员账号 =====
  const adminCount = db.getAdminCount();
  if (adminCount === 0) {
    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'admin123';
    const hash = bcrypt.hashSync(password, 10);
    db.createAdmin(username, hash);
    console.log(`管理员账号已初始化：${username}`);
  } else {
    console.log(`管理员账号已存在，跳过初始化`);
  }

  // ===== 导入地点数据 =====
  const count = db.getLocationCount();
  if (count > 0) {
    console.log(`数据库已有 ${count} 条地点数据，跳过迁移`);
    return;
  }

  const jsonPath = path.join(__dirname, '..', 'data', 'locations.json');
  if (!fs.existsSync(jsonPath)) {
    console.log('未找到 locations.json，跳过迁移');
    return;
  }

  console.log('开始数据迁移：从 locations.json 导入 SQLite ...');

  try {
    const raw = fs.readFileSync(jsonPath, 'utf-8');
    const data = JSON.parse(raw);

    if (!Array.isArray(data) || data.length === 0) {
      console.log('locations.json 数据为空，跳过迁移');
      return;
    }

    // 使用事务导入
    const insertLocation = db.db.prepare(
      'INSERT INTO locations (title, cover, sort_order) VALUES (?, ?, ?)'
    );
    const insertPhoto = db.db.prepare(
      'INSERT INTO photos (location_id, url, title, desc, sort_order) VALUES (?, ?, ?, ?, ?)'
    );

    const tx = db.db.transaction((items) => {
      items.forEach((item, idx) => {
        const info = insertLocation.run(item.title || '未命名', item.src || '', idx);
        const locationId = info.lastInsertRowid;

        if (Array.isArray(item.details)) {
          item.details.forEach((detail, dIdx) => {
            insertPhoto.run(
              locationId,
              detail.src || '',
              detail.title || '',
              detail.desc || '',
              dIdx
            );
          });
        }
      });
    });

    tx(data);
    console.log(`数据迁移完成：导入 ${data.length} 个地点`);
  } catch (e) {
    console.error('数据迁移失败:', e.message);
  }
}

module.exports = migrate;
