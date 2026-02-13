// ===== 解析 URL 参数 =====
function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

// ===== 生成随机倾斜角度（东倒西歪） =====
function randomRotate() {
  return (Math.random() - 0.5) * 8;
}

// ===== 从 API 加载数据并渲染 =====
var _detailItems = []; // 供 lightbox 使用

async function initDetail() {
  const id = parseInt(getQueryParam('id'), 10);
  if (isNaN(id)) return;

  let item;
  try {
    const resp = await fetch(`/api/locations/${id}`);
    if (!resp.ok) throw new Error('API 请求失败');
    item = await resp.json();
  } catch (e) {
    console.error('加载地点数据失败:', e);
    return;
  }

  if (!item || !item.details || item.details.length === 0) return;

  // 提前建立到 OSS 的连接
  const firstSrc = typeof item.details[0] === 'string' ? item.details[0] : item.details[0].src;
  if (typeof ossPreconnect === 'function') ossPreconnect(firstSrc);

  // 设置标题
  const titleEl = document.getElementById('detailTitle');
  if (titleEl) titleEl.textContent = item.title || '';

  // 设置页面标题
  document.title = `Travel Album - ${item.title || '照片明细'}`;

  // 渲染照片网格
  const grid = document.getElementById('photoGrid');
  if (!grid) return;

  // 统一为对象格式（兼容字符串）
  _detailItems = item.details.map(d => typeof d === 'string' ? { src: d } : d);

  // 先创建所有卡片 DOM（不设置 img.src，避免同时加载）
  const cards = [];
  _detailItems.forEach((detail, i) => {
    const photoTitle = detail.title || '';

    const card = document.createElement('div');
    card.className = 'photo-card';
    card.classList.add(i % 2 === 0 ? 'enter-left' : 'enter-right');
    card.style.setProperty('--rotate', `${randomRotate()}deg`);

    // 图片区域（含骨架屏）
    const imgWrap = document.createElement('div');
    imgWrap.className = 'photo-card-img';

    const skeleton = document.createElement('div');
    skeleton.className = 'skeleton';
    imgWrap.appendChild(skeleton);

    const img = document.createElement('img');
    img.alt = photoTitle || `${item.title} - ${i + 1}`;
    // 暂不设置 src，等分批加载时再设置
    imgWrap.appendChild(img);
    card.appendChild(imgWrap);

    // 相框下栏
    if (photoTitle) {
      const footer = document.createElement('div');
      footer.className = 'photo-card-footer';
      const t = document.createElement('div');
      t.className = 'photo-card-title';
      t.textContent = photoTitle;
      footer.appendChild(t);
      card.appendChild(footer);
    }

    // 点击放大
    card.addEventListener('click', () => {
      openLightbox(i, _detailItems);
    });

    grid.appendChild(card);
    // 列表用缩略图（高度 500px），lightbox 用原图
    cards.push({ card, img, skeleton, src: ossThumb(detail.src, 500) });
  });

  return cards;
}

// ===== 分批加载图片 + 逐张入场 =====
function loadImagesInBatches(cards, batchSize) {
  if (!cards || cards.length === 0) return;
  batchSize = batchSize || 4;
  let index = 0;

  function loadBatch() {
    const end = Math.min(index + batchSize, cards.length);
    const promises = [];

    for (let i = index; i < end; i++) {
      const item = cards[i];
      promises.push(new Promise((resolve) => {
        item.img.onload = () => {
          item.img.classList.add('img-loaded');
          item.skeleton.classList.add('hidden');
          // 图片加载完成后入场
          requestAnimationFrame(() => {
            item.card.classList.add('show');
          });
          resolve();
        };
        item.img.onerror = () => {
          item.skeleton.classList.add('hidden');
          // 显示加载失败占位
          var placeholder = document.createElement('div');
          placeholder.className = 'img-error-placeholder';
          placeholder.textContent = '图片加载失败';
          item.img.parentNode.replaceChild(placeholder, item.img);
          item.card.classList.add('show');
          resolve();
        };
        item.img.src = item.src;
      }));
    }

    index = end;

    // 当前批次全部完成（或超时 3 秒）后加载下一批
    Promise.all(promises).then(() => {
      if (index < cards.length) {
        // 短暂间隔让浏览器喘息
        setTimeout(loadBatch, 80);
      }
    });

    // 超时保底：3 秒后无论如何继续下一批
    setTimeout(() => {
      if (index < cards.length) {
        // 只有在 Promise.all 还没触发下一批时才执行
        const nextStart = end;
        if (index <= nextStart) {
          index = nextStart;
          loadBatch();
        }
      }
    }, 3000);
  }

  loadBatch();
}

