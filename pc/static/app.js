'use strict';

// ---------- 定数 ----------

const ALL_CLUBS = [
  { id: '1W', name: 'ドライバー', defaultYd: 220 },
  { id: '3W', name: '3W', defaultYd: 200 },
  { id: '5W', name: '5W', defaultYd: 185 },
  { id: 'UT', name: 'UT', defaultYd: 175 },
  { id: '4I', name: '4I', defaultYd: 170 },
  { id: '5I', name: '5I', defaultYd: 160 },
  { id: '6I', name: '6I', defaultYd: 150 },
  { id: '7I', name: '7I', defaultYd: 140 },
  { id: '8I', name: '8I', defaultYd: 130 },
  { id: '9I', name: '9I', defaultYd: 120 },
  { id: 'PW', name: 'PW', defaultYd: 110 },
  { id: 'AW', name: 'AW', defaultYd: 95 },
  { id: 'SW', name: 'SW', defaultYd: 80 },
  { id: 'LW', name: 'LW', defaultYd: 60 },
];
const DEFAULT_BAG = ['1W', '3W', 'UT', '5I', '6I', '7I', '8I', '9I', 'PW', 'AW', 'SW'];

const DRILLS = [
  { id: 'putt-1m', cat: 'パター', name: '1m ショートパット', target: 20,
    desc: 'カップから1m。20球中何球入るか。プロは95%以上が目安。' },
  { id: 'putt-circle', cat: 'パター', name: 'サークルドリル', target: 12,
    desc: 'カップを中心に半径1.5mの円周上に12球。一周連続で入れられるか。' },
  { id: 'putt-lag', cat: 'パター', name: '10m 距離感', target: 10,
    desc: '10mから打ち、カップから半径1m以内に止まれば成功。' },
  { id: 'chip-3m', cat: 'アプローチ', name: '寄せワン', target: 10,
    desc: 'グリーン外から。カップから1歩(約1m)以内に寄れば成功。' },
  { id: 'pitch-30y', cat: 'アプローチ', name: '30ヤード キャリー', target: 10,
    desc: '30ヤード先の目標に対し、前後3ヤード以内のキャリーで成功。' },
  { id: 'bunker', cat: 'バンカー', name: 'バンカー脱出', target: 10,
    desc: '1回でグリーンに乗れば成功。' },
  { id: 'iron-target', cat: 'ショット', name: 'ターゲット狙い (7I)', target: 10,
    desc: '目標から左右10ヤード以内に打ち出せたら成功。' },
  { id: 'driver-fairway', cat: 'ショット', name: 'フェアウェイキープ (1W)', target: 14,
    desc: '30ヤード幅のフェアウェイを想定。14球(1ラウンド分)で何回キープできるか。' },
];


// 苦手 (FOCUS_OPTIONS) ごとのドリル。成功・失敗は自分で判定して記録する
const FOCUS_DRILLS = [
  { id: 'f-rise-wall', focus: 'rise', cat: '体が起きる', name: '壁にお尻をつけて素振り', target: 10,
    desc: '壁を背にアドレスし、お尻を壁に軽く当てる。ハーフスイングで振って、インパクトまでお尻が壁から離れず、頭の高さも変わらなければ成功。' },
  { id: 'f-rise-chest', focus: 'rise', cat: '体が起きる', name: '胸を下に向けたまま打つ', target: 10,
    desc: '7I のハーフスイング。インパクトのあとも胸が地面（ボールのあった所）を向いたまま、顔が先に上がらなければ成功。' },
  { id: 'f-hip-chair', focus: 'hip', cat: 'お尻が前に出る', name: 'お尻のうしろに椅子（バッグ）', target: 10,
    desc: 'お尻のすぐ後ろに椅子の背かキャディバッグを置いて構える。ダウンスイングで右のお尻がそれに触れたまま振れたら成功（前に出ると離れる）。' },
  { id: 'f-hip-knee', focus: 'hip', cat: 'お尻が前に出る', name: '両ひざの角度キープ', target: 10,
    desc: 'ハーフスイングで、インパクトまで両ひざの曲がりがアドレスと同じなら成功。ひざが伸びると腰が前に出やすい。' },
  { id: 'f-head-shadow', focus: 'head', cat: '頭が動く', name: '頭の位置キープ（影・スマホ）', target: 10,
    desc: '影か、正面に置いたスマホの画面で頭を見る。テークバックからインパクトまで、頭が左右に動かなければ成功。' },
  { id: 'f-arm-left', focus: 'arm', cat: '左腕が曲がる', name: '左手1本でハーフスイング', target: 10,
    desc: '左手だけで短く持ってハーフスイング。トップで左ひじが伸びたまま、ボールに当てられたら成功。' },
  { id: 'f-arm-wide', focus: 'arm', cat: '左腕が曲がる', name: '大きく上げて浅いトップ', target: 10,
    desc: '左腕を伸ばしたまま、上げられるところで止める（肩より少し上で十分）。浅くても左腕がまっすぐなトップで打てたら成功。' },
  { id: 'f-tempo-pause', focus: 'tempo', cat: '打ち急ぐ（テンポ）', name: 'トップで1秒止めて打つ', target: 10,
    desc: '「イチ（上げる）・ニ（止める）・サン（打つ）」のリズム。トップで止まってから、力まずに振り下ろせたら成功。' },
  { id: 'f-setup-club', focus: 'setup', cat: 'アドレスの前傾', name: 'クラブを背中に当てて前傾', target: 5,
    desc: 'クラブを背中に縦に当て、頭・背中・お尻の3点をつけたまま股関節から前に倒す。3点が離れずにその番手の前傾（ドライバー約30°、PW 約40°）が作れたら成功。' },
  { id: 'f-finish-hold', focus: 'finish', cat: 'フィニッシュの体重', name: 'フィニッシュで3秒止まる', target: 10,
    desc: '打ったあと、左足1本に乗って3秒止まる（右足はつま先だけ）。ふらつかずに止まれたら成功。' },
];
function allDrills() { return [...DRILLS, ...FOCUS_DRILLS]; }

const DIR_LABEL = { left: '左', center: 'センター', right: '右' };
const CONTACT_LABEL = { good: 'ナイス', fat: 'ダフリ', thin: 'トップ', toe: '先・ヒール' };

// server.py の APP_VERSION と同じ番号にする
const APP_VERSION = 30;

// ---------- 状態 ----------
function defaultState() {
  return { bag: [...DEFAULT_BAG], sessions: [], drillResults: [], swings: [], notes: [], feels: [], theme: null, focus: null, active: null };
}

// 古い形式のデータを今の形式にそろえる
function normalizeState(data) {
  const st = { ...defaultState(), ...data };
  if (Array.isArray(data.analyses)) {
    st.swings = [...st.swings, ...data.analyses.map((a) => ({ id: String(a.at), swings: [], ...a }))];
    delete st.analyses;
  }
  st.drillResults = st.drillResults.map((r) => ({ ...r, id: String(r.id ?? r.at) }));
  st.sessions = st.sessions.map((x) => ({ ...x, id: String(x.id) }));
  st.swings = st.swings.map((w) => ({ ...w, id: String(w.id) }));
  st.notes = (st.notes || []).map((n) => ({ ...n, id: String(n.id) }));
  st.feels = (st.feels || []).map((f) => ({ ...f, id: String(f.id) }));
  return st;
}

// ---------- パソコンのサーバーとのやりとり ----------
let state = defaultState();
let config = {};
let selectedClub = null;
let lastDistanceByClub = {};
let drillRun = null;
let writeQueue = Promise.resolve();
let profileQueued = false;
let saveErrorShown = false;

async function api(path, opts = {}) {
  let res;
  try {
    res = await fetch(path, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  } catch {
    throw new Error('パソコンにつながりません。パソコンでアプリが動いているか、Tailscale がオンか確認してください。');
  }
  let data = null;
  try { data = await res.json(); } catch { /* 本文なし */ }
  if (!res.ok) throw new Error(data?.error || `エラーが起きました (${res.status})`);
  return data;
}

function post(path, body) {
  return api(path, { method: 'POST', body: JSON.stringify(body || {}) });
}

// kind: 'profile' | 'session' | 'deleteSession' | 'drill' | 'swing' | 'deleteSwing'
// 同じ記録への書き込みが前後しないよう、1本の列で順番に送る
function save(kind = 'profile', item) {
  if (kind === 'profile') {
    if (profileQueued) return writeQueue;
    profileQueued = true;
  }
  writeQueue = writeQueue.then(() => {
    if (kind === 'profile') {
      profileQueued = false;
      item = { bag: state.bag, active: state.active, theme: state.theme || null, focus: state.focus || null, scoring: state.scoring || null };
    }
    return post('api/save', { kind, item });
  }).catch((e) => {
    console.error(e);
    if (!saveErrorShown) {
      saveErrorShown = true;
      toast(/unknown kind/.test(e.message) ? OLD_SERVER_MSG
        : e.message.startsWith('パソコンにつながりません') ? '保存できませんでした。パソコンにつながっているか確認してください'
          : `保存できませんでした: ${e.message}`);
      setTimeout(() => { saveErrorShown = false; }, 5000);
    }
  });
  return writeQueue;
}

async function reloadState() {
  const st = await api('api/state');
  config = st.config || {};
  delete st.config;
  state = normalizeState({ ...st, bag: st.bag || [...DEFAULT_BAG] });
  checkServerVersion();
}

const OLD_SERVER_MSG = 'パソコンで動いているアプリが古いままです。start.bat の黒い画面を閉じてから、もう一度 start.bat を起動してください。';

// ZIP を上書きしても、start.bat を起動し直すまでは古いサーバーが動き続ける
function checkServerVersion() {
  if (config.version === APP_VERSION) return;
  $('#offline-msg').textContent = OLD_SERVER_MSG;
  $('#offline').hidden = false;
}



// ---------- はじめての設定 (配布版で初めて開いたとき) ----------
function maybeShowSetup() {
  if (config.setupDone || !$('#setup')) return;
  $('#setup-height').value = config.heightCm || 170;
  $('#setup-lefty').checked = !!config.lefty;
  $('#setup').hidden = false;
}
async function finishSetup() {
  const body = { setupDone: true, heightCm: Number($('#setup-height').value) || 170, lefty: $('#setup-lefty').checked };
  const key = $('#setup-key').value.trim();
  if (key) body.apiKey = key;
  try {
    await post('api/config', body);
    await reloadState();
    $('#setup').hidden = true;
    renderAll();
    toast(key ? '準備ができました。動画タブから動画を送ってみましょう' : '準備ができました。AI分析は設定タブでキーを入れると使えます');
  } catch (e) {
    toast(e.message);
  }
}
function renderLan() {
  if (!$('#lan-input')) return;
  $('#lan-input').checked = !!config.lanAccess;
  $('#lan-url').replaceChildren(config.lanUrl
    ? el('span', {}, 'スマホのブラウザでこのアドレスを開いてください: ', el('b', {}, config.lanUrl), '（ホーム画面に追加すると便利です）')
    : '');
}
async function setLan(on) {
  try {
    const r = await post('api/config', { lanAccess: on });
    if (r.restart) {
      toast('設定を変えたので、アプリを起動し直しています…');
      const wait = async () => {
        try { await reloadState(); renderSettings(); toast(on ? 'スマホから使えるようになりました' : 'スマホからは使えないようにしました'); return; } catch { /* 起動し直している途中 */ }
        setTimeout(wait, 2000);
      };
      setTimeout(wait, 3000);
    } else {
      await reloadState();
      renderSettings();
    }
  } catch (e) {
    toast(e.message);
  }
}

// ---------- アプリの更新 (GitHub から新しい版を入れて、自動で起動し直す) ----------
let updateInfo = null; // { current, latest }
async function checkUpdate(manual = false) {
  if (!config.hasGithubToken) {
    updateInfo = null;
    renderUpdate(manual ? 'トークンを保存すると、更新を確かめられます。' : '');
    return;
  }
  try {
    updateInfo = await api('api/update');
    renderUpdate(manual && updateInfo.latest <= updateInfo.current ? 'いまが最新の版です。' : '');
  } catch (e) {
    updateInfo = null;
    renderUpdate(e.message);
  }
}
function renderUpdate(msg = '') {
  const pub = !!config.publicUpdates;
  for (const id of ['github-token-input', 'btn-github-token']) { const n = document.getElementById(id); if (n) (n.closest('label') || n).hidden = pub; }
  const how = $('#update-card details'); if (how) how.hidden = pub;
  const has = updateInfo && updateInfo.latest > updateInfo.current;
  $('#update-banner').hidden = !has;
  if (has) $('#update-msg').textContent = `新しい版（${updateInfo.latest}）があります。今は ${updateInfo.current} です。`;
  const box = $('#update-status');
  if (!box) return;
  box.replaceChildren(...[
    msg ? el('p', {}, msg) : null,
    config.hasGithubToken ? el('div', { class: 'cand-btns' },
      el('button', { type: 'button', class: 'btn small', onclick: () => checkUpdate(true) }, '更新を確かめる'),
      has ? el('button', { type: 'button', class: 'btn small primary', onclick: applyUpdate }, `版 ${updateInfo.latest} に更新する`) : null) : null,
    !config.launcher && config.hasGithubToken ? el('p', { class: 'muted tiny' }, '自動で起動し直すには、一度だけ新しい start.bat で起動し直してください。') : null].filter(Boolean));
}
async function applyUpdate() {
  if (!(await askConfirm('新しい版を入れて、アプリを起動し直します（10〜30秒ほど）。記録はそのままです。始めますか？', '更新する'))) return;
  const old = config.version;
  toast('新しい版を取り込んでいます…');
  let res;
  try {
    res = await post('api/update', {});
  } catch (e) {
    toast(e.message);
    return;
  }
  (res.notes || []).forEach((n) => toast(n));
  $('#update-msg').textContent = '起動し直しています…（終わると自動で画面を読み直します）';
  $('#update-banner').hidden = false;
  const started = Date.now();
  const wait = async () => {
    try {
      const st = await api('api/state');
      if (st.config?.version && st.config.version !== old) { location.reload(); return; }
    } catch { /* 起動し直している途中 */ }
    if (Date.now() - started > 180000) { $('#update-msg').textContent = '起動し直すのに時間がかかっています。黒い画面を確かめてください。'; return; }
    setTimeout(wait, 2000);
  };
  setTimeout(wait, 3000);
}

// ---------- ユーティリティ ----------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue; // 付けない属性 (disabled: null などで付いてしまわないように)
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (k === 'style') node.style.cssText = v;
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 1600);
}

// ブラウザ標準の confirm() が使えない環境があるため、画面内の確認ダイアログを使う
function askConfirm(message, okLabel = 'OK') {
  return new Promise((resolve) => {
    const dlg = $('#confirm');
    $('#confirm-msg').textContent = message;
    $('#confirm-ok').textContent = okLabel;
    dlg.hidden = false;
    $('#confirm-ok').focus();
    const done = (v) => {
      dlg.hidden = true;
      $('#confirm-ok').onclick = $('#confirm-cancel').onclick = null;
      resolve(v);
    };
    $('#confirm-ok').onclick = () => done(true);
    $('#confirm-cancel').onclick = () => done(false);
  });
}

function fmtDate(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function clubName(id) {
  return (ALL_CLUBS.find((c) => c.id === id) || { name: id }).name;
}

function clubOrder(id) {
  const i = ALL_CLUBS.findIndex((c) => c.id === id);
  return i < 0 ? 999 : i;
}

function mean(xs) { return xs.reduce((a, b) => a + b, 0) / xs.length; }
function stdev(xs) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

function pickerValue(id) {
  const s = $(`#${id} .chip.selected`);
  return s ? s.dataset.value : null;
}

function setupSingleSelect(container, allowNone = false) {
  container.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip || !container.contains(chip)) return;
    const was = chip.classList.contains('selected');
    container.querySelectorAll('.chip').forEach((c) => c.classList.remove('selected'));
    if (!(allowNone && was)) chip.classList.add('selected');
  });
}

// ---------- 集計 ----------
// 未入力 (null) と「わからない」は、距離や方向の集計に入れない
function summarizeShots(shots) {
  const byClub = {};
  for (const s of shots) {
    (byClub[s.club] ||= []).push(s);
  }
  return Object.entries(byClub)
    .sort((a, b) => clubOrder(a[0]) - clubOrder(b[0]))
    .map(([club, list]) => {
      const judged = list.filter((s) => s.contact && s.contact !== 'unknown');
      const good = judged.filter((s) => s.contact === 'good');
      const dists = list.filter((s) => s.distance != null && (s.contact == null || s.contact === 'good' || s.contact === 'unknown'))
        .map((s) => s.distance);
      const dir = { left: 0, center: 0, right: 0 };
      list.forEach((s) => { if (s.direction in dir) dir[s.direction]++; });
      const felt = list.filter((s) => s.feel === 'good' || s.feel === 'meh');
      return {
        club,
        count: list.length,
        goodRate: judged.length ? good.length / judged.length : null,
        feelRate: felt.length ? list.filter((s) => s.feel === 'good').length / felt.length : null,
        avg: dists.length ? mean(dists) : null,
        distCount: dists.length,
        max: dists.length ? Math.max(...dists) : null,
        sd: stdev(dists),
        dir,
      };
    });
}

function dirBar(dir, total) {
  total = dir.left + dir.center + dir.right;
  if (!total) return el('span', { class: 'muted' }, '—');
  const pct = (n) => `${(n / total) * 100}%`;
  return el('div', { class: 'bar', title: `左${dir.left} / 中${dir.center} / 右${dir.right}` },
    el('span', { class: 'l', style: `width:${pct(dir.left)}` }),
    el('span', { class: 'c', style: `width:${pct(dir.center)}` }),
    el('span', { class: 'r', style: `width:${pct(dir.right)}` }));
}

function statsTable(rows, { showMax = true } = {}) {
  if (!rows.length) return el('div', { class: 'empty' }, 'まだ記録がありません');
  const r = (n) => (n == null ? '—' : Math.round(n));
  const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);
  return el('table', {},
    el('thead', {}, el('tr', {},
      el('th', {}, 'クラブ'), el('th', {}, '記録'), el('th', {}, 'いい感触'), el('th', {}, '平均'),
      showMax ? el('th', {}, '最大') : null, el('th', {}, 'ばらつき'),
      el('th', {}, 'ナイス率'), el('th', { style: 'width:20%' }, '左/中/右'))),
    el('tbody', {}, rows.map((s) => el('tr', {},
      el('td', {}, el('b', {}, clubName(s.club))),
      el('td', {}, s.count),
      el('td', {}, pct(s.feelRate)),
      el('td', {}, r(s.avg), s.avg != null ? el('div', { class: 'tiny muted' }, `距離入力 ${s.distCount}球`) : null),
      showMax ? el('td', {}, r(s.max)) : null,
      el('td', {}, s.avg == null ? '—' : `±${r(s.sd)}`),
      el('td', {}, pct(s.goodRate)),
      el('td', {}, dirBar(s.dir, s.count))))));
}

// ---------- 練習タブ ----------
function renderPractice() {
  const active = state.active;
  $('#session-idle').hidden = !!active;
  $('#session-active').hidden = !active;
  renderTheme();
  renderFeels();
  renderTendency();
  renderCoach();
  if (!active) return;

  const good = active.shots.filter((s) => s.feel === 'good').length;
  $('#session-info').textContent =
    `${active.place || '練習'} ・ ${fmtDate(active.startedAt)} ・ ${active.shots.length}球記録${good ? `（いい感触 ${good}）` : ''}`;

  const picker = $('#club-picker');
  picker.replaceChildren(...state.bag
    .slice().sort((a, b) => clubOrder(a) - clubOrder(b))
    .map((id) => el('button', {
      type: 'button',
      class: 'chip' + (id === selectedClub ? ' selected' : ''),
      onclick: () => selectClub(id),
    }, clubName(id))));

  const last = active.shots[active.shots.length - 1];
  $('#last-shot').textContent = last ? `直前: ${shotText(last)}` : 'まだ記録していません';
  $('#session-summary').replaceChildren(statsTable(summarizeShots(active.shots), { showMax: false }),
    el('p', { class: 'muted tiny' }, '記録した球だけの集計です。距離・方向・当たりは入力した球だけで数えます。'));
  $('#btn-undo').disabled = active.shots.length === 0;
}

// ---------- 今日意識すること (次回のテーマ) ----------
function setTheme(text, source) {
  text = String(text || '').trim();
  state.theme = text ? { text, source: source || '', at: Date.now() } : null;
  save();
  renderTheme();
  toast(text ? '次の練習のテーマにしました（練習タブに出ます）' : 'テーマを消しました');
}

function editTheme() {
  const box = $('#session-active').hidden ? $('#theme-box-idle') : $('#theme-box-active');
  const input = el('input', { type: 'text', class: 'theme-input', value: state.theme?.text || '', placeholder: '例: トップで一度止まるリズム' });
  box.replaceChildren(el('div', { class: 'small strong' }, '今日意識すること'), input,
    el('div', { class: 'cand-btns' },
      el('button', { type: 'button', class: 'btn small primary', onclick: () => setTheme(input.value, 'manual') }, '保存'),
      el('button', { type: 'button', class: 'btn small', onclick: renderTheme }, 'やめる')));
  input.focus();
}

