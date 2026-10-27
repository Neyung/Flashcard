/* ═══════════════════════════════════════════════════════════
   TAB NHIỆM VỤ (Tasks) — chuỗi 5 nhiệm vụ mỗi ngày:
   Focus 30' → Phát âm → Nghe & viết → Điền ngữ cảnh → Viết đoạn văn
   - Trạng thái gắn với NGÀY địa phương (YYYY-MM-DD), lưu máy + mây
   - Nhiệm vụ Focus đọc nhật ký giây tập trung hợp lệ theo ngày (focusLog)
   - Xong đủ 5 → +2 hoa nhỏ trong Vườn (dùng chung với Tập trung), mỗi ngày 1 lần (garden.taskDays)
   ═══════════════════════════════════════════════════════════ */
const TASK_KEYS = ['focus','pron','listen','context','write'];
const TASK_META = {
  focus:   { icon:'flower',     color:'var(--lemon)' },
  pron:    { icon:'mic',        color:'var(--pink)'  },
  listen:  { icon:'headphones', color:'var(--sky)'   },
  context: { icon:'puzzle',     color:'var(--lav)'   },
  write:   { icon:'edit',       color:'var(--mint)'  },
};
/* Focus bắt buộc: 20 phút ở chế độ Nhanh, 30 phút ở Tiêu chuẩn/Chuyên sâu */
const focusGoalMin = () => tasks && tasks.mode === 'quick' ? 20 : 30;
const focusGoalSec = () => focusGoalMin() * 60;
const TASK_MODES = {                            // số lượng linh hoạt theo thời lượng
  quick:    { pron:6,  listen:5,  context:8,  write:1 },
  standard: { pron:20, listen:10, context:20, write:2 },
  deep:     { pron:35, listen:20, context:30, write:3 },
};
const TASK_MODE_KEYS = ['quick','standard','deep'];
const TASK_SEC_PER = { pron:36, listen:24, context:18, write:240 };   // ước lượng giây cho mỗi mục
const WRITE_WORDS = 5, WRITE_MIN_WORDS = 25;
const PRON_WORD_PASS = 80, PRON_SENT_PASS = 70, PRON_SKIP_AFTER = 3;

/* Firebase bỏ mảng rỗng và biến mảng thưa thành object — luôn đọc về mảng */
const asArr = v => Array.isArray(v) ? v
  : (v && typeof v === 'object') ? Object.keys(v).sort((a, b) => a - b).map(k => v[k]) : [];
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ── Nhật ký Focus theo ngày ──────────────────────────────────
   Chỉ cộng 1 giây cho mỗi nhịp đồng hồ khi phiên Tập trung đang chạy VÀ
   cửa sổ ứng dụng đang được dùng (rời cửa sổ = không hợp lệ). Một phiên
   chỉ có một bộ đếm nên không bao giờ cộng trùng. */
let focusLog = {};
let focusLogSaveT = null, focusLogDirty = 0;
const focusLogKey = () => 'soTuFocusLog_' + currentUser;
const focusTodaySec = () => focusLog[todayKey()] || 0;
function cleanFocusLog(v){
  const out = {};
  if(v && typeof v === 'object')
    for(const [k, s] of Object.entries(v)) if(/^\d{4}-\d\d-\d\d$/.test(k) && +s > 0) out[k] = Math.floor(+s);
  return out;
}
function saveFocusLog(immediate){
  if(!currentUser) return;
  const keys = Object.keys(focusLog).sort();
  while(keys.length > 400) delete focusLog[keys.shift()];
  try{ localStorage.setItem(focusLogKey(), JSON.stringify(focusLog)); }catch(e){}
  if(!cloudOn()) return;
  const user = currentUser;
  const put = () => cloudPut('users/' + user + '/focusLog', focusLog).catch(() => {});
  if(immediate){ clearTimeout(focusLogSaveT); focusLogSaveT = null; put(); }
  else if(!focusLogSaveT) focusLogSaveT = setTimeout(() => { focusLogSaveT = null; if(currentUser === user) put(); }, 20000);
}
function focusLogTick(){
  if(!currentUser) return;
  const k = todayKey();
  focusLog[k] = (focusLog[k] || 0) + 1;
  if(++focusLogDirty >= 10){ focusLogDirty = 0; saveFocusLog(); }
  tasksOnFocusProgress();
}
window.addEventListener('pagehide', () => { if(currentUser){ saveFocusLog(true); if(tasks) saveTasks(true); if(sacred) saveSacred(true); } });

