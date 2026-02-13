/* ===== 管理后台 - 地点管理 ===== */

const API = '/api';
let token = localStorage.getItem('admin_token') || '';
let editingLocationId = null; // 正在编辑的地点 ID（null = 新增）

// ===== DOM 引用 =====
const loginPage = document.getElementById('login-page');
const mainPage = document.getElementById('main-page');
const loginUsername = document.getElementById('login-username');
const loginPassword = document.getElementById('login-password');
const loginBtn = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');
const locationsList = document.getElementById('locations-list');
const addLocationBtn = document.getElementById('add-location-btn');

// 模态框
const locationModal = document.getElementById('location-modal');
const locTitleInput = document.getElementById('loc-title');
const locCoverInput = document.getElementById('loc-cover');
const coverPreview = document.getElementById('cover-preview');
const coverPlaceholder = document.getElementById('cover-placeholder');
const coverUploadArea = document.getElementById('cover-upload-area');
const locSaveBtn = document.getElementById('loc-save');
const locCancelBtn = document.getElementById('loc-cancel');
const locationModalTitle = document.getElementById('location-modal-title');

const cropModal = document.getElementById('crop-modal');
const cropImage = document.getElementById('crop-image');
const cropConfirmBtn = document.getElementById('crop-confirm');
const cropCancelBtn = document.getElementById('crop-cancel');

const toastEl = document.getElementById('toast');

// 裁剪相关状态
let cropper = null;
let croppedBlob = null;
const COVER_ASPECT = 230 / 340;

// ===== 工具函数 =====

function showToast(msg, duration = 2000) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), duration);
}

async function request(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(API + url, { ...options, headers });
  if (res.status === 401) {
    token = '';
    localStorage.removeItem('admin_token');
    showLogin();
    throw new Error('未登录');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '请求失败');
  return data;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeJs(str) {
  return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
}

// ===== 页面路由 =====

function showLogin() {
  loginPage.classList.add('active');
  mainPage.classList.remove('active');
  loginError.textContent = '';
  loginUsername.value = '';
  loginPassword.value = '';
}

function showMain() {
  loginPage.classList.remove('active');
  mainPage.classList.add('active');
  loadLocations();
}

// ===== 登录 =====

loginBtn.addEventListener('click', doLogin);
loginUsername.addEventListener('keydown', (e) => { if (e.key === 'Enter') loginPassword.focus(); });
loginPassword.addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });

