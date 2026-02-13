const express = require('express');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { signToken, authMiddleware } = require('../middleware/auth');
const db = require('../lib/db');
const { uploadToOSS, deleteFromOSS } = require('../lib/oss');

// multer 内存存储（上传后直接推到 OSS）
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ===== 登录 =====
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: '请输入账号和密码' });

  const admin = db.getAdminByUsername(username);
  if (!admin) {
    return res.status(401).json({ error: '账号或密码错误' });
  }

  const match = bcrypt.compareSync(password, admin.password_hash);
  if (!match) {
    return res.status(401).json({ error: '账号或密码错误' });
  }

  const token = signToken();
  res.json({ token });
});

// ===== 以下接口均需鉴权 =====
router.use(authMiddleware);

// ===== 修改密码 =====
router.put('/change-password', (req, res) => {
  const { username, oldPassword, newPassword } = req.body;
  if (!username || !oldPassword || !newPassword) {
    return res.status(400).json({ error: '请填写完整信息' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: '新密码长度不能少于 6 位' });
  }

  const admin = db.getAdminByUsername(username);
  if (!admin) {
    return res.status(400).json({ error: '账号不存在' });
  }

  const match = bcrypt.compareSync(oldPassword, admin.password_hash);
  if (!match) {
    return res.status(400).json({ error: '当前密码错误' });
  }

  const newHash = bcrypt.hashSync(newPassword, 10);
  db.updateAdminPassword(username, newHash);
  res.json({ message: '密码修改成功' });
});

// ===== 地点列表 =====
router.get('/locations', (req, res) => {
  const locations = db.getAllLocations();
  res.json(locations);
});

// ===== 地点排序（必须在 :id 参数路由之前） =====
router.put('/locations/sort', (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ error: '参数错误' });
  db.updateLocationSort(ids);
  res.json({ message: '排序更新成功' });
});

// ===== 照片排序（必须在 :id 参数路由之前） =====
router.put('/photos/sort', (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ error: '参数错误' });
  db.updatePhotoSort(ids);
  res.json({ message: '排序更新成功' });
});

// ===== 新增地点 =====
router.post('/locations', upload.single('cover'), async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: '标题不能为空' });

    let coverUrl = '';
    if (req.file) {
      coverUrl = await uploadToOSS(req.file.buffer, req.file.originalname, 'locations');
    }

    const id = db.createLocation(title, coverUrl);
    res.json({ id, message: '创建成功' });
  } catch (e) {
    console.error('新增地点失败:', e);
    res.status(500).json({ error: '创建失败: ' + e.message });
  }
});

// ===== 编辑地点 =====
router.put('/locations/:id', upload.single('cover'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const loc = db.getLocation(id);
    if (!loc) return res.status(404).json({ error: '地点不存在' });

    const fields = {};
    if (req.body.title !== undefined) fields.title = req.body.title;

    if (req.file) {
      fields.cover = await uploadToOSS(req.file.buffer, req.file.originalname, 'locations');
      // 删除旧封面（如果是 OSS URL）
      if (loc.cover && loc.cover.startsWith('http')) {
        deleteFromOSS(loc.cover).catch(() => {});
      }
    }

    db.updateLocation(id, fields);
    res.json({ message: '更新成功' });
  } catch (e) {
    console.error('编辑地点失败:', e);
    res.status(500).json({ error: '更新失败: ' + e.message });
  }
});

// ===== 删除地点 =====
router.delete('/locations/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const loc = db.getLocation(id);
    if (!loc) return res.status(404).json({ error: '地点不存在' });

    // 删除该地点的所有照片（OSS）
    const photos = db.getPhotos(id);
    for (const p of photos) {
      if (p.url && p.url.startsWith('http')) {
        deleteFromOSS(p.url).catch(() => {});
      }
    }
    // 删除封面
    if (loc.cover && loc.cover.startsWith('http')) {
      deleteFromOSS(loc.cover).catch(() => {});
    }

    db.deleteLocation(id);
    res.json({ message: '删除成功' });
  } catch (e) {
    console.error('删除地点失败:', e);
    res.status(500).json({ error: '删除失败: ' + e.message });
  }
});

// ===== 某地点的照片列表 =====
router.get('/locations/:id/photos', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const photos = db.getPhotos(id);
  res.json(photos);
});

// ===== 上传照片（支持多张） =====
router.post('/locations/:id/photos', upload.array('photos', 50), async (req, res) => {
  try {
    const locationId = parseInt(req.params.id, 10);
    const loc = db.getLocation(locationId);
    if (!loc) return res.status(404).json({ error: '地点不存在' });

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: '请选择照片' });
    }

    const results = [];
    for (const file of req.files) {
      const url = await uploadToOSS(file.buffer, file.originalname, 'details');
      const photoId = db.createPhoto(locationId, url, '', '');
      results.push({ id: photoId, url });
    }

    res.json({ message: `成功上传 ${results.length} 张照片`, photos: results });
  } catch (e) {
    console.error('上传照片失败:', e);
    res.status(500).json({ error: '上传失败: ' + e.message });
  }
});

// ===== 编辑照片 =====
router.put('/photos/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const fields = {};
  if (req.body.title !== undefined) fields.title = req.body.title;
  if (req.body.desc !== undefined) fields.desc = req.body.desc;
  db.updatePhoto(id, fields);
  res.json({ message: '更新成功' });
});

// ===== 删除照片 =====
router.delete('/photos/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    // 查找照片 URL 用于删除 OSS 文件
    const photo = db.db.prepare('SELECT * FROM photos WHERE id = ?').get(id);
    if (photo && photo.url && photo.url.startsWith('http')) {
      deleteFromOSS(photo.url).catch(() => {});
    }
    db.deletePhoto(id);
    res.json({ message: '删除成功' });
  } catch (e) {
    console.error('删除照片失败:', e);
    res.status(500).json({ error: '删除失败: ' + e.message });
  }
});

module.exports = router;
