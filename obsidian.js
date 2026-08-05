'use strict';

/* ==========================================================================
   Obsidian 書き出し
   アプリ表示用の省略はせず、保存されている値をそのまま構造化して出力する。
   （あとから見返す／AIに読ませることを目的とした形式）
   ========================================================================== */

// ========== ZIP（無圧縮 store 方式・外部ライブラリ不要） ==========
let _crcTbl = null;
function _crc32(bytes) {
  if (!_crcTbl) {
    _crcTbl = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      _crcTbl[i] = c >>> 0;
    }
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) crc = _crcTbl[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function _dosDateTime(d) {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time: time & 0xFFFF, date: date & 0xFFFF };
}

// files: [{ name:'a/b.md', data:Uint8Array }] → Blob
function buildZip(files) {
  const enc = new TextEncoder();
  const { time, date } = _dosDateTime(new Date());
  const parts = [];
  const central = [];
  let offset = 0;

  files.forEach(f => {
    const nameBytes = enc.encode(f.name);
    const crc = _crc32(f.data);
    const size = f.data.length;

    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // ファイル名 UTF-8
    lv.setUint16(8, 0, true);      // 無圧縮
    lv.setUint16(10, time, true);
    lv.setUint16(12, date, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    parts.push(local, f.data);

    const cd = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, time, true);
    cv.setUint16(14, date, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    cd.set(nameBytes, 46);
    central.push(cd);

    offset += local.length + size;
  });

  const cdSize = central.reduce((s, c) => s + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);

  return new Blob([...parts, ...central, eocd], { type: 'application/zip' });
}

// ========== 小道具 ==========
const _OBS_ENC = new TextEncoder();
function _u8(str) { return _OBS_ENC.encode(str); }

// Obsidian（および iOS / Windows）でファイル名に使えない文字を落とす
function obsFileName(name) {
  return String(name || '無題')
    .replace(/[\\\/:*?"<>|#^\[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || '無題';
}

// [[リンク]] の中で使えない文字を落とす
function obsLink(name) { return obsFileName(name); }

function yamlStr(v) {
  const s = String(v == null ? '' : v);
  if (s === '') return '""';
  if (/^[-?:,\[\]{}#&*!|>'"%@`]|[:#]\s|\s$|^\s|^(true|false|null|yes|no|on|off)$/i.test(s) || /^[\d.+-]+$/.test(s)) {
    return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  }
  return s;
}
function yamlList(arr) {
  const a = (arr || []).filter(x => x !== '' && x != null);
  return a.length ? '[' + a.map(yamlStr).join(', ') + ']' : '[]';
}

// 表のセル内で改行・パイプを壊さない
function cell(v) {
  return String(v == null ? '' : v).replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

function _pad(n) { return String(n).padStart(2, '0'); }
function isoDate(d) { return `${d.getFullYear()}-${_pad(d.getMonth() + 1)}-${_pad(d.getDate())}`; }
function tsToIso(ts) { return ts ? isoDate(new Date(ts)) : ''; }

const OBS_TYPE_LABEL = { dog: '犬', cat: '猫' };
const OBS_CARE_LABEL = { nail: '爪切り', tooth: '歯磨き', flea: 'ノミダニ予防', groom: 'トリミング' };
const OBS_CERT_LABEL = { vaccine: '混合ワクチン予防接種証明書', rabies: '狂犬病予防注射済証', antibody: '抗体価検査証明' };
const OBS_AB_LABEL = {
  dog: ['CDV（ジステンパー）', 'CAV（アデノ）', 'CPV（パルボ）'],
  cat: ['FCV（カリシ）', 'FHV（ヘルペス）', 'FPV（パルボ）'],
};

// dataURL → Uint8Array
function dataUrlToBytes(dataUrl) {
  const comma = String(dataUrl || '').indexOf(',');
  if (comma < 0) return null;
  try {
    const bin = atob(dataUrl.slice(comma + 1));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch (e) { return null; }
}
function dataUrlExt(dataUrl) {
  const m = /^data:image\/([a-z0-9.+-]+)/i.exec(String(dataUrl || ''));
  if (!m) return 'jpg';
  const t = m[1].toLowerCase();
  return t === 'jpeg' ? 'jpg' : t;
}

// ========== ペットノート本文 ==========
function obsPetNote(pet, type, ctx) {
  const L = [];
  const hospName = id => {
    const h = (ctx.hospitals || []).find(x => x.id === id);
    return h ? h.name : '';
  };
  const s = pet.survey || {};
  const ageStr = pet.birthday ? (typeof calcAge === 'function' ? calcAge(pet.birthday) : '') : (pet.age || '');

  // ---- frontmatter ----
  L.push('---');
  L.push(`名前: ${yamlStr(pet.name)}`);
  L.push(`種別: ${yamlStr(OBS_TYPE_LABEL[type] || type)}`);
  L.push(`品種: ${yamlStr(pet.breed || '')}`);
  if (pet.breed === '雑種' && (pet.parent1 || pet.parent2)) {
    L.push(`交配元: ${yamlList([pet.parent1, pet.parent2])}`);
  }
  L.push(`性別: ${yamlStr(pet.gender || '')}`);
  L.push(`生年月日: ${yamlStr(pet.birthday || '')}`);
  L.push(`年齢: ${yamlStr(ageStr || '')}`);
  L.push(`体重kg: ${yamlStr(pet.weight || '')}`);
  L.push(`避妊去勢: ${yamlStr(s.neutered || '')}`);
  L.push(`アレルギー: ${yamlList(s.allergies)}`);
  L.push(`性格: ${yamlList(s.personalities)}`);
  L.push(`散歩道具: ${yamlList(s.walkTools)}`);
  if (pet.familyTag) L.push(`家族: ${yamlStr(pet.familyTag)}`);
  if (pet.familyRole) L.push(`続柄: ${yamlStr(pet.familyRole)}`);
  L.push(`通院件数: ${(pet.medicalRecords || []).length}`);
  L.push(`体重記録数: ${(pet.weightHistory || []).length}`);
  L.push(`更新日: ${yamlStr(tsToIso(pet.updatedAt))}`);
  L.push(`書き出し日: ${yamlStr(isoDate(new Date()))}`);
  L.push(`tags: [わんにゃんメモリー, ${OBS_TYPE_LABEL[type] || type}]`);
  L.push('---');
  L.push('');
  L.push(`# ${ctx.headingName || pet.name}`);
  L.push('');

  if (ctx.includePhotos && pet.photo) {
    L.push(`![[${ctx.photoPathFor(pet)}]]`);
    L.push('');
  }

  // ---- 基本情報 ----
  L.push('## 基本情報');
  L.push('');
  L.push('| 項目 | 内容 |');
  L.push('| --- | --- |');
  const basic = [
    ['名前', pet.name],
    ['種別', OBS_TYPE_LABEL[type] || type],
    [type === 'dog' ? '犬種' : '猫種', pet.breed],
    ['交配元', pet.breed === '雑種' ? [pet.parent1, pet.parent2].filter(Boolean).join(' × ') : ''],
    ['性別', pet.gender],
    ['生年月日', pet.birthday],
    ['年齢', ageStr],
    ['体重', pet.weight ? pet.weight + ' kg' : ''],
    ['家族タグ', pet.familyTag],
    ['続柄', pet.familyRole],
  ];
  basic.forEach(([k, v]) => { if (v) L.push(`| ${cell(k)} | ${cell(v)} |`); });
  L.push('');

  if (pet.memo) {
    L.push('## 全体メモ');
    L.push('');
    L.push(pet.memo);
    L.push('');
  }

  // ---- アンケート ----
  const surveyRows = [
    ['避妊・去勢', s.neutered],
    ['アレルギー', (s.allergies || []).join('、')],
    ['性格', [(s.personalities || []).join('、'), s.personalityFree].filter(Boolean).join(' / ')],
    ['散歩の回数', s.walkCount],
    ['散歩の時間', s.walkTime],
    ['散歩道具', [(s.walkTools || []).join('、'), s.walkToolFree].filter(Boolean).join(' / ')],
    ['トイレ（屋内・家）', s.toiletIndoor],
    ['トイレ（屋外）', s.toiletOutdoor],
    ['トイレ（家以外の屋内）', s.toiletOtherIndoor],
    ['歯磨き', s.dental],
    ['歯磨きメモ', s.dentalNote],
    ['好きなもの', s.likes],
    ['苦手なもの', s.dislikes],
    ['心配ごと', s.concerns],
    ['自由記入', s.free],
  ].filter(([, v]) => v);
  if (surveyRows.length) {
    L.push('## アンケート');
    L.push('');
    L.push('| 項目 | 内容 |');
    L.push('| --- | --- |');
    surveyRows.forEach(([k, v]) => L.push(`| ${cell(k)} | ${cell(v)} |`));
    L.push('');
  }

  // ---- 問題別メモ ----
  const issueDefs = (typeof ISSUES !== 'undefined' && ISSUES[type]) ? ISSUES[type] : [];
  const issueRows = issueDefs
    .map(def => [def.label, ((pet.issues || {})[def.key] || {}).memo || ''])
    .filter(([, memo]) => memo);
  if (issueRows.length) {
    L.push('## 気になること');
    L.push('');
    issueRows.forEach(([label, memo]) => {
      L.push(`### ${label}`);
      L.push('');
      L.push(memo);
      L.push('');
    });
  }

  // ---- 体重推移 ----
  const weights = [...(pet.weightHistory || [])].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (weights.length) {
    L.push('## 体重推移');
    L.push('');
    L.push('| 日付 | 体重(kg) | 前回差 |');
    L.push('| --- | --- | --- |');
    weights.forEach((w, i) => {
      const prev = i > 0 ? Number(weights[i - 1].weight) : null;
      const cur = Number(w.weight);
      let diff = '';
      if (prev != null && !isNaN(prev) && !isNaN(cur)) {
        const d = cur - prev;
        diff = (d > 0 ? '+' : '') + d.toFixed(2);
      }
      L.push(`| ${cell(w.date)} | ${cell(w.weight)} | ${cell(diff)} |`);
    });
    L.push('');
  }

  // ---- 通院履歴 ----
  const recs = [...(pet.medicalRecords || [])].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  if (recs.length) {
    L.push('## 通院履歴');
    L.push('');
    recs.forEach(r => {
      const kind = r.type === 'vaccine' ? 'ワクチン' : '通院';
      L.push(`### ${r.date || '日付不明'}　${kind}${r.vaccineName ? '（' + r.vaccineName + '）' : ''}`);
      L.push('');
      const hn = hospName(r.hospitalId);
      if (hn) L.push(`- 病院: ${ctx.linkHospitals ? `[[${obsLink(hn)}]]` : hn}`);
      if (r.doctor) L.push(`- 担当医: ${r.doctor}`);
      if (r.cost !== '' && r.cost != null) L.push(`- 費用: ${r.cost} 円`);
      if (r.weight !== '' && r.weight != null) L.push(`- 体重: ${r.weight} kg`);
      if (r.vaccineName) L.push(`- ワクチン: ${r.vaccineName}`);
      if (r.antibodyVals) {
        const labels = OBS_AB_LABEL[type] || OBS_AB_LABEL.dog;
        const vals = [r.antibodyVals.val1, r.antibodyVals.val2, r.antibodyVals.val3];
        const ab = labels.map((lb, i) => vals[i] ? `${lb} ${vals[i]}` : '').filter(Boolean).join(' / ');
        if (ab) L.push(`- 抗体価: ${ab}`);
      }
      const cares = Object.keys(OBS_CARE_LABEL).filter(k => (r.cares || {})[k]).map(k => OBS_CARE_LABEL[k]);
      if (cares.length) L.push(`- あわせて実施: ${cares.join('、')}`);
      if (r.notes) {
        L.push('');
        L.push(r.notes);
      }
      L.push('');
    });

    const totalCost = recs.reduce((sum, r) => sum + (Number(r.cost) || 0), 0);
    if (totalCost > 0) {
      L.push(`> 通院費 合計: ${totalCost.toLocaleString('ja-JP')} 円（${recs.length} 件）`);
      L.push('');
    }
  }

  // ---- お薬 ----
  const meds = pet.medicines || [];
  if (meds.length) {
    L.push('## お薬');
    L.push('');
    L.push('| 薬名 | 用量 | 開始 | 終了 | 状態 | メモ |');
    L.push('| --- | --- | --- | --- | --- | --- |');
    meds.forEach(m => {
      L.push(`| ${cell(m.name)} | ${cell(m.dosage || m.usage)} | ${cell(m.startDate)} | ${cell(m.endDate)} | ${cell(m.status)} | ${cell(m.notes)} |`);
    });
    L.push('');
    const withHistory = meds.filter(m => (m.history || []).length > 1);
    if (withHistory.length) {
      L.push('### 処方の変遷');
      L.push('');
      withHistory.forEach(m => {
        L.push(`#### ${m.name}`);
        L.push('');
        L.push('| 記録日 | 用量 | 開始 | 終了 | 状態 |');
        L.push('| --- | --- | --- | --- | --- |');
        (m.history || []).forEach(h => {
          L.push(`| ${cell((h.updatedAt || '').slice(0, 10))} | ${cell(h.dosage)} | ${cell(h.startDate)} | ${cell(h.endDate)} | ${cell(h.status)} |`);
        });
        L.push('');
      });
    }
  }

  // ---- 証明書 ----
  const certs = pet.certificates || {};
  const certKeys = Object.keys(certs).filter(k => certs[k] && certs[k].date);
  if (certKeys.length) {
    L.push('## 証明書');
    L.push('');
    certKeys.forEach(k => {
      const c = certs[k];
      L.push(`### ${OBS_CERT_LABEL[k] || k}`);
      L.push('');
      L.push(`- 日付: ${c.date}`);
      if (c.name) L.push(`- 名称: ${c.name}`);
      if (k === 'antibody') {
        const labels = OBS_AB_LABEL[type] || OBS_AB_LABEL.dog;
        [c.abVal1, c.abVal2, c.abVal3].forEach((v, i) => { if (v) L.push(`- ${labels[i]}: ${v}`); });
      }
      L.push('');
    });
  }

  // ---- 日々のケア ----
  const qc = pet.quickCares || {};
  const qcDates = Object.keys(qc).filter(d => {
    const c = qc[d] || {};
    return c.nail || c.tooth || c.flea || c.groom || c.walkMinutes;
  }).sort();
  const mlogs = pet.medicineLogs || {};
  const medName = id => (meds.find(m => m.id === id) || {}).name || id;

  if (qcDates.length) {
    L.push('## 日々のケア記録');
    L.push('');
    L.push('| 日付 | 爪切り | 歯磨き | ノミダニ | トリミング | 散歩(分) | 散歩の時間帯 |');
    L.push('| --- | --- | --- | --- | --- | --- | --- |');
    qcDates.forEach(d => {
      const c = qc[d] || {};
      L.push(`| ${cell(d)} | ${c.nail ? '○' : ''} | ${c.tooth ? '○' : ''} | ${c.flea ? '○' : ''} | ${c.groom ? '○' : ''} | ${cell(c.walkMinutes || '')} | ${cell((c.walkTimeOfDay || []).join('、'))} |`);
    });
    L.push('');

    const totalWalk = qcDates.reduce((sum, d) => sum + (Number((qc[d] || {}).walkMinutes) || 0), 0);
    if (totalWalk > 0) {
      const h = Math.floor(totalWalk / 60), m = totalWalk % 60;
      L.push(`> 散歩 合計: ${h > 0 ? h + '時間' : ''}${m}分`);
      L.push('');
    }
  }

  const mlogDates = Object.keys(mlogs).filter(d => Object.keys(mlogs[d] || {}).length).sort();
  if (mlogDates.length) {
    L.push('## 投薬記録');
    L.push('');
    L.push('| 日付 | 投薬 |');
    L.push('| --- | --- |');
    mlogDates.forEach(d => {
      const entries = Object.entries(mlogs[d] || {}).map(([id, n]) => `${medName(id)} ×${n}`);
      L.push(`| ${cell(d)} | ${cell(entries.join('、'))} |`);
    });
    L.push('');
  }

  // ---- 次回の相談メモ ----
  const pending = (ctx.pendingNotes || {})[pet.id] || [];
  if (pending.length) {
    L.push('## 次回の相談メモ');
    L.push('');
    pending.forEach(n => {
      const text = typeof n === 'string' ? n : (n.text || n.note || '');
      const date = (typeof n === 'object' && n) ? (n.date || tsToIso(n.createdAt)) : '';
      if (text) L.push(`- ${date ? `（${date}）` : ''}${text}`);
    });
    L.push('');
  }

  return L.join('\n');
}

// ========== 病院ノート ==========
function obsHospitalNote(h) {
  const L = [];
  L.push('---');
  L.push(`病院名: ${yamlStr(h.name)}`);
  if (h.phone) L.push(`電話: ${yamlStr(h.phone)}`);
  if (h.address) L.push(`住所: ${yamlStr(h.address)}`);
  L.push('tags: [わんにゃんメモリー, 動物病院]');
  L.push('---');
  L.push('');
  L.push(`# ${h.name}`);
  L.push('');
  if (h.phone) L.push(`- 電話: ${h.phone}`);
  if (h.address) L.push(`- 住所: ${h.address}`);
  L.push('');
  const docs = h.doctors || [];
  if (docs.length) {
    L.push('## 担当医');
    L.push('');
    docs.forEach(d => L.push(`- ${d.name}${d.memo ? `　${d.memo}` : ''}`));
    L.push('');
  }
  const prices = h.priceList || [];
  if (prices.length) {
    L.push('## 料金');
    L.push('');
    L.push('| 項目 | 金額(円) |');
    L.push('| --- | --- |');
    prices.forEach(p => L.push(`| ${cell(p.name)} | ${cell(p.price)} |`));
    L.push('');
  }
  if (h.memo) {
    L.push('## メモ');
    L.push('');
    L.push(h.memo);
    L.push('');
  }
  return L.join('\n');
}

// ========== デイリーノート ==========
function obsDailyNotes(pets, ctx) {
  const byDate = {}; // date -> { ペットのノート名: [行] }
  const push = (date, petName, line) => {
    if (!date) return;
    if (!byDate[date]) byDate[date] = {};
    if (!byDate[date][petName]) byDate[date][petName] = [];
    byDate[date][petName].push(line);
  };

  pets.forEach(e => {
    const pet = e.pet;
    const noteName = e.fileName || pet.name;
    const meds = pet.medicines || [];
    const medName = id => (meds.find(m => m.id === id) || {}).name || id;
    const hospName = id => {
      const h = (ctx.hospitals || []).find(x => x.id === id);
      return h ? h.name : '';
    };

    (pet.medicalRecords || []).forEach(r => {
      const kind = r.type === 'vaccine' ? 'ワクチン' : '通院';
      const bits = [];
      const hn = hospName(r.hospitalId);
      if (hn) bits.push(ctx.linkHospitals ? `[[${obsLink(hn)}]]` : hn);
      if (r.doctor) bits.push(r.doctor);
      if (r.vaccineName) bits.push(r.vaccineName);
      if (r.cost !== '' && r.cost != null) bits.push(`${r.cost}円`);
      push(r.date, noteName, `- **${kind}**${bits.length ? '　' + bits.join(' / ') : ''}`);
      if (r.notes) push(r.date, noteName, `    - ${r.notes.replace(/\r?\n/g, '\n    - ')}`);
    });

    (pet.weightHistory || []).forEach(w => {
      push(w.date, noteName, `- **体重** ${w.weight} kg`);
    });

    Object.entries(pet.quickCares || {}).forEach(([date, c]) => {
      const done = Object.keys(OBS_CARE_LABEL).filter(k => c[k]).map(k => OBS_CARE_LABEL[k]);
      if (done.length) push(date, noteName, `- **ケア** ${done.join('、')}`);
      if (c.walkMinutes) {
        const tod = (c.walkTimeOfDay || []).join('、');
        push(date, noteName, `- **散歩** ${c.walkMinutes}分${tod ? `（${tod}）` : ''}`);
      }
    });

    Object.entries(pet.medicineLogs || {}).forEach(([date, logs]) => {
      const entries = Object.entries(logs || {}).map(([id, n]) => `${medName(id)} ×${n}`);
      if (entries.length) push(date, noteName, `- **投薬** ${entries.join('、')}`);
    });

    Object.entries(pet.certificates || {}).forEach(([k, c]) => {
      if (c && c.date) push(c.date, noteName, `- **証明書** ${OBS_CERT_LABEL[k] || k}${c.name ? `（${c.name}）` : ''}`);
    });
  });

  return Object.keys(byDate).sort().map(date => {
    const L = ['---', `日付: ${date}`, 'tags: [わんにゃんメモリー, 記録]', '---', '', `# ${date}`, ''];
    Object.keys(byDate[date]).sort().forEach(petName => {
      L.push(`## [[${obsLink(petName)}]]`);
      L.push('');
      byDate[date][petName].forEach(l => L.push(l));
      L.push('');
    });
    return { date, body: L.join('\n') };
  });
}

// ========== 索引ノート ==========
function obsIndexNote(entries, hospitals, opts) {
  const link = !opts || opts.link !== false;
  const ref = name => link ? `[[${obsLink(name)}]]` : name;
  const L = [];
  L.push('---');
  L.push('tags: [わんにゃんメモリー, 索引]');
  L.push(`書き出し日: ${isoDate(new Date())}`);
  L.push('---');
  L.push('');
  L.push('# わんにゃんメモリー');
  L.push('');
  L.push(`書き出し日時: ${new Date().toLocaleString('ja-JP')}`);
  L.push('');
  ['dog', 'cat'].forEach(type => {
    const list = entries.filter(e => e.type === type);
    if (!list.length) return;
    L.push(`## ${OBS_TYPE_LABEL[type]}（${list.length}匹）`);
    L.push('');
    L.push('| 名前 | 品種 | 性別 | 生年月日 | 通院 | 体重記録 |');
    L.push('| --- | --- | --- | --- | --- | --- |');
    list.forEach(e => {
      const pet = e.pet;
      L.push(`| ${ref(e.fileName || pet.name)} | ${cell(pet.breed)} | ${cell(pet.gender)} | ${cell(pet.birthday)} | ${(pet.medicalRecords || []).length} | ${(pet.weightHistory || []).length} |`);
    });
    L.push('');
  });
  if (hospitals.length) {
    L.push('## 動物病院');
    L.push('');
    hospitals.forEach(h => L.push(`- ${ref(h.name)}`));
    L.push('');
  }
  return L.join('\n');
}

// ========== 書き出す子の選択 ==========
// 「データの引き継ぎ」を開いたときに一覧を作る
async function renderObsPickList() {
  const box = document.getElementById('obs-pick-list');
  if (!box) return;
  const data = await loadData();
  const entries = [];
  ['dog', 'cat'].forEach(type => (data[type] || []).forEach(pet => entries.push({ pet, type })));

  if (!entries.length) {
    box.innerHTML = '<div class="obs-pick-empty">登録されている子がいません</div>';
    return;
  }
  // 既存のチェック状態は保つ（初回は全選択）
  const prev = {};
  box.querySelectorAll('input[data-pet-id]').forEach(i => { prev[i.dataset.petId] = i.checked; });

  box.innerHTML = entries.map(e => {
    const id = escHtml(String(e.pet.id));
    const on = prev[String(e.pet.id)] !== false;
    return `<label class="obs-pick-item">
      <input type="checkbox" data-pet-id="${id}" data-pet-type="${e.type}" ${on ? 'checked' : ''}>
      <span class="obs-pick-name">${escHtml(e.pet.name || '無題')}</span>
      <span class="obs-pick-type">${OBS_TYPE_LABEL[e.type]}</span>
    </label>`;
  }).join('');
}

// 「データの引き継ぎ」を開いたら一覧を作り直す（app.js は無改造のままフックする）
(function hookTransferModal() {
  const orig = window.openTransferModal;
  if (typeof orig !== 'function') return;
  window.openTransferModal = function () {
    orig.apply(this, arguments);
    renderObsPickList();
    if (typeof updateSyncUI === 'function') updateSyncUI();
  };
})();

function obsPickAll(on) {
  document.querySelectorAll('#obs-pick-list input[data-pet-id]').forEach(i => { i.checked = on; });
}

function obsSelectedIds() {
  const boxes = document.querySelectorAll('#obs-pick-list input[data-pet-id]');
  if (!boxes.length) return null; // 一覧が無ければ絞り込まない
  return new Set([...boxes].filter(i => i.checked).map(i => i.dataset.petId));
}

// ========== 書き出し本体 ==========
async function exportObsidian() {
  const fmtEl = document.querySelector('input[name="obs-format"]:checked');
  const format = fmtEl ? fmtEl.value : 'per-pet';
  const includePhotos = !!(document.getElementById('obs-photos') || {}).checked;

  const data = await loadData();
  const hospitals = await loadHospitals();
  const pendingNotes = (typeof loadPendingNotes === 'function') ? loadPendingNotes() : {};

  // 一覧を作りつつ、同名のペットにはファイル名で種別を足して衝突を避ける
  const picked = obsSelectedIds();
  const flat = [];
  ['dog', 'cat'].forEach(type => {
    (data[type] || []).forEach(pet => {
      if (picked && !picked.has(String(pet.id))) return;
      flat.push({ pet, type });
    });
  });

  if (!flat.length) {
    alert(picked && picked.size === 0
      ? '書き出す子が選ばれていません。'
      : '書き出せるデータがありません。');
    return;
  }

  // 一部の子だけ選んだときは、その子が通った病院だけに絞る。
  // 全員書き出すときは、まだ通っていない病院も情報として残す。
  const totalPets = (data.dog || []).length + (data.cat || []).length;
  let outHospitals = hospitals;
  if (flat.length < totalPets) {
    const usedHospitalIds = new Set();
    flat.forEach(e => (e.pet.medicalRecords || []).forEach(r => {
      if (r.hospitalId) usedHospitalIds.add(r.hospitalId);
    }));
    outHospitals = hospitals.filter(h => usedHospitalIds.has(h.id));
  }

  // 同名がいたら「名前（犬）」、種別まで同じならさらに連番を足す
  const nameCount = {};
  flat.forEach(e => { const n = obsFileName(e.pet.name); nameCount[n] = (nameCount[n] || 0) + 1; });
  const used = {};
  flat.forEach(e => {
    const base = obsFileName(e.pet.name);
    if (nameCount[base] === 1) { e.fileName = base; return; }
    const suffix = OBS_TYPE_LABEL[e.type] || e.type;
    const key = `${base}（${suffix}）`;
    used[key] = (used[key] || 0) + 1;
    e.fileName = used[key] === 1 ? key : `${base}（${suffix}${used[key]}）`;
  });

  const ctx = {
    hospitals: outHospitals,
    pendingNotes,
    includePhotos,
    linkHospitals: format !== 'single',
    photoPathFor: pet => {
      const e = flat.find(x => x.pet === pet);
      return `attachments/${e ? e.fileName : obsFileName(pet.name)}.${dataUrlExt(pet.photo)}`;
    },
  };

  const stamp = isoDate(new Date()).replace(/-/g, '');

  // ---- 単一ファイル ----
  if (format === 'single') {
    // 先頭以外の frontmatter は無効なので落とす
    const stripFm = md => md.replace(/^---[\s\S]*?\n---\n/, '');
    // 見出しを1段下げる（別ノートだったものを1ファイルに入れ子にするため）
    const demote = md => md.replace(/^(#{1,5}) /gm, '#$1 ');

    const parts = [];
    parts.push(obsIndexNote(flat, outHospitals, { link: false }));
    flat.forEach(e => {
      parts.push('\n---\n');
      parts.push(stripFm(obsPetNote(e.pet, e.type, { ...ctx, includePhotos: false, headingName: e.fileName })));
    });
    if (outHospitals.length) {
      parts.push('\n---\n');
      parts.push('# 動物病院\n');
      outHospitals.forEach(h => parts.push(demote(stripFm(obsHospitalNote(h)))));
    }
    const blob = new Blob([parts.join('\n')], { type: 'text/markdown;charset=utf-8' });
    await shareOrDownload(blob, `わんにゃんメモリー_${stamp}.md`);
    return;
  }

  // ---- ZIP（1匹1ノート、必要ならデイリーノートも） ----
  const files = [];
  files.push({ name: 'わんにゃんメモリー.md', data: _u8(obsIndexNote(flat, outHospitals)) });

  flat.forEach(e => {
    files.push({ name: `ペット/${e.fileName}.md`, data: _u8(obsPetNote(e.pet, e.type, ctx)) });
    if (includePhotos && e.pet.photo) {
      const bytes = dataUrlToBytes(e.pet.photo);
      if (bytes) files.push({ name: `attachments/${e.fileName}.${dataUrlExt(e.pet.photo)}`, data: bytes });
    }
  });

  outHospitals.forEach(h => {
    if (!h || !h.name) return;
    files.push({ name: `病院/${obsFileName(h.name)}.md`, data: _u8(obsHospitalNote(h)) });
  });

  if (format === 'per-pet-daily') {
    obsDailyNotes(flat, ctx).forEach(d => {
      files.push({ name: `記録/${d.date}.md`, data: _u8(d.body) });
    });
  }

  const zip = buildZip(files);
  await shareOrDownload(zip, `わんにゃんメモリー_obsidian_${stamp}.zip`);
}

// ========== 保存（iOS は共有シート、他はダウンロード） ==========
async function shareOrDownload(blob, fileName) {
  const type = blob.type || 'application/octet-stream';
  if (navigator.share && navigator.canShare) {
    try {
      const file = new File([blob], fileName, { type });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'わんにゃんメモリー' });
        showToast('書き出しました ✓');
        return;
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return; // ユーザーがキャンセル
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  showToast('書き出しました ✓');
}
