'use strict';

/* ==========================================================================
   複数端末同期（Supabase）
   - 既存の saveData / saveHospitals をラップするだけで、画面側のコードは触らない
   - ペット単位の last-write-wins
   - オフラインでも通常どおり動き、オンラインに戻ったときに送る
   - 外部ライブラリ不使用（PWAをオフラインで完結させるため fetch で直接叩く）
   ========================================================================== */

const SB_URL = 'https://kafaarlosuvqxxlxpvgg.supabase.co';
const SB_KEY = 'sb_publishable_nSwOQo-YbEtDN_KTjBf80w_D6o0iLoA';

// ログイン状態は6アプリで共通。同じオリジンなので localStorage を共有できる。
// キーを分けていたせいで、アプリの数だけログインが必要になっていた。
const SESSION_KEY = 'sb_session_v1';
const LEGACY_SESSION_KEY = 'wannyan_session_v1';
const SYNC_STATE_KEY = 'wannyan_sync_state_v1';
const ROLLBACK_KEY = 'wannyan_rollback_v1';

// ========== 取り込み前の巻き戻し用スナップショット ==========
// クラウドの内容を反映する直前に、その端末のデータを丸ごと控えておく。
// 万一おかしくなっても1タップで戻せるようにするための保険。
async function saveRollback(reason) {
  try {
    const snap = {
      at: Date.now(),
      reason,
      pets: (await idbGet('wannyan_v2')) || { dog: [], cat: [] },
      hospitals: (await idbGet('wannyan_hospitals_v1')) || [],
    };
    const petCount = (snap.pets.dog || []).length + (snap.pets.cat || []).length;
    if (!petCount && !snap.hospitals.length) return; // 空を控えても意味がない
    await idbSet(ROLLBACK_KEY, snap);
  } catch (e) { /* 保険が取れなくても本処理は止めない */ }
}

async function restoreRollback() {
  const snap = await idbGet(ROLLBACK_KEY);
  if (!snap) { alert('戻せる控えがありません。'); return; }
  const n = (snap.pets.dog || []).length + (snap.pets.cat || []).length;
  const when = new Date(snap.at).toLocaleString('ja-JP');
  if (!confirm(`${when} 時点の内容（${n}匹）に戻します。\n今この端末にあるデータは置き換わります。よろしいですか？`)) return;

  await idbSet('wannyan_v2', snap.pets);
  await idbSet('wannyan_hospitals_v1', snap.hospitals);
  // 送信済みの目印を消して、戻した内容を改めてクラウドへ反映させる
  await idbSet(SYNC_STATE_KEY, null);
  showToast('戻しました');
  if (typeof currentType !== 'undefined' && currentType && typeof renderList === 'function') {
    try { await renderList(); } catch (e) {}
  }
  await syncNow({ toast: false });
  updateSyncUI();
}

// ========== セッション ==========
function sbLoadSession() {
  try {
    let raw = localStorage.getItem(SESSION_KEY);
    // 旧キー（アプリごとに分かれていた頃のもの）からの引き継ぎ。
    // これがあるので、共通化のためにログインし直す必要はない。
    if (!raw) {
      const old = localStorage.getItem(LEGACY_SESSION_KEY);
      // 引き継いだら古いほうは必ず消す。残すとログアウトした瞬間に古いログイン情報が
      // ここから復活し、何週間も前の更新トークンを使ってサーバーにログインごと無効にされていた
      if (old) { localStorage.setItem(SESSION_KEY, old); localStorage.removeItem(LEGACY_SESSION_KEY); raw = old; }
    }
    return JSON.parse(raw || 'null');
  } catch (e) { return null; }
}
/* アプリごとに分かれていた頃のログイン情報の置き場所。6アプリは同じオリジンで保存先を共有しているので、
   どのアプリの古いキーが残っていても、ログアウトや失効のあとに古いログイン情報が復活してしまう。
   ログインした時もログアウトした時も、全部まとめて消す。 */
const LEGACY_SESSION_KEYS = ['ironlog_session_v1', 'wannyan_session_v1', 'uruoi_session_v1', 'qest_session_v1', 'kaimono_session_v1'];

