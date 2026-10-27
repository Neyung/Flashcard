/* ═══════════════════════════════════════════════════════════
   §10 THỬ THÁCH THIÊNG (Sacred Challenge) + KHIÊN BẢO VỆ CHUỖI
   ═══════════════════════════════════════════════════════════
   • Mốc = mỗi 25 phút Focus TÍCH LUỸ trong ngày, đọc từ focusLog (cùng bộ đếm với nhiệm vụ
     Focus — không có bộ đếm riêng). Chỉ mời khi vượt mốc lúc đang Focus; id = ngày_phút nên
     mỗi mốc/ngày đúng một lần, kể cả tải lại trang hay đồng bộ nhiều máy.
   • Từ lúc mời tới khi xong, đồng hồ Focus đóng băng → thời gian làm không được cộng.
   • Hoàn thành đúng toàn bộ → 1 khiên, id khiên = 'sh_' + id thử thách → không thể nhận 2 lần.
   • Khiên bảo vệ "chuỗi đúng" ở Luyện gõ (chuỗi duy nhất của app): khi một câu sai làm mất
     chuỗi ≥ SHIELD_MIN, 1 khiên bị tiêu thụ thay cho chuỗi (mỗi câu chỉ xử lý 1 lần). */
const SC_STEP = 25 * 60, SHIELD_MIN = 3;
const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const SC_RANK = { offered: 1, generating: 1, error: 1, active: 2, skipped: 3, abandoned: 3, completed: 4 };
const SC_OPEN = ['offered', 'generating', 'error', 'active'];
let sacred = null, sacredSaveT = null;
let scCur = null, scSel = -1, scExitArm = false, scBusy = false, scView = '', scFb = null, scFirst = false;
const sacredKey = () => 'soTuSacred_' + currentUser;
const streakKey = () => 'soTuQuizStreak_' + currentUser;
const shieldsLeft = () => sacred ? sacred.shields.filter(x => !x.used).length : 0;
const cefrRank = w => w.cefr && w.cefr.lv ? CEFR.indexOf(w.cefr.lv) + 1 : 0;

