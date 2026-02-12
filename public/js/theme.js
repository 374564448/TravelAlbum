// ===== 主题管理（日/夜自动切换 + 手动切换 + Canvas 动画控制） =====
(function () {
  const KEY = 'travelAlbum_theme';

  // 根据系统时间判断默认主题
  function getAutoTheme() {
    const hour = new Date().getHours();
    return (hour >= 7 && hour < 18) ? 'day' : 'night';
  }

  // 获取当前应该使用的主题
  function getCurrentTheme() {
    const saved = localStorage.getItem(KEY);
    return saved || getAutoTheme();
  }

  // 应用主题（animated 控制是否带过渡）
  function applyTheme(theme, animated) {
    const body = document.body;
    const starCanvas = document.getElementById('starfield');
    const skyCanvas = document.getElementById('skyfield');
    const btn = document.getElementById('themeToggle');

    // 切换时添加过渡类
    if (animated) {
      body.classList.add('theme-transitioning');
      setTimeout(() => body.classList.remove('theme-transitioning'), 1200);
    }

    body.classList.remove('theme-day', 'theme-night');
    body.classList.add('theme-' + theme);

    // 切换 Canvas 可见性（通过 opacity 过渡）
    if (starCanvas) starCanvas.style.opacity = (theme === 'night') ? '' : '0';
    if (skyCanvas) skyCanvas.style.opacity = (theme === 'day') ? '' : '0';

    // 核心优化：只运行当前可见画布的动画循环，隐藏的立即停止
    if (theme === 'night') {
      if (window.starfieldAnim) window.starfieldAnim.start();
      if (window.skyfieldAnim) window.skyfieldAnim.stop();
    } else {
      if (window.skyfieldAnim) window.skyfieldAnim.start();
      if (window.starfieldAnim) window.starfieldAnim.stop();
    }

    // 更新按钮图标
    if (btn) {
      btn.innerHTML = (theme === 'day')
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>';
      btn.title = (theme === 'day') ? '切换到夜间模式' : '切换到日间模式';
    }
  }

  // 切换主题（手动切换带动画）
  function toggleTheme() {
    const current = getCurrentTheme();
    const next = (current === 'day') ? 'night' : 'day';
    localStorage.setItem(KEY, next);
    applyTheme(next, true);
  }

  // 初始化（不带动画）
  const theme = getCurrentTheme();
  applyTheme(theme, false);

  // 绑定按钮
  const btn = document.getElementById('themeToggle');
  if (btn) {
    btn.addEventListener('click', toggleTheme);
  }
})();