/* ── Trạng thái nhiệm vụ ─────────────────────────────────── */
let tasks = null;              // trạng thái của ngày hiện tại
let taskHist = {};             // { 'YYYY-MM-DD': { mode, doneAt, sum } } — lịch sử các ngày đã hoàn thành
let taskModePref = 'standard';
let writeLog = [];             // lịch sử các đoạn văn đã hoàn thành (mới nhất trước)
let tkView = 'overview';       // 'overview' | key nhiệm vụ | 'trans' | 'done'
let tkTrans = null;            // nhiệm vụ vừa xong (màn chuyển tiếp)
let tkAnimDone = false;        // chỉ phát hiệu ứng chúc mừng 1 lần
let tkLastFocusMin = -1;
let tasksSaveT = null;
const tasksKey = () => 'soTuTasks_' + currentUser;

function newTasks(mode){
  return { date: todayKey(), mode, modeSet: false, started: false, completedAt: 0, celebrated: false, updatedAt: now(), t: {} };
}
function normTasks(s){
  if(!s || typeof s !== 'object' || typeof s.date !== 'string') return null;
  if(!TASK_MODES[s.mode]) s.mode = 'standard';
  s.t = (s.t && typeof s.t === 'object') ? s.t : {};
  if(typeof s.modeSet !== 'boolean')               // dữ liệu cũ: đã bắt đầu làm = coi như đã chốt
    s.modeSet = !!(s.started || s.completedAt || TASK_KEYS.some(k => s.t[k] && (s.t[k].inited || s.t[k].done)));
  TASK_KEYS.forEach(k => {
    const x = s.t[k] = (s.t[k] && typeof s.t[k] === 'object') ? s.t[k] : {};
    x.done = !!x.done;
    if(k === 'pron') x.items = asArr(x.items).map(it => Object.assign(it, { wa: asArr(it.wa), sa: asArr(it.sa) }));
    if(k === 'listen') x.items = asArr(x.items);
    if(k === 'context'){
      x.items = asArr(x.items).map(it => Object.assign(it, { parts: asArr(it.parts) }));
      x.order = asArr(x.order); x.slots = asArr(x.slots); x.res = asArr(x.res);
    }
    if(k === 'write') x.paras = asArr(x.paras).map(p => Object.assign(p, {
      words: asArr(p.words), errors: asArr(p.errors), issues: asArr(p.issues), text: p.text || '' }));
  });
  return s;
}
function saveTasks(immediate){
  if(!currentUser || !tasks) return;
  tasks.updatedAt = now();
  const data = { mode: taskModePref, state: tasks, hist: taskHist, writeLog };
  const snap = JSON.stringify(data);
  try{ localStorage.setItem(tasksKey(), snap); }catch(e){}
  updateTasksBadge();
  if(!cloudOn()) return;
  clearTimeout(tasksSaveT);
  const user = currentUser;
  const put = () => cloudPut('users/' + user + '/tasks', JSON.parse(snap)).catch(() => {});
  if(immediate) put(); else tasksSaveT = setTimeout(put, 2500);
}
async function loadTasks(){
  tasks = null; taskHist = {}; taskModePref = 'standard'; writeLog = [];
  tkView = 'overview'; tkTrans = null; tkAnimDone = false; tkLastFocusMin = -1;
  let local = null, remote = null;
  try{ local = JSON.parse(localStorage.getItem(tasksKey()) || 'null'); }catch(e){}
  try{ focusLog = cleanFocusLog(JSON.parse(localStorage.getItem(focusLogKey()) || '{}')); }catch(e){ focusLog = {}; }
  if(cloudOn()){
    try{ remote = await cloudGet('users/' + currentUser + '/tasks'); }catch(e){}
    try{                                     // gộp nhật ký Focus: lấy giá trị lớn hơn của từng ngày
      const fl = cleanFocusLog(await cloudGet('users/' + currentUser + '/focusLog'));
      for(const [k, s] of Object.entries(fl)) focusLog[k] = Math.max(focusLog[k] || 0, s);
    }catch(e){}
  }
  const ts = d => (d && d.state && d.state.updatedAt) || 0;
  const pick = remote && local ? (ts(remote) > ts(local) ? remote : local) : (remote || local);
  if(pick && typeof pick === 'object'){
    if(TASK_MODES[pick.mode]) taskModePref = pick.mode;
    tasks = normTasks(pick.state);
  }
  for(const d of [local, remote]) if(d && d.hist && typeof d.hist === 'object')
    for(const [k, v] of Object.entries(d.hist)) if(v && typeof v === 'object') taskHist[k] = v;
  const logById = new Map();                     // gộp lịch sử viết của máy + mây theo id
  for(const d of [local, remote]) if(d) for(const e of asArr(d.writeLog))
    if(e && e.id && typeof e.text === 'string'){
      const prev = logById.get(e.id);
      if(prev && (prev.rewriteAt || 0) > (e.rewriteAt || 0)){ e.rewrite = prev.rewrite; e.rewriteAt = prev.rewriteAt; }
      logById.set(e.id, Object.assign(e, { words: asArr(e.words), issues: asArr(e.issues) }));
    }
  writeLog = [...logById.values()].sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 500);
  updateHistBadge();
  try{ localStorage.setItem(focusLogKey(), JSON.stringify(focusLog)); }catch(e){}
  ensureToday();
}
/* Sang ngày mới → làm mới chuỗi nhiệm vụ (lịch sử + hoa trong Vườn giữ nguyên) */
function ensureToday(){
  if(!currentUser) return false;
  let changed = false;
  if(!tasks || tasks.date !== todayKey()){
    tasks = normTasks(newTasks(taskModePref));
    tkView = 'overview'; tkTrans = null; tkAnimDone = false;
    tkModePick = null;
    changed = true;
  }
  if(checkFocusTask()) changed = true;
  if(changed) saveTasks();
  else updateTasksBadge();
  return changed;
}
function checkFocusTask(){
  const f = tasks && tasks.t.focus;
  if(!f || f.done || focusTodaySec() < focusGoalSec()) return false;
  f.done = true; f.doneAt = now(); tasks.started = true;
  return true;
}
const tasksTabActive = () => { const p = $('#tab-tasks'); return !!p && p.classList.contains('active'); };
function tasksOnFocusProgress(){
  if(!tasks || !currentUser) return;
  if(tasks.date !== todayKey()){ ensureToday(); if(tasksTabActive()) renderTasks(); return; }
  if(checkFocusTask()){
    saveTasks(); saveFocusLog(true);
    toast(t('tkFocusDoneToast', focusGoalMin()));
    if(tasksTabActive() && (tkView === 'overview' || tkView === 'focus')) renderTasks();
    return;
  }
  const m = Math.floor(focusTodaySec() / 60);
  if(m !== tkLastFocusMin){
    tkLastFocusMin = m;
    if(tasksTabActive() && (tkView === 'overview' || tkView === 'focus')) renderTasks();
  }
}
setInterval(() => {                               // đổi ngày khi app vẫn đang mở
  if(currentUser && tasks && tasks.date !== todayKey()){
    recAbort();
    ensureToday();
    if(tasksTabActive()) renderTasks();
  }
}, 30000);

