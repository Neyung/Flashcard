/* ═════════════ GỢI Ý THEO ĐỀ TÀI (tab "Đề tài") ═════════════
   Nhập một đề tài → AI trên máy (Gemini Nano, miễn phí, không cần API key) chia đề tài thành
   3–4 ý, gợi ý từ vựng cho từng ý (cấp độ CEFR, cụm kết hợp, mẹo dùng, câu ví dụ) rồi soạn câu
   mẫu cho cả bài. Gemini Nano chỉ viết tiếng Anh → phần tiếng Việt (nghĩa, cách dùng, bản dịch
   câu) dịch qua trFetch (Google Dịch, dự phòng MyMemory).
   Lịch sử: localStorage soTuTopics_<user> + users/<user>/topics, giữ tối đa TP_MAX đề tài.
   Lưu từ: thêm thẳng vào sổ từ vựng hiện có (makeWord), nhóm = tên đề tài. */
const TP_MAX = 30;
const TP_LEN = 1500;                               // đề tài có thể là cả một đoạn văn / đề bài dài
const TP_POOL = 360, TP_CHUNK = 120;               // số từ trong sổ đưa cho AI chọn (ưu tiên từ có sao, rồi từ mới thêm)
const TP_ROLES = ['opening', 'idea', 'example', 'opinion', 'closing'];
const TP_POS = ['n', 'v', 'adj', 'adv', 'phrase'];
const tpKey = () => 'soTuTopics_' + currentUser;
let tp = { user: null, list: [], upd: 0, cur: null, run: null, prog: '', loading: false };
let tpSaveT = null;

/* ── Lưu trữ ── */
function tpNorm(e){
  e.ideas = asArr(e.ideas).filter(d => d && d.idea).map(d => Object.assign(d, { words: asArr(d.words).filter(w => w && w.w) }));
  e.sents = asArr(e.sents).filter(s => s && s.s);
  if(e.st === 'run') e.st = 'part';                 // đang chạy thì tải lại trang → coi như dang dở
  return e;
}
async function tpLoad(){
  const user = currentUser;
  tp = { user, list: [], upd: 0, cur: null, run: null, prog: '', loading: true };
  let local = null, remote = null;
  try{ local = JSON.parse(localStorage.getItem(tpKey()) || 'null'); }catch(e){}
  if(cloudOn()) try{ remote = await cloudGet('users/' + user + '/topics'); }catch(e){}
  if(currentUser !== user || tp.user !== user) return;
  const ts = d => (d && d.upd) || 0;
  const pick = remote && local ? (ts(remote) > ts(local) ? remote : local) : (remote || local);
  tp.list = asArr(pick && pick.list).filter(e => e && e.id && e.topic).map(tpNorm).slice(0, TP_MAX);
  tp.upd = ts(pick); tp.loading = false;
}
function tpSave(immediate){
  if(!currentUser || tp.user !== currentUser || tp.loading) return;
  tp.upd = now();
  const snap = JSON.stringify({ upd: tp.upd, list: tp.list.slice(0, TP_MAX) });
  try{ localStorage.setItem(tpKey(), snap); }catch(e){}
  clearTimeout(tpSaveT); tpSaveT = null;
  if(!cloudOn()) return;
  const user = currentUser, put = () => { tpSaveT = null; cloudPut('users/' + user + '/topics', JSON.parse(snap)).catch(() => {}); };
  if(immediate) put(); else tpSaveT = setTimeout(put, 1500);
}
window.addEventListener('pagehide', () => { if(tpSaveT) tpSave(true); });

/* ── AI (Gemini Nano) ── */
const TP_SYS = 'You help Vietnamese learners of English prepare to write or talk about a topic. Use simple, natural, common '
  + 'English. Never invent facts, names or numbers. Reply with JSON only.';
const TP_LV = { type: 'string', enum: CEFR };
const TP_PLAN = { type: 'object', required: ['title', 'ideas'], properties: { title: { type: 'string' },
  ideas: { type: 'array', minItems: 3, maxItems: 4, items: { type: 'string' } } } };
