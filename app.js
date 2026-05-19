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

// ========== Storage ==========
function loadData() {
  try { return JSON.parse(localStorage.getItem('wannyan_v2') || '{"dog":[],"cat":[]}'); }
  catch(e) { return {dog:[],cat:[]}; }
}
function saveData(data) { localStorage.setItem('wannyan_v2', JSON.stringify(data)); }

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
  let filtered = search ? pets.filter(p=>
    toHiragana(p.name||'').toLowerCase().includes(search) ||
    toHiragana(p.breed||'').toLowerCase().includes(search)
  ) : pets;
  const sorted = [...filtered].sort((a,b)=>
    sortMode==='name' ? (a.name||'').localeCompare(b.name||'','ja') : (b.updatedAt||0)-(a.updatedAt||0)
  );
  const container = document.getElementById('pet-list');
  if(!sorted.length){
    container.innerHTML=`<div class="empty-state"><div class="empty-emoji">${currentType==='dog'?'🐕':'🐈'}</div><p>${search?'検索結果がありません':'まだ登録がありません<br>＋ボタンから追加しよう'}</p></div>`;
    return;
  }
  container.innerHTML = sorted.map((pet,i)=>{
    const age = pet.birthday ? calcAge(pet.birthday) : (pet.age||'不明');
    const photoHtml = pet.photo
      ? `<div class="pet-card-photo"><img src="${pet.photo}" alt="${escHtml(pet.name)}"></div>`
      : `<div class="pet-card-photo">${currentType==='dog'?'🐕':'🐈'}</div>`;
    const genderIcon = pet.gender==='オス'?'♂':pet.gender==='メス'?'♀':'';
    return `<div class="pet-card" onclick="openDetail('${pet.id}')" style="animation-delay:${i*0.04}s">
      ${photoHtml}
      <div class="pet-card-info">
        <div class="pet-card-name">${escHtml(pet.name)} ${genderIcon}</div>
        <div class="pet-card-meta">${escHtml(pet.breed||'')} ${age}</div>
      </div>
      <div class="pet-card-arrow">›</div>
    </div>`;
  }).join('');
}
function filterList() { renderList(); }
function sortList(mode) {
  sortMode=mode;
  document.getElementById('sort-name-btn').classList.toggle('active',mode==='name');
  document.getElementById('sort-date-btn').classList.toggle('active',mode==='date');
  renderList();
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

// ========== 画像圧縮（HEIC対応含む制限解除） ==========
function compressAndLoad(file, callback) {
  const reader=new FileReader();
  reader.onload=e=>{
    const img=new Image();
    img.onload=()=>{
      const MAX=1200;
      let w=img.width, h=img.height;
      if(w>MAX||h>MAX){ const r=Math.min(MAX/w,MAX/h); w=Math.round(w*r); h=Math.round(h*r); }
      const canvas=document.createElement('canvas');
      canvas.width=w; canvas.height=h;
      canvas.getContext('2d').drawImage(img,0,0,w,h);
      callback(canvas.toDataURL('image/jpeg',0.85));
    };
    img.onerror=()=>callback(e.target.result); // 圧縮失敗時は元データ
    img.src=e.target.result;
  };
  reader.readAsDataURL(file);
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
  const data=loadData();
  const json=JSON.stringify(data,null,2);
  const blob=new Blob([json],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  const d=new Date();
  a.href=url;
  a.download=`wannyan_backup_${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('エクスポートしました ✓');
}
function importData(event){
  const file=event.target.files[0]; if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const data=JSON.parse(e.target.result);
      if(!data.dog||!data.cat)throw new Error();
      if(!confirm('現在のデータに上書きします。よろしいですか？'))return;
      saveData(data);
      closeModal(null,'modal-transfer');
      showToast('インポートしました ✓');
      if(currentType)renderList();
    }catch(err){ alert('ファイルが正しくありません。'); }
  };
  reader.readAsText(file);
  event.target.value='';
}
function confirmReset(){
  if(!confirm('全データを削除します。この操作は取り消せません。よろしいですか？'))return;
  localStorage.removeItem('wannyan_v2');
  closeModal(null,'modal-transfer');
  showToast('データをリセットしました');
  if(currentType)renderList();
}

// ========== 病院記録＆ケア 統合機能 (Hospital & Care Integration) ==========
let currentHospitalTab = 'care-weight';
let currentMedicalFilter = 'all';
let tempMedicalPhoto = null;
let tempCertPhoto = null;

// ペットデータの新規フィールドを安全に確保する後方互換用関数
function ensurePetHospitalFields(pet) {
  if (!pet.weightHistory) pet.weightHistory = [];
  if (!pet.quickCares) pet.quickCares = {};
  if (!pet.hospitals) pet.hospitals = [];
  if (!pet.medicalRecords) pet.medicalRecords = [];
  if (!pet.certificates) pet.certificates = {};
  return pet;
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
  
  // 各タブ要素の初期描画
  switchHospitalTab('care-weight');
  
  // 各自データの再描画
  renderQuickCares();
  renderWeightSection();
  renderMedicalTimeline();
  renderHospitalMaster();
  renderCertificates();
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
  }
}

// ==========================================
// 1. 日常ケア (1タップクイック完了) のロジック
// ==========================================
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

function deleteWeightRecord(id) {
  if (!confirm('この体重の記録を削除しますか？')) return;
  
  const data = loadData();
  const pets = data[currentType] || [];
  const idx = pets.findIndex(p => p.id === currentPetId);
  if (idx === -1) return;
  
  const pet = ensurePetHospitalFields(pets[idx]);
  pet.weightHistory = pet.weightHistory.filter(w => w.id !== id);
  
  // 体重情報の連動更新
  const sortedHistory = [...pet.weightHistory].sort((a,b) => b.date.localeCompare(a.date));
  if (sortedHistory.length > 0) {
    pet.weight = String(sortedHistory[0].weight);
  } else {
    pet.weight = '';
  }
  
  pets[idx] = pet;
  data[currentType] = pets;
  saveData(data);
  
  renderWeightSection();
  showToast('削除しました');
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
  if (pet.hospitals.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding:40px 20px">
        <div style="font-size:44px;margin-bottom:12px">🏢</div>
        <p>登録されている病院がありません<br>「病院を登録する」ボタンから追加してください</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = pet.hospitals.map(hosp => {
    // 逆引き集計 (その病院での「過去の治療値段・平均費用」や「クチコミ(メモ)」)
    const records = pet.medicalRecords.filter(r => r.hospitalId === hosp.id);
    const costs = records.map(r => Number(r.cost || 0)).filter(c => c > 0);
    const averageCost = costs.length > 0 
      ? Math.round(costs.reduce((sum, val) => sum + val, 0) / costs.length)
      : 0;
    
    // クチコミ逆引き
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
            ${hosp.doctor ? `
              <div class="hospital-detail-row">
                <span class="hospital-detail-icon">👨‍⚕️</span>
                <span class="hospital-detail-val">担当：<strong>${escHtml(hosp.doctor)}</strong></span>
              </div>` : ''}
          </div>
          
          ${hosp.memo ? `
            <p class="issue-memo-label">特色・印象（病院メモ）</p>
            <div class="hospital-memo-box">${escHtml(hosp.memo)}</div>` : ''}
            
          <!-- 逆引き治療履歴セクション -->
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
            <button class="hospital-act-btn share" onclick="shareHospital('${hosp.id}')">📢 シェア</button>
            <button class="hospital-act-btn edit" onclick="openHospitalModal('${hosp.id}')">✏️ 編集</button>
            <button class="hospital-act-btn delete" onclick="deleteHospitalRecord('${hosp.id}')">✕ 削除</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function toggleHospitalCard(id) {
  const card = document.getElementById(`hosp-card-${id}`);
  if (card) card.classList.toggle('open');
}

function openHospitalModal(hospitalId = null) {
  // フィールドの初期化
  document.getElementById('edit-hospital-id').value = hospitalId || '';
  document.getElementById('h-name').value = '';
  document.getElementById('h-phone').value = '';
  document.getElementById('h-address').value = '';
  document.getElementById('h-doctor').value = '';
  document.getElementById('h-memo').value = '';
  
  if (hospitalId) {
    document.getElementById('hospital-modal-title').textContent = '病院情報を編集';
    const data = loadData();
    const pet = (data[currentType] || []).find(p => p.id === currentPetId);
    if (pet) {
      const hosp = pet.hospitals.find(h => h.id === hospitalId);
      if (hosp) {
        document.getElementById('h-name').value = hosp.name;
        document.getElementById('h-phone').value = hosp.phone || '';
        document.getElementById('h-address').value = hosp.address || '';
        document.getElementById('h-doctor').value = hosp.doctor || '';
        document.getElementById('h-memo').value = hosp.memo || '';
      }
    }
  } else {
    document.getElementById('hospital-modal-title').textContent = '病院を新規登録';
  }
  
  document.getElementById('modal-hospital').classList.add('open');
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
  
  const hospData = {
    id: id || 'hosp_' + Date.now(),
    name,
    phone: document.getElementById('h-phone').value.trim(),
    address: document.getElementById('h-address').value.trim(),
    doctor: document.getElementById('h-doctor').value.trim(),
    memo: document.getElementById('h-memo').value.trim()
  };
  
  if (id) {
    const hIdx = pet.hospitals.findIndex(h => h.id === id);
    if (hIdx !== -1) pet.hospitals[hIdx] = hospData;
  } else {
    pet.hospitals.push(hospData);
  }
  
  pets[idx] = pet;
  data[currentType] = pets;
  saveData(data);
  
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
  
  const pet = ensurePetHospitalFields(pets[idx]);
  pet.hospitals = pet.hospitals.filter(h => h.id !== hospitalId);
  
  pets[idx] = pet;
  data[currentType] = pets;
  saveData(data);
  
  renderHospitalMaster();
  showToast('病院を削除しました');
}

// ワンタップシェア機能 (病院情報をテキストコピー)
function shareHospital(hospitalId) {
  const data = loadData();
  const pet = (data[currentType] || []).find(p => p.id === currentPetId);
  if (!pet) return;
  
  const hosp = pet.hospitals.find(h => h.id === hospitalId);
  if (!hosp) return;
  
  // テキストの組み立て
  let shareText = `【おすすめの動物病院】\n`;
  shareText += `🏥 病院名: ${hosp.name}\n`;
  if (hosp.phone) shareText += `📞 電話: ${hosp.phone}\n`;
  if (hosp.address) {
    shareText += `📍 住所: ${hosp.address}\n`;
    shareText += `🗺️ マップ: https://maps.google.com/?q=${encodeURIComponent(hosp.address)}\n`;
  }
  if (hosp.doctor) shareText += `👨‍⚕️ 担当医: ${hosp.doctor}\n`;
  if (hosp.memo) shareText += `📝 メモ: ${hosp.memo}\n`;
  shareText += `\n（わんにゃんメモリー より共有）`;
  
  navigator.clipboard.writeText(shareText).then(() => {
    showToast('病院情報をコピーしました！LINE等に貼り付けられます ✓');
  }).catch(() => {
    alert('コピーに失敗しました。お手数ですが手動でコピーしてください。');
  });
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
      const hosp = pet.hospitals.find(h => h.id === rec.hospitalId);
      const hospName = hosp ? hosp.name : '不明な病院';
      const icon = rec.type === 'vaccine' ? '💉' : '🏥';
      const iconClass = rec.type === 'vaccine' ? 'vaccine-type' : '';
      
      return `
        <div class="timeline-item">
          <div class="timeline-item-icon ${iconClass}">${icon}</div>
          <div class="timeline-item-content">
            <div class="timeline-item-header">
              <span class="timeline-item-date-hosp">${escHtml(formatDate(rec.date))}<br><span style="font-size:12px;color:var(--text-mid);font-weight:700;">${escHtml(hospName)}</span></span>
              ${rec.cost ? `<span class="timeline-item-cost">${Number(rec.cost).toLocaleString()} 円</span>` : ''}
            </div>
            ${rec.doctor ? `<div class="timeline-item-meta">担当医：${escHtml(rec.doctor)}</div>` : ''}
            ${rec.notes ? `<div class="timeline-item-notes">${escHtml(rec.notes)}</div>` : ''}
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

function openMedicalRecordModal(recordId = null) {
  const data = loadData();
  const pet = (data[currentType] || []).find(p => p.id === currentPetId);
  if (!pet) return;
  
  ensurePetHospitalFields(pet);
  
  // 病院のセレクトボックスの構築
  const select = document.getElementById('m-hospital-select');
  select.innerHTML = '<option value="">-- 選択してください --</option>' + 
    pet.hospitals.map(h => `<option value="${h.id}">${escHtml(h.name)}</option>`).join('');
  
  // 各自フィールドの初期化
  document.getElementById('edit-medical-id').value = recordId || '';
  document.getElementById('m-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('m-doctor').value = '';
  document.getElementById('m-cost').value = '';
  document.getElementById('m-notes').value = '';
  document.getElementById('m-photo-preview').src = '';
  document.getElementById('m-photo-preview').classList.add('hidden');
  document.getElementById('m-photo-placeholder').classList.remove('hidden');
  tempMedicalPhoto = null;
  
  selectMedicalType('medical');
  
  if (recordId) {
    document.getElementById('medical-modal-title').textContent = '通院記録を編集';
    const rec = pet.medicalRecords.find(r => r.id === recordId);
    if (rec) {
      document.getElementById('m-date').value = rec.date;
      selectMedicalType(rec.type || 'medical');
      select.value = rec.hospitalId;
      document.getElementById('m-doctor').value = rec.doctor || '';
      document.getElementById('m-cost').value = rec.cost || '';
      document.getElementById('m-notes').value = rec.notes || '';
      
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
      if (pet.hospitals.some(h => h.id === latest.hospitalId)) {
        select.value = latest.hospitalId;
        document.getElementById('m-doctor').value = latest.doctor || '';
      }
    }
  }
  
  document.getElementById('modal-medical-record').classList.add('open');
}

function selectMedicalType(type) {
  document.getElementById('m-type').value = type;
  document.getElementById('m-type-medical').classList.toggle('selected', type === 'medical');
  document.getElementById('m-type-vaccine').classList.toggle('selected', type === 'vaccine');
}

// 病院を変更した際に、病院マスターから担当医(何先生)を自動プレフィルする
function onMedicalHospitalChange() {
  const hospId = document.getElementById('m-hospital-select').value;
  if (!hospId) return;
  
  const data = loadData();
  const pet = (data[currentType] || []).find(p => p.id === currentPetId);
  if (pet) {
    const hosp = pet.hospitals.find(h => h.id === hospId);
    if (hosp && hosp.doctor) {
      document.getElementById('m-doctor').value = hosp.doctor;
    }
  }
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
  
  const recData = {
    id: id || 'med_' + Date.now(),
    date,
    type: document.getElementById('m-type').value,
    hospitalId,
    doctor: document.getElementById('m-doctor').value.trim(),
    cost: document.getElementById('m-cost').value ? Number(document.getElementById('m-cost').value) : '',
    notes: document.getElementById('m-notes').value.trim(),
    photo: tempMedicalPhoto || null
  };
  
  if (id) {
    const rIdx = pet.medicalRecords.findIndex(r => r.id === id);
    if (rIdx !== -1) pet.medicalRecords[rIdx] = recData;
  } else {
    pet.medicalRecords.push(recData);
  }
  
  pets[idx] = pet;
  data[currentType] = pets;
  saveData(data);
  
  closeModal(null, 'modal-medical-record');
  renderMedicalTimeline();
  renderHospitalMaster(); // 逆引き一覧の再更新用
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
  
  pets[idx] = pet;
  data[currentType] = pets;
  saveData(data);
  
  renderMedicalTimeline();
  renderHospitalMaster(); // 逆引き一覧の再更新用
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
      detailRows.push(`<div class="cert-detail-row"><span class="cert-detail-lbl">検査結果</span><span class="cert-detail-val">${escHtml(hasData ? c.data.result : '-')}</span></div>`);
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
  document.getElementById('c-result').value = '';
  document.getElementById('c-photo-preview').src = '';
  document.getElementById('c-photo-preview').classList.add('hidden');
  document.getElementById('c-photo-placeholder').classList.remove('hidden');
  tempCertPhoto = null;
  
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
    if (certKey === 'vaccine') document.getElementById('c-name').value = c.name || '';
    if (certKey === 'antibody') document.getElementById('c-result').value = c.result || '';
    
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
  
  if (certKey === 'vaccine' && !document.getElementById('c-name').value.trim()) {
    alert('ワクチンの種類/製品名を入力してください');
    return;
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
  
  if (certKey === 'vaccine') certData.name = document.getElementById('c-name').value.trim();
  if (certKey === 'antibody') certData.result = document.getElementById('c-result').value.trim();
  
  pet.certificates[certKey] = certData;
  
  pets[idx] = pet;
  data[currentType] = pets;
  saveData(data);
  
  closeModal(null, 'modal-certificate');
  renderCertificates();
  showToast('証明書を保存しました ✓');
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

// ========== SW ==========
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
}