/* Làm theo thứ tự tuỳ ý: không nhiệm vụ nào bị khoá; chỉ hoàn thành khi đạt đúng điều kiện */
const taskStarted = k => k === 'focus' ? focusTodaySec() > 0 : !!tasks.t[k].inited;
const taskStatus = k => tasks.t[k].done ? 'done' : taskStarted(k) ? 'active' : 'todo';
const nextTaskKey = () => TASK_KEYS.find(k => !tasks.t[k].done) || null;
const tasksDoneCount = () => TASK_KEYS.filter(k => tasks.t[k].done).length;
const taskPlanned = k => tasks.t[k].inited ? tasks.t[k].target : TASK_MODES[tasks.mode][k];
function taskEstMin(k){
  if(k === 'focus') return Math.max(0, Math.ceil((focusGoalSec() - focusTodaySec()) / 60));
  return Math.max(1, Math.round(taskPlanned(k) * TASK_SEC_PER[k] / 60));
}
const modeEstMin = m => Math.round(['pron','listen','context','write'].reduce((s, k) => s + TASK_MODES[m][k] * TASK_SEC_PER[k], 0) / 60);
function taskFrac(k){                              // tiến độ 0..1 trong từng nhiệm vụ
  const x = tasks.t[k];
  if(x.done) return 1;
  if(k === 'focus') return Math.min(1, focusTodaySec() / focusGoalSec());
  if(!x.inited) return 0;
  if(k === 'pron' || k === 'listen') return x.items.filter(i => i.done).length / x.items.length;
  if(k === 'context') return x.res.filter(r => r === 1).length / x.items.length;
  if(k === 'write') return x.paras.filter(p => p.done).length / x.paras.length;
  return 0;
}
const tasksOverallPct = () => Math.round(TASK_KEYS.reduce((s, k) => s + taskFrac(k), 0) / TASK_KEYS.length * 100);
function updateTasksBadge(){
  const b = $('#tasksBadge'); if(!b) return;
  if(!tasks || !currentUser){ b.style.display = 'none'; return; }
  const n = tasksDoneCount();
  b.style.display = '';
  b.textContent = n === 5 ? '✓' : n + '/5';
  b.classList.toggle('done', n === 5);
}

