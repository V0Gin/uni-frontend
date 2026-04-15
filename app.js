// ===== State =====
let currentPath = [];      // Array of { id, name } representing navigation stack
let allFolders = [];       // Raw folder data from API
let selectedFiles = [];    // Files selected for upload
let activeTab = 'folders'; // Current active tab: 'folders' or 'recent'
let recentFiles = [];      // Cached recent files from API
let recentLoaded = false;  // Whether recent files have been fetched

const API_BASE = 'http://localhost:3000';

// ===== DOM References =====
const folderGrid = document.getElementById('folder-grid');
const breadcrumbList = document.getElementById('breadcrumb-list');
const loadingState = document.getElementById('loading-state');
const emptyState = document.getElementById('empty-state');
const errorState = document.getElementById('error-state');
const uploadPanel = document.getElementById('upload-panel');
const uploadOverlay = document.getElementById('upload-overlay');
const uploadForm = document.getElementById('upload-form');
const fileInput = document.getElementById('file-input');
const fileListEl = document.getElementById('file-list');
const dropZone = document.getElementById('drop-zone');
const uploadTargetPath = document.getElementById('upload-target-path');
const submitBtn = document.getElementById('submit-btn');
const submitBtnText = document.getElementById('submit-btn-text');
const submitSpinner = document.getElementById('submit-spinner');

// Recent uploads DOM references
const recentSection = document.getElementById('recent-section');
const recentGrid = document.getElementById('recent-grid');
const recentLoading = document.getElementById('recent-loading');
const recentEmpty = document.getElementById('recent-empty');
const recentError = document.getElementById('recent-error');
const folderSection = document.getElementById('folder-section');
const breadcrumbBar = document.getElementById('breadcrumb-bar');

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  loadFolders();
  setupDropZone();
});

// ===== Tab Switching =====
function switchTab(tab) {
  if (tab === activeTab) return;
  activeTab = tab;

  // Update tab button states
  document.getElementById('tab-folders').classList.toggle('active', tab === 'folders');
  document.getElementById('tab-recent').classList.toggle('active', tab === 'recent');

  if (tab === 'folders') {
    folderSection.classList.remove('hidden');
    breadcrumbBar.classList.remove('hidden');
    recentSection.classList.add('hidden');
  } else {
    folderSection.classList.add('hidden');
    breadcrumbBar.classList.add('hidden');
    recentSection.classList.remove('hidden');

    // Lazy-load recent files on first switch
    if (!recentLoaded) {
      loadRecentFiles();
    }
  }
}