function renderTheme() {
  const t = state.theme;
  const view = (compact) => el('div', {},
    el('div', { class: 'row-between' },
      el('span', { class: 'small strong' }, '今日意識すること'),
      el('span', { class: 'cand-btns' },
        el('button', { type: 'button', class: 'btn small', onclick: editTheme }, t ? '変更' : '決める'),
        t && !compact ? el('button', { type: 'button', class: 'btn small', onclick: () => setTheme('') }, '消す') : null)),
    el('div', { class: t ? 'theme-text' : 'muted small' }, t ? t.text : '今日は自由に練習（振り返りノートやAI分析から、次のテーマを1つ選べます）'));
  $('#theme-box-idle').replaceChildren(view(false));
  $('#theme-box-active').replaceChildren(view(true));
}

// 文章の「## 見出し」の下の最初の箇条書き (または最初の行) を取り出す
function firstItemUnder(text, heading) {
  const m = String(text || '').match(new RegExp(`##\\s*${heading}[^\\n]*\\n([\\s\\S]*?)(?=\\n##|$)`));
  if (!m) return null;
  const line = m[1].split('\n').map((x) => x.trim()).find((x) => x);
  return line ? line.replace(/^[-*・]\s*/, '').replace(/\*\*/g, '').slice(0, 120) : null;
}

// ---------- 苦手・得意の傾向 (姿勢の計測から・AIなし) ----------
function tendencyStats(swings) {
  const by = {};
  for (const sw of swings) {
    for (const it of sw.pose?.items || []) {
      if (!(it.grade in GRADE_POINTS)) continue;
      const k = it.key || it.label;
      const e = (by[k] ||= { label: shortLabel(it.label), n: 0, good: 0, bad: 0, pts: 0 });
      e.n++; e.pts += GRADE_POINTS[it.grade];
      if (it.grade === '◎') e.good++;
      if (it.grade === '△') e.bad++;
    }
  }
  return by;
}

function computeTendency() {
  const all = (state.swings || []).flatMap((rec) => (rec.swings || []).map((sw) => ({ rec, sw })))
    .filter((x) => x.sw.pose?.items?.length)
    .sort((a, b) => swingTime(b.rec, b.sw) - swingTime(a.rec, a.sw));
  if (all.length < 3) return null;
  const recent = all.slice(0, 30);
  const older = all.slice(30, 90);
  const now = tendencyStats(recent.map((x) => x.sw));
  const before = tendencyStats(older.map((x) => x.sw));
  const rows = Object.entries(now).filter(([, e]) => e.n >= 3).map(([k, e]) => {
    const avg = e.pts / e.n;
    const b = before[k];
    return { key: k, label: e.label, n: e.n, goodRate: e.good / e.n, badRate: e.bad / e.n, avg,
      diff: b && b.n >= 3 ? avg - b.pts / b.n : null };
  });
  const strong = rows.filter((r) => r.goodRate >= 0.5).sort((a, b) => b.avg - a.avg).slice(0, 3);
  const weak = rows.filter((r) => r.badRate >= 0.3).sort((a, b) => a.avg - b.avg).slice(0, 3);
  const up = rows.filter((r) => r.diff != null && r.diff >= 10).sort((a, b) => b.diff - a.diff).slice(0, 2);
  const down = rows.filter((r) => r.diff != null && r.diff <= -10).sort((a, b) => a.diff - b.diff).slice(0, 2);
  const feel = (state.sessions || []).slice(0, 10).flatMap((s) => s.shots || []).filter((s) => s.feel === 'good' || s.feel === 'meh');
  return { count: recent.length, strong, weak, up, down,
    feelRate: feel.length >= 5 ? feel.filter((s) => s.feel === 'good').length / feel.length : null };
}

function tendencyLines(t = computeTendency()) {
  if (!t) return [];
  const pct = (v) => `${Math.round(v * 100)}%`;
  return [
    t.strong.length ? `得意: ${t.strong.map((r) => `${r.label}（◎ ${pct(r.goodRate)}）`).join('、')}` : null,
    t.weak.length ? `苦手: ${t.weak.map((r) => `${r.label}（△ ${pct(r.badRate)}）`).join('、')}` : null,
    t.up.length ? `良くなってきた: ${t.up.map((r) => r.label).join('、')}` : null,
    t.down.length ? `前より崩れている: ${t.down.map((r) => r.label).join('、')}` : null,
    t.feelRate != null ? `最近の練習で「いい感触」の割合: ${pct(t.feelRate)}` : null,
    flightCounts().length ? `記録した弾道: ${flightCounts().map(([f, n]) => `${FLIGHT_LABEL[f]} ${n}球`).join('、')}` : null,
  ].filter(Boolean);
}

// ---------- コーチのメモ (Claude Code が記録から学習) ----------
let coachRun = null; // { message }
function renderCoach() {
  const box = $('#coach');
  if (!box) return;
  const c = state.coach;
  const measured = (state.swings || []).reduce((a, r) => a + (r.swings?.length || 0), 0);
  const fresh = c ? Math.max(0, measured - (c.swings || 0)) : measured;
  const body = el('div', { class: 'ai-result' });
  if (c?.text) body.innerHTML = renderAnalysis(c.text);
  box.replaceChildren(...[
    c?.text
      ? el('p', { class: 'muted tiny' }, `${fmtDate(c.updatedAt)} に ${c.swings}球の記録から作成${fresh ? `（そのあと ${fresh}球 増えています）` : ''}`)
      : el('p', { class: 'muted small' }, '記録をパソコンの Claude（Sonnet）に読ませて、あなたのスイングの特徴・良いときの共通点・崩れるパターン・効いた練習をまとめます。'
        + '学習するたびに前のメモを見直して書き足すので、記録が増えるほどあなた向けになります。このメモは AI 分析や振り返りノートの整理にも使われます。'),
    c?.text ? el('details', { class: 'coach-text', open: '' }, el('summary', { class: 'small strong' }, 'メモを見る'), body) : null,
    coachRun ? el('p', { class: 'small' }, coachRun.message) : null,
    el('div', { class: 'cand-btns' },
      el('button', { type: 'button', class: 'btn small primary', ...(coachRun ? { disabled: '' } : {}), onclick: learnCoach },
        c?.text ? '新しい記録で学習し直す（Claude）' : '記録から学習する（Claude）')),
  ].filter(Boolean));
}

async function learnCoach() {
  coachRun = { message: 'Claude が記録を読んでいます…（1〜3分ほど）' };
  renderCoach();
  try {
    await post('api/coach/learn');
  } catch (e) {
    coachRun = null;
    toast(e.message);
    renderCoach();
    return;
  }
  const poll = async () => {
    let c;
    try { c = await api('api/coach'); } catch { setTimeout(poll, 3000); return; }
    if (c.status === 'running') { setTimeout(poll, 3000); return; }
    coachRun = null;
    if (c.status === 'done') await reloadState().catch(() => {});
    renderCoach();
    toast(c.message || '終わりました');
  };
  setTimeout(poll, 3000);
}

function renderTendency() {
  const box = $('#tendency');
  if (!box) return;
  const t = computeTendency();
  if (!t) {
    box.replaceChildren(el('p', { class: 'muted small' }, 'スイング動画を記録して姿勢を測ると、得意・苦手の傾向がここに出ます（AIは使いません）。'));
    return;
  }
  const pct = (v) => `${Math.round(v * 100)}%`;
  const group = (title, cls, rows, fmt) => (rows.length ? el('div', { class: `tend-group ${cls}` },
    el('div', { class: 'small strong' }, title),
    el('div', { class: 'chips' }, rows.map((r) => el('button', {
      type: 'button', class: 'chip', title: '動画タブでこの項目が△の球を見る',
      onclick: () => { recFilter = { ...recFilter, weak: cls === 'weak' ? r.label : null, rating: 'all', view: 'club', sort: 'low' }; switchTab('video'); renderSwingRecords(); },
    }, fmt(r))))) : null);
  box.replaceChildren(...[
    el('p', { class: 'muted tiny' }, `最近の${t.count}球の姿勢の計測から（AIなし）`),
    group('得意', 'strong', t.strong, (r) => `${r.label} ◎${pct(r.goodRate)}`),
    group('苦手', 'weak', t.weak, (r) => `${r.label} △${pct(r.badRate)}`),
    group('良くなってきた', 'strong', t.up, (r) => `${r.label} ↑`),
    group('前より崩れている', 'weak', t.down, (r) => `${r.label} ↓`),
    !t.strong.length && !t.weak.length ? el('p', { class: 'muted small' }, 'まだ目立った得意・苦手はありません。') : null,
    t.feelRate != null ? el('p', { class: 'small' }, `最近の練習で「いい感触」の割合: ${pct(t.feelRate)}`) : null,
    flightCounts().length ? el('p', { class: 'small' }, `記録した弾道: ${flightCounts().map(([f, n]) => `${FLIGHT_LABEL[f]} ${n}`).join('・')}`) : null,
  ].filter(Boolean));
}

function selectClub(id) {
  selectedClub = id;
  const club = ALL_CLUBS.find((c) => c.id === id);
  const ref = lastDistanceByClub[id] ?? statsAvgForClub(id) ?? club?.defaultYd ?? 100;
  $('#shot-distance').placeholder = `参考 ${ref}`;
  $('#shot-distance').dataset.ref = ref;
  renderPractice();
}

function statsAvgForClub(id) {
  const all = state.sessions.flatMap((s) => s.shots).filter((s) => s.club === id && s.distance != null && s.contact === 'good');
  return all.length ? Math.round(mean(all.map((s) => s.distance)) / 5) * 5 : null;
}

function startSession() {
  state.active = { id: String(Date.now()), place: $('#session-place').value.trim(), startedAt: Date.now(), shots: [],
    theme: state.theme?.text || null };
  $('#session-place').value = '';
  if (!selectedClub || !state.bag.includes(selectedClub)) selectedClub = state.bag.includes('7I') ? '7I' : state.bag[0];
  save();
  selectClub(selectedClub);
}

async function endSession() {
  const a = state.active;
  if (!a) return;
  if (a.shots.length === 0) {
    if (!(await askConfirm('1球も記録されていません。破棄して終了しますか？', '破棄して終了'))) return;
  } else {
    const done = { ...a, endedAt: Date.now() };
    state.sessions.unshift(done);
    save('session', done);
    toast(`${a.shots.length}球の練習を保存しました`);
  }
  state.active = null;
  save();
  renderAll();
}

const FEEL_LABEL = { good: 'いい感触', meh: 'いまいち', unknown: 'わからない' };

// 感触ボタン1回で1球保存する。詳しく記録で選んだものだけ一緒に残し、残りは未入力 (null) のまま
function addShot(feel) {
  if (!state.active) return;
  if (!selectedClub) { toast('クラブを選んでください'); return; }
  const raw = $('#shot-distance').value.trim();
  const distance = raw === '' ? null : Number(raw);
  if (distance != null && (!Number.isFinite(distance) || distance <= 0 || distance > 400)) {
    toast('飛距離を正しく入力してください（わからなければ空欄で大丈夫です）');
    return;
  }
  const shot = {
    club: selectedClub,
    feel: feel || null,
    distance,
    direction: pickerValue('dir-picker'),
    contact: pickerValue('contact-picker'),
    at: Date.now(),
  };
  state.active.shots.push(shot);
  if (distance != null) lastDistanceByClub[selectedClub] = distance;
  $('#shot-distance').value = '';
  $$('#dir-picker .chip, #contact-picker .chip').forEach((c) => c.classList.remove('selected'));
  save();
  renderPractice();
  if (navigator.vibrate) navigator.vibrate(15);
  toast(`保存しました: ${shotText(shot)}`);
}

function shotText(s) {
  return [clubName(s.club), FEEL_LABEL[s.feel] || '感触なし', s.distance != null ? `${s.distance}yd` : null,
    s.direction && s.direction !== 'unknown' ? DIR_LABEL[s.direction] : null,
    s.contact && s.contact !== 'unknown' ? CONTACT_LABEL[s.contact] : null].filter(Boolean).join('・');
}

function undoShot() {
  if (!state.active || !state.active.shots.length) return;
  state.active.shots.pop();
  save();
  renderPractice();
}

// ---------- ドリルタブ ----------
function lastFor(drillId) {
  const rs = state.drillResults.filter((r) => r.drillId === drillId);
  return rs.length ? rs.reduce((a, r) => ((r.at || 0) > (a.at || 0) ? r : a)) : null;
}
function bestFor(drillId) {
  const rs = state.drillResults.filter((r) => r.drillId === drillId);
  if (!rs.length) return null;
  return rs.reduce((b, r) => (r.made / r.total > b.made / b.total ? r : b));
}

function renderDrills() {
  const running = !!drillRun;
  $('#drill-list').hidden = running;
  $('#drill-run').hidden = !running;

  if (!running) {
    const card = (d) => {
      const best = bestFor(d.id);
      const last = lastFor(d.id);
      return el('div', { class: 'card drill' },
        el('div', {},
          el('div', { class: 'cat' }, d.focus ? `苦手: ${d.cat}` : d.cat),
          el('h3', {}, d.name),
          el('p', { class: 'muted small' }, d.desc),
          best ? el('p', { class: 'small', style: 'margin-top:4px' },
            `ベスト: ${best.made}/${best.total} (${Math.round(best.made / best.total * 100)}%)`,
            last && last !== best ? `　前回: ${last.made}/${last.total}` : '') : null),
        el('button', { class: 'btn primary', onclick: () => startDrill(d.id) }, '開始'));
    };
    // 私の苦手のドリルを先に。苦手の最近の解消率も出す
    const ids = typeof focusIds === 'function' ? focusIds() : [];
    const recent = (state.swings || []).flatMap((r) => r.swings || []).slice(-60);
    const rates = typeof focusRates === 'function' ? focusRates(recent, ids) : [];
    const mine = FOCUS_DRILLS.filter((d) => ids.includes(d.focus));
    const others = FOCUS_DRILLS.filter((d) => !ids.includes(d.focus));
    $('#drill-list').replaceChildren(
      el('h2', { class: 'drill-sec' }, 'あなたの苦手のドリル'),
      ...(mine.length
        ? [rates.length ? el('p', { class: 'small muted' }, '最近の動画での解消率: ', rates.map((r) => `${r.label} ${Math.round(r.ok * 100)}%`).join('・')) : null,
          ...mine.map(card)].filter(Boolean)
        : [el('p', { class: 'muted small' }, '動画タブの「私の苦手」を選ぶ（または自動で選ばれる）と、その苦手を直すドリルがここに並びます。')]),
      el('details', { class: 'drill-more' },
        el('summary', {}, 'ほかのドリル（パター・アプローチ・ほかの苦手など）'),
        ...DRILLS.map(card), ...others.map(card)));
    return;
  }

  const d = allDrills().find((x) => x.id === drillRun.drillId);
  $('#drill-title').textContent = d.name;
  $('#drill-desc').textContent = `${d.desc} (目標 ${d.target}回)`;
  $('#drill-made').textContent = drillRun.made;
  $('#drill-total').textContent = drillRun.total;
  $('#drill-progress').style.width = `${Math.min(100, (drillRun.total / d.target) * 100)}%`;
  const best = bestFor(d.id);
  $('#drill-best').textContent = best
    ? `自己ベスト ${best.made}/${best.total} (${Math.round(best.made / best.total * 100)}%)`
    : 'まだ記録がありません';
}

function startDrill(id) {
  drillRun = { drillId: id, made: 0, total: 0 };
  renderDrills();
  window.scrollTo(0, 0);
}

function drillTap(made) {
  if (!drillRun) return;
  const d = allDrills().find((x) => x.id === drillRun.drillId);
  drillRun.total++;
  if (made) drillRun.made++;
  if (navigator.vibrate) navigator.vibrate(made ? 15 : [10, 40, 10]);
  renderDrills();
  if (drillRun.total === d.target) toast('目標回数に到達！「結果を保存」で記録できます');
}

function saveDrill() {
  if (!drillRun || drillRun.total === 0) { toast('まだ1回も記録されていません'); return; }
  const prevBest = bestFor(drillRun.drillId);
  const rate = drillRun.made / drillRun.total;
  const result = { ...drillRun, id: String(Date.now()), at: Date.now() };
  state.drillResults.unshift(result);
  save('drill', result);
  const isBest = !prevBest || rate > prevBest.made / prevBest.total;
  toast(isBest ? `🎉 自己ベスト更新！ ${Math.round(rate * 100)}%` : `保存しました (${Math.round(rate * 100)}%)`);
  drillRun = null;
  renderAll();
}

async function closeDrill() {
  if (drillRun && drillRun.total > 0 && !(await askConfirm('結果を保存せずに戻りますか？', '保存せずに戻る'))) return;
  drillRun = null;
  renderDrills();
}

// ---------- 動画タブ ----------
const FRAME_STEP = 1 / 30;
// インパクトを0秒としたときの切り出し位置(秒)と、だいたいの局面 (pc/video.py の PHASES と同じ)
// v1: claude.ai 版初期の8コマ、v2: いまの16コマ
const PHASE_SETS = {
  1: [
    { dt: -2.0, label: 'アドレス' },
    { dt: -1.5, label: 'テイクバック' },
    { dt: -1.1, label: 'バックスイング' },
    { dt: -0.7, label: 'トップ付近' },
    { dt: -0.3, label: 'ダウンスイング' },
    { dt: 0, label: 'インパクト' },
    { dt: 0.3, label: 'フォロー' },
    { dt: 1.0, label: 'フィニッシュ' },
  ],
  2: [
    { dt: -2.0, label: 'アドレス' },
    { dt: -1.6, label: '始動' },
    { dt: -1.3, label: 'テイクバック' },
    { dt: -1.0, label: 'バックスイング' },
    { dt: -0.75, label: 'トップ手前' },
    { dt: -0.55, label: 'トップ付近' },
    { dt: -0.4, label: '切り返し' },
    { dt: -0.27, label: 'ダウン前半' },
    { dt: -0.15, label: 'ダウン後半' },
    { dt: -0.07, label: 'インパクト直前' },
    { dt: 0, label: 'インパクト' },
    { dt: 0.07, label: 'インパクト直後' },
    { dt: 0.2, label: 'フォロー' },
    { dt: 0.4, label: 'フォロースルー' },
    { dt: 0.7, label: 'フィニッシュ手前' },
    { dt: 1.1, label: 'フィニッシュ' },
  ],
};
const PHASES = PHASE_SETS[2];
function phasesOf(sw) { return PHASE_SETS[sw.v || 1]; }
function impactIndex(sw) { return phasesOf(sw).findIndex((p) => p.dt === 0); }

let job = null; // サーバーで処理中の動画
let jobTimer = null;
let candidates = []; // { t, thumb, on }
let analyzeAfterSave = false;
let clubTouched = false; // この動画でクラブを自分で選んだか (選んだら AI の推定で上書きしない)
let videoClub = null;
let compareSel = []; // [{ recId, idx }]
const openRecords = new Set();
const analysisTimers = {};

function fmtSec(t) { return (Math.round(t * 100) / 100).toFixed(2); }
function fmtClock(t) {
  const m = Math.floor(t / 60);
  return `${m}:${(t - m * 60).toFixed(1).padStart(4, '0')}`;
}
function fmtMB(bytes) { return `${(bytes / 1048576).toFixed(bytes < 10485760 ? 1 : 0)} MB`; }

// --- 再生 ---
function syncVideoUi() {
  const v = $('#video');
  if (!v.duration) return;
  $('#video-cur').textContent = fmtSec(v.currentTime);
  $('#video-dur').textContent = fmtSec(v.duration);
  $('#video-seek').value = Math.round((v.currentTime / v.duration) * 1000);
  $('#btn-play').textContent = v.paused ? '▶︎ 再生' : '❚❚ 停止';
}

function stepFrame(dir) {
  const v = $('#video');
  v.pause();
  v.currentTime = Math.min(v.duration, Math.max(0, v.currentTime + dir * FRAME_STEP));
}

function seekTo(v, t) {
  return new Promise((resolve) => {
    const done = () => { v.removeEventListener('seeked', done); resolve(); };
    v.addEventListener('seeked', done);
    v.currentTime = Math.min(Math.max(0, t), Math.max(0, (v.duration || t) - 0.02));
  });
}

