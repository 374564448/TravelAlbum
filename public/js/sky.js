// ===== 公共蓝天白云背景 =====
(function () {
  const canvas = document.getElementById('skyfield');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let clouds = [];

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  // 生成一朵云（由多个重叠圆组成）
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

  function drawSky() {
    const w = canvas.width;
    const h = canvas.height;

    // 天空渐变：顶部深蓝 → 中间浅蓝 → 底部淡白
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, '#4A90D9');
    skyGrad.addColorStop(0.4, '#87CEEB');
    skyGrad.addColorStop(0.75, '#B8DEF0');
    skyGrad.addColorStop(1, '#E8F4F8');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // 太阳光晕
    const sunX = w * 0.8;
    const sunY = h * 0.15;
    const sunGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 200);
    sunGrad.addColorStop(0, 'rgba(255, 255, 240, 0.6)');
    sunGrad.addColorStop(0.3, 'rgba(255, 248, 220, 0.2)');
    sunGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = sunGrad;
    ctx.fillRect(0, 0, w, h);
  }

  function drawClouds() {
    clouds.forEach(cloud => {
      ctx.save();
      ctx.translate(cloud.x, cloud.y);
      ctx.scale(cloud.scale, cloud.scale);
      ctx.globalAlpha = cloud.opacity;

      cloud.puffs.forEach(puff => {
        const grad = ctx.createRadialGradient(puff.ox, puff.oy, 0, puff.ox, puff.oy, puff.r);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
        grad.addColorStop(0.6, 'rgba(255, 255, 255, 0.6)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(puff.ox, puff.oy, puff.r, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.restore();

      // 云朵向右漂浮
      cloud.x += cloud.speed;
      if (cloud.x > canvas.width + 250) {
        cloud.x = -250;
        cloud.y = Math.random() * canvas.height * 0.65;
      }
    });
  }

  function animate() {
    drawSky();
    drawClouds();
    requestAnimationFrame(animate);
  }

  resizeCanvas();
  createClouds(12);
  animate();

  window.addEventListener('resize', () => {
    resizeCanvas();
    createClouds(12);
  });
})();
