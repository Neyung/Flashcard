/* ═══════════════════════════════════════════════════════════
   CỤM GHÉP SAU KHI GÕ (tab Luyện gõ, chỉ từ đơn) — gõ xong một từ đơn → bảng bên cạnh liệt kê các cụm
   ghép từ đó với TỪ KHÁC ĐANG CÓ TRONG SỔ (vd sổ có "decision" → "make a decision") kèm nghĩa.
   - Nguồn cụm: (1) Datamuse — thống kê từ hay đi cùng nhau trong tiếng Anh thật, đối chiếu TOÀN BỘ sổ;
     (2) AI trên máy (Gemini Nano, nếu đã có sẵn) ghép cụm tự nhiên từ danh sách ngắn ứng viên Datamuse trước.
     Code kiểm lại từng cụm: mỗi chữ phải là từ vừa gõ, một từ đơn trong sổ (kể cả dạng chia) hoặc từ nối nhỏ
     (a, the, to, of…) → không có từ mới
   - QUÉT TRƯỚC (nhẹ): lúc người dùng rảnh tay (≥ 3 giây không gõ / bấm / cuộn, trang đang mở), app lần lượt tra
     Datamuse cho từng từ đơn trong sổ (từ sắp ra trước), cách nhau 1,5 giây → gõ xong là bảng hiện ngay.
     Gemini Nano (nặng, dùng GPU) chỉ chạy cho TỪ ĐANG HIỆN — hỏi ngay lúc từ vừa hiện, bổ sung cụm tự nhiên hơn.
     Nghĩa tiếng Việt chỉ dịch khi bảng thật sự hiện. Ghi bộ nhớ gộp mỗi 3 giây (localStorage + Firebase PATCH).
     Sổ thêm / bớt từ đơn → kết quả cũ vẫn hiện, được quét lại sau.
   - Câu ví dụ do NGƯỜI DÙNG tự đặt (ô nhập dưới mỗi cụm), lưu lại cho lần hiện sau; cụm đã có trong sổ
     thì câu cũng ghi vào cột câu ví dụ của cụm đó (nếu đang trống)
   - Không có cụm nào → không hiện bảng. Điện thoại / máy tính bảng → không bao giờ hiện
   - Lưu cụm: thêm vào sổ hiện có (makeWord, loại "cụm", cùng nhóm với từ gốc, ghi chú "từ gốc + từ ghép")
   - Lưu trữ: localStorage soTuCombos_v2_<user> + users/<user>/combos/<từ> (từng từ một, gộp theo thời gian)
   ═══════════════════════════════════════════════════════════ */
const CB_POOL = 80, CB_MAX = 8, CB_VER = 2;     // CB_VER đổi → kết quả cũ được quét lại (giữ câu tự đặt)
const CB_FUNC = new Set(('a an the to of in on at for with by from as into onto about up down out off over under after before '
  + 'through around across along against between without within upon back away together and or but not no so very much more most '
  + 'really well all some any one ones own someone something somebody anyone anything everyone everything sb sth oneself '
  + "one's someone's my your his her its our their me you him them us it this that these those is are be been being get got").split(' '));
const CB_SCHEMA = { type: 'object', required: ['combos'], properties: { combos: { type: 'array', maxItems: CB_MAX, items: {
  type: 'object', required: ['phrase', 'partner'], properties: { phrase: { type: 'string' }, partner: { type: 'string' } } } } } };
