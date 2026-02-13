const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const db = require('../lib/db');

function etagFor(body) {
  const str = typeof body === 'string' ? body : JSON.stringify(body);
  return '"' + crypto.createHash('md5').update(str, 'utf8').digest('hex') + '"';
}

// ===== 获取所有地点（与旧 JSON 格式一致） =====
router.get('/locations', (req, res) => {
  try {
    const data = db.getLocationsForPublic();
    const etag = etagFor(data);
    res.set('Cache-Control', 'public, max-age=60');
    if (req.get('If-None-Match') === etag) {
      return res.status(304).end();
    }
    res.set('ETag', etag);
    res.json(data);
  } catch (e) {
    console.error('查询地点失败:', e);
    res.status(500).json({ error: '数据加载失败' });
  }
});

// ===== 获取单个地点（按索引，与旧接口兼容） =====
router.get('/locations/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: '参数错误' });
    const data = db.getLocationForPublic(id);
    if (!data) return res.status(404).json({ error: '地点不存在' });
    const etag = etagFor(data);
    res.set('Cache-Control', 'public, max-age=60');
    if (req.get('If-None-Match') === etag) {
      return res.status(304).end();
    }
    res.set('ETag', etag);
    res.json(data);
  } catch (e) {
    console.error('查询地点失败:', e);
    res.status(500).json({ error: '数据加载失败' });
  }
});

module.exports = router;
