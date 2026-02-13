const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'travel.db');

// 确保 data 目录存在
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// 开启 WAL 模式（提高并发性能）
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ===== 建表 =====
db.exec(`
  CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    cover TEXT NOT NULL DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    location_id INTEGER NOT NULL,
    url TEXT NOT NULL,
    title TEXT DEFAULT '',
    desc TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
  );
`);

// ===== 管理员函数 =====

function getAdminByUsername(username) {
  return db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
}

function getAdminCount() {
  return db.prepare('SELECT COUNT(*) as count FROM admins').get().count;
}

function createAdmin(username, passwordHash) {
  const info = db.prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)').run(username, passwordHash);
  return info.lastInsertRowid;
}

function updateAdminPassword(username, newPasswordHash) {
  db.prepare('UPDATE admins SET password_hash = ? WHERE username = ?').run(newPasswordHash, username);
}

// ===== 工具函数 =====

// 获取所有地点（含照片数量）
function getAllLocations() {
  return db.prepare(`
    SELECT l.*, COUNT(p.id) as photo_count
    FROM locations l
    LEFT JOIN photos p ON p.location_id = l.id
    GROUP BY l.id
    ORDER BY l.sort_order ASC, l.id ASC
  `).all();
}

// 获取单个地点
function getLocation(id) {
  return db.prepare('SELECT * FROM locations WHERE id = ?').get(id);
}

// 获取地点的所有照片
function getPhotos(locationId) {
  return db.prepare(
    'SELECT * FROM photos WHERE location_id = ? ORDER BY sort_order ASC, id ASC'
  ).all(locationId);
}

// 新增地点
function createLocation(title, cover) {
  const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM locations').get();
  const order = (maxOrder && maxOrder.m != null) ? maxOrder.m + 1 : 0;
  const info = db.prepare('INSERT INTO locations (title, cover, sort_order) VALUES (?, ?, ?)').run(title, cover, order);
  return info.lastInsertRowid;
}

// 更新地点
function updateLocation(id, fields) {
  const sets = [];
  const values = [];
  if (fields.title !== undefined) { sets.push('title = ?'); values.push(fields.title); }
  if (fields.cover !== undefined) { sets.push('cover = ?'); values.push(fields.cover); }
  if (fields.sort_order !== undefined) { sets.push('sort_order = ?'); values.push(fields.sort_order); }
  if (sets.length === 0) return;
  values.push(id);
  db.prepare(`UPDATE locations SET ${sets.join(', ')} WHERE id = ?`).run(...values);
}

// 删除地点（级联删除照片）
function deleteLocation(id) {
  db.prepare('DELETE FROM locations WHERE id = ?').run(id);
}

// 新增照片
function createPhoto(locationId, url, title, desc) {
  const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM photos WHERE location_id = ?').get(locationId);
  const order = (maxOrder && maxOrder.m != null) ? maxOrder.m + 1 : 0;
  const info = db.prepare(
    'INSERT INTO photos (location_id, url, title, desc, sort_order) VALUES (?, ?, ?, ?, ?)'
  ).run(locationId, url, title || '', desc || '', order);
  return info.lastInsertRowid;
}

// 更新照片
function updatePhoto(id, fields) {
  const sets = [];
  const values = [];
  if (fields.title !== undefined) { sets.push('title = ?'); values.push(fields.title); }
  if (fields.desc !== undefined) { sets.push('desc = ?'); values.push(fields.desc); }
  if (fields.url !== undefined) { sets.push('url = ?'); values.push(fields.url); }
  if (fields.sort_order !== undefined) { sets.push('sort_order = ?'); values.push(fields.sort_order); }
  if (sets.length === 0) return;
  values.push(id);
  db.prepare(`UPDATE photos SET ${sets.join(', ')} WHERE id = ?`).run(...values);
}

// 删除照片
function deletePhoto(id) {
  db.prepare('DELETE FROM photos WHERE id = ?').run(id);
}

// 获取某地点下所有照片的 id 列表（用于排序校验）
function getPhotoIdsByLocation(locationId) {
  const rows = db.prepare('SELECT id FROM photos WHERE location_id = ?').all(locationId);
  return rows.map((r) => r.id);
}

// 批量更新排序
function updateLocationSort(orderedIds) {
  const stmt = db.prepare('UPDATE locations SET sort_order = ? WHERE id = ?');
  const tx = db.transaction((ids) => {
    ids.forEach((id, index) => stmt.run(index, id));
  });
  tx(orderedIds);
}

function updatePhotoSort(orderedIds) {
  const stmt = db.prepare('UPDATE photos SET sort_order = ? WHERE id = ?');
  const tx = db.transaction((ids) => {
    ids.forEach((id, index) => stmt.run(index, id));
  });
  tx(orderedIds);
}

// 获取地点总数
function getLocationCount() {
  return db.prepare('SELECT COUNT(*) as count FROM locations').get().count;
}

// 用于公开 API：组装与旧 JSON 格式一致的数据
function getLocationsForPublic() {
  const locations = db.prepare('SELECT * FROM locations ORDER BY sort_order ASC, id ASC').all();
  return locations.map(loc => {
    const photos = db.prepare(
      'SELECT url, title, desc FROM photos WHERE location_id = ? ORDER BY sort_order ASC, id ASC'
    ).all(loc.id);
    return {
      src: loc.cover,
      title: loc.title,
      details: photos.map(p => {
        const obj = { src: p.url };
        if (p.title) obj.title = p.title;
        if (p.desc) obj.desc = p.desc;
        return obj;
      })
    };
  });
}

function getLocationForPublic(index) {
  const locations = db.prepare('SELECT * FROM locations ORDER BY sort_order ASC, id ASC').all();
  if (index < 0 || index >= locations.length) return null;
  const loc = locations[index];
  const photos = db.prepare(
    'SELECT url, title, desc FROM photos WHERE location_id = ? ORDER BY sort_order ASC, id ASC'
  ).all(loc.id);
  return {
    src: loc.cover,
    title: loc.title,
    details: photos.map(p => {
      const obj = { src: p.url };
      if (p.title) obj.title = p.title;
      if (p.desc) obj.desc = p.desc;
      return obj;
    })
  };
}

module.exports = {
  db,
  getAdminByUsername,
  getAdminCount,
  createAdmin,
  updateAdminPassword,
  getAllLocations,
  getLocation,
  getPhotos,
  createLocation,
  updateLocation,
  deleteLocation,
  createPhoto,
  updatePhoto,
  deletePhoto,
  getPhotoIdsByLocation,
  updateLocationSort,
  updatePhotoSort,
  getLocationCount,
  getLocationsForPublic,
  getLocationForPublic,
};