/* ── Chọn từ vựng: ưu tiên các từ nằm CUỐI danh sách ưu tiên xuất hiện (priorityScore
   thấp nhất — ít khi được bốc ra ở Luyện gõ/Flashcard) thay vì từ mới, để nhiệm vụ
   hằng ngày ôn lại những từ dễ bị "bỏ quên". Không lặp lại cùng một từ. ── */
const PLACEHOLDER_RE = /^(sb|sth|smb|smth|st|someone|somebody|something|one's|someone's|somebody's|sb's|oneself|o\.s\.|\.\.\.|…)$/i;
const hasPlaceholder = w => w.word.toLowerCase().split(/[\s\/]+/).some(x => PLACEHOLDER_RE.test(x));
function wordSnap(w){
  return { id: w.id, word: w.word.trim(), meaning: w.meaning || '', pos: w.pos || '', kind: w.kind,
           sentence: (w.sentence || '').trim(), ipa: w.ipa || '' };
}
function pickVocab(n, valid, prefer, opts = {}){
  const seen = new Set(opts.exclude || []);
  const take = w => { const k = w.word.trim().toLowerCase(); if(!k || seen.has(k)) return false; seen.add(k); return true; };
  const pool = words.filter(w => w.word && w.word.trim() && valid(w));
  // điểm thấp = cuối danh sách ưu tiên → lấy trước; xáo nhẹ ±8% để mỗi ngày không y hệt,
  // tiêu chí phụ (prefer, vd. có câu ví dụ) chỉ kéo lên vài điểm chứ không lấn át thứ tự ưu tiên
  const key = new Map(pool.map(w => [w, priorityScore(w) * (0.92 + Math.random() * 0.16) - (prefer ? prefer(w) * 3 : 0)]));
  const ranked = pool.slice().sort((a, b) => key.get(a) - key.get(b));
  const out = [];
  for(const w of ranked){ if(out.length >= n) break; if(take(w)) out.push(w); }
  return { list: out, nNew: out.length, nFill: 0 };
}