// ===== Fetch Recent Files =====
async function loadRecentFiles() {
  showRecentState('loading');

  try {
    const res = await fetch(`${API_BASE}/recent`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    recentFiles = await res.json();
    recentLoaded = true;
    renderRecentFiles();
  } catch (err) {
    console.error('Failed to load recent files:', err);
    showRecentState('error');
  }
}

// ===== Show Recent State =====
function showRecentState(state) {
  recentGrid.classList.toggle('hidden', state !== 'content');
  recentLoading.classList.toggle('hidden', state !== 'loading');
  recentEmpty.classList.toggle('hidden', state !== 'empty');
  recentError.classList.toggle('hidden', state !== 'error');
}

// ===== Render Recent Files =====
function renderRecentFiles() {
  recentGrid.innerHTML = '';

  if (!recentFiles || recentFiles.length === 0) {
    showRecentState('empty');
    return;
  }

  showRecentState('content');

  recentFiles.forEach((file, i) => {
    const card = createRecentCard(file, i);
    recentGrid.appendChild(card);
  });
}

// ===== Create Recent Upload Card =====
function createRecentCard(file, index) {
  const card = document.createElement('div');
  card.className = 'recent-card';
  card.style.animationDelay = `${index * 40}ms`;

  const typeInfo = getFileTypeInfo(file.mimeType, file.name);
  const ext = getFileExtension(file.name);
  const timeText = formatRelativeTime(file.createdTime);

  card.innerHTML = `
    <div class="recent-card-icon ${typeInfo.colorClass}">
      ${typeInfo.icon}
    </div>
    <div class="recent-card-body">
      <div class="recent-card-header">
        <div class="recent-card-name">${escapeHTML(file.name || 'بدون اسم')}</div>
        <div class="recent-card-time">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          ${escapeHTML(timeText)}
        </div>
      </div>
      <div class="recent-card-details">
        ${file.uploaderName ? `
          <div class="recent-card-detail uploader">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            ${escapeHTML(file.uploaderName)}
          </div>
        ` : ''}
        <div class="recent-card-detail path">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          <span class="path-segments">${formatPathSegments(file.path)}</span>
        </div>
        ${file.size ? `
          <div class="recent-card-detail">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            ${formatFileSize(file.size)}
          </div>
        ` : ''}
        ${ext ? `
          <div class="recent-card-detail">
            <span style="font-weight:600;color:var(--primary-600);font-size:0.75rem;text-transform:uppercase;letter-spacing:0.5px;">${escapeHTML(ext)}</span>
          </div>
        ` : ''}
      </div>
    </div>
  `;

  return card;
}

// ===== Relative Time Formatting (Arabic) =====
function formatRelativeTime(dateStr) {
  if (!dateStr) return '';

  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);

  if (diffSec < 60) return 'الآن';
  if (diffMin < 2) return 'منذ دقيقة';
  if (diffMin < 60) return `منذ ${diffMin} دقيقة`;
  if (diffHr < 2) return 'منذ ساعة';
  if (diffHr < 24) return `منذ ${diffHr} ساعة`;
  if (diffDay < 2) return 'أمس';
  if (diffDay < 7) return `منذ ${diffDay} أيام`;
  if (diffWeek < 2) return 'منذ أسبوع';
  if (diffWeek < 4) return `منذ ${diffWeek} أسابيع`;
  if (diffMonth < 2) return 'منذ شهر';
  if (diffMonth < 12) return `منذ ${diffMonth} أشهر`;

  // Fallback: formatted date
  return date.toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// ===== Fetch Folders =====
async function loadFolders() {
  showState('loading');

  try {
    const res = await fetch(`${API_BASE}/folders`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    allFolders = await res.json();
    renderCurrentView();
  } catch (err) {
    console.error('Failed to load folders:', err);
    showState('error');
  }
}

// ===== Render Current View =====
function renderCurrentView() {
  const items = getItemsAtPath();
  const folderGrid = document.getElementById('folder-grid');
  const filesSection = document.getElementById('files-section');

  folderGrid.innerHTML = '';
  filesSection.classList.add('hidden');

  if (!items || items.length === 0) {
    showState('empty');
    return;
  }

  // Only show folders, ignore files
  const folders = items.filter(item =>
    item.type === 'folder' || item.children || item.subfolders || item.folders || item.items
  );

  if (folders.length === 0) {
    showState('empty');
    return;
  }

  showState('content');

  folders.forEach((item, i) => {
    const card = createFolderCard(item, i);
    folderGrid.appendChild(card);
  });
}

// ===== Get Items at Current Path =====
function getItemsAtPath() {
  if (currentPath.length === 0) {
    return allFolders;
  }

  // Traverse the folder tree following currentPath
  let node = allFolders;
  for (const segment of currentPath) {
    const found = Array.isArray(node)
      ? node.find(f => f.id === segment.id || f.name === segment.name)
      : null;

    if (!found) return [];

    // Children could be in various properties
    node = found.children || found.subfolders || found.folders || found.items || [];
  }

  return Array.isArray(node) ? node : [];
}

// ===== Create Folder Card =====
function createFolderCard(item, index) {
  const card = document.createElement('div');
  card.className = 'folder-card';
  card.style.animationDelay = `${index * 40}ms`;

  const isFolder = item.type === 'folder' ||
    item.children ||
    item.subfolders ||
    item.folders ||
    item.items ||
    !item.type;

  const iconClass = isFolder ? 'folder' : 'file';
  const iconSVG = isFolder
    ? `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
         <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
       </svg>`
    : `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
         <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
         <polyline points="14 2 14 8 20 8"/>
       </svg>`;

  const childCount = getChildCount(item);
  const metaText = isFolder && childCount > 0
    ? `${childCount} عنصر`
    : (item.size ? formatFileSize(item.size) : '');

  card.innerHTML = `
    <div class="folder-card-icon ${iconClass}">
      ${iconSVG}
    </div>
    <div class="folder-card-name">${escapeHTML(item.name || item.title || 'بدون اسم')}</div>
    ${metaText ? `<div class="folder-card-meta">${metaText}</div>` : ''}
  `;

  if (isFolder) {
    card.addEventListener('click', () => {
      navigateInto(item);
    });
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        navigateInto(item);
      }
    });
  }

  return card;
}