const TP_WORDS = { type: 'object', required: ['words'], properties: { words: { type: 'array', minItems: 4, maxItems: 6, items: {
  type: 'object', required: ['word', 'pos', 'level', 'collocation', 'usage', 'example', 'exampleLevel'], properties: {
    word: { type: 'string' }, pos: { type: 'string', enum: TP_POS }, level: TP_LV, collocation: { type: 'string' },
    usage: { type: 'string' }, example: { type: 'string' }, exampleLevel: TP_LV } } } } };
const TP_PICK = { type: 'object', required: ['words'], properties: { words: { type: 'array', maxItems: 20, items: { type: 'string' } } } };
const TP_SENTS = { type: 'object', required: ['sentences'], properties: { sentences: { type: 'array', minItems: 5, maxItems: 7, items: {
  type: 'object', required: ['role', 'sentence', 'level'], properties: {
    role: { type: 'string', enum: TP_ROLES }, sentence: { type: 'string' }, level: TP_LV } } } } };
/* Phiên gốc (đã nạp lời dặn) giữ lại; mỗi câu hỏi chỉ clone → không phải khởi động lại mô hình */
let tpBaseP = null;
async function tpSession(){
  if(!tpBaseP){
    tpBaseP = LanguageModel.create({ ...AI_LANG, initialPrompts: [{ role: 'system', content: TP_SYS }],
      monitor: m => m.addEventListener('downloadprogress', e => tpProg(t('tpDl', Math.round(e.loaded * 100)))) });
    tpBaseP.catch(() => { tpBaseP = null; });
  }
  const b = await tpBaseP;
  if(b.clone) return await b.clone();
  tpBaseP = null; return b;
}
async function tpAsk(q, schema){
  const ses = await tpSession();
  try{
    const raw = await Promise.race([ses.prompt(q, { responseConstraint: schema }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 180000))]);
    return aiParseJson(raw);
  }finally{ try{ ses.destroy(); }catch(e){} }
}
const tpTxt = (s, max) => String(s || '').replace(/[*`#_]+/g, '').replace(/\s+/g, ' ').trim().slice(0, max || 240);
const tpLv = v => CEFR.includes(v) ? v : '';

/* Dịch nhiều dòng trong 1 lần gọi (Google giữ nguyên xuống dòng); lệch số dòng → dịch từng dòng */
async function tpVi(lines){
  const src = lines.map(s => tpTxt(s, 400)), out = src.map(() => '');
  const idx = src.map((s, i) => s ? i : -1).filter(i => i >= 0);
  if(!idx.length) return out;
  try{
    const parts = (await trFetch(idx.map(i => src[i]).join('\n'), 'en', 'vi')).text.split('\n').map(s => s.trim());
    if(parts.length === idx.length && parts.every(Boolean)){ idx.forEach((i, k) => { out[i] = parts[k]; }); return out; }
  }catch(e){}
  for(const i of idx){ try{ out[i] = (await trFetch(src[i], 'en', 'vi')).text; }catch(e){} }
  return out;
}

/* ── Từ trong sổ: AI chọn những từ hợp với đề tài, các ý dùng chúng trước rồi mới thêm từ mới ── */
function tpBookPool(){
  const list = (words || []).filter(w => w.word && w.word.trim() && w.word.trim().length <= 40);
  const ord = [...list.filter(w => w.saved).reverse(), ...list.filter(w => !w.saved).reverse()];
  const seen = new Set(), out = [];
  for(const w of ord){
    const k = w.word.trim().toLowerCase();
    if(!seen.has(k)){ seen.add(k); out.push(w.word.trim()); }
    if(out.length >= TP_POOL) break;
  }
  return out;
}
async function tpPickBook(e, alive){
  const pool = tpBookPool();
  if(!pool.length) return [];
  const byKey = new Map(pool.map(w => [w.toLowerCase(), w])), picks = new Set();
  for(let i = 0; i < pool.length && picks.size < 24; i += TP_CHUNK){
    try{
      const r = await tpAsk(`Topic: "${e.title}"\nIdeas: ${e.ideas.map(d => d.idea).join('; ')}\n`
        + `Learner's word list: ${pool.slice(i, i + TP_CHUNK).join('; ')}\n`
        + 'Pick the words from this list that are really useful for writing or talking about this topic. Copy them exactly. '
        + 'Pick none if none fit.', TP_PICK);
      asArr(r && r.words).forEach(x => { const w = byKey.get(tpTxt(x, 60).toLowerCase()); if(w) picks.add(w); });
    }catch(err){}
    if(!alive()) return [];
  }
  return [...picks].slice(0, 24);
}