// --- 動画を送る / フォルダから選ぶ ---
function uploadVideo(file) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', `api/upload?name=${encodeURIComponent(file.name)}&lastModified=${file.lastModified || 0}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        $('#detect-status').textContent = `パソコンに送っています… ${Math.round((e.loaded / e.total) * 100)}%（${fmtMB(e.total)}）`;
      }
    };
    xhr.onload = () => {
      let data = null;
      try { data = JSON.parse(xhr.responseText); } catch { /* 下で扱う */ }
      if (xhr.status >= 200 && xhr.status < 300 && data) resolve(data);
      else reject(new Error(data?.error || `送信できませんでした (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('パソコンに送れませんでした。接続を確認してください。'));
    xhr.send(file);
  });
}

// ファイルの大きさと先頭・末尾 1MB から作る目印 (サーバーの fingerprint と同じ計算)
async function fingerprint(file) {
  if (!window.crypto?.subtle) return null;
  const MB = 1 << 20;
  const parts = [
    new TextEncoder().encode(String(file.size)),
    new Uint8Array(await file.slice(0, MB).arrayBuffer()),
    new Uint8Array(await file.slice(Math.max(0, file.size - MB)).arrayBuffer()),
  ];
  const all = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let off = 0;
  for (const p of parts) { all.set(p, off); off += p.length; }
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', all));
  return Array.from(hash, (x) => x.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

function duplicateText(d) {
  return `${fmtDay(d.shotAt)} ${fmtHM(d.shotAt)} の ${clubName(d.club)}（${d.count}球）`;
}

function showRecord(recId) {
  openRecords.add(recId);
  recFilter = { ...recFilter, cat: 'all', rating: 'all', weak: null, view: 'records' };
  renderSwingRecords();
  setTimeout(() => $(`#rec-${recId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
}

// 送る前に、同じ動画がもう記録されていないか確かめる。送ってよければ true
async function checkBeforeUpload(file) {
  let dup = null;
  try {
    const fp = await fingerprint(file);
    if (fp) dup = (await api(`api/check?fp=${fp}`)).duplicate;
  } catch { /* 確かめられなくても送れるようにする */ }
  if (!dup) return true;
  if (await askConfirm(`この動画は ${duplicateText(dup)} として記録済みです。もう一度追加しますか？`, 'それでも追加')) return true;
  showRecord(dup.id);
  return false;
}

async function discardJob() {
  clearTimeout(jobTimer);
  if (job && job.status !== 'saved') post(`api/jobs/${job.id}/discard`).catch(() => {});
  job = null;
  candidates = [];
  const v = $('#video');
  v.removeAttribute('src');
  v.load();
}

async function openVideo(start) {
  await discardJob();
  $('#video-panel').hidden = false;
  $('#inbox-panel').hidden = true;
  $('#save-status').textContent = '';
  renderCandidates();
  try {
    setJob(await start());
  } catch (e) {
    $('#detect-status').textContent = e.message;
  }
}

function setJob(j) {
  job = j;
  clubTouched = false;
  shotTouched = false;
  $('#shot-time').value = '';
  $('#shot-time').dataset.ms = '';
  $('#shot-source').textContent = '';
  candidates = (j.candidates || []).map((c) => ({ ...c }));
  renderJob();
  pollJob();
}

function pollJob() {
  clearTimeout(jobTimer);
  if (!job) return;
  const waiting = job.status === 'detecting' || job.status === 'saving'
    || (job.status === 'ready' && (!job.proxy || job.clubGuessing));
  if (!waiting) return;
  jobTimer = setTimeout(async () => {
    if (!job) return;
    try {
      const prev = job.status;
      job = await api(`api/jobs/${job.id}`);
      if (prev === 'detecting' && job.status !== 'detecting') candidates = job.candidates.map((c) => ({ ...c }));
      if (job.status === 'saved') { await onSaved(); return; }
      renderJob();
    } catch (e) {
      $('#detect-status').textContent = e.message;
    }
    pollJob();
  }, 1000);
}

function renderJob() {
  if (!job) return;
  const status = job.status === 'detecting' ? job.message
    : job.status === 'error' ? job.message
      : job.status === 'saving' ? job.message : job.message || '';
  $('#detect-status').textContent = status;
  if (job.shotAt) setShotTime(job.shotAt, job.shotSource);
  const dup = job.duplicateOf;
  $('#dup-warning').hidden = !dup;
  if (dup) {
    $('#dup-warning').replaceChildren(
      `⚠️ この動画は ${duplicateText(dup)} として記録済みのようです。`,
      el('button', { type: 'button', class: 'btn small', onclick: () => showRecord(dup.id) }, '記録を見る'));
  }
  $('#job-name').textContent = job.name;
  const v = $('#video');
  if (job.proxy && !v.getAttribute('src')) {
    v.src = job.proxy;
    v.playbackRate = Number(pickerValue('speed-picker') || 0.25);
  }
  $('#video-loading').hidden = !!job.proxy || job.status === 'error';
  const guess = job.clubGuess;
  if (guess && !clubTouched && state.bag.includes(guess.club) && videoClub !== guess.club) {
    videoClub = guess.club;
    renderVideoClubs();
  }
  $('#club-guess').textContent = job.clubGuessing ? 'AIがクラブを推定しています…'
    : guess ? `AIの推定: ${clubName(guess.club)}${guess.reason ? `（${guess.reason}）` : ''}${clubTouched ? '' : '。違うときは選び直してください'}` : '';
  $('#save-status').textContent = job.status === 'saving' ? job.message : $('#save-status').textContent;
  setSaveButtons(job.status === 'ready');
  renderCandidates();
}

async function onSaved() {
  const recId = job.recId;
  const msg = job.message;
  job = null;
  candidates = [];
  const v = $('#video');
  v.removeAttribute('src');
  v.load();
  $('#video-panel').hidden = true;
  $('#video-memo').value = '';
  toast(msg);
  await reloadState();
  openRecords.add(recId);
  renderSwingRecords();
  const rec = state.swings.find((r) => r.id === recId);
  if (rec && analyzeAfterSave) analyzeRecord(rec);
  else setTimeout(() => $(`#rec-${recId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
}

async function loadInbox() {
  const panel = $('#inbox-panel');
  panel.hidden = false;
  $('#inbox-status').textContent = 'フォルダを見ています…';
  $('#inbox-list').replaceChildren();
  try {
    const { dir, files } = await api('api/inbox');
    $('#inbox-dir').textContent = dir;
    $('#inbox-status').textContent = files.length ? '' : 'このフォルダに動画がありません。動画を入れてから「更新」を押してください。';
    $('#inbox-list').replaceChildren(...files.map((f) => el('button', {
      type: 'button', class: 'drive-item' + (f.done ? ' done' : ''),
      onclick: () => openVideo(() => post('api/inbox/open', { name: f.name })),
    },
    el('span', { class: 'strong small' }, f.name),
    el('span', { class: 'muted small' }, `${fmtDate(f.mtime)} ・ ${fmtMB(f.size)}${f.done ? ' ・ 記録済み' : ''}`))));
  } catch (e) {
    $('#inbox-status').textContent = e.message;
  }
}

// --- スイング候補 ---
async function setCandidateTime(c, t) {
  try {
    const r = await post(`api/jobs/${job.id}/thumb`, { t });
    c.t = r.t;
    c.thumb = r.thumb;
  } catch (e) {
    toast(e.message);
  }
}

async function addCandidateHere() {
  const v = $('#video');
  if (!job || !v.duration) { toast('動画の準備ができてから押してください'); return; }
  v.pause();
  const c = { t: v.currentTime, on: true, thumb: '' };
  await setCandidateTime(c, v.currentTime);
  candidates.push(c);
  candidates.sort((x, y) => x.t - y.t);
  renderCandidates();
  toast(`${fmtClock(c.t)} を追加しました`);
}

async function previewCandidate(c) {
  const v = $('#video');
  if (!v.getAttribute('src')) { toast('再生用の動画を準備しています。少しお待ちください'); return; }
  await seekTo(v, c.t + PHASES[0].dt);
  v.play();
  const stopAt = c.t + PHASES[PHASES.length - 1].dt;
  const check = () => {
    if (v.currentTime >= stopAt || v.paused) { v.pause(); v.removeEventListener('timeupdate', check); }
  };
  v.addEventListener('timeupdate', check);
  v.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function nudgeCandidate(c, dt) {
  await setCandidateTime(c, Math.max(0, c.t + dt));
  renderCandidates();
}

// スイングと判定した球だけを並べる。スイングではなさそうな音は、下にたたんでおく (チェックを入れれば戻せる)
let showRejected = false;
function renderCandidates() {
  const isMain = (c) => c.on || c.kept || !c.warn;
  const main = candidates.filter(isMain);
  const rejected = candidates.filter((c) => !isMain(c));
  const on = candidates.filter((c) => c.on).length;
  $('#candidate-count').textContent = candidates.length ? `${on}球を記録` : '';
  const row = (c, n) => el('div', { class: 'candidate' + (c.on ? '' : ' off') },
    el('label', { class: 'cand-check' },
      Object.assign(el('input', { type: 'checkbox', 'aria-label': `${n}を記録する` }), {
        checked: c.on,
        onchange: (e) => { c.on = e.target.checked; c.kept = true; renderCandidates(); },
      }),
      c.thumb ? el('img', { src: c.thumb, alt: '', class: 'cand-thumb' }) : el('div', { class: 'cand-thumb' })),
    el('div', { class: 'cand-info' },
      el('div', { class: 'strong' }, n),
      el('div', { class: 'muted small' }, `インパクト ${fmtClock(c.t)}`),
      c.warn ? el('div', { class: 'small warn-text' }, `⚠ ${c.warn}`) : null,
      el('div', { class: 'cand-btns' },
        el('button', { type: 'button', class: 'btn small', onclick: () => previewCandidate(c) }, '▶︎ 見る'),
        el('button', { type: 'button', class: 'btn small', onclick: () => nudgeCandidate(c, -0.1), 'aria-label': '0.1秒前へ' }, '−0.1'),
        el('button', { type: 'button', class: 'btn small', onclick: () => nudgeCandidate(c, 0.1), 'aria-label': '0.1秒後へ' }, '+0.1'))));
  const more = rejected.length ? el('details', { class: 'fold rejected-cands' },
    el('summary', { class: 'small muted' }, `スイングではなさそうな音 ${rejected.length}件（隣の打席・ボールを置いた音など。押すと見られます）`),
    ...rejected.map((c) => row(c, `音 ${fmtClock(c.t)}`))) : null;
  if (more) {
    more.open = showRejected;
    more.addEventListener('toggle', () => { showRejected = more.open; });
  }
  $('#swing-candidates').replaceChildren(...main.map((c, k) => row(c, `${k + 1}球目`)), ...(more ? [more] : []));
}

// --- 保存 ---
async function saveRecord(analyze) {
  if (!job || job.status !== 'ready') return;
  const chosen = candidates.filter((c) => c.on);
  if (!chosen.length) { toast('記録するスイングを選んでください'); return; }
  if (!videoClub) { toast('クラブを選んでください'); return; }
  if (analyze && !config.hasApiKey) { toast('AI 分析には Gemini の API キーが必要です（設定タブ）'); return; }
  $('#video').pause();
  analyzeAfterSave = analyze;
  setSaveButtons(false);
  try {
    job = await post(`api/jobs/${job.id}/save`, {
      impacts: chosen.map((c) => c.t),
      club: videoClub,
      angle: pickerValue('angle-picker'),
      concern: $('#video-concern').value.trim(),
      memo: $('#video-memo').value.trim(),
      shotAt: chosenShotTime(),
    });
    renderJob();
    pollJob();
  } catch (e) {
    $('#save-status').textContent = e.message;
    setSaveButtons(true);
  }
}

function setSaveButtons(on) {
  $('#btn-save-only').disabled = !on;
  $('#btn-save-analyze').disabled = !on;
}

// --- AI 分析 (パソコンのサーバーが Claude に問い合わせる) ---
// only に1球の切り出し動画の場所を渡すと、その1球だけを分析・採点する
async function analyzeRecord(rec, only = null) {
  if (!config.hasApiKey) { toast('AI 分析には Gemini の API キーが必要です（設定タブ）'); return; }
  openRecords.add(rec.id);
  rec._running = true;
  rec._only = only;
  rec._status = 'コマを準備しています…';
  renderSwingRecords();
  if (!only) setTimeout(() => $(`#rec-${rec.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  try {
    await post(`api/swings/${rec.id}/analyze`, only ? { clip: only } : {});
  } catch (e) {
    rec._running = false;
    rec._status = e.message;
    renderSwingRecords();
    return;
  }
  pollAnalysis(rec);
}

function pollAnalysis(rec) {
  clearTimeout(analysisTimers[rec.id]);
  analysisTimers[rec.id] = setTimeout(async () => {
    let a;
    try {
      a = await api(`api/swings/${rec.id}/analysis`);
    } catch (e) {
      rec._status = e.message;
      pollAnalysis(rec);
      return;
    }
    rec._status = a.message;
    if (a.text) rec._partial = a.text;
    if (a.only) rec._only = a.only;
    if (a.status === 'running') {
      // 1球だけの分析は、大きく見る画面か一覧のどちらかに途中経過の欄がある
      const body = rec._only ? $('.swing-ai-live') : $(`#rec-${rec.id} .ai-result`);
      const status = $(`#rec-${rec.id} .rec-status`);
      if (body && a.text) body.innerHTML = renderAnalysis(a.text);
      if (status) status.textContent = a.message;
      else if (!(rec._only && body)) renderSwingRecords();
      pollAnalysis(rec);
      return;
    }
    rec._running = false;
    delete rec._partial;
    delete rec._only;
    if (a.status === 'done') {
      const status = a.message;
      try { await reloadState(); } catch { /* 下で今の内容を表示する */ }
      const fresh = state.swings.find((r) => r.id === rec.id);
      if (fresh) fresh._status = status;
    }
    renderSwingRecords();
  }, 1000);
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// 「## 見出し」「- 箇条書き」「**太字**」だけを解釈する簡易表示
function renderAnalysis(text) {
  // 「## 見出し」「### 小見出し」「- 箇条書き」（字下げで一段下げる）「**太字**」だけを解釈する簡易表示
  let html = '';
  let depth = 0;
  const liOpen = [];
  const indentAt = [];
  const close = (to) => {
    while (depth > to) {
      if (liOpen[depth]) html += '</li>';
      html += '</ul>';
      liOpen[depth] = false;
      depth--;
    }
  };
  for (const raw of text.split('\n')) {
    const indent = raw.match(/^\s*/)[0].replace(/\t/g, '  ').length;
    const line = escapeHtml(raw.trim()).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    if (!line) continue;
    const item = line.match(/^[-・*]\s+(.*)$/);
    if (item) {
      // 字下げの幅 (2つ・4つなど) にかかわらず、前の行より深ければ一段下げる
      let level;
      if (depth === 0 || indent <= indentAt[1]) level = 1;
      else if (indent > indentAt[depth]) level = Math.min(3, depth + 1);
      else { level = depth; while (level > 1 && indent < indentAt[level]) level--; }
      indentAt[level] = indent;
      if (level > depth) {
        while (depth < level) { depth++; html += '<ul>'; liOpen[depth] = false; }
      } else {
        close(level);
        if (liOpen[depth]) html += '</li>';
      }
      html += `<li>${item[1]}`;
      liOpen[depth] = true;
      continue;
    }
    close(0);
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) html += h[1].length >= 3 ? `<h4>${h[2]}</h4>` : `<h3>${h[2]}</h3>`;
    else html += `<p>${line}</p>`;
  }
  close(0);
  return html;
}

// --- 記録一覧 ---
// 補助線 (頭の位置・背骨・お尻の線) を描いたコマ画像と動画に切り替える
let showLines = false;
try { showLines = localStorage.getItem('golf-lines') === '1'; } catch { /* 使えなくても問題ない */ }
function toggleLines() {
  showLines = !showLines;
  try { localStorage.setItem('golf-lines', showLines ? '1' : '0'); } catch { /* 使えなくても問題ない */ }
  renderSwingRecords();
}

function spriteSrc(sw) { return (showLines && sw.pose?.linesSprite) || sw.sprite || ''; }
// ふだんは元の映像から作った見やすい軌道画像 (トップ付近〜フォロー、時間で青→赤)。
// 「上げ・下げで色分け」を押したときだけ、バックスイング・ダウンスイング・フォローの3色の画像を出す
function trailSrc(sw) { return sw.trail || ''; }
function trailFigure(sw, i) {
  if (!sw.trail) return null;
  let phase = false;
  const img = el('img', { class: 'trail-img', src: sw.trail, alt: `${i + 1}球目のクラブ軌道`, loading: 'lazy' });
  const cap = el('figcaption', { class: 'muted small' });
  const btn = sw.pose?.trailMasked ? el('button', { type: 'button', class: 'btn small' }) : null;
  const show = () => {
    img.src = phase ? sw.pose.trailMasked : sw.trail;
    cap.textContent = phase
      ? 'アドレスからフォローまでを、バックスイング（青）・ダウンスイング（オレンジ）・フォロー（黄）に色分け。上げたときと下ろしたときで通り道が変わっていないかを見ます。'
      : 'クラブ軌道（トップ付近〜フォローを重ねたもの。青→赤の順に動いています）';
    if (btn) btn.textContent = phase ? 'ふつうの表示に戻す' : '上げ・下げで色分けして見る';
  };
  if (btn) btn.addEventListener('click', () => { phase = !phase; show(); });
  show();
  return el('figure', { class: 'trail-fig' }, img, cap, btn);
}

function frameView(sw, i, cls = 'frame') {
  const n = phasesOf(sw).length;
  const box = el('div', { class: cls, style: `aspect-ratio:${sw.aspect || 0.5625}` });
  box.style.backgroundImage = `url("${spriteSrc(sw)}")`;
  box.style.backgroundSize = `${n * 100}% 100%`;
  box.style.backgroundPosition = `${(i / (n - 1)) * 100}% 0`;
  return box;
}

function clipPlayer(sw, label) {
  if (!sw.clip) return null;
  const v = el('video', { class: 'clip', src: (showLines && sw.pose?.linesClip) || sw.clip, controls: '', playsinline: '', preload: 'metadata', 'aria-label': label });
  const impact = sw.clipOffset ?? 2.5;
  const pos = el('span', { class: 'small muted clip-pos' }, '');
  const showPos = () => {
    const d = v.currentTime - impact;
    pos.textContent = `インパクトから ${d >= 0 ? '+' : ''}${d.toFixed(2)}秒`;
  };
  v.addEventListener('timeupdate', showPos);
  v.addEventListener('seeked', showPos);
  v.addEventListener('loadedmetadata', showPos);
  const step = (n) => {
    v.pause();
    v.currentTime = Math.min(Math.max(0, v.currentTime + n / 30), (v.duration || 99) - 0.01);
  };
  // 動画を選んだ状態で ← → を押すと 1コマずつ動く
  v.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      step(e.key === 'ArrowLeft' ? -1 : 1);
    }
  });
  const slow = (rate) => () => {
    v.playbackRate = rate;
    v.currentTime = 0;
    v.play();
  };
  const fine = el('div', { class: 'fine-frames' });
  return el('div', { class: 'clip-box' }, v,
    el('div', { class: 'cand-btns' },
      el('button', { type: 'button', class: 'btn small', onclick: () => step(-1), 'aria-label': '1コマ戻る' }, '◀ 1コマ'),
      el('button', { type: 'button', class: 'btn small', onclick: () => step(1), 'aria-label': '1コマ進む' }, '1コマ ▶'),
      pos),
    el('div', { class: 'cand-btns' },
      el('button', { type: 'button', class: 'btn small', onclick: slow(0.25) }, '0.25倍で再生'),
      el('button', { type: 'button', class: 'btn small', onclick: slow(0.5) }, '0.5倍'),
      el('button', { type: 'button', class: 'btn small', onclick: () => {
        v.pause();
        v.currentTime = impact;
      } }, 'インパクトへ'),
      el('button', { type: 'button', class: 'btn small', onclick: () => fineFrames(sw, fine) }, '1/30秒ごとのコマを見る')),
    fine);
}

// 切り出し動画から 1/30 秒ごとのコマを取り出して並べる (パソコンの中だけで作る・AIは使わない)
const FINE_RANGES = [
  { label: 'テークバック', from: -1.8, to: -0.9 },
  { label: 'トップ〜インパクト', from: -0.8, to: 0.1 },
  { label: 'インパクト前後', from: -0.2, to: 0.3 },
];
// 前の記録で人が小さく写っているときは、パソコン側で人の位置を調べて、そのまわりだけを大きく出す
async function viewCropOf(sw) {
  if (sw.crop) return null; // 新しい記録は切り出し動画がもう人のまわり
  if (sw.viewCrop !== undefined) return sw.viewCrop;
  const rec = state.swings.find((r) => (r.swings || []).includes(sw));
  if (!rec) return null;
  try {
    sw.viewCrop = (await post(`api/swings/${rec.id}/viewcrop`, { clip: sw.clip })).crop;
  } catch {
    return null;
  }
  return sw.viewCrop;
}