const cbKey = () => 'soTuCombos_v2_' + currentUser;
const CB_RE = /^[a-z][a-z'’-]*$/;
let cb = null;            // bảng đang hiện: {w, base, st:'load'|'done', list, edit}
let cbStore = { user: null, map: {}, loadP: null };     // map: từ → {n, at, list:[{ph, pt, mean, ex}]}
let cbRun = false, cbWant = null, cbScanOn = false, cbBaseP = null, cbDirty = false;
const cbFailed = new Set();

const cbSupported = () => !isMobileDevice();
/* Danh sách từ đơn + bảng dạng chia: tính một lần, chỉ làm lại khi sổ thêm / bớt từ (hoặc sau 30 giây) */
let cbMemo = { src: null, len: -1, at: 0, list: [], book: null };
function cbSingles(){
  const ws = words || [];
  if(cbMemo.src !== ws || cbMemo.len !== ws.length || now() - cbMemo.at > 30000)
    cbMemo = { src: ws, len: ws.length, at: now(), list: ws.filter(w => w.kind === 'đơn' && w.word && CB_RE.test(w.word.trim().toLowerCase())), book: null };
  return cbMemo.list;
}
const cbN = () => cbSingles().length;
const cbTxt = (s, max) => String(s || '').replace(/[*`#_"“”]+/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
const cbBase = w => w.word.trim().toLowerCase();
let cbAiOn = false;                                // Gemini Nano đã có sẵn trên máy
/* cbStale: chưa có / sổ đổi → cần quét (quét nền chỉ dùng Datamuse, rất nhẹ);
   cbNeeds: thêm điều kiện "chưa qua AI" — chỉ áp dụng cho từ đang hiện, để Gemini Nano không chạy nền làm nặng máy */
const cbStale = b => { const e = cbStore.map[b]; return !e || e.n !== cbN() || (e.v || 1) !== CB_VER; };
const cbNeeds = b => cbStale(b) || (cbAiOn && !cbStore.map[b].ai);
const cbAiCheck = () => aiStatus().then(st => { cbAiOn = !!st && st.kind === 'lm' && st.avail === 'available'; }, () => {});

/* ── Lưu trữ ── */
function cbLoad(){
  const user = currentUser;
  if(cbStore.user === user) return cbStore.loadP;
  cbStore = { user, map: {}, loadP: null };
  cbFailed.clear();
  cbStore.loadP = (async () => {
    let local = {}, remote = null;
    try{ local = JSON.parse(localStorage.getItem(cbKey()) || '{}') || {}; }catch(e){}
    if(cloudOn()) try{ remote = await cloudGet('users/' + user + '/combos'); }catch(e){}
    if(cbStore.user !== user) return;
    const map = Object.assign({}, local);
    Object.entries(remote || {}).forEach(([k, e]) => {         // gộp từng từ: bản mới hơn thắng
      const b = decodeURIComponent(k);
      if(e && (!map[b] || (e.at || 0) > (map[b].at || 0))) map[b] = e;
    });
    Object.values(map).forEach(e => { e.list = asArr(e.list).filter(c => c && c.ph); });
    cbStore.map = map;
    try{ localStorage.setItem(cbKey(), JSON.stringify(map)); }catch(e){}
  })();
  return cbStore.loadP;
}
/* Ghi gộp: localStorage + Firebase (PATCH nhiều từ một lần) sau CB_FLUSH ms, không ghi mỗi từ một lần */
const CB_FLUSH = 3000;
let cbDirtyKeys = new Set(), cbFlushT = null;
function cbPut(b, entry){
  if(cbStore.user !== currentUser) return;
  cbStore.map[b] = entry;
  cbDirtyKeys.add(b);
  if(!cbFlushT) cbFlushT = setTimeout(cbFlush, CB_FLUSH);
}
function cbFlush(){
  clearTimeout(cbFlushT); cbFlushT = null;
  if(!cbDirtyKeys.size || cbStore.user !== currentUser) return;
  const user = currentUser, body = {};
  cbDirtyKeys.forEach(b => { if(cbStore.map[b]) body[encodeURIComponent(b)] = cbStore.map[b]; });
  cbDirtyKeys = new Set();
  try{ localStorage.setItem(cbKey(), JSON.stringify(cbStore.map)); }catch(e){}
  if(cloudOn()) fetch(CLOUD_URL + '/users/' + encodeURIComponent(user) + '/combos.json', { method: 'PATCH', body: JSON.stringify(body) }).catch(() => {});
}
window.addEventListener('pagehide', cbFlush);

/* ── AI: phiên gốc giữ lại, mỗi lần hỏi clone (giống tab Đề tài) ── */
async function cbSession(){
  if(!cbBaseP){
    cbBaseP = LanguageModel.create({ ...AI_LANG, initialPrompts: [{ role: 'system', content:
      'You help Vietnamese learners of English find natural collocations. Use common, natural English. Reply with JSON only.' }],
      monitor: m => m.addEventListener('downloadprogress', e => cbProg(t('cbDl', Math.round(e.loaded * 100)))) });
    cbBaseP.catch(() => { cbBaseP = null; });
  }
  const b = await cbBaseP;
  if(b.clone) return await b.clone();
  cbBaseP = null; return b;
}
/* Bảng tra: mọi dạng chia của từ đơn trong sổ → từ gốc (bỏ chính từ đang xét) */
function cbBook(base){
  cbSingles();
  if(!cbMemo.book){
    const all = new Map();
    cbMemo.list.forEach(w => { const k = cbBase(w); wordForms(k).forEach(f => { if(!all.has(f)) all.set(f, k); }); });
    cbMemo.book = all;
  }
  const all = cbMemo.book, own = wordForms(base);
  return { size: all.size, get: x => own.has(x) ? undefined : all.get(x) };
}
/* Kiểm từng cụm: chỉ gồm từ gốc + từ đơn trong sổ + từ nối nhỏ; phải có từ gốc và ít nhất một từ trong sổ */
function cbValid(ph, base, book){
  const toks = ph.toLowerCase().replace(/[.,!?;:()]/g, ' ').split(/\s+/).filter(Boolean);
  if(toks.length < 2 || toks.length > 6) return null;
  const own = wordForms(base);
  let hasBase = false, partner = null;
  for(const tk of toks){
    if(own.has(tk)){ hasBase = true; continue; }
    const bw = book.get(tk);
    if(bw){ partner = partner || bw; continue; }
    if(!CB_FUNC.has(tk)) return null;              // chữ không có trong sổ → loại cả cụm
  }
  return hasBase && partner ? partner : null;
}

/* ── Bước 1: Datamuse (miễn phí, không cần key) — thống kê từ hay đi liền nhau trong tiếng Anh thật,
   đối chiếu với TOÀN BỘ sổ:
   - liền sau / liền trước từ gốc (take → care, final → decision) và tính từ ↔ danh từ (important decision)
     → thành cụm luôn ("chắc chắn" vì có trong kho ngữ liệu)
   - từ hay xuất hiện gần (make … decisions) → ứng viên đưa AI ghép thành cụm tự nhiên ("make a decision") */
const CB_DM_RANK = 200, CB_DM_REL = 0.03, CB_JJ_RANK = 60;
async function cbDm(params, signal){
  try{
    const r = await Promise.race([fetch('https://api.datamuse.com/words?' + params, { signal }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000))]);
    if(!r.ok) return [];
    return asArr(await r.json()).filter(x => x && x.word).map(x => ({ w: String(x.word).toLowerCase(), sc: +x.score || 0, tags: asArr(x.tags) }));
  }catch(e){ return []; }
}
/* Dạng được phép ghép trực tiếp: gốc, số nhiều, -ing (decision making) — không nhận quá khứ (decision taken, rain made) */
function cbPlainForm(x, pt, tags){
  if(x === pt) return true;
  if(x === pt + 's' || x === pt + 'es' || (/[^aeiou]y$/.test(pt) && x === pt.slice(0, -1) + 'ies')) return tags.includes('n');   // số nhiều, không phải "takes"
  return /ing$/.test(x) && wordForms(pt).has(x);
}
const cbDmCache = new Map();                       // kết quả Datamuse gần đây (từ → {direct, cand}) — lượt AI bổ sung không phải tra lại
async function cbDatamuse(base, book, w, signal){
  const key = base + '|' + cbN();
  if(cbDmCache.has(key)) return cbDmCache.get(key);
  const res = await cbDatamuseRaw(base, book, w, signal);
  if(signal.aborted) return res;
  cbDmCache.set(key, res);
  if(cbDmCache.size > 60) cbDmCache.delete(cbDmCache.keys().next().value);
  return res;
}
async function cbDatamuseRaw(base, book, w, signal){
  const q = encodeURIComponent(base);
  const [after, before, info, near] = await Promise.all([
    cbDm('sp=*&lc=' + q + '&md=p&max=300', signal), cbDm('sp=*&rc=' + q + '&md=p&max=300', signal), cbDm('sp=' + q + '&md=p&max=1', signal), cbDm('rel_trg=' + q + '&max=150', signal)]);
  /* Từ loại chính: ưu tiên cột từ loại trong sổ, không có thì lấy nhãn đầu tiên của Datamuse */
  const pos = (w && w.pos || '').toLowerCase(), tag0 = ((info[0] && info[0].w === base && info[0].tags) || [])[0] || '';
  const isNoun = pos ? /^n/.test(pos) : tag0 === 'n', isAdj = pos ? /^adj|^a$/.test(pos) : tag0 === 'adj';
  const [adjOf, nounOf] = await Promise.all([isNoun ? cbDm('rel_jjb=' + q + '&max=100', signal) : [], isAdj ? cbDm('rel_jja=' + q + '&max=100', signal) : []]);
  const direct = [], cand = new Set();
  const content = list => list.filter(x => CB_RE.test(x.w) && !CB_FUNC.has(x.w));
  const take = (list, rank, mk, rel) => {
    const c = content(list).slice(0, rank), top = c.length ? c[0].sc || 1 : 1;
    c.forEach(x => {
      const pt = book.get(x.w); if(!pt) return;
      cand.add(pt);
      if(mk && (!rel || x.sc / top >= rel) && cbPlainForm(x.w, pt, x.tags)) direct.push({ ph: mk(x.w), pt });
    });
  };
  take(after, CB_DM_RANK, x => base + ' ' + x, CB_DM_REL);    // take care, make progress
  take(before, CB_DM_RANK, x => x + ' ' + base, CB_DM_REL);   // final decision, climate change
  take(adjOf, CB_JJ_RANK, x => x + ' ' + base, 0);            // important decision (chỉ khi từ gốc là danh từ)
  take(nounOf, CB_JJ_RANK, x => base + ' ' + x, 0);           // strong evidence (chỉ khi từ gốc là tính từ)
  take(near, 150, null, 0);                                   // make … decisions → để AI ghép
  return { direct, cand: [...cand] };
}

/* ── Bước 2: AI trên máy ghép cụm tự nhiên từ danh sách NGẮN (ứng viên Datamuse trước, rồi các từ khác trong sổ) ── */
function cbPool(base, first){
  const own = wordForms(base), seen = new Set(first), out = [...first];
  const list = cbSingles();
  for(const w of [...list.filter(x => x.saved).reverse(), ...list.filter(x => !x.saved).reverse()]){
    if(out.length >= CB_POOL) break;
    const k = cbBase(w);
    if(own.has(k) || wordForms(k).has(base) || seen.has(k)) continue;
    seen.add(k); out.push(k);
  }
  return out.slice(0, CB_POOL);
}
async function cbAi(base, list, signal){
  const ses = await cbSession();
  const kill = () => { try{ ses.destroy(); }catch(e){} };   // huỷ thật phiên đang chạy → mô hình rảnh ngay cho từ khác
  signal.addEventListener('abort', kill);
  try{
    if(signal.aborted) throw new Error('abort');
    const raw = await ses.prompt(`Word: "${base}"\nThe learner's word list: ${list.join('; ')}\n`
      + `Go through the list and find every word that forms a common, natural English collocation or short phrase (2-5 words) `
      + `with "${base}", e.g. "make" + "decision" = "make a decision", "heavy" + "rain" = "heavy rain", "take" + "care" = "take care of". `
      + `Use only "${base}" (any form), the list word (any form), and small words like a, an, the, to, of, in, on, at, for, with, up, `
      + 'out, someone, something. Never add any other word. Skip pairs that are not natural.\n'
      + 'For each: phrase; partner = the list word used, copied exactly.', { responseConstraint: CB_SCHEMA, signal });
    return asArr((aiParseJson(raw) || {}).combos);
  }finally{ signal.removeEventListener('abort', kill); kill(); }
}
async function cbFetch(base, signal, useAi){
  const book = cbBook(base);
  if(!book.size) return [];
  const dm = await cbDatamuse(base, book, cbSingles().find(w => cbBase(w) === base), signal);
  if(signal.aborted) throw new Error('abort');
  const out = [], seen = new Set(), pts = new Set();
  const add = (ph, pt) => {
    const k = ph.toLowerCase();
    if(seen.has(k) || out.length >= CB_MAX) return;
    seen.add(k); pts.add(pt); out.push({ ph, pt, mean: '', ex: '' });
  };
  if(useAi && cbAiOn){                             // có Gemini Nano → cụm tự nhiên hơn (có mạo từ / giới từ) — chỉ cho từ đang hiện
    let ai = [];
    try{ ai = await cbAi(base, cbPool(base, dm.cand), signal); }
    catch(e){ if(signal.aborted) throw e; }
    ai.forEach(x => {
      const ph = cbTxt(x && x.phrase, 60).replace(/[.!?,;:]+$/, '');
      const pt = ph && cbValid(ph, base, book);
      if(pt) add(ph, pt);
    });
  }
  dm.direct.forEach(d => { if(!pts.has(d.pt) && cbValid(d.ph, base, book)) add(d.ph, d.pt); });   // bổ sung từ kho ngữ liệu
  if(signal.aborted) throw new Error('abort');
  return out;                                      // nghĩa tiếng Việt dịch sau, chỉ khi cụm thật sự hiện ra (cbMeanings)
}
/* Dịch nghĩa lúc hiện bảng (không dịch khi quét nền → đỡ hàng nghìn lượt gọi Google Dịch) */
const cbMeanTried = new Set();
async function cbMeanings(b){
  const e = cbStore.map[b];
  const miss = e ? e.list.filter(c => !c.mean && !cbMeanTried.has(c.ph)) : [];
  if(!miss.length) return;
  miss.forEach(c => cbMeanTried.add(c.ph));
  const vi = await tpVi(miss.map(c => c.ph));      // Google Dịch, giống tab Đề tài
  let got = false;
  miss.forEach((c, i) => { if(vi[i]){ c.mean = vi[i]; got = true; } });
  if(!got || cbStore.map[b] !== e) return;
  cbPut(b, e);
  if(cb && cb.base === b){ cb.list = e.list; cbRender(); }
}

