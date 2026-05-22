'use strict';

// ========== State ==========
let currentType = null;
let currentPetId = null;
let editMode = false;
let surveyEditMode = false;
let sortMode = 'name';
let deletePendingId = null;
let tempPhotoData = null;
let breedSortMode = 'group';
let breedCallback = null; // 犬種選択後のコールバック
let currentFamilyTagFilter = null; // 家族タグフィルター

// ========== Storage ==========
function loadData() {
  try { return JSON.parse(localStorage.getItem('wannyan_v2') || '{"dog":[],"cat":[]}'); }
  catch(e) { return {dog:[],cat:[]}; }
}
function saveData(data) { localStorage.setItem('wannyan_v2', JSON.stringify(data)); }

// ========== 共通病院データ（全ペット共通） ==========
function loadHospitals() {
  try { return JSON.parse(localStorage.getItem('wannyan_hospitals_v1') || '[]'); }
  catch(e) { return []; }
}
function saveHospitals(list) { localStorage.setItem('wannyan_hospitals_v1', JSON.stringify(list)); }

// ========== 問題定義 ==========
const ISSUES = {
  dog: [
    {key:'walk',   icon:'🦮', label:'散歩'},
    {key:'toilet', icon:'🚽', label:'トイレ'},
    {key:'bark',   icon:'📢', label:'吠え'},
    {key:'bite',   icon:'🦷', label:'噛みつき'},
    {key:'social', icon:'🤝', label:'慣れ'},
    {key:'free',   icon:'📝', label:'自由記入'},
  ],
  cat: [
    {key:'cry',    icon:'😿', label:'鳴き'},
    {key:'dental', icon:'🪥', label:'歯磨き'},
    {key:'toilet', icon:'🚽', label:'トイレ'},
    {key:'free',   icon:'📝', label:'自由記入'},
  ],
};

// 散歩道具
const WALK_TOOLS = ['ハーネス','リード','首輪','ダブルリード','フレキシリード','バギー','抱っこ紐'];
// 性格
const PERSONALITY_OPTIONS = ['おとなしい','わんぱく','元気','甘えん坊','臆病','好奇心旺盛','マイペース'];

// ========== 画面遷移 ==========
function showScreen(id, direction = 'forward') {
  const all = document.querySelectorAll('.screen');
  const target = document.getElementById(id);
  if (direction === 'forward') {
    all.forEach(s => {
      if (s.classList.contains('active')) { s.classList.remove('active'); s.classList.add('slide-out'); }
    });
    target.style.transform = 'translateX(100%)';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      target.style.transition = 'transform 0.35s cubic-bezier(0.4,0,0.2,1)';
      target.style.transform = 'translateX(0)';
      target.classList.add('active');
    }));
  } else {
    all.forEach(s => {
      if (s.classList.contains('active')) {
        s.style.transition = 'transform 0.32s cubic-bezier(0.4,0,0.2,1)';
        s.style.transform = 'translateX(100%)';
        setTimeout(() => { s.classList.remove('active'); s.style.transform=''; s.style.transition=''; }, 350);
      }
      if (s.classList.contains('slide-out')) {
        s.classList.remove('slide-out'); s.classList.add('active');
        s.style.transform = 'translateX(-30%)';
        requestAnimationFrame(() => requestAnimationFrame(() => {
          s.style.transition = 'transform 0.32s cubic-bezier(0.4,0,0.2,1)';
          s.style.transform = 'translateX(0)';
          setTimeout(() => { s.style.transition=''; s.style.transform=''; }, 350);
        }));
      }
    });
  }
}

function applyTypeClass(type) {
  ['screen-list','screen-detail','screen-folder','screen-survey'].forEach(id => {
    const el = document.getElementById(id);
    el.className = `screen ${type}-type`;
  });
}

function selectType(type) {
  currentType = type;
  currentFamilyTagFilter = null;
  applyTypeClass(type);
  document.getElementById('list-type-emoji').textContent = type==='dog'?'🐕':'🐈';
  document.getElementById('list-type-name').textContent  = type==='dog'?'いぬ':'ねこ';
  showScreen('screen-list');
  renderList();
}

function goBack() { currentType=null; showScreen('screen-select','back'); }
function goToList() {
  editMode=false; currentPetId=null; tempPhotoData=null;
  showScreen('screen-list','back'); renderList();
}
function openIssueFolder() { showScreen('screen-folder'); renderFolderScreen(); }
function closeIssueFolder() { showScreen('screen-list','back'); }
function closeSurvey() { showScreen('screen-detail','back'); }