function sbSaveSession(s) {
  if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  else localStorage.removeItem(SESSION_KEY);
  LEGACY_SESSION_KEYS.forEach(k => { try { localStorage.removeItem(k); } catch (e) {} });
}
function sbIsLoggedIn() { return !!(sbLoadSession() || {}).refresh_token; }

/* 最後にログインしたメールアドレス。ログイン欄にあらかじめ入れておくためだけのもので、
   パスワードは持たない（パスワードは端末のパスワード保存に任せる）。
   キーは他アプリと共通なので、どれか1つで入れれば他アプリの欄にも入っている。 */
const LAST_EMAIL_KEY = 'sb_last_email';
function lastLoginEmail() {
  return (sbLoadSession() || {}).email || localStorage.getItem(LAST_EMAIL_KEY) || '';
}
function rememberLoginEmail(email) {
  try { localStorage.setItem(LAST_EMAIL_KEY, email); } catch (e) {}
}

function _storeSession(json) {
  if (!json || !json.access_token) return null;
  const s = {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: Date.now() + (json.expires_in || 3600) * 1000,
    user_id: (json.user && json.user.id) || (sbLoadSession() || {}).user_id || null,
    email: (json.user && json.user.email) || (sbLoadSession() || {}).email || null,
  };
  sbSaveSession(s);
  return s;
}