// ===== Create File Card =====
function createFileCard(file, index) {
  const card = document.createElement('div');
  card.className = 'file-card';
  card.style.animationDelay = `${index * 50}ms`;

  // Determine file type for icon styling
  const typeInfo = getFileTypeInfo(file.mimeType, file.name);

  // Parse uploader name and description from the description field
  // Format: "Uploader: [name]\n[description text]"
  let uploaderName = '';
  let fileDescription = '';
  if (file.description) {
    const lines = file.description.split('\n');
    if (lines[0] && lines[0].startsWith('Uploader: ')) {
      uploaderName = lines[0].replace('Uploader: ', '');
      fileDescription = lines.slice(1).join('\n').trim();
    } else {
      uploaderName = file.description;
    }
  }

  // Build file extension badge
  const ext = getFileExtension(file.name);

  card.innerHTML = `
    <div class="file-card-icon ${typeInfo.colorClass}">
      ${typeInfo.icon}
    </div>
    <div class="file-card-body">
      <div class="file-card-header">
        <div class="file-card-name">${escapeHTML(file.name || 'بدون اسم')}</div>
        <div class="file-card-badges">
          ${ext ? `<span class="file-badge type">${escapeHTML(ext)}</span>` : ''}
          ${file.size ? `<span class="file-badge size">${formatFileSize(file.size)}</span>` : ''}
        </div>
      </div>
      <div class="file-card-meta">
        ${uploaderName ? `
          <div class="file-card-uploader">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            ${escapeHTML(uploaderName)}
          </div>
        ` : ''}
      </div>
      ${fileDescription ? `<div class="file-card-description">${escapeHTML(fileDescription)}</div>` : ''}
    </div>
  `;

  return card;
}

