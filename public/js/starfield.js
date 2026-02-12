// ===== 公共星空粒子背景 =====
(function () {
  const canvas = document.getElementById('starfield');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let stars = [];

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
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

    // 微弱的径向渐变背景光
    const grd = ctx.createRadialGradient(
      canvas.width / 2, canvas.height / 2, 0,
      canvas.width / 2, canvas.height / 2, canvas.width * 0.6
    );
    grd.addColorStop(0, 'rgba(0, 30, 60, 0.15)');
    grd.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    stars.forEach(star => {
      const twinkle = Math.sin(time * star.twinkleSpeed + star.twinklePhase) * 0.4 + 0.6;
      const alpha = star.opacity * twinkle;

      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fillStyle = star.color + alpha + ')';
      ctx.fill();

      // 较亮的星星加个小光晕
      if (star.size > 1.5) {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size * 3, 0, Math.PI * 2);
        ctx.fillStyle = star.color + (alpha * 0.1) + ')';
        ctx.fill();
      }

      // 缓慢漂浮
      star.y -= star.speed;
      star.x += Math.sin(time * 0.001 + star.twinklePhase) * 0.1;

      if (star.y < -5) {
        star.y = canvas.height + 5;
        star.x = Math.random() * canvas.width;
      }
    });
  }

  function animateStars(time) {
    drawStars(time);
    requestAnimationFrame(animateStars);
  }

  resizeCanvas();
  createStars(180);
  animateStars(0);

  window.addEventListener('resize', () => {
    resizeCanvas();
    createStars(180);
  });
})();
