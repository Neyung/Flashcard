/* ═══ Độ khó CEFR cho toàn bộ từ vựng ═══
   AI trên máy (Gemini Nano) phân loại theo NGHĨA người dùng đã lưu. Mỗi từ chỉ phân loại 1 lần
   (lưu w.cefr = { lv, conf, src, at } trong dữ liệu từ, đồng bộ cùng sổ) → không gọi lại mỗi lần
   mở app; bị gián đoạn thì lần sau tiếp tục từ những từ còn thiếu. Độ tin cậy < 0.5 → lv = ''
   + chk = 1 (cần xác minh) thay vì bịa ra một cấp độ chắc chắn. Không có AI → giữ nguyên dữ liệu. */
const CEFR_SYS = 'You are an expert on CEFR vocabulary levels as used in the English Vocabulary Profile and the Oxford 3000/5000. '
  + 'For each numbered English word or phrase you get the meaning (in Vietnamese) that the learner saved. Give the CEFR level '
  + '(A1, A2, B1, B2, C1 or C2) of THAT meaning and usage, judged by how common and essential it is for learners. Do not choose '
  + 'C1/C2 just because a word is long, rare-looking or academic. If you are not sure, give a confidence below 0.5 or level '
  + '"unknown". Reply with JSON only.';
const CEFR_SCHEMA = { type: 'object', required: ['items'], properties: { items: { type: 'array', items: { type: 'object',
  required: ['n', 'level', 'confidence'], properties: { n: { type: 'integer' }, level: { type: 'string', enum: [...CEFR, 'unknown'] },
  confidence: { type: 'number' } } } } } };
let cefrRun = null;
const cefrFailed = new Set();
const cefrTodo = () => words.filter(w => w.word && w.word.trim() && !w.cefr && !cefrFailed.has(w.id));
function cefrBadge(w){
  if(!w.cefr) return '';
  if(!w.cefr.lv) return `<span class="cefr cefr-q" title="${esc(t('cefrVerify'))}">?</span>`;
  return `<span class="cefr cefr-${w.cefr.lv}" title="${esc(t('cefrTip', w.cefr.lv, Math.round((w.cefr.conf || 0) * 100)))}">${w.cefr.lv}</span>`;
}
function cefrBtnSync(){
  const el = $('#cefrBtnTxt'); if(!el || !words) return;
  const done = words.filter(w => w.cefr).length;
  el.textContent = cefrRun ? t('cefrRun', done, words.length) : done >= words.length ? t('cefrAll', done) : t('cefrRun', done, words.length);
}
async function cefrInit(){
  const st = await aiStatus();
  const b = $('#btnCefr');
  if(b) b.hidden = !(st && st.kind === 'lm');
  cefrBtnSync();
  cefrClassify(false);
}
function cefrClassify(interactive){
  if(cefrRun) return cefrRun;
  if(!words || !cefrTodo().length){ if(interactive) toast(t('cefrDone', words ? words.filter(w => w.cefr && !w.cefr.lv).length : 0)); return Promise.resolve(); }
  cefrRun = (async () => {
    const st = await aiStatus();
    if(!st || st.kind !== 'lm'){ if(interactive) toast(t('cefrNoAi')); return; }
    if(st.avail !== 'available' && !interactive) return;                 // cần tải mô hình → chỉ khi người dùng bấm nút
    const user = currentUser;
    cefrBtnSync();
    for(;;){
      if(currentUser !== user) return;
      const batch = cefrTodo().slice(0, 10);
      if(!batch.length) break;
      const q = batch.map((w, i) => `${i + 1}. ${w.word.trim()}${w.pos ? ` (${w.pos})` : ''} — ${w.meaning || '?'}`
        + (w.sentence ? ` — e.g. "${w.sentence.slice(0, 160)}"` : '')).join('\n');
      let raw = '';
      try{
        const ses = await LanguageModel.create({ ...AI_LANG, initialPrompts: [{ role: 'system', content: CEFR_SYS }] });
        try{ raw = await ses.prompt(q, { responseConstraint: CEFR_SCHEMA }); } finally{ try{ ses.destroy(); }catch(e){} }
      }catch(e){ batch.forEach(w => cefrFailed.add(w.id)); continue; }      // lỗi → bỏ qua trong phiên này, lần sau thử lại
      const items = asArr((aiParseJson(raw) || {}).items);
      batch.forEach((w, i) => {
        const it = items.find(x => x && x.n === i + 1);
        if(!it){ cefrFailed.add(w.id); return; }
        const lv = CEFR.includes(it.level) ? it.level : '', conf = Math.max(0, Math.min(1, +it.confidence || 0));
        w.cefr = lv && conf >= .5 ? { lv, conf: +conf.toFixed(2), src: 'gemini-nano', at: now() }
                                  : { lv: '', guess: lv, conf: +conf.toFixed(2), src: 'gemini-nano', at: now(), chk: 1 };
      });
      save(); cefrBtnSync();
      if($('#tab-notes') && $('#tab-notes').classList.contains('active') && editingId == null) renderTable();
    }
    if(interactive) toast(t('cefrDone', words.filter(w => w.cefr && !w.cefr.lv).length));
  })().catch(() => {}).finally(() => { cefrRun = null; cefrBtnSync(); });
  return cefrRun;
}
$('#btnCefr').addEventListener('click', () => { cefrFailed.clear(); cefrClassify(true); });