/* ── Nhận diện từ mục tiêu kể cả dạng biến đổi hợp lệ (books, studied, went…) ── */
const IRREGULAR = {
  be:'am is are was were been being', have:'has had having', do:'does did done doing', go:'goes went gone going',
  make:'made', take:'took taken', give:'gave given', get:'got gotten', come:'came', see:'saw seen', know:'knew known',
  think:'thought', find:'found', tell:'told', become:'became', leave:'left', feel:'felt', bring:'brought',
  begin:'began begun', keep:'kept', hold:'held', write:'wrote written', stand:'stood', hear:'heard', mean:'meant',
  meet:'met', run:'ran', pay:'paid', sit:'sat', speak:'spoke spoken', lead:'led', read:'read', grow:'grew grown',
  lose:'lost', fall:'fell fallen', send:'sent', build:'built', understand:'understood', draw:'drew drawn',
  break:'broke broken', spend:'spent', rise:'rose risen', drive:'drove driven', buy:'bought', wear:'wore worn',
  choose:'chose chosen', seek:'sought', throw:'threw thrown', catch:'caught', deal:'dealt', win:'won',
  forget:'forgot forgotten', teach:'taught', sell:'sold', fight:'fought', overcome:'overcame', undergo:'underwent undergone',
  withdraw:'withdrew withdrawn', arise:'arose arisen', eat:'ate eaten', drink:'drank drunk', sleep:'slept',
  fly:'flew flown', forgive:'forgave forgiven', hide:'hid hidden', ride:'rode ridden', ring:'rang rung', shake:'shook shaken',
  sing:'sang sung', steal:'stole stolen', swim:'swam swum', tear:'tore torn', wake:'woke woken', bear:'bore borne born',
  bind:'bound', bite:'bit bitten', feed:'fed', flee:'fled', freeze:'froze frozen', lay:'laid', lend:'lent',
  light:'lit', shine:'shone', shoot:'shot', strike:'struck', swear:'swore sworn', sweep:'swept', weep:'wept',
  child:'children', person:'people', man:'men', woman:'women', mouse:'mice', foot:'feet', tooth:'teeth',
  good:'better best', bad:'worse worst', far:'further farther furthest farthest', analysis:'analyses', crisis:'crises',
  phenomenon:'phenomena', criterion:'criteria',
};
function wordForms(base){
  const b = base.toLowerCase();
  const f = new Set([b, b + 's', b + 'es', b + 'ed', b + 'd', b + 'ing', b + 'er', b + 'est', b + 'ly', b + "'s", b + '’s']);
  if(/e$/.test(b)){ f.add(b.slice(0, -1) + 'ing'); f.add(b.slice(0, -1) + 'ely'); }
  if(/ie$/.test(b)) f.add(b.slice(0, -2) + 'ying');
  if(/[^aeiou]y$/.test(b)){ const s = b.slice(0, -1); ['ies','ied','ier','iest','ily','iness'].forEach(x => f.add(s + x)); }
  if(/[^aeiou][aeiou][bdgklmnprt]$/.test(b)){ const c = b.slice(-1); ['ed','ing','er','est'].forEach(x => f.add(b + c + x)); }
  if(/(fe|f)$/.test(b)) f.add(b.replace(/(fe|f)$/, 'ves'));
  if(/le$/.test(b)) f.add(b.slice(0, -1) + 'y');
  if(/ic$/.test(b)) f.add(b + 'ally');
  if(IRREGULAR[b]) IRREGULAR[b].split(' ').forEach(x => f.add(x));
  return f;
}
const tgtReCache = new Map();
function targetRegex(word){
  if(tgtReCache.has(word)) return new RegExp(tgtReCache.get(word), 'gi');
  const toks = word.toLowerCase().replace(/\(.*?\)/g, ' ').split(/[\s\/]+/).filter(Boolean);
  let src = '', first = true, gap = false;
  for(const tk of toks){
    if(PLACEHOLDER_RE.test(tk)){ gap = true; continue; }
    const alt = [...wordForms(tk)].sort((a, b) => b.length - a.length).map(escRe).join('|');
    if(!first) src += gap ? "(?:[\\s,]+[\\w'’-]+){0,4}?[\\s,]+" : '[\\s-]+';
    src += '(?:' + alt + ')';
    first = false; gap = false;
  }
  if(!src) return null;
  src = "(?<![\\w'’-])" + src + "(?![\\w-])";
  tgtReCache.set(word, src);
  return new RegExp(src, 'gi');
}
function findTarget(text, word){
  const re = targetRegex(word);
  return re ? [...(text || '').matchAll(re)] : [];
}