async function _authFetch(path, body) {
  const res = await fetch(`${SB_URL}/auth/v1/${path}`, {
    method: 'POST',
    headers: { 'apikey': SB_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    // 「サーバーに断られた」のか「そもそも届かなかった」のかを呼び出し側が区別できるように
    // status を付ける。混同するとオフラインなだけでログイン情報を捨ててしまう。
    const err = new Error(json.error_description || json.msg || json.message || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return json;
}

async function sbSignUp(email, password) {
  const json = await _authFetch('signup', { email, password });
  // メール確認が有効な場合はここでセッションが返らない
  if (!json.access_token) return { needsConfirmation: true };
  _storeSession(json);
  return { needsConfirmation: false };
}

async function sbSignIn(email, password) {
  const json = await _authFetch('token?grant_type=password', { email, password });
  _storeSession(json);
}

async function sbSignOut() {
  sbSaveSession(null);
  await idbSet(SYNC_STATE_KEY, null);
}

// 有効なアクセストークンを返す（期限が近ければ更新する）
//
// リフレッシュトークンは1回使うとサーバー側で作り替えられ、古いものはその場で無効になる。
// 同期は複数のテーブルを Promise.all で同時に取りに行くので、何もしないと
// 各リクエストが同時に「期限が切れているから更新しよう」と判断して同じトークンを何度も使い、
// 1本だけ成功して残りは「Invalid Refresh Token: Already Used」で弾かれる。
// それを失効と誤解してログイン情報を消していたため、
// アクセストークンの寿命（1時間）を超えて間を空けるたびにログインし直しになっていた。
// _refreshing で更新は常に1本にまとめ、後続はその結果に相乗りする。
let _refreshing = null;

async function sbAccessToken() {
  const s = sbLoadSession();
  if (!s || !s.refresh_token) return null;
  if (s.access_token && Date.now() < s.expires_at - 60000) return s.access_token;
  if (!_refreshing) {
    _refreshing = _refreshExclusive().finally(() => { _refreshing = null; });
  }
  return _refreshing;
}

/* github.io の6アプリは同じオリジンなので、ログイン情報の保存先（sb_session_v1）を共有している。
   別のタブや別のアプリが同時に同じ更新トークンを使うと、Supabase はそれを「使い回し」とみなし、
   そのログインを丸ごと無効にすることがある（以後どのアプリでも Invalid Refresh Token: Already Used）。
   Web Locks でオリジン全体の更新を1本ずつに並べ、鍵が取れた時点で保存先を読み直す。
   待っている間に誰かが更新を済ませていれば、それをそのまま使う。 */
function _refreshExclusive() {
  const run = async () => {
    const s = sbLoadSession();
    if (!s || !s.refresh_token) throw new Error('ログインしていません');
    if (s.access_token && Date.now() < s.expires_at - 60000) return s.access_token;
    return _sbRefresh(s.refresh_token);
  };
  return (navigator.locks && navigator.locks.request)
    ? navigator.locks.request('sb-token-refresh', run)
    : run();
}

async function _sbRefresh(used) {
  try {
    const json = await _authFetch('token?grant_type=refresh_token', { refresh_token: used });
    return _storeSession(json).access_token;
  } catch (e) {
    // 同じオリジンの別アプリ／別タブが先に更新していた場合、保存先には既に新しいものが入っている。
    // これは失効ではないので、ログイン情報は捨てずに新しいほうで1回だけやり直す。
    const now = sbLoadSession();
    if (now && now.refresh_token && now.refresh_token !== used) {
      if (now.access_token && Date.now() < now.expires_at - 60000) return now.access_token;
      try {
        const json = await _authFetch('token?grant_type=refresh_token', { refresh_token: now.refresh_token });
        return _storeSession(json).access_token;
      } catch (e2) {
        e = e2;   // やり直しも断られたら、下で同じように扱う
      }
    }
    // サーバーがはっきり断ったときだけログインし直し。通信エラー（status 無し）では捨てない。
    // 以前は「やり直し」が断られたときにここを通らず、使えないログイン情報が残ったまま
    // 同期のたびに Invalid Refresh Token: Already Used が出続けていた。
    if (e.status === 400 || e.status === 401) {
      sbSaveSession(null);
      const err = new Error('ログインの有効期限が切れました。もう一度ログインしてください');
      err.status = e.status;
      throw err;
    }
    throw e;
  }
}

// サーバー時刻でも「commit の順番」と now() は完全には一致しないので、
// 前回取得位置を少しだけ巻き戻して取りこぼしを防ぐ。重複して取っても害はない。
const PULL_MARGIN_MS = 5000;
const PAGE_SIZE = 1000; // PostgREST の1回あたり上限に合わせる

// ========== データAPI ==========
async function _rest(path, { method = 'GET', body = null, prefer = null } = {}) {
  const token = await sbAccessToken();
  if (!token) throw new Error('ログインしていません');
  const headers = {
    'apikey': SB_KEY,
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  if (prefer) headers['Prefer'] = prefer;
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`${res.status} ${t.slice(0, 200)}`);
  }
  if (method === 'GET') return res.json();
  return null;
}

// 1回のGETには件数上限があるので、全部取れるまでページを送る。
// 上限を超えた分は静かに落ちるだけでエラーにならないので、忘れると気づけない。
async function _restAll(path) {
  const out = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await _rest(`${path}&limit=${PAGE_SIZE}&offset=${offset}`);
    out.push(...page);
    if (page.length < PAGE_SIZE) return out;
  }
}

// ========== 変更検出 ==========
// JSON全体を保存しておくと重いので、短いハッシュで「変わったか」だけ見る
function _hash(str) {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = ((h1 ^ c) * 16777619) >>> 0;
    h2 = ((h2 + c) * 31 + (h2 << 3)) >>> 0;
  }
  return h1.toString(36) + '-' + h2.toString(36) + '-' + str.length.toString(36);
}

async function _loadSyncState() {
  const s = await idbGet(SYNC_STATE_KEY);
  if (!s || typeof s !== 'object') {
    return { lastPulledAt: null, pets: {}, hospitals: {}, touched: {}, serverTimeMigrated: true };
  }
  // 2026-08-06: updated_at を端末の時計からサーバー時刻に切り替えた。
  // 切り替え前の lastPulledAt はずれた時計で書かれた値なので、
  // そのまま基準にすると（時計が進んでいた端末では）何も取れなくなる。
  // 1度だけ全件取り直させる。
  if (!s.serverTimeMigrated) { s.lastPulledAt = null; s.serverTimeMigrated = true; }
  return s;
}
async function _saveSyncState(s) { await idbSet(SYNC_STATE_KEY, s); }

// ========== 同期本体 ==========
let _syncing = false;
let _syncTimer = null;
let _lastSyncError = null;

function scheduleSync(delay = 2500) {
  if (!sbIsLoggedIn()) return;
  clearTimeout(_syncTimer);
  _syncTimer = setTimeout(() => { syncNow().catch(() => {}); }, delay);
}

// この端末で初めて同期するときだけ、合流するか置き換えるかを決める。
// 端末にデータが無ければ迷う余地がないので何も聞かない。
async function firstSyncSetup() {
  const state = await _loadSyncState();
  if (state.initialized) return;

  const local = (await idbGet('wannyan_v2')) || { dog: [], cat: [] };
  const n = (local.dog || []).length + (local.cat || []).length;

  if (n > 0) {
    await saveRollback('初回同期の前');
    const merge = confirm(
      `この端末には ${n}匹 の記録があります。\n\n` +
      `［OK］この端末の記録もクラウドに合流させる\n` +
      `［キャンセル］クラウドの内容だけを取り込む\n\n` +
      `どちらを選んでも、今の内容は控えに保存され、あとから戻せます。`
    );
    if (!merge) {
      await idbSet('wannyan_v2', { dog: [], cat: [] });
      await idbSet('wannyan_hospitals_v1', []);
    }
  }
  state.initialized = true;
  await _saveSyncState(state);
}

async function syncNow(opts = {}) {
  if (_syncing) return;
  if (!sbIsLoggedIn()) return;
  if (!navigator.onLine) { _lastSyncError = 'オフライン'; updateSyncUI(); return; }

  _syncing = true;
  updateSyncUI();
  try {
    await firstSyncSetup();
    const state = await _loadSyncState();
    await _pull(state);
    await _push(state);
    state.lastSyncedAt = Date.now();
    await _saveSyncState(state);
    _lastSyncError = null;
    if (opts.toast) showToast('同期しました ✓');
  } catch (e) {
    _lastSyncError = e.message || String(e);
    if (opts.toast) alert('同期に失敗しました：' + _lastSyncError);
  } finally {
    _syncing = false;
    updateSyncUI();
  }
}

// ---- 取得 ----
async function _pull(state) {
  const since = state.lastPulledAt ? `&updated_at=gt.${encodeURIComponent(state.lastPulledAt)}` : '';
  const [remotePets, remoteHosps] = await Promise.all([
    _restAll(`wannyan_pets?select=pet_id,pet_type,data,updated_at,deleted&order=updated_at.asc,pet_id.asc${since}`),
    _restAll(`wannyan_hospitals?select=hospital_id,data,updated_at,deleted&order=updated_at.asc,hospital_id.asc${since}`),
  ]);
  if (!remotePets.length && !remoteHosps.length) return;

  // これから端末のデータを書き換えるので、直前の状態を控えておく
  await saveRollback('取り込み前');

  let newest = state.lastPulledAt;
  const bump = ts => { if (!newest || ts > newest) newest = ts; };

  // --- ペット ---
  if (remotePets.length) {
    const data = await idbGet('wannyan_v2') || { dog: [], cat: [] };
    if (!Array.isArray(data.dog)) data.dog = [];
    if (!Array.isArray(data.cat)) data.cat = [];

    remotePets.forEach(row => {
      bump(row.updated_at);
      const remoteMs = Date.parse(row.updated_at);
      // ローカルに未送信の変更があり、そちらの方が新しいなら残す
      const touched = state.touched[row.pet_id];
      if (touched && touched > remoteMs) return;

      ['dog', 'cat'].forEach(t => {
        const i = data[t].findIndex(p => String(p.id) === row.pet_id);
        if (i !== -1) data[t].splice(i, 1);
      });
      if (!row.deleted) {
        const type = row.pet_type === 'cat' ? 'cat' : 'dog';
        data[type].push(row.data);
      }
      state.pets[row.pet_id] = _hash(JSON.stringify(row.data));
      delete state.touched[row.pet_id];
    });
    await idbSet('wannyan_v2', data);
  }

  // --- 病院 ---
  if (remoteHosps.length) {
    const list = (await idbGet('wannyan_hospitals_v1')) || [];
    remoteHosps.forEach(row => {
      bump(row.updated_at);
      const remoteMs = Date.parse(row.updated_at);
      const touched = state.touched['h:' + row.hospital_id];
      if (touched && touched > remoteMs) return;

      const i = list.findIndex(h => String(h.id) === row.hospital_id);
      if (i !== -1) list.splice(i, 1);
      if (!row.deleted) list.push(row.data);
      state.hospitals[row.hospital_id] = _hash(JSON.stringify(row.data));
      delete state.touched['h:' + row.hospital_id];
    });
    await idbSet('wannyan_hospitals_v1', list);
  }

  // commit の順と now() のわずかなズレで取りこぼさないよう、少しだけ巻き戻す
  if (newest) state.lastPulledAt = new Date(Date.parse(newest) - PULL_MARGIN_MS).toISOString();

  // 画面に出ている内容を更新する
  if (typeof currentType !== 'undefined' && currentType && typeof renderList === 'function') {
    try { await renderList(); } catch (e) {}
  }
}

// ---- 送信 ----
async function _push(state) {
  const userId = (sbLoadSession() || {}).user_id;
  if (!userId) throw new Error('ユーザーIDが取れません');

  // --- ペット ---
  const data = (await idbGet('wannyan_v2')) || { dog: [], cat: [] };
  const rows = [];
  const seen = new Set();

  ['dog', 'cat'].forEach(type => {
    (data[type] || []).forEach(pet => {
      const id = String(pet.id);
      seen.add(id);
      const h = _hash(JSON.stringify(pet));
      if (state.pets[id] === h) return; // 変わっていない
      // updated_at は送らない。サーバー側のトリガが now() を入れる。
      // 端末の時計で入れると、時計がずれた端末の行が差分同期の網から永久に漏れる。
      rows.push({ user_id: userId, pet_id: id, pet_type: type, data: pet, deleted: false });
    });
  });
  // ローカルで消えた子は削除フラグを立てる
  Object.keys(state.pets).forEach(id => {
    if (seen.has(id)) return;
    rows.push({ user_id: userId, pet_id: id, pet_type: 'dog', data: {}, deleted: true });
  });

  if (rows.length) {
    await _rest('wannyan_pets', { method: 'POST', body: rows,
      prefer: 'resolution=merge-duplicates,return=minimal' });
    rows.forEach(r => {
      if (r.deleted) { delete state.pets[r.pet_id]; }
      else { state.pets[r.pet_id] = _hash(JSON.stringify(r.data)); }
      delete state.touched[r.pet_id];
    });
  }

  // --- 病院 ---
  const hosps = (await idbGet('wannyan_hospitals_v1')) || [];
  const hRows = [];
  const hSeen = new Set();
  hosps.forEach(h => {
    const id = String(h.id);
    hSeen.add(id);
    const hh = _hash(JSON.stringify(h));
    if (state.hospitals[id] === hh) return;
    hRows.push({ user_id: userId, hospital_id: id, data: h, deleted: false });
  });
  Object.keys(state.hospitals).forEach(id => {
    if (hSeen.has(id)) return;
    hRows.push({ user_id: userId, hospital_id: id, data: {}, deleted: true });
  });

  if (hRows.length) {
    await _rest('wannyan_hospitals', { method: 'POST', body: hRows,
      prefer: 'resolution=merge-duplicates,return=minimal' });
    hRows.forEach(r => {
      if (r.deleted) { delete state.hospitals[r.hospital_id]; }
      else { state.hospitals[r.hospital_id] = _hash(JSON.stringify(r.data)); }
      delete state.touched['h:' + r.hospital_id];
    });
  }
}

// ========== 保存フック（app.js 側は無改造） ==========
// classic script なので関数宣言は window のプロパティ。差し替えれば既存の呼び出しが全部通る。
(function installHooks() {
  const origSaveData = window.saveData;
  const origSaveHospitals = window.saveHospitals;

  window.saveData = async function (data) {
    await origSaveData(data);
    // 未ログイン時は同期を一切しない＝導入前とまったく同じ挙動にする
    if (!sbIsLoggedIn()) return;
    try {
      const state = await _loadSyncState();
      const now = Date.now();
      ['dog', 'cat'].forEach(type => {
        (data[type] || []).forEach(pet => {
          const id = String(pet.id);
          if (state.pets[id] !== _hash(JSON.stringify(pet))) state.touched[id] = now;
        });
      });
      await _saveSyncState(state);
    } catch (e) { /* 同期用のメモが取れなくても保存は成立させる */ }
    scheduleSync();
  };

  window.saveHospitals = async function (list) {
    await origSaveHospitals(list);
    if (!sbIsLoggedIn()) return;
    try {
      const state = await _loadSyncState();
      const now = Date.now();
      (list || []).forEach(h => {
        const id = String(h.id);
        if (state.hospitals[id] !== _hash(JSON.stringify(h))) state.touched['h:' + id] = now;
      });
      await _saveSyncState(state);
    } catch (e) {}
    scheduleSync();
  };
})();

// ========== 同期のきっかけ ==========
window.addEventListener('online', () => scheduleSync(500));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') scheduleSync(300);
});
window.addEventListener('load', () => {
  updateSyncUI();
  scheduleSync(1200);
});