// ========== ユーティリティ ==========
function escHtml(s) {
  return String(s||'').replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>').replace(/"/g,'"');
}
function calcAge(bday) {
  if (!bday) return null;
  const t=new Date(), b=new Date(bday);
  let y=t.getFullYear()-b.getFullYear(), m=t.getMonth()-b.getMonth();
  if(m<0){y--;m+=12;} if(t.getDate()<b.getDate())m--;
  if(m<0){y--;m+=12;}
  return y===0?`${m}ヶ月`:`${y}歳${m>0?m+'ヶ月':''}`;
}
function todayStr() { const d=new Date(); return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`; }
function formatDate(dateStr) {
  if(!dateStr)return '';
  const d=new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;
}
function formatTs(ts) {
  if(!ts)return '';
  const d=new Date(ts);
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
}
function toHiragana(s) {
  return String(s||'').replace(/[\u30A1-\u30F6]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60));
}

// ========== リスト表示 ==========
function renderList() {
  const data = loadData();
  const pets = data[currentType]||[];
  const rawSearch = document.getElementById('search-input').value.trim();
  const search = toHiragana(rawSearch).toLowerCase();

  // 家族タグフィルター
  let filtered = search ? pets.filter(p=>
    toHiragana(p.name||'').toLowerCase().includes(search) ||
    toHiragana(p.breed||'').toLowerCase().includes(search)
  ) : pets;
  if (currentFamilyTagFilter) {
    filtered = filtered.filter(p => (p.familyTag||'') === currentFamilyTagFilter);
  }

  const sorted = [...filtered].sort((a,b)=>
    sortMode==='name' ? (a.name||'').localeCompare(b.name||'','ja') : (b.updatedAt||0)-(a.updatedAt||0)
  );

  // 家族タグチップバーを描画
  renderFamilyTagBar(pets);

  const container = document.getElementById('pet-list');
  if(!sorted.length){
    container.innerHTML=`<div class="empty-state"><div class="empty-emoji">${currentType==='dog'?'🐕':'🐈'}</div><p>${search||currentFamilyTagFilter?'検索結果がありません':'まだ登録がありません<br>＋ボタンから追加しよう'}</p></div>`;
    return;
  }
  container.innerHTML = sorted.map((pet,i)=>{
    const age = pet.birthday ? calcAge(pet.birthday) : (pet.age||'不明');
    const photoHtml = pet.photo
      ? `<div class="pet-card-photo"><img src="${pet.photo}" alt="${escHtml(pet.name)}"></div>`
      : `<div class="pet-card-photo">${currentType==='dog'?'🐕':'🐈'}</div>`;
    const genderIcon = pet.gender==='オス'?'♂':pet.gender==='メス'?'♀':'';
    // 続柄スタンプ
    const roleStamp = pet.familyRole ? `<div class="role-stamp">${escHtml(pet.familyRole)}</div>` : '';
    return `<div class="pet-card" onclick="openDetail('${pet.id}')" style="animation-delay:${i*0.04}s">
      <div class="pet-card-photo-wrap">
        ${photoHtml}
        ${roleStamp}
      </div>
      <div class="pet-card-info">
        <div class="pet-card-name">${escHtml(pet.name)} ${genderIcon}</div>
        <div class="pet-card-meta">${escHtml(pet.breed||'')} ${age}</div>
        ${pet.familyTag ? `<div class="pet-card-family-tag">${escHtml(pet.familyTag)}</div>` : ''}
      </div>
      <div class="pet-card-arrow">›</div>
    </div>`;
  }).join('');
}

function renderFamilyTagBar(pets) {
  const bar = document.getElementById('family-tag-bar');
  if (!bar) return;
  const tags = [...new Set(pets.map(p=>p.familyTag).filter(Boolean))];
  if (tags.length === 0) { bar.innerHTML = ''; bar.style.display = 'none'; return; }
  bar.style.display = 'flex';
  bar.innerHTML = `
    <div class="family-tag-chip ${!currentFamilyTagFilter?'active':''}" onclick="setFamilyTagFilter(null)">すべて</div>
    ${tags.map(t=>`<div class="family-tag-chip ${currentFamilyTagFilter===t?'active':''}" onclick="setFamilyTagFilter('${escHtml(t)}')">${escHtml(t)}</div>`).join('')}
  `;
}

function setFamilyTagFilter(tag) {
  currentFamilyTagFilter = tag;
  renderList();
}
function filterList() { renderList(); }
function sortList(mode) {
  sortMode=mode;
  document.getElementById('sort-name-btn').classList.toggle('active',mode==='name');
  document.getElementById('sort-date-btn').classList.toggle('active',mode==='date');
  renderList();
}

// 全ペットから家族タグ一覧を取得（サジェスト用）
function getAllFamilyTags() {
  const data = loadData();
  const tags = new Set();
  ['dog','cat'].forEach(t => (data[t]||[]).forEach(p => { if(p.familyTag) tags.add(p.familyTag); }));
  return [...tags];
}

// ========== 詳細 ==========
function openDetail(id) {
  const data=loadData(); const pet=(data[currentType]||[]).find(p=>p.id===id);
  if(!pet)return;
  currentPetId=id; editMode=false; tempPhotoData=null;
  document.getElementById('detail-header-name').textContent=pet.name;
  renderDetailContent(pet,false);
  showScreen('screen-detail');
  const btn=document.getElementById('edit-toggle-btn');
  btn.textContent='編集'; btn.classList.remove('editing');
}

function renderDetailContent(pet, isEditing) {
  const container = document.getElementById('detail-content');
  const issues = ISSUES[currentType];

  // 写真
  const photoSrc = (isEditing&&tempPhotoData)?tempPhotoData:(pet.photo||null);
  const photoInner = photoSrc
    ? `<img src="${photoSrc}" alt="${escHtml(pet.name)}">`
    : `<span>${currentType==='dog'?'🐕':'🐈'}</span>`;

  // 年齢
  let ageDisplay='', ageNote='';
  if(pet.birthday){ ageDisplay=calcAge(pet.birthday)||''; }
  else { ageDisplay=pet.age||'不明'; ageNote=`（${todayStr()}時点）`; }

  // 犬種・猫種（両対応）
  let breedSection = '';
  if(currentType==='dog' || currentType==='cat') {
    const breedLabel = currentType==='dog'?'犬種':'猫種';
    const breedVal = pet.breed||'';
    const isMixed = breedVal==='雑種';
    const breedViewHtml = breedVal || '未設定';
    const mixedViewHtml = isMixed ? (pet.parent1||pet.parent2 ? `親1：${escHtml(pet.parent1||'不明')}　親2：${escHtml(pet.parent2||'不明')}` : '') : '';
    breedSection = `
      <div class="detail-field">
        <label class="field-label">${breedLabel}</label>
        <div class="view-only field-value">${escHtml(breedViewHtml)}${mixedViewHtml?`<div class="field-age-note">${mixedViewHtml}</div>`:''}</div>
        <div class="edit-only">
          <button class="breed-display-btn" onclick="openBreedModal()" id="breed-btn">
            <span id="breed-btn-label" class="${breedVal?'':'placeholder'}">${breedVal||`タップして${breedLabel}を選択`}</span>
            <span>›</span>
          </button>
          <input type="hidden" id="edit-breed" value="${escHtml(pet.breed||'')}">
          <div id="mixed-parents-wrap" class="mixed-parents" style="margin-top:8px;display:${isMixed?'flex':'none'}">
            <input type="text" class="field-input" id="edit-parent1" placeholder="親1の${breedLabel}" value="${escHtml(pet.parent1||'')}">
            <input type="text" class="field-input" id="edit-parent2" placeholder="親2の${breedLabel}" value="${escHtml(pet.parent2||'')}">
          </div>
        </div>
      </div>`;
  }

  // 問題フォルダ
  const issueHtml = issues.map(issue=>{
    const d=(pet.issues||{})[issue.key]||{memo:''};
    const hasData=!!(d.memo);
    const statusLabel = hasData
      ? `<span class="issue-folder-status status-noted">記録あり</span>`
      : `<span class="issue-folder-status status-none">未記録</span>`;
    const memoView = d.memo
      ? `<div class="memo-view">${escHtml(d.memo)}</div>`
      : `<div class="memo-view memo-empty">メモなし</div>`;
    return `<div class="issue-folder" id="folder-${issue.key}" onclick="toggleFolder('${issue.key}',event)">
      <div class="issue-folder-header">
        <span class="issue-folder-icon">${issue.icon}</span>
        <span class="issue-folder-name">${issue.label}</span>
        ${statusLabel}
        <span class="issue-chevron">›</span>
      </div>
      <div class="issue-folder-body" onclick="event.stopPropagation()">
        <p class="issue-memo-label">状況メモ</p>
        <div class="view-only">${memoView}</div>
        <div class="edit-only"><textarea class="field-input" id="issue-memo-${issue.key}" rows="3" placeholder="状況メモを入力…">${escHtml(d.memo||'')}</textarea></div>
      </div>
    </div>`;
  }).join('');

  // 性別選択
  const genders=['オス','メス','不明'];
  const genderViewHtml = pet.gender||'未設定';
  const genderEditHtml = genders.map(g=>`<button class="gender-btn${pet.gender===g?' selected':''}" onclick="selectGender(this,'${g}')">${g==='オス'?'♂ オス':g==='メス'?'♀ メス':'❓ 不明'}</button>`).join('');

  // 登録日バッジと病院記録ボタンの縦並びヘッダー（閲覧・編集モード共通の丸い顔写真をベースに構築）
  const headerHtml = `
    <div class="detail-header-meta-wrap">
      <span class="reg-date-badge">登録日 ${formatTs(pet.createdAt)}</span>
      ${!isEditing ? `<button class="detail-hospital-records-btn-new" onclick="openHospitalRecords('${pet.id}')">🏥 病院記録・ケア</button>` : ''}
    </div>
    <div class="detail-photo-wrap">
      <div class="detail-photo">${photoInner}</div>
      <button class="photo-change-btn" onclick="changeDetailPhoto()">📷</button>
      <input type="file" id="detail-photo-input" accept="image/*,image/heic,image/heif" class="hidden" onchange="onDetailPhotoChange(event)">
    </div>`;

  container.innerHTML = `<div class="${isEditing?'editing-mode':''}">
    ${headerHtml}
    
    <div class="detail-card">
      <div class="detail-card-title">基本情報</div>
      <div class="detail-field">
        <label class="field-label">名前</label>
        <div class="view-only field-value">${escHtml(pet.name)}</div>
        <div class="edit-only"><input type="text" class="field-input" id="edit-name" value="${escHtml(pet.name)}" placeholder="名前"></div>
      </div>
      <div class="detail-field">
        <label class="field-label">性別</label>
        <div class="view-only field-value">${genderViewHtml}</div>
        <div class="edit-only"><div class="gender-select">${genderEditHtml}</div><input type="hidden" id="edit-gender" value="${escHtml(pet.gender||'')}"></div>
      </div>
      <div class="detail-field">
        <label class="field-label">生年月日</label>
        <div class="view-only field-value">${pet.birthday?formatDate(pet.birthday):'未登録'}</div>
        <div class="edit-only"><input type="date" class="field-input" id="edit-birthday" value="${pet.birthday||''}"></div>
      </div>
      <div class="detail-field">
        <label class="field-label">年齢</label>
        <div class="view-only field-value">${escHtml(ageDisplay)}${ageNote?`<div class="field-age-note">${ageNote}</div>`:''}</div>
        <div class="edit-only">
          <input type="text" class="field-input" id="edit-age" value="${escHtml(pet.age||'')}" placeholder="例: 3歳2ヶ月（生年月日未入力時）">
          <div class="field-age-note" style="margin-top:4px">生年月日を入力すると自動計算されます</div>
        </div>
      </div>
      <div class="detail-field">
        <label class="field-label">体重</label>
        <div class="view-only field-value">${pet.weight?(escHtml(pet.weight)+'kg'):'未設定'}</div>
        <div class="edit-only">
          <div style="display:flex;align-items:center;gap:6px">
            <input type="number" class="field-input" id="edit-weight" value="${escHtml(pet.weight||'')}" placeholder="0.0" step="0.1" min="0" style="flex:1">
            <span style="font-size:14px;color:var(--text-light);white-space:nowrap">kg</span>
          </div>
        </div>
      </div>
      ${breedSection}
      <div class="detail-field">
        <label class="field-label">🏠 家族タグ（グループ名）</label>
        <div class="view-only field-value">${escHtml(pet.familyTag||'未設定')}</div>
        <div class="edit-only">
          <input type="text" class="field-input" id="edit-family-tag" value="${escHtml(pet.familyTag||'')}" placeholder="例: 山田家、実家、〇〇さん宅" list="family-tag-suggestions">
          <datalist id="family-tag-suggestions">${getAllFamilyTags().map(t=>`<option value="${escHtml(t)}">`).join('')}</datalist>
        </div>
      </div>
      <div class="detail-field">
        <label class="field-label">🏷 続柄・立ち位置</label>
        <div class="view-only field-value">${escHtml(pet.familyRole||'未設定')}</div>
        <div class="edit-only">
          <input type="text" class="field-input" id="edit-family-role" value="${escHtml(pet.familyRole||'')}" placeholder="例: 長男、次女、保護っ子、お空組">
        </div>
        </div>
    </div>
    <div class="detail-card">
      <div class="detail-card-title">問題・気になること</div>
      ${issueHtml}
    </div>
    <div class="detail-card">
      <div class="detail-card-title">全体メモ</div>
      <div class="view-only">${pet.memo?`<div class="memo-view">${escHtml(pet.memo)}</div>`:`<div class="memo-view memo-empty">メモなし</div>`}</div>
      <div class="edit-only"><textarea class="field-input" id="edit-memo" rows="4" placeholder="自由にメモを書けます">${escHtml(pet.memo||'')}</textarea></div>
    </div>
    <div class="detail-card">
      <div class="detail-card-title">📋 アンケート</div>
      <button class="survey-open-btn" onclick="openSurvey('${pet.id}')">📋 アンケートを見る・記入する</button>
    </div>
    <div class="edit-only">
      <button class="delete-btn" onclick="openDeleteModal()">この子の記録を削除する</button>
    </div>
    <button class="save-btn" onclick="savePet()">保存する</button>
  </div>`;
}

function selectGender(btn, val) {
  btn.closest('.gender-select').querySelectorAll('.gender-btn').forEach(b=>b.classList.remove('selected'));
  btn.classList.add('selected');
  document.getElementById('edit-gender').value = val;
}

function toggleFolder(key, event) {
  document.getElementById(`folder-${key}`).classList.toggle('open');
}

function toggleEditMode() {
  const data=loadData(); const pet=(data[currentType]||[]).find(p=>p.id===currentPetId);
  if(!pet)return;
  editMode=!editMode;
  const btn=document.getElementById('edit-toggle-btn');
  if(editMode){ btn.textContent='キャンセル'; btn.classList.add('editing'); renderDetailContent(pet,true); }
  else { btn.textContent='編集'; btn.classList.remove('editing'); tempPhotoData=null; renderDetailContent(pet,false); }
}

function changeDetailPhoto() { document.getElementById('detail-photo-input').click(); }

function onDetailPhotoChange(event) {
  const file=event.target.files[0]; if(!file)return;
  compressAndLoad(file, data => {
    tempPhotoData=data;
    document.querySelector('.detail-photo').innerHTML=`<img src="${data}" alt="preview">`;
  });
}

// ========== 画像圧縮（HEIC対応・既存base64データ対応） ==========
function compressAndLoad(file, callback) {
  const reader=new FileReader();
  reader.onload=e=>{
    const src = e.target.result;
    _compressFromDataUrl(src, callback);
  };
  reader.readAsDataURL(file);
}

// インポートデータ内の既存base64 / 新規ファイルどちらも圧縮できる共通処理
// ※通常の新規ファイル読み込み用（失敗時は元データを返す）
function _compressFromDataUrl(src, callback) {
  const img=new Image();
  img.onload=()=>{
    const MAX=1400;
    let w=img.width, h=img.height;
    if(w>MAX||h>MAX){ const r=Math.min(MAX/w,MAX/h); w=Math.round(w*r); h=Math.round(h*r); }
    const canvas=document.createElement('canvas');
    canvas.width=w; canvas.height=h;
    const ctx=canvas.getContext('2d');
    ctx.drawImage(img,0,0,w,h);
    // JPEG変換できた場合はJPEGで、できなければ元データをそのまま返す
    try {
      const out = canvas.toDataURL('image/jpeg', 0.85);
      callback(out && out.length > 100 ? out : src);
    } catch(_) {
      callback(src);
    }
  };
  img.onerror=()=>callback(src); // 圧縮失敗時は元データをそのまま使用
  img.src=src;
}

// インポート専用：画像が現在のブラウザで実際に表示できるか検証し、
// 表示できればJPEGに変換して返す。表示できない（旧非対応形式など）場合は null を返す。
// これにより「当時対応していなかった壊れたデータ」がそのまま保存されるのを防ぐ。
function _sanitizePhotoForImport(src, callback) {
  if (!src || !src.startsWith('data:')) { callback(null); return; }

  let settled = false;
  // タイムアウト：5秒以内に読み込めなければ表示不可とみなしnullにする
  const timer = setTimeout(() => {
    if (!settled) { settled = true; callback(null); }
  }, 5000);

  const img = new Image();
  img.onload = () => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);

    // 実際に描画できるか確認（幅・高さが0ならデコード失敗）
    if (!img.width || !img.height) { callback(null); return; }

    const MAX = 1400;
    let w = img.width, h = img.height;
    if (w > MAX || h > MAX) { const r = Math.min(MAX/w, MAX/h); w = Math.round(w*r); h = Math.round(h*r); }
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    try {
      ctx.drawImage(img, 0, 0, w, h);
      const out = canvas.toDataURL('image/jpeg', 0.85);
      // 変換結果が有効なJPEGデータかチェック
      callback((out && out.startsWith('data:image/jpeg') && out.length > 200) ? out : null);
    } catch(_) {
      // SecurityErrorなど描画できない場合もnull
      callback(null);
    }
  };
  // 読み込み失敗（非対応形式・壊れたデータ）→ null にクリアして新規設定できる状態にする
  img.onerror = () => {
    if (!settled) { settled = true; clearTimeout(timer); callback(null); }
  };
  img.src = src;
}

// インポート時に全写真データを検証・変換する（Promise対応・完全非同期）
// 読み込めない写真はnullにクリアする（壊れたデータが残り続けるのを防ぐ）
function sanitizeImportedPhotos(data) {
  const tasks = [];
  ['dog','cat'].forEach(type => {
    (data[type]||[]).forEach(pet => {
      // ペットのメイン写真を検証
      if (pet.photo) {
        tasks.push(new Promise(resolve => {
          _sanitizePhotoForImport(pet.photo, result => {
            pet.photo = result; // 読み込めない場合はnull、読み込める場合はJPEG変換済みデータ
            resolve();
          });
        }));
      }
      // 通院記録の写真を検証
      (pet.medicalRecords||[]).forEach(rec => {
        if (rec.photo) {
          tasks.push(new Promise(resolve => {
            _sanitizePhotoForImport(rec.photo, result => {
              rec.photo = result;
              resolve();
            });
          }));
        }
      });
      // 証明書写真を検証
      if (pet.certificates) {
        Object.keys(pet.certificates).forEach(k => {
          const cert = pet.certificates[k];
          if (cert && cert.photo) {
            tasks.push(new Promise(resolve => {
              _sanitizePhotoForImport(cert.photo, result => {
                cert.photo = result;
                resolve();
              });
            }));
          }
        });
      }
    });
  });
  return Promise.all(tasks).then(() => data);
}

function savePet() {
  const nameVal=(document.getElementById('edit-name')?.value||'').trim();
  if(!nameVal){alert('名前を入力してください');return;}
  const data=loadData(); const pets=data[currentType]||[];
  const idx=pets.findIndex(p=>p.id===currentPetId); if(idx===-1)return;
  const pet={...pets[idx]};
  pet.name=nameVal;
  pet.gender=document.getElementById('edit-gender')?.value||pet.gender||'';
  pet.birthday=document.getElementById('edit-birthday')?.value||'';
  pet.age=(document.getElementById('edit-age')?.value||'').trim();
  pet.weight=(document.getElementById('edit-weight')?.value||'').trim();
  pet.memo=document.getElementById('edit-memo')?.value||'';
  pet.familyTag=(document.getElementById('edit-family-tag')?.value||'').trim();
  pet.familyRole=(document.getElementById('edit-family-role')?.value||'').trim();
  pet.updatedAt=Date.now();
  if(currentType==='dog' || currentType==='cat'){
    pet.breed=document.getElementById('edit-breed')?.value||'';
    if(pet.breed==='雑種'){
      pet.parent1=document.getElementById('edit-parent1')?.value||'';
      pet.parent2=document.getElementById('edit-parent2')?.value||'';
    } else {
      pet.parent1 = '';
      pet.parent2 = '';
    }
  }
  if(tempPhotoData)pet.photo=tempPhotoData;
  ISSUES[currentType].forEach(issue=>{
    const el=document.getElementById(`issue-memo-${issue.key}`);
    if(!pet.issues)pet.issues={};
    if(!pet.issues[issue.key])pet.issues[issue.key]={};
    pet.issues[issue.key].memo=el?el.value:(pet.issues[issue.key].memo||'');
  });
  pets[idx]=pet; data[currentType]=pets; saveData(data);
  editMode=false; tempPhotoData=null;
  const btn=document.getElementById('edit-toggle-btn');
  btn.textContent='編集'; btn.classList.remove('editing');
  document.getElementById('detail-header-name').textContent=pet.name;
  renderDetailContent(pet,false);
  showToast('保存しました ✓');
}

// ========== 犬種モーダル ==========
let breedSortCurrent='group';
function setBreedSort(mode){
  breedSortCurrent=mode;
  document.getElementById('bsort-group').classList.toggle('active',mode==='group');
  document.getElementById('bsort-alpha').classList.toggle('active',mode==='alpha');
  renderBreedList();
}
function openBreedModal(){
  const breedLabel = currentType==='dog'?'犬種':'猫種';
  const title = `${breedLabel}を選択`;
  const placeholder = `${breedLabel}を検索…`;
  
  const modalTitleEl = document.querySelector('#modal-breed .modal-title');
  if(modalTitleEl) modalTitleEl.textContent = title;
  const searchInputEl = document.getElementById('breed-search-input');
  if(searchInputEl) {
    searchInputEl.value = '';
    searchInputEl.placeholder = placeholder;
  }
  
  breedSortCurrent='group';
  document.getElementById('bsort-group').classList.add('active');
  document.getElementById('bsort-alpha').classList.remove('active');
  renderBreedList();
  document.getElementById('modal-breed').classList.add('open');
}
function renderBreedList(){
  const query=toHiragana((document.getElementById('breed-search-input').value||'').trim()).toLowerCase();
  const currentBreed=document.getElementById('edit-breed')?.value||'';
  const breedSource = currentType==='dog' ? DOG_BREEDS_UNIQUE : CAT_BREEDS_UNIQUE;
  let list=breedSource.filter(b=>!query||toHiragana(b.ja).toLowerCase().includes(query)||b.en.toLowerCase().includes(query));
  const container=document.getElementById('breed-list');
  if(breedSortCurrent==='alpha'){
    list=[...list].sort((a,b)=>a.ja.localeCompare(b.ja,'ja'));
    container.innerHTML=list.map(b=>`<div class="breed-item${b.ja===currentBreed?' selected':''}" onclick="selectBreed('${escHtml(b.ja)}')">
      ${escHtml(b.ja)}
      <div class="breed-item-sub">${escHtml(b.en)}</div>
    </div>`).join('');
  } else {
    const groups={};
    list.forEach(b=>{if(!groups[b.group])groups[b.group]=[];groups[b.group].push(b);});
    container.innerHTML=Object.entries(groups).map(([g,breeds])=>`
      <div class="breed-group-header">${g}</div>
      ${breeds.map(b=>`<div class="breed-item${b.ja===currentBreed?' selected':''}" onclick="selectBreed('${escHtml(b.ja)}')">
        ${escHtml(b.ja)}<div class="breed-item-sub">${escHtml(b.en)}</div>
      </div>`).join('')}
    `).join('');
  }
}
function selectBreed(name){
  const hiddenEl=document.getElementById('edit-breed');
  if(hiddenEl) hiddenEl.value=name;
  const btnLabel=document.getElementById('breed-btn-label');
  if(btnLabel){ btnLabel.textContent=name; btnLabel.classList.remove('placeholder'); }
  const mixedWrap=document.getElementById('mixed-parents-wrap');
  if(mixedWrap) mixedWrap.style.display=name==='雑種'?'flex':'none';
  const breedLabel = currentType==='dog'?'犬種':'猫種';
  const p1 = document.getElementById('edit-parent1');
  const p2 = document.getElementById('edit-parent2');
  if(p1) p1.placeholder = `親1の${breedLabel}`;
  if(p2) p2.placeholder = `親2の${breedLabel}`;
  closeModal(null,'modal-breed');
}

// ========== 問題フォルダ画面 ==========
function renderFolderScreen(){
  const data=loadData(); const pets=data[currentType]||[];
  const rawSearch=(document.getElementById('folder-search')?.value||'').trim();
  const search=toHiragana(rawSearch).toLowerCase();
  const filtered=search?pets.filter(p=>
    toHiragana(p.name||'').toLowerCase().includes(search) ||
    toHiragana(p.breed||'').toLowerCase().includes(search)
  ):pets;
  const issues=ISSUES[currentType];
  const container=document.getElementById('folder-content');
  let html='';
  issues.forEach(issue=>{
    const withIssue=filtered.filter(p=>(p.issues||{})[issue.key]?.memo);
    html+=`<div class="folder-issue-section">
      <div class="folder-issue-title">${issue.icon} ${issue.label}（${withIssue.length}件）</div>
      ${withIssue.length===0
        ?`<div class="folder-empty">この問題に記録がある子はいません</div>`
        :withIssue.map(p=>{
          const memo=(p.issues[issue.key]?.memo)||'';
          const photoHtml=p.photo?`<div class="folder-pet-photo"><img src="${p.photo}" alt="${escHtml(p.name)}"></div>`:`<div class="folder-pet-photo">${currentType==='dog'?'🐕':'🐈'}</div>`;
          const breedText=p.breed?`<span class="folder-pet-breed">${escHtml(p.breed)}</span>`:'';
          return `<div class="folder-pet-card" onclick="openDetail('${p.id}');closeIssueFolder2();">
            ${photoHtml}
            <div>
              <div class="folder-pet-name">${escHtml(p.name)}${breedText}</div>
              <div class="folder-pet-memo">${escHtml(memo)}</div>
            </div>
          </div>`;
        }).join('')}
    </div>`;
  });
  container.innerHTML=html||`<div class="folder-empty">記録がありません</div>`;
}
function closeIssueFolder2(){
  // 問題フォルダから詳細へ移動後に問題フォルダをslide-outに
  document.getElementById('screen-folder').classList.remove('active');
  document.getElementById('screen-folder').classList.add('slide-out');
}

// ========== アンケート ==========
function openSurvey(id){
  const data=loadData(); const pet=(data[currentType]||[]).find(p=>p.id===id);
  if(!pet)return;
  currentPetId=id; surveyEditMode=false;
  renderSurveyContent(pet,false);
  showScreen('screen-survey');
  const btn=document.getElementById('survey-edit-btn');
  btn.textContent='編集'; btn.classList.remove('editing');
}
function toggleSurveyEdit(){
  const data=loadData(); const pet=(data[currentType]||[]).find(p=>p.id===currentPetId);
  if(!pet)return;
  surveyEditMode=!surveyEditMode;
  const btn=document.getElementById('survey-edit-btn');
  if(surveyEditMode){btn.textContent='キャンセル';btn.classList.add('editing');}
  else{btn.textContent='編集';btn.classList.remove('editing');}
  renderSurveyContent(pet,surveyEditMode);
}

function renderSurveyContent(pet, isEditing){
  const s=pet.survey||{};
  const container=document.getElementById('survey-content');
  const e=isEditing?'editing-mode':'';

  // ヘルパー
  const yn=(key,label)=>{
    const val=s[key]||'';
    const viewHtml=val||'未記入';
    return `<div class="detail-field">
      <label class="field-label">${label}</label>
      <div class="view-only field-value">${viewHtml}</div>
      <div class="edit-only">
        <div class="yn-group">
          <button class="yn-btn yes${val==='はい'?' selected':''}" onclick="toggleYN(this,'${key}','はい')">はい</button>
          <button class="yn-btn no${val==='いいえ'?' selected':''}" onclick="toggleYN(this,'${key}','いいえ')">いいえ</button>
        </div>
        <input type="hidden" id="s-${key}" value="${escHtml(val)}">
      </div>
    </div>`;
  };
  const tf=(key,label,ph='',rows=2)=>{
    const val=s[key]||'';
    return `<div class="detail-field">
      <label class="field-label">${label}</label>
      <div class="view-only">${val?`<div class="memo-view">${escHtml(val)}</div>`:`<div class="memo-view memo-empty">未記入</div>`}</div>
      <div class="edit-only"><textarea class="field-input" id="s-${key}" rows="${rows}" placeholder="${ph}">${escHtml(val)}</textarea></div>
    </div>`;
  };
  const numf=(key,label,unit='',ph='')=>{
    const val=s[key]||'';
    return `<div class="detail-field">
      <label class="field-label">${label}</label>
      <div class="view-only field-value">${val?(escHtml(val)+(unit?unit:'')):'未記入'}</div>
      <div class="edit-only">
        <div style="display:flex;align-items:center;gap:6px">
          <input type="text" class="field-input" id="s-${key}" value="${escHtml(val)}" placeholder="${ph}" style="flex:1">
          ${unit?`<span style="font-size:14px;color:var(--text-light);white-space:nowrap">${unit}</span>`:''}
        </div>
      </div>
    </div>`;
  };

  // アレルギー
  const allergies=(s.allergies||[]);
  const allergyViewHtml=allergies.length?allergies.map(a=>`<span style="display:inline-block;background:rgba(224,80,80,0.1);color:var(--red);border-radius:20px;padding:3px 10px;font-size:13px;font-weight:600;margin:2px">${escHtml(a)}</span>`).join(''):
    `<div class="memo-view memo-empty">なし</div>`;
  const allergyEditHtml=`<div class="allergy-list" id="allergy-list">
    ${allergies.map((a,i)=>`<div class="allergy-item">
      <input type="text" class="field-input allergy-input" value="${escHtml(a)}" placeholder="アレルギーを入力">
      <button class="allergy-remove-btn" onclick="removeAllergyItem(this)">×</button>
    </div>`).join('')}
    <button class="allergy-add-btn" onclick="addAllergyItem()">＋ アレルギーを追加</button>
  </div>`;

  // 性格チップ
  const selectedPersonalities=s.personalities||[];
  const personalityViewHtml=selectedPersonalities.length?selectedPersonalities.join('、'):
    (s.personalityFree||'未記入');
  const personalityEditHtml=`<div>
    <div class="personality-wrap" style="margin-bottom:8px">
      ${PERSONALITY_OPTIONS.map(o=>`<div class="personality-chip${selectedPersonalities.includes(o)?' selected':''}" onclick="togglePersonalityChip(this,'${o}')">${o}</div>`).join('')}
    </div>
    <input type="hidden" id="s-personalities" value="${escHtml(JSON.stringify(selectedPersonalities))}">
    <input type="text" class="field-input" id="s-personalityFree" value="${escHtml(s.personalityFree||'')}" placeholder="自由記入（例：甘えん坊）">
  </div>`;

  // 散歩道具チップ
  const selectedTools=s.walkTools||[];
  const toolsViewHtml=selectedTools.length?selectedTools.join('、'):'未記入';
  const toolsEditHtml=`<div>
    <div class="tools-wrap" style="margin-bottom:8px">
      ${WALK_TOOLS.map(t=>`<div class="tool-chip${selectedTools.includes(t)?' selected':''}" onclick="toggleToolChip(this,'${t}')">${t}</div>`).join('')}
    </div>
    <input type="hidden" id="s-walkTools" value="${escHtml(JSON.stringify(selectedTools))}">
    <input type="text" class="field-input" id="s-walkToolFree" value="${escHtml(s.walkToolFree||'')}" placeholder="その他（自由記入）">
  </div>`;

  // トイレOX
  const toiletItems=[
    {key:'toiletIndoor',label:'屋内（家）'},
    {key:'toiletOutdoor',label:'屋外'},
    {key:'toiletOtherIndoor',label:'家以外の屋内'},
  ];
  const toiletViewHtml=toiletItems.map(t=>`<div style="font-size:13px;margin-bottom:2px">${t.label}：${s[t.key]==='○'?'○':s[t.key]==='✕'?'✕':'未記入'}</div>`).join('');
  const toiletEditHtml=`<div class="toilet-grid">
    ${toiletItems.map(t=>`<div class="toilet-item">
      <div class="toilet-item-label">${t.label}</div>
      <div class="toilet-ox">
        <button class="ox-btn circle${s[t.key]==='○'?' selected':''}" onclick="toggleOX(this,'${t.key}','○')">○</button>
        <button class="ox-btn cross${s[t.key]==='✕'?' selected':''}" onclick="toggleOX(this,'${t.key}','✕')">✕</button>
      </div>
      <input type="hidden" id="s-${t.key}" value="${escHtml(s[t.key]||'')}">
    </div>`).join('')}
  </div>`;

  container.innerHTML=`<div class="${e}">
    <div class="detail-card">
      <div class="detail-card-title">基本情報</div>
      <div class="detail-field">
        <label class="field-label">名前</label><div class="field-value">${escHtml(pet.name)}</div>
      </div>
      <div class="detail-field">
        <label class="field-label">${currentType==='dog'?'犬種':'猫種'}</label><div class="field-value">${escHtml(pet.breed||'不明')}</div>
      </div>
      <div class="detail-field">
        <label class="field-label">生年月日</label><div class="field-value">${pet.birthday?formatDate(pet.birthday):'不明'}</div>
      </div>
      <div class="detail-field">
        <label class="field-label">年齢</label><div class="field-value">${pet.birthday?calcAge(pet.birthday):(pet.age||'不明')}</div>
      </div>
      <div class="detail-field">
        <label class="field-label">性別</label><div class="field-value">${escHtml(pet.gender||'不明')}</div>
      </div>
      <div class="detail-field">
        <label class="field-label">体重</label><div class="field-value">${pet.weight?escHtml(pet.weight)+'kg':'不明'}</div>
      </div>
    </div>
    <div class="detail-card">
      <div class="detail-card-title">健康・ケア</div>
      ${yn('neutered','避妊・去勢')}
      <div class="detail-field">
        <label class="field-label">アレルギー</label>
        <div class="view-only">${allergyViewHtml}</div>
        <div class="edit-only">${allergyEditHtml}</div>
      </div>
    </div>
    <div class="detail-card">
      <div class="detail-card-title">性格</div>
      <div class="detail-field">
        <label class="field-label">性格タイプ</label>
        <div class="view-only field-value">${personalityViewHtml||'未記入'}</div>
        <div class="edit-only">${personalityEditHtml}</div>
      </div>
    </div>
    <div class="detail-card">
      <div class="detail-card-title">散歩</div>
      ${numf('walkCount','散歩回数','回/日','例: 2')}
      ${numf('walkTime','散歩時間','分/回','例: 30')}
      <div class="detail-field">
        <label class="field-label">散歩で使う道具</label>
        <div class="view-only field-value">${toolsViewHtml}</div>
        <div class="edit-only">${toolsEditHtml}</div>
      </div>
    </div>
    <div class="detail-card">
      <div class="detail-card-title">トイレ</div>
      <div class="detail-field">
        <label class="field-label">できる場所</label>
        <div class="view-only">${toiletViewHtml}</div>
        <div class="edit-only">${toiletEditHtml}</div>
      </div>
    </div>
    <div class="detail-card">
      <div class="detail-card-title">歯磨き</div>
      ${yn('dental','歯磨きできる')}
      ${tf('dentalNote','歯磨きメモ','例: 奥歯が苦手、おやつ必要')}
    </div>
    <div class="detail-card">
      <div class="detail-card-title">好み・気になること</div>
      ${tf('likes','好きなもの','例: ボール遊び、チキン')}
      ${tf('dislikes','嫌いなもの','例: 雷、掃除機')}
      ${tf('concerns','気になること','例: 食欲が減った気がする')}
      ${tf('free','自由記入','なんでも','4')}
    </div>
    <button class="save-btn" onclick="saveSurvey()">保存する</button>
  </div>`;
}

function toggleYN(btn, key, val){
  const group=btn.closest('.yn-group');
  group.querySelectorAll('.yn-btn').forEach(b=>b.classList.remove('selected'));
  btn.classList.add('selected');
  document.getElementById(`s-${key}`).value=val;
}
function toggleOX(btn, key, val){
  const group=btn.closest('.toilet-ox');
  group.querySelectorAll('.ox-btn').forEach(b=>b.classList.remove('selected'));
  btn.classList.add('selected');
  document.getElementById(`s-${key}`).value=val;
}
function togglePersonalityChip(el, val){
  el.classList.toggle('selected');
  const hidden=document.getElementById('s-personalities');
  let arr=JSON.parse(hidden.value||'[]');
  if(el.classList.contains('selected')){ if(!arr.includes(val))arr.push(val); }
  else { arr=arr.filter(v=>v!==val); }
  hidden.value=JSON.stringify(arr);
}
function toggleToolChip(el, val){
  el.classList.toggle('selected');
  const hidden=document.getElementById('s-walkTools');
  let arr=JSON.parse(hidden.value||'[]');
  if(el.classList.contains('selected')){ if(!arr.includes(val))arr.push(val); }
  else { arr=arr.filter(v=>v!==val); }
  hidden.value=JSON.stringify(arr);
}
function addAllergyItem(){
  const list=document.getElementById('allergy-list');
  const addBtn=list.querySelector('.allergy-add-btn');
  const div=document.createElement('div');
  div.className='allergy-item';
  div.innerHTML=`<input type="text" class="field-input allergy-input" placeholder="アレルギーを入力">
    <button class="allergy-remove-btn" onclick="removeAllergyItem(this)">×</button>`;
  list.insertBefore(div,addBtn);
}
function removeAllergyItem(btn){ btn.closest('.allergy-item').remove(); }

function saveSurvey(){
  const data=loadData(); const pets=data[currentType]||[];
  const idx=pets.findIndex(p=>p.id===currentPetId); if(idx===-1)return;
  const pet={...pets[idx]};
  const s={};
  ['neutered','dental'].forEach(k=>{ const el=document.getElementById(`s-${k}`); if(el)s[k]=el.value; });
  ['walkCount','walkTime','dentalNote','likes','dislikes','concerns','free','personalityFree','walkToolFree'].forEach(k=>{ const el=document.getElementById(`s-${k}`); if(el)s[k]=el.value; });
  ['toiletIndoor','toiletOutdoor','toiletOtherIndoor'].forEach(k=>{ const el=document.getElementById(`s-${k}`); if(el)s[k]=el.value; });
  const pEl=document.getElementById('s-personalities'); if(pEl)try{s.personalities=JSON.parse(pEl.value);}catch(e){}
  const tEl=document.getElementById('s-walkTools'); if(tEl)try{s.walkTools=JSON.parse(tEl.value);}catch(e){}
  // アレルギー
  const allergyInputs=document.querySelectorAll('.allergy-input');
  s.allergies=[...allergyInputs].map(i=>i.value.trim()).filter(Boolean);
  pet.survey=s; pet.updatedAt=Date.now();
  pets[idx]=pet; data[currentType]=pets; saveData(data);
  surveyEditMode=false;
  const btn=document.getElementById('survey-edit-btn');
  btn.textContent='編集'; btn.classList.remove('editing');
  renderSurveyContent(pet,false);
  showToast('アンケートを保存しました ✓');
}

// ========== 新規追加 ==========
function openAddModal(){
  ['new-name','new-age'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('new-birthday').value='';
  document.getElementById('new-photo-preview').src='';
  document.getElementById('new-photo-preview').classList.add('hidden');
  document.getElementById('new-photo-placeholder').classList.remove('hidden');
  tempPhotoData=null;
  document.getElementById('modal-add').classList.add('open');
}
function closeAddModal(){ document.getElementById('modal-add').classList.remove('open'); tempPhotoData=null; }
function previewNewPhoto(event){
  const file=event.target.files[0]; if(!file)return;
  compressAndLoad(file, data=>{
    tempPhotoData=data;
    const p=document.getElementById('new-photo-preview');
    p.src=data; p.classList.remove('hidden');
    document.getElementById('new-photo-placeholder').classList.add('hidden');
  });
}
function addPet(){
  const name=(document.getElementById('new-name').value||'').trim();
  if(!name){alert('名前を入力してください');return;}
  const pet={
    id:'pet_'+Date.now()+'_'+Math.random().toString(36).slice(2),
    name, birthday:document.getElementById('new-birthday').value,
    age:(document.getElementById('new-age').value||'').trim(),
    photo:tempPhotoData||null, memo:'', issues:{}, survey:{},
    gender:'', breed:'', weight:'', parent1:'', parent2:'',
    createdAt:Date.now(), updatedAt:Date.now(),
  };
  const data=loadData();
  if(!data[currentType])data[currentType]=[];
  data[currentType].push(pet);
  saveData(data);
  closeAddModal(); renderList(); showToast('追加しました ✓');
}

// ========== 削除 ==========
function openDeleteModal(){ deletePendingId=currentPetId; document.getElementById('modal-delete').classList.add('open'); }
function confirmDelete(){
  if(!deletePendingId)return;
  const data=loadData();
  data[currentType]=(data[currentType]||[]).filter(p=>p.id!==deletePendingId);
  saveData(data); deletePendingId=null;
  closeModal(null,'modal-delete');
  goToList(); showToast('削除しました');
}

// ========== データ引き継ぎ ==========
function openTransferModal(){ document.getElementById('modal-transfer').classList.add('open'); }
function exportData(){
  const petData = loadData();
  const hospitals = loadHospitals();

  // 旧データ移行: ペット内に残っているhospitalsをエクスポート前に共通ストアに吸収
  ['dog','cat'].forEach(type => {
    (petData[type]||[]).forEach(pet => {
      if (Array.isArray(pet.hospitals) && pet.hospitals.length > 0) {
        const shared = loadHospitals();
        const sharedIds = new Set(shared.map(h => h.id));
        let added = false;
        pet.hospitals.forEach(h => {
          if (h && !sharedIds.has(h.id)) { shared.push(h); added = true; }
        });
        if (added) saveHospitals(shared);
      }
    });
  });

  const exportPayload = {
    version: 3,
    exportedAt: Date.now(),
    pets: petData,
    hospitals: loadHospitals()  // 移行後の最新値を取得
  };

  const json=JSON.stringify(exportPayload,null,2);
  const blob=new Blob([json],{type:'application/json'});
  const fileName=`wannyan_backup_${new Date().toISOString().slice(0,10).replace(/-/g,'')}.json`;

  // iPhone Safari対策
  if (navigator.share && navigator.canShare) {
    const file = new File([blob], fileName, { type:'application/json' });
    navigator.share({ files:[file], title:'わんにゃんメモリー バックアップ' })
      .then(()=>showToast('エクスポートしました ✓'))
      .catch(()=>{});
    return;
  }

  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=fileName;
  document.body.appendChild(a);
  a.click();

  setTimeout(()=>{
    URL.revokeObjectURL(url);
    a.remove();
  },1000);

  showToast('エクスポートしました ✓');
}
function importData(event){
  const file=event.target.files[0]; if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const raw=JSON.parse(e.target.result);

      // 新旧形式対応
      // version3: { version:3, pets:{dog,cat}, hospitals:[] }
      // version2以前: { dog:[], cat:[], hospitals:[] } または { dog:[], cat:[] }
      // 最旧: { dog:[], cat:[] } でpetにhospitalsが混在
      let petData = null;
      if (raw.pets && (raw.pets.dog !== undefined || raw.pets.cat !== undefined)) {
        petData = raw.pets;
      } else if (raw.dog !== undefined || raw.cat !== undefined) {
        petData = raw;
      }

      if(!petData || (petData.dog === undefined && petData.cat === undefined)) throw new Error('invalid format');

      // dogとcatを確実に配列に
      if (!Array.isArray(petData.dog)) petData.dog = [];
      if (!Array.isArray(petData.cat)) petData.cat = [];

      if(!confirm('現在のデータに上書きします。よろしいですか？'))return;

      sanitizeImportedPhotos(petData).then(fixedData => {

        ['dog','cat'].forEach(type => {
          fixedData[type] = (fixedData[type] || []).map(p => ({
            ...p,
            medicalRecords: Array.isArray(p.medicalRecords) ? p.medicalRecords : [],
            weightHistory: Array.isArray(p.weightHistory) ? p.weightHistory : [],
            certificates: (p.certificates && typeof p.certificates === 'object') ? p.certificates : {},
            quickCares: (p.quickCares && typeof p.quickCares === 'object') ? p.quickCares : {},
            medicines: Array.isArray(p.medicines) ? p.medicines : [],
            medicineLogs: (p.medicineLogs && typeof p.medicineLogs === 'object') ? p.medicineLogs : {},
          }));
        });

        saveData(fixedData);

        // 病院データ復元
        // 優先順位: raw.hospitals > petData内の各ペットのp.hospitals（旧形式）
        let hospitals = [];

        if (Array.isArray(raw.hospitals) && raw.hospitals.length > 0) {
          // version3形式: トップレベルに hospitals がある
          hospitals = raw.hospitals;
        } else if (Array.isArray(petData.hospitals) && petData.hospitals.length > 0) {
          // ルートにhospitalsがある形式
          hospitals = petData.hospitals;
        } else {
          // 最旧形式: 各ペットに hospitals が混在していた
          const collected = [];
          ['dog','cat'].forEach(type => {
            (fixedData[type] || []).forEach(p => {
              if (Array.isArray(p.hospitals)) {
                collected.push(...p.hospitals);
              }
            });
          });
          hospitals = collected;
        }

        // 既存の共通病院ストアと合わせて重複排除（IDと名前で両方チェック）
        const currentHospitals = loadHospitals();
        const merged = [...currentHospitals];
        const seenIds = new Set(merged.map(h => h.id).filter(Boolean));
        const seenNames = new Set(merged.map(h => h.name).filter(Boolean));

        hospitals.forEach(h => {
          if (!h) return;
          if (!h.priceList) h.priceList = [];
          if (!Array.isArray(h.doctors)) h.doctors = h.doctor ? [{ id: 'legacy', name: h.doctor }] : [];
          // IDで重複チェック（IDがある場合）
          if (h.id && seenIds.has(h.id)) return;
          // 名前で重複チェック（IDがない場合も含む）
          if (h.name && seenNames.has(h.name)) return;
          if (h.id) seenIds.add(h.id);
          if (h.name) seenNames.add(h.name);
          merged.push(h);
        });

        // インポートしたデータを優先する場合は merged ではなく直接 hospitals を使う
        // ここでは「上書き」モードなので、インポートのhospitalsで既存を置き換える
        const finalHospitals = [];
        const finalSeen = new Set();
        hospitals.forEach(h => {
          if (!h) return;
          if (!h.priceList) h.priceList = [];
          if (!Array.isArray(h.doctors)) h.doctors = h.doctor ? [{ id: 'legacy', name: h.doctor }] : [];
          const key = h.id || h.name;
          if (!key || finalSeen.has(key)) return;
          finalSeen.add(key);
          finalHospitals.push(h);
        });

        // インポートに病院データがあればそれで上書き、なければ現在のデータを保持
        if (finalHospitals.length > 0) {
          saveHospitals(finalHospitals);
        }
        // 病院データが空の旧バックアップでも現在の病院データを消さない（何もしない）

        closeModal(null,'modal-transfer');
        showToast('インポートしました ✓');
        if(currentType)renderList();
      });
    }catch(err){
      console.error('Import error:', err);
      alert('ファイルが正しくありません。わんにゃんメモリーのバックアップファイルを選択してください。');
    }
  };
  reader.readAsText(file);
  event.target.value='';
}
function confirmReset(){
  if(!confirm('全データを削除します。この操作は取り消せません。よろしいですか？'))return;
  localStorage.removeItem('wannyan_v2');
  localStorage.removeItem('wannyan_hospitals_v1');
  closeModal(null,'modal-transfer');
  showToast('データをリセットしました');
  if(currentType)renderList();
}

// ========== 病院記録＆ケア 統合機能 (Hospital & Care Integration) ==========
let currentHospitalTab = 'care-weight';
let currentMedicalFilter = 'all';
let tempMedicalPhoto = null;
let tempCertPhoto = null;
let hospitalSortMode = 'custom'; // 'recent' | 'name' | 'custom'
let hospitalManualSortActive = false; // 病院手動並び替えモード
let medicineSortModeActive = false; // 本日のお薬チェック並び替えモード
let medicineMasterSortActive = false; // お薬マスタ並び替えモード

let careCalendarYear = new Date().getFullYear();
let careCalendarMonth = new Date().getMonth();

// ペットデータの新規フィールドを安全に確保する後方互換用関数
function ensurePetHospitalFields(pet) {
  if (!pet.weightHistory) pet.weightHistory = [];
  if (!pet.quickCares) pet.quickCares = {};
  if (!pet.medicalRecords) pet.medicalRecords = [];
  if (!pet.certificates) pet.certificates = {};
  if (!pet.medicines) pet.medicines = [];
  if (!pet.medicineLogs) pet.medicineLogs = {};
  
  // 旧データ移行: pet.hospitals があれば共通ストアに移す
  if (pet.hospitals && pet.hospitals.length > 0) {
    const shared = loadHospitals();
    const sharedIds = new Set(shared.map(h => h.id));
    pet.hospitals.forEach(h => {
      if (!h.priceList) h.priceList = [];
      if (!sharedIds.has(h.id)) shared.push(h);
    });
    saveHospitals(shared);
    delete pet.hospitals;
  }
  
  return pet;
}

// 共通病院一覧のヘルパー
function getHospitals() {
  const list = loadHospitals();
  list.forEach(h => { if (!h.priceList) h.priceList = []; });
  return list;
}

// 病院記録＆ケア統合画面を開く
function openHospitalRecords(petId) {
  const data = loadData();
  const pet = (data[currentType] || []).find(p => p.id === petId);
  if (!pet) return;
  
  currentPetId = petId;
  ensurePetHospitalFields(pet);
  
  // 初期タブの設定
  currentHospitalTab = 'care-weight';
  currentMedicalFilter = 'all';
  
  // 日常ケアの日付を本日に設定
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-${dd}`;
  
  const qDateEl = document.getElementById('quick-care-date');
  if (qDateEl) qDateEl.value = dateStr;
  
  const wDateEl = document.getElementById('weight-add-date');
  if (wDateEl) wDateEl.value = dateStr;

  // 画面遷移
  document.getElementById('hospital-header-title').textContent = `${pet.name}の病院記録・ケア`;
  showScreen('screen-hospital-records');
  
  // カレンダーの初期化
  careCalendarYear = today.getFullYear();
  careCalendarMonth = today.getMonth();

  // 各タブ要素の初期描画
  switchHospitalTab('care-weight');
  
  // 各自データの再描画
  renderQuickCares();
  renderWeightSection();
  renderMedicalTimeline();
  renderHospitalMaster();
  renderCertificates();
  renderMedicineCareSection();
  renderMedicineListMaster();
  renderWalkTimer();
  renderPendingNotes(petId);
  // カレンダーは画面遷移アニメーション完了後に描画
  setTimeout(() => renderCareCalendar(), 400);
}

