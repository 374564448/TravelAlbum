/* ===== 管理后台 JavaScript ===== */

const API = '/api';
let token = localStorage.getItem('admin_token') || '';
let currentLocationId = null; // 当前查看照片的地点 ID
let editingLocationId = null; // 正在编辑的地点 ID（null = 新增）
let editingPhotoId = null;    // 正在编辑的照片 ID

// ===== DOM 引用 =====
const loginPage = document.getElementById('login-page');
const mainPage = document.getElementById('main-page');
const loginUsername = document.getElementById('login-username');
const loginPassword = document.getElementById('login-password');
const loginBtn = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');
const pageTitle = document.getElementById('page-title');
const backBtn = document.getElementById('back-btn');
const locationsView = document.getElementById('locations-view');
const photosView = document.getElementById('photos-view');
const locationsList = document.getElementById('locations-list');
const photosList = document.getElementById('photos-list');
const addLocationBtn = document.getElementById('add-location-btn');
const uploadArea = document.getElementById('upload-area');
const photoUploadInput = document.getElementById('photo-upload');
const uploadBtn = document.getElementById('upload-btn');

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

const photoModal = document.getElementById('photo-modal');
const photoTitleInput = document.getElementById('photo-title');
const photoDescInput = document.getElementById('photo-desc');
const photoSaveBtn = document.getElementById('photo-save');
const photoCancelBtn = document.getElementById('photo-cancel');

const cropModal = document.getElementById('crop-modal');
const cropImage = document.getElementById('crop-image');
const cropConfirmBtn = document.getElementById('crop-confirm');
const cropCancelBtn = document.getElementById('crop-cancel');

const toastEl = document.getElementById('toast');

// 裁剪相关状态
let cropper = null;
let croppedBlob = null; // 裁剪后的图片 Blob
const COVER_ASPECT = 230 / 340; // 圆柱照片墙面板宽高比

// ===== 工具函数 =====

function showToast(msg, duration = 2000) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), duration);
}

async function request(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  // 如果不是 FormData，设置 JSON content-type
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
  showLocations();
}

function showLocations() {
  locationsView.classList.add('active');
  photosView.classList.remove('active');
  pageTitle.textContent = '地点管理';
  backBtn.style.display = 'none';
  currentLocationId = null;
  loadLocations();
}

function showPhotos(locationId, locationTitle) {
  locationsView.classList.remove('active');
  photosView.classList.add('active');
  pageTitle.textContent = locationTitle + ' - 照片管理';
  backBtn.style.display = '';
  currentLocationId = locationId;
  loadPhotos(locationId);
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

backBtn.addEventListener('click', showLocations);

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
        ? `<img class="card-cover" src="${loc.cover}" alt="${loc.title}">`
        : `<div class="card-cover-placeholder">🏞</div>`
      }
      <div class="card-info">
        <div class="card-title">${escapeHtml(loc.title)}</div>
        <div class="card-meta">${loc.photo_count || 0} 张照片</div>
      </div>
      <div class="card-actions">
        <button class="btn btn-sm btn-primary" onclick="openPhotos(${loc.id}, '${escapeHtml(loc.title)}')">管理照片</button>
        <button class="btn btn-sm btn-ghost" onclick="openEditLocation(${loc.id})">编辑</button>
        <button class="btn btn-sm btn-danger" onclick="confirmDeleteLocation(${loc.id}, '${escapeHtml(loc.title)}')">删除</button>
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

// 打开照片管理
window.openPhotos = function(id, title) {
  showPhotos(id, title);
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
  reader.readAsDataURL(file);
});

function openCropper(imageSrc) {
  // 销毁旧的 cropper 实例
  if (cropper) { cropper.destroy(); cropper = null; }
  croppedBlob = null;

  const container = document.querySelector('.crop-container');
  // 先重置容器尺寸
  container.style.width = '';
  container.style.height = '';

  cropImage.src = imageSrc;
  cropModal.classList.add('active');

  // 等图片加载后，根据原始尺寸调整容器，再初始化 Cropper
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
    width: 460,   // 输出宽度（230 的 2x，保证清晰度）
    height: 680,  // 输出高度（340 的 2x）
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high',
  });

  canvas.toBlob((blob) => {
    croppedBlob = blob;
    // 显示裁剪后的预览
    const url = URL.createObjectURL(blob);
    coverPreview.src = url;
    coverPreview.style.display = '';
    coverPlaceholder.style.display = 'none';
    // 关闭裁剪框
    closeCropper();
  }, 'image/jpeg', 0.92);
});

