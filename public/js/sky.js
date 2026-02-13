// ===== 公共蓝天白云背景（性能优化版） =====
(function () {
  const canvas = document.getElementById('skyfield');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let clouds = [];
  let animId = null;
  let running = false;

  // 移动端检测，减少云朵数量
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CLOUD_COUNT = isMobile ? 6 : 12;

  // 缓存：天空背景 + 云朵 puff 模板
  let skyCache = null;
  let puffCache = null;
  const PUFF_SIZE = 128;

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    skyCache = null; // 尺寸变化后重建缓存
  }

  // 预渲染云朵 puff 模板（一次性，后续用 drawImage 替代每帧创建渐变）
  function createPuffCache() {
    puffCache = document.createElement('canvas');
    puffCache.width = PUFF_SIZE * 2;
    puffCache.height = PUFF_SIZE * 2;
    const pctx = puffCache.getContext('2d');
    const grad = pctx.createRadialGradient(PUFF_SIZE, PUFF_SIZE, 0, PUFF_SIZE, PUFF_SIZE, PUFF_SIZE);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    grad.addColorStop(0.6, 'rgba(255, 255, 255, 0.6)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    pctx.fillStyle = grad;
    pctx.beginPath();
    pctx.arc(PUFF_SIZE, PUFF_SIZE, PUFF_SIZE, 0, Math.PI * 2);
    pctx.fill();
  }

  // 缓存天空背景（渐变 + 太阳光晕，静态不变）
  function cacheSky() {
    const w = canvas.width;
    const h = canvas.height;
    skyCache = document.createElement('canvas');
    skyCache.width = w;
    skyCache.height = h;
    const sctx = skyCache.getContext('2d');

    const skyGrad = sctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, '#4A90D9');
    skyGrad.addColorStop(0.4, '#87CEEB');
    skyGrad.addColorStop(0.75, '#B8DEF0');
    skyGrad.addColorStop(1, '#E8F4F8');
    sctx.fillStyle = skyGrad;
    sctx.fillRect(0, 0, w, h);

    const sunX = w * 0.8;
    const sunY = h * 0.15;
    const sunGrad = sctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 200);
    sunGrad.addColorStop(0, 'rgba(255, 255, 240, 0.6)');
    sunGrad.addColorStop(0.3, 'rgba(255, 248, 220, 0.2)');
    sunGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    sctx.fillStyle = sunGrad;
    sctx.fillRect(0, 0, w, h);
  }

  function createCloud() {
    const w = canvas.width;
    const h = canvas.height;
    const baseR = 25 + Math.random() * 35;
    const puffCount = 4 + Math.floor(Math.random() * 4);
    const puffs = [];

    for (let i = 0; i < puffCount; i++) {
      puffs.push({
        ox: (i - puffCount / 2) * baseR * 0.7 + (Math.random() - 0.5) * baseR * 0.4,
        oy: (Math.random() - 0.5) * baseR * 0.5,
        r: baseR * (0.6 + Math.random() * 0.5)
      });
    }

    return {
      x: -200 + Math.random() * (w + 400),
      y: Math.random() * h * 0.65,
      speed: 0.15 + Math.random() * 0.3,
      opacity: 0.5 + Math.random() * 0.4,
      puffs: puffs,
      scale: 0.7 + Math.random() * 0.8
    };
  }

  function createClouds(count) {
    clouds = [];
    for (let i = 0; i < count; i++) {
      clouds.push(createCloud());
    }
  }

  function drawClouds() {
    clouds.forEach(cloud => {
      ctx.save();
      ctx.translate(cloud.x, cloud.y);
      ctx.scale(cloud.scale, cloud.scale);
      ctx.globalAlpha = cloud.opacity;

      // 用预渲染的 puff 模板代替每帧创建渐变
      cloud.puffs.forEach(puff => {
        const size = puff.r * 2;
        ctx.drawImage(puffCache, puff.ox - puff.r, puff.oy - puff.r, size, size);
      });

      ctx.restore();

      if (!reduceMotion) {
        cloud.x += cloud.speed;
        if (cloud.x > canvas.width + 250) {
          cloud.x = -250;
          cloud.y = Math.random() * canvas.height * 0.65;
        }
      }
    });
  }

  function animate() {
    if (!running) return;
    if (!skyCache) cacheSky();
    ctx.drawImage(skyCache, 0, 0);
    drawClouds();
    animId = requestAnimationFrame(animate);
  }

  function start() {
    if (running) return;
    running = true;
    if (reduceMotion) {
      if (!skyCache) cacheSky();
      ctx.drawImage(skyCache, 0, 0);
      drawClouds();
      return;
    }
    animId = requestAnimationFrame(animate);
  }

  function stop() {
    running = false;
    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }
  }

  resizeCanvas();
  createPuffCache();
  createClouds(CLOUD_COUNT);

  // 暴露控制接口，供 theme.js 调用
  window.skyfieldAnim = { start, stop };

  window.addEventListener('resize', () => {
    resizeCanvas();
    skyCache = null;
    createClouds(CLOUD_COUNT);
  });
})();