// 統合画面からペット詳細画面に戻る
function goToDetail() {
  const data = loadData();
  const pet = (data[currentType] || []).find(p => p.id === currentPetId);
  if (pet) {
    renderDetailContent(pet, false);
  }
  showScreen('screen-detail', 'back');
}

// 統合画面内のサブタブを切り替える
function switchHospitalTab(tabId) {
  currentHospitalTab = tabId;
  
  // タブボタンのアクティブ表示切り替え
  const tabs = document.querySelectorAll('.hospital-tab-btn');
  tabs.forEach(tab => {
    const onclickStr = tab.getAttribute('onclick');
    if (onclickStr && onclickStr.includes(tabId)) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });
  
  // コンテンツの表示/非表示切り替え
  const contents = document.querySelectorAll('.hospital-tab-content');
  contents.forEach(content => {
    if (content.id === `tab-${tabId}`) {
      content.classList.add('active');
    } else {
      content.classList.remove('active');
    }
  });

  // タブに応じた個別処理
  if (tabId === 'care-weight') {
    drawWeightGraph();
    renderQuickCares();
    renderMedicineCareSection();
    renderCareCalendar();
  } else if (tabId === 'medicine-tab') {
    renderMedicineListMaster();
  }
}

// ==========================================
// 日常ケアカレンダーのロジック
// ==========================================
function changeCareCalendarMonth(delta) {
  careCalendarMonth += delta;
  if (careCalendarMonth < 0) {
    careCalendarMonth = 11;
    careCalendarYear--;
  } else if (careCalendarMonth > 11) {
    careCalendarMonth = 0;
    careCalendarYear++;
  }
  renderCareCalendar();
}

function renderCareCalendar() {
  const container = document.getElementById('care-calendar-container');
  const label = document.getElementById('care-calendar-month-label');
  if (!container || !label) return;

  label.textContent = `${careCalendarYear}年${careCalendarMonth + 1}月`;

  const data = loadData();
  const pet = (data[currentType] || []).find(p => p.id === currentPetId);
  if (!pet) return;
  ensurePetHospitalFields(pet);

  const daysInMonth = new Date(careCalendarYear, careCalendarMonth + 1, 0).getDate();
  const firstDay = new Date(careCalendarYear, careCalendarMonth, 1).getDay();

  let html = '<div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:4px; text-align:center; font-size:11px;">';
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  dayNames.forEach(d => {
    html += `<div style="font-weight:700; color:var(--text-light); padding:4px 0;">${d}</div>`;
  });

  for (let i = 0; i < firstDay; i++) {
    html += '<div></div>';
  }

  const tDate = new Date();
  const tStr = `${tDate.getFullYear()}-${String(tDate.getMonth()+1).padStart(2,'0')}-${String(tDate.getDate()).padStart(2,'0')}`;
  
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${careCalendarYear}-${String(careCalendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    const quickCares = pet.quickCares[dateStr] || {};
    const medicineLogs = pet.medicineLogs[dateStr] || {};
    const hasMedicine = Object.keys(medicineLogs).length > 0;

    let icons = '';
    if (quickCares.nail) icons += '<span style="font-size:10px;">💅</span>';
    if (quickCares.tooth) icons += '<span style="font-size:10px;">🪥</span>';
    if (quickCares.flea) icons += '<span style="font-size:10px;">🛡️</span>';
    if (hasMedicine) icons += '<span style="font-size:10px;">💊</span>';

    const isToday = (dateStr === tStr);
    const bg = isToday ? 'background:rgba(200,132,74,0.1); border-radius:6px;' : '';
    const color = isToday ? 'color:var(--accent); font-weight:800;' : 'color:var(--text-dark);';

    html += `
      <div style="min-height:40px; display:flex; flex-direction:column; align-items:center; padding:4px 2px; border:1px solid rgba(44,36,24,0.05); border-radius:6px; ${bg}">
        <span style="${color}">${day}</span>
        <div style="display:flex; flex-wrap:wrap; justify-content:center; gap:1px; margin-top:2px; line-height:1;">
          ${icons}
        </div>
      </div>
    `;
  }
  html += '</div>';
  container.innerHTML = html;
}


function onQuickCareDateChange() {
  renderQuickCares();
  renderMedicineCareSection();
  renderCareCalendar();
}

function renderQuickCares() {
  const data = loadData();
  const pet = (data[currentType] || []).find(p => p.id === currentPetId);
  if (!pet) return;
  
  ensurePetHospitalFields(pet);
  
  const dateStr = document.getElementById('quick-care-date').value;
  if (!dateStr) return;
  
  const dayCares = pet.quickCares[dateStr] || {};
  const careTypes = ['nail', 'tooth', 'flea'];
  
  careTypes.forEach(type => {
    const btn = document.getElementById(`care-${type}`);
    if (!btn) return;
    
    const isDone = !!dayCares[type];
    const statusEl = btn.querySelector('.care-status');
    
    if (isDone) {
      btn.classList.add('completed');
      if (statusEl) statusEl.textContent = '完了 ✓';
    } else {
      btn.classList.remove('completed');
      if (statusEl) statusEl.textContent = '未完了';
    }
  });
}

function toggleQuickCare(type) {
  const data = loadData();
  const pets = data[currentType] || [];
  const idx = pets.findIndex(p => p.id === currentPetId);
  if (idx === -1) return;
  
  const pet = ensurePetHospitalFields(pets[idx]);
  const dateStr = document.getElementById('quick-care-date').value;
  if (!dateStr) {
    alert('日付を選択してください');
    return;
  }
  
  if (!pet.quickCares[dateStr]) pet.quickCares[dateStr] = {};
  
  // 状態の反転
  const nextVal = !pet.quickCares[dateStr][type];
  pet.quickCares[dateStr][type] = nextVal;
  
  pets[idx] = pet;
  data[currentType] = pets;
  saveData(data);
  
  renderQuickCares();
  renderCareCalendar();
  
  const labelMap = { nail: '爪切り', tooth: '歯磨き', flea: 'ノミ・ダニ予防' };
  showToast(`${labelMap[type]}を${nextVal ? '完了にしました' : '未完了にしました'}`);
}

// ==========================================
// 2. 体重推移グラフ & 登録のロジック
// ==========================================
function renderWeightSection() {
  const data = loadData();
  const pet = (data[currentType] || []).find(p => p.id === currentPetId);
  if (!pet) return;
  
  ensurePetHospitalFields(pet);
  
  // 履歴リストの描画
  const historyContainer = document.getElementById('weight-history-list');
  const history = [...pet.weightHistory].sort((a,b) => b.date.localeCompare(a.date));
  
  if (history.length === 0) {
    historyContainer.innerHTML = '<div class="cert-photo-empty" style="padding:10px 0">体重の記録がありません</div>';
  } else {
    historyContainer.innerHTML = history.map(item => `
      <div class="weight-history-item">
        <span class="weight-history-date">${escHtml(formatDate(item.date))}</span>
        <div>
          <span class="weight-history-val">${escHtml(item.weight)} kg</span>
          <button class="weight-history-del" onclick="deleteWeightRecord('${item.id}')">✕</button>
        </div>
      </div>
    `).join('');
  }
  
  drawWeightGraph();
}

function drawWeightGraph() {
  const data = loadData();
  const pet = (data[currentType] || []).find(p => p.id === currentPetId);
  if (!pet) return;
  
  ensurePetHospitalFields(pet);
  
  const container = document.getElementById('weight-graph-container');
  const svg = document.getElementById('weight-svg');
  if (!container || !svg) return;
  
  // 過去日付順にソート
  const history = [...pet.weightHistory].sort((a,b) => a.date.localeCompare(b.date));
  
  if (history.length < 2) {
    svg.innerHTML = `
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="12" fill="var(--text-light)">
        グラフを表示するには2件以上の記録が必要です
      </text>
    `;
    return;
  }
  
  // スケーリングパラメータの算出（縦軸自動最適化）
  const weights = history.map(h => h.weight);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  
  // 範囲に余白を持たせて自動調整
  const diff = maxW - minW;
  const padding = diff === 0 ? 1 : diff * 0.25;
  const minY = Math.max(0, minW - padding);
  const maxY = maxW + padding;
  
  // SVGの描画領域サイズ定義
  const width = container.clientWidth - 20;
  const height = 160;
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  
  const chartX = 40;
  const chartY = 15;
  const chartW = width - chartX - 15;
  const chartH = height - chartY - 30;
  
  // 背景目盛り線と左側ラベル
  let ticksHtml = '';
  const tickCount = 4;
  for (let i = 0; i <= tickCount; i++) {
    const yVal = minY + (maxY - minY) * (i / tickCount);
    const yPos = chartY + chartH - (chartH * (i / tickCount));
    ticksHtml += `
      <line x1="${chartX}" y1="${yPos}" x2="${chartX + chartW}" y2="${yPos}" stroke="rgba(44,36,24,0.06)" stroke-dasharray="2,2" />
      <text x="${chartX - 6}" y="${yPos + 4}" text-anchor="end" font-size="9" font-weight="700" fill="var(--text-light)">${yVal.toFixed(1)}</text>
    `;
  }
  
  // 各プロットポイントの座標マッピング
  const points = history.map((item, index) => {
    const xRatio = index / (history.length - 1);
    const yRatio = (item.weight - minY) / (maxY - minY);
    return {
      x: chartX + chartW * xRatio,
      y: chartY + chartH - chartH * yRatio,
      date: item.date,
      weight: item.weight
    };
  });
  
  // 折れ線パス
  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    pathD += ` L ${points[i].x} ${points[i].y}`;
  }
  
  // エリアグラデーション用のパス
  const areaD = `${pathD} L ${points[points.length - 1].x} ${chartY + chartH} L ${points[0].x} ${chartY + chartH} Z`;
  
  // 折れ線と点、下部日付テキスト
  let elementsHtml = `
    <defs>
      <linearGradient id="graph-grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.25" />
        <stop offset="100%" stop-color="var(--accent)" stop-opacity="0.0" />
      </linearGradient>
    </defs>
    <path d="${areaD}" fill="url(#graph-grad)" />
    <path d="${pathD}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
  `;
  
  // プロットポイント（タップでツールチップ表示）
  points.forEach((pt, index) => {
    const showLabel = index === 0 || index === points.length - 1 || index === Math.floor(points.length / 2);
    const dObj = new Date(pt.date);
    const dateLabel = `${dObj.getMonth() + 1}/${dObj.getDate()}`;
    
    elementsHtml += `
      <circle cx="${pt.x}" cy="${pt.y}" r="4.5" fill="var(--white)" stroke="var(--accent)" stroke-width="2.5" 
              onclick="showGraphTooltip(${pt.x}, ${pt.y}, '${pt.date}', ${pt.weight})" style="cursor:pointer;" />
    `;
    
    if (showLabel) {
      elementsHtml += `
        <text x="${pt.x}" y="${chartY + chartH + 16}" text-anchor="middle" font-size="9" font-weight="700" fill="var(--text-light)">${dateLabel}</text>
      `;
    }
  });
  
  svg.innerHTML = ticksHtml + elementsHtml;
}