/* ── Hàng đợi AI duy nhất ──
   Ưu tiên: (1) từ đang hiện trong Luyện gõ — hỏi ngay lúc từ vừa hiện, nên gõ xong thường đã có sẵn;
   (2) quét trước cả sổ theo thứ tự sắp ra. Từ ưu tiên tới mà AI đang bận quét từ khác → huỷ lượt quét đó
   (làm lại sau). Mỗi lượt tối đa CB_TIMEOUT rồi huỷ thật để không kẹt cả hàng đợi. */
const CB_TIMEOUT = 45000;
let cbJob = null;                                  // {base, ac, want}
const cbTries = new Map();                         // lỗi liên tiếp theo từ; quá 2 lần → bỏ qua trong phiên này
function cbPrefer(base){
  if(!cbNeeds(base)) return;
  cbFailed.delete(base); cbTries.delete(base);
  cbWant = base;
  if(cbWake){ cbWake(); cbWake = null; }
  if(cbJob && cbJob.base !== base) cbJob.ac.abort();   // đang làm từ khác (quét nền / từ đã qua) → nhường, huỷ cả yêu cầu mạng
  cbWork();
}
/* Quét nền chỉ chạy lúc rảnh: trang đang mở, người dùng ngừng gõ / bấm / cuộn ít nhất CB_IDLE ms,
   mỗi từ cách nhau CB_GAP ms và nhờ requestIdleCallback chọn lúc trình duyệt rảnh */
