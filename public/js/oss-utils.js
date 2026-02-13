// ===== OSS 图片处理工具 =====
// 阿里云 OSS 支持在 URL 后追加图片处理参数，无需额外费用

/**
 * 生成 OSS 缩略图 URL
 * @param {string} url - 原始 OSS URL
 * @param {number} height - 目标高度（px），默认 500
 * @returns {string} 带处理参数的 URL
 */
function ossThumb(url, height) {
  if (!url || !url.includes('aliyuncs.com')) return url;
  height = height || 500;
  var sep = url.includes('?') ? '&' : '?';
  return url + sep + 'x-oss-process=image/resize,h_' + height + '/format,webp/quality,q_80';
}

/**
 * 动态添加 preconnect 到 OSS 域名（加速首次连接）
 * @param {string} url - 任意 OSS 图片 URL
 */
function ossPreconnect(url) {
  if (!url || !url.includes('aliyuncs.com')) return;
  try {
    var origin = new URL(url).origin;
    // 避免重复添加
    if (document.querySelector('link[rel="preconnect"][href="' + origin + '"]')) return;
    var link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = origin;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
    // 同时添加 dns-prefetch 作为回退
    var dns = document.createElement('link');
    dns.rel = 'dns-prefetch';
    dns.href = origin;
    document.head.appendChild(dns);
  } catch (e) { /* ignore */ }
}
