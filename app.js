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

  container.innerHTML = `<div class="${isEditing?'editing-mode':''}">
    <span class="reg-date-badge">登録日 ${formatTs(pet.createdAt)}</span>
    <div class="detail-photo-wrap">
      <div class="detail-photo">${photoInner}</div>
      <button class="photo-change-btn" onclick="changeDetailPhoto()">📷</button>
      <input type="file" id="detail-photo-input" accept="image/*,image/heic,image/heif" class="hidden" onchange="onDetailPhotoChange(event)">
    </div>
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
