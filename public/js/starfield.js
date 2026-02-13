// ===== 公共星空粒子背景（性能优化版） =====
(function () {
  const canvas = document.getElementById('starfield');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let stars = [];
  let animId = null;
  let running = false;

  // 移动端检测，减少粒子数量
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const STAR_COUNT = isMobile ? 80 : 180;

  // 缓存背景径向渐变
  let bgCache = null;

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    bgCache = null; // 尺寸变化后重建缓存
  }

  function cacheBg() {
    bgCache = document.createElement('canvas');
    bgCache.width = canvas.width;
    bgCache.height = canvas.height;
    const bctx = bgCache.getContext('2d');
    const grd = bctx.createRadialGradient(
      canvas.width / 2, canvas.height / 2, 0,
      canvas.width / 2, canvas.height / 2, canvas.width * 0.6
    );
    grd.addColorStop(0, 'rgba(0, 30, 60, 0.15)');
    grd.addColorStop(1, 'rgba(0, 0, 0, 0)');
    bctx.fillStyle = grd;
    bctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function createStars(count) {
    stars = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2 + 0.5,
        speed: Math.random() * 0.3 + 0.05,
        opacity: Math.random() * 0.8 + 0.2,
        twinkleSpeed: Math.random() * 0.02 + 0.005,
        twinklePhase: Math.random() * Math.PI * 2,
        color: Math.random() > 0.7
          ? `hsla(${190 + Math.random() * 30}, 80%, 70%,`
          : `hsla(0, 0%, 100%,`
      });
    }
  }

  function drawStars(time) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!bgCache) cacheBg();
    ctx.drawImage(bgCache, 0, 0);
    const noMotion = reduceMotion;
    stars.forEach(star => {
      const twinkle = noMotion ? 1 : (Math.sin(time * star.twinkleSpeed + star.twinklePhase) * 0.4 + 0.6);
      const alpha = star.opacity * twinkle;

      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fillStyle = star.color + alpha + ')';
      ctx.fill();

      // 较亮的星星加个小光晕（移动端跳过以省性能）
      if (!isMobile && star.size > 1.5) {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size * 3, 0, Math.PI * 2);
        ctx.fillStyle = star.color + (alpha * 0.1) + ')';
        ctx.fill();
      }

      if (!noMotion) {
        star.y -= star.speed;
        star.x += Math.sin(time * 0.001 + star.twinklePhase) * 0.1;
        if (star.y < -5) {
          star.y = canvas.height + 5;
          star.x = Math.random() * canvas.width;
        }
      }
    });
  }

  function animate(time) {
    if (!running) return;
    drawStars(time);
    animId = requestAnimationFrame(animate);
  }

  function start() {
    if (running) return;
    running = true;
    if (reduceMotion) {
      drawStars(0);
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
  createStars(STAR_COUNT);

  // 暴露控制接口，供 theme.js 调用
  window.starfieldAnim = { start, stop };

  window.addEventListener('resize', () => {
    resizeCanvas();
    createStars(STAR_COUNT);
  });
})();
