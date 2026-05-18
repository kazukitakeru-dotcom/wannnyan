'use strict';

// ========== State ==========
let currentType = null; // 'dog' | 'cat'
let currentPetId = null;
let editMode = false;
let sortMode = 'name'; // 'name' | 'date'
let deletePendingId = null;
let tempPhotoData = null; // 編集中の写真データ

// ========== Storage ==========
function loadData() {
  try {
    return JSON.parse(localStorage.getItem('wannyan_data') || '{"dog":[],"cat":[]}');
  } catch (e) {
    return { dog: [], cat: [] };
  }
}

function saveData(data) {
  localStorage.setItem('wannyan_data', JSON.stringify(data));
}

function getData() {
  return loadData();
}

// ========== 犬/猫の問題項目定義 ==========
const ISSUES = {
  dog: [
    { key: 'walk',   icon: '🦮', label: '散歩' },
    { key: 'toilet', icon: '🚽', label: 'トイレ' },
    { key: 'bark',   icon: '📢', label: '吠え' },
    { key: 'bite',   icon: '🦷', label: '噛みつき' },
    { key: 'social', icon: '🤝', label: '慣れ' },
    { key: 'free',   icon: '📝', label: '自由記入' },
  ],
  cat: [
    { key: 'cry',     icon: '😿', label: '鳴き' },
    { key: 'dental',  icon: '🪥', label: '歯磨き' },
    { key: 'toilet',  icon: '🚽', label: 'トイレ' },
    { key: 'free',    icon: '📝', label: '自由記入' },
  ],
};

// ========== 画面遷移 ==========
function showScreen(id, direction = 'forward') {
  const screens = document.querySelectorAll('.screen');
  const target = document.getElementById(id);

  if (direction === 'forward') {
    screens.forEach(s => {
      if (s.classList.contains('active')) {
        s.classList.remove('active');
        s.classList.add('slide-out');
      }
    });
    target.classList.remove('slide-out');
    target.style.transform = 'translateX(100%)';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        target.style.transition = 'transform 0.35s cubic-bezier(0.4,0,0.2,1)';
        target.style.transform = 'translateX(0)';
        target.classList.add('active');
      });
    });
  } else {
    screens.forEach(s => {
      if (s.classList.contains('active')) {
        s.style.transition = 'transform 0.32s cubic-bezier(0.4,0,0.2,1)';
        s.style.transform = 'translateX(100%)';
        setTimeout(() => {
          s.classList.remove('active');
          s.style.transform = '';
          s.style.transition = '';
        }, 350);
      }
      if (s.classList.contains('slide-out')) {
        s.classList.remove('slide-out');
        s.classList.add('active');
        s.style.transform = 'translateX(-30%)';
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            s.style.transition = 'transform 0.32s cubic-bezier(0.4,0,0.2,1)';
            s.style.transform = 'translateX(0)';
            setTimeout(() => { s.style.transition = ''; s.style.transform = ''; }, 350);
          });
        });
      }
    });
  }
}

function selectType(type) {
  currentType = type;
  const listScreen = document.getElementById('screen-list');
  const detailScreen = document.getElementById('screen-detail');

  // 型クラス付与
  [listScreen, detailScreen].forEach(s => {
    s.className = `screen ${type}-type`;
  });

  document.getElementById('list-type-emoji').textContent = type === 'dog' ? '🐕' : '🐈';
  document.getElementById('list-type-name').textContent = type === 'dog' ? 'いぬ' : 'ねこ';

  showScreen('screen-list');
  renderList();
}

function goBack() {
  currentType = null;
  showScreen('screen-select', 'back');
}

function goToList() {
  editMode = false;
  currentPetId = null;
  tempPhotoData = null;
  showScreen('screen-list', 'back');
  renderList();
}