function showGraphTooltip(x, y, dateStr, weight) {
  const tooltip = document.getElementById('graph-tooltip');
  if (!tooltip) return;
  
  tooltip.innerHTML = `${formatDate(dateStr)}<br><strong>${weight.toFixed(2)} kg</strong>`;
  tooltip.classList.remove('hidden');
  tooltip.style.left = `${x + 10}px`;
  tooltip.style.top = `${y + 10}px`;
  
  // 3秒後に非表示
  setTimeout(() => { tooltip.classList.add('hidden'); }, 3000);
}

function addWeightRecord() {
  const dateStr = document.getElementById('weight-add-date').value;
  const weightVal = parseFloat(document.getElementById('weight-add-val').value);
  
  if (!dateStr || isNaN(weightVal) || weightVal <= 0) {
    alert('日付と正しい体重(kg)を入力してください');
    return;
  }
  
  const data = loadData();
  const pets = data[currentType] || [];
  const idx = pets.findIndex(p => p.id === currentPetId);
  if (idx === -1) return;
  
  const pet = ensurePetHospitalFields(pets[idx]);
  
  // 既存の日付があれば上書き、なければ新規追加
  const existingIdx = pet.weightHistory.findIndex(w => w.date === dateStr);
  if (existingIdx !== -1) {
    pet.weightHistory[existingIdx].weight = weightVal;
  } else {
    pet.weightHistory.push({
      id: 'w_' + Date.now(),
      date: dateStr,
      weight: weightVal
    });
  }
  
  // 基本プロフィールの体重情報も、最新日のものに連動
  const sortedHistory = [...pet.weightHistory].sort((a,b) => b.date.localeCompare(a.date));
  if (sortedHistory.length > 0) {
    pet.weight = String(sortedHistory[0].weight);
  }
  
  pets[idx] = pet;
  data[currentType] = pets;
  saveData(data);
  
  document.getElementById('weight-add-val').value = '';
  renderWeightSection();
  showToast('体重を記録しました ✓');
}

// 体重履歴と通院記録の両方を参照して最新体重を再計算する（巻き戻し）
function rollbackWeight(pet) {
  // weightHistory + medicalRecordsの両方から体重を集めて最新を特定
  const allWeights = [];
  (pet.weightHistory||[]).forEach(w => {
    if(w.weight) allWeights.push({date: w.date, weight: Number(w.weight)});
  });
  (pet.medicalRecords||[]).forEach(r => {
    if(r.weight) allWeights.push({date: r.date, weight: Number(r.weight)});
  });
  allWeights.sort((a,b) => b.date.localeCompare(a.date));
  if(allWeights.length > 0) {
    pet.weight = String(allWeights[0].weight);
  } else {
    pet.weight = '';
  }
}

function deleteWeightRecord(id) {
  if (!confirm('この体重の記録を削除しますか？')) return;
  
  const data = loadData();
  const pets = data[currentType] || [];
  const idx = pets.findIndex(p => p.id === currentPetId);
  if (idx === -1) return;
  
  const pet = ensurePetHospitalFields(pets[idx]);
  pet.weightHistory = pet.weightHistory.filter(w => w.id !== id);
  
  // 巻き戻しロジック：削除後に残ったデータから最新体重を自動設定
  rollbackWeight(pet);
  
  pets[idx] = pet;
  data[currentType] = pets;
  saveData(data);
  
  renderWeightSection();
  showToast('削除しました（体重を自動更新）');
}