cropCancelBtn.addEventListener('click', () => {
  closeCropper();
  // 清空文件选择
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
  // 优先使用裁剪后的图片，否则使用原始文件
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

// ===== 照片管理 =====

async function loadPhotos(locationId) {
  try {
    const photos = await request(`/locations/${locationId}/photos`);
    renderPhotos(photos);
  } catch (e) {
    if (e.message !== '未登录') showToast('加载失败: ' + e.message);
  }
}

function renderPhotos(photos) {
  if (photos.length === 0) {
    photosList.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <div class="empty-icon">📷</div>
        <p>暂无照片，通过上方区域上传</p>
      </div>`;
    return;
  }

  photosList.innerHTML = photos.map(p => `
    <div class="photo-card" draggable="true" data-id="${p.id}">
      <img src="${p.url}" alt="${escapeHtml(p.title || '')}" loading="lazy">
      <div class="photo-info">${escapeHtml(p.title || '无标题')}</div>
      <div class="photo-actions">
        <button class="btn btn-sm btn-ghost" onclick="openEditPhoto(${p.id}, '${escapeJs(p.title || '')}', '${escapeJs(p.desc || '')}')">编辑</button>
        <button class="btn btn-sm btn-danger" onclick="confirmDeletePhoto(${p.id})">删除</button>
      </div>
    </div>
  `).join('');

  // 拖拽排序
  initDragSort(photosList, '.photo-card', async (orderedIds) => {
    try {
      await request('/photos/sort', {
        method: 'PUT',
        body: JSON.stringify({ ids: orderedIds.map(Number) })
      });
      showToast('排序已保存');
    } catch (e) {
      showToast('排序保存失败');
    }
  });
}

// 上传照片
uploadBtn.addEventListener('click', () => photoUploadInput.click());

photoUploadInput.addEventListener('change', () => {
  if (photoUploadInput.files.length > 0) uploadPhotos(photoUploadInput.files);
});

// 拖拽上传
uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadArea.classList.add('drag-over');
});
uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.classList.remove('drag-over');
  if (e.dataTransfer.files.length > 0) uploadPhotos(e.dataTransfer.files);
});

async function uploadPhotos(files) {
  if (!currentLocationId) return;

  // 显示上传进度
  const progressEl = document.createElement('div');
  progressEl.className = 'upload-progress';
  progressEl.innerHTML = `
    <div class="progress-text">正在上传 ${files.length} 张照片...</div>
    <div class="progress-bar"><div class="progress-fill"></div></div>
  `;
  uploadArea.parentElement.insertAdjacentElement('afterend', progressEl);
  const fill = progressEl.querySelector('.progress-fill');
  const text = progressEl.querySelector('.progress-text');

  const formData = new FormData();
  for (let i = 0; i < files.length; i++) {
    formData.append('photos', files[i]);
  }

  try {
    // 模拟进度
    let progress = 0;
    const timer = setInterval(() => {
      progress = Math.min(progress + 5, 90);
      fill.style.width = progress + '%';
    }, 200);

    await request(`/locations/${currentLocationId}/photos`, {
      method: 'POST',
      body: formData
    });

    clearInterval(timer);
    fill.style.width = '100%';
    text.textContent = `上传完成！共 ${files.length} 张`;
    showToast('上传成功');

    setTimeout(() => {
      progressEl.remove();
      loadPhotos(currentLocationId);
    }, 1000);
  } catch (e) {
    text.textContent = '上传失败: ' + e.message;
    fill.style.background = 'var(--danger)';
    fill.style.width = '100%';
    setTimeout(() => progressEl.remove(), 3000);
  }

  // 清空 input
  photoUploadInput.value = '';
}

// 编辑照片
window.openEditPhoto = function(id, title, desc) {
  editingPhotoId = id;
  photoTitleInput.value = title;
  photoDescInput.value = desc;
  photoModal.classList.add('active');
};

photoSaveBtn.addEventListener('click', async () => {
  if (!editingPhotoId) return;
  try {
    photoSaveBtn.disabled = true;
    photoSaveBtn.textContent = '保存中...';
    await request(`/photos/${editingPhotoId}`, {
      method: 'PUT',
      body: JSON.stringify({
        title: photoTitleInput.value.trim(),
        desc: photoDescInput.value.trim()
      })
    });
    showToast('更新成功');
    photoModal.classList.remove('active');
    if (currentLocationId) loadPhotos(currentLocationId);
  } catch (e) {
    showToast('保存失败: ' + e.message);
  } finally {
    photoSaveBtn.disabled = false;
    photoSaveBtn.textContent = '保存';
  }
});

photoCancelBtn.addEventListener('click', () => photoModal.classList.remove('active'));

// 删除照片
window.confirmDeletePhoto = async function(id) {
  if (!confirm('确定删除这张照片吗？')) return;
  try {
    await request(`/photos/${id}`, { method: 'DELETE' });
    showToast('删除成功');
    if (currentLocationId) loadPhotos(currentLocationId);
  } catch (e) {
    showToast('删除失败: ' + e.message);
  }
};

// ===== 拖拽排序通用函数 =====

function initDragSort(container, selector, onSort) {
  let dragItem = null;

  container.querySelectorAll(selector).forEach(item => {
    item.addEventListener('dragstart', (e) => {
      dragItem = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    item.addEventListener('dragend', () => {
      if (dragItem) dragItem.classList.remove('dragging');
      dragItem = null;
      // 收集新顺序
      const ids = [...container.querySelectorAll(selector)].map(el => el.dataset.id);
      onSort(ids);
    });

    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (!dragItem || dragItem === item) return;
      const rect = item.getBoundingClientRect();
      const mid = rect.left + rect.width / 2;
      if (e.clientX < mid) {
        container.insertBefore(dragItem, item);
      } else {
        container.insertBefore(dragItem, item.nextSibling);
      }
    });
  });
}

// ===== 工具 =====

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeJs(str) {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
}

// ===== 初始化 =====

(function init() {
  // 如果有 token，尝试直接进入主页
  if (token) {
    // 验证 token 是否有效
    request('/locations')
      .then(() => showMain())
      .catch(() => showLogin());
  } else {
    showLogin();
  }
})();