async function doLogin() {
  loginError.textContent = '';
  const username = loginUsername.value.trim();
  const password = loginPassword.value.trim();
  if (!username || !password) { loginError.textContent = '请输入账号和密码'; return; }

  try {
    loginBtn.disabled = true;
    loginBtn.textContent = '登录中...';
    const data = await fetch(API + '/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    }).then(r => r.json());

    if (data.token) {
      token = data.token;
      localStorage.setItem('admin_token', token);
      showMain();
    } else {
      loginError.textContent = data.error || '登录失败';
    }
  } catch (e) {
    loginError.textContent = '网络错误';
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = '登 录';
  }
}

logoutBtn.addEventListener('click', () => {
  token = '';
  localStorage.removeItem('admin_token');
  showLogin();
});

// ===== 用户下拉菜单 =====

const userDropdown = document.getElementById('user-dropdown');
const dropdownTrigger = document.getElementById('dropdown-trigger');

dropdownTrigger.addEventListener('click', (e) => {
  e.stopPropagation();
  userDropdown.classList.toggle('open');
});

document.addEventListener('click', () => {
  userDropdown.classList.remove('open');
});

userDropdown.querySelector('.user-dropdown-menu').addEventListener('click', (e) => {
  e.stopPropagation();
});

// ===== 修改密码 =====

const changePwdBtn = document.getElementById('change-pwd-btn');
const pwdModal = document.getElementById('pwd-modal');
const pwdUsername = document.getElementById('pwd-username');
const pwdOld = document.getElementById('pwd-old');
const pwdNew = document.getElementById('pwd-new');
const pwdConfirm = document.getElementById('pwd-confirm');
const pwdError = document.getElementById('pwd-error');
const pwdSave = document.getElementById('pwd-save');
const pwdCancel = document.getElementById('pwd-cancel');

changePwdBtn.addEventListener('click', () => {
  userDropdown.classList.remove('open');
  pwdUsername.value = '';
  pwdOld.value = '';
  pwdNew.value = '';
  pwdConfirm.value = '';
  pwdError.textContent = '';
  pwdModal.classList.add('active');
});

pwdCancel.addEventListener('click', () => pwdModal.classList.remove('active'));

pwdSave.addEventListener('click', async () => {
  pwdError.textContent = '';
  const username = pwdUsername.value.trim();
  const oldPassword = pwdOld.value;
  const newPassword = pwdNew.value;
  const confirmPassword = pwdConfirm.value;

  if (!username) { pwdError.textContent = '请输入账号'; return; }
  if (!oldPassword) { pwdError.textContent = '请输入当前密码'; return; }
  if (!newPassword) { pwdError.textContent = '请输入新密码'; return; }
  if (newPassword.length < 6) { pwdError.textContent = '新密码长度不能少于 6 位'; return; }
  if (newPassword !== confirmPassword) { pwdError.textContent = '两次输入的新密码不一致'; return; }

  try {
    pwdSave.disabled = true;
    pwdSave.textContent = '提交中...';
    await request('/change-password', {
      method: 'PUT',
      body: JSON.stringify({ username, oldPassword, newPassword })
    });
    showToast('密码修改成功，请重新登录');
    pwdModal.classList.remove('active');
    // 修改成功后退出，让用户用新密码登录
    setTimeout(() => {
      token = '';
      localStorage.removeItem('admin_token');
      showLogin();
    }, 1500);
  } catch (e) {
    pwdError.textContent = e.message || '修改失败';
  } finally {
    pwdSave.disabled = false;
    pwdSave.textContent = '确认修改';
  }
});

// ===== 地点管理 =====

async function loadLocations() {
  try {
    const locations = await request('/locations');
    renderLocations(locations);
  } catch (e) {
    if (e.message !== '未登录') showToast('加载失败: ' + e.message);
  }
}

function renderLocations(locations) {
  if (locations.length === 0) {
    locationsList.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <div class="empty-icon">📍</div>
        <p>暂无地点，点击上方按钮新增</p>
      </div>`;
    return;
  }

  locationsList.innerHTML = locations.map(loc => `
    <div class="location-card" draggable="true" data-id="${loc.id}">
      ${loc.cover
        ? `<img class="card-cover" src="${loc.cover}" alt="${loc.title}" draggable="false">`
        : `<div class="card-cover-placeholder">🏞</div>`
      }
      <div class="card-info">
        <div class="card-title">${escapeHtml(loc.title)}</div>
        <div class="card-meta">${loc.photo_count || 0} 张照片</div>
      </div>
      <div class="card-actions">
        <button class="btn btn-sm btn-outline-primary" onclick="openPhotos(${loc.id}, '${escapeJs(loc.title)}')">管理照片</button>
        <button class="btn btn-sm btn-outline" onclick="openEditLocation(${loc.id})">编辑</button>
        <button class="btn btn-sm btn-outline-danger" onclick="confirmDeleteLocation(${loc.id}, '${escapeJs(loc.title)}')">删除</button>
      </div>
    </div>
  `).join('');

  // 拖拽排序
  initDragSort(locationsList, '.location-card', async (orderedIds) => {
    try {
      await request('/locations/sort', {
        method: 'PUT',
        body: JSON.stringify({ ids: orderedIds.map(Number) })
      });
      showToast('排序已保存');
    } catch (e) {
      showToast('排序保存失败');
    }
  });
}

// 打开照片管理 → 跳转到 photos.html
window.openPhotos = function(id, title) {
  window.location.href = `photos.html?id=${id}&title=${encodeURIComponent(title)}`;
};

// 新增地点
addLocationBtn.addEventListener('click', () => {
  editingLocationId = null;
  locationModalTitle.textContent = '新增地点';
  locTitleInput.value = '';
  locCoverInput.value = '';
  croppedBlob = null;
  coverPreview.style.display = 'none';
  coverPreview.src = '';
  coverPlaceholder.style.display = '';
  locationModal.classList.add('active');
});

// 编辑地点
window.openEditLocation = async function(id) {
  try {
    const locations = await request('/locations');
    const loc = locations.find(l => l.id === id);
    if (!loc) return showToast('地点不存在');

    editingLocationId = id;
    locationModalTitle.textContent = '编辑地点';
    locTitleInput.value = loc.title;
    locCoverInput.value = '';
    croppedBlob = null;

    if (loc.cover) {
      coverPreview.src = loc.cover;
      coverPreview.style.display = '';
      coverPlaceholder.style.display = 'none';
    } else {
      coverPreview.style.display = 'none';
      coverPlaceholder.style.display = '';
    }

    locationModal.classList.add('active');
  } catch (e) {
    showToast('加载失败');
  }
};

// 封面上传：选图 → 裁剪 → 预览
coverUploadArea.addEventListener('click', () => locCoverInput.click());

locCoverInput.addEventListener('change', () => {
  if (locCoverInput.files.length === 0) return;
  const file = locCoverInput.files[0];
  const reader = new FileReader();
  reader.onload = (e) => {
    openCropper(e.target.result);
  };
  reader.onerror = () => {
    showToast('读取文件失败');
    locCoverInput.value = '';
  };
  reader.readAsDataURL(file);
});

function openCropper(imageSrc) {
  if (cropper) { cropper.destroy(); cropper = null; }
  croppedBlob = null;

  const container = document.querySelector('.crop-container');
  container.style.width = '';
  container.style.height = '';

  cropImage.src = imageSrc;
  cropModal.classList.add('active');
  cropImage.onerror = () => {
    showToast('图片加载失败');
    closeCropper();
    locCoverInput.value = '';
  };

  cropImage.onload = () => {
    const natW = cropImage.naturalWidth;
    const natH = cropImage.naturalHeight;
    const maxW = window.innerWidth * 0.72;
    const maxH = window.innerHeight * 0.65;
    const ratio = natW / natH;

    let displayW, displayH;
    if (natW / maxW > natH / maxH) {
      displayW = Math.min(natW, maxW);
      displayH = displayW / ratio;
    } else {
      displayH = Math.min(natH, maxH);
      displayW = displayH * ratio;
    }

    container.style.width = Math.round(displayW) + 'px';
    container.style.height = Math.round(displayH) + 'px';

    cropper = new Cropper(cropImage, {
      aspectRatio: COVER_ASPECT,
      viewMode: 1,
      dragMode: 'move',
      autoCropArea: 0.8,
      responsive: true,
      restore: false,
      guides: true,
      center: true,
      highlight: true,
      cropBoxMovable: true,
      cropBoxResizable: true,
      toggleDragModeOnDblclick: false,
    });
  };
}

cropConfirmBtn.addEventListener('click', () => {
  if (!cropper) return;
  const canvas = cropper.getCroppedCanvas({
    width: 460,
    height: 680,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high',
  });

  canvas.toBlob((blob) => {
    croppedBlob = blob;
    const url = URL.createObjectURL(blob);
    coverPreview.src = url;
    coverPreview.style.display = '';
    coverPlaceholder.style.display = 'none';
    closeCropper();
  }, 'image/jpeg', 0.92);
});

cropCancelBtn.addEventListener('click', () => {
  closeCropper();
  locCoverInput.value = '';
});

cropModal.querySelector('.modal-backdrop').addEventListener('click', () => {
  closeCropper();
  locCoverInput.value = '';
});

function closeCropper() {
  cropModal.classList.remove('active');
  if (cropper) { cropper.destroy(); cropper = null; }
}

// 保存地点
locSaveBtn.addEventListener('click', async () => {
  const title = locTitleInput.value.trim();
  if (!title) return showToast('请输入地点名称');

  const formData = new FormData();
  formData.append('title', title);
  if (croppedBlob) {
    formData.append('cover', croppedBlob, 'cover.jpg');
  } else if (locCoverInput.files.length > 0) {
    formData.append('cover', locCoverInput.files[0]);
  }

  try {
    locSaveBtn.disabled = true;
    locSaveBtn.textContent = '保存中...';

    if (editingLocationId) {
      await request(`/locations/${editingLocationId}`, { method: 'PUT', body: formData });
      showToast('更新成功');
    } else {
      await request('/locations', { method: 'POST', body: formData });
      showToast('创建成功');
    }

    locationModal.classList.remove('active');
    croppedBlob = null;
    loadLocations();
  } catch (e) {
    showToast('保存失败: ' + e.message);
  } finally {
    locSaveBtn.disabled = false;
    locSaveBtn.textContent = '保存';
  }
});

locCancelBtn.addEventListener('click', () => locationModal.classList.remove('active'));

// 关闭模态框（点击背景）
document.querySelectorAll('.modal-backdrop').forEach(bd => {
  bd.addEventListener('click', () => bd.parentElement.classList.remove('active'));
});

// 删除地点
window.confirmDeleteLocation = async function(id, title) {
  if (!confirm(`确定删除「${title}」吗？关联的所有照片也会一并删除。`)) return;
  try {
    await request(`/locations/${id}`, { method: 'DELETE' });
    showToast('删除成功');
    loadLocations();
  } catch (e) {
    showToast('删除失败: ' + e.message);
  }
};

// ===== 拖拽排序通用函数 =====

function initDragSort(container, selector, onSort) {
  let dragItem = null;
  let orderBeforeDrag = null;

  function finishDrag() {
    if (!dragItem) return;
    dragItem.classList.remove('dragging');
    dragItem.style.pointerEvents = '';
    var ids = [...container.querySelectorAll(selector)].map(function(el) { return el.dataset.id; });
    var changed = orderBeforeDrag && (ids.length !== orderBeforeDrag.length || ids.some(function(id, i) { return id !== orderBeforeDrag[i]; }));
    dragItem = null;
    orderBeforeDrag = null;
    if (changed) onSort(ids);
  }

  container.querySelectorAll(selector).forEach(function(item) {
    item.addEventListener('contextmenu', function(e) { if (!e.target.closest('button')) e.preventDefault(); });

    item.addEventListener('dragstart', function(e) {
      dragItem = item;
      orderBeforeDrag = [...container.querySelectorAll(selector)].map(function(el) { return el.dataset.id; });
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    item.addEventListener('dragend', finishDrag);

    item.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (!dragItem || dragItem === item) return;
      var rect = item.getBoundingClientRect();
      var mid = rect.left + rect.width / 2;
      if (e.clientX < mid) {
        container.insertBefore(dragItem, item);
      } else {
        container.insertBefore(dragItem, item.nextSibling);
      }
    });

    // 移动端触摸拖拽：长按约 400ms 后才进入拖拽，触摸在按钮上不触发拖拽
    item.addEventListener('touchstart', function(e) {
      if (e.touches.length !== 1) return;
      if (e.target.closest('button')) return;
      var longPressFired = false;
      var longPressTimer = null;
      var ghost = null;
      var touchOffsetX = 0;
      var touchOffsetY = 0;

      function onTouchMove(ev) {
        if (ev.touches.length !== 1) return;
        var t = ev.touches[0];
        if (!longPressFired) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
          document.removeEventListener('touchmove', onTouchMove, { passive: false });
          document.removeEventListener('touchend', onTouchEnd);
          document.removeEventListener('touchcancel', onTouchEnd);
          return;
        }
        ev.preventDefault();
        if (!ghost) {
          var rect = dragItem.getBoundingClientRect();
          touchOffsetX = t.clientX - rect.left;
          touchOffsetY = t.clientY - rect.top;
          ghost = dragItem.cloneNode(true);
          ghost.classList.add('admin-drag-ghost');
          ghost.style.cssText = 'position:fixed;left:' + rect.left + 'px;top:' + rect.top + 'px;width:' + rect.width + 'px;height:' + rect.height + 'px;z-index:9999;pointer-events:none;box-shadow:0 16px 48px rgba(0,0,0,0.22);transform:translateY(-10px) scale(1.04);transition:none;opacity:0.98;border-radius:var(--radius,8px);overflow:hidden;background:var(--card-bg,#fff);';
          document.body.appendChild(ghost);
          dragItem.style.opacity = '0';
          dragItem.style.visibility = 'hidden';
        }
        ghost.style.left = (t.clientX - touchOffsetX) + 'px';
        ghost.style.top = (t.clientY - touchOffsetY) + 'px';
        var under = document.elementFromPoint(t.clientX, t.clientY);
        var target = under ? under.closest(selector) : null;
        if (!target || target === dragItem) return;
        var rect = target.getBoundingClientRect();
        var mid = rect.left + rect.width / 2;
        if (t.clientX < mid) {
          container.insertBefore(dragItem, target);
        } else {
          container.insertBefore(dragItem, target.nextSibling);
        }
      }
      function onTouchEnd() {
        clearTimeout(longPressTimer);
        longPressTimer = null;
        document.removeEventListener('touchmove', onTouchMove, { passive: false });
        document.removeEventListener('touchend', onTouchEnd);
        document.removeEventListener('touchcancel', onTouchEnd);
        if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
        if (dragItem) { dragItem.style.opacity = ''; dragItem.style.visibility = ''; }
        if (longPressFired) finishDrag();
      }

      longPressTimer = setTimeout(function() {
        longPressTimer = null;
        longPressFired = true;
        dragItem = item;
        orderBeforeDrag = [...container.querySelectorAll(selector)].map(function(el) { return el.dataset.id; });
        item.classList.add('dragging');
        item.style.pointerEvents = 'none';
      }, 400);

      document.addEventListener('touchmove', onTouchMove, { passive: false });
      document.addEventListener('touchend', onTouchEnd, { once: true });
      document.addEventListener('touchcancel', onTouchEnd, { once: true });
    }, { passive: true });
  });
}

// ===== 初始化 =====

(function init() {
  if (token) {
    request('/locations')
      .then(() => showMain())
      .catch(() => showLogin());
  } else {
    showLogin();
  }
})();