/* ── Chạy phân tích: từng bước lưu + vẽ lại để người dùng thấy kết quả dần dần ── */
function tpProg(msg){
  tp.prog = msg;
  const el = $('#tpProg'); if(el) el.textContent = msg;
}
async function tpGenerate(topic){
  topic = tpTxt(topic, TP_LEN);
  if(!topic || !currentUser || tp.user !== currentUser) return;
  if(tp.run){ toast(t('tpBusy')); return; }
  const st = await aiStatus();
  if(!st || st.kind !== 'lm'){ toast(t('tpNoAi')); return; }
  const user = currentUser;
  const e = { id: 'tp' + uid().slice(1), at: now(), topic, topicEn: '', title: '', titleVi: '', ideas: [], sents: [], st: 'run' };
  tp.list.unshift(e); tp.list.length = Math.min(tp.list.length, TP_MAX); tp.cur = e.id;
  const alive = () => currentUser === user && tp.user === user && tp.list.includes(e);
  const step = () => { if(!alive()) throw new Error('gone'); tpSave(); tpRenderRes(); tpRenderHist(); };
  tp.run = true; tp.prog = t('tpStepRead'); tpRenderRes(); tpRenderHist();
  tp.run = (async () => {
    e.topicEn = VI_RE.test(topic) ? await trFetch(topic, 'vi', 'en').then(r => tpTxt(r.text, TP_LEN) || topic, () => topic) : topic;
    if(!alive()) return;
    tpProg(t('tpStepPlan'));
    const plan = await tpAsk(`Topic: "${e.topicEn}"\nThe topic may be a short title, a question or task, or a whole paragraph `
      + '(then take the ideas from that paragraph). Give a short English title for it (max 8 words) and 3 or 4 main ideas '
      + 'a learner could develop about it (each 2-6 words, clearly different from each other).', TP_PLAN);
    const ideas = asArr(plan && plan.ideas).map(x => tpTxt(x, 80)).filter(Boolean).slice(0, 4);
    if(!ideas.length) throw new Error('plan');
    e.title = tpTxt(plan.title, 90) || e.topicEn;
    e.ideas = ideas.map(idea => ({ idea, ideaVi: '', words: [] }));
    const head = await tpVi([e.title, ...ideas]);
    e.titleVi = head[0]; e.ideas.forEach((d, i) => { d.ideaVi = head[i + 1]; });
    step();
    tpProg(t('tpStepBook'));
    const book = await tpPickBook(e, alive);
    if(!alive()) return;
    const have = tpInBook();
    const used = new Set();
    let fails = 0;
    for(let i = 0; i < e.ideas.length; i++){
      const d = e.ideas[i];
      tpProg(t('tpStepWords', i + 1, e.ideas.length, d.idea));
      let res = null;
      try{
        res = await tpAsk(`Topic: "${e.title}"\nIdea: "${d.idea}"\nSuggest 5 useful English words or short phrases for writing `
          + 'about this idea, from easy to advanced (A2 to C1).'
          + (book.some(w => !used.has(w.toLowerCase())) ? `\nThe learner already studies these words: ${book.filter(w => !used.has(w.toLowerCase())).join('; ')}. `
            + 'First choose the ones that fit THIS idea (copy them exactly), then add new words only to reach 5.' : '')
          + (used.size ? `\nDo not use these again: ${[...used].slice(-20).join(', ')}.` : '')
          + '\nFor each: word = base form; pos = n, v, adj, adv or phrase; level = its CEFR level; collocation = a common '
          + '2-4 word combination with it; usage = one sentence telling the learner how to use this word to '
          + 'make a point about this idea (which point it helps express and a typical pattern), max 22 words; example = one natural sentence about the topic using it, max 20 words; exampleLevel = CEFR level of that sentence.',
          TP_WORDS);
      }catch(err){ if(!alive()) return; }
      const ws = [];
      asArr(res && res.words).forEach(x => {
        const w = tpTxt(x && x.word, 50).replace(/[.!?,;:]+$/, '');
        const k = w.toLowerCase();
        if(!w || used.has(k) || w.split(' ').length > 6) return;
        used.add(k);
        ws.push({ w, pos: TP_POS.includes(x.pos) ? x.pos : '', lv: tpLv(x.level), col: tpTxt(x.collocation, 80),
          use: tpTxt(x.usage, 200), ex: tpTxt(x.example, 220), exLv: tpLv(x.exampleLevel), mean: '', useVi: '' });
      });
      if(!ws.length){ fails++; continue; }
      const rank = w => (have.has(w.w.toLowerCase()) ? 0 : 10) + (CEFR.indexOf(w.lv) + 9) % 9;   // từ trong sổ lên trước
      ws.sort((a, b) => rank(a) - rank(b));
      d.words = ws; step();
      tpProg(t('tpStepVi'));
      const vi = await tpVi([...ws.map(w => w.w), ...ws.map(w => w.use)]);       // nghĩa chỉ dùng khi lưu vào sổ
      ws.forEach((w, j) => { w.mean = vi[j]; w.useVi = vi[ws.length + j]; });
      step();
    }
    tpProg(t('tpStepSents'));
    let sr = null;
    try{
      sr = await tpAsk(`Topic: "${e.title}"\nIdeas: ${e.ideas.map(d => d.idea).join('; ')}\nUseful words: ${[...used].slice(0, 18).join(', ')}\n`
        + 'Write 6 model sentences a learner can use to build a short essay or talk on this topic: 1 opening sentence, then '
        + 'sentences that develop the ideas (include one example and one opinion), and 1 closing sentence. Use some of the useful '
        + 'words. Keep each sentence under 25 words. level = CEFR level of each sentence.', TP_SENTS);
    }catch(err){ if(!alive()) return; }
    const ss = asArr(sr && sr.sentences).map(x => ({ s: tpTxt(x && x.sentence, 260), lv: tpLv(x && x.level),
      role: TP_ROLES.includes(x && x.role) ? x.role : 'idea' })).filter(x => x.s);
    if(ss.length) e.sents = ss;
    e.st = fails || !ss.length || !e.ideas.some(d => d.words.length) ? 'part' : 'done';
  })().catch(err => {
    if(!alive()) return;
    if(!e.ideas.length){                              // chưa có gì để giữ → bỏ khỏi lịch sử
      tp.list = tp.list.filter(x => x !== e);
      if(tp.cur === e.id) tp.cur = tp.list[0] ? tp.list[0].id : null;
      toast(t('tpFail'));
    }else e.st = 'part';
  }).finally(() => {
    tp.run = null; tp.prog = '';
    if(currentUser !== user || tp.user !== user) return;
    if(e.st === 'run') e.st = 'part';
    tpSave(true); tpRenderRes(); tpRenderHist(); tpSyncAi();
  });
}