// ===== File Type Info =====
function getFileTypeInfo(mimeType, fileName) {
  const mime = (mimeType || '').toLowerCase();
  const name = (fileName || '').toLowerCase();

  // PDF
  if (mime.includes('pdf') || name.endsWith('.pdf')) {
    return {
      colorClass: 'pdf',
      icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>`,
    };
  }

  // Images
  if (mime.includes('image') || /\.(png|jpg|jpeg|gif|svg|webp|bmp)$/.test(name)) {
    return {
      colorClass: 'image',
      icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>`,
    };
  }

  // Word / Docs
  if (mime.includes('word') || mime.includes('document') || /\.(doc|docx)$/.test(name)) {
    return {
      colorClass: 'doc',
      icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
      </svg>`,
    };
  }

  // Sheets / Excel
  if (mime.includes('sheet') || mime.includes('excel') || /\.(xls|xlsx|csv)$/.test(name)) {
    return {
      colorClass: 'sheet',
      icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <rect x="8" y="12" width="8" height="6" rx="1"/>
      </svg>`,
    };
  }

  // Video
  if (mime.includes('video') || /\.(mp4|avi|mov|mkv|webm)$/.test(name)) {
    return {
      colorClass: 'video',
      icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="23 7 16 12 23 17 23 7"/>
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
      </svg>`,
    };
  }

  // Audio
  if (mime.includes('audio') || /\.(mp3|wav|ogg|flac|aac)$/.test(name)) {
    return {
      colorClass: 'audio',
      icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 18V5l12-2v13"/>
        <circle cx="6" cy="18" r="3"/>
        <circle cx="18" cy="16" r="3"/>
      </svg>`,
    };
  }

  // Archive
  if (mime.includes('zip') || mime.includes('rar') || mime.includes('archive') || /\.(zip|rar|7z|tar|gz)$/.test(name)) {
    return {
      colorClass: 'archive',
      icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 8v13H3V8"/>
        <path d="M1 3h22v5H1z"/>
        <path d="M10 12h4"/>
      </svg>`,
    };
  }

  // Presentation
  if (mime.includes('presentation') || mime.includes('powerpoint') || /\.(ppt|pptx)$/.test(name)) {
    return {
      colorClass: 'doc',
      icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <rect x="8" y="12" width="8" height="4" rx="1"/>
      </svg>`,
    };
  }

  // Generic file
  return {
    colorClass: 'generic',
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>`,
  };
}

// ===== Get File Extension =====
function getFileExtension(filename) {
  if (!filename) return '';
  const parts = filename.split('.');
  if (parts.length < 2) return '';
  return parts.pop().toUpperCase();
}

// ===== Navigation =====
function navigateInto(item) {
  currentPath.push({
    id: item.id,
    name: item.name || item.title || 'مجلد'
  });
  renderCurrentView();
  renderBreadcrumb();
  updateUploadTargetPath();
}

function navigateTo(index) {
  if (index === null) {
    currentPath = [];
  } else {
    currentPath = currentPath.slice(0, index + 1);
  }
  renderCurrentView();
  renderBreadcrumb();
  updateUploadTargetPath();
}

// ===== Breadcrumb =====
function renderBreadcrumb() {
  breadcrumbList.innerHTML = '';

  // Home item
  const homeLi = document.createElement('li');
  const homeBtn = document.createElement('button');
  homeBtn.className = `breadcrumb-item ${currentPath.length === 0 ? 'active' : ''}`;
  homeBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
    الرئيسية
  `;
  homeBtn.addEventListener('click', () => navigateTo(null));
  homeLi.appendChild(homeBtn);
  breadcrumbList.appendChild(homeLi);

  // Path items
  currentPath.forEach((seg, i) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.className = `breadcrumb-item ${i === currentPath.length - 1 ? 'active' : ''}`;
    btn.textContent = seg.name;
    btn.addEventListener('click', () => navigateTo(i));
    li.appendChild(btn);
    breadcrumbList.appendChild(li);
  });
}

// ===== Upload Panel =====
function toggleUploadPanel() {
  const isActive = uploadPanel.classList.contains('active');

  if (isActive) {
    uploadPanel.classList.remove('active');
    uploadOverlay.classList.remove('active');
    document.body.style.overflow = '';
  } else {
    uploadPanel.classList.add('active');
    uploadOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    updateUploadTargetPath();
  }
}

function updateUploadTargetPath() {
  if (currentPath.length === 0) {
    uploadTargetPath.textContent = 'الرئيسية';
  } else {
    uploadTargetPath.textContent = currentPath.map(s => s.name).join(' / ');
  }
}

// ===== File Selection =====
function handleFileSelect(event) {
  const files = Array.from(event.target.files);
  files.forEach(f => {
    // Avoid duplicates
    if (!selectedFiles.some(sf => sf.name === f.name && sf.size === f.size)) {
      selectedFiles.push(f);
    }
  });
  renderFileList();
  // Reset input so same file can be re-selected
  fileInput.value = '';
}

function removeFile(index) {
  selectedFiles.splice(index, 1);
  renderFileList();
}

function renderFileList() {
  fileListEl.innerHTML = '';

  selectedFiles.forEach((file, i) => {
    const li = document.createElement('li');
    li.className = 'file-list-item';
    li.innerHTML = `
      <div class="file-list-item-info">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        <span class="file-list-item-name">${escapeHTML(file.name)}</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <span class="file-list-item-size">${formatFileSize(file.size)}</span>
        <button type="button" class="file-remove-btn" onclick="removeFile(${i})" aria-label="إزالة الملف" title="إزالة">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    `;
    fileListEl.appendChild(li);
  });
}