// ========== 画面 ==========
function updateSyncUI() {
  const box = document.getElementById('sync-status');
  if (!box) return;
  const s = sbLoadSession();
  const inBtn = document.getElementById('sync-login-btn');
  const outBtn = document.getElementById('sync-logout-btn');
  const nowBtn = document.getElementById('sync-now-btn');

  if (!s) {
    box.textContent = 'ログインしていません（この端末だけに保存されます）';
    box.className = 'sync-status';
    if (inBtn) inBtn.classList.remove('hidden');
    if (outBtn) outBtn.classList.add('hidden');
    if (nowBtn) nowBtn.classList.add('hidden');
    const rb = document.getElementById('sync-rollback-btn');
    if (rb) rb.classList.add('hidden');
    return;
  }
  if (inBtn) inBtn.classList.add('hidden');
  if (outBtn) outBtn.classList.remove('hidden');
  if (nowBtn) nowBtn.classList.remove('hidden');

  if (_syncing) { box.textContent = '同期中…'; box.className = 'sync-status'; return; }
  if (_lastSyncError) {
    box.textContent = `${s.email}／同期できていません（${_lastSyncError}）`;
    box.className = 'sync-status error';
    return;
  }
  idbGet(SYNC_STATE_KEY).then(st => {
    const t = st && st.lastSyncedAt;
    box.textContent = `${s.email}／最終同期 ${t ? new Date(t).toLocaleString('ja-JP') : 'まだ'}`;
    box.className = 'sync-status ok';
  }).catch(() => {});

  updateRollbackUI();
}