// ===== 页面加载渐入 + 分批加载照片 =====
window.addEventListener('DOMContentLoaded', async () => {
  // 先加载数据并创建 DOM（不加载图片）
  const cards = await initDetail();

  // 过渡遮罩渐出
  const overlay = document.getElementById('pageOverlay');
  if (overlay) {
    requestAnimationFrame(() => {
      overlay.classList.remove('active');
    });
  }

  const header = document.getElementById('detailHeader');
  const grid = document.getElementById('photoGrid');
  if (header) header.classList.add('loaded');
  if (grid) grid.classList.add('loaded');

  // 分批加载图片（每批 4 张，加载完入场，再加载下一批）
  if (cards && cards.length > 0) {
    // 短暂延迟让遮罩过渡和樱花初始化完成
    setTimeout(() => {
      loadImagesInBatches(cards, 4);
    }, 300);
  }

  // ===== 自动缓慢下滑 =====
  let autoScrollId = null;
  let autoScrolling = false;
  let autoScrollPaused = false;
  // 自动滚动使用节流：每 2 帧滚动一次，降低与 WebGL 的冲突
  let autoScrollFrameCount = 0;

  function startAutoScroll() {
    if (autoScrolling || autoScrollPaused) return;
    autoScrolling = true;
    autoScrollFrameCount = 0;
    autoScrollId = requestAnimationFrame(function tick() {
      if (!autoScrolling) return;
      if ((window.innerHeight + window.scrollY) >= document.body.scrollHeight - 2) {
        autoScrolling = false;
        return;
      }
      autoScrollFrameCount++;
      if (autoScrollFrameCount % 2 === 0) {
        window.scrollBy(0, 1);
      }
      autoScrollId = requestAnimationFrame(tick);
    });
  }

  function stopAutoScroll() {
    if (!autoScrolling) return;
    autoScrolling = false;
    if (autoScrollId) cancelAnimationFrame(autoScrollId);
  }

  function pauseAutoScroll() {
    autoScrollPaused = true;
    stopAutoScroll();
  }

  function resumeAutoScroll() {
    autoScrollPaused = false;
    startAutoScroll();
  }

  window._autoScroll = { start: startAutoScroll, stop: stopAutoScroll, pause: pauseAutoScroll, resume: resumeAutoScroll };

  // 延迟启动自动滚动（等首批图片加载完）
  setTimeout(startAutoScroll, 3000);

  let lastScrollY = window.scrollY;
  window.addEventListener('scroll', () => {
    if (autoScrollPaused) return;
    const currentY = window.scrollY;
    if (currentY < lastScrollY) {
      stopAutoScroll();
    } else if (currentY > lastScrollY && !autoScrolling) {
      startAutoScroll();
    }
    lastScrollY = currentY;
  }, { passive: true });

  ['touchstart', 'mousedown'].forEach(evt => {
    window.addEventListener(evt, stopAutoScroll, { passive: true });
  });
});

// ===== 照片放大查看（支持左右切换 + 相框标题描述 + 计数 + 手势滑动） =====
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');
const lightboxTitle = document.getElementById('lightboxTitle');
const lightboxDesc = document.getElementById('lightboxDesc');
const lightboxFooter = document.getElementById('lightboxFooter');
const lightboxCounter = document.getElementById('lightboxCounter');
let currentIndex = -1;
let currentDetails = [];
let typeTimer = null;
let closeTimer = null;

function clearTyping() {
  if (typeTimer) {
    clearInterval(typeTimer);
    typeTimer = null;
  }
}

function typeDesc(text) {
  clearTyping();
  lightboxDesc.textContent = '';
  if (!text) return;
  let i = 0;
  typeTimer = setInterval(() => {
    lightboxDesc.textContent += text[i];
    i++;
    if (i >= text.length) {
      clearInterval(typeTimer);
      typeTimer = null;
    }
  }, 150);
}

function updateCounter() {
  if (lightboxCounter && currentDetails.length > 0) {
    lightboxCounter.textContent = (currentIndex + 1) + ' / ' + currentDetails.length;
  }
}

function updateLightboxInfo(detail) {
  const title = detail.title || '';
  const desc = detail.desc || '';
  lightboxTitle.textContent = title;
  lightboxFooter.style.display = (title || desc) ? '' : 'none';
  typeDesc(desc);
}

let swipeHintShown = false;

function isMobile() {
  return window.innerWidth <= 768 || ('ontouchstart' in window);
}

function showSwipeHint() {
  if (swipeHintShown) return;
  swipeHintShown = true;
  const hint = document.getElementById('swipeHint');
  if (!hint) return;
  setTimeout(() => {
    hint.classList.add('visible');
    setTimeout(() => {
      hint.classList.add('fade-out');
      setTimeout(() => {
        hint.classList.remove('visible', 'fade-out');
      }, 600);
    }, 2500);
  }, 700);
}