async function fineFrames(sw, box, range = FINE_RANGES[1]) {
  const src = (showLines && sw.pose?.linesClip) || sw.clip;
  const impact = sw.clipOffset ?? 2.5;
  box.parentElement?.classList.add('has-fine');
  const close = () => { box.replaceChildren(); box.parentElement?.classList.remove('has-fine'); };
  box.replaceChildren(el('p', { class: 'muted small' }, 'コマを取り出しています…（人の位置を探して大きく写します）'));
  const v = el('video', { src, muted: '', preload: 'auto', playsinline: '' });
  try {
    const [crop] = await Promise.all([viewCropOf(sw), new Promise((res, rej) => {
      v.onloadeddata = res;
      v.onerror = () => rej(new Error('動画を読み込めませんでした'));
      setTimeout(() => rej(new Error('動画を読み込めませんでした（時間がかかりすぎました）')), 20000);
    })]);
    // crop は動画に対する割合 [x0, y0, x1, y1]
    const sx = crop ? crop[0] * v.videoWidth : 0;
    const sy = crop ? crop[1] * v.videoHeight : 0;
    const sw2 = crop ? (crop[2] - crop[0]) * v.videoWidth : v.videoWidth;
    const sh = crop ? (crop[3] - crop[1]) * v.videoHeight : v.videoHeight;
    const h = Math.min(720, Math.max(360, Math.round(sh)));
    const w = Math.round((sw2 / sh) * h);
    const frames = [];
    for (let t = range.from; t <= range.to + 1e-6; t += 1 / 30) {
      const at = impact + t;
      if (at < 0 || at > v.duration) continue;
      v.currentTime = at;
      await new Promise((res) => { v.onseeked = res; setTimeout(res, 3000); });
      const c = el('canvas', { width: w, height: h });
      c.getContext('2d').drawImage(v, sx, sy, sw2, sh, 0, 0, w, h);
      const r = Math.round(t * 100) / 100;
      frames.push({ canvas: c, label: r === 0 ? 'インパクト' : `インパクトから ${r > 0 ? '+' : ''}${r.toFixed(2)}秒` });
    }
    if (!frames.length) throw new Error('この範囲のコマがありません');

    // 大きな1コマ + 下に小さいコマの列。押すか ◀ ▶ (← →) で1コマずつ送る
    let cur = Math.max(0, frames.findIndex((f) => f.label === 'インパクト'));
    const big = el('canvas', { class: 'fine-big', width: w, height: h, tabindex: '0', 'aria-label': '選んだコマ' });
    const caption = el('div', { class: 'fine-caption' });
    const thumbs = frames.map((f, i) => {
      const t = el('canvas', { class: 'fine-thumb', width: Math.round(w * 0.25), height: Math.round(h * 0.25) });
      t.getContext('2d').drawImage(f.canvas, 0, 0, t.width, t.height);
      return el('button', { type: 'button', class: 'fine-thumb-btn', onclick: () => show(i), 'aria-label': f.label }, t);
    });
    const strip = el('div', { class: 'fine-strip' }, thumbs);
    const show = (i) => {
      cur = Math.min(frames.length - 1, Math.max(0, i));
      big.getContext('2d').drawImage(frames[cur].canvas, 0, 0);
      caption.textContent = `${frames[cur].label}（${cur + 1} / ${frames.length}コマ）`;
      thumbs.forEach((b, k) => b.classList.toggle('current', k === cur));
      thumbs[cur].scrollIntoView({ block: 'nearest', inline: 'center' });
    };
    big.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); show(cur + (e.key === 'ArrowLeft' ? -1 : 1)); }
    });
    box.replaceChildren(
      el('div', { class: 'cand-btns' },
        ...FINE_RANGES.map((r) => el('button', {
          type: 'button', class: 'chip' + (r === range ? ' selected' : ''), onclick: () => fineFrames(sw, box, r),
        }, r.label)),
        el('button', { type: 'button', class: 'btn small', onclick: close }, '閉じる')),
      el('div', { class: 'fine-viewer' },
        big,
        el('div', { class: 'fine-nav' },
          el('button', { type: 'button', class: 'btn', onclick: () => show(cur - 1), 'aria-label': '前のコマ' }, '◀ 前'),
          caption,
          el('button', { type: 'button', class: 'btn', onclick: () => show(cur + 1), 'aria-label': '次のコマ' }, '次 ▶'))),
      strip,
      el('p', { class: 'muted tiny' }, '1コマ = 約0.033秒。下の小さいコマを押すか、大きいコマを選んで ← → キーでも送れます。'));
    show(cur);
  } catch (e) {
    box.replaceChildren(el('p', { class: 'muted small' }, e.message),
      el('button', { type: 'button', class: 'btn small', onclick: close }, '閉じる'));
  }
}

function renderVideoClubs() {
  if (!videoClub || !state.bag.includes(videoClub)) videoClub = state.bag.includes('7I') ? '7I' : state.bag[0];
  $('#video-club-picker').replaceChildren(...state.bag
    .slice().sort((a, b) => clubOrder(a) - clubOrder(b))
    .map((id) => el('button', {
      type: 'button',
      class: 'chip' + (id === videoClub ? ' selected' : ''),
      onclick: () => { videoClub = id; clubTouched = true; renderVideoClubs(); },
    }, clubName(id))));
}

// --- 姿勢の計測 (MediaPipe・パソコンで計算) ---
// 推移グラフの目安範囲と単位 (pc/pose.py の判定と合わせる)
const POSE_METRICS = {
  score_measure: { label: '計測点（AIなし）', unit: '点', band: [75, 100] },
  score_ai: { label: 'AIの点数', unit: '点', band: [75, 100] },
  address_tilt: { label: 'アドレスの前傾（後方から）', unit: '°', band: [30, 45] },
  tempo: { label: 'テンポ（バック：ダウン）', unit: ': 1', band: [2.5, 3.5] },
  head_side: { label: '頭の横の動き', unit: 'cm', band: [0, 3] },
  head_up: { label: '頭の上下', unit: 'cm', band: [0, 3] },
  sway: { label: 'バックスイングの頭の横ぶれ', unit: 'cm', band: [0, 4] },
  spine: { label: '前傾角度の変化', unit: '°', band: [0, 5] },
  shoulder_turn: { label: '肩の回転', unit: '°', band: [80, 95] },
  hip_turn: { label: '腰の回転', unit: '°', band: [35, 55] },
  xfactor: { label: '捻転差（肩 − 腰）', unit: '°', band: [35, 60] },
  lead_arm: { label: 'リード腕の伸び', unit: '°', band: [160, 180] },
  finish_weight: { label: 'フィニッシュの体重', unit: '%', band: [80, 100] },
};
const poseTimers = {};
let trendMetric = 'score_measure';
let trendCat = 'all';

function renderPose(sw) {
  const p = sw.pose;
  if (!p) return null;
  if (p.error) return el('p', { class: 'muted small' }, `体の動き: ${p.error}`);
  return el('div', { class: 'pose-box' },
    el('div', { class: 'small strong' }, `体の動き（自動計測・${p.view}から）`),
    el('table', { class: 'pose-table' }, el('tbody', {}, p.items.map((it) => el('tr', {},
      el('td', { class: `grade g${it.grade === '◎' ? 2 : it.grade === '○' ? 1 : 0}` }, it.grade || ''),
      el('td', {}, el('div', {}, it.label, focusKeys().includes(it.key) ? el('span', { class: 'focus-tag' }, '苦手') : null), el('div', { class: 'muted tiny' }, it.hint)),
      el('td', { class: 'pose-val' }, it.display))))),
    focusCheck(sw).length ? el('p', { class: 'small focus-line' }, '苦手のチェック: ', ...focusCheck(sw).map((c) =>
      el('span', { class: c.ok ? 'focus-ok' : 'focus-ng' }, `${c.ok ? '✓ 直せた' : '✗ 出た'}: ${c.label}`))) : null,
    p.note ? el('p', { class: 'muted small' }, p.note) : null,
    p.image ? el('img', { class: 'pose-img', src: p.image, alt: '骨格の推定（アドレス・トップ・インパクト・フィニッシュ）', loading: 'lazy' }) : null,
    el('p', { class: 'muted tiny' }, 'カメラ1台からの推定です。長さは身長からの換算、角度は目安として見てください。'));
}

async function measurePose(rec) {
  openRecords.add(rec.id);
  rec._poseRunning = true;
  rec._status = '姿勢を測る準備をしています…';
  renderSwingRecords();
  try {
    await post(`api/swings/${rec.id}/pose`);
  } catch (e) {
    rec._poseRunning = false;
    rec._status = e.message;
    renderSwingRecords();
    return;
  }
  const poll = () => {
    poseTimers[rec.id] = setTimeout(async () => {
      let p;
      try { p = await api(`api/swings/${rec.id}/pose`); } catch (e) { rec._status = e.message; poll(); return; }
      if (p.status === 'running') {
        rec._status = p.message;
        const st = $(`#rec-${rec.id} .rec-status`);
        if (st) st.textContent = p.message;
        poll();
        return;
      }
      await reloadState();
      const fresh = state.swings.find((r) => r.id === rec.id);
      if (fresh) fresh._status = p.message || '';
      if (p.message) toast(p.status === 'error' ? '姿勢を測れませんでした' : p.message);
      renderSwingRecords();
      renderTrend();
    }, 1500);
  };
  poll();
}

// --- 推移グラフ (1日ごとの平均) ---
function trendData() {
  const byDay = new Map();
  for (const rec of state.swings || []) {
    if (trendCat !== 'all' && clubCat(rec.club) !== trendCat) continue;
    for (const sw of rec.swings || []) {
      const value = trendMetric === 'score_measure' ? measureScore(sw)
        : trendMetric === 'score_ai' ? sw.score
          : sw.pose?.items?.find((x) => x.key === trendMetric)?.value;
      if (typeof value !== 'number') continue;
      const key = dayKey(swingTime(rec, sw));
      if (!byDay.has(key)) byDay.set(key, { key, ts: swingTime(rec, sw), values: [] });
      byDay.get(key).values.push(value);
    }
  }
  return [...byDay.values()]
    .map((d) => ({ ...d, avg: d.values.reduce((a, b) => a + b, 0) / d.values.length }))
    .sort((a, b) => a.ts - b.ts);
}

function fmtMetric(v, unit) {
  const n = unit === ': 1' ? v.toFixed(1) : Math.round(v);
  return unit === ': 1' ? `${n} : 1` : `${n}${unit}`;
}