function updateRollbackUI() {
  const btn = document.getElementById('sync-rollback-btn');
  if (!btn) return;
  idbGet(ROLLBACK_KEY).then(snap => {
    if (!snap) { btn.classList.add('hidden'); return; }
    const n = (snap.pets.dog || []).length + (snap.pets.cat || []).length;
    btn.textContent = `取り込み前（${n}匹）に戻す`;
    btn.classList.remove('hidden');
  }).catch(() => {});
}

function openSyncLogin() {
  document.getElementById('sync-email').value = lastLoginEmail();   // 前に使ったアドレスを入れておく
  document.getElementById('sync-password').value = '';
  document.getElementById('sync-login-msg').textContent = '';
  document.getElementById('modal-sync-login').classList.add('open');
}

async function submitSyncLogin(mode) {
  const email = document.getElementById('sync-email').value.trim();
  const password = document.getElementById('sync-password').value;
  const msg = document.getElementById('sync-login-msg');
  if (!email || !password) { msg.textContent = 'メールアドレスとパスワードを入力してください'; return; }
  if (mode === 'signup' && password.length < 8) {
    msg.textContent = 'パスワードは8文字以上にしてください'; return;
  }
  msg.textContent = mode === 'signup' ? '登録中…' : 'ログイン中…';
  try {
    if (mode === 'signup') {
      const r = await sbSignUp(email, password);
      if (r.needsConfirmation) {
        msg.textContent = '確認メールを送りました。リンクを開いてから「ログイン」してください。';
        return;
      }
    } else {
      await sbSignIn(email, password);
    }
    rememberLoginEmail(email);
    closeModal(null, 'modal-sync-login');
    updateSyncUI();
    await syncNow({ toast: true });
  } catch (e) {
    msg.textContent = 'できませんでした：' + (e.message || e);
  }
}

async function doSyncLogout() {
  if (!confirm('ログアウトします。ログインを共有している他のアプリもログアウトになります。\nこの端末のデータはそのまま残ります。よろしいですか？')) return;
  await sbSignOut();
  updateSyncUI();
  showToast('ログアウトしました');
}