/* ── Kiểm tra linh hoạt cho phần Viết: tách cụm từ dài thành các "cụm từ khoá" ──
   • Chỉ với cụm dài (≥ 5 từ): tách ở liên từ / động từ "to be" nằm GIỮA cụm (and, or,
     but, were, is…) khi mỗi bên có ≥ 2 từ và có từ mang nghĩa — các từ nối đó không bắt
     buộc. Cụm ngắn như "rock and roll" giữ nguyên.
   • Mạo từ (a/an/the) trong cụm là tuỳ chọn và đổi được (my, this, some…); mạo từ ở
     đầu/cuối cụm bị bỏ. Giới từ giữa các từ mang nghĩa (key TO regaining) được giữ
     vì bỏ đi sẽ đổi nghĩa.
   • Mỗi cụm khoá phải là các từ liên tiếp; các cụm phải đúng thứ tự, trong cùng một câu. */
const KC_SPLIT = new Set(['and','or','but','nor','yet','is','are','was','were','am','be','been','being','while','whereas','because','which','who','whom','whose']);
const KC_ART = new Set(['a','an','the']);
const KC_DET = 'a|an|the|my|your|his|her|its|our|their|this|that|these|those|some|any|one';
const KC_FUNC = new Set([...KC_SPLIT, ...KC_ART, 'to','of','in','on','at','for','with','by','from','as','into','onto','about','up','down','out','off','over',
  'so','than','then','that','this','it','its','not','do','does','did','has','have','had','will','would','can','could','should','may','might','must']);
const kcCache = new Map();
function keyChunks(word){
  if(kcCache.has(word)) return kcCache.get(word);
  const toks = word.toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[,;:]+/g, ' , ').split(/[\s\/]+/).filter(Boolean);
  const content = tk => tk !== ',' && !KC_FUNC.has(tk) && !PLACEHOLDER_RE.test(tk);
  let chunks = [[]];
  toks.forEach((tk, i) => {
    const cur = chunks[chunks.length - 1];
    const isSplit = tk === ',' || (KC_SPLIT.has(tk) && i > 0 && i < toks.length - 1);
    const rest = toks.slice(i + 1).filter(x => x !== ',');
    if(isSplit && toks.length >= 5 && cur.length >= 2 && rest.length >= 2 && cur.some(content) && rest.some(content)){ chunks.push([]); return; }
    if(tk !== ',') cur.push(tk);
  });
  chunks = chunks.map(c => {
    while(c.length > 1 && (KC_ART.has(c[0]) || KC_SPLIT.has(c[0]))) c.shift();
    while(c.length > 1 && (KC_ART.has(c[c.length - 1]) || KC_SPLIT.has(c[c.length - 1]))) c.pop();
    return c;
  }).filter(c => c.length);
  if(!chunks.length) chunks = [toks.filter(tk => tk !== ',')];
  const out = chunks.map(c => {
    let src = '', gap = false, det = false;
    for(const tk of c){
      if(PLACEHOLDER_RE.test(tk)){ gap = true; continue; }
      if(KC_ART.has(tk) && src){ det = true; continue; }
      const alt = [...wordForms(tk)].sort((a, b) => b.length - a.length).map(escRe).join('|');
      if(src) src += gap ? "(?:[\\s,]+[\\w'’-]+){0,4}?[\\s,]+" : '[\\s-]+';
      if(det) src += '(?:(?:' + KC_DET + ')[\\s-]+)?';
      src += '(?:' + alt + ')';
      gap = false; det = false;
    }
    return { label: c.join(' '), src: src ? "(?<![\\w'’-])" + src + "(?![\\w-])" : '' };
  }).filter(c => c.src);
  kcCache.set(word, out);
  return out;
}
/* Trả về các "lần dùng" hợp lệ: { 0: đoạn khớp, index, parts: [[đầu, cuối]…] } */
function findUse(text, word){
  text = text || '';
  const ks = keyChunks(word);
  if(!ks.length) return [];
  const mk = (a, b, parts) => Object.assign([text.slice(a, b)], { index: a, parts });
  if(ks.length === 1)
    return [...text.matchAll(new RegExp(ks[0].src, 'gi'))].map(m => mk(m.index, m.index + m[0].length, [[m.index, m.index + m[0].length]]));
  const out = [];
  for(const sn of splitSentences(text)){
    let pos = sn.start;
    for(;;){
      const parts = [];
      let p2 = pos;
      for(const k of ks){
        const re = new RegExp(k.src, 'gi'); re.lastIndex = 0;
        const m = re.exec(text.slice(p2, sn.end));
        if(!m) break;
        parts.push([p2 + m.index, p2 + m.index + m[0].length]); p2 = p2 + m.index + m[0].length;
      }
      if(parts.length < ks.length) break;
      out.push(mk(parts[0][0], parts[parts.length - 1][1], parts));
      pos = p2;
    }
  }
  return out;
}
/* Trạng thái từng cụm khoá (có xuất hiện trong đoạn văn hay không) để hiển thị */
function chunkStatus(text, word){
  return keyChunks(word).map(k => ({ label: k.label, ok: new RegExp(k.src, 'i').test(text || '') }));
}