// ===== Drag & Drop =====
function setupDropZone() {
  ['dragenter', 'dragover'].forEach(event => {
    dropZone.addEventListener(event, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(event => {
    dropZone.addEventListener(event, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('dragover');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    const files = Array.from(e.dataTransfer.files);
    files.forEach(f => {
      if (!selectedFiles.some(sf => sf.name === f.name && sf.size === f.size)) {
        selectedFiles.push(f);
      }
    });
    renderFileList();
  });
}

// ===== Upload Handler =====
async function handleUpload(event) {
  event.preventDefault();

  const name = document.getElementById('upload-name').value.trim();
  const description = document.getElementById('upload-description').value.trim();

  if (!name) {
    showToast('يرجى إدخال الاسم', 'error');
    return;
  }

  if (selectedFiles.length === 0) {
    showToast('يرجى اختيار ملف واحد على الأقل', 'error');
    return;
  }

  // Build FormData
  const formData = new FormData();
  formData.append('name', name);
  if (description) formData.append('description', description);

  // Append current path
  const pathStr = currentPath.map(s => s.name).join('/');
  formData.append('path', pathStr);

  // If we have folder IDs, send current folder id
  if (currentPath.length > 0) {
    const lastSeg = currentPath[currentPath.length - 1];
    if (lastSeg.id) formData.append('folderId', lastSeg.id);
  }

  selectedFiles.forEach(f => {
    formData.append('files', f);
  });

  // UI: loading state
  setUploadLoading(true);

  try {
    const res = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      throw new Error(errData?.message || `خطأ ${res.status}`);
    }

    showToast('تم رفع الملفات بنجاح ✓', 'success');
    resetUploadForm();
    toggleUploadPanel();

    // Refresh folders and recent files
    loadFolders();
    recentLoaded = false;
    if (activeTab === 'recent') {
      loadRecentFiles();
    }
  } catch (err) {
    console.error('Upload failed:', err);
    showToast(err.message || 'فشل رفع الملفات', 'error');
  } finally {
    setUploadLoading(false);
  }
}

function setUploadLoading(loading) {
  submitBtn.disabled = loading;
  submitBtnText.classList.toggle('hidden', loading);
  submitSpinner.classList.toggle('hidden', !loading);
}

function resetUploadForm() {
  uploadForm.reset();
  selectedFiles = [];
  renderFileList();
}

// ===== Toast Notifications =====
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');

  const iconSVG = type === 'success'
    ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
         <polyline points="20 6 9 17 4 12"/>
       </svg>`
    : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
         <circle cx="12" cy="12" r="10"/>
         <line x1="15" y1="9" x2="9" y2="15"/>
         <line x1="9" y1="9" x2="15" y2="15"/>
       </svg>`;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `${iconSVG}<span>${escapeHTML(message)}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('exit');
    toast.addEventListener('animationend', () => toast.remove());
  }, 3500);
}

// ===== State Management =====
function showState(state) {
  folderGrid.classList.toggle('hidden', state !== 'content');
  loadingState.classList.toggle('hidden', state !== 'loading');
  emptyState.classList.toggle('hidden', state !== 'empty');
  errorState.classList.toggle('hidden', state !== 'error');
}

// ===== Utilities =====
function getChildCount(item) {
  const children = item.children || item.subfolders || item.folders || item.items;
  return Array.isArray(children) ? children.length : 0;
}

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 بايت';
  const units = ['بايت', 'ك.ب', 'م.ب', 'ج.ب'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0);
  return `${val} ${units[i]}`;
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatPathSegments(pathStr) {
  if (!pathStr || pathStr === 'الرئيسية') {
    return `<span class="path-segment">الرئيسية</span>`;
  }

  const parts = pathStr.split(' / ').filter(p => p.trim());
  if (parts.length === 0) {
    return `<span class="path-segment">الرئيسية</span>`;
  }

  return parts.map((part, i) => {
    const separator = i < parts.length - 1
      ? '<span class="path-separator">‹</span>'
      : '';
    return `<span class="path-segment">${escapeHTML(part)}</span>${separator}`;
  }).join('');
}