function openLightbox(index, details) {
  if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }

  currentIndex = index;
  currentDetails = details;
  const detail = details[index];

  lightboxImg.src = detail.src;
  updateLightboxInfo(detail);
  updateCounter();
  if (window._autoScroll) window._autoScroll.pause();

  // 锁定背景滚动
  document.body.style.overflow = 'hidden';

  const frame = document.getElementById('lightboxFrame');
  frame.style.transition = '';
  frame.style.opacity = '';
  lightbox.classList.remove('active', 'closing');
  void lightbox.offsetWidth;
  lightbox.classList.add('active');
  showSwipeHint();
}

function switchTo(index) {
  if (index < 0 || index >= currentDetails.length) return;
  currentIndex = index;
  const detail = currentDetails[currentIndex];
  updateCounter();
  const frame = document.getElementById('lightboxFrame');
  frame.style.transition = 'opacity 0.25s ease';
  frame.style.opacity = '0';
  setTimeout(() => {
    lightboxImg.src = detail.src;
    updateLightboxInfo(detail);
    lightboxImg.onload = () => {
      frame.style.opacity = '1';
      setTimeout(() => {
        frame.style.transition = '';
      }, 300);
    };
    if (lightboxImg.complete) {
      frame.style.opacity = '1';
      setTimeout(() => { frame.style.transition = ''; }, 300);
    }
  }, 250);
}

function closeLightbox() {
  clearTyping();
  const frame = document.getElementById('lightboxFrame');
  frame.style.transition = '';
  frame.style.opacity = '';
  lightbox.classList.remove('active');
  lightbox.classList.add('closing');
  currentIndex = -1;

  // 恢复背景滚动
  document.body.style.overflow = '';

  if (window._autoScroll) window._autoScroll.resume();
  if (closeTimer) clearTimeout(closeTimer);
  closeTimer = setTimeout(() => {
    lightbox.classList.remove('closing');
    lightboxImg.src = '';
    lightboxTitle.textContent = '';
    lightboxDesc.textContent = '';
    closeTimer = null;
  }, 1000);
}

function gotoPrev() {
  if (currentIndex > 0) {
    switchTo(currentIndex - 1);
  } else {
    switchTo(currentDetails.length - 1);
  }
}

function gotoNext() {
  if (currentIndex < currentDetails.length - 1) {
    switchTo(currentIndex + 1);
  } else {
    switchTo(0);
  }
}

// 键盘操作
document.addEventListener('keydown', (e) => {
  if (currentIndex < 0) return;
  if (e.key === 'Escape') {
    closeLightbox();
  } else if (e.key === 'ArrowLeft') {
    gotoPrev();
  } else if (e.key === 'ArrowRight') {
    gotoNext();
  }
});

// ===== Lightbox 滑动切换（全终端：触摸 + 鼠标拖拽） =====
(function () {
  let startX = 0;
  let startY = 0;
  let swiping = false;

  function handleSwipe(endX, endY) {
    const dx = endX - startX;
    const dy = endY - startY;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) {
        gotoNext();
      } else {
        gotoPrev();
      }
      return true;
    }
    return false;
  }

  lightbox.addEventListener('touchstart', (e) => {
    if (currentIndex < 0) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    swiping = true;
  }, { passive: true });

  lightbox.addEventListener('touchend', (e) => {
    if (!swiping || currentIndex < 0) return;
    swiping = false;
    handleSwipe(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
  }, { passive: true });

  lightbox.addEventListener('mousedown', (e) => {
    if (currentIndex < 0) return;
    startX = e.clientX;
    startY = e.clientY;
    swiping = true;
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!swiping) return;
  });

  document.addEventListener('mouseup', (e) => {
    if (!swiping || currentIndex < 0) return;
    swiping = false;
    const triggered = handleSwipe(e.clientX, e.clientY);
    if (!triggered && e.target === lightbox) {
      const dx = Math.abs(e.clientX - startX);
      const dy = Math.abs(e.clientY - startY);
      if (dx < 5 && dy < 5) {
        closeLightbox();
      }
    }
  });
})();

// ===== 返回按钮过渡效果 =====
(function () {
  const backBtn = document.getElementById('backBtn');
  if (!backBtn) return;
  backBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const overlay = document.getElementById('pageOverlay');
    if (overlay) {
      const KEY = 'travelAlbum_theme';
      let theme = localStorage.getItem(KEY) || 'auto';
      if (theme === 'auto') {
        const h = new Date().getHours();
        theme = (h >= 7 && h < 18) ? 'day' : 'night';
      }
      if (theme === 'day') {
        overlay.style.background = '#E8F4F8';
      }
      overlay.classList.add('active');
      overlay.addEventListener('transitionend', () => {
        window.location.href = 'location.html';
      }, { once: true });
    } else {
      window.location.href = 'location.html';
    }
  });
})();

// ===== 滚动进度条 =====
(function () {
  const bar = document.getElementById('scrollProgress');
  if (!bar) return;
  function updateProgress() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const percent = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    bar.style.width = Math.min(percent, 100) + '%';
  }
  window.addEventListener('scroll', updateProgress, { passive: true });
  window.addEventListener('resize', updateProgress, { passive: true });
  updateProgress();
})();