/* ── Lưu từ vào sổ ── */
const tpInBook = () => new Set((words || []).map(w => w.word.trim().toLowerCase()));
function tpAddWords(e, list){
  if(!currentUser || !words) return 0;
  const have = tpInBook();
  const group = e.name ? tpTxt(e.name, 40) : e.topic.length <= 40 ? e.topic : tpTxt(e.titleVi || e.title, 40);
  let n = 0;
  list.forEach(x => {
    const k = x.w.trim().toLowerCase();
    if(have.has(k)) return;
    have.add(k);
    const kind = /\s/.test(x.w) ? 'cụm' : 'đơn';
    const w = makeWord(x.w, x.pos, x.mean || '', x.ex || '', x.useVi || x.use || '', kind, false, group);
    words.push(w); n++;
    if(kind === 'đơn') fetchPhonetics(w);
  });
  if(n){ save(); renderStats(); }
  return n;
}

/* ── Giao diện ── */
const tpCur = () => tp.list.find(e => e.id === tp.cur) || null;
const tpBadge = lv => lv ? `<span class="cefr cefr-${lv}" title="${esc(t('tpLvTip', lv))}">${lv}</span>` : '';
const tpSay = s => `<button class="tp-say" data-tp="say" data-say="${esc(s)}" title="${esc(t('tpSpeak'))}" aria-label="${esc(t('tpSpeak'))}">${I('sound')}</button>`;
/* Tô đậm các từ được gợi ý xuất hiện trong câu (kể cả dạng chia) */
function tpMark(text, list){
  const hits = [];
  list.forEach(w => findTarget(text, w).forEach(m => hits.push([m.index, m.index + m[0].length])));
  hits.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  let out = '', pos = 0;
  hits.forEach(([s, e]) => { if(s < pos) return; out += esc(text.slice(pos, s)) + '<b>' + esc(text.slice(s, e)) + '</b>'; pos = e; });
  return out + esc(text.slice(pos));
}
const tpDate = at => new Date(at).toLocaleString(LANG === 'vi' ? 'vi-VN' : 'en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const tpWordN = e => e.ideas.reduce((n, d) => n + d.words.length, 0);

function renderTopic(full){
  const area = $('#topicArea');
  if(!area || !currentUser) return;
  if(tp.user !== currentUser){
    area.innerHTML = `<div class="tk-loading" style="padding:30px"><span class="tk-spin"></span>${t('tpLoading')}</div>`;
    tpLoad().then(() => { if(tp.user === currentUser) renderTopic(true); });
    return;
  }
  if(tp.loading) return;
  if(!tp.cur && tp.list.length) tp.cur = tp.list[0].id;
  if(full || !$('#tpForm')){
    const keep = $('#tpIn') ? $('#tpIn').value : '';
    area.innerHTML = `<div class="panel tp-ask">
        <div class="panel-title"><span class="dot" style="background:var(--lemon)"></span><span>${t('tpTitle')}</span>${tkInfo([t('tpInfo'), t('tpInfo2')])}</div>
        <form class="tp-form" id="tpForm" autocomplete="off">
          <textarea id="tpIn" rows="2" maxlength="${TP_LEN}" placeholder="${esc(t('tpPh'))}">${esc(keep)}</textarea>
          <button class="btn primary" type="submit" id="tpGo">${I('spark')}<span>${t('tpGo')}</span></button>
        </form>
        <div class="tp-eg"><span>${t('tpEgLbl')}</span>${t('tpEgs').split('|').map(x => `<button type="button" class="tp-chip" data-tp="eg">${esc(x)}</button>`).join('')}</div>
        <div class="tp-note" id="tpAiNote" hidden></div>
      </div>
      <div class="tp-cols"><div class="tp-main" id="tpRes"></div><aside class="panel tp-hist" id="tpHist"></aside></div>`;
    tpSyncAi(); tpGrow();
  }
  tpRenderRes(); tpRenderHist();
}
function tpGrow(){                                  // ô nhập tự cao theo nội dung (tối đa ~8 dòng rồi cuộn)
  const ta = $('#tpIn'); if(!ta) return;
  ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight + 4, 220) + 'px';
}
async function tpSyncAi(){
  const st = await aiStatus();
  const note = $('#tpAiNote'), go = $('#tpGo');
  if(!note || !go) return;
  const msg = !st || st.kind !== 'lm' ? t('tpNoAi') : st.avail !== 'available' ? t('tpNeedDl') : '';
  note.hidden = !msg; note.textContent = msg;
  note.classList.toggle('warn', !st || st.kind !== 'lm');
  go.disabled = !st || st.kind !== 'lm' || !!tp.run;
}
function tpRenderRes(){
  const box = $('#tpRes'); if(!box) return;
  const e = tpCur();
  const go = $('#tpGo'); if(go && tp.run) go.disabled = true;
  if(!e){ box.innerHTML = `<div class="panel tp-empty">${I('bulb')}<p>${t('tpEmpty')}</p></div>`; return; }
  const running = tp.run && e.st === 'run';
  const have = tpInBook();
  const all = e.ideas.flatMap(d => d.words.map(w => w.w));
  const noVi = !running && e.ideas.some(d => d.words.some(w => w.use && !w.useVi));
  const nBook = all.filter(w => have.has(w.toLowerCase())).length;
  const ideas = e.ideas.map((d, i) => `<section class="tp-idea">
      <div class="tp-idea-h"><span class="tp-n">${i + 1}</span><div><b>${esc(d.ideaVi || d.idea)}</b></div>
        ${d.words.length && d.words.some(w => !have.has(w.w.toLowerCase())) ? `<button class="btn sm ghost" data-tp="addAll" data-i="${i}">${I('plus')}${t('tpSaveAll')}</button>` : ''}</div>
      ${d.words.length ? `<div class="tp-words">${d.words.map((w, j) => {
        const inB = have.has(w.w.toLowerCase());
        return `<article class="tp-w">
          <div class="tp-w-top">${tpBadge(w.lv)}<b class="tp-word">${esc(w.w)}</b>${w.pos ? `<span class="tp-pos">${esc(w.pos)}</span>` : ''}${tpSay(w.w)}
            <button class="btn sm ${inB ? 'tp-in' : 'mint'}" data-tp="add" data-i="${i}" data-j="${j}" ${inB ? 'disabled' : ''}>${I(inB ? 'check' : 'plus')}${t(inB ? 'tpSaved' : 'tpSave')}</button></div>
          <dl class="tp-guide">
            ${w.use ? `<div><dt>${t('tpUse')}</dt><dd>${esc(w.useVi || w.use)}</dd></div>` : ''}
            ${w.col ? `<div><dt>${t('tpCol')}</dt><dd class="tp-en">${tpMark(w.col, [w.w])}</dd></div>` : ''}
            ${w.ex ? `<div><dt>${t('tpEx')}</dt><dd><div class="tp-line">${tpBadge(w.exLv)}<span class="tp-en">${tpMark(w.ex, [w.w])}</span>${tpSay(w.ex)}</div></dd></div>` : ''}
          </dl></article>`;
      }).join('')}</div>` : running ? '' : `<p class="tp-miss">${t('tpIdeaMiss')}</p>`}
    </section>`).join('');
  box.innerHTML = `<div class="panel tp-res">
      <div class="tp-head">
        <div class="tp-head-t"><h2>${esc(e.name || e.titleVi || e.title || e.topic)}</h2>
          <div class="tp-meta">${tpDate(e.at)}</div></div>
        ${e.sents.length ? `<button class="btn sm" data-tp="copy">${I('copy')}${t('tpCopy')}</button>` : ''}
      </div>
      <p class="tp-q" data-tp="q" title="${esc(t('tpQTip'))}"><span><b>${t('tpAsked')}:</b> ${esc(e.topic)}</span></p>
      ${running ? `<div class="tk-loading tp-prog"><span class="tk-spin"></span><span id="tpProg">${esc(tp.prog)}</span></div>` : ''}
      ${e.st === 'part' && !running ? `<p class="tp-warn">${t('tpPart')}</p>` : ''}
      ${noVi ? `<p class="tp-warn">${t('tpViFail')}</p>` : ''}
      ${e.ideas.length ? `<h3 class="tp-h"><span class="dot" style="background:var(--mint)"></span>${t('tpWordsH')}</h3>
        ${all.length ? `<p class="tp-book">${t('tpBookN', nBook, all.length - nBook)}</p>` : ''}${ideas}` : ''}
      ${e.sents.length ? `<h3 class="tp-h"><span class="dot" style="background:var(--sky)"></span>${t('tpSentsH')}</h3>
        <ol class="tp-sents">${e.sents.map(s => `<li>
          <div class="tp-s-tags">${tpBadge(s.lv)}<span class="tp-role tp-role-${s.role}">${t('tpRole_' + s.role)}</span></div>
          <div class="tp-s-body"><div class="tp-line"><span class="tp-en">${tpMark(s.s, all)}</span>${tpSay(s.s)}</div></div></li>`).join('')}</ol>` : ''}
    </div>`;
}
function tpRenderHist(){
  const box = $('#tpHist'); if(!box) return;
  box.innerHTML = `<div class="panel-title"><span class="dot" style="background:var(--lav)"></span><span>${t('tpHist')}</span>
      ${tp.list.length ? `<span class="tp-cnt">${tp.list.length}</span>` : ''}</div>`
    + (tp.list.length ? `<ul class="tp-hl">${tp.list.map(e => `<li class="${e.id === tp.cur ? 'on' : ''}">
        <button class="tp-hi" data-tp="open" data-id="${e.id}"><b>${esc(e.name || e.topic)}</b>
          <small>${tpDate(e.at)} · ${e.st === 'run' && tp.run ? t('tpRunning') : t('tpWordsN', tpWordN(e))}${e.st === 'part' ? ' · ' + t('tpPartShort') : ''}</small></button>
        <button class="icon-btn tp-del" data-tp="ren" data-id="${e.id}" title="${esc(t('tpRen'))}" aria-label="${esc(t('tpRen'))}">${I('edit')}</button>
        <button class="icon-btn tp-del" data-tp="del" data-id="${e.id}" title="${esc(t('tpDel'))}" aria-label="${esc(t('tpDel'))}">${I('trash')}</button>
      </li>`).join('')}</ul>` : `<p class="tp-hempty">${t('tpHistEmpty')}</p>`);
}

