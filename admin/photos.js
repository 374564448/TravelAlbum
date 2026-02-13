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
      goBack();
    }, 1500);
  } catch (e) {
    pwdError.textContent = e.message || '修改失败';
  } finally {
    pwdSave.disabled = false;
    pwdSave.textContent = '确认修改';
  }
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

const uploadProgressPanel = document.getElementById('upload-progress');
const progressSummary = document.getElementById('progress-summary');
const progressTotalFill = document.getElementById('progress-total-fill');
const progressDetail = document.getElementById('progress-detail');
const progressToggle = document.getElementById('progress-toggle');

let isUploading = false;

// 折叠/展开明细
progressToggle.addEventListener('click', () => {
  uploadProgressPanel.classList.toggle('expanded');
});

uploadBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  photoUploadInput.click();
});

uploadArea.addEventListener('click', () => {
  photoUploadInput.click();
});

photoUploadInput.addEventListener('change', () => {
  if (photoUploadInput.files.length > 0) {
    uploadPhotos([...photoUploadInput.files]);
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

// 单张上传（XHR，支持 progress 事件）
function uploadSingleFile(file) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('photos', file);

    xhr.open('POST', `${API}/locations/${locationId}/photos`);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        file._progress = pct;
        updateProgressUI();
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        file._progress = 100;
        file._done = true;
        resolve();
      } else if (xhr.status === 401) {
        token = '';
        localStorage.removeItem('admin_token');
        goBack();
        reject(new Error('未登录'));
      } else {
        file._error = true;
        try {
          const data = JSON.parse(xhr.responseText);
          reject(new Error(data.error || '上传失败'));
        } catch {
          reject(new Error('上传失败'));
        }
      }
      updateProgressUI();
    });

    xhr.addEventListener('error', () => {
      file._error = true;
      updateProgressUI();
      reject(new Error('网络错误'));
    });

    xhr.send(formData);
  });
}

let uploadFileList = []; // 当前上传队列

function updateProgressUI() {
  const total = uploadFileList.length;
  const doneCount = uploadFileList.filter(f => f._done).length;
  const errorCount = uploadFileList.filter(f => f._error).length;
  const finishedCount = doneCount + errorCount;

  // 总进度 = 所有文件进度的平均值
  const totalProgress = total > 0
    ? Math.round(uploadFileList.reduce((sum, f) => sum + (f._progress || 0), 0) / total)
    : 0;

  // 摘要文字
  if (finishedCount === total) {
    if (errorCount > 0) {
      progressSummary.textContent = `上传完成 ${doneCount}/${total}（${errorCount} 张失败）`;
      progressTotalFill.className = 'progress-fill error';
    } else {
      progressSummary.textContent = `上传完成 ${doneCount}/${total}`;
      progressTotalFill.className = 'progress-fill done';
    }
  } else {
    progressSummary.textContent = `上传中 ${doneCount}/${total}`;
    progressTotalFill.className = 'progress-fill';
  }

  progressTotalFill.style.width = totalProgress + '%';

  // 明细列表
  progressDetail.innerHTML = uploadFileList.map((f, i) => {
    let statusClass, statusText;
    if (f._done) {
      statusClass = 'status-done';
      statusText = '已完成 ✓';
    } else if (f._error) {
      statusClass = 'status-error';
      statusText = '失败 ✗';
    } else if (f._progress > 0) {
      statusClass = 'status-uploading';
      statusText = `${f._progress}%`;
    } else {
      statusClass = 'status-waiting';
      statusText = '待上传';
    }
    return `<div class="progress-item">
      <span class="progress-filename" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span>
      <span class="progress-status ${statusClass}">${statusText}</span>
    </div>`;
  }).join('');
}

async function uploadPhotos(files) {
  if (isUploading) {
    showToast('有上传任务进行中，请等待完成');
    return;
  }

  isUploading = true;
  uploadBtn.disabled = true;
  uploadFileList = files;

  // 初始化每个文件的进度状态
  files.forEach(f => { f._progress = 0; f._done = false; f._error = false; });

  // 显示进度面板并展开
  uploadProgressPanel.style.display = '';
  uploadProgressPanel.classList.add('expanded');
  updateProgressUI();

  let successCount = 0;
  let errorCount = 0;

  for (const file of files) {
    try {
      await uploadSingleFile(file);
      successCount++;
    } catch (e) {
      errorCount++;
      console.error(`上传 ${file.name} 失败:`, e.message);
    }
  }

  // 完成
  updateProgressUI();
  photoUploadInput.value = '';
  isUploading = false;
  uploadBtn.disabled = false;

  if (successCount > 0) {
    showToast(errorCount > 0
      ? `上传完成：${successCount} 张成功，${errorCount} 张失败`
      : `全部上传成功（${successCount} 张）`
    );
    loadPhotos();
  } else {
    showToast('全部上传失败');
  }

  // 3 秒后自动隐藏面板（如果没有错误）
  if (errorCount === 0) {
    setTimeout(() => {
      uploadProgressPanel.style.display = 'none';
      uploadProgressPanel.classList.remove('expanded');
    }, 3000);
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