/* ── Khởi tạo nội dung từng nhiệm vụ (chỉ 1 lần; giữ nguyên khi đổi chế độ) ── */
async function fetchExample(word){              // câu ví dụ từ Free Dictionary nếu từ chưa có câu
  try{
    const r = await fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(word.toLowerCase().trim()));
    if(!r.ok) return '';
    const data = await r.json();
    for(const e of (Array.isArray(data) ? data : []))
      for(const m of (e.meanings || []))
        for(const d of (m.definitions || []))
          if(d.example && findTarget(d.example, word).length && d.example.split(/\s+/).length >= 4) return d.example.trim();
  }catch(e){}
  return '';
}
function contextParts(sentence, word){         // tách câu quanh MỌI lần xuất hiện của từ
  const ms = findTarget(sentence, word);
  if(!ms.length) return null;
  const parts = []; let pos = 0;
  ms.forEach(m => { parts.push(sentence.slice(pos, m.index)); pos = m.index + m[0].length; });
  parts.push(sentence.slice(pos));
  let ans = ms[0][0];
  if(ms[0].index === 0 && word[0] === word[0].toLowerCase()) ans = ans[0].toLowerCase() + ans.slice(1);
  return { parts, ans };
}
function initTask(k){
  const x = tasks.t[k];
  if(x.inited || k === 'focus') return x;
  const n = TASK_MODES[tasks.mode][k];
  let r;
  if(k === 'pron'){
    r = pickVocab(n, w => !hasPlaceholder(w), w => (w.sentence && findTarget(w.sentence, w.word).length ? 2 : 0) + (w.kind === 'đơn' ? 1 : 0));
    x.items = r.list.map(w => {
      const s = wordSnap(w);
      if(!findTarget(s.sentence, s.word).length) s.sentence = '';
      return Object.assign(s, { stage: 'word', wa: [], sa: [], skipW: false, skipS: false, noSent: false, done: false });
    });
  }else if(k === 'listen'){
    r = pickVocab(n, w => !hasPlaceholder(w), w => w.kind === 'đơn' ? 1 : 0);
    x.items = r.list.map(w => Object.assign(wordSnap(w), { tries: 0, revealed: false, done: false }));
  }else if(k === 'context'){
    const sents = new Set();
    r = pickVocab(n, w => {
      if(!w.sentence || !contextParts(w.sentence, w.word)) return false;
      const key = w.sentence.trim().toLowerCase();
      return !sents.has(key) && (sents.add(key), true);
    });
    x.items = r.list.map(w => { const c = contextParts(w.sentence, w.word);
      return { id: w.id, word: w.word.trim(), meaning: w.meaning || '', parts: c.parts, ans: c.ans }; });
    let order = shuffle(x.items.map((_, i) => i));
    if(order.length > 1 && order.every((v, i) => v === i)) order = order.slice(1).concat(order[0]);   // tránh trùng thứ tự câu
    x.order = order;
    x.slots = x.items.map(() => -1);
    x.res = x.items.map(() => 0);       // 0 chưa kiểm · 1 đúng (khoá) · 2 sai (cần sửa)
    x.checks = 0;
  }else if(k === 'write'){
    const per = WRITE_WORDS, paras = n;
    x.paras = []; let used = [];
    for(let p = 0; p < paras; p++){
      const list = pickVocab(per, () => true, null, { anyWord: true, exclude: used }).list;
      if(list.length < per)                          // sổ ít từ — bù bằng từ đã dùng ở đoạn trước (không trùng trong cùng đoạn)
        list.push(...pickVocab(per - list.length, () => true, null,
          { anyWord: true, exclude: list.map(w => w.word.trim().toLowerCase()) }).list);
      used = used.concat(list.map(w => w.word.trim().toLowerCase()));
      x.paras.push({ words: list.map(wordSnap), text: '', errors: [], issues: [], checks: 0, done: false, checkedText: '' });
    }
    x.short = x.paras.some(p => p.words.length < per) ? 1 : 0;
    x.target = x.paras.length;
    x.inited = x.paras.length > 0 && x.paras.every(p => p.words.length > 0);
    x.idx = 0;
    if(!x.inited){ x.paras = []; return x; }
    tasks.started = true; saveTasks();
    return x;
  }
  x.want = n; x.nNew = r.nNew; x.nFill = r.nFill;
  x.target = x.items.length; x.idx = 0;
  x.inited = x.items.length > 0;
  if(!x.inited){ x.items = []; return x; }
  tasks.started = true; saveTasks();
  return x;
}