function renderTrend() {
  const box = $('#trend');
  if (!box) return;
  const metric = POSE_METRICS[trendMetric];
  const sel = (id, options, value, onchange) => {
    const s = el('select', { class: 'compare-select', id }, ...options.map(([v, l]) => {
      const o = el('option', { value: v }, l);
      if (v === value) o.selected = true;
      return o;
    }));
    s.addEventListener('change', () => onchange(s.value));
    return s;
  };
  const controls = el('div', { class: 'compare-pickers' },
    sel('trend-metric', Object.entries(POSE_METRICS).map(([k, m]) => [k, m.label]), trendMetric, (v) => { trendMetric = v; renderTrend(); }),
    sel('trend-cat', [['all', 'すべてのクラブ'], ...CLUB_CATS.map((c) => [c.id, c.label])], trendCat, (v) => { trendCat = v; renderTrend(); }));
  const data = trendData();
  if (!data.length) {
    const total = (state.swings || []).reduce((a, r) => a + (r.swings?.length || 0), 0);
    box.replaceChildren(controls, el('div', { class: 'empty' }, !total
      ? 'まだスイング動画の記録がありません。動画タブで動画を記録すると、ここに練習日ごとの推移が出ます。'
      : trendMetric === 'score_ai'
        ? 'AIの点数が付いた球がまだありません。動画タブで記録を開き「AIに分析・採点してもらう」を押すと出ます。'
        : `この項目を測れた球がまだありません（記録は${total}球あります）。動画タブの「まとめて測る」で姿勢を測ると出ます。項目によっては、正面か後方のどちらかから撮った動画でしか測れません。`));
    return;
  }
  // 目盛り: 目安の範囲と実際の値が両方入るようにする
  const vals = data.map((d) => d.avg);
  let lo = Math.min(...vals, metric.band[0]);
  let hi = Math.max(...vals, metric.band[1]);
  const padv = (hi - lo) * 0.1 || 1;
  lo = Math.max(0, lo - padv);
  hi += padv;
  const W = 340, H = 180, L = 40, R = 12, T = 12, B = 26;
  const x = (i) => (data.length === 1 ? (L + W - R) / 2 : L + (i / (data.length - 1)) * (W - L - R));
  const y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const ns = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs, text) => {
    const n = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (text != null) n.textContent = text;
    return n;
  };
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'trend-svg', role: 'img',
    'aria-label': `${metric.label}の推移。最新 ${fmtMetric(vals[vals.length - 1], metric.unit)}、目安 ${metric.band[0]}〜${metric.band[1]}` });
  // 目安の範囲
  svg.append(svgEl('rect', { x: L, width: W - L - R, y: y(Math.min(hi, metric.band[1])),
    height: Math.max(0, y(Math.max(lo, metric.band[0])) - y(Math.min(hi, metric.band[1]))), class: 'trend-band' }));
  // 目盛り (3本)
  for (let k = 0; k <= 2; k++) {
    const v = lo + ((hi - lo) * k) / 2;
    svg.append(svgEl('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'trend-grid' }));
    svg.append(svgEl('text', { x: L - 6, y: y(v) + 4, class: 'trend-axis', 'text-anchor': 'end' }, fmtMetric(v, metric.unit === ': 1' ? ': 1' : '')));
  }
  const first = data[0], last = data[data.length - 1];
  svg.append(svgEl('text', { x: x(0), y: H - 6, class: 'trend-axis', 'text-anchor': data.length === 1 ? 'middle' : 'start' }, fmtShort(first.ts).split(' ')[0]));
  if (data.length > 1) svg.append(svgEl('text', { x: x(data.length - 1), y: H - 6, class: 'trend-axis', 'text-anchor': 'end' }, fmtShort(last.ts).split(' ')[0]));
  if (data.length > 1) {
    svg.append(svgEl('polyline', { points: data.map((d, i) => `${x(i)},${y(d.avg)}`).join(' '), class: 'trend-line' }));
  }
  const tip = el('div', { class: 'trend-tip', hidden: '' });
  data.forEach((d, i) => {
    svg.append(svgEl('circle', { cx: x(i), cy: y(d.avg), r: 4, class: 'trend-dot' + (i === data.length - 1 ? ' last' : '') }));
    const hit = svgEl('circle', { cx: x(i), cy: y(d.avg), r: 14, class: 'trend-hit', tabindex: '0' });
    const show = () => {
      tip.hidden = false;
      tip.textContent = `${fmtDay(d.ts)}　${fmtMetric(d.avg, metric.unit)}（${d.values.length}球の平均）`;
    };
    hit.addEventListener('mouseenter', show);
    hit.addEventListener('focus', show);
    hit.addEventListener('click', show);
    svg.append(hit);
  });
  svg.addEventListener('mouseleave', () => { tip.hidden = true; });
  // 最新の値は直接書く
  svg.append(svgEl('text', { x: Math.min(x(data.length - 1), W - R), y: y(last.avg) - 10, class: 'trend-label', 'text-anchor': 'end' },
    fmtMetric(last.avg, metric.unit)));
  box.replaceChildren(controls, svg, tip,
    el('p', { class: 'muted small' }, `網かけは目安の範囲（${metric.band[0]}〜${metric.band[1]}${metric.unit === ': 1' ? '' : metric.unit}）。点は練習日ごとの平均です。点を押すと値が出ます。`));
}

// --- 撮影日時 ---
const SHOT_SOURCE = {
  meta: '動画の情報から読み取りました',
  name: 'ファイル名から読み取りました',
  file: 'ファイルの日付です。違っていたら直してください',
  upload: '撮影日時が見つからなかったので、取り込んだ時刻になっています。直してください',
  manual: '手で入力しました',
};
let shotTouched = false; // 撮影日時を自分で直したか

function toLocalInput(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function fromLocalInput(value) {
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function setShotTime(ms, source) {
  if (shotTouched || !ms) return;
  $('#shot-time').value = toLocalInput(ms);
  $('#shot-time').dataset.ms = String(ms);
  $('#shot-source').textContent = SHOT_SOURCE[source] || '';
  $('#shot-source').classList.toggle('warn', source === 'upload' || source === 'file');
}

// 入力欄の値 (分まで) が自動で読んだ時刻と同じ分なら、秒まで持っている元の値を使う
function chosenShotTime() {
  const auto = Number($('#shot-time').dataset.ms || 0);
  const typed = fromLocalInput($('#shot-time').value);
  if (!typed) return auto || null;
  return auto && toLocalInput(auto) === $('#shot-time').value ? auto : typed;
}

function timeEditor(rec, onSave) {
  const input = el('input', { type: 'datetime-local', class: 'time-input', 'aria-label': '撮影日時' });
  input.value = toLocalInput(recTime(rec));
  return el('div', { class: 'time-edit' },
    el('span', { class: 'small' }, '撮影日時'),
    input,
    el('button', { type: 'button', class: 'btn small primary', onclick: () => {
      const ms = fromLocalInput(input.value);
      if (!ms) { toast('日時を入力してください'); return; }
      onSave(ms);
    } }, '保存'),
    el('button', { type: 'button', class: 'btn small', onclick: () => { rec._editTime = false; renderSwingRecords(); } }, 'やめる'));
}

function applyShotTime(rec, ms) {
  rec.shotAt = ms;
  rec.shotAtSource = 'manual';
  for (const sw of rec.swings || []) sw.shotAt = ms + Math.round((sw.t || 0) * 1000);
  rec._editTime = false;
}

// --- 分類・点数 ---
const CLUB_CATS = [
  { id: 'driver', label: 'ドライバー', clubs: ['1W'] },
  { id: 'wood', label: 'ウッド', clubs: ['3W', '5W'] },
  { id: 'ut', label: 'UT', clubs: ['UT'] },
  { id: 'iron', label: 'アイアン', clubs: ['4I', '5I', '6I', '7I', '8I', '9I'] },
  { id: 'wedge', label: 'ウェッジ', clubs: ['PW', 'AW', 'SW', 'LW'] },
];
const RATINGS = [
  { id: 'all', label: 'すべて' },
  { id: 'model', label: '👍 お手本' },
  { id: 'good', label: '良い' },
  { id: 'ok', label: '普通' },
  { id: 'bad', label: '要改善' },
  { id: 'none', label: '未採点' },
  { id: 'notswing', label: 'スイングなし？' },
];
// 弾道のラベル (pc/server.py の FLIGHTS と同じ)
const FLIGHTS = [
  { id: 'straight', label: 'ストレート' }, { id: 'fade', label: 'フェード' }, { id: 'draw', label: 'ドロー' },
  { id: 'slice', label: 'スライス' }, { id: 'hook', label: 'フック' }, { id: 'push', label: 'プッシュ' },
  { id: 'pull', label: '引っかけ' }, { id: 'fat', label: 'ダフリ' }, { id: 'thin', label: 'トップ' }, { id: 'sky', label: 'テンプラ' },
];
const FLIGHT_LABEL = Object.fromEntries(FLIGHTS.map((f) => [f.id, f.label]));
const VERDICT_LABEL = { good: '良い', ok: '普通', bad: '要改善' };
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
let recFilter = { cat: 'all', rating: 'all', weak: null, flight: null, day: 'all', view: 'club', sort: 'high', basis: 'mix' };

// ---------- AI を使わない「計測点」 ----------
// 姿勢の計測の ◎○△ を点数にする。AI の点数があれば、分類にはそちらを優先する
const GRADE_POINTS = { '◎': 100, '○': 70, '△': 35 };
function measureScore(sw) {
  const items = (sw.pose?.items || []).filter((it) => it.grade in GRADE_POINTS);
  if (items.length < 3) return null;
  // 自分の苦手の項目は2倍、学習した重みがあればそれも掛ける
  return Math.round(scoreWith(sw, state.scoring?.weights || {}));
}

// ---------- 点数を自分の印に合わせる (学習)。AIは使わず、この画面の中で計算する ----------
// 印: お手本=良い、悪い例=悪い。印がなければ弾道で判断 (ストレート・フェード・ドロー=良い、それ以外のミス=悪い)
const FLIGHT_GOOD = ['straight', 'fade', 'draw'];
const FLIGHT_BAD = ['slice', 'hook', 'push', 'pull', 'fat', 'thin', 'sky'];
const WEIGHT_STEPS = [0.3, 0.6, 1, 1.5, 2, 3];
function userLabel(sw) {
  if (sw.mark === 'good') return 1;
  if (sw.mark === 'bad') return 0;
  if (FLIGHT_GOOD.includes(sw.flight)) return 1;
  if (FLIGHT_BAD.includes(sw.flight)) return 0;
  return null;
}
function labeledSwings() {
  return (state.swings || []).flatMap((r) => r.swings || [])
    .filter((sw) => userLabel(sw) != null && (sw.pose?.items || []).filter((it) => it.grade in GRADE_POINTS).length >= 3);
}
// 一致度: 「良い」の球と「悪い」の球を1組ずつ比べて、良いほうの点数が高い組の割合 (同点は半分)
function agreement(swings, scoreOf) {
  const pos = swings.filter((sw) => userLabel(sw) === 1).map(scoreOf);
  const neg = swings.filter((sw) => userLabel(sw) === 0).map(scoreOf);
  if (pos.length < 3 || neg.length < 3) return null;
  let s = 0;
  for (const a of pos) for (const b of neg) s += a > b ? 1 : a === b ? 0.5 : 0;
  return s / (pos.length * neg.length);
}
function scoreWith(sw, weights) {
  const items = (sw.pose?.items || []).filter((it) => it.grade in GRADE_POINTS);
  const fk = focusKeys();
  const w = (it) => (weights[it.key] ?? 1) * (fk.includes(it.key) ? 2 : 1);
  return items.reduce((a, it) => a + GRADE_POINTS[it.grade] * w(it), 0) / items.reduce((a, it) => a + w(it), 0);
}
function scoringStatus() {
  const swings = labeledSwings();
  const now = agreement(swings, (sw) => scoreWith(sw, state.scoring?.weights || {}));
  return { n: swings.length, good: swings.filter((sw) => userLabel(sw) === 1).length, bad: swings.filter((sw) => userLabel(sw) === 0).length, now };
}
// 項目ごとの重みを、一致度がいちばん高くなるように1つずつ選ぶ (同じくらいなら 1 に近いほう)
function learnScoring() {
  const swings = labeledSwings();
  const keys = [...new Set(swings.flatMap((sw) => sw.pose.items.map((it) => it.key)))];
  const before = agreement(swings, (sw) => scoreWith(sw, {}));
  if (before == null) return null;
  const weights = Object.fromEntries(keys.map((k) => [k, 1]));
  let best = before;
  for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    for (const k of keys) {
      let pick = weights[k]; let pickVal = best;
      for (const v of WEIGHT_STEPS) {
        const val = agreement(swings, (sw) => scoreWith(sw, { ...weights, [k]: v }));
        const closer = Math.abs(Math.log(v)) < Math.abs(Math.log(pick));
        // 球が少ないと偶然に合わせてしまうので、はっきり良くなるときだけ変える
        if (val > pickVal + 0.02 || (Math.abs(val - pickVal) <= 0.005 && closer && val >= best)) { pick = v; pickVal = val; }
      }
      if (pick !== weights[k]) { weights[k] = pick; best = pickVal; changed = true; }
    }
    if (!changed) break;
  }
  const labels = {};
  for (const sw of swings) for (const it of sw.pose.items) labels[it.key] = shortLabel(it.label);
  return { weights, labels, before, after: best, n: swings.length, at: Date.now() };
}
function applyLearnedScoring(auto = false) {
  const r = learnScoring();
  if (!r) {
    if (!auto) toast('学習するには、印（お手本・悪い例）か弾道を付けた球が、良い・悪いそれぞれ3球以上必要です');
    return;
  }
  state.scoring = r;
  save('profile');
  renderSwingRecords();
  toast(`点数をあなたの印に合わせました（一致度 ${Math.round(r.before * 100)}% → ${Math.round(r.after * 100)}%）`);
}
function resetScoring() {
  state.scoring = null;
  save('profile');
  renderSwingRecords();
}
// まとめて測ったあとなどに呼ぶ: 一致度が低いときだけ学習し直す
function autoLearnScoring() {
  const st = scoringStatus();
  if (st.now != null && st.now < 0.7) applyLearnedScoring(true);
}
let scoringOpen = false;
function scoringPanel() {
  const st = scoringStatus();
  const sc = state.scoring;
  const pct = (v) => `${Math.round(v * 100)}%`;
  const strong = sc ? Object.entries(sc.weights).filter(([, v]) => v !== 1).sort((a, b) => b[1] - a[1]) : [];
  const box = el('details', { class: 'filter-more scoring-panel' },
    el('summary', {}, st.now != null ? `点数とあなたの印の一致度: ${pct(st.now)}${sc ? '（学習済み）' : ''}` : '点数をあなたの印に合わせる（学習）'),
    el('p', { class: 'small' }, `印（👍お手本・👎悪い例）か弾道を付けた球: ${st.n}球（良い ${st.good}・悪い ${st.bad}）。`,
      st.now != null ? `良い球のほうが計測の点数が高い組の割合が ${pct(st.now)} です。` : '良い・悪いそれぞれ3球以上で学習できます。'),
    strong.length ? el('p', { class: 'small' }, '学習した重み: ', strong.map(([k, v]) => `${sc.labels?.[k] || k} ×${v}`).join('、')) : null,
    el('div', { class: 'cand-btns' },
      el('button', { type: 'button', class: 'btn small primary', onclick: () => applyLearnedScoring(), ...(st.now == null ? { disabled: '' } : {}) },
        sc ? '今の印でもう一度学習する' : '学習する'),
      sc ? el('button', { type: 'button', class: 'btn small', onclick: resetScoring }, '学習をやめて元の点数に戻す') : null),
    el('p', { class: 'muted tiny' }, '計測の項目ごとの重みを、あなたの印に合うように変えます（AIは使いません）。印が増えたら学習し直すと合いやすくなります。まとめて測ったあと、一致度が70%より低いときは自動で学習し直します。AI分析やコーチのメモにも、あなたの印と点数のずれを伝えます。'));
  box.open = scoringOpen;
  box.addEventListener('toggle', () => { scoringOpen = box.open; });
  return box;
}


// ---------- 私の苦手 (直したいクセ)。選んだ項目は計測の点数で2倍に数え、1球ごとに直せたかを出す ----------
const FOCUS_OPTIONS = [
  { id: 'rise', label: '体が起きる', keys: ['spine', 'head_up'] },
  { id: 'hip', label: 'お尻が前に出る', keys: ['hip_line'] },
  { id: 'head', label: '頭が動く', keys: ['head_side', 'sway'] },
  { id: 'arm', label: '左腕が曲がる', keys: ['lead_arm'] },
  { id: 'tempo', label: '打ち急ぐ（テンポ）', keys: ['tempo'] },
  { id: 'setup', label: 'アドレスの前傾が浅い・深い', keys: ['address_tilt'] },
  { id: 'finish', label: 'フィニッシュで体重が残る', keys: ['finish_weight'] },
];
function focusIds() { return state.focus?.ids || []; }
function focusKeys() { return FOCUS_OPTIONS.filter((f) => focusIds().includes(f.id)).flatMap((f) => f.keys); }
function focusLabels() { return FOCUS_OPTIONS.filter((f) => focusIds().includes(f.id)).map((f) => f.label); }
function focusText() {
  return [...focusLabels(), state.focus?.text || ''].filter(Boolean).join('、');
}
// 1球の苦手チェック: 苦手ごとに、関係する計測がすべて△でなければ「直せた」
function focusCheck(sw) {
  const items = sw.pose?.items || [];
  const out = [];
  for (const f of FOCUS_OPTIONS) {
    if (!focusIds().includes(f.id)) continue;
    const its = items.filter((it) => f.keys.includes(it.key) && it.grade in GRADE_POINTS);
    if (!its.length) continue;
    out.push({ label: f.label, ok: its.every((it) => it.grade !== '△') });
  }
  return out;
}
function focusSummary(swings) {
  const checked = swings.map(focusCheck).filter((c) => c.length);
  if (!checked.length) return '';
  const ok = checked.filter((c) => c.every((x) => x.ok)).length;
  return [' ・ 苦手を直せた球 ', el('b', {}, `${ok}/${checked.length}`)];
}

// 苦手ごとの「出なかった割合」 (その苦手に関係する計測が全部△でない球の割合)
function focusRates(swings, ids = focusIds()) {
  const out = [];
  for (const f of FOCUS_OPTIONS) {
    if (!ids.includes(f.id)) continue;
    const checked = swings.map((sw) => (sw.pose?.items || []).filter((it) => f.keys.includes(it.key) && it.grade in GRADE_POINTS)).filter((its) => its.length);
    if (!checked.length) continue;
    out.push({ id: f.id, label: f.label, n: checked.length, ok: checked.filter((its) => its.every((it) => it.grade !== '△')).length / checked.length });
  }
  return out;
}
function focusDayLine(swings) {
  const r = focusRates(swings);
  if (!r.length) return null;
  return el('div', { class: 'small focus-line focus-day' }, '苦手の解消率: ', ...r.map((x) =>
    el('span', { class: x.ok >= 0.7 ? 'focus-ok' : x.ok >= 0.4 ? '' : 'focus-ng' }, `${x.label} ${Math.round(x.ok * 100)}%`)));
}
// 最近の球から、苦手を自動で入れ替える。よく出ている項目は足し、しばらく出ていない項目は「卒業」
const FOCUS_RECENT = 40;
function autoUpdateFocus() {
  const f = state.focus || {};
  if (f.auto === false) return;
  const recent = (state.swings || []).flatMap((r) => (r.swings || []).map((sw) => ({ sw, t: swingTime(r, sw) })))
    .filter((x) => (x.sw.pose?.items || []).length && !x.sw.pose?.notSwing)
    .sort((a, b) => b.t - a.t).slice(0, FOCUS_RECENT);
  if (recent.length < 15) return;
  const days = new Set(recent.map((x) => dayKey(x.t))).size;
  const manual = f.manual || {};
  const fresh = (id) => manual[id] && Date.now() - manual[id] < 3 * 86400000; // 自分で変えて3日は触らない
  const rates = focusRates(recent.map((x) => x.sw), FOCUS_OPTIONS.map((o) => o.id)).filter((r) => r.n >= 10);
  let ids = [...focusIds()];
  const added = []; const removed = [];
  for (const r of rates) {
    if (fresh(r.id)) continue;
    const bad = 1 - r.ok;
    if (!ids.includes(r.id) && bad >= 0.4) { ids.push(r.id); added.push(`${r.label}（最近${r.n}球の${Math.round(bad * 100)}%で出ている）`); }
    else if (ids.includes(r.id) && bad <= 0.15 && days >= 2) { ids = ids.filter((x) => x !== r.id); removed.push(`${r.label}（最近${r.n}球で${Math.round(r.ok * 100)}%直せている）`); }
  }
  // 多すぎると意識できないので、よく出ている順に3つまで (自分で選んだものは残す)
  const badOf = (id) => 1 - (rates.find((r) => r.id === id)?.ok ?? 1);
  if (ids.length > 3) {
    const keep = ids.filter((id) => fresh(id));
    const rest = ids.filter((id) => !fresh(id)).sort((a, b) => badOf(b) - badOf(a));
    const kept = [...keep, ...rest].slice(0, Math.max(3, keep.length));
    for (const id of ids) if (!kept.includes(id)) removed.push(`${FOCUS_OPTIONS.find((o) => o.id === id).label}（ほかの苦手を優先）`);
    ids = ids.filter((id) => kept.includes(id));
    for (let k = added.length - 1; k >= 0; k--) if (!ids.some((id) => added[k].startsWith(FOCUS_OPTIONS.find((o) => o.id === id).label))) added.splice(k, 1);
  }
  if (!added.length && !removed.length) return;
  const history = [{ at: Date.now(), added, removed }, ...(f.history || [])].slice(0, 20);
  state.focus = { ...f, ids, history };
  save('profile');
  toast(['苦手を更新しました', added.length ? `追加: ${added.join('、')}` : '', removed.length ? `卒業: ${removed.join('、')}` : ''].filter(Boolean).join(' / '));
}
function setFocusAuto(on) {
  state.focus = { ...(state.focus || {}), auto: on };
  save('profile');
  if (on) autoUpdateFocus();
  renderSwingRecords();
}

function toggleFocus(id) {
  const ids = focusIds().includes(id) ? focusIds().filter((x) => x !== id) : [...focusIds(), id];
  state.focus = { ...(state.focus || {}), ids, manual: { ...(state.focus?.manual || {}), [id]: Date.now() } };
  save('profile');
  renderSwingRecords();
}
function focusHistoryView() {
  const h = (state.focus?.history || []).slice(0, 5);
  if (!h.length) return null;
  return el('div', { class: 'small' }, el('div', { class: 'strong' }, '苦手の入れ替え'),
    el('ul', { class: 'focus-history' }, h.map((x) => el('li', {}, `${fmtShort(x.at)} `,
      x.added.length ? `追加: ${x.added.join('、')} ` : '', x.removed.length ? `卒業: ${x.removed.join('、')}` : ''))));
}
// 日ごとの苦手の解消率 (新しい日から7日ぶん)
function focusTrendView() {
  if (!focusIds().length) return null;
  const byDay = new Map();
  for (const r of state.swings || []) for (const sw of r.swings || []) {
    const d = dayKey(swingTime(r, sw));
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d).push(sw);
  }
  const rows = [...byDay.keys()].sort().reverse().map((d) => ({ d, r: focusRates(byDay.get(d)) })).filter((x) => x.r.length).slice(0, 7);
  if (!rows.length) return null;
  const labels = focusLabels();
  return el('div', { class: 'small' }, el('div', { class: 'strong' }, '日ごとの苦手の解消率（その日の全スイングの平均）'),
    el('table', { class: 'focus-trend' },
      el('thead', {}, el('tr', {}, el('th', {}, '日付'), ...labels.map((l) => el('th', {}, l)))),
      el('tbody', {}, rows.map((x) => el('tr', {}, el('td', {}, fmtDayKey(x.d)),
        ...labels.map((l) => { const v = x.r.find((y) => y.label === l); return el('td', { class: v ? (v.ok >= 0.7 ? 'focus-ok' : v.ok >= 0.4 ? '' : 'focus-ng') : 'muted' }, v ? `${Math.round(v.ok * 100)}%（${v.n}球）` : '—'); }))))));
}
let focusPickerOpen = false;
function focusPicker() {
  const ids = focusIds();
  const input = el('input', { type: 'text', class: 'theme-input', value: state.focus?.text || '', placeholder: '計測できないクセ（例: 右肩が下がる）。AIに伝えます' });
  input.addEventListener('change', () => {
    state.focus = { ...(state.focus || {}), ids: focusIds(), text: input.value.trim() };
    save('profile');
    renderSwingRecords();
  });
  const box = el('details', { class: 'filter-more focus-picker' },
    el('summary', {}, ids.length || state.focus?.text ? `私の苦手: ${focusText()}` : '私の苦手（直したいクセ）を選ぶ'),
    el('div', { class: 'chips' }, ...FOCUS_OPTIONS.map((f) => el('button', {
      type: 'button', class: 'chip' + (ids.includes(f.id) ? ' selected' : ''), 'aria-pressed': String(ids.includes(f.id)),
      onclick: () => toggleFocus(f.id),
    }, f.label))),
    input,
    el('label', { class: 'small' }, el('input', { type: 'checkbox', ...(state.focus?.auto !== false ? { checked: '' } : {}), onchange: (e) => setFocusAuto(e.target.checked) }),
      ' 最近の球から自動で入れ替える（よく出ている苦手を足し、直せてきた苦手は卒業）'),
    focusHistoryView(),
    focusTrendView(),
    el('p', { class: 'muted tiny' }, '選んだ苦手は、計測の点数で2倍の重さで数え、1球ごとに「直せた／出た」を表示します。AI分析にも伝えて、直せているかを見てもらいます。'));
  // 選ぶたびに描き直すので、開いたままにしておく
  box.open = focusPickerOpen;
  box.addEventListener('toggle', () => { focusPickerOpen = box.open; });
  return box;
}

function verdictOf(score) { return score == null ? null : score >= 75 ? 'good' : score >= 50 ? 'ok' : 'bad'; }
// 並べ替え・順位・平均に使う点数。総合は、計測とAIの両方があればその平均 (片方だけならその点数)
function effScore(sw) {
  const m = measureScore(sw); const a = sw.score ?? null;
  if (recFilter.basis === 'measure') return m ?? a;
  if (recFilter.basis === 'ai') return a ?? m;
  return m != null && a != null ? Math.round((m + a) / 2) : a ?? m;
}
function effVerdict(sw) { return verdictOf(effScore(sw)); }
function shortLabel(label) { return label.replace(/（.*?）/g, ''); }
function weakPoints(sw) { return (sw.pose?.items || []).filter((it) => it.grade === '△').map((it) => shortLabel(it.label)); }

function clubCat(club) { return CLUB_CATS.find((c) => c.clubs.includes(club))?.id || 'other'; }
function recTime(rec) { return rec.shotAt || rec.at; }
function swingTime(rec, sw) { return sw.shotAt || recTime(rec); }
const pad2 = (n) => String(n).padStart(2, '0');
function fmtHM(ts) { const d = new Date(ts); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
function fmtHMS(ts) { const d = new Date(ts); return `${fmtHM(ts)}:${pad2(d.getSeconds())}`; }
function fmtDay(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${WEEKDAYS[d.getDay()]}）`;
}
function fmtShort(ts) { const d = new Date(ts); return `${d.getMonth() + 1}/${d.getDate()} ${fmtHM(ts)}`; }
function dayKey(ts) { const d = new Date(ts); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }

function swingMatches(sw) {
  if (recFilter.weak && !weakPoints(sw).includes(recFilter.weak)) return false;
  if (recFilter.flight && sw.flight !== recFilter.flight) return false;
  switch (recFilter.rating) {
    case 'model': return sw.mark === 'good';
    case 'good': return effVerdict(sw) === 'good';
    case 'ok': return effVerdict(sw) === 'ok';
    case 'bad': return effVerdict(sw) === 'bad' || sw.mark === 'bad';
    case 'none': return effScore(sw) == null;
    case 'notswing': return !!sw.pose?.notSwing;
    default: return true;
  }
}

function scoreBadge(score, verdict) {
  if (score == null) return null;
  return el('span', { class: `score-badge ${verdict || ''}` }, `${score}点`, verdict ? ` ${VERDICT_LABEL[verdict]}` : '');
}

function swingLabel(rec, idx) {
  const sw = rec.swings[idx];
  return `${fmtShort(swingTime(rec, sw))} ${clubName(rec.club)} ${idx + 1}球目`
    + (sw.score != null ? ` ${sw.score}点` : '') + (sw.mark === 'good' ? ' 👍' : sw.mark === 'bad' ? ' 👎' : '');
}

function allSwings() {
  return (state.swings || []).flatMap((rec) => (rec.swings || []).map((sw, idx) => ({ rec, sw, idx })))
    .sort((a, b) => swingTime(b.rec, b.sw) - swingTime(a.rec, a.sw));
}

// 同じ種類のクラブで、👍 を付けた中の最新、なければ一番点数の高い球
function findModel(rec, idx) {
  const cat = clubCat(rec.club);
  const others = allSwings().filter((x) => clubCat(x.rec.club) === cat && !(x.rec.id === rec.id && x.idx === idx));
  return others.find((x) => x.sw.mark === 'good')
    || others.filter((x) => x.sw.score != null).sort((a, b) => b.sw.score - a.sw.score)[0];
}

async function deleteSwingItem(rec, i) {
  if (rec._running) { toast('AI 分析が終わってから削除してください'); return; }
  const last = rec.swings.length === 1;
  if (!(await askConfirm(last
    ? 'この球を削除しますか？この記録に残っている最後の1球なので、記録ごと消えます。元に戻せません。'
    : `${i + 1}球目を削除しますか？画像と動画も消え、元に戻せません。`, '削除'))) return;
  const sw = rec.swings[i];
  rec.swings.splice(i, 1);
  compareSel = compareSel.filter((c) => !(c.recId === rec.id && c.idx === i))
    .map((c) => (c.recId === rec.id && c.idx > i ? { ...c, idx: c.idx - 1 } : c));
  if (!rec.swings.length) state.swings = state.swings.filter((r) => r.id !== rec.id);
  const scored = rec.swings.filter((x) => x.score != null).map((x) => x.score);
  rec.score = scored.length ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : null;
  save('deleteSwingItem', { id: rec.id, clip: sw.clip });
  renderSwingRecords();
  renderTrend();
  toast('削除しました');
}

// スイングしていないとわかった球をまとめて消す
async function deleteNotSwings(list) {
  if (!(await askConfirm(`スイングしていない球を${list.length}球、まとめて削除しますか？画像と動画も消え、元に戻せません。`
    + '心配なときは先に「確かめる」で見てください。', '削除'))) return;
  for (const { r, sw } of list) {
    if (r._running) continue;
    r.swings = r.swings.filter((x) => x !== sw);
    if (!r.swings.length) state.swings = state.swings.filter((x) => x.id !== r.id);
    await save('deleteSwingItem', { id: r.id, clip: sw.clip });
  }
  compareSel = [];
  await reloadState().catch(() => {});
  if (recFilter.rating === 'notswing') recFilter.rating = 'all';
  renderSwingRecords();
  renderTrend();
  toast(`${list.length}球を削除しました`);
}

function setMark(rec, idx, mark) {
  const sw = rec.swings[idx];
  sw.mark = sw.mark === mark ? null : mark;
  save('swingMark', { id: rec.id, idx, mark: sw.mark });
  renderSwingRecords();
}

// --- 比較 ---
function setCompare(sel) {
  compareSel = sel;
  renderSwingRecords();
  $('#compare-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function toggleCompare(recId, idx) {
  const k = compareSel.findIndex((c) => c.recId === recId && c.idx === idx);
  if (k >= 0) compareSel.splice(k, 1);
  else {
    compareSel.push({ recId, idx });
    if (compareSel.length > 2) compareSel.shift();
  }
  if (compareSel.length === 2) setCompare(compareSel);
  else {
    renderSwingRecords();
    toast('もう1球選ぶと比較できます');
  }
}

function compareWithModel(rec, idx) {
  const model = findModel(rec, idx);
  if (!model) { toast('比べるお手本がまだありません。良かった球に 👍 を付けてください'); return; }
  setCompare([{ recId: model.rec.id, idx: model.idx }, { recId: rec.id, idx }]);
}

function renderCompare() {
  const swings = allSwings();
  $('#compare-card').hidden = swings.length < 2;
  if (swings.length < 2) return;
  compareSel = compareSel.filter((c) => state.swings.find((r) => r.id === c.recId)?.swings[c.idx]);
  const selectFor = (slot) => {
    const cur = compareSel[slot];
    const s = el('select', { class: 'compare-select', 'aria-label': slot ? '比べるスイング (右)' : '比べるスイング (左)' },
      el('option', { value: '' }, '選んでください'),
      ...swings.map((x) => {
        const o = el('option', { value: `${x.rec.id}:${x.idx}` }, swingLabel(x.rec, x.idx));
        if (cur && cur.recId === x.rec.id && cur.idx === x.idx) o.selected = true;
        return o;
      }));
    s.addEventListener('change', () => {
      const next = [compareSel[0], compareSel[1]];
      if (s.value) {
        const [recId, idx] = s.value.split(':');
        next[slot] = { recId, idx: Number(idx) };
      } else next[slot] = undefined;
      compareSel = next.filter(Boolean).length === 2 ? next : next.filter(Boolean);
      renderSwingRecords();
    });
    return s;
  };
  const pickers = el('div', { class: 'compare-pickers' }, selectFor(0), selectFor(1));
  const items = compareSel.length === 2
    ? compareSel.map((c) => { const rec = state.swings.find((r) => r.id === c.recId); return { rec, sw: rec.swings[c.idx], idx: c.idx }; })
    : null;
  if (!items) {
    $('#compare-body').replaceChildren(pickers,
      el('p', { class: 'muted small' }, '2球選ぶと、局面ごとに並べて比べられます。各球の「お手本と比較」からも開けます。'));
    return;
  }
  const [a, b] = items.map((x) => x.sw);
  // コマ数が違う記録どうしは、インパクトからの時間が近いコマを並べる
  const base = phasesOf(a).length <= phasesOf(b).length ? a : b;
  const nearest = (sw, dt) => phasesOf(sw).reduce((best, p, i, arr) =>
    (Math.abs(p.dt - dt) < Math.abs(arr[best].dt - dt) ? i : best), 0);
  const head = (x) => el('div', { class: 'small' },
    el('div', { class: 'strong' }, `${fmtShort(swingTime(x.rec, x.sw))} ${clubName(x.rec.club)}`),
    el('div', {}, `${x.idx + 1}球目 `, scoreBadge(x.sw.score, x.sw.verdict)),
    x.sw.aiNote ? el('div', { class: 'muted' }, x.sw.aiNote) : null);
  $('#compare-body').replaceChildren(
    pickers,
    el('div', { class: 'compare-row compare-head' }, el('div', {}), head(items[0]), head(items[1])),
    trailSrc(a) || trailSrc(b)
      ? el('div', { class: 'compare-row' },
        el('div', { class: 'muted small phase-label' }, 'クラブ軌道'),
        trailSrc(a) ? el('img', { class: 'trail-img', src: trailSrc(a), alt: 'クラブ軌道' }) : el('div', { class: 'muted small' }, 'なし'),
        trailSrc(b) ? el('img', { class: 'trail-img', src: trailSrc(b), alt: 'クラブ軌道' }) : el('div', { class: 'muted small' }, 'なし'))
      : '',
    ...phasesOf(base).map((ph) => el('div', { class: 'compare-row' },
      el('div', { class: 'muted small phase-label' }, ph.label),
      frameView(a, nearest(a, ph.dt), 'frame big'),
      frameView(b, nearest(b, ph.dt), 'frame big'))));
}

// --- 記録一覧 ---
function flightCounts(cat = 'all') {
  const counts = {};
  for (const rec of state.swings || []) {
    if (cat !== 'all' && clubCat(rec.club) !== cat) continue;
    for (const sw of rec.swings || []) if (sw.flight) counts[sw.flight] = (counts[sw.flight] || 0) + 1;
  }
  return FLIGHTS.filter((f) => counts[f.id]).map((f) => [f.id, counts[f.id]]);
}

function stripTransient(rec) {
  const out = {};
  for (const [k, v] of Object.entries(rec)) if (!k.startsWith('_')) out[k] = v;
  return out;
}

function setFlight(rec, i, flight) {
  const sw = rec.swings[i];
  sw.flight = sw.flight === flight ? null : flight;
  if (sw.clip) save('swingFlight', { id: rec.id, clip: sw.clip, flight: sw.flight });
  else save('swing', stripTransient(rec));
  renderSwingRecords();
}

// 1球ごとの弾道ラベル。自動で推定した弾道 (試験版) があれば、その候補も出す
// 自動で追ったボールの向きを、わずかな左右も含めてことばにする (右打ちなら + が右)
function ballText(b) {
  const word = (v, small, big) => (v == null ? null : Math.abs(v) < small ? null : `${Math.abs(v) < big ? 'わずかに' : ''}${v > 0 ? '右' : '左'}`);
  const start = word(b.start, 0.01, 0.05);
  const curve = word(b.curve, 0.005, 0.035);
  const detail = [start ? `出だしは${start}` : null, b.curve == null ? '曲がりは見えず' : curve ? `${curve}へ曲がる` : null].filter(Boolean).join('・');
  const head = b.label === 'straight' ? 'ほぼまっすぐ' : `${FLIGHT_LABEL[b.label] || b.label}かも`;
  return detail ? `${head}（${detail}）` : head;
}

function flightPicker(rec, sw, i) {
  const auto = sw.ballAuto?.label;
  return el('div', { class: 'flight-row' },
    el('span', { class: 'muted small' }, '弾道:'),
    ...FLIGHTS.map((f) => el('button', {
      type: 'button', class: 'chip' + (sw.flight === f.id ? ' selected' : ''), 'aria-pressed': String(sw.flight === f.id),
      onclick: () => setFlight(rec, i, f.id),
    }, f.label)),
    auto && !sw.flight ? el('span', { class: 'flight-auto' }, `自動（試験版）: ${ballText(sw.ballAuto)}`) : null);
}

function renderRecordFilters() {
  const counts = {};
  for (const rec of state.swings || []) counts[clubCat(rec.club)] = (counts[clubCat(rec.club)] || 0) + 1;
  const weakCounts = {};
  for (const rec of state.swings || []) {
    if (recFilter.cat !== 'all' && clubCat(rec.club) !== recFilter.cat) continue;
    for (const sw of rec.swings || []) for (const w of weakPoints(sw)) weakCounts[w] = (weakCounts[w] || 0) + 1;
  }
  const weaks = Object.entries(weakCounts).sort((a, b) => b[1] - a[1]);
  const days = [...new Set((state.swings || []).map((r) => dayKey(recTime(r))))].sort().reverse();
  const chip = (active, label, onclick) => el('button', { type: 'button', class: 'chip' + (active ? ' selected' : ''), onclick }, label);
  const set = (k, v) => () => { recFilter[k] = v; renderSwingRecords(); };
  const select = (label, key, options) => {
    const s = el('select', { 'aria-label': label }, ...options.map(([v, l]) => {
      const o = el('option', { value: v }, l);
      if (v === recFilter[key]) o.selected = true;
      return o;
    }));
    s.addEventListener('change', () => { recFilter[key] = s.value; if (key === 'view') recFilter.backTo = null; renderSwingRecords(); });
    return el('label', {}, label, s);
  };
  const active = [recFilter.cat !== 'all', recFilter.rating !== 'all', !!recFilter.flight, !!recFilter.weak].filter(Boolean).length;
  const more = el('details', { class: 'filter-more' },
    el('summary', {}, active ? `絞り込み（${active}件の条件）` : '絞り込み（クラブ・良い/悪い・弾道・苦手）'),
    el('div', { class: 'chips' },
      chip(recFilter.cat === 'all', 'すべてのクラブ', set('cat', 'all')),
      ...CLUB_CATS.filter((c) => counts[c.id]).map((c) => chip(recFilter.cat === c.id, c.label, set('cat', c.id)))),
    el('div', { class: 'chips' },
      ...RATINGS.map((r) => chip(recFilter.rating === r.id, r.id === 'all' ? '点数・印: すべて' : r.label, set('rating', r.id)))),
    flightCounts(recFilter.cat).length ? el('div', { class: 'chips' },
      chip(!recFilter.flight, '弾道: すべて', set('flight', null)),
      ...flightCounts(recFilter.cat).map(([f, n]) => chip(recFilter.flight === f, `${FLIGHT_LABEL[f]} ${n}`, set('flight', f)))) : null,
    weaks.length ? el('div', { class: 'chips' },
      chip(!recFilter.weak, '△の項目: すべて', set('weak', null)),
      ...weaks.map(([w, n]) => chip(recFilter.weak === w, `${w} ${n}`, set('weak', w)))) : null,
    el('p', { class: 'muted tiny' }, '「計測」は姿勢の計測から自動で付けた点数（AIなし）、「AI」はAI分析の点数です。良い／普通／要改善は、AIの点数があればそちらで分けます。'));
  if (active) more.open = true;
  const back = recFilter.view === 'records' && recFilter.backTo
    ? el('button', { type: 'button', class: 'btn small primary', onclick: () => { recFilter.view = recFilter.backTo; recFilter.backTo = null; renderSwingRecords(); } },
      `← ${{ club: 'クラブごと', day: '日付ごと', clubday: '日付×クラブ' }[recFilter.backTo] || '前'}の一覧に戻る`)
    : null;
  $('#record-filters').replaceChildren(...[
    back,
    el('div', { class: 'rec-toolbar' },
      select('並べ方', 'view', [['club', 'クラブごと'], ['day', '日付ごと'], ['clubday', '日付×クラブ'], ['records', '記録（動画）ごと']]),
      recFilter.view !== 'records' ? select('順番', 'sort', [['high', '点数が高い順'], ['low', '点数が低い順'], ['new', '新しい順']]) : null,
      select('点数', 'basis', [['mix', '総合（計測とAIの平均）'], ['measure', '計測の点数'], ['ai', 'AIの点数']]),
      select('日付', 'day', [['all', 'すべての日'], ...days.map((d) => [d, fmtDayKey(d)])]),
      chip(showLines, showLines ? '補助線: 表示中' : '補助線を表示', toggleLines)),
    showLines ? el('p', { class: 'small lines-legend' },
      el('span', { class: 'lg-head' }, '●'), ' アドレスの頭の位置　',
      el('span', { class: 'lg-spine' }, '━'), ' アドレスの背骨の傾き　',
      el('span', { class: 'lg-butt' }, '┃'), ' アドレスのお尻の位置（後方から）　',
      el('span', {}, '━'), ' そのときの背骨') : null,
    focusPicker(),
    scoringPanel(),
    more,
  ].filter(Boolean));
}

function renderSwingRow(rec, sw, i) {
  const sel = compareSel.some((c) => c.recId === rec.id && c.idx === i);
  return el('div', { class: 'swing-row' + (sw.mark === 'good' ? ' model' : '') },
    el('div', { class: 'swing-head' },
      el('div', {},
        el('span', { class: 'strong' }, `${i + 1}球目`),
        el('span', { class: 'muted small' }, ` ${fmtHMS(swingTime(rec, sw))}`),
        ' ', measureScore(sw) != null ? el('span', { class: `score-badge ${verdictOf(measureScore(sw))}` }, `計測 ${measureScore(sw)}点`) : null,
        ' ', sw.score != null ? el('span', { class: `score-badge ${sw.verdict || ''}` }, `AI ${sw.score}点`, sw.verdict ? ` ${VERDICT_LABEL[sw.verdict]}` : '') : null,
        sw.aiNote ? el('div', { class: 'muted small' }, sw.aiNote) : null),
      el('div', { class: 'cand-btns' },
        el('button', { type: 'button', class: 'btn small' + (sw.mark === 'good' ? ' selected-btn' : ''), onclick: () => setMark(rec, i, 'good'), 'aria-pressed': String(sw.mark === 'good') }, '👍 お手本'),
        el('button', { type: 'button', class: 'btn small' + (sw.mark === 'bad' ? ' bad-btn' : ''), onclick: () => setMark(rec, i, 'bad'), 'aria-pressed': String(sw.mark === 'bad') }, '👎 悪い例'))),
    // 左の列: 動画と軌道。右の列: 弾道・コマ・計測・AI (動画が縦長でも右がその下に押し下げられないように)
    el('div', { class: 'swing-col-a' },
      clipPlayer(sw, `${i + 1}球目の動画`),
      trailFigure(sw, i)),
    el('div', { class: 'swing-col-b' },
    flightPicker(rec, sw, i),
    el('div', { class: 'frame-strip' }, phasesOf(sw).map((ph, k) => el('figure', {},
      frameView(sw, k), el('figcaption', {}, ph.label))).map((fig, k) => {
      fig.addEventListener('click', () => openFrameZoom(sw, k));
      return fig;
    })),
    renderPose(sw),
    swingAiBox(rec, sw, i),
    el('div', { class: 'cand-btns' },
      el('button', { type: 'button', class: 'btn small', onclick: () => compareWithModel(rec, i) }, 'お手本と比較'),
      el('button', { type: 'button', class: 'btn small' + (sel ? ' selected-btn' : ''), onclick: () => toggleCompare(rec.id, i) },
        sel ? '比較に選択中' : '比較に選ぶ'),
      !rec._running
        ? el('button', { type: 'button', class: 'btn small', onclick: () => analyzeRecord(rec, sw.clip) },
          sw.aiText ? 'この球をAIでもう一度分析' : 'この球だけAIに分析・採点')
        : null,
      el('button', { type: 'button', class: 'btn small danger', onclick: () => deleteSwingItem(rec, i) }, 'この球を削除'))));
}

// 1球だけの AI 分析の結果 (分析中はその途中経過)
function swingAiBox(rec, sw, i) {
  if (rec._running && rec._only === sw.clip) {
    const live = el('div', { class: 'ai-result swing-ai-live' });
    if (rec._partial) live.innerHTML = renderAnalysis(rec._partial);
    return el('div', { class: 'pose-box' }, el('div', { class: 'small strong' }, `${i + 1}球目のAI分析`),
      el('p', { class: 'muted small' }, rec._status || 'AIが分析しています…'), live);
  }
  if (!sw.aiText) return null;
  const body = el('div', { class: 'ai-result' });
  body.innerHTML = renderAnalysis(sw.aiText);
  return el('details', { class: 'pose-box swing-ai' },
    el('summary', { class: 'small strong' }, `${i + 1}球目のAI分析を見る`), body);
}

// 開く前に1球ごとの違いがひと目でわかるカード
function swingCard(rec, i, withTime = false) {
  const sw = rec.swings[i];
  if (collectingCards) cardOrder.push({ rec, i });
  const ms = measureScore(sw);
  const weak = weakPoints(sw);
  return el('button', {
    type: 'button', class: 'swing-card' + (sw.mark === 'good' ? ' model' : sw.mark === 'bad' ? ' bad' : ''),
    onclick: () => openViewerFor(rec, i),
    'aria-label': `${i + 1}球目を大きく見る`,
  },
  frameView(sw, impactIndex(sw), 'frame card-thumb'),
  el('div', { class: 'swing-card-info' },
    el('div', { class: 'small strong' },
      withTime === 'day' ? `${fmtShort(swingTime(rec, sw))}` : withTime ? `${fmtHM(swingTime(rec, sw))} ${i + 1}球目` : `${i + 1}球目`,
      sw.mark === 'good' ? ' 👍' : sw.mark === 'bad' ? ' 👎' : ''),
    withTime === true ? el('div', { class: 'tiny muted' }, clubName(rec.club)) : null,
    el('div', { class: 'card-scores' },
      ms != null ? el('span', { class: `score-badge ${verdictOf(ms)}`, title: '姿勢の計測からの点数（AIなし）' }, `計測 ${ms}`) : null,
      sw.score != null ? el('span', { class: `score-badge ${sw.verdict || ''}`, title: 'AIの点数' }, `AI ${sw.score}`) : null,
      ms == null && sw.score == null ? el('span', { class: 'score-badge' + (sw.pose?.notSwing ? ' bad' : '') },
        sw.pose?.notSwing ? 'スイングなし？' : sw.pose?.error ? '測れず' : '未採点') : null),
    sw.flight ? el('span', { class: 'flight-badge' }, FLIGHT_LABEL[sw.flight]) : null,
    focusCheck(sw).length ? el('div', { class: 'tiny focus-line' }, ...focusCheck(sw).map((c) =>
      el('span', { class: c.ok ? 'focus-ok' : 'focus-ng' }, `${c.ok ? '✓' : '✗'} ${c.label}`))) : null,
    weak.length ? el('div', { class: 'tiny weak-text' }, `△ ${weak.slice(0, 2).join('・')}`) : null,
    sw.aiNote ? el('div', { class: 'tiny swing-card-note' }, sw.aiNote) : null));
}

// ---------- 1球を大きく見る画面 (前後の球へページ送りできる) ----------
let collectingCards = false;
let cardOrder = []; // 一覧に並んでいる順の { rec, i }
let viewer = null;  // { list, pos }

function overlay(id, cls) {
  let box = document.getElementById(id);
  if (!box) {
    box = el('div', { id, class: cls, hidden: '' });
    box.addEventListener('click', (e) => { if (e.target === box) (id === 'frame-zoom' ? closeFrameZoom : closeViewer)(); });
    document.body.append(box);
  }
  return box;
}

function openViewerFor(rec, i) {
  const list = cardOrder.some((x) => x.rec === rec && x.i === i) ? [...cardOrder] : [{ rec, i }];
  viewer = { list, pos: list.findIndex((x) => x.rec === rec && x.i === i) };
  renderViewer(true);
}

function moveViewer(d) {
  if (!viewer) return;
  viewer.pos = Math.min(viewer.list.length - 1, Math.max(0, viewer.pos + d));
  renderViewer(true);
}

function closeViewer() {
  viewer = null;
  const box = overlay('swing-viewer', 'viewer');
  box.querySelectorAll('video').forEach((v) => v.pause());
  box.hidden = true;
  box.replaceChildren();
  document.body.style.overflow = '';
}

function renderViewer(toTop = false) {
  if (!viewer) return;
  // 削除などで球がなくなっていたら、一覧から外す
  // 記録を読み直すと中身が新しいものに置き換わるので、id で今の記録に付け替える (古いままだと閉じてしまう)
  viewer.list = viewer.list.map((x) => ({ ...x, rec: (state.swings || []).find((r) => r.id === x.rec.id) }))
    .filter((x) => x.rec && x.rec.swings[x.i]);
  if (!viewer.list.length) { closeViewer(); return; }
  viewer.pos = Math.min(viewer.pos, viewer.list.length - 1);
  const { rec, i } = viewer.list[viewer.pos];
  const sw = rec.swings[i];
  const box = overlay('swing-viewer', 'viewer');
  const prevTop = box.hidden || toTop ? 0 : box.scrollTop;
  const n = viewer.list.length;
  box.replaceChildren(el('div', { class: 'viewer-panel', role: 'dialog', 'aria-label': '1球を大きく見る' },
    el('div', { class: 'viewer-bar' },
      el('button', { type: 'button', class: 'btn small', onclick: () => moveViewer(-1), ...(viewer.pos === 0 ? { disabled: '' } : {}) }, '◀ 前の球'),
      el('span', { class: 'viewer-title' }, `${clubName(rec.club)}　${fmtShort(swingTime(rec, sw))}　${i + 1}球目`,
        n > 1 ? el('span', { class: 'muted small' }, `（${viewer.pos + 1} / ${n}）`) : ''),
      el('button', { type: 'button', class: 'btn small', onclick: () => moveViewer(1), ...(viewer.pos === n - 1 ? { disabled: '' } : {}) }, '次の球 ▶'),
      el('button', { type: 'button', class: 'btn small', onclick: closeViewer, 'aria-label': '閉じる' }, '✕ 閉じる')),
    renderSwingRow(rec, sw, i),
    el('p', { class: 'muted tiny' }, '← → キーで前後の球、Esc で閉じます。コマ画像を押すと大きく見られます。')));
  // 分析の途中経過などで描き直すときは、見ていた位置のままにする
  box.hidden = false;
  box.scrollTop = prevTop;
  document.body.style.overflow = 'hidden';
}

// コマ画像を大きく見る (◀ ▶ でコマ送り)
let zoom = null; // { sw, k }
function openFrameZoom(sw, k) { zoom = { sw, k }; renderFrameZoom(); }
function closeFrameZoom() {
  zoom = null;
  const box = overlay('frame-zoom', 'zoom');
  box.hidden = true;
  box.replaceChildren();
}
function moveFrameZoom(d) {
  if (!zoom) return;
  zoom.k = Math.min(phasesOf(zoom.sw).length - 1, Math.max(0, zoom.k + d));
  renderFrameZoom();
}
function renderFrameZoom() {
  const { sw, k } = zoom;
  const phases = phasesOf(sw);
  const box = overlay('frame-zoom', 'zoom');
  box.replaceChildren(el('div', { class: 'zoom-panel' },
    frameView(sw, k, 'frame zoom-frame'),
    el('div', { class: 'zoom-nav' },
      el('button', { type: 'button', class: 'btn', onclick: () => moveFrameZoom(-1), ...(k === 0 ? { disabled: '' } : {}) }, '◀'),
      el('span', { class: 'zoom-label' }, `${phases[k].label}（${k + 1} / ${phases.length}）`),
      el('button', { type: 'button', class: 'btn', onclick: () => moveFrameZoom(1), ...(k === phases.length - 1 ? { disabled: '' } : {}) }, '▶'),
      el('button', { type: 'button', class: 'btn', onclick: closeFrameZoom }, '✕'))));
  box.hidden = false;
}

document.addEventListener('keydown', (e) => {
  if (/^(INPUT|TEXTAREA|SELECT|VIDEO)$/.test(e.target.tagName)) return;
  const d = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
  if (zoom) {
    if (e.key === 'Escape') closeFrameZoom();
    else if (d) { e.preventDefault(); moveFrameZoom(d); }
  } else if (viewer) {
    if (e.key === 'Escape') closeViewer();
    else if (d) { e.preventDefault(); moveViewer(d); }
  }
});

function openSwing(rec) {
  if (recFilter.view !== 'records') recFilter.backTo = recFilter.view;
  recFilter.view = 'records';
  openRecords.add(rec.id);
  renderSwingRecords();
  requestAnimationFrame(() => $(`#rec-${rec.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
}

async function scoreRecord(rec) {
  rec._status = 'AIが点数を付けています…';
  renderSwingRecords();
  try {
    await post(`api/swings/${rec.id}/score`);
    await reloadState();
    toast('点数を付けました');
  } catch (e) {
    rec._status = e.message;
  }
  renderSwingRecords();
  renderTrend();
}

function renderRecord(rec, visibleIdx) {
  const open = openRecords.has(rec.id);
  const total = rec.swings?.length || 0;
  const head = el('button', {
    type: 'button', class: 'history-toggle', 'aria-expanded': String(open),
    onclick: () => { open ? openRecords.delete(rec.id) : openRecords.add(rec.id); renderSwingRecords(); },
  },
  el('span', { class: 'rec-title' },
    el('span', { class: 'strong' }, `${fmtHM(recTime(rec))}  ${clubName(rec.club)}  ${total}球`),
    rec.score != null ? el('span', { class: 'score-badge' }, `平均 ${rec.score}点`) : null),
  el('span', { class: 'muted small' },
    [rec.angle, rec.concern, rec.text ? 'AI分析済み' : null, visibleIdx.length < total ? `${visibleIdx.length}球が条件に合う` : null]
      .filter(Boolean).join(' ・ ')));

  const editor = open && rec._editTime ? timeEditor(rec, async (ms) => {
    applyShotTime(rec, ms);
    await save('swingTime', { id: rec.id, shotAt: ms });
    renderSwingRecords();
    toast('撮影日時を直しました');
  }) : null;
  const strip = total && !open
    ? el('div', { class: 'swing-cards' }, visibleIdx.map((i) => swingCard(rec, i)))
    : null;

  let body = null;
  if (open) {
    const text = rec._partial ?? rec.text;
    const analysis = el('div', { class: 'ai-result' });
    if (text) analysis.innerHTML = renderAnalysis(text);
    body = el('div', { class: 'rec-body' },
      editor,
      rec.memo ? el('p', { class: 'small' }, `📝 ${rec.memo}`) : null,
      ...visibleIdx.map((i) => renderSwingRow(rec, rec.swings[i], i)),
      el('p', { class: 'muted small rec-status' }, rec._status || ''),
      config.poseProblem && rec.swings.some((sw) => !sw.pose || sw.pose.error)
        ? el('p', { class: 'small warn-text' }, `姿勢の計測が使えません: ${config.poseProblem}`) : null,
      analysis,
      rec.text && (firstItemUnder(rec.text, '次に試すこと') || firstItemUnder(rec.text, '改善ポイント'))
        ? el('div', { class: 'cand-btns' }, el('button', {
          type: 'button', class: 'btn small primary',
          onclick: () => setTheme(firstItemUnder(rec.text, '次に試すこと') || firstItemUnder(rec.text, '改善ポイント'), 'swing'),
        }, '「次に試すこと」を次回のテーマにする'))
        : null,
      el('div', { class: 'rec-actions' },
        rec._running
          ? el('button', { type: 'button', class: 'btn small danger', onclick: () => post(`api/swings/${rec.id}/cancel`) }, '分析を中止')
          : (total
            ? el('button', { type: 'button', class: 'btn small', onclick: () => analyzeRecord(rec) }, rec.text ? 'AIにもう一度分析・採点してもらう' : 'AIに分析・採点してもらう')
            : null),
        rec.text && !rec._running && total && rec.swings.every((sw) => sw.score == null)
          ? el('button', { type: 'button', class: 'btn small primary', onclick: () => scoreRecord(rec) }, '点数を付ける')
          : null,
        total && !rec._poseRunning
          ? el('button', { type: 'button', class: 'btn small', onclick: () => measurePose(rec) },
            rec.swings.every((sw) => sw.pose && !sw.pose.error) ? '姿勢を測り直す' : '姿勢を測る')
          : null,
        el('button', { type: 'button', class: 'btn small', onclick: () => { rec._editTime = true; renderSwingRecords(); } }, '撮影日時を直す'),
        el('button', { type: 'button', class: 'btn small danger', onclick: () => deleteRecord(rec) }, '記録を削除')));
  }
  return el('div', { class: 'history-item', id: `rec-${rec.id}` }, head, strip, body);
}

// まだ姿勢を測っていない記録を、まとめて測る (AIは使わない)
let poseAll = null; // { message }
function renderPoseAll() {
  const n = (state.swings || []).filter((r) => (r.swings || []).some((sw) => !sw.pose)).length;
  const all = (state.swings || []).flatMap((r) => r.swings || []);
  const failed = all.filter((sw) => sw.pose?.error).length;
  const noLines = all.filter((sw) => sw.pose && !sw.pose.error && !sw.pose.linesClip).length;
  const notSwing = (state.swings || []).flatMap((r) => (r.swings || []).filter((sw) => sw.pose?.notSwing).map((sw) => ({ r, sw })));
  if (poseAll) {
    $('#pose-all').replaceChildren(el('p', { class: 'muted small' }, poseAll.message));
    return;
  }
  const status = [
    n ? `まだ測っていない記録 ${n}件` : '',
    failed ? `測れなかった球 ${failed}球` : '',
    noLines ? `補助線がない球 ${noLines}球` : '',
    notSwing.length ? `スイングしていない球 ${notSwing.length}球` : '',
  ].filter(Boolean);
  $('#pose-all').replaceChildren(el('div', { class: 'row-between' },
    el('span', { class: 'muted small' }, status.length ? status.join('・') : ''),
    el('span', { class: 'cand-btns' },
      notSwing.length ? el('button', { type: 'button', class: 'btn small', onclick: () => { recFilter = { ...recFilter, rating: 'notswing', view: 'club' }; renderSwingRecords(); } }, 'スイングしていない球を見る') : null,
      notSwing.length ? el('button', { type: 'button', class: 'btn small danger', onclick: () => deleteNotSwings(notSwing) }, `${notSwing.length}球をまとめて削除`) : null,
      n || failed || noLines
        ? el('button', { type: 'button', class: 'btn small primary', onclick: () => measureAll(failed + noLines > 0), title: '姿勢を測ると計測点（AIなし）と補助線が付きます' },
          failed + noLines ? 'まとめて測る（測り直しも）' : 'まとめて測る')
        : null,
      el('button', { type: 'button', class: 'btn small', onclick: () => measureAll(true, true), title: '音だけで切り出した前の記録には、スイングしていない球がまざっていることがあります' }, 'スイングしていない球を探す'))));
}

async function measureAll(retry = false, everything = false) {
  if (everything && !(await askConfirm('全部の球を測り直して、スイングしていない球を探します。球の数が多いと数分かかります（AIは使いません）。始めますか？', '始める'))) return;
  poseAll = { message: '姿勢を測る準備をしています…' };
  renderPoseAll();
  try {
    await post('api/swings/_all/pose', { retry, all: everything });
  } catch (e) {
    poseAll = null;
    toast(e.message);
    renderPoseAll();
    return;
  }
  watchPoseAll();
}

// まとめて測っている間は進み具合を出し、測れた分から点数を出していく
function watchPoseAll() {
  const before = (state.swings || []).filter((r) => (r.swings || []).some((sw) => !sw.pose)).length;
  let lastRefresh = Date.now();
  const poll = async () => {
    let p;
    try { p = await api('api/swings/_all/pose'); } catch { setTimeout(poll, 3000); return; }
    if (p.status === 'running') {
      poseAll = { message: p.message };
      if (Date.now() - lastRefresh > 15000) { // 測れた分から点数を出していく
        lastRefresh = Date.now();
        await reloadState().catch(() => {});
        renderSwingRecords();
      } else renderPoseAll();
      setTimeout(poll, 2000);
      return;
    }
    if (!poseAll) return; // 測っていなかった
    poseAll = null;
    await reloadState().catch(() => {});
    renderSwingRecords();
    renderTrend();
    autoLearnScoring();
    autoUpdateFocus();
    const after = (state.swings || []).filter((r) => (r.swings || []).some((sw) => !sw.pose)).length;
    if (before && after >= before && config.version !== APP_VERSION) toast(OLD_SERVER_MSG);
    else toast(p.message || '測り終わりました');
  };
  setTimeout(poll, 1500);
}

// 起動直後にパソコン側で測っているときは、その進み具合を出す
async function resumePoseAll() {
  if (poseAll) return;
  try {
    const p = await api('api/swings/_all/pose');
    if (p.status !== 'running') return;
    poseAll = { message: p.message };
    renderPoseAll();
    watchPoseAll();
  } catch { /* 古いサーバーなど。何もしない */ }
}

function renderSwingRecords() {
  cardOrder = [];
  collectingCards = true;
  const y = window.scrollY; // 描き直しで一瞬ページが短くなっても、見ていた位置に戻す
  try {
    renderSwingRecordsInner();
  } finally {
    collectingCards = false;
  }
  if (window.scrollY !== y) window.scrollTo(0, y);
  if (viewer) renderViewer();
}

function renderSwingRecordsInner() {
  renderCompare();
  renderPoseAll();
  renderRecordFilters();
  const list = (state.swings || [])
    .filter((rec) => recFilter.cat === 'all' || clubCat(rec.club) === recFilter.cat)
    .filter((rec) => !recFilter.day || recFilter.day === 'all' || dayKey(recTime(rec)) === recFilter.day)
    .map((rec) => ({ rec, idx: (rec.swings || []).map((sw, i) => i).filter((i) => swingMatches(rec.swings[i])) }))
    .filter((x) => (recFilter.rating === 'all' && !recFilter.weak && !recFilter.flight) || x.idx.length)
    .sort((a, b) => recTime(b.rec) - recTime(a.rec));
  if (!list.length) {
    $('#swing-records').replaceChildren(el('div', { class: 'empty' }, (state.swings || []).length
      ? 'この条件に合う記録はありません。'
      : 'まだ記録がありません。動画を送って、スイングを記録しましょう。'));
    return;
  }
  const dayHead = (ts, swings) => {
    const scored = swings.map(effScore).filter((v) => v != null);
    const avg = scored.length ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : null;
    return [el('h3', { class: 'day-head' },
      el('span', {}, fmtDay(ts)),
      el('span', { class: 'muted small' }, `${swings.length}球${avg != null ? ` ・ 平均${avg}点` : ''}`)),
    focusDayLine(swings)].filter(Boolean);
  };
  if (recFilter.view !== 'records') {
    const flat = list.flatMap((x) => x.idx.map((i) => ({ rec: x.rec, i, sw: x.rec.swings[i] })));
    const byScore = (dir) => (a, b) => {
      const sa = effScore(a.sw); const sb = effScore(b.sw);
      if (sa == null || sb == null) return (sa == null) - (sb == null);
      return (sa - sb) * dir || swingTime(b.rec, b.sw) - swingTime(a.rec, a.sw);
    };
    const order = recFilter.sort === 'new' ? (a, b) => swingTime(b.rec, b.sw) - swingTime(a.rec, a.sw)
      : byScore(recFilter.sort === 'low' ? 1 : -1);
    // クラブごと (よく使う順ではなく、ドライバー → ウェッジの順) か、日付ごとにまとめる
    const groups = new Map();
    for (const x of flat) {
      const key = recFilter.view === 'club' ? x.rec.club
        : recFilter.view === 'clubday' ? `${dayKey(recTime(x.rec))}|${x.rec.club}` : dayKey(recTime(x.rec));
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(x);
    }
    // 日付×クラブは、新しい日から並べ、その日の中をクラブの順 (ドライバー → ウェッジ) に分ける
    const byDayClub = (a, b) => { const [da, ca] = a.split('|'); const [db, cb] = b.split('|'); return (da < db ? 1 : da > db ? -1 : 0) || clubOrder(ca) - clubOrder(cb); };
    const keys = [...groups.keys()].sort(recFilter.view === 'club' ? (a, b) => clubOrder(a) - clubOrder(b)
      : recFilter.view === 'clubday' ? byDayClub : (a, b) => (a < b ? 1 : -1));
    const nested = recFilter.view === 'clubday';
    $('#swing-records').replaceChildren(...keys.flatMap((key, gi) => {
      const items = groups.get(key).sort(order);
      const day = key.split('|')[0];
      // 日付の見出し (その日の最初のクラブの前に1回)
      const dayTitle = nested && (gi === 0 || keys[gi - 1].split('|')[0] !== day)
        ? dayHead(new Date(`${day}T12:00:00`).getTime(), keys.filter((k) => k.startsWith(`${day}|`)).flatMap((k) => groups.get(k).map((x) => x.sw)))
        : [];
      const scores = items.map((x) => effScore(x.sw)).filter((v) => v != null);
      const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
      const ranked = recFilter.sort === 'high' && scores.length > 1;
      return [...dayTitle, el('section', { class: 'day-group' + (nested ? ' sub-group' : '') },
        el(nested ? 'h4' : 'h3', { class: 'club-head' },
          el('span', {}, recFilter.view === 'club' ? clubName(key)
            : nested ? clubName(key.split('|')[1]) : fmtDayKey(key)),
          el('span', { class: 'stats' }, `${items.length}球`,
            avg != null ? [' ・ 平均 ', el('b', {}, `${avg}点`), ' ・ 最高 ', el('b', {}, `${Math.max(...scores)}点`)] : '',
            focusSummary(items.map((x) => x.sw)))),
        recFilter.view === 'day' ? focusDayLine(items.map((x) => x.sw)) : null,
        el('div', { class: 'swing-cards wide-cards' }, items.map((x, k) => {
          const card = swingCard(x.rec, x.i, recFilter.view === 'club' ? 'day' : recFilter.view === 'clubday' ? 'time' : true);
          if (ranked && effScore(x.sw) != null) card.prepend(el('span', { class: 'rank' + (k === 0 ? ' top' : '') }, `${k + 1}位 ${effScore(x.sw)}点`));
          return card;
        })))].filter(Boolean);
    }));
    return;
  }
  const days = [];
  for (const x of list) {
    const key = dayKey(recTime(x.rec));
    if (!days.length || days[days.length - 1].key !== key) days.push({ key, items: [] });
    days[days.length - 1].items.push(x);
  }
  $('#swing-records').replaceChildren(...days.map((day) => el('section', { class: 'day-group' },
    ...dayHead(recTime(day.items[0].rec), day.items.flatMap((x) => x.idx.map((i) => x.rec.swings[i]))),
    ...day.items.map((x) => renderRecord(x.rec, x.idx)))));
}

async function deleteRecord(rec) {
  if (!(await askConfirm('このスイング記録を削除しますか？画像と動画も消え、元に戻せません。', '削除'))) return;
  if (rec._running) post(`api/swings/${rec.id}/cancel`).catch(() => {});
  state.swings = state.swings.filter((r) => r.id !== rec.id);
  compareSel = compareSel.filter((c) => c.recId !== rec.id);
  save('deleteSwing', rec.id);
  renderSwingRecords();
}

async function uploadIfNew(file) {
  if (await checkBeforeUpload(file)) openVideo(() => uploadVideo(file));
}

function initVideo() {
  const v = $('#video');
  $('#video-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (file) uploadIfNew(file);
  });
  const drop = $('#video-drop');
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('dragging'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('dragging'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('dragging');
    const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('video/') || /\.(mp4|mov|m4v|webm)$/i.test(f.name));
    if (file) uploadIfNew(file);
    else toast('動画ファイルをドロップしてください');
  });
  $('#btn-inbox').addEventListener('click', loadInbox);
  $('#btn-inbox-refresh').addEventListener('click', loadInbox);
  $('#btn-inbox-close').addEventListener('click', () => { $('#inbox-panel').hidden = true; });
  $('#btn-job-cancel').addEventListener('click', async () => {
    await discardJob();
    $('#video-panel').hidden = true;
  });
  ['timeupdate', 'seeked', 'play', 'pause', 'loadedmetadata'].forEach((ev) => v.addEventListener(ev, syncVideoUi));
  $('#btn-play').addEventListener('click', () => (v.paused ? v.play() : v.pause()));
  $('#btn-frame-back').addEventListener('click', () => stepFrame(-1));
  $('#btn-frame-fwd').addEventListener('click', () => stepFrame(1));
  $('#video-seek').addEventListener('input', (e) => {
    if (v.duration) v.currentTime = (Number(e.target.value) / 1000) * v.duration;
  });
  setupSingleSelect($('#speed-picker'));
  $('#speed-picker').addEventListener('click', () => { v.playbackRate = Number(pickerValue('speed-picker')); });
  setupSingleSelect($('#angle-picker'));
  $('#shot-time').addEventListener('input', () => {
    shotTouched = true;
    $('#shot-source').textContent = SHOT_SOURCE.manual;
    $('#shot-source').classList.remove('warn');
  });
  $('#btn-add-here').addEventListener('click', addCandidateHere);
  $('#btn-save-only').addEventListener('click', () => saveRecord(false));
  $('#btn-save-analyze').addEventListener('click', () => saveRecord(true));
  $('#btn-compare-clear').addEventListener('click', () => { compareSel = []; renderSwingRecords(); });
  setSaveButtons(false);
}

