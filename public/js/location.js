// ===== Toast 提示工具 =====
function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2000);
}

// ===== 从 API 加载数据并初始化 =====
let IMAGES = [];

async function initCylinder() {
  try {
    const resp = await fetch('/api/locations');
    if (!resp.ok) throw new Error('API 请求失败');
    IMAGES = await resp.json();
  } catch (e) {
    console.error('加载地点数据失败:', e);
    showToast('数据加载失败，请刷新重试');
    return;
  }

  // 提前建立到 OSS 的连接
  if (IMAGES.length > 0 && typeof ossPreconnect === 'function') {
    ossPreconnect(IMAGES[0].src);
  }

  buildCylinder(IMAGES);
}

// ===== 动态生成圆柱面板 =====
function buildCylinder(IMAGES) {
  const cylinder = document.getElementById('cylinder');
  if (!cylinder) return;

  const count = IMAGES.length;
  if (count === 0) return;

  const viewH = window.innerHeight;
  const viewW = window.innerWidth;

  // 根据屏幕高度确定面板最大高度（留 15% 上下边距）
  // 留出倒影空间，面板占屏幕高度的 55%
  const maxPanelH = Math.round(viewH * 0.55);
  // 基准高度 280px，照片越多适当缩小（最低缩到 0.55 倍）
  const countScale = Math.max(0.55, Math.min(1, 8 / count));
  const PANEL_HEIGHT = Math.round(Math.min(maxPanelH, 280) * countScale);
  // 保持 23:34 的宽高比
  const PANEL_WIDTH = Math.round(PANEL_HEIGHT * (230 / 340));
  const GAP = Math.round(PANEL_WIDTH * 0.13);

  // 设置 CSS 变量
  const scene = document.querySelector('.cylinder-scene');
  if (scene) {
    scene.style.setProperty('--panel-w', PANEL_WIDTH + 'px');
    scene.style.setProperty('--panel-h', PANEL_HEIGHT + 'px');
    scene.style.setProperty('--scene-w', (PANEL_WIDTH + 30) + 'px');
    scene.style.setProperty('--scene-h', (PANEL_HEIGHT + 20) + 'px');
  }

  // 根据面板数量自动计算圆柱半径
  const circumference = count * (PANEL_WIDTH + GAP);
  const radius = Math.round(circumference / (2 * Math.PI));
  window._cylinderRadius = radius;
  const anglePer = 360 / count;

  // 根据半径调整透视距离
  const wrapper = document.getElementById('cylinderWrapper');
  if (wrapper) {
    const perspective = Math.max(1200, radius * 2.5);
    wrapper.style.perspective = perspective + 'px';
  }

  IMAGES.forEach((item, i) => {
    const panel = document.createElement('div');
    panel.className = 'cylinder-panel';
    panel.style.setProperty('--i', i);
    panel.style.setProperty('--angle', `${i * anglePer}deg`);
    panel.style.setProperty('--tz', `${radius}px`);

    // 骨架屏占位
    const skeleton = document.createElement('div');
    skeleton.className = 'panel-skeleton';
    panel.appendChild(skeleton);

    const img = document.createElement('img');
    img.alt = item.title || '';
    img.onload = () => {
      img.classList.add('img-loaded');
      skeleton.classList.add('hidden');
    };
    // 封面用缩略图（高度 400px），减少流量和加载时间
    img.src = (typeof ossThumb === 'function') ? ossThumb(item.src, 400) : item.src;
    panel.appendChild(img);

    // 标题说明
    if (item.title) {
      const caption = document.createElement('div');
      caption.className = 'panel-caption';
      caption.textContent = item.title;
      panel.appendChild(caption);
    }

    // 照片数量角标
    if (item.details && item.details.length > 0) {
      const badge = document.createElement('div');
      badge.className = 'panel-badge';
      badge.textContent = item.details.length + ' 张';
      panel.appendChild(badge);
    }

    // 点击面板跳转到明细页（区分拖拽和点击）
    let panelDownX = 0, panelDownY = 0;
    panel.addEventListener('mousedown', (e) => {
      panelDownX = e.clientX;
      panelDownY = e.clientY;
    });
    panel.addEventListener('mouseup', (e) => {
      const dx = Math.abs(e.clientX - panelDownX);
      const dy = Math.abs(e.clientY - panelDownY);
      if (dx < 5 && dy < 5) {
        if (item.details && item.details.length > 0) {
          // 点击脉冲特效
          const pulse = document.createElement('div');
          pulse.className = 'click-pulse';
          pulse.style.left = e.clientX + 'px';
          pulse.style.top = e.clientY + 'px';
          document.body.appendChild(pulse);
          pulse.addEventListener('animationend', () => pulse.remove());

          // 页面过渡
          const overlay = document.getElementById('pageOverlay');
          if (overlay) {
            overlay.classList.add('active');
            overlay.addEventListener('transitionend', () => {
              window.location.href = `location_detail.html?id=${i}`;
            }, { once: true });
          } else {
            window.location.href = `location_detail.html?id=${i}`;
          }
        } else {
          showToast('该地点暂无明细照片');
        }
      }
    });

    cylinder.appendChild(panel);
  });
}