// ==========================================
// 3. 病院紹介（マスター）のロジック
// ==========================================
function renderHospitalMaster() {
  const data = loadData();
  const pet = (data[currentType] || []).find(p => p.id === currentPetId);
  if (!pet) return;
  
  ensurePetHospitalFields(pet);
  
  const container = document.getElementById('hospital-master-list');
  let hospitals = getHospitals();
  
  // 並び替え
  if (hospitalSortMode === 'name') {
    hospitals = [...hospitals].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ja'));
  } else if (hospitalSortMode === 'recent') {
    hospitals = [...hospitals].sort((a, b) => {
      const lastA = pet.medicalRecords.filter(r => r.hospitalId === a.id).map(r => r.date).sort().reverse()[0] || '';
      const lastB = pet.medicalRecords.filter(r => r.hospitalId === b.id).map(r => r.date).sort().reverse()[0] || '';
      return lastB.localeCompare(lastA);
    });
  }
  
  // 手動モード時のみ「並び替え開始/完了」ボタンを別行で表示
  const manualBtnHtml = hospitalSortMode === 'custom' ? `
    <div style="margin-top:6px; margin-bottom:4px;">
      <button onclick="toggleHospitalManualSort()" style="border:none; background:${hospitalManualSortActive ? 'rgba(200,132,74,0.2)' : 'rgba(44,36,24,0.08)'}; color:${hospitalManualSortActive ? 'var(--accent)' : 'var(--text-dark)'}; border-radius:8px; padding:5px 14px; font-size:12px; font-weight:700; cursor:pointer;">
        ${hospitalManualSortActive ? '✓ 並び替え完了' : '↕ 並び替え開始'}
      </button>
    </div>
  ` : '';

  const sortBarHtml = `
    <div style="margin-bottom:10px;">
      <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
        <span style="font-size:11px; font-weight:700; color:var(--text-light);">並び替え：</span>
        <button class="sort-btn ${hospitalSortMode==='recent'?'active':''}" onclick="setHospitalSort('recent')">最近利用順</button>
        <button class="sort-btn ${hospitalSortMode==='name'?'active':''}" onclick="setHospitalSort('name')">名前順</button>
        <button class="sort-btn ${hospitalSortMode==='custom'?'active':''}" onclick="setHospitalSort('custom')">手動</button>
      </div>
      ${manualBtnHtml}
    </div>
  `;

  if (hospitals.length === 0) {
    container.innerHTML = sortBarHtml + `
      <div class="empty-state" style="padding:40px 20px">
        <div style="font-size:44px;margin-bottom:12px">🏢</div>
        <p>登録されている病院がありません<br>「病院を登録する」ボタンから追加してください</p>
      </div>
    `;
    return;
  }

  container.innerHTML = sortBarHtml + hospitals.map((hosp, idx) => {
    const records = pet.medicalRecords.filter(r => r.hospitalId === hosp.id);
    const costs = records.map(r => Number(r.cost || 0)).filter(c => c > 0);
    const averageCost = costs.length > 0
      ? Math.round(costs.reduce((sum, val) => sum + val, 0) / costs.length)
      : 0;

    const reviewRecords = records.filter(r => (r.notes || '').trim() !== '');
    const reviewListHtml = reviewRecords.length > 0
      ? reviewRecords.map(r => `
          <div class="hospital-rev-item">
            <div class="hospital-rev-date-notes">
              <div style="font-weight:700;color:var(--text-mid)">${formatDate(r.date)}</div>
              <div class="hospital-rev-notes">${escHtml(r.notes)}</div>
            </div>
            ${r.cost ? `<div class="hospital-rev-cost">${Number(r.cost).toLocaleString()}円</div>` : ''}
          </div>
        `).join('')
      : '<div class="cert-photo-empty" style="padding:6px 0">診療メモがありません</div>';

    // 手動並び替えモード中のみ▲▼を表示
    if (hospitalManualSortActive) {
      return `
        <div class="hospital-card" id="hosp-card-${hosp.id}" style="border:2px dashed rgba(200,132,74,0.35);">
          <div class="hospital-card-header" style="cursor:default;">
            <span class="hospital-card-title">🏢 ${escHtml(hosp.name)}</span>
            <div style="display:flex;align-items:center;gap:6px;">
              <button class="med-order-btn" onclick="moveHospitalOrder('${hosp.id}', -1)" ${idx===0?'disabled':''}>▲</button>
              <button class="med-order-btn" onclick="moveHospitalOrder('${hosp.id}', 1)" ${idx===hospitals.length-1?'disabled':''}>▼</button>
            </div>
          </div>
        </div>
      `;
    }

    // 担当医リスト表示（特徴メモ付き）
    const doctors = hosp.doctors || (hosp.doctor ? [{ id: 'legacy', name: hosp.doctor }] : []);
    const doctorsHtml = doctors.length > 0 ? doctors.map(d => `
      <div class="hospital-detail-row" style="align-items:flex-start;">
        <span class="hospital-detail-icon">👨‍⚕️</span>
        <span class="hospital-detail-val">
          <strong>${escHtml(d.name)}</strong>
          ${d.memo ? `<span style="display:block;font-size:11px;color:var(--text-light);margin-top:1px;">${escHtml(d.memo)}</span>` : ''}
        </span>
      </div>`).join('') : '';

    return `
      <div class="hospital-card" id="hosp-card-${hosp.id}">
        <div class="hospital-card-header" onclick="toggleHospitalCard('${hosp.id}')">
          <span class="hospital-card-title">🏢 ${escHtml(hosp.name)}</span>
          <span class="hospital-card-arrow">▶</span>
        </div>
        <div class="hospital-card-body">
          <div class="hospital-card-details">
            ${hosp.phone ? `
              <div class="hospital-detail-row">
                <span class="hospital-detail-icon">📞</span>
                <span class="hospital-detail-val link" onclick="window.open('tel:${escHtml(hosp.phone)}')">${escHtml(hosp.phone)} (発信)</span>
              </div>` : ''}
            ${hosp.address ? `
              <div class="hospital-detail-row">
                <span class="hospital-detail-icon">📍</span>
                <span class="hospital-detail-val link" onclick="window.open('https://maps.google.com/?q=${encodeURIComponent(hosp.address)}', '_blank')">${escHtml(hosp.address)} (地図)</span>
              </div>` : ''}
            ${doctorsHtml}
          </div>

          ${hosp.memo ? `
            <p class="issue-memo-label">特色・印象（病院メモ）</p>
            <div class="hospital-memo-box">${escHtml(hosp.memo)}</div>` : ''}

          ${hosp.priceList && hosp.priceList.length > 0 ? `
            <div class="hospital-price-list-wrap">
              <p class="issue-memo-label">🩺 主な治療・検査の料金目安</p>
              <table class="hospital-price-table">
                <thead><tr><th>治療・ケア項目</th><th>目安料金</th></tr></thead>
                <tbody>
                  ${hosp.priceList.map(p => `<tr><td>${escHtml(p.name)}</td><td><strong>${Number(p.price).toLocaleString()}</strong> 円</td></tr>`).join('')}
                </tbody>
              </table>
            </div>` : ''}

          <div class="hospital-reverse-records">
            <div class="hospital-rev-title">🏥 治療実績とクチコミ（逆引き一覧）</div>
            <div class="hospital-stats-box">
              <div class="hospital-stat-pill">受診回数<span>${records.length}回</span></div>
              <div class="hospital-stat-pill">平均費用<span>${averageCost > 0 ? averageCost.toLocaleString() + '円' : '記録なし'}</span></div>
            </div>
            <p class="issue-memo-label">過去の診療メモ</p>
            <div class="hospital-rev-list">${reviewListHtml}</div>
          </div>

          <div class="hospital-actions-bar">
            <button class="hospital-act-btn share" onclick="shareHospital('${hosp.id}')">📋 コピーして共有</button>
            <button class="hospital-act-btn edit" onclick="openHospitalModal('${hosp.id}')">✏️ 編集</button>
            <button class="hospital-act-btn delete" onclick="deleteHospitalRecord('${hosp.id}')">✕ 削除</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function setHospitalSort(mode) {
  hospitalSortMode = mode;
  hospitalManualSortActive = false;
  renderHospitalMaster();
}

function toggleHospitalManualSort() {
  hospitalManualSortActive = !hospitalManualSortActive;
  renderHospitalMaster();
}

function moveHospitalOrder(hospId, direction) {
  const hospitals = getHospitals();
  const idx = hospitals.findIndex(h => h.id === hospId);
  if (idx === -1) return;
  const targetIdx = idx + direction;
  if (targetIdx < 0 || targetIdx >= hospitals.length) return;
  const temp = hospitals[idx];
  hospitals[idx] = hospitals[targetIdx];
  hospitals[targetIdx] = temp;
  saveHospitals(hospitals);
  renderHospitalMaster();
}

function toggleHospitalCard(id) {
  const card = document.getElementById(`hosp-card-${id}`);
  if (card) card.classList.toggle('open');
}

function openHospitalModal(hospitalId = null) {
  document.getElementById('edit-hospital-id').value = hospitalId || '';
  document.getElementById('h-name').value = '';
  document.getElementById('h-phone').value = '';
  document.getElementById('h-address').value = '';
  document.getElementById('h-memo').value = '';

  const editor = document.getElementById('hospital-price-editor');
  if (editor) editor.innerHTML = '';
  const docEditor = document.getElementById('hospital-doctor-editor');
  if (docEditor) docEditor.innerHTML = '';

  if (hospitalId) {
    document.getElementById('hospital-modal-title').textContent = '病院情報を編集';
    const hosp = getHospitals().find(h => h.id === hospitalId);
    if (hosp) {
      document.getElementById('h-name').value = hosp.name;
      document.getElementById('h-phone').value = hosp.phone || '';
      document.getElementById('h-address').value = hosp.address || '';
      document.getElementById('h-memo').value = hosp.memo || '';

      // 担当医（複数）展開 — 旧データ互換
      const doctors = hosp.doctors || (hosp.doctor ? [{ id: 'legacy_' + Date.now(), name: hosp.doctor, memo: '' }] : []);
      doctors.forEach(d => addDoctorEditRow(d.name, d.memo || ''));

      if (hosp.priceList && hosp.priceList.length > 0) {
        hosp.priceList.forEach(p => addPriceEditRow(p.name, p.price));
      }
    }
  } else {
    document.getElementById('hospital-modal-title').textContent = '病院を新規登録';
    addPriceEditRow('爪切り', '');
    addPriceEditRow('ノミ・ダニ予防', '');
    addPriceEditRow('混合ワクチン予防接種', '');
  }

  document.getElementById('modal-hospital').classList.add('open');
}

// 担当医エディタに1行追加（名前＋特徴メモ）
function addDoctorEditRow(name = '', memo = '') {
  const container = document.getElementById('hospital-doctor-editor');
  if (!container) return;
  const rowId = 'doc_row_' + Math.random().toString(36).substr(2, 9);
  const row = document.createElement('div');
  row.id = rowId;
  row.style.cssText = 'display:flex;flex-direction:column;gap:4px;background:rgba(44,36,24,0.03);border-radius:8px;padding:8px;';
  row.innerHTML = `
    <div style="display:flex;gap:6px;align-items:center;">
      <input type="text" class="h-doctor-name" placeholder="先生の名前（例: 山田先生）" value="${escHtml(name)}" style="flex:1;border:1px solid rgba(44,36,24,0.15);border-radius:8px;padding:6px 10px;font-size:13px;background:white;">
      <button type="button" class="h-price-del-btn" onclick="removeDoctorEditRow('${rowId}')">✕</button>
    </div>
    <input type="text" class="h-doctor-memo" placeholder="特徴・印象メモ（例: 説明が丁寧、外科担当）" value="${escHtml(memo)}" style="border:1px solid rgba(44,36,24,0.15);border-radius:8px;padding:5px 10px;font-size:12px;background:white;color:var(--text-light);">
  `;
  container.appendChild(row);
}

function removeDoctorEditRow(rowId) {
  if (!confirm('この担当医を削除しますか？')) return;
  const row = document.getElementById(rowId);
  if (row) row.remove();
}

function addPriceEditRow(name = '', price = '') {
  const container = document.getElementById('hospital-price-editor');
  if (!container) return;
  
  const rowId = 'price_row_' + Math.random().toString(36).substr(2, 9);
  const row = document.createElement('div');
  row.className = 'hospital-price-row';
  row.id = rowId;
  row.innerHTML = `
    <input type="text" class="h-price-name" placeholder="例: 爪切り, 5種混合" value="${escHtml(name)}">
    <input type="number" class="h-price-val" placeholder="料金(円)" value="${price}">
    <button type="button" class="h-price-del-btn" onclick="removePriceEditRow('${rowId}')">✕</button>
  `;
  container.appendChild(row);
}

function removePriceEditRow(rowId) {
  if (!confirm('この料金メニューを削除しますか？')) return;
  const row = document.getElementById(rowId);
  if (row) row.remove();
}

function saveHospitalRecord() {
  const name = document.getElementById('h-name').value.trim();
  if (!name) {
    alert('病院名を入力してください');
    return;
  }
  
  const data = loadData();
  const pets = data[currentType] || [];
  const idx = pets.findIndex(p => p.id === currentPetId);
  if (idx === -1) return;
  
  const pet = ensurePetHospitalFields(pets[idx]);
  const id = document.getElementById('edit-hospital-id').value;
  
  // 料金エディタ行からデータを収集
  const priceList = [];
  const rows = document.querySelectorAll('#hospital-price-editor .hospital-price-row');
  rows.forEach(row => {
    const pName = row.querySelector('.h-price-name').value.trim();
    const pPrice = row.querySelector('.h-price-val').value.trim();
    if (pName && pPrice) {
      priceList.push({
        name: pName,
        price: Number(pPrice)
      });
    }
  });
  
  // 担当医リスト収集（名前＋特徴メモ）
  const doctors = [];
  document.querySelectorAll('#hospital-doctor-editor > div').forEach(row => {
    const nameInp = row.querySelector('.h-doctor-name');
    const memoInp = row.querySelector('.h-doctor-memo');
    const n = nameInp ? nameInp.value.trim() : '';
    if (n) doctors.push({ id: 'doc_' + Date.now() + '_' + Math.random().toString(36).substr(2,5), name: n, memo: memoInp ? memoInp.value.trim() : '' });
  });

  const hospData = {
    id: id || 'hosp_' + Date.now(),
    name,
    phone: document.getElementById('h-phone').value.trim(),
    address: document.getElementById('h-address').value.trim(),
    doctors,
    memo: document.getElementById('h-memo').value.trim(),
    priceList
  };
  
  const hospitals = getHospitals();
  if (id) {
    const hIdx = hospitals.findIndex(h => h.id === id);
    if (hIdx !== -1) hospitals[hIdx] = hospData;
  } else {
    hospitals.push(hospData);
  }
  saveHospitals(hospitals);
  
  closeModal(null, 'modal-hospital');
  renderHospitalMaster();
  renderMedicalTimeline(); // 通院モーダルのセレクトリスト更新用
  showToast(id ? '病院情報を更新しました ✓' : '病院を登録しました ✓');
}

function deleteHospitalRecord(hospitalId) {
  if (!confirm('この病院を削除しますか？紐づく通院記録の表示に影響する場合があります。')) return;
  
  const data = loadData();
  const pets = data[currentType] || [];
  const idx = pets.findIndex(p => p.id === currentPetId);
  if (idx === -1) return;
  
  ensurePetHospitalFields(pets[idx]);
  
  const hospitals = getHospitals().filter(h => h.id !== hospitalId);
  saveHospitals(hospitals);
  
  renderHospitalMaster();
  showToast('病院を削除しました');
}

// 共有用テキスト自動生成ヘルパー（シンプル形式：病院名・電話・住所のみ）
function generateHospitalShareText(hosp) {
  let shareText = `${hosp.name}`;
  if (hosp.phone) shareText += `\n${hosp.phone}`;
  if (hosp.address) shareText += `\n${hosp.address}`;
  return shareText;
}

// コピペ処理（フォールバック用）
function fallbackCopyTextToClipboard(text) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  
  textArea.style.top = "0";
  textArea.style.left = "0";
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  
  try {
    const successful = document.execCommand('copy');
    if (successful) {
      showToast('病院情報をコピーしました！LINE等に貼り付けられます ✓');
    } else {
      alert('コピーに失敗しました。お手数ですが手動でコピーしてください。');
    }
  } catch (err) {
    alert('コピーに失敗しました。お手数ですが手動でコピーしてください。');
  }
  
  document.body.removeChild(textArea);
}

// ワンタップシェア機能（直接クリップボードにコピー）
function shareHospital(hospitalId) {
  const data = loadData();
  const pet = (data[currentType] || []).find(p => p.id === currentPetId);
  if (!pet) return;
  
  const hosp = getHospitals().find(h => h.id === hospitalId);
  if (!hosp) return;
  
  const text = generateHospitalShareText(hosp);
  
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('病院情報をコピーしました！LINE等に貼り付けられます ✓');
    }).catch(() => {
      fallbackCopyTextToClipboard(text);
    });
  } else {
    fallbackCopyTextToClipboard(text);
  }
}

// ==========================================
// 4. 通院履歴タイムラインのロジック
// ==========================================
function filterMedicalTimeline(filter) {
  currentMedicalFilter = filter;
  
  // フィルターボタンのアクティブ状態切り替え
  const btns = document.querySelectorAll('.medical-filter-btn');
  btns.forEach(btn => {
    const onclickStr = btn.getAttribute('onclick');
    if (onclickStr && onclickStr.includes(filter)) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  renderMedicalTimeline();
}

function renderMedicalTimeline() {
  const data = loadData();
  const pet = (data[currentType] || []).find(p => p.id === currentPetId);
  if (!pet) return;
  
  ensurePetHospitalFields(pet);
  
  const container = document.getElementById('medical-timeline-container');
  
  // フィルター適用
  let records = pet.medicalRecords;
  if (currentMedicalFilter !== 'all') {
    records = records.filter(r => r.type === currentMedicalFilter);
  }
  
  if (records.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding:40px 20px">
        <div style="font-size:44px;margin-bottom:12px">🏥</div>
        <p>該当する通院記録がありません</p>
      </div>
    `;
    return;
  }
  
  // 日付の降順にソート
  records.sort((a, b) => b.date.localeCompare(a.date));
  
  // 年（YYYY）ごとにグループ化
  const groups = {};
  records.forEach(rec => {
    const year = rec.date.split('-')[0] || '不明';
    if (!groups[year]) groups[year] = [];
    groups[year].push(rec);
  });
  
  const sortedYears = Object.keys(groups).sort((a,b) => b.localeCompare(a));
  const currentYear = new Date().getFullYear().toString();
  
  container.innerHTML = sortedYears.map((year, index) => {
    // 最初のグループ、あるいは今年ならデフォルト展開（openクラスを付与）
    const isOpen = index === 0 || year === currentYear;
    const yearRecords = groups[year];
    
    const recordsHtml = yearRecords.map(rec => {
      const hosp = getHospitals().find(h => h.id === rec.hospitalId);
      const hospName = hosp ? hosp.name : '不明な病院';
      const icon = rec.type === 'vaccine' ? '💉' : '🏥';
      const iconClass = rec.type === 'vaccine' ? 'vaccine-type' : '';
      
      let caresList = [];
      if (rec.cares) {
        if (rec.cares.nail) caresList.push('💅爪切り');
        if (rec.cares.tooth) caresList.push('🪥歯磨き');
        if (rec.cares.flea) caresList.push('🛡️ノミダニ');
      }
      const caresHtml = caresList.length > 0 ? `<div class="timeline-item-meta" style="color:var(--text-dark); font-weight:700;">日常ケア：${caresList.join('、')}</div>` : '';
      const weightHtml = rec.weight ? `<div class="timeline-item-meta" style="color:var(--text-dark); font-weight:700;">体重：${rec.weight} kg</div>` : '';

      return `
        <div class="timeline-item">
          <div class="timeline-item-icon ${iconClass}">${icon}</div>
          <div class="timeline-item-content">
            <div class="timeline-item-header">
              <span class="timeline-item-date-hosp">${escHtml(formatDate(rec.date))}<br><span style="font-size:12px;color:var(--text-mid);font-weight:700;">${escHtml(hospName)}</span></span>
              ${rec.cost ? `<span class="timeline-item-cost">${Number(rec.cost).toLocaleString()} 円</span>` : ''}
            </div>
            ${rec.doctor ? `<div class="timeline-item-meta">担当医：${escHtml(rec.doctor)}</div>` : ''}
            ${weightHtml}
            ${caresHtml}

            ${rec.vaccineName ? `
              <div class="vaccine-info-pill" style="margin-top:6px; display:inline-block; background:rgba(200, 132, 74, 0.08); padding:4px 8px; border-radius:8px; font-size:12px; font-weight:700; color:var(--accent)">
                🛡️ 接種・検査：${escHtml(rec.vaccineName)}
              </div>` : ''}
            
            ${rec.antibodyVals ? `
              <div class="antibody-vals-box" style="margin-top:6px; background:var(--cream); padding:8px 12px; border-radius:8px; font-size:12px; border:1px solid rgba(44,36,24,0.05)">
                <p style="margin:0 0 4px 0; font-weight:700; color:var(--text-dark)">🔬 主要3種抗体価結果：</p>
                <div style="display:flex; gap:12px; font-weight:700; color:var(--text-mid)">
                  <span>${currentType === 'dog' ? 'CDV' : 'FCV'}: <strong style="color:var(--accent)">${escHtml(rec.antibodyVals.val1 || '-')}</strong></span>
                  <span>${currentType === 'dog' ? 'CAV' : 'FHV'}: <strong style="color:var(--accent)">${escHtml(rec.antibodyVals.val2 || '-')}</strong></span>
                  <span>${currentType === 'dog' ? 'CPV' : 'FPV'}: <strong style="color:var(--accent)">${escHtml(rec.antibodyVals.val3 || '-')}</strong></span>
                </div>
              </div>` : ''}
            
            ${rec.notes ? `<div class="timeline-item-notes" style="margin-top:6px;">${escHtml(rec.notes)}</div>` : ''}
            ${rec.photo ? `<img class="timeline-item-photo" src="${rec.photo}" alt="領収書・明細書" onclick="window.open('${rec.photo}','_blank')">` : ''}
            
            <div class="timeline-item-actions">
              <button class="timeline-action-btn" onclick="openMedicalRecordModal('${rec.id}')">✏️ 編集</button>
              <button class="timeline-action-btn delete" onclick="deleteMedicalRecord('${rec.id}')">✕ 削除</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="timeline-year-group ${isOpen ? 'open' : ''}" id="year-group-${year}">
        <div class="timeline-year-header" onclick="toggleYearGroup('${year}')">
          <span class="timeline-year-title">${year}年 <span class="timeline-year-count">(${yearRecords.length}件)</span></span>
          <span class="timeline-year-arrow">▼</span>
        </div>
        <div class="timeline-year-body">
          ${recordsHtml}
        </div>
      </div>
    `;
  }).join('');
}

function toggleYearGroup(year) {
  const el = document.getElementById(`year-group-${year}`);
  if (el) el.classList.toggle('open');
}

// ========== まとめて通院記録 ==========
let bulkSyncValues = {}; // 同期中の共通値
let bulkTargetIds = new Set(); // 現在表示中のペットIDセット

function openBulkMedicalModal() {
  const data = loadData();

  const currentPets = (data[currentType] || []);
  if (currentPets.length === 0) { alert('ペットが登録されていません'); return; }

  bulkSyncValues = {};
  document.getElementById('bulk-m-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('bulk-m-hospital-select').innerHTML =
    '<option value="">-- 選択してください --</option>' +
    getHospitals().map(h => `<option value="${h.id}">${escHtml(h.name)}</option>`).join('');
  document.getElementById('bulk-m-hospital-select').value = '';
  document.getElementById('bulk-m-cost').value = '';

  // 全ペット一覧（dog+cat）
  const allPets = [
    ...(data.dog || []).map(p => ({...p, petType:'dog'})),
    ...(data.cat || []).map(p => ({...p, petType:'cat'}))
  ];

  // 初期表示: 家族タグがある子のみ（なければ全員）
  const hasFamilyTag = allPets.filter(p => p.familyTag);
  const initialTargets = hasFamilyTag.length > 0 ? hasFamilyTag : allPets;

  // 現在のペットIDセットを初期化
  bulkTargetIds = new Set(initialTargets.map(p => `${p.petType}-${p.id}`));

  renderBulkPetsList(allPets);
  document.getElementById('modal-bulk-medical').classList.add('open');
}

function renderBulkPetsList(allPets) {
  if (!allPets) {
    const data = loadData();
    allPets = [
      ...(data.dog || []).map(p => ({...p, petType:'dog'})),
      ...(data.cat || []).map(p => ({...p, petType:'cat'}))
    ];
  }

  const inTargets = allPets.filter(p => bulkTargetIds.has(`${p.petType}-${p.id}`));
  const notInTargets = allPets.filter(p => !bulkTargetIds.has(`${p.petType}-${p.id}`));

  const list = document.getElementById('bulk-pets-list');

  let html = inTargets.map(pet => `
    <div class="bulk-pet-row" id="bulk-row-${pet.petType}-${pet.id}">
      <div class="bulk-pet-row-header" onclick="toggleBulkPetRow('${pet.petType}-${pet.id}')">
        <div style="display:flex;align-items:center;gap:8px;">
          <div class="bulk-pet-photo" style="background:none;font-size:24px;width:auto;height:auto;">${pet.petType==='dog'?'🐕':'🐈'}</div>
          <div>
            <div style="font-weight:700;font-size:14px;color:var(--text-dark);">${escHtml(pet.name)}</div>
            <div style="font-size:11px;color:var(--text-light);">${escHtml(pet.familyTag || '家族タグなし')}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <button onclick="event.stopPropagation();removeBulkTarget('${pet.petType}-${pet.id}')" style="border:none;background:#f3d6d6;color:#b44;border-radius:8px;padding:4px 8px;font-size:11px;font-weight:700;cursor:pointer;">除外</button>
          <span style="font-size:16px;color:var(--text-light);">›</span>
        </div>
      </div>
      <div class="bulk-pet-row-body" id="bulk-body-${pet.petType}-${pet.id}" style="display:none;">
        <div style="padding:10px 0 0 0;">
          <label class="field-label" style="font-size:11px;">体重 (kg)</label>
          <input type="number" id="bulk-weight-${pet.petType}-${pet.id}" class="field-input" placeholder="例: 4.5" step="0.01" min="0" style="margin-bottom:6px;">
          <label class="field-label" style="font-size:11px;">メモ（この子だけ）</label>
          <textarea id="bulk-notes-${pet.petType}-${pet.id}" class="field-input" rows="2"></textarea>
        </div>
      </div>
    </div>
  `).join('');

  // 追加可能な子のセクション
  if (notInTargets.length > 0) {
    html += `
      <div style="margin-top:10px; border-top:1px dashed rgba(44,36,24,0.12); padding-top:10px;">
        <p style="font-size:11px;font-weight:700;color:var(--text-light);margin-bottom:6px;">追加できる子</p>
        ${notInTargets.map(pet => `
          <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(44,36,24,0.05);">
            <span style="font-size:18px;">${pet.petType==='dog'?'🐕':'🐈'}</span>
            <div style="flex:1;">
              <div style="font-size:13px;font-weight:700;color:var(--text-dark);">${escHtml(pet.name)}</div>
              <div style="font-size:11px;color:var(--text-light);">${escHtml(pet.familyTag || '家族タグなし')}</div>
            </div>
            <button onclick="addBulkTarget('${pet.petType}','${pet.id}')" style="border:none;background:rgba(200,132,74,0.15);color:var(--accent);border-radius:8px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;">追加</button>
          </div>
        `).join('')}
      </div>
    `;
  }

  list.innerHTML = html;
}

function addBulkTarget(petType, petId) {
  bulkTargetIds.add(`${petType}-${petId}`);
  const data = loadData();
  const allPets = [
    ...(data.dog || []).map(p => ({...p, petType:'dog'})),
    ...(data.cat || []).map(p => ({...p, petType:'cat'}))
  ];
  renderBulkPetsList(allPets);
}

function removeBulkTarget(id) {
  if (!confirm('この子を今回のまとめ記録対象から外しますか？')) return;
  bulkTargetIds.delete(id);
  const data = loadData();
  const allPets = [
    ...(data.dog || []).map(p => ({...p, petType:'dog'})),
    ...(data.cat || []).map(p => ({...p, petType:'cat'}))
  ];
  renderBulkPetsList(allPets);
}

function toggleBulkPetRow(petId) {
  const body = document.getElementById('bulk-body-' + petId);
  if (!body) return;
  body.style.display = body.style.display === 'none' ? 'block' : 'none';
}

function saveBulkMedicalRecord() {
  const date = document.getElementById('bulk-m-date').value;
  const hospitalId = document.getElementById('bulk-m-hospital-select').value;
  if (!date || !hospitalId) { alert('日付と病院を選択してください'); return; }

  const sharedCost = document.getElementById('bulk-m-cost').value;
  const data = loadData();
  let savedCount = 0;

  ['dog','cat'].forEach(type => {
  const allPets = data[type] || [];

  allPets.forEach(pet => {
    // bulkTargetIdsに含まれているかで対象を判定
    if (!bulkTargetIds.has(`${type}-${pet.id}`)) return;

    const petIdx = allPets.findIndex(p => p.id === pet.id);
    if (petIdx === -1) return;
    const p = ensurePetHospitalFields(allPets[petIdx]);

    const recWeight = (document.getElementById('bulk-weight-' + type + '-' + pet.id)?.value || '').trim();
    const nailChecked = document.getElementById('bulk-nail-' + pet.id)?.checked || false;
    const toothChecked = document.getElementById('bulk-tooth-' + pet.id)?.checked || false;
    const fleaChecked = document.getElementById('bulk-flea-' + pet.id)?.checked || false;
    const notes = (document.getElementById('bulk-notes-' + type + '-' + pet.id)?.value || '').trim();

    const recData = {
      id: 'med_' + Date.now() + '_' + Math.random().toString(36).substr(2,5),
      date,
      type: 'medical',
      hospitalId,
      doctor: '',
      cost: sharedCost ? Number(sharedCost) : '',
      notes,
      photo: null,
      weight: recWeight ? Number(recWeight) : '',
      cares: { nail: nailChecked, tooth: toothChecked, flea: fleaChecked },
      vaccineName: '',
      antibodyVals: null
    };

    p.medicalRecords.push(recData);

    if (recWeight) {
      const wVal = Number(recWeight);
      const existingWIdx = p.weightHistory.findIndex(w => w.date === date);
      if (existingWIdx !== -1) {
        p.weightHistory[existingWIdx].weight = wVal;
      } else {
        p.weightHistory.push({ id: 'w_' + Date.now() + '_' + Math.random().toString(36).substr(2,5), date, weight: wVal });
      }
      const sortedHistory = [...p.weightHistory].sort((a,b) => b.date.localeCompare(a.date));
      if (sortedHistory.length > 0) p.weight = String(sortedHistory[0].weight);
    }

    if (nailChecked || toothChecked || fleaChecked) {
      if (!p.quickCares[date]) p.quickCares[date] = {};
      if (nailChecked) p.quickCares[date].nail = true;
      if (toothChecked) p.quickCares[date].tooth = true;
      if (fleaChecked) p.quickCares[date].flea = true;
    }

    allPets[petIdx] = p;
    savedCount++;
  });
  data[type] = allPets;
  });

  saveData(data);
  closeModal(null, 'modal-bulk-medical');

  // 現在開いているペットの画面を更新
  if (currentPetId) {
    renderMedicalTimeline();
    renderWeightSection();
    renderQuickCares();
    renderCareCalendar();
  }

  showToast(`${savedCount}頭分の通院記録を保存しました ✓`);
}

function openMedicalRecordModal(recordId = null) {
  const data = loadData();
  const pet = (data[currentType] || []).find(p => p.id === currentPetId);
  if (!pet) return;
  
  ensurePetHospitalFields(pet);
  
  // 病院のセレクトボックスの構築
  const select = document.getElementById('m-hospital-select');
  const sharedHospitals = getHospitals();
  select.innerHTML = '<option value="">-- 選択してください --</option>' + 
    sharedHospitals.map(h => `<option value="${h.id}">${escHtml(h.name)}</option>`).join('');
  
  // 各自フィールドの初期化
  document.getElementById('edit-medical-id').value = recordId || '';
  document.getElementById('m-date').value = new Date().toISOString().split('T')[0];
  // m-doctor は renderMedicalDoctorSelect で生成するためここでは何もしない
  document.getElementById('m-cost').value = '';
  document.getElementById('m-notes').value = '';
  document.getElementById('m-weight').value = '';
  document.getElementById('m-care-nail').checked = false;
  document.getElementById('m-care-tooth').checked = false;
  document.getElementById('m-care-flea').checked = false;
  document.getElementById('m-photo-preview').src = '';
  document.getElementById('m-photo-preview').classList.add('hidden');
  document.getElementById('m-photo-placeholder').classList.remove('hidden');
  tempMedicalPhoto = null;

  // ワクチン・抗体価詳細エリアの初期クリア
  document.getElementById('m-vaccine-select').innerHTML = '';
  document.getElementById('m-vaccine-custom').value = '';
  document.getElementById('m-vaccine-custom-wrap').style.display = 'none';
  document.getElementById('m-ab-val1').value = '';
  document.getElementById('m-ab-val2').value = '';
  document.getElementById('m-ab-val3').value = '';
  document.getElementById('m-antibody-area').style.display = 'none';

  // 犬猫に応じたラベル名切り替え
  if (currentType === 'dog') {
    document.getElementById('m-ab-lbl1').textContent = 'CDV (ジステンパー):';
    document.getElementById('m-ab-lbl2').textContent = 'CAV (アデノ):';
    document.getElementById('m-ab-lbl3').textContent = 'CPV (パルボ):';
  } else {
    document.getElementById('m-ab-lbl1').textContent = 'FCV (カリシ):';
    document.getElementById('m-ab-lbl2').textContent = 'FHV (ヘルペス):';
    document.getElementById('m-ab-lbl3').textContent = 'FPV (パルボ):';
  }

  // 犬猫に応じたワクチンセレクトオプション構築
  const vSelect = document.getElementById('m-vaccine-select');
  let vOptions = [];
  if (currentType === 'dog') {
    vOptions = [
      { value: '', text: '-- 選択してください --' },
      { value: '狂犬病予防注射', text: '狂犬病予防注射' },
      { value: '5種混合ワクチン', text: '5種混合ワクチン' },
      { value: '6種混合ワクチン', text: '6種混合ワクチン' },
      { value: '7種混合ワクチン', text: '7種混合ワクチン' },
      { value: '8種混合ワクチン', text: '8種混合ワクチン' },
      { value: '9種混合ワクチン', text: '9種混合ワクチン' },
      { value: '10種混合ワクチン', text: '10種混合ワクチン' },
      { value: '抗体価検査済', text: '抗体価検査済' },
      { value: 'custom', text: 'その他（自由記入）' }
    ];
  } else {
    vOptions = [
      { value: '', text: '-- 選択してください --' },
      { value: '3種混合ワクチン', text: '3種混合ワクチン' },
      { value: '4種混合ワクチン', text: '4種混合ワクチン' },
      { value: '5種混合ワクチン', text: '5種混合ワクチン' },
      { value: '抗体価検査済', text: '抗体価検査済' },
      { value: 'custom', text: 'その他（自由記入）' }
    ];
  }
  vSelect.innerHTML = vOptions.map(opt => `<option value="${opt.value}">${opt.text}</option>`).join('');

  selectMedicalType('medical');
  
  if (recordId) {
    document.getElementById('medical-modal-title').textContent = '通院記録を編集';
    const rec = pet.medicalRecords.find(r => r.id === recordId);
    if (rec) {
      document.getElementById('m-date').value = rec.date;
      selectMedicalType(rec.type || 'medical');
      select.value = rec.hospitalId;
      renderMedicalDoctorSelect(rec.hospitalId, rec.doctor || '');
      document.getElementById('m-cost').value = rec.cost || '';
      document.getElementById('m-notes').value = rec.notes || '';
      document.getElementById('m-weight').value = rec.weight || '';
      if (rec.cares) {
        document.getElementById('m-care-nail').checked = !!rec.cares.nail;
        document.getElementById('m-care-tooth').checked = !!rec.cares.tooth;
        document.getElementById('m-care-flea').checked = !!rec.cares.flea;
      }
      
      // ワクチン情報の復元
      if (rec.type === 'vaccine') {
        const hasPreset = vOptions.some(opt => opt.value === rec.vaccineName);
        if (hasPreset && rec.vaccineName !== '') {
          vSelect.value = rec.vaccineName;
        } else if (rec.vaccineName) {
          vSelect.value = 'custom';
          document.getElementById('m-vaccine-custom').value = rec.vaccineName;
          document.getElementById('m-vaccine-custom-wrap').style.display = 'block';
        }
        
        if (rec.vaccineName === '抗体価検査済' && rec.antibodyVals) {
          document.getElementById('m-antibody-area').style.display = 'block';
          document.getElementById('m-ab-val1').value = rec.antibodyVals.val1 || '';
          document.getElementById('m-ab-val2').value = rec.antibodyVals.val2 || '';
          document.getElementById('m-ab-val3').value = rec.antibodyVals.val3 || '';
        }
      }
      
      if (rec.photo) {
        tempMedicalPhoto = rec.photo;
        const preview = document.getElementById('m-photo-preview');
        preview.src = rec.photo;
        preview.classList.remove('hidden');
        document.getElementById('m-photo-placeholder').classList.add('hidden');
      }
    }
  } else {
    document.getElementById('medical-modal-title').textContent = '通院記録を追加';
    
    // 【前回のコンテキスト自動引き継ぎ機能】
    // 最も新しい既存の通院記録があれば、病院名と担当医をプリセット
    if (pet.medicalRecords.length > 0) {
      const sorted = [...pet.medicalRecords].sort((a,b) => b.date.localeCompare(a.date));
      const latest = sorted[0];
      
      // セレクトボックスに該当病院が存在すればセット
      if (getHospitals().some(h => h.id === latest.hospitalId)) {
        select.value = latest.hospitalId;
        renderMedicalDoctorSelect(latest.hospitalId, latest.doctor || '');
      }
    }
  }
  
  // 病院未選択状態での担当医UI初期化
  if (!document.getElementById('m-doctor-select')) {
    renderMedicalDoctorSelect(document.getElementById('m-hospital-select').value, '');
  }
  document.getElementById('modal-medical-record').classList.add('open');
  // 未消化の気になるメモを表示
  renderUndigestedNotesForModal(currentPetId);
}

function selectMedicalType(type) {
  document.getElementById('m-type').value = type;
  document.getElementById('m-type-medical').classList.toggle('selected', type === 'medical');
  document.getElementById('m-type-vaccine').classList.toggle('selected', type === 'vaccine');

  // タイプがワクチン・予防の場合のみワクチン記入セクションを表示
  const vacArea = document.getElementById('m-vaccine-area');
  if (vacArea) vacArea.style.display = type === 'vaccine' ? 'block' : 'none';
}

function onMedicalVaccineSelectChange() {
  const select = document.getElementById('m-vaccine-select');
  const customWrap = document.getElementById('m-vaccine-custom-wrap');
  const abArea = document.getElementById('m-antibody-area');
  
  if (select) {
    if (select.value === 'custom') {
      if (customWrap) customWrap.style.display = 'block';
      if (abArea) abArea.style.display = 'none';
    } else if (select.value === '抗体価検査済') {
      if (customWrap) customWrap.style.display = 'none';
      if (abArea) abArea.style.display = 'block';
    } else {
      if (customWrap) customWrap.style.display = 'none';
      if (abArea) abArea.style.display = 'none';
    }
  }
}

// 病院選択時に担当医選択UIを更新
function onMedicalHospitalChange() {
  const hospId = document.getElementById('m-hospital-select').value;
  renderMedicalDoctorSelect(hospId, '');
}

// 通院記録モーダルの担当医選択UIを構築
function renderMedicalDoctorSelect(hospId, currentDoctor) {
  const wrap = document.getElementById('m-doctor-wrap');
  if (!wrap) return;

  const hosp = hospId ? getHospitals().find(h => h.id === hospId) : null;
  const doctors = hosp ? (hosp.doctors || (hosp.doctor ? [{ name: hosp.doctor }] : [])) : [];

  if (doctors.length > 0) {
    // 登録済み担当医がいる場合 → 選択肢＋自由記入
    const options = doctors.map(d => `<option value="${escHtml(d.name)}" ${currentDoctor === d.name ? 'selected' : ''}>${escHtml(d.name)}${d.memo ? '（' + escHtml(d.memo) + '）' : ''}</option>`).join('');
    const isFree = currentDoctor && !doctors.some(d => d.name === currentDoctor);
    wrap.innerHTML = `
      <select id="m-doctor-select" class="field-input" onchange="onMedicalDoctorSelectChange()" style="margin-bottom:4px;">
        <option value="">-- 担当医を選択 --</option>
        ${options}
        <option value="__free__" ${isFree ? 'selected' : ''}>自由記入する</option>
      </select>
      <input type="text" id="m-doctor" class="field-input" placeholder="担当医名を記入" value="${escHtml(isFree ? currentDoctor : '')}" style="display:${isFree ? 'block' : 'none'}; margin-top:4px;">
    `;
  } else {
    // 登録された担当医がいない → テキスト入力のみ
    wrap.innerHTML = `<input type="text" id="m-doctor" class="field-input" placeholder="例: 山田先生" value="${escHtml(currentDoctor)}">`;
  }
}

function onMedicalDoctorSelectChange() {
  const sel = document.getElementById('m-doctor-select');
  const input = document.getElementById('m-doctor');
  if (!sel || !input) return;
  if (sel.value === '__free__') {
    input.style.display = 'block';
    input.value = '';
    input.focus();
  } else {
    input.style.display = 'none';
    input.value = sel.value;
  }
}

// 担当医の最終的な値を取得
function getMedicalDoctorValue() {
  const sel = document.getElementById('m-doctor-select');
  const inp = document.getElementById('m-doctor');
  if (sel) {
    if (sel.value === '__free__' || sel.value === '') {
      return inp ? inp.value.trim() : '';
    }
    return sel.value;
  }
  return inp ? inp.value.trim() : '';
}

function previewMedicalPhoto(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  compressAndLoad(file, data => {
    tempMedicalPhoto = data;
    const preview = document.getElementById('m-photo-preview');
    preview.src = data;
    preview.classList.remove('hidden');
    document.getElementById('m-photo-placeholder').classList.add('hidden');
  });
}

function saveMedicalRecord() {
  const date = document.getElementById('m-date').value;
  const hospitalId = document.getElementById('m-hospital-select').value;
  
  if (!date || !hospitalId) {
    alert('日付と病院を選択してください');
    return;
  }
  
  const data = loadData();
  const pets = data[currentType] || [];
  const idx = pets.findIndex(p => p.id === currentPetId);
  if (idx === -1) return;
  
  const pet = ensurePetHospitalFields(pets[idx]);
  const id = document.getElementById('edit-medical-id').value;
  
  const recWeight = document.getElementById('m-weight').value.trim();
  const nailChecked = document.getElementById('m-care-nail').checked;
  const toothChecked = document.getElementById('m-care-tooth').checked;
  const fleaChecked = document.getElementById('m-care-flea').checked;

  const recType = document.getElementById('m-type').value;
  let vaccineName = '';
  let antibodyVals = null;

  if (recType === 'vaccine') {
    const vSelectVal = document.getElementById('m-vaccine-select').value;
    if (vSelectVal === 'custom') {
      vaccineName = document.getElementById('m-vaccine-custom').value.trim();
    } else {
      vaccineName = vSelectVal;
    }
    
    if (vSelectVal === '抗体価検査済') {
      antibodyVals = {
        val1: document.getElementById('m-ab-val1').value.trim(),
        val2: document.getElementById('m-ab-val2').value.trim(),
        val3: document.getElementById('m-ab-val3').value.trim()
      };
    }
  }

  const recData = {
    id: id || 'med_' + Date.now(),
    date,
    type: recType,
    hospitalId,
    doctor: getMedicalDoctorValue(),
    cost: document.getElementById('m-cost').value ? Number(document.getElementById('m-cost').value) : '',
    notes: digestSelectedPendingNotes(currentPetId, document.getElementById('m-notes').value.trim()),
    photo: tempMedicalPhoto || null,
    weight: recWeight ? Number(recWeight) : '',
    cares: { nail: nailChecked, tooth: toothChecked, flea: fleaChecked },
    vaccineName,
    antibodyVals
  };
  
  if (id) {
    const rIdx = pet.medicalRecords.findIndex(r => r.id === id);
    if (rIdx !== -1) pet.medicalRecords[rIdx] = recData;
  } else {
    pet.medicalRecords.push(recData);
  }

  // 体重データの自動同期登録
  if (recWeight) {
    const wVal = Number(recWeight);
    const existingWIdx = pet.weightHistory.findIndex(w => w.date === date);
    if (existingWIdx !== -1) {
      pet.weightHistory[existingWIdx].weight = wVal;
    } else {
      pet.weightHistory.push({
        id: 'w_' + Date.now(),
        date,
        weight: wVal
      });
    }
    
    // 基本プロフィールの体重情報も最新日に連動
    const sortedHistory = [...pet.weightHistory].sort((a,b) => b.date.localeCompare(a.date));
    if (sortedHistory.length > 0) {
      pet.weight = String(sortedHistory[0].weight);
    }
  }

  // 日常ケア（爪切り、歯磨き、ノミダニ）の自動完了同期
  if (nailChecked || toothChecked || fleaChecked) {
    if (!pet.quickCares[date]) {
      pet.quickCares[date] = {};
    }
    if (nailChecked) pet.quickCares[date].nail = true;
    if (toothChecked) pet.quickCares[date].tooth = true;
    if (fleaChecked) pet.quickCares[date].flea = true;
  }

  // 【証明書への自動同期】ワクチン種別に応じて証明書側も更新
  if (recType === 'vaccine' && vaccineName) {
    let certKey = null;
    if (vaccineName === '狂犬病予防注射') {
      certKey = 'rabies';
    } else if (vaccineName === '抗体価検査済') {
      certKey = 'antibody';
    } else if (vaccineName !== '') {
      certKey = 'vaccine';
    }

    if (certKey) {
      if (!pet.certificates) pet.certificates = {};
      const existingCert = pet.certificates[certKey];
      // 証明書が未登録、または同日付以前の場合のみ上書き（より新しい証明書は上書きしない）
      if (!existingCert || existingCert.date <= date) {
        const newCert = { date, photo: recData.photo || (existingCert ? existingCert.photo : null) };
        if (certKey === 'vaccine') newCert.name = vaccineName;
        if (certKey === 'antibody' && antibodyVals) {
          newCert.abVal1 = antibodyVals.val1;
          newCert.abVal2 = antibodyVals.val2;
          newCert.abVal3 = antibodyVals.val3;
        }
        pet.certificates[certKey] = newCert;
      }
    }
  }

  pets[idx] = pet;
  data[currentType] = pets;
  saveData(data);
  
  closeModal(null, 'modal-medical-record');
  renderMedicalTimeline();
  renderHospitalMaster(); // 逆引き一覧の再更新用
  renderQuickCares();     // 同期した日常ケアの即時反映
  renderWeightSection();  // 体重グラフ等の即時反映
  renderCareCalendar();   // カレンダーの同期
  renderCertificates();   // 証明書側も即時反映
  showToast(id ? '記録を更新しました ✓' : '通院記録を保存しました ✓');
}

function deleteMedicalRecord(recordId) {
  if (!confirm('この通院記録を削除しますか？')) return;
  
  const data = loadData();
  const pets = data[currentType] || [];
  const idx = pets.findIndex(p => p.id === currentPetId);
  if (idx === -1) return;
  
  const pet = ensurePetHospitalFields(pets[idx]);
  pet.medicalRecords = pet.medicalRecords.filter(r => r.id !== recordId);
  
  // 巻き戻しロジック：通院記録削除後も体重を正しい最新値に更新
  rollbackWeight(pet);
  
  pets[idx] = pet;
  data[currentType] = pets;
  saveData(data);
  
  renderMedicalTimeline();
  renderHospitalMaster();
  renderWeightSection();
  showToast('記録を削除しました');
}

// ==========================================
// 5. 証明書機能のロジック
// ==========================================
function renderCertificates() {
  const data = loadData();
  const pet = (data[currentType] || []).find(p => p.id === currentPetId);
  if (!pet) return;
  
  ensurePetHospitalFields(pet);
  
  const container = document.getElementById('certificates-container');
  
  // 表示する証明書カードの定義
  const certs = [];
  const typeLabel = currentType === 'dog' ? '犬' : '猫';
  
  // 1. 混合ワクチン
  const vLimit = currentType === 'dog' ? '5〜10種混合' : '3〜5種混合';
  certs.push({
    key: 'vaccine',
    title: `🛡️ 混合ワクチン予防接種証明書`,
    badge: 'ワクチン証明',
    desc: `${typeLabel}用の混合ワクチン（${vLimit}）`,
    data: pet.certificates.vaccine || null
  });
  
  // 2. 狂犬病ワクチン (犬のみ)
  if (currentType === 'dog') {
    certs.push({
      key: 'rabies',
      title: `🐕 狂犬病予防注射済証`,
      badge: '狂犬病証明',
      desc: '狂犬病予防法に基づく注射済証明',
      data: pet.certificates.rabies || null
    });
  }
  
  // 3. 抗体価検査
  certs.push({
    key: 'antibody',
    title: `🔬 抗体価検査証明（結果報告）`,
    badge: '抗体価検査',
    desc: 'パルボFPV、カリシFCV、ヘルペスFHV1等の抗体価',
    data: pet.certificates.antibody || null
  });
  
  container.innerHTML = certs.map(c => {
    const hasData = !!c.data;
    const dateVal = hasData ? formatDate(c.data.date) : '未登録';
    const detailRows = [];
    
    if (c.key === 'vaccine') {
      detailRows.push(`<div class="cert-detail-row"><span class="cert-detail-lbl">ワクチン名</span><span class="cert-detail-val">${escHtml(hasData ? c.data.name : '-')}</span></div>`);
    }
    
    if (c.key === 'antibody') {
      const typeAb1 = currentType === 'dog' ? 'CDV' : 'FCV';
      const typeAb2 = currentType === 'dog' ? 'CAV' : 'FHV';
      const typeAb3 = currentType === 'dog' ? 'CPV' : 'FPV';
      
      detailRows.push(`
        <div class="cert-detail-row" style="flex-direction:column; align-items:flex-start; gap:4px; border-bottom:none;">
          <span class="cert-detail-lbl">主要3種抗体価結果</span>
          <div style="display:flex; gap:16px; font-size:12px; font-weight:700; color:var(--text-mid); margin-top:2px;">
            <span>${typeAb1}: <strong style="color:var(--accent)">${escHtml(hasData && c.data.abVal1 ? c.data.abVal1 : '-')}</strong></span>
            <span>${typeAb2}: <strong style="color:var(--accent)">${escHtml(hasData && c.data.abVal2 ? c.data.abVal2 : '-')}</strong></span>
            <span>${typeAb3}: <strong style="color:var(--accent)">${escHtml(hasData && c.data.abVal3 ? c.data.abVal3 : '-')}</strong></span>
          </div>
        </div>
      `);
    }
    
    const photoHtml = (hasData && c.data.photo)
      ? `<div class="cert-card-photo-wrap"><img class="cert-card-photo" src="${c.data.photo}" alt="証明写真" onclick="window.open('${c.data.photo}','_blank')"></div>`
      : `<div class="cert-card-photo-wrap"><div class="cert-photo-empty">ロット番号シールや領収書・証明写真がありません</div></div>`;
      
    return `
      <div class="cert-card ${c.key}-card">
        <span class="cert-card-badge">${c.badge}</span>
        <div class="cert-card-title">${c.title}</div>
        
        <div class="cert-card-details">
          <div class="cert-detail-row">
            <span class="cert-detail-lbl">接種・検査日</span>
            <span class="cert-detail-val">${escHtml(dateVal)}</span>
          </div>
          ${detailRows.join('')}
        </div>
        
        ${photoHtml}
        
        <div class="cert-card-actions">
          <button class="cert-card-btn upload" onclick="openCertificateModal('${c.key}')">${hasData ? '✏️ 編集する' : '＋ 証明書を登録する'}</button>
          ${hasData ? `<button class="cert-card-btn" onclick="deleteCertificateRecord('${c.key}')">✕ クリア</button>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function openCertificateModal(certKey) {
  document.getElementById('cert-key').value = certKey;
  
  // 入力項目の出し分け
  const nameWrap = document.getElementById('c-name-wrap');
  const resultWrap = document.getElementById('c-result-wrap');
  
  nameWrap.style.display = certKey === 'vaccine' ? 'block' : 'none';
  resultWrap.style.display = certKey === 'antibody' ? 'block' : 'none';
  
  // デフォルト値の初期化
  document.getElementById('c-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('c-name').value = '';
  document.getElementById('c-ab-val1').value = '';
  document.getElementById('c-ab-val2').value = '';
  document.getElementById('c-ab-val3').value = '';
  document.getElementById('c-photo-preview').src = '';
  document.getElementById('c-photo-preview').classList.add('hidden');
  document.getElementById('c-photo-placeholder').classList.remove('hidden');
  tempCertPhoto = null;

  // 犬猫に応じたラベル名切り替え
  if (currentType === 'dog') {
    document.getElementById('c-ab-lbl1').textContent = 'CDV (ジステンパー):';
    document.getElementById('c-ab-lbl2').textContent = 'CAV (アデノ):';
    document.getElementById('c-ab-lbl3').textContent = 'CPV (パルボ):';
  } else {
    document.getElementById('c-ab-lbl1').textContent = 'FCV (カリシ):';
    document.getElementById('c-ab-lbl2').textContent = 'FHV (ヘルペス):';
    document.getElementById('c-ab-lbl3').textContent = 'FPV (パルボ):';
  }
  
  // セレクトボックスの犬猫別オプション構築
  const select = document.getElementById('c-name-select');
  if (select) {
    let options = [];
    if (currentType === 'dog') {
      options = [
        { value: '', text: '-- 選択してください --' },
        { value: '狂犬病予防ワクチン', text: '狂犬病予防ワクチン' },
        { value: '5種混合ワクチン', text: '5種混合ワクチン' },
        { value: '6種混合ワクチン', text: '6種混合ワクチン' },
        { value: '7種混合ワクチン', text: '7種混合ワクチン' },
        { value: '8種混合ワクチン', text: '8種混合ワクチン' },
        { value: '9種混合ワクチン', text: '9種混合ワクチン' },
        { value: '10種混合ワクチン', text: '10種混合ワクチン' },
        { value: '抗体価検査済', text: '抗体価検査済' },
        { value: 'custom', text: 'その他の薬・ワクチン（自由記入）' }
      ];
    } else {
      // 猫の場合
      options = [
        { value: '', text: '-- 選択してください --' },
        { value: '3種混合ワクチン', text: '3種混合ワクチン' },
        { value: '4種混合ワクチン', text: '4種混合ワクチン' },
        { value: '5種混合ワクチン', text: '5種混合ワクチン' },
        { value: '抗体価検査済', text: '抗体価検査済' },
        { value: 'custom', text: 'その他の薬・ワクチン（自由記入）' }
      ];
    }
    select.innerHTML = options.map(opt => `<option value="${opt.value}">${opt.text}</option>`).join('');
    
    // 自由入力フィールドは最初非表示にする
    const customNameWrap = document.getElementById('c-name-custom-wrap');
    if (customNameWrap) customNameWrap.style.display = 'none';
  }
  
  const titleMap = {
    vaccine: '混合ワクチン証明書を登録',
    rabies: '狂犬病予防注射済証を登録',
    antibody: '抗体価検査証明を登録'
  };
  document.getElementById('cert-modal-title').textContent = titleMap[certKey] || '証明書を登録';
  
  // 既存データ取得
  const data = loadData();
  const pet = (data[currentType] || []).find(p => p.id === currentPetId);
  if (pet && pet.certificates && pet.certificates[certKey]) {
    const c = pet.certificates[certKey];
    document.getElementById('c-date').value = c.date;
    
    if (certKey === 'vaccine') {
      const select = document.getElementById('c-name-select');
      const customNameWrap = document.getElementById('c-name-custom-wrap');
      
      // プリセットに含まれる値かどうか判定
      const hasPreset = Array.from(select.options).some(opt => opt.value === c.name);
      if (hasPreset && c.name !== '') {
        select.value = c.name;
        if (customNameWrap) customNameWrap.style.display = 'none';
      } else if (c.name) {
        // 自由記入の場合
        select.value = 'custom';
        document.getElementById('c-name').value = c.name;
        if (customNameWrap) customNameWrap.style.display = 'block';
      }
    }
    
    if (certKey === 'antibody') {
      document.getElementById('c-ab-val1').value = c.abVal1 || '';
      document.getElementById('c-ab-val2').value = c.abVal2 || '';
      document.getElementById('c-ab-val3').value = c.abVal3 || '';
    }
    
    if (c.photo) {
      tempCertPhoto = c.photo;
      const preview = document.getElementById('c-photo-preview');
      preview.src = c.photo;
      preview.classList.remove('hidden');
      document.getElementById('c-photo-placeholder').classList.add('hidden');
    }
  }
  
  document.getElementById('modal-certificate').classList.add('open');
}

// セレクトボックス変更時のハンドラ
function onCertNameSelectChange() {
  const select = document.getElementById('c-name-select');
  const customNameWrap = document.getElementById('c-name-custom-wrap');
  if (select && customNameWrap) {
    if (select.value === 'custom') {
      customNameWrap.style.display = 'block';
    } else {
      customNameWrap.style.display = 'none';
    }
  }
}

function previewCertPhoto(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  compressAndLoad(file, data => {
    tempCertPhoto = data;
    const preview = document.getElementById('c-photo-preview');
    preview.src = data;
    preview.classList.remove('hidden');
    document.getElementById('c-photo-placeholder').classList.add('hidden');
  });
}

function saveCertificateRecord() {
  const date = document.getElementById('c-date').value;
  const certKey = document.getElementById('cert-key').value;
  
  if (!date) {
    alert('接種・検査日を入力してください');
    return;
  }
  
  let vaccineName = '';
  if (certKey === 'vaccine') {
    const selectVal = document.getElementById('c-name-select').value;
    if (selectVal === 'custom') {
      vaccineName = document.getElementById('c-name').value.trim();
    } else {
      vaccineName = selectVal;
    }
    
    if (!vaccineName) {
      alert('ワクチンの種類/製品名を選択または入力してください');
      return;
    }
  }
  
  const data = loadData();
  const pets = data[currentType] || [];
  const idx = pets.findIndex(p => p.id === currentPetId);
  if (idx === -1) return;
  
  const pet = ensurePetHospitalFields(pets[idx]);
  
  const certData = {
    date,
    photo: tempCertPhoto || null
  };
  
  if (certKey === 'vaccine') certData.name = vaccineName;
  if (certKey === 'antibody') {
    certData.abVal1 = document.getElementById('c-ab-val1').value.trim();
    certData.abVal2 = document.getElementById('c-ab-val2').value.trim();
    certData.abVal3 = document.getElementById('c-ab-val3').value.trim();
  }
  
  pet.certificates[certKey] = certData;
  
  // 【通院履歴への自動同期登録機能】
  let syncName = '';
  let syncAbVals = null;
  let syncNotes = '';

  if (certKey === 'vaccine') {
    syncName = vaccineName;
    syncNotes = '混合ワクチン予防接種証明書から同期登録';
  } else if (certKey === 'rabies') {
    syncName = '狂犬病予防注射';
    syncNotes = '狂犬病予防注射済証から同期登録';
  } else if (certKey === 'antibody') {
    syncName = '抗体価検査済';
    syncAbVals = {
      val1: certData.abVal1,
      val2: certData.abVal2,
      val3: certData.abVal3
    };
    syncNotes = '抗体価検査結果証明から同期登録';
  }

  // 最新の通院記録から病院・担当医・体重を引き継ぐ
  let inheritHospitalId = getHospitals()[0] ? getHospitals()[0].id : '';
  let inheritDoctor = '';
  let inheritWeight = '';
  if (pet.medicalRecords.length > 0) {
    const latestRec = [...pet.medicalRecords].sort((a, b) => b.date.localeCompare(a.date))[0];
    if (latestRec.hospitalId) inheritHospitalId = latestRec.hospitalId;
    if (latestRec.doctor) inheritDoctor = latestRec.doctor;
    if (latestRec.weight) inheritWeight = latestRec.weight;
  }

  // 重複チェック (同じ日付かつ同じ種類のワクチン/予防記録があるか)
  let existingRec = pet.medicalRecords.find(r => r.date === date && r.type === 'vaccine' && r.vaccineName === syncName);
  
  if (existingRec) {
    existingRec.photo = certData.photo || existingRec.photo;
    if (syncAbVals) {
      existingRec.antibodyVals = syncAbVals;
    }
  } else {
    const newMedRec = {
      id: 'med_' + Date.now(),
      date,
      type: 'vaccine',
      hospitalId: inheritHospitalId,
      doctor: inheritDoctor,
      cost: '',
      notes: syncNotes,
      photo: certData.photo || null,
      weight: inheritWeight,
      cares: { nail: false, tooth: false, flea: false },
      vaccineName: syncName,
      antibodyVals: syncAbVals
    };
    pet.medicalRecords.push(newMedRec);

    // 引き継いだ体重を体重履歴にも同期
    if (inheritWeight) {
      const wVal = Number(inheritWeight);
      const existingWIdx = pet.weightHistory.findIndex(w => w.date === date);
      if (existingWIdx === -1) {
        pet.weightHistory.push({ id: 'w_' + Date.now(), date, weight: wVal });
      }
    }
  }
  
  pets[idx] = pet;
  data[currentType] = pets;
  saveData(data);
  
  closeModal(null, 'modal-certificate');
  renderCertificates();
  renderMedicalTimeline(); // タイムライン側も即座に再描画
  showToast('証明書を保存し、通院履歴にも自動同期しました ✓');
}

function deleteCertificateRecord(certKey) {
  if (!confirm('この証明書の記録を削除（クリア）しますか？')) return;
  
  const data = loadData();
  const pets = data[currentType] || [];
  const idx = pets.findIndex(p => p.id === currentPetId);
  if (idx === -1) return;
  
  const pet = ensurePetHospitalFields(pets[idx]);
  delete pet.certificates[certKey];
  
  pets[idx] = pet;
  data[currentType] = pets;
  saveData(data);
  
  renderCertificates();
  showToast('証明書データをクリアしました');
}

// ==========================================
// 6. お薬管理（マスター）とお薬服用カウンターのロジック
// ==========================================

// 服用ステータス（服用中/終了）の切り替え
function selectMedicineStatus(status) {
  const currentStatusInput = document.getElementById('med-status');
  if (currentStatusInput) currentStatusInput.value = status;
  
  const btnActive = document.getElementById('med-status-active');
  const btnEnded = document.getElementById('med-status-ended');
  if (btnActive) btnActive.classList.toggle('selected', status === 'active');
  if (btnEnded) btnEnded.classList.toggle('selected', status === 'ended');
}

// 特定日付におけるペットの年齢を算出するヘルパー関数
function calculateAgeAtDate(birthdayStr, targetDateStr) {
  if (!birthdayStr || !targetDateStr) return '不明';
  const birth = new Date(birthdayStr);
  const target = new Date(targetDateStr);
  
  let years = target.getFullYear() - birth.getFullYear();
  let months = target.getMonth() - birth.getMonth();
  
  if (months < 0) {
    years--;
    months += 12;
  }
  
  if (years < 0) return '誕生前';
  if (years === 0) return `${months}ヶ月`;
  return `${years}歳${months}ヶ月`;
}

// 本日のお薬チェックの並び替えモードをトグル
function toggleMedicineSortMode() {
  medicineSortModeActive = !medicineSortModeActive;
  const btn = document.getElementById('medicine-sort-mode-btn');
  if (btn) {
    btn.textContent = medicineSortModeActive ? '✓ 完了' : '↕ 並び替え';
    btn.style.background = medicineSortModeActive ? 'rgba(200,132,74,0.15)' : '';
    btn.style.color = medicineSortModeActive ? 'var(--accent)' : '';
  }
  renderMedicineCareSection();
}

// 日常ケアのお薬服用カウンターセクションの描画（服用中のお薬のみ表示）
function renderMedicineCareSection() {
  const data = loadData();
  const pet = (data[currentType] || []).find(p => p.id === currentPetId);
  if (!pet) return;
  
  ensurePetHospitalFields(pet);
  
  const container = document.getElementById('medicine-care-grid');
  if (!container) return;
  
  const dateStr = document.getElementById('quick-care-date').value;
  if (!dateStr) return;
  
  const activeMedicines = pet.medicines.filter(med => (med.status || 'active') === 'active');
  
  if (activeMedicines.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding:15px; grid-column: 1/-1;">
        <p style="font-size:13px;color:var(--text-light)">現在「服用中」として登録されているお薬がありません。<br>「お薬」タブから新しく登録するか、ステータスを服用中に変更してください。</p>
      </div>
    `;
    return;
  }
  
  const dayLogs = pet.medicineLogs[dateStr] || {};
  
  container.innerHTML = activeMedicines.map((med, index) => {
    const count = dayLogs[med.id] || 0;
    
    if (medicineSortModeActive) {
      // 並び替えモード: カウンターボタン非表示、▲▼を大きく表示
      return `
        <div class="med-care-item" style="position: relative; opacity: 0.9;">
          <div class="med-care-btn" style="cursor:default; background:rgba(200,132,74,0.05); border:2px dashed rgba(200,132,74,0.3);">
            <div class="med-care-icon">💊</div>
            <div class="med-care-name">${escHtml(med.name)}</div>
            <div class="med-care-dosage">${escHtml(med.dosage || med.usage || '用量未設定')}</div>
            <div style="font-size:11px; color:var(--accent); font-weight:700; margin-top:4px;">並び替えモード</div>
          </div>
          <div class="med-care-actions" style="display:flex; flex-direction:row; gap:6px; margin-top:4px; justify-content:center;">
            <button class="med-care-act-btn plus" onclick="moveMedicineOrder('${med.id}', -1, true)" ${index===0?'disabled':''} style="flex:1; font-size:14px;">▲</button>
            <button class="med-care-act-btn plus" onclick="moveMedicineOrder('${med.id}', 1, true)" ${index===activeMedicines.length-1?'disabled':''} style="flex:1; font-size:14px;">▼</button>
          </div>
        </div>
      `;
    } else {
      // 通常モード
      return `
        <div class="med-care-item" style="position: relative;">
          <button class="med-care-btn ${count > 0 ? 'completed' : ''}" onclick="showMedicineDetailModal('${med.id}')">
            <div class="med-care-icon">💊</div>
            <div class="med-care-name">${escHtml(med.name)}</div>
            <div class="med-care-dosage">${escHtml(med.dosage || med.usage || '用量未設定')}</div>
            <div class="med-care-counter-val">${count} 回服用</div>
          </button>
          <div class="med-care-actions">
            <button class="med-care-act-btn plus" onclick="changeMedicineCount('${med.id}', 1, event)" title="1回分追加">＋</button>
            ${count > 0 ? `<button class="med-care-act-btn minus" onclick="changeMedicineCount('${med.id}', -1, event)" title="1回分取り消し">ー</button>` : ''}
          </div>
        </div>
      `;
    }
  }).join('');
}

// お薬の服用回数の変更（＋/ーボタン）
function changeMedicineCount(medId, delta, event) {
  if (event) event.stopPropagation(); // ボタンタップ時に親のモーダル表示を防止
  
  const data = loadData();
  const pets = data[currentType] || [];
  const idx = pets.findIndex(p => p.id === currentPetId);
  if (idx === -1) return;
  
  const pet = ensurePetHospitalFields(pets[idx]);
  const dateStr = document.getElementById('quick-care-date').value;
  if (!dateStr) return;
  
  if (!pet.medicineLogs[dateStr]) {
    pet.medicineLogs[dateStr] = {};
  }
  
  const currentCount = pet.medicineLogs[dateStr][medId] || 0;
  const newCount = Math.max(0, currentCount + delta);
  
  if (newCount === 0) {
    delete pet.medicineLogs[dateStr][medId];
  } else {
    pet.medicineLogs[dateStr][medId] = newCount;
  }
  
  pets[idx] = pet;
  data[currentType] = pets;
  saveData(data);
  
  renderMedicineCareSection();
  renderCareCalendar();
  if (delta > 0) {
    showToast('服用を記録しました ✓');
  } else {
    showToast('服用を1回分取り消しました');
  }
}

// お薬詳細モーダルから編集モーダルに遷移する
function editMedicineFromDetail() {
  const medId = document.getElementById('med-detail-id').value;
  if (!medId) return;
  
  closeModal(null, 'modal-medicine-detail');
  openMedicineModal(medId);
}

// お薬詳細モーダルを開く
function showMedicineDetailModal(medId) {
  const data = loadData();
  const pet = (data[currentType] || []).find(p => p.id === currentPetId);
  if (!pet) return;
  
  const med = pet.medicines.find(m => m.id === medId);
  if (!med) return;
  
  const medDetailIdEl = document.getElementById('med-detail-id');
  if (medDetailIdEl) medDetailIdEl.value = med.id;
  
  document.getElementById('med-detail-name').textContent = med.name;
  document.getElementById('med-detail-usage').textContent = med.dosage || med.usage || '未設定';
  
  let periodStr = '未設定';
  if (med.startDate) {
    periodStr = `${formatDate(med.startDate)} (生後 ${calculateAgeAtDate(pet.birthday, med.startDate)}) 〜 `;
    if (med.endDate) {
      periodStr += `${formatDate(med.endDate)} (生後 ${calculateAgeAtDate(pet.birthday, med.endDate)})`;
    } else {
      periodStr += '継続中';
    }
  }
  
  // メモに服用ステータス、期間、および履歴タイムラインを表示
  let historyHtml = '';
  if (med.history && med.history.length > 0) {
    historyHtml = `
      <div style="margin-top:14px; border-top:1px dashed rgba(44,36,24,0.15); padding-top:10px;">
        <span class="field-label" style="font-weight:700; color:var(--text-dark); margin-bottom:6px;">📈 服用履歴タイムライン</span>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${[...med.history].reverse().map(h => {
            const startAge = calculateAgeAtDate(pet.birthday, h.startDate);
            const endAge = h.endDate ? calculateAgeAtDate(pet.birthday, h.endDate) : '継続中';
            const period = `${h.startDate ? formatDate(h.startDate) : '不明'} (${startAge}) 〜 ${h.endDate ? formatDate(h.endDate) : ''} (${endAge})`;
            const statusLabel = h.status === 'active' ? '🔴 服用中' : '⚪ 服用終了';
            return `
              <div style="background:var(--white); padding:8px; border-radius:8px; border:1px solid rgba(44,36,24,0.06); font-size:11px; line-height:1.4;">
                <div style="display:flex; justify-content:between; font-weight:700; margin-bottom:2px;">
                  <span style="color:var(--accent)">${statusLabel}</span>
                  <span style="color:var(--text-light); margin-left:auto;">${escHtml(h.dosage || '用量未設定')}</span>
                </div>
                <div style="color:var(--text-mid); font-size:10px;">期間: ${escHtml(period)}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  const statusStr = (med.status || 'active') === 'active' ? '💊 服用中' : '✓ 服用終了';
  document.getElementById('med-detail-memo').innerHTML = `
    <div style="margin-bottom:8px;"><strong>服用状態:</strong> <span style="font-weight:700; color:var(--accent);">${statusStr}</span></div>
    <div style="margin-bottom:8px;"><strong>服用期間:</strong> <span style="font-size:12px; font-weight:700; color:var(--text-dark);">${periodStr}</span></div>
    <div style="margin-bottom:8px;"><strong>効能・詳細メモ:</strong><br>${escHtml(med.notes || med.memo || 'なし')}</div>
    ${historyHtml}
  `;
  
  document.getElementById('modal-medicine-detail').classList.add('open');
}

// お薬マスタ一覧の描画（お薬タブ内）
function renderMedicineListMaster() {
  const data = loadData();
  const pet = (data[currentType] || []).find(p => p.id === currentPetId);
  if (!pet) return;

  ensurePetHospitalFields(pet);

  const container = document.getElementById('medicine-list-container');
  if (!container) return;

  if (pet.medicines.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding:40px 20px">
        <div style="font-size:44px;margin-bottom:12px">💊</div>
        <p>登録されているお薬がありません<br>「お薬を登録する」から追加してください</p>
      </div>
    `;
    return;
  }

  // お薬マスタ並び替えモードヘッダー
  const masterSortBarHtml = `
    <div style="display:flex; justify-content:flex-end; margin-bottom:8px;">
      <button onclick="toggleMedicineMasterSort()" style="border:none; background:${medicineMasterSortActive ? 'rgba(200,132,74,0.18)' : 'rgba(44,36,24,0.06)'}; color:${medicineMasterSortActive ? 'var(--accent)' : 'var(--text-dark)'}; border-radius:8px; padding:5px 12px; font-size:11px; font-weight:700; cursor:pointer;">${medicineMasterSortActive ? '✓ 並び替え完了' : '↕ 並び替え'}</button>
    </div>
  `;

  container.innerHTML = masterSortBarHtml + pet.medicines.map((med, index) => {
    const isEnded = (med.status || 'active') === 'ended';
    const statusText = isEnded ? '服用終了' : '服用中';
    const statusClass = isEnded ? 'ended-status' : 'active-status';

    let periodText = '未設定';
    if (med.startDate) {
      const startAge = calculateAgeAtDate(pet.birthday, med.startDate);
      const endAge = med.endDate ? calculateAgeAtDate(pet.birthday, med.endDate) : '継続中';
      periodText = `${formatDate(med.startDate)} (${startAge}) 〜 ${med.endDate ? formatDate(med.endDate) : ''} (${endAge})`;
    }

    // 並び替えモード中はシンプルな表示＋▲▼のみ
    if (medicineMasterSortActive) {
      return `
        <div class="medicine-card" id="med-card-${med.id}" style="border:2px dashed rgba(200,132,74,0.35);">
          <div class="medicine-card-header" style="cursor:default;">
            <span class="medicine-card-title" style="display:flex;align-items:center;gap:6px;">
              💊 ${escHtml(med.name)}
              <span style="font-size:10px; padding:2px 6px; border-radius:10px; background:${isEnded ? 'rgba(44,36,24,0.1)' : 'rgba(200,132,74,0.1)'}; color:${isEnded ? 'var(--text-light)' : 'var(--accent)'};">${statusText}</span>
            </span>
            <div style="display:flex;gap:6px;">
              <button class="med-order-btn" onclick="moveMedicineOrder('${med.id}', -1)" ${index===0?'disabled':''}>▲</button>
              <button class="med-order-btn" onclick="moveMedicineOrder('${med.id}', 1)" ${index===pet.medicines.length-1?'disabled':''}>▼</button>
            </div>
          </div>
        </div>
      `;
    }

    // 服用履歴（追加・削除ボタン付き）
    let historyListHtml = '';
    if (med.history && med.history.length > 0) {
      historyListHtml = `
        <div class="med-history-timeline-section" style="margin-top:10px; border-top:1px dashed rgba(44,36,24,0.1); padding-top:8px;">
          <span style="font-size:11px; font-weight:700; color:var(--text-light); display:block; margin-bottom:4px;">📊 服用履歴</span>
          <div style="display:flex; flex-direction:column; gap:6px;">
            ${med.history.map((h, hIdx) => {
              const hStartAge = calculateAgeAtDate(pet.birthday, h.startDate);
              const hEndAge = h.endDate ? calculateAgeAtDate(pet.birthday, h.endDate) : '継続中';
              const hPeriod = `${h.startDate ? formatDate(h.startDate) : '不明'} (${hStartAge}) 〜 ${h.endDate ? formatDate(h.endDate) : ''} (${hEndAge})`;
              const hStatus = h.status === 'active' ? '服用中' : '終了';
              return `
                <div style="background:rgba(44,36,24,0.03); padding:6px 8px; border-radius:6px; font-size:11px; display:flex; align-items:center; gap:6px;">
                  <span style="font-weight:700; color:var(--accent); font-size:10px; white-space:nowrap;">${hStatus}</span>
                  <span style="color:var(--text-mid); font-size:10px; flex:1;">${escHtml(hPeriod)}</span>
                  <span style="font-weight:700; color:var(--text-dark); font-size:10px; white-space:nowrap;">${escHtml(h.dosage || '用量未設定')}</span>
                  <button onclick="editMedicineHistory('${med.id}', ${hIdx})" style="border:none;background:rgba(200,132,74,0.12);color:var(--accent);border-radius:5px;padding:2px 6px;font-size:10px;cursor:pointer;">✏️</button>
                  <button onclick="deleteMedicineHistory('${med.id}', ${hIdx})" style="border:none;background:rgba(220,80,80,0.1);color:#c84040;border-radius:5px;padding:2px 6px;font-size:10px;cursor:pointer;">✕</button>
                </div>
              `;
            }).join('')}
          </div>
          <button onclick="addMedicineHistory('${med.id}')" style="margin-top:6px; border:none; background:rgba(200,132,74,0.1); color:var(--accent); border-radius:8px; padding:5px 12px; font-size:11px; font-weight:700; cursor:pointer;">＋ 履歴を手動追加</button>
        </div>
      `;
    } else {
      historyListHtml = `
        <div style="margin-top:8px; padding-top:8px; border-top:1px dashed rgba(44,36,24,0.1);">
          <button onclick="addMedicineHistory('${med.id}')" style="border:none; background:rgba(200,132,74,0.1); color:var(--accent); border-radius:8px; padding:5px 12px; font-size:11px; font-weight:700; cursor:pointer;">＋ 服用履歴を手動追加</button>
        </div>
      `;
    }

    return `
      <div class="medicine-card ${isEnded ? 'ended-card' : ''}" id="med-card-${med.id}" style="${isEnded ? 'opacity:0.85; border-left:4px solid var(--text-light);' : ''}">
        <div class="medicine-card-header">
          <span class="medicine-card-title" style="display:flex; align-items:center; gap:6px;">
            💊 ${escHtml(med.name)}
            <span class="med-status-badge ${statusClass}" style="font-size:10px; font-weight:700; padding:2px 6px; border-radius:10px; background:${isEnded ? 'rgba(44,36,24,0.1)' : 'rgba(200,132,74,0.1)'}; color:${isEnded ? 'var(--text-light)' : 'var(--accent)'};">${statusText}</span>
          </span>
        </div>
        <div class="medicine-card-body">
          <div class="medicine-detail-grid">
            <div class="med-grid-item"><strong>用量目安:</strong> <span>${escHtml(med.dosage || med.usage || '未設定')}</span></div>
            <div class="med-grid-item"><strong>服用期間:</strong> <span style="font-size:11px;">${escHtml(periodText)}</span></div>
            <div class="med-grid-item" style="grid-column:1/-1;"><strong>詳細メモ・効能:</strong> <p class="med-notes-box" style="margin:2px 0 0 0;">${escHtml(med.notes || med.memo || 'なし')}</p></div>
          </div>
          ${historyListHtml}
          <div class="medicine-actions" style="margin-top:10px;">
            <button class="medicine-act-btn edit" onclick="openMedicineModal('${med.id}')">✏️ 編集</button>
            <button class="medicine-act-btn delete" onclick="deleteMedicineMaster('${med.id}')">✕ 削除</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function toggleMedicineMasterSort() {
  medicineMasterSortActive = !medicineMasterSortActive;
  renderMedicineListMaster();
}

// 服用履歴を手動追加
function addMedicineHistory(medId) {
  const data = loadData();
  const pets = data[currentType] || [];
  const idx = pets.findIndex(p => p.id === currentPetId);
  if (idx === -1) return;
  const pet = ensurePetHospitalFields(pets[idx]);
  const med = pet.medicines.find(m => m.id === medId);
  if (!med) return;
  if (!med.history) med.history = [];

  const today = new Date().toISOString().split('T')[0];
  const startDate = prompt('開始日を入力してください（例: 2024-01-15）', today);
  if (!startDate) return;
  const endDate = prompt('終了日を入力してください（継続中の場合は空のままEnter）', '') || '';
  const dosage = prompt('用量を入力してください（例: 1日2回 0.5錠）', med.dosage || '') || '';
  const status = endDate ? 'ended' : 'active';

  med.history.push({ startDate, endDate, dosage, status, updatedAt: new Date().toISOString() });
  pets[idx] = pet;
  data[currentType] = pets;
  saveData(data);
  renderMedicineListMaster();
  showToast('服用履歴を追加しました ✓');
}

// 服用履歴を編集
function editMedicineHistory(medId, hIdx) {
  const data = loadData();
  const pets = data[currentType] || [];
  const idx = pets.findIndex(p => p.id === currentPetId);
  if (idx === -1) return;
  const pet = ensurePetHospitalFields(pets[idx]);
  const med = pet.medicines.find(m => m.id === medId);
  if (!med || !med.history || !med.history[hIdx]) return;

  const h = med.history[hIdx];
  const startDate = prompt('開始日', h.startDate || '') || h.startDate || '';
  if (!startDate) return;
  const endDate = prompt('終了日（継続中の場合は空のままEnter）', h.endDate || '') || '';
  const dosage = prompt('用量', h.dosage || '') || '';
  const status = endDate ? 'ended' : 'active';

  med.history[hIdx] = { startDate, endDate, dosage, status, updatedAt: new Date().toISOString() };
  pets[idx] = pet;
  data[currentType] = pets;
  saveData(data);
  renderMedicineListMaster();
  showToast('服用履歴を更新しました ✓');
}

// 服用履歴を削除
function deleteMedicineHistory(medId, hIdx) {
  if (!confirm('この服用履歴を削除しますか？')) return;
  const data = loadData();
  const pets = data[currentType] || [];
  const idx = pets.findIndex(p => p.id === currentPetId);
  if (idx === -1) return;
  const pet = ensurePetHospitalFields(pets[idx]);
  const med = pet.medicines.find(m => m.id === medId);
  if (!med || !med.history) return;
  med.history.splice(hIdx, 1);
  pets[idx] = pet;
  data[currentType] = pets;
  saveData(data);
  renderMedicineListMaster();
  showToast('服用履歴を削除しました');
}

// お薬マスタの新規登録・編集モーダルを開く
function openMedicineModal(medId = null) {
  document.getElementById('edit-medicine-id').value = medId || '';
  document.getElementById('med-name').value = '';
  document.getElementById('med-usage').value = '';
  document.getElementById('med-start-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('med-end-date').value = '';
  document.getElementById('med-memo').value = '';
  
  selectMedicineStatus('active');
  
  if (medId) {
    document.getElementById('medicine-modal-title').textContent = 'お薬情報を編集';
    const data = loadData();
    const pet = (data[currentType] || []).find(p => p.id === currentPetId);
    if (pet) {
      const med = pet.medicines.find(m => m.id === medId);
      if (med) {
        document.getElementById('med-name').value = med.name;
        document.getElementById('med-usage').value = med.dosage || med.usage || '';
        document.getElementById('med-start-date').value = med.startDate || '';
        document.getElementById('med-end-date').value = med.endDate || '';
        document.getElementById('med-memo').value = med.notes || med.memo || '';
        selectMedicineStatus(med.status || 'active');
      }
    }
  } else {
    document.getElementById('medicine-modal-title').textContent = '新しいお薬を登録';
  }
  
  document.getElementById('modal-medicine').classList.add('open');
}

// お薬マスタの保存処理 (HTML側の saveMedicineRecord をフックする)
function saveMedicineRecord() {
  const name = document.getElementById('med-name').value.trim();
  if (!name) {
    alert('お薬名を入力してください');
    return;
  }
  
  const data = loadData();
  const pets = data[currentType] || [];
  const idx = pets.findIndex(p => p.id === currentPetId);
  if (idx === -1) return;
  
  const pet = ensurePetHospitalFields(pets[idx]);
  const id = document.getElementById('edit-medicine-id').value;
  
  const dosage = document.getElementById('med-usage').value.trim();
  const startDate = document.getElementById('med-start-date').value;
  const endDate = document.getElementById('med-end-date').value;
  const notes = document.getElementById('med-memo').value.trim();
  const status = document.getElementById('med-status').value;
  
  let existingMed = null;
  let history = [];
  
  if (id) {
    const found = pet.medicines.find(m => m.id === id);
    if (found) {
      existingMed = found;
      history = found.history || [];
    }
  }
  
  const medData = {
    id: id || 'med_' + Date.now(),
    name,
    dosage,
    startDate,
    endDate,
    notes,
    status,
    history
  };
  
  // 服用履歴タイムラインの自動蓄積・変化監視
  const lastHistory = history[history.length - 1];
  if (!lastHistory || lastHistory.dosage !== dosage || lastHistory.status !== status || lastHistory.startDate !== startDate || lastHistory.endDate !== endDate) {
    medData.history.push({
      startDate,
      endDate,
      dosage,
      status,
      updatedAt: new Date().toISOString()
    });
  }
  
  if (id) {
    const mIdx = pet.medicines.findIndex(m => m.id === id);
    if (mIdx !== -1) pet.medicines[mIdx] = medData;
  } else {
    pet.medicines.push(medData);
  }
  
  pets[idx] = pet;
  data[currentType] = pets;
  saveData(data);
  
  closeModal(null, 'modal-medicine');
  renderMedicineListMaster();
  renderMedicineCareSection(); // 服用カウンター側も同期
  showToast(id ? 'お薬情報を更新しました ✓' : 'お薬を登録しました ✓');
}

// お薬マスタの削除
function deleteMedicineMaster(medId) {
  if (!confirm('このお薬を削除しますか？日常ケア画面の服用カウンターからも非表示になります。')) return;
  
  const data = loadData();
  const pets = data[currentType] || [];
  const idx = pets.findIndex(p => p.id === currentPetId);
  if (idx === -1) return;
  
  const pet = ensurePetHospitalFields(pets[idx]);
  pet.medicines = pet.medicines.filter(m => m.id !== medId);
  
  pets[idx] = pet;
  data[currentType] = pets;
  saveData(data);
  
  renderMedicineListMaster();
  renderMedicineCareSection(); // 服用カウンター側も同期
  showToast('お薬を削除しました');
}

// お薬マスタの並び替え (▲▼ボタン)
function moveMedicineOrder(medId, direction, isFromCare = false) {
  const data = loadData();
  const pets = data[currentType] || [];
  const idx = pets.findIndex(p => p.id === currentPetId);
  if (idx === -1) return;
  
  const pet = ensurePetHospitalFields(pets[idx]);
  
  if (isFromCare) {
    // 日常ケア（服用中のみ）からの並び替え
    const activeMedicines = pet.medicines.filter(m => (m.status || 'active') === 'active');
    const activeIdx = activeMedicines.findIndex(m => m.id === medId);
    if (activeIdx === -1) return;
    
    const activeTargetIdx = activeIdx + direction;
    if (activeTargetIdx < 0 || activeTargetIdx >= activeMedicines.length) return;
    
    const currentMed = activeMedicines[activeIdx];
    const targetMed = activeMedicines[activeTargetIdx];
    
    // 全体配列の中での位置を見つける
    const mIdx = pet.medicines.findIndex(m => m.id === currentMed.id);
    const targetIdx = pet.medicines.findIndex(m => m.id === targetMed.id);
    
    if (mIdx !== -1 && targetIdx !== -1) {
      const temp = pet.medicines[mIdx];
      pet.medicines[mIdx] = pet.medicines[targetIdx];
      pet.medicines[targetIdx] = temp;
    }
  } else {
    // お薬マスタ（全体一覧）からの並び替え
    const mIdx = pet.medicines.findIndex(m => m.id === medId);
    if (mIdx === -1) return;
    
    const targetIdx = mIdx + direction;
    if (targetIdx < 0 || targetIdx >= pet.medicines.length) return;
    
    const temp = pet.medicines[mIdx];
    pet.medicines[mIdx] = pet.medicines[targetIdx];
    pet.medicines[targetIdx] = temp;
  }
  
  pets[idx] = pet;
  data[currentType] = pets;
  saveData(data);
  
  renderMedicineListMaster();
  renderMedicineCareSection(); // 服用カウンター側も同期
}


// ========== Modal 共通 ==========
function closeModal(event, id){
  if(!event||event.target===event.currentTarget){
    document.getElementById(id).classList.remove('open');
  }
}

// ========== Toast ==========
function showToast(msg){
  const old=document.getElementById('toast'); if(old)old.remove();
  const t=document.createElement('div'); t.id='toast';
  t.textContent=msg;
  t.style.cssText=`position:fixed;bottom:110px;left:50%;transform:translateX(-50%);background:rgba(44,36,24,0.85);color:white;padding:10px 20px;border-radius:20px;font-size:14px;font-weight:600;z-index:9999;white-space:nowrap;transition:opacity 0.3s;`;
  document.body.appendChild(t);
  setTimeout(()=>{t.style.opacity='0';setTimeout(()=>t.remove(),300);},2200);
}

// ========== 散歩タイマー（省電力・引き算方式） ==========
let walkTimerInterval = null;

function loadWalkTimerState() {
  try { return JSON.parse(localStorage.getItem('wannyan_walk_timer') || 'null'); }
  catch(e) { return null; }
}
function saveWalkTimerState(state) {
  if (state) localStorage.setItem('wannyan_walk_timer', JSON.stringify(state));
  else localStorage.removeItem('wannyan_walk_timer');
}

function startWalkTimer(petId) {
  const state = {
    petId,
    startTs: Date.now()
  };
  saveWalkTimerState(state);
  // 即座にタイマーUIを描画してからtickを開始
  renderWalkTimer();
}

function stopWalkTimer() {
  const state = loadWalkTimerState();
  if (!state) return;
  clearInterval(walkTimerInterval);
  walkTimerInterval = null;
  const elapsed = Math.floor((Date.now() - state.startTs) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  // 散歩実績をquickCaresに記録
  if (currentPetId) {
    const data = loadData();
    const pets = data[currentType] || [];
    const idx = pets.findIndex(p => p.id === currentPetId);
    if (idx !== -1) {
      const pet = ensurePetHospitalFields(pets[idx]);
      const dateStr = new Date().toISOString().split('T')[0];
      if (!pet.quickCares[dateStr]) pet.quickCares[dateStr] = {};
      pet.quickCares[dateStr].walkMinutes = (pet.quickCares[dateStr].walkMinutes || 0) + mins;
      pets[idx] = pet;
      data[currentType] = pets;
      saveData(data);
    }
  }

  saveWalkTimerState(null);
  renderWalkTimer();
  showToast(`散歩終了 🐾 ${mins}分${secs}秒`);
}

function tickWalkTimer() {
  clearInterval(walkTimerInterval);
  const update = () => {
    const state = loadWalkTimerState();
    if (!state) { clearInterval(walkTimerInterval); renderWalkTimer(); return; }
    const elapsed = Math.floor((Date.now() - state.startTs) / 1000);
    const em = Math.floor(elapsed / 60);
    const es = elapsed % 60;
    const disp = document.getElementById('walk-timer-display');
    if (disp) {
      disp.innerHTML = `
        <div class="walk-timer-elapsed">${String(em).padStart(2,'0')}:${String(es).padStart(2,'0')}</div>
      `;
    } else {
      // 表示要素がない場合（画面が切り替わった等）はタイマーを止める
      clearInterval(walkTimerInterval);
      walkTimerInterval = null;
    }
  };
  update();
  walkTimerInterval = setInterval(update, 1000);

  // Page Visibility API でバックグラウンド時にタイマー停止、復帰時に引き算で再描画
  document.removeEventListener('visibilitychange', onVisibilityChange);
  document.addEventListener('visibilitychange', onVisibilityChange);
}

function onVisibilityChange() {
  if (document.hidden) {
    clearInterval(walkTimerInterval);
  } else {
    const state = loadWalkTimerState();
    if (state) tickWalkTimer();
  }
}

function renderWalkTimer() {
  const container = document.getElementById('walk-timer-section');
  if (!container) return;
  const state = loadWalkTimerState();
  const petId = currentPetId;
  const data = loadData();
  const pet = petId ? (data[currentType]||[]).find(p=>p.id===petId) : null;
  const walkEnv = pet ? (pet.walkEnv || {}) : {};

  // walkEnv.walkTimes は [{label, minutes}] の配列（カスタム複数枠）
  const walkTimes = walkEnv.walkTimes || (walkEnv.normalMinutes ? [{label:'通常', minutes: walkEnv.normalMinutes}] : []);
  const coolTime = walkEnv.coolMinutes ? [{label:'保冷剤あり', minutes: walkEnv.coolMinutes}] : [];
  const allTimes = walkTimes.concat(coolTime.filter(t => !walkTimes.find(w => w.label === t.label)));

  const timesHtml = allTimes.length > 0
    ? allTimes.map(t => `<div class="walk-env-item"><span class="walk-env-label">⏱ ${escHtml(t.label)}</span><span>${escHtml(String(t.minutes))}分</span></div>`).join('')
    : '';

  const envHtml = `
    <div class="walk-env-grid">
      <div class="walk-env-item"><span class="walk-env-label">🌡 出かけない気温</span><span>${walkEnv.maxTemp||'-'}℃以上 / ${walkEnv.minTemp||'-'}℃以下</span></div>
      <div class="walk-env-item"><span class="walk-env-label">👗 服を着る気温</span><span>${walkEnv.clothTemp||'-'}℃以下</span></div>
      <div class="walk-env-item"><span class="walk-env-label">🧊 保冷剤使う気温</span><span>${walkEnv.coolTemp||'-'}℃以上</span></div>
      ${timesHtml}
    </div>
  `;

  // 散歩記録サマリーを生成（過去7日分）
  function buildWalkHistoryHtml() {
    if (!pet) return '';
    ensurePetHospitalFields(pet);
    const today = new Date();
    const rows = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const mins = (pet.quickCares[dateStr] || {}).walkMinutes;
      if (mins !== undefined && mins > 0) {
        rows.push(`<div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;padding:3px 0;border-bottom:1px solid rgba(44,36,24,0.05);"><span>${formatDate(dateStr)}</span><span style="color:var(--accent)">🐾 ${mins}分</span></div>`);
      }
    }
    if (rows.length === 0) return '<div style="font-size:12px;color:var(--text-light);padding:4px 0;">直近7日間の散歩記録はありません</div>';
    return `<div style="margin-top:8px;background:rgba(44,36,24,0.03);border-radius:8px;padding:8px 10px;">${rows.join('')}</div>`;
  }

  if (state && state.petId === petId) {
    container.innerHTML = `
      ${envHtml}
      <div id="walk-timer-display" class="walk-timer-display"></div>
      <button class="walk-timer-stop-btn" onclick="stopWalkTimer()">🏁 散歩終了</button>
    `;
    // 即座に表示してからインターバル開始
    tickWalkTimer();
  } else {
    const histHtml = buildWalkHistoryHtml();
    container.innerHTML = `
      ${envHtml}
      <div style="margin-top:10px;display:flex;align-items:center;gap:8px;">
        <button class="walk-timer-start-btn" onclick="startWalkTimer('${petId}')" style="flex:1;">🐾 散歩スタート</button>
        <button onclick="toggleWalkHistory()" style="border:none;background:rgba(200,132,74,0.12);color:var(--accent);border-radius:10px;padding:10px 12px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;">📋 散歩記録</button>
      </div>
      <div id="walk-history-panel" style="display:none;">${histHtml}</div>
    `;
  }
}

function toggleWalkHistory() {
  const panel = document.getElementById('walk-history-panel');
  if (!panel) return;
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

function saveWalkEnv() {
  const data = loadData();
  const pets = data[currentType] || [];
  const idx = pets.findIndex(p => p.id === currentPetId);
  if (idx === -1) return;

  // 散歩時間の複数枠を収集
  const walkTimes = [];
  document.querySelectorAll('#we-walk-times-list .we-walk-time-row').forEach(row => {
    const label = row.querySelector('.we-walk-time-label')?.value.trim() || '';
    const minutes = row.querySelector('.we-walk-time-min')?.value.trim() || '';
    if (label && minutes) walkTimes.push({ label, minutes });
  });

  pets[idx].walkEnv = {
    maxTemp: document.getElementById('we-max-temp')?.value||'',
    minTemp: document.getElementById('we-min-temp')?.value||'',
    clothTemp: document.getElementById('we-cloth-temp')?.value||'',
    coolTemp: document.getElementById('we-cool-temp')?.value||'',
    walkTimes
  };
  data[currentType] = pets;
  saveData(data);
  closeModal(null,'modal-walk-env');
  renderWalkTimer();
  showToast('散歩設定を保存しました ✓');
}

function addWalkTimeRow(label = '', minutes = '') {
  const list = document.getElementById('we-walk-times-list');
  if (!list) return;
  const rowId = 'we_wt_' + Date.now() + '_' + Math.random().toString(36).substr(2,5);
  const row = document.createElement('div');
  row.className = 'we-walk-time-row';
  row.id = rowId;
  row.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:6px;';
  row.innerHTML = `
    <input type="text" class="we-walk-time-label field-input" placeholder="ラベル（例: 通常、雨の日）" value="${escHtml(label)}" style="flex:2;margin-bottom:0;">
    <input type="number" class="we-walk-time-min field-input" placeholder="分" value="${escHtml(String(minutes))}" min="1" style="flex:1;margin-bottom:0;">
    <span style="font-size:12px;color:var(--text-light);white-space:nowrap">分</span>
    <button type="button" onclick="confirmRemoveWalkTimeRow('${rowId}')" style="border:none;background:rgba(200,80,80,0.12);color:#c04040;border-radius:8px;padding:4px 8px;font-size:12px;cursor:pointer;white-space:nowrap;">✕</button>
  `;
  list.appendChild(row);
}

function confirmRemoveWalkTimeRow(rowId) {
  if (!confirm('この散歩時間設定を削除しますか？')) return;
  const row = document.getElementById(rowId);
  if (row) row.remove();
}

function openWalkEnvModal() {
  const data = loadData();
  const pet = (data[currentType]||[]).find(p=>p.id===currentPetId);
  const e = pet?.walkEnv || {};
  document.getElementById('we-max-temp').value = e.maxTemp||'';
  document.getElementById('we-min-temp').value = e.minTemp||'';
  document.getElementById('we-cloth-temp').value = e.clothTemp||'';
  document.getElementById('we-cool-temp').value = e.coolTemp||'';

  // 散歩時間の複数枠を展開（旧データの互換）
  const list = document.getElementById('we-walk-times-list');
  if (list) {
    list.innerHTML = '';
    const walkTimes = e.walkTimes || (e.normalMinutes ? [{label:'通常', minutes: e.normalMinutes}] : []);
    const legacy = e.coolMinutes && !walkTimes.find(t => t.label === '保冷剤あり') ? [{label:'保冷剤あり', minutes: e.coolMinutes}] : [];
    [...walkTimes, ...legacy].forEach(t => addWalkTimeRow(t.label, t.minutes));
  }

  document.getElementById('modal-walk-env').classList.add('open');
}

// ========== 気になるメモ（次回通院用ストック） ==========
function loadPendingNotes() {
  try { return JSON.parse(localStorage.getItem('wannyan_pending_notes_v1') || '{}'); }
  catch(e) { return {}; }
}
function savePendingNotes(notes) { localStorage.setItem('wannyan_pending_notes_v1', JSON.stringify(notes)); }

function getPetPendingNotes(petId) {
  const all = loadPendingNotes();
  return all[petId] || [];
}

function addPendingNote(petId) {
  const input = document.getElementById('pending-note-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  const all = loadPendingNotes();
  if (!all[petId]) all[petId] = [];
  all[petId].push({ id: 'note_' + Date.now(), text, createdAt: new Date().toISOString() });
  savePendingNotes(all);
  input.value = '';
  renderPendingNotes(petId);
  showToast('メモをストックしました ✓');
}

function deletePendingNote(petId, noteId) {
  if (!confirm('このメモを削除しますか？')) return;
  const all = loadPendingNotes();
  all[petId] = (all[petId] || []).filter(n => n.id !== noteId);
  savePendingNotes(all);
  renderPendingNotes(petId);
}

function renderPendingNotes(petId) {
  const container = document.getElementById('pending-notes-list');
  if (!container) return;
  const notes = getPetPendingNotes(petId);
  if (notes.length === 0) {
    container.innerHTML = '<div class="memo-view memo-empty" style="font-size:12px">次回通院用のメモはありません</div>';
    return;
  }
  container.innerHTML = notes.map(n => `
    <div class="pending-note-item">
      <span class="pending-note-text">${escHtml(n.text)}</span>
      <button class="pending-note-del" onclick="deletePendingNote('${petId}','${n.id}')" title="削除">🗑</button>
    </div>
  `).join('');
}

// 通院記録モーダルで未消化メモを表示（タップで選択・外すとストックに戻る）
function renderUndigestedNotesForModal(petId) {
  const area = document.getElementById('m-pending-notes-area');
  if (!area) return;
  const notes = getPetPendingNotes(petId);
  if (notes.length === 0) { area.style.display = 'none'; return; }
  area.style.display = 'block';
  const list = document.getElementById('m-pending-notes-list');
  if (!list) return;
  list.innerHTML = notes.map(n => `
    <div class="pending-note-chip selected" id="pnchip-${n.id}">
      <span onclick="togglePendingNoteSelect('${n.id}', document.getElementById('pnchip-${n.id}'))" style="flex:1;cursor:pointer;">${escHtml(n.text)}</span>
      <button onclick="returnPendingNoteToStock('${petId}','${n.id}')" style="border:none;background:none;color:#c04040;font-size:11px;cursor:pointer;padding:0 2px;font-weight:700;" title="外してストックに戻す">外す</button>
    </div>
  `).join('');
}

// 通院記録モーダルから「外す」を押したときメモをストックに戻す（削除ではない）
function returnPendingNoteToStock(petId, noteId) {
  // ストックに残したまま、チップを非表示にする（保存時に選択されなければ消化されない）
  const chip = document.getElementById('pnchip-' + noteId);
  if (chip) {
    chip.classList.remove('selected');
    chip.style.display = 'none';
  }
  showToast('メモを外しました（ストックに残ります）');
}

function togglePendingNoteSelect(noteId, el) {
  el.classList.toggle('selected');
}

// 通院記録保存時に選択済みメモをnotesに結合して消化する
function digestSelectedPendingNotes(petId, currentNotes) {
  const chips = document.querySelectorAll('#m-pending-notes-list .pending-note-chip.selected');
  if (chips.length === 0) return currentNotes;
  const texts = [...chips].map(c => c.textContent.trim());
  const combined = [currentNotes, ...texts.map(t=>`[気になるメモ] ${t}`)].filter(Boolean).join('\n');
  // 消化済みメモをストックから削除
  const all = loadPendingNotes();
  chips.forEach(c => {
    const noteId = c.id.replace('pnchip-','');
    all[petId] = (all[petId]||[]).filter(n => n.id !== noteId);
  });
  savePendingNotes(all);
  return combined;
}

// ========== SW ==========
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
}