const CB_IDLE = 3000, CB_GAP = 1500;
let cbWake = null;                                 // thời điểm thao tác gần nhất: userIdleFor() trong ui-utils.js
const cbSleep = ms => new Promise(r => setTimeout(r, ms));
async function cbIdle(){
  while(!cbWant){
    if(document.visibilityState === 'visible' && userIdleFor() >= CB_IDLE){
      await new Promise(r => { cbWake = r; window.requestIdleCallback ? requestIdleCallback(r, { timeout: 2000 }) : setTimeout(r, 50); });
      if(cbWant || userIdleFor() >= CB_IDLE) return;
    }else await new Promise(r => { cbWake = r; setTimeout(r, 500); });   // cbPrefer đánh thức ngay
  }
  cbWake = null;
}
function cbNext(){
  if(cbWant){ const b = cbWant; cbWant = null; if(cbNeeds(b)) return { b, want: true }; }
  if(!cbScanOn) return null;
  const order = cbSingles().filter(w => !isLimitedToday(w)).sort((a, b) => priorityScore(b) - priorityScore(a));
  let stale = null;
  for(const w of order){
    const b = cbBase(w);
    if(cbFailed.has(b) || !cbStale(b)) continue;
    if(!cbStore.map[b]) return { b, want: false };   // chưa có gì → làm trước
    stale = stale || b;                            // đã có nhưng sổ đổi → làm sau
  }
  return stale ? { b: stale, want: false } : null;
}
async function cbWork(){
  if(cbRun) return;
  cbRun = true;
  try{
    await cbLoad();
    while(currentUser && cbSupported()){
      if(!cbWant){ await cbIdle(); if(!currentUser) break; }
      const user = currentUser, job = cbNext();
      if(!job) break;
      const { b } = job, n = cbN(), ac = new AbortController();
      cbJob = { base: b, ac, want: job.want };
      const timer = setTimeout(() => { ac.timedOut = true; ac.abort(); }, CB_TIMEOUT);
      let list = null;
      try{ list = await cbFetch(b, ac.signal, job.want); }
      catch(e){ if(!ac.signal.aborted || ac.timedOut) cbBaseP = null; }   // lỗi / treo → lần sau tạo phiên mới
      clearTimeout(timer); cbJob = null;
      if(currentUser !== user || cbStore.user !== user) break;
      if(list){
        cbTries.delete(b);
        const old = cbStore.map[b], ex = new Map(asArr(old && old.list).map(c => [c.ph.toLowerCase(), c]));
        list.forEach(c => { const o = ex.get(c.ph.toLowerCase()); if(o){ c.ex = o.ex || ''; c.mean = c.mean || o.mean || ''; } ex.delete(c.ph.toLowerCase()); });
        ex.forEach(o => { if(o.ex) list.push(o); });   // cụm cũ đã tự đặt câu → giữ lại
        cbPut(b, { n, v: CB_VER, ai: !!(job.want && cbAiOn), at: now(), list });
      }else if(!ac.signal.aborted || ac.timedOut){   // bị nhường chỗ thì không tính là lỗi
        const k = (cbTries.get(b) || 0) + 1; cbTries.set(b, k);
        if(k >= 2) cbFailed.add(b);
      }
      if(cb && cb.base === b && (list || !cbJobPending(b))){ const e = cbStore.map[b]; cb.list = e ? e.list : []; cb.st = 'done'; cbRender(); cbMeanings(b); }
      else if(cb) cbRenderScan();
      if(!cbWant) await cbSleep(CB_GAP);
    }
  }finally{ cbRun = false; cbJob = null; }
}
/* Từ đang chờ trên bảng có còn được hỏi tiếp không (lỗi lần đầu → thử lại ngay một lần) */
function cbJobPending(b){
  if(cbFailed.has(b) || !cbTries.has(b)) return false;
  cbWant = b; return true;
}
/* Bật quét trước cả sổ (Datamuse luôn dùng được; Gemini Nano chỉ dùng khi đã có sẵn trên máy, không tự kéo tải) */
function cbScanStart(){
  if(!currentUser || !cbSupported() || !words || !words.length) return;
  cbAiCheck();
  cbScanOn = true; cbWork();
}
/* Gọi từ startQuiz: từ mới hiện → ẩn bảng của từ trước, và nếu là từ đơn chưa có cụm thì tìm ngay */
async function cbOnWord(w){
  if(cb){ cb = null; cbRender(); }
  if(!w || w.kind !== 'đơn' || !cbSupported() || !currentUser) return;
  const base = cbBase(w);
  if(!CB_RE.test(base)) return;
  await Promise.all([cbLoad(), cbAiCheck()]);
  if(cbNeeds(base) && quiz && quiz.w === w){ cbScanOn = true; cbPrefer(base); }
}