// ===== 页面加载：遮罩渐出 → 内容渐入 → 卡牌展开 =====
window.addEventListener('load', async () => {
  // 先加载数据并生成圆柱
  await initCylinder();

  const overlay = document.getElementById('pageOverlay');
  const wrapper = document.getElementById('cylinderWrapper');

  // 1. 遮罩渐出（0.8s）
  if (overlay) {
    requestAnimationFrame(() => {
      overlay.classList.remove('active');
    });
  }

  // 2. 遮罩消退后展示内容 + 触发卡牌展开
  const overlayDuration = 800;
  setTimeout(() => {
    wrapper.classList.add('loaded');
  }, overlayDuration * 0.3);

  // 3. 等内容可见后触发卡牌展开
  setTimeout(() => {
    document.querySelectorAll('.cylinder-panel').forEach(p => p.classList.add('spread'));
  }, overlayDuration + 400);

  // 计算展开动画总时长
  const totalSpreadTime = overlayDuration + 400 + IMAGES.length * 120 + 1600;

  // 操作提示延迟显示，5秒后自动淡出
  setTimeout(() => {
    const hint = document.getElementById('dragHint');
    if (hint) {
      hint.classList.add('loaded');
      setTimeout(() => {
        hint.classList.add('fade-away');
      }, 5000);
    }
  }, totalSpreadTime);

  // ===== 3D 圆柱交互 =====
  initCylinderInteraction(totalSpreadTime);

});

// ===== 3D 圆柱交互（独立函数） =====
function initCylinderInteraction(totalSpreadTime) {
  const cylinder = document.getElementById('cylinder');
  const wrapper = document.getElementById('cylinderWrapper');
  if (!cylinder || !wrapper) return;

  let rotateY = 0;
  let rotateX = -10;
  let isDragging = false;
  let lastMouseX = 0;
  let lastMouseY = 0;

  let autoRotate = false;
  let hoverPaused = false;
  const baseLinearSpeed = 25;
  const r = window._cylinderRadius || 200;
  let autoSpeed = -(baseLinearSpeed / r) * (180 / Math.PI) / 60;

  let isCorrectingAngle = false;
  setTimeout(() => {
    if (isDragging) return;
    isCorrectingAngle = true;
    const startX = rotateX;
    const targetX = 0;
    const duration = 1500;
    const startTime = performance.now();

    function correctAngle(now) {
      if (!isCorrectingAngle) return;
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      rotateX = startX + (targetX - startX) * ease;
      updateTransform();

      if (progress < 1) {
        requestAnimationFrame(correctAngle);
      } else {
        isCorrectingAngle = false;
        if (!isDragging) autoRotate = true;
      }
    }
    requestAnimationFrame(correctAngle);
  }, totalSpreadTime);

  let velocityY = 0;
  let velocityX = 0;
  const friction = 0.95;

  const MAX_ROTATE_X = 45;
  const MIN_ROTATE_X = -45;

  function updateTransform() {
    cylinder.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  }

  // 悬停暂停旋转 + 高亮联动
  wrapper.addEventListener('mouseenter', () => {
    if (autoRotate) {
      hoverPaused = true;
      autoRotate = false;
    }
    cylinder.classList.add('hover-active');
  });

  wrapper.addEventListener('mouseleave', () => {
    if (hoverPaused && !isDragging) {
      autoRotate = true;
      hoverPaused = false;
    }
    cylinder.classList.remove('hover-active');
  });

  // 鼠标事件
  wrapper.addEventListener('mousedown', (e) => {
    isDragging = true;
    autoRotate = false;
    isCorrectingAngle = false;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    velocityY = 0;
    velocityX = 0;
    wrapper.style.cursor = 'grabbing';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const deltaX = e.clientX - lastMouseX;
    const deltaY = e.clientY - lastMouseY;
    velocityY = deltaX * 0.4;
    velocityX = -deltaY * 0.3;
    rotateY += velocityY;
    rotateX += velocityX;
    rotateX = Math.max(MIN_ROTATE_X, Math.min(MAX_ROTATE_X, rotateX));
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    updateTransform();
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      wrapper.style.cursor = '';
      setTimeout(() => {
        if (!isDragging && !hoverPaused) autoRotate = true;
      }, 3000);
    }
  });

  // 触摸事件
  wrapper.addEventListener('touchstart', (e) => {
    isDragging = true;
    autoRotate = false;
    isCorrectingAngle = false;
    const touch = e.touches[0];
    lastMouseX = touch.clientX;
    lastMouseY = touch.clientY;
    velocityY = 0;
    velocityX = 0;
  }, { passive: true });

  wrapper.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - lastMouseX;
    const deltaY = touch.clientY - lastMouseY;
    velocityY = deltaX * 0.4;
    velocityX = -deltaY * 0.3;
    rotateY += velocityY;
    rotateX += velocityX;
    rotateX = Math.max(MIN_ROTATE_X, Math.min(MAX_ROTATE_X, rotateX));
    lastMouseX = touch.clientX;
    lastMouseY = touch.clientY;
    updateTransform();
  }, { passive: true });

  wrapper.addEventListener('touchend', () => {
    isDragging = false;
    setTimeout(() => {
      if (!isDragging) autoRotate = true;
    }, 3000);
  });

  // 动画循环
  function animate() {
    if (!isDragging) {
      if (autoRotate) {
        rotateY += autoSpeed;
      } else {
        velocityY *= friction;
        velocityX *= friction;
        rotateY += velocityY;
        rotateX += velocityX;
        rotateX = Math.max(MIN_ROTATE_X, Math.min(MAX_ROTATE_X, rotateX));
        if (Math.abs(velocityY) < 0.01 && Math.abs(velocityX) < 0.01) {
          velocityY = 0;
          velocityX = 0;
        }
      }
      updateTransform();
    }
    requestAnimationFrame(animate);
  }

  updateTransform();
  animate();
}