function scNormCh(c){
  if(!SC_RANK[c.status]) c.status = 'offered';
  if(c.pz && typeof c.pz === 'object'){
    c.pz.parts = asArr(c.pz.parts).map(x => typeof x === 'string' ? x.replace(/[*`]+/g, '') : '');
    c.pz.blanks = asArr(c.pz.blanks).filter(b => b && typeof b.ans === 'string');
    c.pz.bank = asArr(c.pz.bank).filter(b => b && typeof b.t === 'string').map(b => ({ ...b, t: b.t.replace(/[*`]+/g, '').trim() }));
    c.pz.blanks.forEach(b => { b.ans = b.ans.replace(/[*`]+/g, '').trim(); });
    if(c.pz.parts.length !== c.pz.blanks.length + 1 || !c.pz.blanks.length) delete c.pz;
  }else delete c.pz;
  if(c.status === 'active' && !c.pz) c.status = 'offered';          // mất dữ liệu đoạn văn → soạn lại, không tính thắng/thua
  const n = c.pz ? c.pz.blanks.length : 0;
  c.slots = Array.from({ length: n }, (_, i) => Number.isInteger(asArr(c.slots)[i]) ? c.slots[i] : -1);
  c.res = Array.from({ length: n }, (_, i) => [0, 1, 2].includes(asArr(c.res)[i]) ? c.res[i] : 0);
  c.words = asArr(c.words);
  return c;
}
function sacredNorm(v){
  const s = { challenges: {}, shields: [], blessed: false, upd: 0 };
  if(v && typeof v === 'object'){
    if(v.challenges && typeof v.challenges === 'object')
      for(const [id, c] of Object.entries(v.challenges)) if(c && typeof c === 'object' && c.id === id) s.challenges[id] = scNormCh(c);
    s.shields = asArr(v.shields).filter(x => x && typeof x.id === 'string' && typeof x.ch === 'string');
    s.blessed = !!v.blessed; s.upd = +v.upd || 0;
  }
  return s;
}
/* Gộp bản trên máy + trên mây: trạng thái thử thách "tiến xa hơn" thắng; khiên gộp theo id,
   khiên đã dùng ở bất kỳ bản nào thì coi là đã dùng (không bao giờ "hồi sinh" khiên) */
function sacredMerge(a, b){
  const s = sacredNorm(a), o = sacredNorm(b);
  for(const [id, c] of Object.entries(o.challenges)){
    const m = s.challenges[id], rc = SC_RANK[c.status], rm = m ? SC_RANK[m.status] : 0;
    if(!m || rc > rm || (rc === rm && (c.upd || 0) > (m.upd || 0))) s.challenges[id] = c;
  }
  const byId = new Map(s.shields.map(x => [x.id, x]));
  o.shields.forEach(x => { const m = byId.get(x.id); if(!m || (x.used && !m.used)) byId.set(x.id, x); });
  s.shields = [...byId.values()].sort((x, y) => (x.at || 0) - (y.at || 0));
  s.blessed = s.blessed || o.blessed;
  return s;
}
function saveSacred(immediate){
  if(!currentUser || !sacred) return;
  sacred.upd = now();
  const snap = JSON.stringify(sacred);
  try{ localStorage.setItem(sacredKey(), snap); }catch(e){}
  if(!cloudOn()) return;
  clearTimeout(sacredSaveT);
  const user = currentUser, put = () => cloudPut('users/' + user + '/sacred', JSON.parse(snap)).catch(() => {});
  if(immediate) put(); else sacredSaveT = setTimeout(put, 2000);
}
async function loadSacred(){
  scCur = null; scBusy = false; $('#scOverlay').hidden = true; document.body.classList.remove('sc-open');
  let local = null, remote = null;
  try{ local = JSON.parse(localStorage.getItem(sacredKey()) || 'null'); }catch(e){}
  if(cloudOn()) try{ remote = await cloudGet('users/' + currentUser + '/sacred'); }catch(e){}
  sacred = sacredMerge(local, remote);
  Object.values(sacred.challenges).forEach(c => { if(c.status === 'completed') grantShield(c); });   // bù khiên nếu lỡ mất (idempotent)
  const cut = Date.now() - 60 * 86400000;                                      // dọn thử thách > 60 ngày (khiên giữ nguyên)
  Object.values(sacred.challenges).forEach(c => { if((c.at || 0) < cut && !SC_OPEN.includes(c.status)) delete sacred.challenges[c.id]; });
  try{ quizStreak = Math.max(0, parseInt(localStorage.getItem(streakKey()), 10) || 0); }catch(e){ quizStreak = 0; }
  saveSacred();
}
function grantShield(c){
  const id = 'sh_' + c.id;
  if(sacred.shields.some(x => x.id === id)) return false;
  sacred.shields.push({ id, ch: c.id, at: c.doneAt || now(), used: 0 });
  return true;
}
/* Tiêu thụ 1 khiên (cũ nhất) cho một sự kiện — cùng sự kiện xử lý lại sẽ không trừ thêm */
function sacredConsume(ev){
  if(!sacred || !shieldsLeft() || sacred.shields.some(x => x.ev === ev)) return false;
  const sh = sacred.shields.find(x => !x.used);
  sh.used = now(); sh.ev = ev;
  saveSacred(true);
  return true;
}
function renderShieldAura(chip, n){
  if(!chip) return;
  n = Math.max(0, n);
  chip.dataset.shield = Math.min(5, n);
  const b = chip.querySelector('.shield-n b'); if(b) b.textContent = n;
  chip.title = n ? t('shieldTitle', n) : '';
}

/* ── Mốc Focus → mời thử thách ── */
function scOnFocusSecond(before){
  if(!sacred || !currentUser) return false;
  const after = focusTodaySec(), k = Math.floor(after / SC_STEP);
  scPrepare((k + 1) * 25);                // soạn sẵn đoạn văn cho mốc kế tiếp ngay từ đầu chặng 25 phút (mỗi mốc chỉ soạn 1 lần)
  if(k < 1 || Math.floor(before / SC_STEP) >= k) return false;
  const day = todayKey(), id = day + '_' + (k * 25);
  if(sacred.challenges[id]) return false;                                      // mốc này hôm nay đã xử lý
  sacred.challenges[id] = { id, day, min: k * 25, status: 'offered', at: now(), upd: now(), slots: [], res: [], words: [] };
  saveSacred(true);
  scOpen(id);
  return true;
}
function scFreeze(){
  if(!focus || !focus.running) return;
  clearInterval(focus.tick); focus.running = false; focus.frozen = true;
  stopAwayAlarm(false); saveFocusLog(true);
  $('#focusSub').textContent = t('scPausedSub');
  setTitle(); renderFocus();
}
function scWarm(){ scLmReady().then(ok => { if(ok) scSession().then(x => { try{ x.destroy(); }catch(e){} }).catch(() => {}); }); }
function scResume(){
  if(!focus || !focus.frozen) return;
  focus.frozen = false; focus.running = true;
  $('#focusSub').textContent = t('focusRunning');
  focusTickStart(); renderFocus();
}
function scOpen(id){
  const c = sacred && sacred.challenges[id]; if(!c) return;
  scCur = id; scSel = -1; scExitArm = false; scView = ''; scFb = null;
  if(SC_OPEN.includes(c.status)) scFreeze();
  $('#scOverlay').hidden = false; document.body.classList.add('sc-open');
  if(c.status === 'offered') scPrepare(c.min);                             // soạn trong lúc người dùng đọc lời mời
  if(c.status === 'generating' && !scBusy) scGenerate(c, c.mode);          // tải lại giữa lúc đang soạn → soạn lại
  else scRender();
}
function scClose(resume){
  $('#scOverlay').hidden = true; document.body.classList.remove('sc-open');
  scCur = null;
  if(resume) scResume();
}
function scShowPending(){
  if(!sacred) return;
  const p = Object.values(sacred.challenges).filter(c => SC_OPEN.includes(c.status)).sort((a, b) => (a.at || 0) - (b.at || 0))[0];
  if(p) scOpen(p.id);
}

/* ── Độ khó: theo mốc Focus + năng lực thực tế (tỉ lệ đúng, mức CEFR đã nắm) ── */
function scAbility(){                    // mức CEFR cao nhất người dùng đã trả lời đúng ổn định
  let best = 0;
  words.forEach(w => { const r = cefrRank(w); if(r && w.stats.correct >= 2 && accuracy(w) >= .6) best = Math.max(best, r); });
  if(best) return best;
  const rs = words.map(cefrRank).filter(Boolean).sort((a, b) => a - b);   // chưa có lịch sử → trình độ của chính sổ từ (trung vị)
  return rs.length ? Math.max(3, rs[Math.floor(rs.length / 2)]) : 3;
}
function scPlan(min){
  const k = Math.max(1, Math.round(min / 25)), tier = k <= 2 ? 0 : k <= 5 ? 1 : 2;
  const seen = words.filter(w => w.stats.seen);
  const acc = seen.length >= 5 ? seen.reduce((a, w) => a + accuracy(w), 0) / seen.length : .7;   // ít dữ liệu → chưa điều chỉnh
  const blanks = [3, 5, 6][tier] + (acc >= .85 && tier < 2 ? 1 : 0) - (acc < .6 ? 1 : 0);
  return { tier, blanks: Math.max(2, blanks), distract: [1, 2, 3][tier], len: [[30, 45], [45, 70], [70, 100]][tier],
           cap: Math.min(6, scAbility() + (tier ? 1 : 0)) };
}
/* Chọn từ: CEFR cao (trong tầm năng lực) + hay sai/hay quên; tránh từ của 3 thử thách gần nhất */
function scPickWords(plan){
  const recent = new Set(Object.values(sacred.challenges).filter(c => c.words.length)
    .sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 3).flatMap(c => c.words));
  const pool = words.filter(w => w.word && w.word.trim() && w.meaning && !hasPlaceholder(w) && w.word.trim().split(/\s+/).length <= 3);
  const score = w => {
    const r = cefrRank(w) || 3;                       // chưa phân loại: xếp như B1 (chỉ để sắp xếp, không lưu)
    let v = r * 10 - Math.max(0, r - plan.cap) * 14;
    v += (1 - accuracy(w)) * (w.stats.seen ? 14 : 3) + Math.min(10, (w.stats.lapses || 0) * 2.5);
    if(recent.has(w.id)) v -= 40;
    return v + Math.random() * 6;
  };
  const keys = new Set();
  const ranked = pool.map(w => [w, score(w)]).sort((a, b) => b[1] - a[1]).map(x => x[0])
    .filter(w => { const k = w.word.trim().toLowerCase(); return !keys.has(k) && keys.add(k); });
  const n = Math.min(plan.blanks, ranked.length), targets = ranked.slice(0, n);
  const poses = new Set(targets.map(w => (w.pos || '').toLowerCase()));
  const rest = ranked.slice(n), close = rest.filter(w => poses.has((w.pos || '').toLowerCase()));   // nhiễu cùng loại từ = khó đoán mò
  const distract = [...close, ...rest.filter(w => !close.includes(w))].slice(0, plan.distract);
  return { targets, distract, ranked, n };
}

/* ── Soạn đoạn văn ── */
const SC_SYS = 'Write one short, natural English paragraph for a vocabulary exercise. Use every target word once, with the given '
  + 'meaning, in context that makes the meaning clear. Reply with the paragraph only.';
/* Phiên AI gốc (đã nạp lời dặn) được giữ lại; mỗi lần soạn chỉ clone → không phải khởi động lại mô hình */
let scBaseP = null, scPre = null;
async function scSession(){
  if(!scBaseP){
    scBaseP = LanguageModel.create({ ...AI_LANG, initialPrompts: [{ role: 'system', content: SC_SYS }],
      monitor: m => m.addEventListener('downloadprogress', e => { const el = $('#scProg'); if(el) el.textContent = t('scGenDl', Math.round(e.loaded * 100)); }) });
    scBaseP.catch(() => { scBaseP = null; });
  }
  const b = await scBaseP;
  if(b.clone) return await b.clone();
  scBaseP = null; return b;
}
const scLmReady = () => aiStatus().then(st => !!(st && st.kind === 'lm' && st.avail === 'available'));
/* Soạn sẵn (chỉ giữ trong bộ nhớ, chỉ dùng khi người dùng nhận thử thách đúng mốc đó) */
function scPrepare(min){
  const key = todayKey() + '_' + min;
  if(!sacred || !words || scBusy || (scPre && scPre.key === key) || sacred.challenges[key] && sacred.challenges[key].status !== 'offered') return;
  const plan = scPlan(min), pick = scPickWords(plan);
  if(pick.targets.length < 2) return;
  scPre = { key, plan, pick, p: scLmReady().then(ok => ok ? scFromAi(pick, plan, 1) : null).catch(() => null) };
}
const scSameWord = (inner, word) => { const m = findTarget(inner, word)[0]; return !!m && m.index === 0 && m[0].length === inner.length; };
const scErr = (key, extra) => Object.assign(new Error(key), { key }, extra || {});
function scBank(blanks, distract){
  const seen = new Set(blanks.map(b => b.ans.toLowerCase()));
  const extra = distract.map(w => w.word.trim()).filter(x => !seen.has(x.toLowerCase()) && seen.add(x.toLowerCase()));
  const low = x => x[0] === x[0].toUpperCase() && x.slice(1) === x.slice(1).toLowerCase() ? x.toLowerCase() : x;
  return shuffle([...blanks.map(b => ({ t: low(b.ans) })), ...extra.map(x => ({ t: x }))]);
}
/* Bỏ mọi dấu định dạng AI hay chèn: [[ ]], **đậm**, *nghiêng*, __gạch__, `code`, tiêu đề # */
const scClean = t => String(t || '').replace(/\[\[|\]\]/g, '').replace(/[*`]+/g, '').replace(/__+/g, '').replace(/^#+\s*/gm, '')
  .replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, ' ').trim();
/* Không phụ thuộc AI đánh dấu đúng: tìm từng từ mục tiêu (kể cả dạng chia) trong đoạn văn; từ xuất hiện
   ĐÚNG 1 lần mới thành chỗ trống (xuất hiện 2 lần sẽ lộ đáp án → để nguyên như chữ thường) */
function scParse(txt, targets, distract){
  const plain = scClean(txt);
  if(plain.split(' ').length < 12) return null;
  const hits = [];
  targets.forEach(w => { const ms = findTarget(plain, w.word); if(ms.length === 1) hits.push({ w, i: ms[0].index, s: ms[0][0] }); });
  hits.sort((a, b) => a.i - b.i);
  const keep = []; let end = -1;
  hits.forEach(h => { if(h.i >= end){ keep.push(h); end = h.i + h.s.length; } });
  if(keep.length < Math.max(2, Math.ceil(targets.length * .6))) return null;
  const parts = [], blanks = []; let pos = 0;
  keep.forEach(h => { parts.push(plain.slice(pos, h.i)); blanks.push({ ans: h.s, id: h.w.id }); pos = h.i + h.s.length; });
  parts.push(plain.slice(pos));
  return { parts, blanks, bank: scBank(blanks, distract), src: 'ai' };
}
async function scFromAi(pick, plan, tries){
  const style = ['simple', 'moderately complex', 'complex'][plan.tier];
  const q = `${plan.len[0]}-${plan.len[1]} words, ${style} sentences. Targets:\n`
    + pick.targets.map(w => `- ${w.word.trim()}${w.pos ? ` (${w.pos})` : ''}: ${w.meaning}`).join('\n');
  for(let attempt = 0; attempt < (tries || 2); attempt++){
    const ses = await scSession(), ac = new AbortController(), timer = setTimeout(() => ac.abort(), 60000);
    let raw = '';
    try{ raw = await ses.prompt(q, { signal: ac.signal }); }                   // văn bản thường: nhanh hơn ràng buộc JSON
    catch(e){ if(attempt + 1 >= (tries || 2)) throw e; }
    finally{ clearTimeout(timer); try{ ses.destroy(); }catch(e){} }
    const para = String(raw || '').split(/\n+/).map(x => x.replace(/^["“*#\s]+|["”*\s]+$/g, '')).sort((a, b) => b.length - a.length)[0] || '';
    const pz = scParse(para, pick.targets, pick.distract);
    if(pz) return pz;
  }
  return null;
}
/* Không có AI → người dùng có thể chọn ghép đoạn văn từ chính câu ví dụ trong sổ (dữ liệu thật) */
function scFromExamples(pick){
  const items = [];
  for(const w of pick.ranked){
    if(items.length >= pick.n) break;
    const sn = (w.sentence || '').trim(), m = sn && findTarget(sn, w.word)[0];
    if(m && findTarget(sn, w.word).length === 1) items.push({ w, sn, m });
  }
  if(items.length < 2) return null;
  const parts = [], blanks = [];
  let cur = '';
  items.forEach(({ w, sn, m }, i) => {
    cur += (i ? ' ' : '') + sn.slice(0, m.index); parts.push(cur);
    blanks.push({ ans: m[0], id: w.id }); cur = sn.slice(m.index + m[0].length);
  });
  parts.push(cur);
  const ids = new Set(items.map(x => x.w.id));
  return { parts, blanks, bank: scBank(blanks, pick.distract.filter(w => !ids.has(w.id))), src: 'ex' };
}
async function scGenerate(c, mode){
  if(scBusy) return;
  scBusy = true; c.status = 'generating'; c.mode = mode || 'ai'; c.err = ''; scFb = null;
  saveSacred(); if(scCur === c.id) scRender();
  try{
    const pre = c.mode === 'ai' && scPre && scPre.key === c.id ? scPre : null;   // đoạn văn đã soạn sẵn cho mốc này
    scPre = null;
    const plan = pre ? (c.plan = pre.plan) : c.plan || (c.plan = scPlan(c.min));
    const pick = pre ? pre.pick : scPickWords(plan);
    if(pick.targets.length < 2) throw scErr('scErrFew');
    let pz = null;
    if(c.mode === 'ex'){ pz = scFromExamples(pick); if(!pz) throw scErr('scErrExFew'); }
    else{
      if(pre) pz = await pre.p;
      if(!pz){
        const st = await aiStatus();
        if(!st || st.kind !== 'lm') throw scErr('scErrNoAi');
        pz = await scFromAi(pick, plan, pre ? 1 : 2);
      }
      if(!pz) throw scErr('scErrAi');
    }
    c.pz = pz; c.words = pz.blanks.map(b => b.id);
    c.slots = pz.blanks.map(() => -1); c.res = pz.blanks.map(() => 0); c.checks = 0;
    c.status = 'active'; c.startAt = now();
  }catch(e){
    c.status = 'error'; c.err = e.key || 'scErrAi';                          // không tự đánh dấu thắng/thua
  }finally{
    scBusy = false; c.upd = now(); saveSacred(true);
    if(scCur === c.id){ scView = ''; scRender(); }
  }
}

/* ── Giao diện ── */
const SC_EMBLEM = `<svg class="sc-emblem" viewBox="0 0 96 96" aria-hidden="true"><g stroke="#E2A72E" stroke-width="3" stroke-linecap="round"><line x1="86.0" y1="48.0" x2="93.0" y2="48.0"/><line x1="80.9" y1="67.0" x2="87.0" y2="70.5"/><line x1="67.0" y1="80.9" x2="70.5" y2="87.0"/><line x1="48.0" y1="86.0" x2="48.0" y2="93.0"/><line x1="29.0" y1="80.9" x2="25.5" y2="87.0"/><line x1="15.1" y1="67.0" x2="9.0" y2="70.5"/><line x1="10.0" y1="48.0" x2="3.0" y2="48.0"/><line x1="15.1" y1="29.0" x2="9.0" y2="25.5"/><line x1="29.0" y1="15.1" x2="25.5" y2="9.0"/><line x1="48.0" y1="10.0" x2="48.0" y2="3.0"/><line x1="67.0" y1="15.1" x2="70.5" y2="9.0"/><line x1="80.9" y1="29.0" x2="87.0" y2="25.5"/></g><circle cx="48" cy="48" r="32" fill="#FFF1B3" stroke="#23284A" stroke-width="3"/><circle cx="48" cy="48" r="25.5" fill="none" stroke="#E2A72E" stroke-width="1.6" stroke-dasharray="1.5 4" stroke-linecap="round"/><path d="M30 60V42c6-3.2 12-3.2 18 .8c6-4 12-4 18-.8v18c-6-3.2-12-3.2-18 .8c-6-4-12-4-18-.8z" fill="#fff" stroke="#23284A" stroke-width="2.5" stroke-linejoin="round"/><path d="M48 43v18" stroke="#23284A" stroke-width="2.2" stroke-linecap="round"/><path d="M35 47.5c3.5-1.4 6.5-1.2 9 .4M35 53c3.5-1.4 6.5-1.2 9 .4M52 47.9c2.5-1.6 5.5-1.8 9-.4M52 53.4c2.5-1.6 5.5-1.8 9-.4" stroke="#B9A15A" stroke-width="1.6" stroke-linecap="round" fill="none"/><path d="M48 22.5l1.9 4.6 4.6 1.9-4.6 1.9-1.9 4.6-1.9-4.6-4.6-1.9 4.6-1.9z" fill="#E2A72E" stroke="#23284A" stroke-width="1.2" stroke-linejoin="round"/></svg>`;
const SC_SEAL_MINI = `<svg class="sc-mini" viewBox="0 0 96 96" aria-hidden="true"><g stroke="#E2A72E" stroke-width="3" stroke-linecap="round"><line x1="86.0" y1="48.0" x2="93.0" y2="48.0"/><line x1="80.9" y1="67.0" x2="87.0" y2="70.5"/><line x1="67.0" y1="80.9" x2="70.5" y2="87.0"/><line x1="48.0" y1="86.0" x2="48.0" y2="93.0"/><line x1="29.0" y1="80.9" x2="25.5" y2="87.0"/><line x1="15.1" y1="67.0" x2="9.0" y2="70.5"/><line x1="10.0" y1="48.0" x2="3.0" y2="48.0"/><line x1="15.1" y1="29.0" x2="9.0" y2="25.5"/><line x1="29.0" y1="15.1" x2="25.5" y2="9.0"/><line x1="48.0" y1="10.0" x2="48.0" y2="3.0"/><line x1="67.0" y1="15.1" x2="70.5" y2="9.0"/><line x1="80.9" y1="29.0" x2="87.0" y2="25.5"/></g><circle cx="48" cy="48" r="32" fill="#FFF1B3" stroke="#23284A" stroke-width="3"/><circle cx="48" cy="48" r="25.5" fill="none" stroke="#E2A72E" stroke-width="1.6" stroke-dasharray="1.5 4" stroke-linecap="round"/><path d="M30 60V42c6-3.2 12-3.2 18 .8c6-4 12-4 18-.8v18c-6-3.2-12-3.2-18 .8c-6-4-12-4-18-.8z" fill="#fff" stroke="#23284A" stroke-width="2.5" stroke-linejoin="round"/><path d="M48 43v18" stroke="#23284A" stroke-width="2.2" stroke-linecap="round"/><path d="M35 47.5c3.5-1.4 6.5-1.2 9 .4M35 53c3.5-1.4 6.5-1.2 9 .4M52 47.9c2.5-1.6 5.5-1.8 9-.4M52 53.4c2.5-1.6 5.5-1.8 9-.4" stroke="#B9A15A" stroke-width="1.6" stroke-linecap="round" fill="none"/><path d="M48 22.5l1.9 4.6 4.6 1.9-4.6 1.9-1.9 4.6-1.9-4.6-4.6-1.9 4.6-1.9z" fill="#E2A72E" stroke="#23284A" stroke-width="1.2" stroke-linejoin="round"/></svg>`;
function scRender(){
  const c = sacred && sacred.challenges[scCur]; if(!c) return;
  const anim = scView !== c.status ? ' in' : '';
  scView = c.status;
  $('#scModal').classList.toggle('fail', c.status === 'abandoned');
  const body = $('#scBody');
  if(c.status === 'offered'){
    const plan = c.plan || scPlan(c.min);
    body.innerHTML = `<div class="sc-screen${anim}">${SC_EMBLEM}
      <div class="sc-title" id="scTitle">${t('scTitle')}</div><div class="sc-flour">✦</div>
      <div class="sc-sub">${esc(t('scMilestone', c.min))}</div>
      <p class="sc-desc">${esc(t('scDesc'))}</p>
      <div class="sc-meta"><span class="sc-pill">${I('edit')}${t('scBlanksN', plan.blanks)}</span><span class="sc-pill">${I('target')}${t('scLevelTo', CEFR[plan.cap - 1])}</span>
        <span class="sc-pill">${I('shield')}${t('scReward')}</span></div>
      <div class="sc-actions"><button class="btn sc-gold" data-sc="accept">${t('scAccept')}</button>
        <button class="btn" data-sc="skip">${t('scSkip')}</button></div>
      <div class="sc-note">${I('clock')} ${esc(t('scPaused'))}</div></div>`;
  }else if(c.status === 'generating'){
    body.innerHTML = `<div class="sc-screen${anim}"><div class="sc-title" id="scTitle">${t('scTitle')}</div><div class="sc-flour">✦</div>
      <div class="sc-spin"></div><p class="sc-desc" id="scProg">${esc(t('scGen'))}</p>
      <div class="sc-note">${I('clock')} ${esc(t('scPaused'))}</div></div>`;
  }else if(c.status === 'error'){
    const canAi = c.err !== 'scErrNoAi' && c.err !== 'scErrFew', canEx = c.err !== 'scErrFew' && c.err !== 'scErrExFew';
    body.innerHTML = `<div class="sc-screen${anim}"><div class="sc-title" id="scTitle">${t('scErrTitle')}</div><div class="sc-flour">✦</div>
      <p class="sc-desc">${esc(t(c.err || 'scErrAi'))}</p>
      <div class="sc-actions">${canAi ? `<button class="btn sc-gold" data-sc="retry">${t('scRetry')}</button>` : ''}
        ${canEx ? `<button class="btn mint" data-sc="useEx">${t('scUseEx')}</button>` : ''}
        <button class="btn" data-sc="skip">${t('scSkip')}</button></div>
      <div class="sc-note">${I('clock')} ${esc(t('scPaused'))}</div></div>`;
  }else if(c.status === 'active'){
    const pz = c.pz, okN = c.res.filter(x => x === 1).length, used = new Set(c.slots.filter(x => x >= 0));
    let p = '';
    pz.blanks.forEach((b, i) => {
      const sl = c.slots[i], cls = c.res[i] === 1 ? 'ok' : c.res[i] === 2 ? 'bad' : sl >= 0 ? 'filled' : '';
      p += esc(pz.parts[i]) + `<button class="sc-blank ${cls}" data-si="${i}" aria-label="${esc(t('scBlankN', i + 1))}"${c.res[i] === 1 ? ' aria-disabled="true"' : ''}>`
        + `<span class="n">${c.res[i] === 1 ? '✓' : i + 1}</span><span class="w">${sl >= 0 && pz.bank[sl] ? esc(pz.bank[sl].t) : ''}</span></button>`;
    });
    p += esc(pz.parts[pz.blanks.length]);
    const bank = pz.bank.map((x, i) => `<button class="sc-chip${used.has(i) ? ' used' : ''}${scSel === i ? ' sel' : ''}" data-bi="${i}" draggable="true"${used.has(i) ? ' tabindex="-1"' : ''}>${esc(x.t)}</button>`).join('');
    const dots = c.res.map((r, i) => `<i class="${r === 1 ? 'ok' : r === 2 ? 'bad' : c.slots[i] >= 0 ? 'fill' : ''}"></i>`).join('');
    body.innerHTML = `<div class="sc-screen${anim}">
      <div class="sc-top">${SC_SEAL_MINI}<div class="sc-top-t"><div class="sc-kicker">${t('scTitle')}</div>
        <div class="sc-h" id="scTitle">${t('scPlayH')}</div></div>
        <div class="sc-prog" title="${esc(t('scProgress', okN, pz.blanks.length))}"><div class="sc-dots">${dots}</div><span>${okN}/${pz.blanks.length}</span></div></div>
      <div class="sc-hint">${I('bulb')}<span>${esc(t('scFillHint'))}</span></div>
      <div class="sc-passage">${p}</div>
      <div class="sc-bank-h">${I('cards')}${esc(t('scWordsLbl'))}</div>
      <div class="sc-bank" role="group" aria-label="${esc(t('scWordsLbl'))}">${bank}</div>
      <div class="sc-fb ${scFb ? scFb[0] : ''}" role="status">${scFb ? esc(scFb[1]) : ''}</div>
      <div class="sc-actions"><button class="btn sc-gold" data-sc="check">${I('check')}${t('scCheck')}</button>
        <button class="btn" data-sc="exit">${t(scExitArm ? 'scExitConfirm' : 'scExit')}</button></div>
      <div class="sc-src">${esc(t(pz.src === 'ex' ? 'scSrcEx' : 'scSrcAi'))}</div></div>`;
  }else if(c.status === 'completed'){
    body.innerHTML = `<div class="sc-screen${anim}"><div class="sc-title" id="scTitle">${t('scDoneTitle')}</div><div class="sc-flour">✦</div>
      <div class="sc-preview" id="scPrev"></div>
      <p class="sc-desc">${esc(scFirst ? t('scDoneFirst') : t('scDoneMore', shieldsLeft()))}</p>
      <div class="sc-meta"><span class="sc-pill">${I('shield')}${t('shieldTitle', shieldsLeft())}</span><span class="sc-pill">${t('scTries', c.checks || 1)}</span></div>
      <p class="sc-note">${esc(t('scShieldHow', SHIELD_MIN))}</p>
      <div class="sc-actions"><button class="btn sc-gold" data-sc="back">${I('play')}${t('scBack')}</button></div></div>`;
  }else{                                                                    // abandoned
    body.innerHTML = `<div class="sc-screen${anim}">${SC_EMBLEM}<div class="sc-title" id="scTitle">${t('scFailTitle')}</div><div class="sc-flour">✦</div>
      <div class="sc-sub">${esc(t('scFailSub'))}</div>
      <div class="sc-actions"><button class="btn" data-sc="back">${I('play')}${t('scBack')}</button></div></div>`;
  }
  const f = body.querySelector('[data-sc="accept"],[data-sc="check"],[data-sc="back"],[data-sc="retry"],[data-sc="useEx"]');
  if(anim && f) f.focus({ preventScroll: true });
}
const scCh = () => sacred && sacred.challenges[scCur];
function scPlace(bi, si){
  const c = scCh(); if(!c || c.status !== 'active' || c.res[si] === 1) return;
  const prev = c.slots.indexOf(bi);
  if(prev >= 0){ if(c.res[prev] === 1) return; c.slots[prev] = -1; c.res[prev] = 0; }
  c.slots[si] = bi; c.res[si] = 0; scSel = -1; scFb = null; c.upd = now();
  saveSacred(); scRender();
  const nx = $('#scBody .sc-chip:not(.used)'); if(nx) nx.focus({ preventScroll: true });
}
function scCheck(){
  const c = scCh(); if(!c) return;
  if(c.slots.some(x => x < 0)){ scFb = ['bad', t('scFillAll')]; scRender(); return; }
  c.checks = (c.checks || 0) + 1;
  c.res = c.slots.map((bi, i) => c.pz.bank[bi].t.trim().toLowerCase() === c.pz.blanks[i].ans.trim().toLowerCase() ? 1 : 2);
  const bad = c.res.filter(x => x === 2).length;
  c.upd = now();
  if(!bad) return scComplete(c);
  scFb = ['bad', t('scWrongN', bad)];
  saveSacred(); scRender();
}
function scComplete(c){
  c.status = 'completed'; c.doneAt = now(); c.upd = now();
  scFirst = !sacred.blessed;
  grantShield(c); sacred.blessed = true;
  saveSacred(true);
  scRender(); chime('done');
  const main = $('#streakChip');
  renderShieldAura(main, shieldsLeft());
  const host = $('#scPrev');
  if(host && main){                                  // bản sao thanh streak ngay trong cửa sổ để thấy khiên được trao
    const cl = main.cloneNode(true);
    cl.id = 'scPreviewChip'; cl.style.marginLeft = '0';
    cl.classList.remove('tier-up', 'lost', 'ignite', 'feeding', 'frozen', 'zapped', 'blessed');
    cl.querySelectorAll('[id]').forEach(x => x.removeAttribute('id'));
    host.appendChild(cl);
    renderShieldAura(cl, shieldsLeft() - 1);
    requestAnimationFrame(() => (scFirst ? fxShieldDawn : fxShieldUp)(cl, () => renderShieldAura(cl, shieldsLeft())));
  }
}
$('#scBody').addEventListener('click', e => {
  const c = scCh(); if(!c) return;
  const a = e.target.closest('[data-sc]');
  if(a){
    const act = a.dataset.sc;
    if(act === 'accept'){ c.plan = c.plan || scPlan(c.min); scGenerate(c, 'ai'); }
    else if(act === 'retry') scGenerate(c, 'ai');
    else if(act === 'useEx') scGenerate(c, 'ex');
    else if(act === 'skip'){ c.status = 'skipped'; c.upd = now(); saveSacred(true); scClose(true); }
    else if(act === 'check') scCheck();
    else if(act === 'exit'){
      if(!scExitArm){ scExitArm = true; scRender(); setTimeout(() => { if(scExitArm){ scExitArm = false; if(scCh() && scCh().status === 'active') scRender(); } }, 4000); return; }
      scExitArm = false; c.status = 'abandoned'; c.upd = now(); saveSacred(true); scRender();
    }
    else if(act === 'back') scClose(true);
    return;
  }
  if(c.status !== 'active') return;
  const chip = e.target.closest('.sc-chip');
  if(chip){ const bi = +chip.dataset.bi; scSel = scSel === bi ? -1 : bi; scRender();
    const s = $(`#scBody .sc-chip[data-bi="${bi}"]`); if(s) s.focus({ preventScroll: true }); return; }
  const bl = e.target.closest('.sc-blank');
  if(bl){
    const si = +bl.dataset.si;
    if(c.res[si] === 1) return;
    if(scSel >= 0) scPlace(scSel, si);
    else if(c.slots[si] >= 0){ c.slots[si] = -1; c.res[si] = 0; scFb = null; saveSacred(); scRender(); }
  }
});
$('#scBody').addEventListener('dragstart', e => {
  const chip = e.target.closest('.sc-chip'); if(!chip) return;
  e.dataTransfer.setData('text/plain', chip.dataset.bi); e.dataTransfer.effectAllowed = 'move';
});
$('#scBody').addEventListener('dragover', e => {
  const bl = e.target.closest('.sc-blank:not(.ok)'); if(!bl) return;
  e.preventDefault(); bl.classList.add('drop');
});
$('#scBody').addEventListener('dragleave', e => { const bl = e.target.closest('.sc-blank'); if(bl) bl.classList.remove('drop'); });
$('#scBody').addEventListener('drop', e => {
  const bl = e.target.closest('.sc-blank:not(.ok)'); if(!bl) return;
  e.preventDefault();
  const bi = parseInt(e.dataTransfer.getData('text/plain'), 10);
  if(Number.isInteger(bi)) scPlace(bi, +bl.dataset.si);
});
