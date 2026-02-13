/* ===== 管理后台 - 照片管理 ===== */

const API = '/api';
let token = localStorage.getItem('admin_token') || '';

// 从 URL 参数获取地点信息
const urlParams = new URLSearchParams(window.location.search);
const locationId = urlParams.get('id');
const locationTitle = urlParams.get('title') || '照片管理';

let editingPhotoId = null; // 正在编辑的照片 ID

// ===== DOM 引用 =====
const pageTitle = document.getElementById('page-title');
const backBtn = document.getElementById('back-btn');
const logoutBtn = document.getElementById('logout-btn');
const photosList = document.getElementById('photos-list');
const uploadArea = document.getElementById('upload-area');
const photoUploadInput = document.getElementById('photo-upload');
const uploadBtn = document.getElementById('upload-btn');

// 模态框
const photoModal = document.getElementById('photo-modal');
const photoTitleInput = document.getElementById('photo-title');
const photoDescInput = document.getElementById('photo-desc');
const photoSaveBtn = document.getElementById('photo-save');
const photoCancelBtn = document.getElementById('photo-cancel');

const toastEl = document.getElementById('toast');

// 设置页面标题
pageTitle.textContent = `${locationTitle} - 照片管理`;

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
    goBack();
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

// ===== 导航 =====

function goBack() {
  window.location.href = 'index.html';
}

backBtn.addEventListener('click', goBack);

logoutBtn.addEventListener('click', () => {
  token = '';
  localStorage.removeItem('admin_token');
  goBack();
});

// ===== 参数校验 =====

if (!locationId) {
  alert('参数错误，缺少地点 ID');
  goBack();
}

// ===== 照片加载 =====

async function loadPhotos() {
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
        <p>暂无照片，拖拽或点击上方区域上传</p>
      </div>`;
    return;
  }

  photosList.innerHTML = photos.map(p => `
    <div class="photo-card" draggable="true" data-id="${p.id}">
      <img src="${p.url}" alt="${escapeHtml(p.title || '')}" loading="lazy">
      <div class="photo-info">${escapeHtml(p.title || '无标题')}</div>
      <div class="photo-actions">
        <button class="btn btn-sm btn-outline" onclick="openEditPhoto(${p.id}, '${escapeJs(p.title || '')}', '${escapeJs(p.desc || '')}')">编辑</button>
        <button class="btn btn-sm btn-outline-danger" onclick="confirmDeletePhoto(${p.id})">删除</button>
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

// ===== 照片上传 =====

uploadBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  photoUploadInput.click();
});

uploadArea.addEventListener('click', () => {
  photoUploadInput.click();
});

photoUploadInput.addEventListener('change', () => {
  if (photoUploadInput.files.length > 0) {
    uploadPhotos(photoUploadInput.files);
  }
});

// 拖拽上传
uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadArea.classList.add('drag-over');
});

uploadArea.addEventListener('dragleave', () => {
  uploadArea.classList.remove('drag-over');
});

uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.classList.remove('drag-over');
  const files = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'));
  if (files.length > 0) {
    uploadPhotos(files);
  }
});

async function uploadPhotos(files) {
  const formData = new FormData();
  for (const file of files) {
    formData.append('photos', file);
  }

  try {
    uploadBtn.disabled = true;
    showToast(`正在上传 ${files.length} 张照片...`, 10000);

    await request(`/locations/${locationId}/photos`, {
      method: 'POST',
      body: formData
    });

    showToast('上传成功');
    photoUploadInput.value = '';
    loadPhotos();
  } catch (e) {
    showToast('上传失败: ' + e.message);
  } finally {
    uploadBtn.disabled = false;
  }
}

// ===== 编辑照片 =====

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
    editingPhotoId = null;
    loadPhotos();
  } catch (e) {
    showToast('更新失败: ' + e.message);
  } finally {
    photoSaveBtn.disabled = false;
    photoSaveBtn.textContent = '保存';
  }
});

photoCancelBtn.addEventListener('click', () => {
  photoModal.classList.remove('active');
  editingPhotoId = null;
});

// 关闭模态框（点击背景）
document.querySelectorAll('.modal-backdrop').forEach(bd => {
  bd.addEventListener('click', () => {
    bd.parentElement.classList.remove('active');
    editingPhotoId = null;
  });
});

// ===== 删除照片 =====

window.confirmDeletePhoto = async function(id) {
  if (!confirm('确定删除这张照片吗？')) return;
  try {
    await request(`/photos/${id}`, { method: 'DELETE' });
    showToast('删除成功');
    loadPhotos();
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

// ===== 初始化 =====

(function init() {
  if (!token) {
    goBack();
    return;
  }
  // 验证 token 有效性
  request('/locations')
    .then(() => loadPhotos())
    .catch(() => goBack());
})();
