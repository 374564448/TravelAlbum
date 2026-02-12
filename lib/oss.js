const path = require('path');

let client = null;

function getClient() {
  if (client) return client;
  // 延迟加载 ali-oss（避免在未配置 OSS 时导入就报错）
  const OSS = require('ali-oss');
  client = new OSS({
    region: process.env.OSS_REGION,
    accessKeyId: process.env.OSS_ACCESS_KEY_ID,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
    bucket: process.env.OSS_BUCKET,
  });
  return client;
}

/**
 * 上传文件到 OSS
 * @param {Buffer} buffer - 文件内容
 * @param {string} originalName - 原始文件名
 * @param {string} subDir - 子目录（'locations' 或 'details'）
 * @returns {string} 文件的完整 URL
 */
async function uploadToOSS(buffer, originalName, subDir) {
  const oss = getClient();
  const dir = process.env.OSS_DIR || 'travel-album';
  const ext = path.extname(originalName) || '.jpg';
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
  const ossPath = `${dir}/${subDir}/${filename}`;

  const result = await oss.put(ossPath, buffer);
  return result.url;
}

/**
 * 从 OSS 删除文件
 * @param {string} url - 文件完整 URL
 */
async function deleteFromOSS(url) {
  try {
    const oss = getClient();
    // 从 URL 提取 OSS 路径
    const urlObj = new URL(url);
    const ossPath = decodeURIComponent(urlObj.pathname.replace(/^\//, ''));
    await oss.delete(ossPath);
  } catch (e) {
    console.error('OSS 删除失败:', e.message);
  }
}

module.exports = { uploadToOSS, deleteFromOSS };