// ========== リスト表示 ==========
function calcAge(birthday) {
  if (!birthday) return null;
  const today = new Date();
  const bd = new Date(birthday);
  let years = today.getFullYear() - bd.getFullYear();
  let months = today.getMonth() - bd.getMonth();
  if (months < 0) { years--; months += 12; }
  if (today.getDate() < bd.getDate()) months--;
  if (months < 0) { years--; months += 12; }
  if (years === 0) return `${months}ヶ月`;
  return `${years}歳${months > 0 ? months + 'ヶ月' : ''}`;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function toHiragana(str) {
  return str.replace(/[\u30A1-\u30F6]/g, ch =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}

function renderList() {
  const data = getData();
  const pets = data[currentType] || [];
  const searchRaw = document.getElementById('search-input').value.trim();
  const search = toHiragana(searchRaw).toLowerCase();

  let filtered = pets;
  if (search) {
    filtered = pets.filter(p => {
      const nameH = toHiragana(p.name || '').toLowerCase();
      return nameH.includes(search);
    });
  }

  const sorted = [...filtered].sort((a, b) => {
    if (sortMode === 'name') {
      return (a.name || '').localeCompare(b.name || '', 'ja');
    } else {
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    }
  });

  const container = document.getElementById('pet-list');
  if (sorted.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-emoji">${currentType === 'dog' ? '🐕' : '🐈'}</div>
        <p>${search ? '検索結果がありません' : 'まだ登録がありません<br>＋ボタンから追加してみよう'}</p>
      </div>`;
    return;
  }

  container.innerHTML = sorted.map((pet, i) => {
    const ageText = pet.birthday ? calcAge(pet.birthday) : (pet.age || '不明');
    const photoHtml = pet.photo
      ? `<div class="pet-card-photo"><img src="${pet.photo}" alt="${pet.name}"></div>`
      : `<div class="pet-card-photo" style="font-size:30px">${currentType === 'dog' ? '🐕' : '🐈'}</div>`;
    return `
      <div class="pet-card" onclick="openDetail('${pet.id}')" style="animation-delay:${i * 0.04}s">
        ${photoHtml}
        <div class="pet-card-info">
          <div class="pet-card-name">${escHtml(pet.name)}</div>
          <div class="pet-card-meta">${ageText}</div>
        </div>
        <div class="pet-card-arrow">›</div>
      </div>`;
  }).join('');
}

function filterList() { renderList(); }

function sortList(mode) {
  sortMode = mode;
  document.getElementById('sort-name-btn').classList.toggle('active', mode === 'name');
  document.getElementById('sort-date-btn').classList.toggle('active', mode === 'date');
  renderList();
}

// ========== 詳細表示 ==========
function openDetail(id) {
  const data = getData();
  const pets = data[currentType] || [];
  const pet = pets.find(p => p.id === id);
  if (!pet) return;

  currentPetId = id;
  editMode = false;
  tempPhotoData = null;
  document.getElementById('detail-header-name').textContent = pet.name;

  renderDetailContent(pet, false);
  showScreen('screen-detail');

  const editBtn = document.getElementById('edit-toggle-btn');
  editBtn.textContent = '編集';
  editBtn.classList.remove('editing');
}

function renderDetailContent(pet, isEditing) {
  const container = document.getElementById('detail-content');
  const issues = ISSUES[currentType];

  const photoSrc = (isEditing && tempPhotoData) ? tempPhotoData : (pet.photo || null);
  const photoHtml = photoSrc
    ? `<img src="${photoSrc}" alt="${pet.name}">`
    : `<span style="font-size:60px">${currentType === 'dog' ? '🐕' : '🐈'}</span>`;

  // 年齢表示ロジック
  let ageDisplay = '', ageNote = '';
  if (pet.birthday) {
    ageDisplay = calcAge(pet.birthday);
  } else {
    ageDisplay = pet.age || '不明';
    ageNote = `（${todayStr()}時点）`;
  }

  // 問題フォルダHTML
  const issueHtml = issues.map(issue => {
    const issueData = (pet.issues || {})[issue.key] || { selected: [], memo: '' };
    const hasData = issueData.memo || (issueData.selected && issueData.selected.length > 0);

    // サブオプション（問題フォルダは実際にはフリーテキスト問題ではなく状況選択）
    // ここでは「この問題の状況メモ」として扱う
    const statusLabel = hasData
      ? `<span class="issue-folder-status status-noted">記録あり</span>`
      : `<span class="issue-folder-status status-none">未記録</span>`;

    const memoViewHtml = issueData.memo
      ? `<div class="memo-view">${escHtml(issueData.memo)}</div>`
      : `<div class="memo-view memo-empty">メモなし</div>`;

    const memoEditHtml = `<textarea class="field-input" rows="4" 
      id="issue-memo-${issue.key}" placeholder="状況メモを入力…">${escHtml(issueData.memo || '')}</textarea>`;

    return `
      <div class="issue-folder" id="folder-${issue.key}" onclick="toggleFolder('${issue.key}', event)">
        <div class="issue-folder-header">
          <span class="issue-folder-icon">${issue.icon}</span>
          <span class="issue-folder-name">${issue.label}</span>
          ${statusLabel}
          <span class="issue-chevron">›</span>
        </div>
        <div class="issue-folder-body" onclick="event.stopPropagation()">
          <p class="issue-memo-label">メモ</p>
          <div class="view-only">${memoViewHtml}</div>
          <div class="edit-only">${memoEditHtml}</div>
        </div>
      </div>`;
  }).join('');

  container.innerHTML = `
    <div class="${isEditing ? 'editing-mode' : ''}">
      <!-- 写真 -->
      <div class="detail-photo-wrap">
        <div class="detail-photo">${photoHtml}</div>
        <button class="photo-change-btn" onclick="changeDetailPhoto()">📷</button>
        <input type="file" id="detail-photo-input" accept="image/*" class="hidden" onchange="onDetailPhotoChange(event)">
      </div>

      <!-- 基本情報 -->
      <div class="detail-card">
        <div class="detail-card-title">基本情報</div>
        
        <div class="detail-field">
          <label class="field-label">名前</label>
          <div class="view-only field-value">${escHtml(pet.name)}</div>
          <div class="edit-only"><input type="text" class="field-input" id="edit-name" value="${escHtml(pet.name)}" placeholder="名前"></div>
        </div>

        <div class="detail-field">
          <label class="field-label">生年月日</label>
          <div class="view-only field-value">${pet.birthday ? formatBirthday(pet.birthday) : '未登録'}</div>
          <div class="edit-only"><input type="date" class="field-input" id="edit-birthday" value="${pet.birthday || ''}"></div>
        </div>

        <div class="detail-field">
          <label class="field-label">年齢</label>
          <div class="view-only field-value">
            ${escHtml(ageDisplay)}
            ${ageNote ? `<div class="field-age-note">${ageNote}</div>` : ''}
          </div>
          <div class="edit-only">
            <input type="text" class="field-input" id="edit-age" value="${escHtml(pet.age || '')}" placeholder="例: 3歳2ヶ月（生年月日未入力時）">
            <div class="field-age-note" style="margin-top:4px">生年月日を入力すると自動計算されます</div>
          </div>
        </div>
      </div>

      <!-- 問題フォルダ -->
      <div class="detail-card">
        <div class="detail-card-title">問題・気になること</div>
        <div class="issues-section">${issueHtml}</div>
      </div>

      <!-- メモ -->
      <div class="detail-card">
        <div class="detail-card-title">全体メモ</div>
        <div class="view-only">
          ${pet.memo
            ? `<div class="memo-view">${escHtml(pet.memo)}</div>`
            : `<div class="memo-view memo-empty">メモなし</div>`}
        </div>
        <div class="edit-only">
          <textarea class="field-input" id="edit-memo" rows="5" placeholder="自由にメモを書けます">${escHtml(pet.memo || '')}</textarea>
        </div>
      </div>

      <!-- 削除 -->
      <div class="edit-only">
        <button class="delete-btn" onclick="openDeleteModal()">この子の記録を削除する</button>
      </div>

      <button class="save-btn" onclick="savePet()">保存する</button>
    </div>`;

  // フォルダ状態を復元（開いていたもの）
  // アコーディオンは最初は閉じる
}

function formatBirthday(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function toggleFolder(key, event) {
  const folder = document.getElementById(`folder-${key}`);
  folder.classList.toggle('open');
}

function toggleEditMode() {
  const data = getData();
  const pets = data[currentType] || [];
  const pet = pets.find(p => p.id === currentPetId);
  if (!pet) return;

  editMode = !editMode;
  const btn = document.getElementById('edit-toggle-btn');

  if (editMode) {
    btn.textContent = 'キャンセル';
    btn.classList.add('editing');
    renderDetailContent(pet, true);
  } else {
    btn.textContent = '編集';
    btn.classList.remove('editing');
    tempPhotoData = null;
    renderDetailContent(pet, false);
  }
}

function changeDetailPhoto() {
  document.getElementById('detail-photo-input').click();
}

function onDetailPhotoChange(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    tempPhotoData = e.target.result;
    // 写真プレビュー更新
    const photoDiv = document.querySelector('.detail-photo');
    photoDiv.innerHTML = `<img src="${tempPhotoData}" alt="preview">`;
  };
  reader.readAsDataURL(file);
}

function savePet() {
  const nameVal = document.getElementById('edit-name')?.value.trim();
  if (!nameVal) { alert('名前を入力してください'); return; }

  const data = getData();
  const pets = data[currentType] || [];
  const idx = pets.findIndex(p => p.id === currentPetId);
  if (idx === -1) return;

  const pet = { ...pets[idx] };
  pet.name = nameVal;
  pet.birthday = document.getElementById('edit-birthday')?.value || '';
  pet.age = document.getElementById('edit-age')?.value.trim() || '';
  pet.memo = document.getElementById('edit-memo')?.value || '';
  pet.updatedAt = Date.now();

  if (tempPhotoData) pet.photo = tempPhotoData;

  // 問題メモ保存
  const issues = ISSUES[currentType];
  if (!pet.issues) pet.issues = {};
  issues.forEach(issue => {
    const memoEl = document.getElementById(`issue-memo-${issue.key}`);
    if (!pet.issues[issue.key]) pet.issues[issue.key] = {};
    pet.issues[issue.key].memo = memoEl ? memoEl.value : (pet.issues[issue.key].memo || '');
  });

  pets[idx] = pet;
  data[currentType] = pets;
  saveData(data);

  editMode = false;
  tempPhotoData = null;
  const btn = document.getElementById('edit-toggle-btn');
  btn.textContent = '編集';
  btn.classList.remove('editing');
  document.getElementById('detail-header-name').textContent = pet.name;
  renderDetailContent(pet, false);

  showToast('保存しました ✓');
}

// ========== 追加 ==========
function openAddModal() {
  document.getElementById('new-name').value = '';
  document.getElementById('new-birthday').value = '';
  document.getElementById('new-age').value = '';
  document.getElementById('new-photo-preview').src = '';
  document.getElementById('new-photo-preview').classList.add('hidden');
  document.getElementById('new-photo-placeholder').classList.remove('hidden');
  tempPhotoData = null;
  document.getElementById('modal-add').classList.add('open');
}

function closeAddModal() {
  document.getElementById('modal-add').classList.remove('open');
  tempPhotoData = null;
}

function closeModal(event) {
  if (event.target === event.currentTarget) closeAddModal();
}

function previewNewPhoto(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    tempPhotoData = e.target.result;
    const preview = document.getElementById('new-photo-preview');
    preview.src = e.target.result;
    preview.classList.remove('hidden');
    document.getElementById('new-photo-placeholder').classList.add('hidden');
  };
  reader.readAsDataURL(file);
}

function addPet() {
  const name = document.getElementById('new-name').value.trim();
  if (!name) { alert('名前を入力してください'); return; }

  const birthday = document.getElementById('new-birthday').value;
  const age = document.getElementById('new-age').value.trim();

  const pet = {
    id: 'pet_' + Date.now() + '_' + Math.random().toString(36).slice(2),
    name,
    birthday,
    age,
    photo: tempPhotoData || null,
    memo: '',
    issues: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const data = getData();
  if (!data[currentType]) data[currentType] = [];
  data[currentType].push(pet);
  saveData(data);

  closeAddModal();
  renderList();
  showToast('追加しました ✓');
}

// ========== 削除 ==========
function openDeleteModal() {
  deletePendingId = currentPetId;
  document.getElementById('modal-delete').classList.add('open');
}

function closeDeleteModal(event) {
  if (!event || event.target === event.currentTarget) {
    document.getElementById('modal-delete').classList.remove('open');
    deletePendingId = null;
  }
}

function confirmDelete() {
  if (!deletePendingId) return;
  const data = getData();
  data[currentType] = (data[currentType] || []).filter(p => p.id !== deletePendingId);
  saveData(data);
  deletePendingId = null;
  document.getElementById('modal-delete').classList.remove('open');
  goToList();
  showToast('削除しました');
}

// ========== Toast ==========
function showToast(msg) {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.textContent = msg;
  toast.style.cssText = `
    position: fixed;
    bottom: 100px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(44,36,24,0.85);
    color: white;
    padding: 10px 20px;
    border-radius: 20px;
    font-size: 14px;
    font-weight: 600;
    z-index: 9999;
    white-space: nowrap;
    animation: toastIn 0.3s ease;
  `;
  document.body.appendChild(toast);

  const style = document.createElement('style');
  style.textContent = `@keyframes toastIn { from { opacity:0; transform:translateX(-50%) translateY(10px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }`;
  document.head.appendChild(style);

  setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(() => toast.remove(), 300); }, 2000);
}

// ========== Utility ==========
function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ========== SW Registration ==========
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