// ---------- 分析タブ ----------
function renderStatsGuide() {
  const swings = (state.swings || []).flatMap((r) => r.swings || []);
  const measured = swings.filter((sw) => sw.pose?.items?.length).length;
  const shots = state.sessions.flatMap((s) => s.shots || []);
  const withDist = shots.filter((s) => s.distance != null).length;
  const row = (title, what, status, done) => el('li', {},
    el('span', { class: 'strong' }, title), ` … ${what} `,
    el('span', { class: done ? 'guide-ok' : 'guide-todo' }, status));
  $('#stats-guide').replaceChildren(el('ul', { class: 'stats-guide small' },
    row('スイングの点数・数値の推移', '計測点・AIの点数・頭の動き・テンポ・前傾などが、練習日ごとにどう変わったか。',
      measured ? `姿勢を測れた球: ${measured}球` : swings.length ? '→ 動画タブで「まとめて測る」を押すと出ます' : '→ 動画タブでスイング動画を記録すると出ます', measured > 0),
    row('クラブ別の飛距離', 'クラブごとの平均・ばらつき・いい感触の割合・左右の曲がり。',
      withDist ? `キャリーを入れた球: ${withDist}球` : '→ 練習中に「詳しく記録」でキャリーを入れると出ます', withDist > 0),
    row('ドリル成績', 'パター・アプローチなどの練習ドリルの成功率と、その推移。',
      state.drillResults.length ? `記録: ${state.drillResults.length}回` : '→ ドリルタブでドリルをやって保存すると出ます', state.drillResults.length > 0),
    row('練習履歴', 'いつ・どこで・何球練習したか。',
      state.sessions.length ? `練習: ${state.sessions.length}回` : '→ 練習タブで「練習を始める」→「終了」すると残ります', state.sessions.length > 0)),
  el('p', { class: 'muted tiny' }, '得意・苦手の傾向とコーチのメモは、練習タブにあります。'));
}