/* ── Sự kiện ── */
$('#topicArea').addEventListener('submit', ev => {
  if(ev.target.id !== 'tpForm') return;
  ev.preventDefault();
  const v = $('#tpIn').value;
  if(!tpTxt(v)){ $('#tpIn').focus(); return; }
  $('#tpIn').blur();
  tpGenerate(v);
});
/* Đổi tên đề tài ngay trong lịch sử: Enter / bấm ra ngoài = lưu, Esc = huỷ, để trống = về tên gốc */
function tpRename(id){
  const e = tp.list.find(x => x.id === id), li = $(`#tpHist [data-tp="open"][data-id="${id}"]`);
  if(!e || !li) return;
  const inp = document.createElement('input');
  inp.className = 'tp-ren'; inp.maxLength = 80; inp.value = e.name || e.topic.slice(0, 80);
  inp.setAttribute('aria-label', t('tpRen'));
  li.replaceWith(inp); inp.focus(); inp.select();
  let done = false;
  const finish = ok => {
    if(done) return; done = true;
    if(ok){
      const v = tpTxt(inp.value, 80);
      const name = v && v !== e.topic ? v : '';
      if(name !== (e.name || '')){ if(name) e.name = name; else delete e.name; tpSave(true); if(tp.cur === id) tpRenderRes(); }
    }
    tpRenderHist();
  };
  inp.addEventListener('keydown', ev => {
    if(ev.key === 'Enter' && !ev.isComposing){ ev.preventDefault(); finish(true); }
    else if(ev.key === 'Escape'){ ev.preventDefault(); ev.stopPropagation(); finish(false); }
  });
  inp.addEventListener('blur', () => finish(true));
}
$('#topicArea').addEventListener('keydown', ev => {
  if(ev.target.id === 'tpIn' && ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing){ ev.preventDefault(); $('#tpForm').requestSubmit(); }
});
$('#topicArea').addEventListener('input', ev => { if(ev.target.id === 'tpIn') tpGrow(); });
window.addEventListener('resize', () => { if($('#tab-topic').classList.contains('active')) tpGrow(); });
$('#topicArea').addEventListener('click', ev => {
  const b = ev.target.closest('[data-tp]'); if(!b) return;
  const act = b.dataset.tp, e = tpCur();
  if(act === 'eg'){ $('#tpIn').value = b.textContent; tpGrow(); $('#tpIn').focus(); return; }
  if(act === 'q'){ b.classList.toggle('open'); return; }
  if(act === 'say'){ speakTTS(b.dataset.say); return; }
  if(act === 'open'){ tp.cur = b.dataset.id; tpRenderRes(); tpRenderHist(); $('#tpRes').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  if(act === 'ren'){ tpRename(b.dataset.id); return; }
  if(act === 'del'){
    if(!confirm(t('tpDelConfirm'))) return;
    tp.list = tp.list.filter(x => x.id !== b.dataset.id);
    if(tp.cur === b.dataset.id) tp.cur = tp.list[0] ? tp.list[0].id : null;
    tpSave(true); tpRenderRes(); tpRenderHist();
    return;
  }
  if(!e) return;
  if(act === 'add' || act === 'addAll'){
    const d = e.ideas[+b.dataset.i]; if(!d) return;
    const list = act === 'add' ? [d.words[+b.dataset.j]].filter(Boolean) : d.words;
    const n = tpAddWords(e, list);
    toast(n ? (act === 'add' ? t('trAdded', list[0].w) : t('tpSavedN', n)) : t('tpSavedNone'));
    tpRenderRes();
    return;
  }
  if(act === 'copy'){
    navigator.clipboard.writeText(e.sents.map(s => s.s).join(' ')).then(() => toast(t('tpCopied')), () => {});
  }
});