/* ── Gọi từ checkQuiz khi vừa gõ xong (đúng hoặc sai) ── */
async function cbShow(w){
  if(!w || w.kind !== 'đơn' || !cbSupported()) return;
  const base = cbBase(w);
  if(!CB_RE.test(base)) return;
  const user = currentUser;
  await cbLoad();
  if(currentUser !== user || !quiz || quiz.w !== w) return;   // đã sang từ khác trong lúc chờ
  const e = cbStore.map[base];
  cb = { w, base, st: e ? 'done' : 'load', list: e ? e.list : [], edit: -1 };
  cbRender();
  if(e) cbMeanings(base);
  if(cbNeeds(base) && !(cbJob && cbJob.base === base)) cbPrefer(base);   // đang tìm đúng từ này rồi → chỉ chờ
}
function cbHide(){ cb = null; cbRender(); }
function cbProg(msg){ if(cb && cb.st === 'load'){ cb.prog = msg; const el = $('#cbProg'); if(el) el.textContent = msg; } }

/* ── Giao diện ── */
const cbInBook = () => new Map((words || []).map(w => [w.word.trim().toLowerCase(), w]));
function cbScanTxt(){
  const all = cbSingles(); if(!all.length) return '';
  const done = all.filter(w => !cbStale(cbBase(w))).length;
  return done < all.length && cbScanOn ? t('cbScan', done, all.length) : '';
}
function cbRenderScan(){ const el = $('#cbScan'); if(el) el.textContent = cbScanTxt(); }
function cbRender(){
  const box = $('#qCombo');
  if(box.contains(document.activeElement) && document.activeElement.matches('input')){ cbDirty = true; return; }   // đang gõ câu → vẽ sau
  cbDirty = false;
  const show = !!cb && (cb.st === 'load' || cb.list.length > 0);
  box.hidden = !show;
  if(!show){ box.innerHTML = ''; queueInfoLayout(); return; }
  const have = cbInBook();
  const fresh = cb.st === 'done' ? cb.list.filter(c => !have.has(c.ph.toLowerCase())).length : 0;
  const head = `<div class="cb-head">
      <div class="cb-head-t"><b>${t('cbTitle', esc(cb.w.word))}</b><span class="cb-sub">${t('cbSub')}</span></div>
      ${fresh > 1 ? `<button class="btn sm ghost cb-all" data-cb="addAll">${I('plus')}${t('cbSaveAll', fresh)}</button>` : ''}
      <button class="icon-btn cb-x" data-cb="close" title="${esc(t('cbClose'))}" aria-label="${esc(t('cbClose'))}">${I('x')}</button></div>`;
  if(cb.st === 'load'){
    box.innerHTML = `${head}<div class="tk-loading cb-load"><span class="tk-spin"></span><span id="cbProg">${esc(cb.prog || t('cbLoading'))}</span></div>`;
    queueInfoLayout(); return;
  }
  const say = s => tpSay(s).replace('data-tp="say"', 'data-cb="say"');
  box.innerHTML = `${head}
    <ul class="cb-list">${cb.list.map((c, i) => {
      const inB = have.has(c.ph.toLowerCase());
      const ex = c.ex && cb.edit !== i
        ? `<div class="cb-ex"><span class="tp-en">${tpMark(c.ex, [c.ph, cb.w.word])}</span>${say(c.ex)}
             <button class="tp-say" data-cb="edit" data-i="${i}" title="${esc(t('cbExEdit'))}" aria-label="${esc(t('cbExEdit'))}">${I('edit')}</button></div>`
        : `<input class="cb-ex-in" data-i="${i}" maxlength="220" autocomplete="off" spellcheck="true" value="${esc(c.ex || '')}" placeholder="${esc(t('cbExPh'))}">`;
      return `<li class="cb-item ${inB ? 'in-book' : ''}">
        <div class="cb-ph"><span class="tp-en">${tpMark(c.ph, [c.pt])}</span>${say(c.ph)}
          <button class="cb-save" data-cb="add" data-i="${i}" ${inB ? 'disabled' : ''} title="${esc(t(inB ? 'tpSaved' : 'tpSave'))}">${I(inB ? 'check' : 'plus')}<span>${t(inB ? 'tpSaved' : 'tpSave')}</span></button></div>
        <div class="cb-mean">${c.mean ? esc(c.mean) : ''}<span class="cb-from">${esc(cb.w.word)} + ${esc(c.pt)}</span></div>
        ${ex}
      </li>`; }).join('')}</ul>
    <p class="cb-scan" id="cbScan">${cbScanTxt()}</p>`;
  if(cb.edit >= 0){ const inp = box.querySelector(`.cb-ex-in[data-i="${cb.edit}"]`); if(inp){ inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); } }
  queueInfoLayout();
}
/* Lưu câu tự đặt vào kết quả của từ (lần sau hiện lại) + vào cụm trong sổ nếu cụm đó chưa có câu */
function cbSaveEx(i, val){
  if(!cb || !cb.list[i]) return;
  const c = cb.list[i], v = cbTxt(val, 220), old = c.ex || '';
  cb.edit = -1;
  if(v !== old){
    c.ex = v;
    const e = cbStore.map[cb.base];
    if(e) cbPut(cb.base, Object.assign({}, e, { list: cb.list }));
    const bw = cbInBook().get(c.ph.toLowerCase());
    if(bw && v && (!bw.sentence || bw.sentence === old)){ bw.sentence = v; save(); }
    if(v && !findTarget(v, c.ph).length) toast(t('cbExNoPh', c.ph));
  }
}
function cbAdd(list){
  if(!currentUser || !words || !cb) return 0;
  const have = cbInBook(), src = cb.w;
  let n = 0;
  list.forEach(c => {
    const k = c.ph.toLowerCase();
    if(have.has(k)) return;
    const w = makeWord(c.ph, '', c.mean || '', c.ex || '', `${src.word} + ${c.pt}`, 'cụm', false, src.group || '');
    have.set(k, w); words.push(w); n++;
  });
  if(n){ save(); renderStats(); }
  return n;
}
const cbRefocus = () => { const pi = $('#phraseInput'); if(pi && quiz && !quiz.graded) pi.focus(); };   // trả lại con trỏ cho ô gõ
$('#qCombo').addEventListener('click', e => {
  const b = e.target.closest('[data-cb]'); if(!b || !cb) return;
  const act = b.dataset.cb;
  if(act === 'say') speakTTS(b.dataset.say);
  else if(act === 'close') cbHide();
  else if(act === 'edit'){ cb.edit = +b.dataset.i; cbRender(); return; }
  else if(act === 'add' || act === 'addAll'){
    const list = act === 'add' ? [cb.list[+b.dataset.i]].filter(Boolean) : cb.list;
    const n = cbAdd(list);
    toast(n ? (act === 'add' ? t('trAdded', list[0].ph) : t('tpSavedN', n)) : t('tpSavedNone'));
    cbRender();
  }
  b.blur(); cbRefocus();
});
/* Ô câu ví dụ: Enter = lưu, Esc = huỷ, bấm ra ngoài = lưu */
$('#qCombo').addEventListener('keydown', e => {
  const inp = e.target.closest('.cb-ex-in'); if(!inp || e.isComposing) return;
  if(e.key === 'Enter'){ e.preventDefault(); inp.dataset.done = '1'; cbSaveEx(+inp.dataset.i, inp.value); inp.blur(); }
  else if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); inp.dataset.done = '1'; cb.edit = -1; inp.blur(); }
});
$('#qCombo').addEventListener('focusout', e => {
  const inp = e.target.closest('.cb-ex-in'); if(!inp) return;
  if(!inp.dataset.done) cbSaveEx(+inp.dataset.i, inp.value);
  setTimeout(cbRender, 0);                         // sang ô khác trong bảng → cbRender tự hoãn tới khi rời ô
});