function renderStats() {
  renderStatsGuide();
  renderTrend();
  const allShots = state.sessions.flatMap((s) => s.shots);
  $('#club-stats').replaceChildren(statsTable(summarizeShots(allShots)));

  const drillRows = allDrills().map((d) => {
    const rs = state.drillResults.filter((r) => r.drillId === d.id);
    if (!rs.length) return null;
    const made = rs.reduce((a, r) => a + r.made, 0);
    const total = rs.reduce((a, r) => a + r.total, 0);
    const recent = rs.slice(0, 5).map((r) => `${Math.round(r.made / r.total * 100)}%`).reverse().join(' → ');
    return el('tr', {},
      el('td', {}, d.name),
      el('td', {}, rs.length),
      el('td', {}, `${Math.round(made / total * 100)}%`),
      el('td', { class: 'small' }, recent));
  }).filter(Boolean);

  $('#drill-stats').replaceChildren(drillRows.length
    ? el('table', {},
      el('thead', {}, el('tr', {}, el('th', {}, 'ドリル'), el('th', {}, '回'), el('th', {}, '通算'), el('th', {}, '直近の推移'))),
      el('tbody', {}, drillRows))
    : el('div', { class: 'empty' }, 'まだ記録がありません。ドリルタブでドリルをやって「結果を保存」すると出ます。'));

  const items = [
    ...state.sessions.map((s) => ({ type: 'session', at: s.startedAt, data: s })),
    ...state.drillResults.map((r) => ({ type: 'drill', at: r.at, data: r })),
  ].sort((a, b) => b.at - a.at).slice(0, 50);

  $('#history').replaceChildren(...(items.length ? items.map((it) => {
    if (it.type === 'session') {
      const s = it.data;
      const mins = Math.max(1, Math.round((s.endedAt - s.startedAt) / 60000));
      const clubs = [...new Set(s.shots.map((x) => x.club))].sort((a, b) => clubOrder(a) - clubOrder(b)).join(' ');
      return el('div', { class: 'history-item row-between' },
        el('div', {},
          el('div', { class: 'strong' }, `🏌️ ${s.place || '練習'} — ${s.shots.length}球`),
          el('div', { class: 'muted small' }, `${fmtDate(s.startedAt)} ・ ${mins}分 ・ ${clubs}`)),
        el('button', { class: 'btn small danger', onclick: () => deleteSession(s.id) }, '削除'));
    }
    const r = it.data;
    const d = allDrills().find((x) => x.id === r.drillId);
    return el('div', { class: 'history-item' },
      el('div', { class: 'strong' }, `🎯 ${d ? d.name : r.drillId} — ${r.made}/${r.total}`),
      el('div', { class: 'muted small' }, fmtDate(r.at)));
  }) : [el('div', { class: 'empty' }, 'まだ記録がありません。練習タブで「練習を始める」を押し、打ったら感触ボタンで記録して「終了」すると残ります。')]));
}

async function deleteSession(id) {
  if (!(await askConfirm('この練習記録を削除しますか？', '削除'))) return;
  state.sessions = state.sessions.filter((s) => s.id !== id);
  save('deleteSession', id);
  renderStats();
}

