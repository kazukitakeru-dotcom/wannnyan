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
  document.getElementById('list-type-emoji').textContent = type=='dog'?'🐕':'🐈';
  document.getElementById('list-type-name').textContent  = type=='dog'?'いぬ':'ねこ';
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
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
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

  // 登録日バッジと病院記録ボタンの縦並びヘッダー
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
    try {
      const out = canvas.toDataURL('image/jpeg', 0.85);
      callback(out && out.length > 100 ? out : src);
    } catch(_) {
      callback(src);
    }
  };
  img.onerror=()=>callback(src);
  img.src=src;
}

function sanitizeImportedPhotos(data) {
  const tasks = [];
  ['dog','cat'].forEach(type => {
    (data[type]||[]).forEach(pet => {
      if (pet.photo && pet.photo.startsWith('data:')) {
        tasks.push(new Promise(resolve => {
          _compressFromDataUrl(pet.photo, fixed => { pet.photo = fixed; resolve(); });
        }));
      }
      (pet.medicalRecords||[]).forEach(rec => {
        if (rec.photo && rec.photo.startsWith('data:')) {
          tasks.push(new Promise(resolve => {
            _compressFromDataUrl(rec.photo, fixed => { rec.photo = fixed; resolve(); });
          }));
        }
      });
      if (pet.certificates) {
        Object.keys(pet.certificates).forEach(k => {
          const cert = pet.certificates[k];
          if (cert && cert.photo && cert.photo.startsWith('data:')) {
            tasks.push(new Promise(resolve => {
              _compressFromDataUrl(cert.photo, fixed => { cert.photo = fixed; resolve(); });
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

  const selectedTools=s.walkTools||[];
  const toolsViewHtml=selectedTools.length?selectedTools.join('、'):'未記入';
  const toolsEditHtml=`<div>
    <div class="tools-wrap" style="margin-bottom:8px">
      ${WALK_TOOLS.map(t=>`<div class="tool-chip${selectedTools.includes(t)?' selected':''}" onclick="toggleToolChip(this,'${t}')">${t}</div>`).join('')}
    </div>
    <input type="hidden" id="s-walkTools" value="${escHtml(JSON.stringify(selectedTools))}">
    <input type="text" class="field-input" id="s-walkToolFree" value="${escHtml(s.walkToolFree||'')}" placeholder="その他（自由記入）">
  </div>`;

  const toiletItems=[
    {key:'toiletIndoor',label:'屋内（家）'},
    {key:'toiletOutdoor',label:'屋外'},
    {key:'toiletOtherIndoor',label:'家以外の屋内'},
  ];
  const toiletViewHtml=toiletItems.map(t=>`<div style="font-size:13px;margin-bottom:2px">${t.label}: ${s[t.key]||'未選択'}</div>`).join('');
}

// ========== インポート処理（マイグレーションロジック組込版） ==========
const handleImportJson = (jsonString) => {
  try {
    const importedData = JSON.parse(jsonString);
    if (!importedData.dog || !importedData.cat) {
      showToast('データ形式が正しくありません');
      return;
    }
    
    // 【マイグレーション処理】犬と猫のデータをループして、古い画像データがないかチェック
    ['dog', 'cat'].forEach(type => {
      if (importedData[type] && Array.isArray(importedData[type])) {
        importedData[type] = importedData[type].map(pet => {
          
          // もし古い画像データ（例: 写真が古いオブジェクトURL形式や特定の古いキーだった場合）の条件
          if (pet.photo && pet.photo.startsWith('blob:')) {
            pet.photo = null; 
          }
          
          // 新しいバージョンで必須になった画像関連のプロパティがなければ補完する
          if (pet.photo && !pet.photoDataWindow) {
            pet.photoDataWindow = 'current_format';
          }
          
          return pet;
        });
      }
    });

    // 既存の古いデータURL形式（Base64）の写真を非同期で圧縮・修復・保存する処理
    sanitizeImportedPhotos(importedData);
    
  } catch (e) {
    console.error('インポート失敗:', e);
    showToast('データの解析に失敗しました');
  }
};
// 前半の toiletViewHtml の直後から再開します
  const toiletEditHtml = toiletItems.map(t=>{
    const val = s[t.key]||'';
    return `<div style="display:flex;align-items:center;justify-content:between;margin-bottom:6px;gap:10px;">
      <span style="font-size:13px;color:var(--text-main);min-width:90px;">${t.label}</span>
      <div class="yn-group" style="margin:0;flex:1;">
        <button class="yn-btn yes${val==='○'?' selected':''}" onclick="toggleToiletOX(this,'${t.key}','○')">○</button>
        <button class="yn-btn no${val==='×'?' selected':''}" onclick="toggleToiletOX(this,'${t.key}','×')">×</button>
      </div>
      <input type="hidden" id="s-${t.key}" value="${escHtml(val)}">
    </div>`;
  }).join('');

  container.innerHTML = `
    <div class="survey-form ${e}">
      <div class="detail-card">
        <div class="detail-card-title">基本・性格・特徴</div>
        ${personalityEditHtml ? `<div class="detail-field"><label class="field-label">性格・特徴</label><div class="view-only field-value">${escHtml(personalityViewHtml)}</div><div class="edit-only">${personalityEditHtml}</div></div>` : ''}
        ${numf('sleepTime','1日の平均睡眠時間','時間','例: 12')}
        ${numf('fartCount','おならの頻度','回/日','例: 1〜2')}
        ${yn('fartSmell','おならの臭いが強い')}
        ${yn('bodySmell','体臭が気になる')}
      </div>

      <div class="detail-card">
        <div class="detail-card-title">食事・水分・排泄</div>
        ${tf('foodType','普段のごはん（銘柄・量・回数など）','例: サイエンスダイエット 朝夕各30g')}
        ${tf('foodPref','食いつき・好みの傾向','例: カリカリだけだと残す、ウェットを混ぜると食べる')}
        ${yn('eatFast','早食い・ドカ食いの傾向がある')}
        ${yn('waterDrop','水を飲むときに周りにこぼす')}
        <div class="detail-field">
          <label class="field-label">トイレ（できる場所に○、できない場所に×）</label>
          <div class="view-only field-value" style="line-height:1.6;">${toiletViewHtml}</div>
          <div class="edit-only" style="margin-top:4px;">${toiletEditHtml}</div>
        </div>
        ${yn('toiletFailure','トイレを失敗することがある')}
        ${tf('toiletFailureNote','失敗するときの状況・場所','例: トイレが汚れているとき、ケージの隅で')}
        ${yn('eatingStool','食糞（うんちを食べる）の経験がある')}
      </div>

      <div class="detail-card">
        <div class="detail-card-title">健康・アレルギー・体質</div>
        <div class="detail-field">
          <label class="field-label">特定のアレルギー</label>
          <div class="view-only" style="margin-top:4px;">${allergyViewHtml}</div>
          <div class="edit-only" style="margin-top:4px;">${allergyEditHtml}</div>
        </div>
        ${yn('heatSensitive','暑さに非常に弱い')}
        ${yn('coldSensitive','寒さに非常に弱い')}
        ${yn('carSick','車酔いしやすい')}
        ${yn('skinWeak','皮膚が荒れやすい・弱い')}
      </div>

      ${currentType==='dog' ? `
      <div class="detail-card">
        <div class="detail-card-title">お散歩・お出かけ（犬専用）</div>
        <div class="detail-field">
          <label class="field-label">普段使う散歩道具</label>
          <div class="view-only field-value">${escHtml(toolsViewHtml)}</div>
          <div class="edit-only">${toolsEditHtml}</div>
        </div>
        ${yn('walkPull','散歩中に強く引っ張る')}
        ${yn('walkStop','散歩中に座り込んで歩かなくなる')}
        ${yn('walk拾い食い','拾い食いの癖がある')}
      </div>
      ` : ''}

      <div class="detail-card">
        <div class="detail-card-title">お手入れ・病院・苦手なこと</div>
        ${yn('nailClipDislike','爪切りをひどく嫌がる')}
        ${yn('brushingDislike','ブラッシングを嫌がる')}
        ${yn('shampooDislike','シャンプーを嫌がる')}
        ${yn('earCleanDislike','耳掃除を嫌がる')}
        ${yn('hospitalDislike','動物病院で暴れる・怖がる')}
        ${tf('dislikeThings','他に怖がるもの・苦手なこと','例: 雷、花火、大きな音、傘、他の犬')}
      </div>

      <div class="detail-card">
        <div class="detail-card-title">自由記入・引き継ぎ用メモ</div>
        ${tf('surveyFreeMemo','その他、シッターや預け先に伝えておきたいこと','例: 留守番時はケージに入れます。おやつは1日1本まで。',4)}
      </div>

      <button class="save-btn" onclick="saveSurvey()">アンケートを保存する</button>
    </div>
  `;
}

function toggleYN(btn, key, val) {
  const p = btn.closest('.yn-group');
  p.querySelectorAll('.yn-btn').forEach(b=>b.classList.remove('selected'));
  const currentVal = document.getElementById(`s-${key}`).value;
  if (currentVal === val) {
    document.getElementById(`s-${key}`).value = '';
  } else {
    btn.classList.add('selected');
    document.getElementById(`s-${key}`).value = val;
  }
}

function toggleToiletOX(btn, key, val) {
  const p = btn.closest('.yn-group');
  p.querySelectorAll('.yn-btn').forEach(b=>b.classList.remove('selected'));
  const currentVal = document.getElementById(`s-${key}`).value;
  if (currentVal === val) {
    document.getElementById(`s-${key}`).value = '';
  } else {
    btn.classList.add('selected');
    document.getElementById(`s-${key}`).value = val;
  }
}

function togglePersonalityChip(chip, name) {
  chip.classList.toggle('selected');
  const wrap = chip.closest('div');
  const hidden = wrap.querySelector('#s-personalities');
  const arr = JSON.parse(hidden.value || '[]');
  const idx = arr.indexOf(name);
  if(idx === -1) arr.push(name); else arr.splice(idx,1);
  hidden.value = JSON.stringify(arr);
}

function toggleToolChip(chip, name) {
  chip.classList.toggle('selected');
  const wrap = chip.closest('div');
  const hidden = wrap.querySelector('#s-walkTools');
  const arr = JSON.parse(hidden.value || '[]');
  const idx = arr.indexOf(name);
  if(idx === -1) arr.push(name); else arr.splice(idx,1);
  hidden.value = JSON.stringify(arr);
}

function addAllergyItem() {
  const div = document.createElement('div');
  div.className = 'allergy-item';
  div.innerHTML = `
    <input type="text" class="field-input allergy-input" placeholder="アレルギーを入力">
    <button class="allergy-remove-btn" onclick="removeAllergyItem(this)">×</button>
  `;
  document.getElementById('allergy-list').insertBefore(div, document.querySelector('.allergy-add-btn'));
}

function removeAllergyItem(btn) {
  btn.closest('.allergy-item').remove();
}

function saveSurvey() {
  const data = loadData();
  const pets = data[currentType]||[];
  const idx = pets.findIndex(p=>p.id===currentPetId);
  if(idx === -1) return;
  const pet = {...pets[idx]};
  if(!pet.survey) pet.survey = {};

  const keys = [
    'sleepTime','fartCount','fartSmell','bodySmell','foodType','foodPref','eatFast',
    'waterDrop','toiletIndoor','toiletOutdoor','toiletOtherIndoor','toiletFailure',
    'toiletFailureNote','eatingStool','heatSensitive','coldSensitive','carSick',
    'skinWeak','walkPull','walkStop','walk拾い食い','nailClipDislike','brushingDislike',
    'shampooDislike','earCleanDislike','hospitalDislike','dislikeThings','surveyFreeMemo',
    'personalityFree','walkToolFree'
  ];
  keys.forEach(k => {
    const el = document.getElementById(`s-${k}`);
    if(el) pet.survey[k] = el.value.trim();
  });

  const pEl = document.getElementById('s-personalities');
  if(pEl) pet.survey.personalities = JSON.parse(pEl.value || '[]');
  const tEl = document.getElementById('s-walkTools');
  if(tEl) pet.survey.walkTools = JSON.parse(tEl.value || '[]');

  const allergyInputs = document.querySelectorAll('.allergy-input');
  pet.survey.allergies = [...allergyInputs].map(i=>i.value.trim()).filter(Boolean);

  pet.updatedAt = Date.now();
  pets[idx] = pet; data[currentType] = pets; saveData(data);

  surveyEditMode = false;
  const btn = document.getElementById('survey-edit-btn');
  btn.textContent = '編集'; btn.classList.remove('editing');
  renderSurveyContent(pet, false);
  showToast('アンケートを保存しました ✓');
}

// ========== 削除モーダル ==========
function openDeleteModal() {
  deletePendingId = currentPetId;
  document.getElementById('modal-delete').classList.add('open');
}

function closeDeleteModal() {
  deletePendingId = null;
  closeModal(null,'modal-delete');
}

function execDeletePet() {
  if(!deletePendingId) return;
  const data = loadData();
  data[currentType] = (data[currentType]||[]).filter(p=>p.id!==deletePendingId);
  saveData(data);
  closeDeleteModal();
  showToast('記録を削除しました');
  goToList();
}

// ========== モーダル共通閉じる ==========
function closeModal(e, id) {
  if(e) e.stopPropagation();
  document.getElementById(id).classList.remove('open');
}

// ========== トースト ==========
function showToast(msg) {
  let box = document.getElementById('toast-box');
  if(!box) {
    box = document.createElement('div'); box.id='toast-box';
    document.body.appendChild(box);
  }
  const t = document.createElement('div'); t.className='toast-item'; t.textContent=msg;
  box.appendChild(t);
  requestAnimationFrame(()=>t.classList.add('show'));
  setTimeout(()=>{
    t.classList.remove('show');
    setTimeout(()=>t.remove(),400);
  },2300);
}

// ========== 新規登録用ポップアップ表示 ==========
function openAddPetModal() {
  const input = document.getElementById('new-pet-name');
  if(input) input.value = '';
  document.getElementById('modal-add-pet').classList.add('open');
}

function createNewPet() {
  const nameInput = document.getElementById('new-pet-name');
  const name = nameInput ? nameInput.value.trim() : '';
  if(!name) { alert('名前を入力してください'); return; }

  const data = loadData();
  if(!data[currentType]) data[currentType] = [];

  const newPet = {
    id: 'pet_' + Date.now() + '_' + Math.random().toString(36).substr(2,9),
    name: name,
    gender: '不明',
    birthday: '',
    age: '',
    weight: '',
    breed: '',
    memo: '',
    familyTag: '',
    familyRole: '',
    photo: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    issues: {},
    survey: {
      personalities: [], allergies: [], walkTools: [],
      sleepTime:'', fartCount:'', fartSmell:'', bodySmell:'', foodType:'', foodPref:'', eatFast:'',
      waterDrop:'', toiletIndoor:'', toiletOutdoor:'', toiletOtherIndoor:'', toiletFailure:'',
      toiletFailureNote:'', eatingStool:'', heatSensitive:'', coldSensitive:'', carSick:'',
      skinWeak:'', walkPull:'', walkStop:'', walk拾い食い:'', nailClipDislike:'', brushingDislike:'',
      shampooDislike:'', earCleanDislike:'', hospitalDislike:'', dislikeThings:'', surveyFreeMemo:'',
      personalityFree:'', walkToolFree:''
    },
    medicalRecords: [],
    certificates: {
      rabies: { checked: false, date: '', photo: null },
      mixed: { checked: false, date: '', photo: null },
      filaria: { checked: false, date: '', photo: null },
      flea: { checked: false, date: '', photo: null }
    }
  };

  data[currentType].push(newPet);
  saveData(data);
  closeModal(null, 'modal-add-pet');
  renderList();
  openDetail(newPet.id);
  toggleEditMode();
  showToast('新しく登録しました。詳細を入力してください。');
}

// ========== 病院記録・ケア（全面刷新画面） ==========
function openHospitalRecords(id) {
  const data = loadData();
  const pet = (data[currentType]||[]).find(p=>p.id===id);
  if(!pet) return;
  currentPetId = id;
  renderHospitalRecordsScreen(pet);
  showScreen('screen-hospital-records');
}

function closeHospitalRecords() {
  showScreen('screen-detail', 'back');
}

function renderHospitalRecordsScreen(pet) {
  document.getElementById('hospital-records-pet-name').textContent = `${pet.name}の病院記録・ケア`;
  renderCertificatesCard(pet);
  renderMedicalRecordsList(pet);
}

// --- 予防・証明書カード ---
function renderCertificatesCard(pet) {
  const certs = pet.certificates || {};
  const types = [
    { key: 'rabies', label: '狂犬病予防注射' },
    { key: 'mixed', label: '混合ワクチン' },
    { key: 'filaria', label: 'フィラリア予防' },
    { key: 'flea', label: 'ノミ・マダニ駆除' }
  ];

  const html = types.map(t => {
    const c = certs[t.key] || { checked: false, date: '', photo: null };
    const checkedAttr = c.checked ? 'checked' : '';
    const dateVal = c.date || '';
    const photoActionText = c.photo ? '📄 有り（タップで拡大）' : '📷 写真を追加';
    const hasPhotoClass = c.photo ? 'has-photo' : '';

    return `
      <div class="cert-row-new" id="cert-row-${t.key}">
        <div class="cert-main-line">
          <label class="cert-checkbox-label">
            <input type="checkbox" id="cert-check-${t.key}" ${checkedAttr} onchange="saveCertState('${t.key}')">
            <span class="cert-custom-check"></span>
            <span class="cert-label-text">${t.label}</span>
          </label>
          <input type="date" class="cert-date-input" id="cert-date-${t.key}" value="${dateVal}" onchange="saveCertState('${t.key}')">
        </div>
        <div class="cert-sub-line">
          <button class="cert-photo-btn ${hasPhotoClass}" onclick="triggerCertPhoto('${t.key}')" id="cert-pbtn-${t.key}">${photoActionText}</button>
          ${c.photo ? `<button class="cert-photo-del-btn" onclick="deleteCertPhoto(event, '${t.key}')">削除</button>` : ''}
          <input type="file" id="cert-file-${t.key}" accept="image/*,image/heic,image/heif" class="hidden" onchange="onCertPhotoChange(event, '${t.key}')">
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('certs-container').innerHTML = html;
}

function saveCertState(key) {
  const data = loadData();
  const pets = data[currentType]||[];
  const idx = pets.findIndex(p=>p.id===currentPetId);
  if(idx===-1) return;
  if(!pets[idx].certificates) pets[idx].certificates = {};
  if(!pets[idx].certificates[key]) pets[idx].certificates[key] = { checked:false, date:'', photo:null };

  pets[idx].certificates[key].checked = document.getElementById(`cert-check-${key}`).checked;
  pets[idx].certificates[key].date = document.getElementById(`cert-date-${key}`).value;
  pets[idx].updatedAt = Date.now();
  
  data[currentType] = pets;
  saveData(data);
}

function triggerCertPhoto(key) {
  const data = loadData();
  const pet = (data[currentType]||[]).find(p=>p.id===currentPetId);
  const photo = pet?.certificates?.[key]?.photo;
  if (photo) {
    openPhotoModal(photo);
  } else {
    document.getElementById(`cert-file-${key}`).click();
  }
}

function onCertPhotoChange(event, key) {
  const file = event.target.files[0];
  if(!file) return;
  compressAndLoad(file, base64 => {
    const data = loadData();
    const pets = data[currentType]||[];
    const idx = pets.findIndex(p=>p.id===currentPetId);
    if(idx===-1) return;

    if(!pets[idx].certificates) pets[idx].certificates = {};
    if(!pets[idx].certificates[key]) pets[idx].certificates[key] = { checked:false, date:'', photo:null };

    pets[idx].certificates[key].photo = base64;
    pets[idx].updatedAt = Date.now();
    data[currentType] = pets;
    saveData(data);
    renderCertificatesCard(pets[idx]);
    showToast('証明書写真を保存しました ✓');
  });
}

function deleteCertPhoto(event, key) {
  event.stopPropagation();
  if(!confirm('証明書写真を削除しますか？')) return;
  const data = loadData();
  const pets = data[currentType]||[];
  const idx = pets.findIndex(p=>p.id===currentPetId);
  if(idx===-1) return;
  if(pets[idx].certificates?.[key]) {
    pets[idx].certificates[key].photo = null;
    pets[idx].updatedAt = Date.now();
    data[currentType] = pets;
    saveData(data);
    renderCertificatesCard(pets[idx]);
    showToast('写真を削除しました');
  }
}

// --- 通院記録タイムライン ---
let currentEditingRecordId = null;
let recordPhotoTemp = null;

function renderMedicalRecordsList(pet) {
  const records = pet.medicalRecords || [];
  const sorted = [...records].sort((a,b) => new Date(b.date||0) - new Date(a.date||0));
  const container = document.getElementById('medical-records-timeline');

  if(sorted.length === 0) {
    container.innerHTML = `<div class="empty-records-text">通院記録がまだありません</div>`;
    return;
  }

  container.innerHTML = sorted.map(r => {
    const photoHtml = r.photo ? `<div class="record-item-photo" onclick="openPhotoModal('${r.photo}')"><img src="${r.photo}"></div>` : '';
    const memoHtml = r.notes ? `<div class="record-item-notes">${escHtml(r.notes).replace(/\n/g,'<br>')}</div>` : '';
    const costHtml = r.cost ? `<div class="record-item-cost">費用: <span>￥${Number(r.cost).toLocaleString()}</span></div>` : '';
    const hospitalHtml = r.hospitalName ? `<div class="record-item-hospital">🏥 ${escHtml(r.hospitalName)}</div>` : '';

    return `
      <div class="record-timeline-item">
        <div class="record-item-badge"></div>
        <div class="record-item-header">
          <span class="record-item-date">${formatDate(r.date)}</span>
          <span class="record-item-title">${escHtml(r.title || '診察・受診')}</span>
        </div>
        <div class="record-item-body">
          ${hospitalHtml}
          ${memoHtml}
          ${photoHtml}
          ${costHtml}
          <div class="record-item-actions">
            <button class="rec-edit-btn" onclick="openEditRecordModal('${r.id}')">編集</button>
            <button class="rec-del-btn" onclick="deleteMedicalRecord('${r.id}')">削除</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function openAddRecordModal() {
  currentEditingRecordId = null;
  recordPhotoTemp = null;
  document.getElementById('m-rec-modal-title').textContent = '通院記録の追加';
  document.getElementById('m-rec-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('m-rec-title').value = '';
  document.getElementById('m-rec-notes').value = '';
  document.getElementById('m-rec-cost').value = '';
  
  // 病院セレクトボックス生成
  populateHospitalSelect('');
  
  // 気になることメモのストックエリアを描画
  renderPendingNotesStockArea();

  document.getElementById('m-rec-pimg-wrap').style.display = 'none';
  document.getElementById('m-rec-pimg').src = '';
  document.getElementById('modal-medical-record').classList.add('open');
}

function populateHospitalSelect(currentName) {
  const list = loadHospitals();
  const select = document.getElementById('m-rec-hospital');
  select.innerHTML = `<option value="">-- 選択なし --</option>` + 
    list.map(h => `<option value="${escHtml(h.name)}" ${h.name===currentName?'selected':''}>${escHtml(h.name)}</option>`).join('');
}

// 通院記録に「気になることメモ」を結合するストックエリアの制御
function renderPendingNotesStockArea() {
  const container = document.getElementById('m-pending-notes-list');
  if(!container) return;
  const data = loadData();
  const pet = (data[currentType]||[]).find(p=>p.id===currentPetId);
  if(!pet) return;

  // メモに紐づいていない気になること一覧を抽出
  const issues = ISSUES[currentType];
  const pendingNotes = [];
  issues.forEach(issue => {
    const memo = pet.issues?.[issue.key]?.memo;
    if(memo) {
      pendingNotes.push({ id: issue.key, text: `【${issue.label}】${memo}` });
    }
  });

  if(pendingNotes.length === 0) {
    container.innerHTML = '<div style="font-size:11px;color:#999;padding:4px 0;">ストックされている気になるメモはありません</div>';
    return;
  }

  container.innerHTML = pendingNotes.map(n => `
    <div class="pending-note-chip" id="pnchip-${n.id}" onclick="togglePendingNoteSelect('${n.id}', this)">
      <span style="flex:1;cursor:pointer;">${escHtml(n.text)}</span>
      <button onclick="returnPendingNoteToStock('${currentPetId}','${n.id}')" style="border:none;background:none;color:#c04040;font-size:11px;cursor:pointer;padding:0 2px;font-weight:700;" title="外してストックに戻す">外す</button>
    </div>
  `).join('');
}

function returnPendingNoteToStock(petId, noteId) {
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

function digestSelectedPendingNotes(petId, currentNotes) {
  const chips = document.querySelectorAll('#m-pending-notes-list .pending-note-chip.selected');
  if (chips.length === 0) return currentNotes;
  const texts = [...chips].map(c => c.textContent.trim());
  const combined = [currentNotes, ...texts.map(t=>`[気になるメモ] ${t}`)].filter(Boolean).join('\n\n');
  
  // 消化したメモ側をクリアするかは設計次第だが、今回は上書きのみ行う
  return combined;
}

function openEditRecordModal(id) {
  currentEditingRecordId = id;
  const data = loadData();
  const pet = (data[currentType]||[]).find(p=>p.id===currentPetId);
  const r = (pet.medicalRecords||[]).find(rec => rec.id === id);
  if(!r) return;

  document.getElementById('m-rec-modal-title').textContent = '通院記録の編集';
  document.getElementById('m-rec-date').value = r.date || '';
  document.getElementById('m-rec-title').value = r.title || '';
  document.getElementById('m-rec-notes').value = r.notes || '';
  document.getElementById('m-rec-cost').value = r.cost || '';
  
  populateHospitalSelect(r.hospitalName || '');
  renderPendingNotesStockArea();

  recordPhotoTemp = r.photo || null;
  const pwrap = document.getElementById('m-rec-pimg-wrap');
  const pimg = document.getElementById('m-rec-pimg');
  if(r.photo) {
    pwrap.style.display = 'block'; pimg.src = r.photo;
  } else {
    pwrap.style.display = 'none'; pimg.src = '';
  }

  document.getElementById('modal-medical-record').classList.add('open');
}

function triggerRecordPhoto() {
  document.getElementById('m-rec-file').click();
}

function onRecordPhotoChange(event) {
  const file = event.target.files[0];
  if(!file) return;
  compressAndLoad(file, base64 => {
    recordPhotoTemp = base64;
    document.getElementById('m-rec-pimg-wrap').style.display = 'block';
    document.getElementById('m-rec-pimg').src = base64;
  });
}

function deleteRecordPhotoTemp() {
  recordPhotoTemp = null;
  document.getElementById('m-rec-pimg-wrap').style.display = 'none';
  document.getElementById('m-rec-pimg').src = '';
}

function saveMedicalRecord() {
  const date = document.getElementById('m-rec-date').value;
  const title = document.getElementById('m-rec-title').value.trim();
  let notes = document.getElementById('m-rec-notes').value.trim();
  const cost = document.getElementById('m-rec-cost').value.trim();
  const hospitalName = document.getElementById('m-rec-hospital').value;

  if(!date) { alert('日付を入力してください'); return; }

  // 気気になることメモをストックから結合
  notes = digestSelectedPendingNotes(currentPetId, notes);

  const data = loadData();
  const pets = data[currentType]||[];
  const pIdx = pets.findIndex(p=>p.id===currentPetId);
  if(pIdx===-1) return;

  if(!pets[pIdx].medicalRecords) pets[pIdx].medicalRecords = [];

  if(currentEditingRecordId) {
    const rIdx = pets[pIdx].medicalRecords.findIndex(r => r.id === currentEditingRecordId);
    if(rIdx !== -1) {
      pets[pIdx].medicalRecords[rIdx] = {
        ...pets[pIdx].medicalRecords[rIdx],
        date, title, notes, cost, hospitalName, photo: recordPhotoTemp, updatedAt: Date.now()
      };
    }
  } else {
    const newRec = {
      id: 'rec_' + Date.now(),
      date, title, notes, cost, hospitalName, photo: recordPhotoTemp, createdAt: Date.now()
    };
    pets[pIdx].medicalRecords.push(newRec);
  }

  pets[pIdx].updatedAt = Date.now();
  data[currentType] = pets;
  saveData(data);
  closeModal(null, 'modal-medical-record');
  renderHospitalRecordsScreen(pets[pIdx]);
  showToast('通院記録を保存しました ✓');
}

function deleteMedicalRecord(id) {
  if(!confirm('この通院記録を削除しますか？')) return;
  const data = loadData();
  const pets = data[currentType]||[];
  const pIdx = pets.findIndex(p=>p.id===currentPetId);
  if(pIdx===-1) return;

  pets[pIdx].medicalRecords = (pets[pIdx].medicalRecords||[]).filter(r => r.id !== id);
  pets[pIdx].updatedAt = Date.now();
  data[currentType] = pets;
  saveData(data);
  renderHospitalRecordsScreen(pets[pIdx]);
  showToast('通院記録を削除しました');
}

// --- 共通写真プレビューモーダル ---
function openPhotoModal(src) {
  document.getElementById('photo-modal-img').src = src;
  document.getElementById('modal-photo-viewer').classList.add('open');
}

// ========== 病院マスター管理設定画面 ==========
function openHospitalSettings() {
  renderHospitalSettingsList();
  document.getElementById('modal-hospital-settings').classList.add('open');
}

function renderHospitalSettingsList() {
  const list = loadHospitals();
  const container = document.getElementById('hospital-settings-list');
  if(list.length === 0) {
    container.innerHTML = '<div style="font-size:13px;color:#999;text-align:center;padding:12px 0;">登録されている病院はありません</div>';
    return;
  }
  container.innerHTML = list.map((h, i) => `
    <div class="hosp-settings-item">
      <div class="hosp-settings-info">
        <div class="hosp-settings-name">${escHtml(h.name)}</div>
        ${h.tel ? `<div class="hosp-settings-tel">📞 ${escHtml(h.tel)}</div>` : ''}
        ${h.address ? `<div class="hosp-settings-addr">📍 ${escHtml(h.address)}</div>` : ''}
      </div>
      <button class="hosp-settings-del-btn" onclick="deleteHospitalMaster(${i})">削除</button>
    </div>
  `).join('');
}

function addHospitalMaster() {
  const nameInput = document.getElementById('hosp-new-name');
  const telInput = document.getElementById('hosp-new-tel');
  const addrInput = document.getElementById('hosp-new-addr');

  const name = nameInput.value.trim();
  if(!name) { alert('病院名を入力してください'); return; }

  const list = loadHospitals();
  list.push({ name, tel: telInput.value.trim(), address: addrInput.value.trim() });
  saveHospitals(list);

  nameInput.value = ''; telInput.value = ''; addrInput.value = '';
  renderHospitalSettingsList();
  showToast('かかりつけ病院を追加しました');

  const recordModal = document.getElementById('modal-medical-record');
  if(recordModal.classList.contains('open')) {
    populateHospitalSelect(name);
  }
}

function deleteHospitalMaster(index) {
  if(!confirm('この病院をマスターデータから削除しますか？\n（既存の通院記録内の文字は消えません）')) return;
  const list = loadHospitals();
  list.splice(index, 1);
  saveHospitals(list);
  renderHospitalSettingsList();
  showToast('病院を削除しました');
}

// ========== バックアップ（JSONエクスポート） ==========
function exportDataAsJson() {
  const data = loadData();
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `wannyan_backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('バックアップファイルをダウンロードしました');
}

function triggerImportJson() {
  document.getElementById('import-file-input').click();
}

function onImportFileChange(event) {
  const file = event.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    handleImportJson(e.target.result);
  };
  reader.readAsText(file);
}

// ========== 初期化 ==========
window.addEventListener('DOMContentLoaded', () => {
  renderList();
});