/* Hoàn thành một nhiệm vụ → mở khoá nhiệm vụ sau, hiện màn chuyển tiếp */
function completeTask(k){
  const x = tasks.t[k];
  if(x.done) return;
  x.done = true; x.doneAt = now();
  recAbort();
  if(TASK_KEYS.every(q => tasks.t[q].done)){ finishDay(); return; }
  saveTasks();
  tkTrans = k; tkView = 'trans';
  chime('done');
  renderTasks();
}
function finishDay(){
  if(tasks.completedAt) return;
  tasks.completedAt = now();
  taskHist[tasks.date] = { mode: tasks.mode, doneAt: tasks.completedAt, sum: taskSummaryData() };
  const merges = gardenAddTaskFlower(tasks.date), added = !!merges;
  tasks.flowerAdded = added ? 1 : 0;
  saveTasks(true);
  tkView = 'done'; tkAnimDone = !tasks.celebrated;
  tasks.celebrated = true; saveTasks(true);
  chime('done');
  if(added){
    toast(t('tkFlowerToast', TASK_FLOWERS));
    merges.forEach((key, i) => setTimeout(() => toast(t(key)), 2400 * (i + 1)));
  }
  renderTasks();
}
function taskSummaryData(){
  const T = tasks.t;
  const pr = T.pron.items || [], ls = T.listen.items || [];
  const prScores = pr.flatMap(i => i.wa.length ? [Math.max(...i.wa)] : []);
  return {
    focusMin: Math.floor(focusTodaySec() / 60),
    pron: pr.length, pronAvg: prScores.length ? Math.round(prScores.reduce((a, b) => a + b, 0) / prScores.length) : 0,
    pronSkip: pr.filter(i => i.skipW || i.skipS).length,
    listen: ls.length, listenFirst: ls.filter(i => i.firstTry).length,
    context: (T.context.items || []).length, contextChecks: T.context.checks || 0,
    write: (T.write.paras || []).length, writeChecks: (T.write.paras || []).reduce((s, p) => s + (p.checks || 0), 0),
  };
}
function taskSummaryLine(k){
  const s = taskSummaryData();
  if(k === 'focus') return t('tkSumFocus', s.focusMin);
  if(k === 'pron') return t('tkSumPron', s.pron, s.pronAvg, s.pronSkip);
  if(k === 'listen') return t('tkSumListen', s.listen, s.listenFirst);
  if(k === 'context') return t('tkSumContext', s.context, s.contextChecks);
  if(k === 'write') return t('tkSumWrite', s.write, s.writeChecks);
  return '';
}
