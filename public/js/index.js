// ===== 页面加载渐入 =====
window.addEventListener('load', () => {
  const starfield = document.getElementById('starfield');
  const skyfield = document.getElementById('skyfield');
  if (starfield) starfield.classList.add('loaded');
  if (skyfield) skyfield.classList.add('loaded');
  document.getElementById('mainContainer').classList.add('loaded');

  // 提示文字逐字显现（页面加载 2.5 秒后开始，每字间隔 150ms）
  const chars = document.querySelectorAll('.hint-char');
  chars.forEach((ch, i) => {
    setTimeout(() => ch.classList.add('show'), 2500 + i * 150);
  });
});

// ===== 1. 鼠标跟随光晕 =====
const cursorGlow = document.getElementById('cursorGlow');
let mouseX = 0, mouseY = 0;

document.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
  if (cursorGlow) {
    cursorGlow.style.left = mouseX + 'px';
    cursorGlow.style.top = mouseY + 'px';
    if (!cursorGlow.classList.contains('visible')) {
      cursorGlow.classList.add('visible');
    }
  }
});

// ===== 3. 悬停区域交互增强 =====
(function () {
  const tapArea = document.getElementById('tapArea');
  if (!tapArea) return;

  tapArea.addEventListener('mouseenter', () => {
    tapArea.classList.add('hover-active');
  });
  tapArea.addEventListener('mouseleave', () => {
    tapArea.classList.remove('hover-active');
  });
})();

// ===== 4. 偶发流星效果（仅夜间主题） =====
(function () {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  function createShootingStar() {
    // 仅夜间主题下显示
    if (document.body.classList.contains('theme-day')) return;

    const star = document.createElement('div');
    star.className = 'shooting-star';

    // 随机起点（右上方区域）
    const startX = Math.random() * window.innerWidth * 0.7 + window.innerWidth * 0.2;
    const startY = Math.random() * window.innerHeight * 0.3;

    star.style.left = startX + 'px';
    star.style.top = startY + 'px';

    // 随机角度（30°~60°向左下方）
    const angle = 30 + Math.random() * 30;
    const rad = angle * Math.PI / 180;
    const distance = 200 + Math.random() * 300;
    const dx = -Math.cos(rad) * distance;
    const dy = Math.sin(rad) * distance;

    star.style.transform = `rotate(${180 + angle}deg)`;

    document.body.appendChild(star);

    star.animate([
      { transform: `translate(0, 0) rotate(${180 + angle}deg)`, opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) rotate(${180 + angle}deg)`, opacity: 0 }
    ], {
      duration: 600 + Math.random() * 400,
      easing: 'ease-out',
      fill: 'forwards'
    });

    setTimeout(() => star.remove(), 1200);
  }

  // 移动端降低流星频率（8~15秒），PC 端（3~8秒）
  function scheduleNext() {
    const delay = isMobile
      ? 8000 + Math.random() * 7000
      : 3000 + Math.random() * 5000;
    setTimeout(() => {
      createShootingStar();
      scheduleNext();
    }, delay);
  }

  // 页面加载后延迟开始
  setTimeout(scheduleNext, isMobile ? 5000 : 3000);
})();

// ===== 5. 手指图标磁吸倾斜 =====
(function () {
  const handIcon = document.getElementById('handIcon');
  const tapArea = document.getElementById('tapArea');
  if (!handIcon || !tapArea) return;

  tapArea.addEventListener('mousemove', (e) => {
    const rect = tapArea.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    // 最大倾斜 12 度
    const maxTilt = 12;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxDist = rect.width / 2;
    const ratio = Math.min(dist / maxDist, 1);
    const tiltX = (dy / maxDist) * maxTilt * ratio;
    const tiltY = -(dx / maxDist) * maxTilt * ratio;
    handIcon.style.transform = `rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
  });

  tapArea.addEventListener('mouseleave', () => {
    handIcon.style.transform = '';
  });
})();

// ===== 点击过渡效果（仅限热区） =====
let clicked = false;

document.getElementById('tapHitzone').addEventListener('click', (e) => {
  if (clicked) return;
  clicked = true;

  const mainContainer = document.getElementById('mainContainer');
  const overlay = document.getElementById('pageOverlay');

  // 粒子爆炸效果
  createExplosion(e.clientX, e.clientY);

  // 主内容淡出
  mainContainer.classList.add('fade-out');

  // 遮罩渐入变黑
  setTimeout(() => {
    overlay.classList.add('active');
  }, 200);

  // 遮罩完全变黑后跳转
  overlay.addEventListener('transitionend', () => {
    window.location.href = 'location.html';
  }, { once: true });
});

// ===== 粒子爆炸 =====
function createExplosion(x, y) {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const colors = [
    'rgba(0, 195, 255, 0.9)',
    'rgba(100, 220, 255, 0.8)',
    'rgba(0, 150, 255, 0.7)',
    'rgba(180, 240, 255, 0.8)',
    'rgba(255, 255, 255, 0.6)'
  ];

  // 移动端减少粒子数（30 → 15）
  const count = isMobile ? 15 : 30;
  for (let i = 0; i < count; i++) {
    const particle = document.createElement('div');
    particle.className = 'explosion-particle';

    const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
    const velocity = 80 + Math.random() * 180;
    const size = 2 + Math.random() * 4;

    particle.style.width = size + 'px';
    particle.style.height = size + 'px';
    particle.style.left = x + 'px';
    particle.style.top = y + 'px';
    particle.style.background = colors[Math.floor(Math.random() * colors.length)];
    particle.style.boxShadow = `0 0 ${size * 2}px ${colors[Math.floor(Math.random() * colors.length)]}`;

    document.body.appendChild(particle);

    const destX = Math.cos(angle) * velocity;
    const destY = Math.sin(angle) * velocity;

    particle.animate([
      {
        transform: 'translate(0, 0) scale(1)',
        opacity: 1
      },
      {
        transform: `translate(${destX}px, ${destY}px) scale(0)`,
        opacity: 0
      }
    ], {
      duration: 800 + Math.random() * 400,
      easing: 'cubic-bezier(0, 0.5, 0.5, 1)',
      fill: 'forwards'
    });

    setTimeout(() => particle.remove(), 1500);
  }
}