// ---------- 設定タブ ----------
function renderSettings() {
  renderUpdate();
  renderLan();
  $('#bag-editor').replaceChildren(...ALL_CLUBS.map((c) => el('button', {
    type: 'button',
    class: 'chip' + (state.bag.includes(c.id) ? ' selected' : ''),
    onclick: () => toggleBag(c.id),
  }, c.name)));
  $('#claude-cmd-input').value = config.claudeCmd || 'claude';
  $('#claude-model-input').value = config.claudeModel || 'sonnet';
  $('#app-version').textContent = `アプリの版: ${APP_VERSION}（パソコンで動いている版: ${config.version ?? '古い版'}）`;
  $('#api-key-status').textContent = config.hasApiKey ? '設定済みです。変更するときだけ入力してください。' : 'まだ設定されていません。';
  $('#inbox-dir-input').value = config.inboxDir || '';
  $('#model-input').value = config.model || '';
  $('#height-input').value = config.heightCm || 170;
  $('#lefty-input').checked = !!config.lefty;
  $('#data-dir').textContent = config.dataDir || '';
}

function toggleBag(id) {
  if (state.bag.includes(id)) {
    if (state.bag.length === 1) { toast('最低1本は必要です'); return; }
    state.bag = state.bag.filter((x) => x !== id);
    if (selectedClub === id) selectedClub = null;
  } else {
    state.bag.push(id);
  }
  save();
  renderSettings();
  renderPractice();
  renderVideoClubs();
}

async function saveConfig(body, done) {
  try {
    await post('api/config', body);
    await reloadState();
    renderSettings();
    toast(done);
  } catch (e) {
    toast(e.message);
  }
}

async function copyBackup() {
  const box = $('#backup-text');
  const { config: _c, ...rest } = { ...state };
  box.value = JSON.stringify(rest);
  box.hidden = false;
  try {
    await navigator.clipboard.writeText(box.value);
    toast('バックアップをコピーしました');
  } catch {
    box.focus();
    box.select();
    toast('表示されたテキストをコピーしてください');
  }
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => importText(reader.result);
  reader.readAsText(file);
}

async function importText(text) {
  let data;
  try {
    data = JSON.parse(text);
    if (!Array.isArray(data.sessions) || !Array.isArray(data.drillResults)) throw new Error('format');
  } catch {
    toast('バックアップの形式が正しくありません');
    return;
  }
  if (!(await askConfirm('現在のデータを上書きして読み込みますか？（claude.ai 版のスイング記録は画像を持ってこられないため、練習とドリルの記録だけ読み込みます）', '上書きして読み込む'))) return;
  try {
    await writeQueue;
    await post('api/replace', { state: normalizeState(data) });
    await reloadState();
    renderAll();
    toast('読み込みました');
  } catch (e) {
    toast(e.message);
  }
}

async function resetData() {
  if (!(await askConfirm('すべての練習記録とスイングの画像・動画を削除します。元に戻せません。', 'すべて削除'))) return;
  try {
    await writeQueue;
    await post('api/replace', { state: defaultState() });
    await reloadState();
    selectedClub = null;
    drillRun = null;
    renderAll();
    toast('削除しました');
  } catch (e) {
    toast(e.message);
  }
}

// ---------- 初期化 ----------
function switchTab(name) {
  $$('.tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  $$('.tab').forEach((t) => t.classList.toggle('active', t.id === `tab-${name}`));
  if (name === 'stats') renderStats();
  try { sessionStorage.setItem('golf-tab', name); } catch { /* 使えなくても問題ない */ }
  window.scrollTo(0, 0);
}

// ---------- 振り返りノート ----------
function todayKey() { return dayKey(Date.now()); }
function noteId(day) { return `n${day.replaceAll('-', '')}`; }
function recordsOfDay(day) {
  return (state.swings || []).filter((r) => dayKey(recTime(r)) === day).sort((a, b) => recTime(a) - recTime(b));
}
function fmtDayKey(day) {
  const [y, m, d] = day.split('-').map(Number);
  return fmtDay(new Date(y, m - 1, d).getTime());
}

function loadNoteForm(day) {
  $('#note-day').value = day;
  const note = state.notes.find((n) => n.day === day);
  $('#note-memo').value = note?.memo || '';
  renderNoteVideos();
}

// その日の動画から自動でまとめる (AIなし)。メモを書くときの手がかりにする
function dayAutoSummary(day) {
  const recs = recordsOfDay(day);
  const swings = recs.flatMap((rec) => (rec.swings || []).map((sw, i) => ({ rec, sw, i })));
  if (!swings.length) return null;
  const scored = swings.filter((x) => measureScore(x.sw) != null);
  const avg = scored.length ? Math.round(scored.reduce((a, x) => a + measureScore(x.sw), 0) / scored.length) : null;
  const best = scored.slice().sort((a, b) => measureScore(b.sw) - measureScore(a.sw))[0];
  const worst = scored.slice().sort((a, b) => measureScore(a.sw) - measureScore(b.sw))[0];
  const today = tendencyStats(swings.map((x) => x.sw));
  const weakToday = Object.values(today).filter((e) => e.n >= 2 && e.bad / e.n >= 0.4).sort((a, b) => b.bad / b.n - a.bad / a.n).slice(0, 2);
  const goodToday = Object.values(today).filter((e) => e.n >= 2 && e.good / e.n >= 0.6).sort((a, b) => b.good / b.n - a.good / a.n).slice(0, 2);
  const clubs = [...new Set(recs.map((r) => clubName(r.club)))].join('・');
  const name = (x) => `${fmtHM(swingTime(x.rec, x.sw))}の${x.i + 1}球目（${measureScore(x.sw)}点）`;
  return {
    swings,
    lines: [
      `${clubs}で${swings.length}球の動画${avg != null ? `、計測点の平均 ${avg}点` : ''}`,
      best && worst && best !== worst ? `いちばん良い: ${name(best)} ／ いちばん低い: ${name(worst)}` : null,
      goodToday.length ? `今日できていた: ${goodToday.map((e) => e.label).join('、')}` : null,
      weakToday.length ? `今日多かったクセ: ${weakToday.map((e) => e.label).join('、')}` : null,
    ].filter(Boolean),
    best, worst,
  };
}

function renderNoteVideos() {
  const day = $('#note-day').value;
  const auto = day ? dayAutoSummary(day) : null;
  if (!auto) {
    $('#note-videos').replaceChildren('この日のスイング動画はありません。メモだけで整理します。');
    return;
  }
  const pick = [auto.best, auto.worst].filter((x, k, a) => x && a.indexOf(x) === k);
  $('#note-videos').replaceChildren(el('div', { class: 'auto-summary' },
    el('div', { class: 'small strong' }, '動画から見た今日（自動・AIなし）'),
    el('ul', { class: 'small' }, auto.lines.map((l) => el('li', {}, l))),
    pick.length ? el('div', { class: 'swing-cards' }, pick.map((x) => swingCard(x.rec, x.i, true))) : null,
    el('p', { class: 'muted tiny' }, '「AIで整理して保存」を押すと、あなたのメモとこの動画の記録・最近の傾向を合わせてまとめます。メモが空でも、動画だけでまとめられます。')));
}

async function saveNote(organize) {
  const day = $('#note-day').value;
  const memo = $('#note-memo').value.trim();
  if (!day) { toast('日付を選んでください'); return; }
  if (!memo && !organize) { toast('メモを入力してください'); return; }
  if (organize && !config.hasApiKey) { toast('AI で整理するには Gemini の API キーが必要です（設定タブ）'); return; }
  if (organize && !memo && !recordsOfDay(day).length) { toast('メモを入力してください'); return; }
  const id = noteId(day);
  await save('note', { id, day, memo, at: Date.now() });
  if (organize) {
    $('#note-status').textContent = 'AIが整理しています…（10〜30秒ほど）';
    $('#btn-note-ai').disabled = true;
    try {
      const res = await post(`api/notes/${id}/organize`, { tendency: tendencyLines() });
      $('#note-status').textContent = '';
      toast(res?.feelsAdded ? `整理して保存しました（感覚ノートに${res.feelsAdded}件追加）` : '整理して保存しました');
    } catch (e) {
      $('#note-status').textContent = `${e.message}（メモは保存しました）`;
    } finally {
      $('#btn-note-ai').disabled = false;
    }
  } else {
    toast('メモを保存しました');
  }
  await reloadState();
  renderNotes();
  renderFeels();
}

function openRecordFromNote(rec) {
  recFilter = { ...recFilter, cat: 'all', rating: 'all', weak: null, view: 'records' };
  openRecords.add(rec.id);
  switchTab('video');
  renderSwingRecords();
  requestAnimationFrame(() => $(`#rec-${rec.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
}

// AI の整理から「## メモの整理」の部分だけを取り出す (前の版で整理したノートにはない)
function noteSections(text) {
  const m = text.match(/^##\s*メモの整理[^\n]*\n([\s\S]*?)(?=^##\s(?!#)|(?![\s\S]))/m);
  if (!m) return { organized: '', rest: text };
  return { organized: m[1].trim(), rest: (text.slice(0, m.index) + text.slice(m.index + m[0].length)).trim() };
}

function renderNotes() {
  const notes = [...state.notes].sort((a, b) => (a.day < b.day ? 1 : -1));
  if (!notes.length) {
    $('#note-list').replaceChildren(el('div', { class: 'empty' }, 'まだノートがありません。練習のあとに、感じたことをメモしてみましょう。'));
    return;
  }
  $('#note-list').replaceChildren(...notes.map((note) => {
    const recs = recordsOfDay(note.day);
    const { organized, rest } = noteSections(note.text || '');
    const text = el('div', { class: 'ai-result' });
    if (rest) text.innerHTML = renderAnalysis(rest);
    const org = el('div', { class: 'ai-result' });
    if (organized) org.innerHTML = renderAnalysis(organized);
    return el('div', { class: 'note-item' },
      el('div', { class: 'day-head' }, el('span', {}, fmtDayKey(note.day)),
        el('span', { class: 'muted small' }, note.text ? 'AIで整理済み' : 'メモのみ')),
      organized ? el('div', { class: 'note-org-box' }, el('div', { class: 'small strong' }, 'メモの整理'), org) : null,
      note.memo && organized ? el('details', { class: 'small' }, el('summary', { class: 'muted' }, '書いたままのメモ'),
        el('p', { class: 'note-raw' }, note.memo)) : null,
      note.memo && !organized ? el('div', { class: 'note-memo-box' }, el('div', { class: 'small strong' }, 'あなたのメモ'),
        el('p', { class: 'note-raw' }, note.memo)) : null,
      rest ? el('div', {}, el('div', { class: 'small strong note-ai-head' }, '技術的な補足（AI）'), text) : null,
      recs.length ? el('div', { class: 'note-videos' },
        el('div', { class: 'muted small' }, 'この日の動画（押すと開きます）'),
        el('div', { class: 'swing-cards' }, recs.map((rec) => el('button', {
          type: 'button', class: 'swing-card', onclick: () => openRecordFromNote(rec),
        },
        rec.swings?.length ? frameView(rec.swings[0], impactIndex(rec.swings[0]), 'frame card-thumb') : null,
        el('div', { class: 'swing-card-info' },
          el('div', { class: 'small strong' }, `${fmtHM(recTime(rec))} ${clubName(rec.club)}`),
          el('div', { class: 'tiny muted' }, `${rec.swings?.length || 0}球`),
          rec.score != null ? el('span', { class: 'score-badge' }, `平均 ${rec.score}点`) : null))))) : null,
      el('div', { class: 'cand-btns' },
        firstItemUnder(note.text, '次の練習でやること')
          ? el('button', { type: 'button', class: 'btn small primary', onclick: () => setTheme(firstItemUnder(note.text, '次の練習でやること'), 'note') },
            '次回のテーマにする')
          : null,
        el('button', { type: 'button', class: 'btn small', onclick: () => { loadNoteForm(note.day); $('#note-card').scrollIntoView({ behavior: 'smooth' }); } }, 'メモを書き直す'),
        el('button', { type: 'button', class: 'btn small', onclick: () => { loadNoteForm(note.day); saveNote(true); } }, note.text ? 'AIで整理し直す' : 'AIで整理する'),
        el('button', { type: 'button', class: 'btn small danger', onclick: async () => {
          if (!(await askConfirm(`${fmtDayKey(note.day)}のノートを削除しますか？`, '削除'))) return;
          await save('deleteNote', note.id);
          state.notes = state.notes.filter((n) => n.id !== note.id);
          renderNotes();
        } }, '削除')));
  }));
}

// ---------- 感覚ノート (本人がつかんだ感覚・イメージ) ----------
// AI の答えの末尾の {"feels": [...]} を取り出す (pc/ai.py の split_feels と同じ)
function splitFeels(text) {
  const re = /```\s*json\s*(\{[\s\S]*?\})\s*```/gi;
  const feels = [];
  for (const m of String(text).matchAll(re)) {
    try {
      const list = JSON.parse(m[1]).feels;
      if (Array.isArray(list)) feels.push(...list.filter((f) => String(f?.phrase || '').trim()));
    } catch { /* 読めない JSON は飛ばす */ }
  }
  return { body: String(text).replace(re, '').trim(), feels };
}

function addFeels(feels, day) {
  const have = new Set(state.feels.map((f) => String(f.phrase).replace(/\s/g, '')));
  let added = 0;
  feels.forEach((f, i) => {
    const key = String(f.phrase).replace(/\s/g, '');
    if (have.has(key)) return;
    have.add(key);
    const feel = { id: `f${Date.now()}${i}`, phrase: String(f.phrase).trim().slice(0, 80), fixes: String(f.fixes || '').trim().slice(0, 120),
      club: String(f.club || '').slice(0, 20), day, source: 'note', at: Date.now() };
    state.feels.unshift(feel);
    save('feel', feel);
    added++;
  });
  renderFeels();
  return added;
}

function addFeelManual() {
  const phrase = $('#feel-phrase').value.trim();
  if (!phrase) { toast('感覚・イメージを入力してください'); return; }
  const feel = { id: `f${Date.now()}`, phrase: phrase.slice(0, 80), fixes: $('#feel-fixes').value.trim().slice(0, 120),
    club: '', day: todayKey(), source: 'manual', at: Date.now() };
  state.feels.unshift(feel);
  save('feel', feel);
  $('#feel-phrase').value = '';
  $('#feel-fixes').value = '';
  renderFeels();
  toast('感覚ノートに追加しました');
}

function editFeel(f, item) {
  const phrase = el('input', { type: 'text', value: f.phrase });
  const fixes = el('input', { type: 'text', value: f.fixes || '', placeholder: '何に効く？どんなときに使う？' });
  item.replaceChildren(phrase, fixes, el('div', { class: 'cand-btns' },
    el('button', { type: 'button', class: 'btn small primary', onclick: () => {
      if (!phrase.value.trim()) { toast('感覚・イメージを入力してください'); return; }
      Object.assign(f, { phrase: phrase.value.trim().slice(0, 80), fixes: fixes.value.trim().slice(0, 120) });
      save('feel', f);
      renderFeels();
    } }, '保存'),
    el('button', { type: 'button', class: 'btn small', onclick: renderFeels }, 'やめる')));
  phrase.focus();
}

function feelItem(f, compact = false) {
  const item = el('div', { class: 'feel-item' });
  item.append(
    el('div', { class: 'feel-phrase' }, `「${f.phrase}」`),
    f.fixes ? el('div', { class: 'small' }, `→ ${f.fixes}`) : null,
    compact ? '' : el('div', { class: 'muted tiny' }, [f.day ? fmtDayKey(f.day) : '', f.club, f.source === 'note' ? '振り返りノートから' : '自分で追加'].filter(Boolean).join('・')),
    compact ? '' : el('div', { class: 'cand-btns' },
      el('button', { type: 'button', class: 'btn small', onclick: () => setTheme(f.phrase, 'feel') }, '今日のテーマにする'),
      el('button', { type: 'button', class: 'btn small', onclick: () => editFeel(f, item) }, '直す'),
      el('button', { type: 'button', class: 'btn small danger', onclick: async () => {
        if (!(await askConfirm(`「${f.phrase}」を感覚ノートから消しますか？`, '消す'))) return;
        state.feels = state.feels.filter((x) => x.id !== f.id);
        save('deleteFeel', f.id);
        renderFeels();
      } }, '消す')));
  return item;
}

function renderFeels() {
  const list = $('#feel-list');
  if (!list) return;
  const feels = [...(state.feels || [])].sort((a, b) => (b.at || 0) - (a.at || 0));
  list.replaceChildren(...(feels.length ? feels.map((f) => feelItem(f))
    : [el('p', { class: 'muted small' }, 'まだありません。振り返りノートに「〇〇な感じで振ったら良かった」のように書いてAIで整理すると、ここにたまっていきます。')]));
  $('#feel-quick').hidden = !feels.length;
  $('#feel-quick-list').replaceChildren(...feels.map((f) => feelItem(f, true)));
}

function renderAll() {
  renderNotes();
  const memoBox = $('#note-memo');
  if (!memoBox.value && document.activeElement !== memoBox) loadNoteForm($('#note-day').value || todayKey());
  else renderNoteVideos();
  renderPractice();
  renderVideoClubs();
  renderSwingRecords();
  renderDrills();
  renderStats();
  renderSettings();
}

async function connect() {
  try {
    await reloadState();
    $('#offline').hidden = true;
    checkServerVersion();
    resumePoseAll();
  } catch (e) {
    $('#offline-msg').textContent = e.message;
    $('#offline').hidden = false;
    return;
  }
  if (state.active) {
    selectedClub = state.bag.includes('7I') ? '7I' : state.bag[0];
    selectClub(selectedClub);
  }
  autoUpdateFocus();
  renderAll();
  checkUpdate();
  maybeShowSetup();
}

function init() {
  $$('.tabbar button').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));
  setupSingleSelect($('#dir-picker'), true);
  setupSingleSelect($('#contact-picker'), true);

  $('#btn-start').addEventListener('click', startSession);
  $('#btn-end').addEventListener('click', endSession);
  $$('.feel-btn').forEach((b) => b.addEventListener('click', () => addShot(b.dataset.feel)));
  $('#btn-undo').addEventListener('click', undoShot);
  $$('[data-step]').forEach((b) => b.addEventListener('click', () => {
    const input = $('#shot-distance');
    const base = input.value === '' ? Number(input.dataset.ref) || 100 : Number(input.value) || 0;
    input.value = Math.max(0, input.value === '' ? base : base + Number(b.dataset.step));
  }));

  $('#note-day').addEventListener('change', () => loadNoteForm($('#note-day').value));
  $('#btn-note-save').addEventListener('click', () => saveNote(false));
  $('#btn-note-ai').addEventListener('click', () => saveNote(true));
  $('#btn-feel-add').addEventListener('click', addFeelManual);

  $('#btn-drill-make').addEventListener('click', () => drillTap(true));
  $('#btn-drill-miss').addEventListener('click', () => drillTap(false));
  $('#btn-drill-save').addEventListener('click', saveDrill);
  $('#btn-drill-close').addEventListener('click', closeDrill);

  $('#btn-api-key').addEventListener('click', () => {
    const key = $('#api-key-input').value.trim();
    if (!key) { toast('API キーを入力してください'); return; }
    $('#api-key-input').value = '';
    saveConfig({ apiKey: key }, 'API キーを保存しました');
  });
  $('#btn-body').addEventListener('click', () => saveConfig(
    { heightCm: Number($('#height-input').value), lefty: $('#lefty-input').checked },
    '保存しました。これから測る記録に使います（前の記録は「姿勢を測り直す」で反映）'));
  $('#btn-github-token').addEventListener('click', async () => {
    await saveConfig({ githubToken: $('#github-token-input').value }, 'トークンを保存しました');
    $('#github-token-input').value = '';
    checkUpdate(true);
  });
  $('#btn-update-now').addEventListener('click', applyUpdate);
  $('#setup-ok').addEventListener('click', finishSetup);
  $('#lan-input').addEventListener('change', (e) => setLan(e.target.checked));
  $('#btn-claude').addEventListener('click', () => saveConfig(
    { claudeCmd: $('#claude-cmd-input').value, claudeModel: $('#claude-model-input').value }, '保存しました'));
  $('#btn-model').addEventListener('click', () => saveConfig({ model: $('#model-input').value }, 'モデル名を保存しました'));
  $('#btn-inbox-dir').addEventListener('click', () => saveConfig({ inboxDir: $('#inbox-dir-input').value }, '取り込みフォルダを保存しました'));
  $('#btn-export').addEventListener('click', copyBackup);
  $('#file-import').addEventListener('change', (e) => {
    if (e.target.files[0]) importData(e.target.files[0]);
    e.target.value = '';
  });
  $('#btn-import-text').addEventListener('click', () => {
    const text = $('#backup-text').value.trim();
    if (!text) {
      $('#backup-text').hidden = false;
      $('#backup-text').focus();
      toast('バックアップのテキストを貼り付けてください');
      return;
    }
    importText(text);
  });
  $('#btn-reset').addEventListener('click', resetData);
  $('#btn-retry').addEventListener('click', connect);
  initVideo();

  try {
    const tab = sessionStorage.getItem('golf-tab');
    if (tab) switchTab(tab);
  } catch { /* 使えなくても問題ない */ }
  renderAll();
  connect();

  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

init();
