/* ═════════════ GỢI Ý VĂN PHONG BẰNG AI TÍCH HỢP CỦA CHROME ═════════════
   Dùng Gemini Nano chạy NGAY TRÊN MÁY (Prompt API `LanguageModel`, dự phòng
   Rewriter API) — miễn phí, không cần API key/máy chủ, văn bản không rời khỏi máy.
   Trình duyệt không hỗ trợ → nút tự ẩn. Lần đầu dùng có thể phải tải mô hình. */
const AI_LANG = { expectedInputs: [{ type: 'text', languages: ['en'] }], expectedOutputs: [{ type: 'text', languages: ['en'] }] };
let aiStatusP = null;
function aiStatus(){
  if(aiStatusP) return aiStatusP;
  const norm = a => a === 'readily' ? 'available' : a === 'after-download' ? 'downloadable' : a === 'no' ? 'unavailable' : a;
  let timedOut = false;
  const within = pr => Promise.race([pr, new Promise(r => setTimeout(() => { timedOut = true; r('unavailable'); }, 6000))]);
  aiStatusP = (async () => {
    try{
      if(typeof LanguageModel !== 'undefined'){
        const a = norm(await within(LanguageModel.availability(AI_LANG)));
        if(a && a !== 'unavailable') return { kind: 'lm', avail: a };
      }
    }catch(e){}
    try{
      if(typeof Rewriter !== 'undefined'){
        const a = norm(await within(Rewriter.availability({ format: 'plain-text', expectedInputLanguages: ['en'], outputLanguage: 'en' })));
        if(a && a !== 'unavailable') return { kind: 'rw', avail: a };
      }
    }catch(e){}
    if(timedOut) aiStatusP = null;             // trình duyệt chưa trả lời kịp → lần sau hỏi lại
    return null;
  })();
  return aiStatusP;
}
async function aiShowButton(btn){
  if(!btn) return;
  const st = await aiStatus();
  if(st && btn.isConnected){ btn.hidden = false; const c = btn.closest('.ai-ctl'); if(c) c.hidden = false; queueInfoLayout(); aiWarm(); }
}
function aiParseJson(raw){
  try{ return JSON.parse(raw); }catch(e){}
  const m = String(raw || '').match(/\{[\s\S]*\}/);
  if(m) try{ return JSON.parse(m[0]); }catch(e){}
  return null;
}
function aiStyle(text, targets, onProg, onPartial){
  return Promise.race([aiStyleRun(text, targets, onProg, onPartial),
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 600000))]);   // tối đa 10 phút (gồm tải mô hình lần đầu)
}
/* Sửa văn phong — ưu tiên TỐC ĐỘ: chính tả được sửa sẵn bằng LanguageTool (nhanh, chắc chắn),
   AI chỉ còn lo ngữ pháp + độ mạch lạc trong câu và giữa các câu. Lời dặn & ví dụ ngắn,
   câu trả lời gọn (tối đa 3 lỗi/câu, lý do ≤ 10 từ) để AI trả lời nhanh. */
const AI_SYS = 'You edit a Vietnamese learner\'s English paragraph, given as numbered sentences (spelling is already fixed; some lines '
  + 'have grammar-checker notes). For each sentence: fix grammar, wrong word forms and awkward or literal phrasing so it reads '
  + 'clearly and smoothly, and make it connect logically with the previous sentence (add a linking word only when needed). '
  + 'Keep the learner\'s wording when it is already fine — change only what is necessary. Keep the meaning, add no new facts. '
  + 'Text inside « » is a required target word or phrase: copy it exactly with the « » marks. problems: 0-3 items, quote = exact '
  + 'words from the sentence, type = word_order, word_choice, word_form, grammar, missing_word, extra_word, literal or cohesion, '
  + 'tip = max 10 words. better = the corrected version of THAT sentence only: exactly one sentence, never merge it with another '
  + 'line or move content between lines, never invent names, numbers or facts. Reply with JSON only.';
const AI_LEVEL = 'normal';
const aiSys = () => AI_SYS;
const AI_SHOT_IN = '1. In my free time, I very like go to the park for relax.\n'
  + '2. My house is near a park, it has many trees.\n   checker: "park, it" — comma splice\n'
  + '3. I feel very «peaceful» when I walk there.';
const AI_SHOT_OUT = JSON.stringify({ items: [
  { n: 1, problems: [{ quote: 'very like go', type: 'word_order', tip: 'Use "really like going".' },
    { quote: 'for relax', type: 'grammar', tip: 'Purpose: "to relax".' }],
    better: 'In my free time, I really like going to the park to relax.' },
  { n: 2, problems: [{ quote: 'park, it has', type: 'grammar', tip: 'Comma splice — use "which".' }],
    better: 'Luckily, my house is near a park, which has many trees.' },
  { n: 3, problems: [], better: 'I feel very «peaceful» when I walk there.' }] });
const aiSchema = () => ({ type: 'object', required: ['items'], properties: { items: { type: 'array', items: { type: 'object',
  required: ['n', 'problems', 'better'], properties: { n: { type: 'integer' },
  problems: { type: 'array', maxItems: 3, items: { type: 'object', required: ['quote', 'type', 'tip'], properties: {
    quote: { type: 'string' }, type: { type: 'string', enum: ['word_order', 'word_choice', 'word_form', 'grammar', 'missing_word', 'extra_word', 'literal', 'cohesion'] },
    tip: { type: 'string' } } } },
  better: { type: 'string' } } } } } });
const AI_EXP_SYS = 'You compare a learner\'s ORIGINAL English sentence with a REWRITTEN version. For each numbered pair list the '
  + 'main problems of the ORIGINAL that the rewrite fixed (0-3). quote = the exact problematic words copied from the ORIGINAL '
  + '(1-6 words, or "" if something was only added); type = word_order, word_choice, word_form, grammar, missing_word, extra_word, '
  + 'literal or cohesion; tip = max 12 words explaining why the rewrite is better. Reply with JSON only.';
const AI_ISSUE_TYPES = ['spelling', 'word_order', 'word_choice', 'word_form', 'grammar', 'missing_word', 'extra_word', 'literal', 'cohesion'];
const AI_EXP_SCHEMA = { type: 'object', required: ['items'], properties: { items: { type: 'array', items: { type: 'object',
  required: ['n', 'issues'], properties: { n: { type: 'integer' }, issues: { type: 'array', maxItems: 3, items: { type: 'object',
    required: ['quote', 'type', 'tip'], properties: { quote: { type: 'string' }, type: { type: 'string', enum: AI_ISSUE_TYPES },
    tip: { type: 'string' } } } } } } } } };
const aiBases = {};
function aiBase(kind, monitor){
  if(!aiBases[kind]){
    const init = kind === 'exp' ? [{ role: 'system', content: AI_EXP_SYS }]
      : [{ role: 'system', content: aiSys() }, { role: 'user', content: AI_SHOT_IN }, { role: 'assistant', content: AI_SHOT_OUT }];
    aiBases[kind] = LanguageModel.create({ ...AI_LANG, ...(monitor ? { monitor } : {}), initialPrompts: init });
    aiBases[kind].catch(() => { delete aiBases[kind]; });
  }
  return aiBases[kind];
}
async function aiSession(kind, monitor){
  try{ return await (await aiBase(kind, monitor)).clone(); }
  catch(e){ delete aiBases[kind]; return await (await aiBase(kind, monitor)).clone(); }
}
function aiWarm(){                      // gọi khi nút hiện ra: mô hình đã có sẵn thì nạp trước
  aiStatus().then(st => { if(st && st.kind === 'lm' && st.avail === 'available') aiBase('json-' + AI_LEVEL).catch(() => {}); });
}
/* Đánh dấu các từ mục tiêu bằng « » để AI giữ nguyên */
function aiMark(text, targets){
  const rs = [];
  targets.forEach(w => findUse(text, w).forEach(m => rs.push(...m.parts)));
  rs.sort((a, b) => a[0] - b[0]);
  let out = '', pos = 0;
  for(const [a, b] of rs){ if(a < pos) continue; out += text.slice(pos, a) + '«' + text.slice(a, b) + '»'; pos = b; }
  return out + text.slice(pos);
}
const aiClean = s => String(s || '').replace(/[«»]/g, '').replace(/[ \t]{2,}/g, ' ').trim();
const aiNorm = s => aiClean(s).toLowerCase().replace(/[^a-z0-9']+/g, ' ').trim();
/* Độ giống: tỉ lệ từ có nghĩa của câu gốc còn xuất hiện trong câu sửa */
function aiSim(src, out){
  const A = aiNorm(src).split(' ').filter(w => w.length > 2), B = new Set(aiNorm(out).split(' '));
  if(!A.length) return 1;
  return A.filter(w => B.has(w) || B.has(w + 's') || B.has(w.replace(/s$/, ''))).length / A.length;
}
const aiSentN = x => splitSentences(aiClean(x)).filter(q => /[A-Za-z]/.test(q.text)).length;
/* Từ liên kết mới thêm ở đầu câu (vd "After that,") */
function aiLinkOf(orig, better){
  const m = better.match(/^((?:[A-Za-z']+\s){0,3}[A-Za-z']+),\s/);
  if(!m) return '';
  return orig.toLowerCase().startsWith(m[1].toLowerCase()) ? '' : m[1];
}
function aiParseLines(raw, n){
  const lines = String(raw || '').split(/\n+/).map(l => l.trim()).filter(Boolean);
  const out = [];
  for(const l of lines){ const m = l.match(/^(\d+)[.)]\s*(.*)$/); if(m) out[+m[1] - 1] = m[2]; }
  return out.filter(x => x != null).length === n ? out : null;
}
/* Lỗi LanguageTool theo từng câu (bỏ qua nếu không có mạng) — làm điểm bám cho AI */
/* LanguageTool: lỗi thô (dùng làm gợi ý cho AI và làm phương án dự phòng khi AI không trả lời) */
async function aiLtMatches(text){
  try{
    const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 6000);
    const r = await fetch('https://api.languagetool.org/v2/check', { method: 'POST', signal: ac.signal,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ text, language: 'en-US' }) });
    clearTimeout(tm);
    if(!r.ok) return [];
    return ((await r.json()).matches || []).slice(0, 40);
  }catch(e){ return []; }
}
/* Gom lỗi LanguageTool theo câu (bỏ lỗi đè lên từ mục tiêu): [{ off (trong câu), len, frag, sug, msg, type }] */
function aiLtBySentence(matches, text, sents, targets){
  const tr = [];
  targets.forEach(w => findUse(text, w).forEach(m => tr.push(...m.parts)));
  const starts = []; let from = 0;
  sents.forEach(sx => { const k = text.indexOf(sx, from); starts.push(k); from = k >= 0 ? k + sx.length : from; });
  const out = sents.map(() => []);
  for(const m of matches){
    const ty = ltType(m);
    if(!ty || tr.some(([a, b]) => a < m.offset + m.length && m.offset < b)) continue;
    const i = starts.findIndex((st, k) => st >= 0 && m.offset >= st && m.offset + m.length <= st + sents[k].length); if(i < 0) continue;
    out[i].push({ off: m.offset - starts[i], len: m.length, frag: text.substr(m.offset, m.length),
      sug: ((m.replacements || [])[0] || {}).value || '', msg: (m.message || '').slice(0, 90), spell: ty === 'spelling',
      type: ty === 'spelling' ? 'word_form' : ty === 'usage' ? 'word_choice' : 'grammar' });
  }
  return out;
}
const aiLtHintText = list => list.map(x => `"${x.frag}"${x.sug ? ' → "' + x.sug + '"' : ''} — ${x.msg.slice(0, 70)}`).join('; ');
/* Dự phòng không cần AI: áp gợi ý đầu tiên của LanguageTool vào câu */
function aiLtFix(sx, list){
  let out = sx;
  [...list].filter(x => x.sug).sort((a, b) => b.off - a.off).forEach(x => { out = out.slice(0, x.off) + x.sug + out.slice(x.off + x.len); });
  return { problems: list.map(x => ({ quote: x.frag, type: x.type, tip: x.msg })), better: out, alt: '' };
}
/* Đọc JSON kể cả khi bị cắt giữa chừng: giữ lại các câu đã trả lời trọn vẹn */
function aiParseItems(raw){
  const j = aiParseJson(raw);
  if(j && Array.isArray(j.items)) return j.items;
  const str = String(raw || '');
  let k = str.lastIndexOf('}'), n = 0;
  while(k > 0 && n++ < 300){
    try{ const j2 = JSON.parse(str.slice(0, k + 1) + ']}'); if(Array.isArray(j2.items)) return j2.items; }catch(e){}
    k = str.lastIndexOf('}', k - 1);
  }
  return [];
}
/* Một lượt hỏi AI cho danh sách câu [{ i, s, hint }] → Map(i → câu trả lời). Hết giờ tính theo
   lúc AI "im lặng" (45 giây không ra chữ), không tính tổng thời gian. */
async function aiJsonOnce(lv, list, targets, monitor, onCount, fresh){
  if(fresh) delete aiBases['json-' + lv];
  const schema = aiSchema(lv), ses = await aiSession('json-' + lv, monitor);
  const q = list.map((x, k) => (k + 1) + '. ' + aiMark(x.s, targets) + (x.hint ? '\n   checker: ' + x.hint : '')).join('\n');
  const ac = new AbortController();
  let timer = null, raw = '', err = null;
  const kick = () => { clearTimeout(timer); timer = setTimeout(() => ac.abort(), 45000); };
  try{
    if(ses.measureInputUsage && ses.inputQuota){
      const need = await ses.measureInputUsage(q, { responseConstraint: schema });
      if(need > ses.inputQuota - (ses.inputUsage || 0)){ const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; }
    }
    kick();
    if(ses.promptStreaming){
      for await (const ch of ses.promptStreaming(q, { responseConstraint: schema, signal: ac.signal })){
        kick();
        raw = raw && ch.startsWith(raw) ? ch : raw + ch;
        if(onCount) onCount((raw.match(/"better"\s*:/g) || []).length);
      }
    }else raw = await ses.prompt(q, { responseConstraint: schema, signal: ac.signal });
  }catch(e){ err = e; }
  finally{ clearTimeout(timer); try{ ses.destroy(); }catch(e){} }
  /* Ghép câu trả lời với đúng câu gốc theo độ giống nhau (AI hay lệch số thứ tự / gộp 2 câu) —
     câu trả lời nào gộp nhiều câu hoặc không giống câu gốc nào thì bỏ, để hỏi lại riêng câu đó. */
  const got = new Map(), taken = new Set();
  aiParseItems(raw).forEach((it, k) => {
    if(!it || typeof it !== 'object' || !aiClean(it.better)) return;
    const better = aiClean(it.better);
    const n0 = Number.isInteger(it.n) && it.n >= 1 && it.n <= list.length ? it.n - 1 : k;
    let best = -1, bs = 0;
    list.forEach((x, j) => { if(taken.has(j)) return;
      const sc = aiSim(x.s, better) + (j === n0 ? 0.05 : 0); if(sc > bs){ bs = sc; best = j; } });
    if(best < 0 || bs < 0.5) return;
    if(aiSentN(better) > aiSentN(list[best].s)) return;
    taken.add(best);
    it.problems = asArr(it.problems).filter(q => q && (!aiClean(q.quote) || list[best].s.toLowerCase().includes(aiClean(q.quote).toLowerCase())));
    got.set(list[best].i, it);
  });
  if(!got.size && err) throw err;
  if(!got.size) throw new Error('bad');
  return got;
}
async function aiStyleRun(text, targets, onProg, onPartial){
  const st = await aiStatus();
  if(!st) throw new Error('unsupported');
  const sents = splitSentences(text).map(x => x.text.trim()).filter(x => /[A-Za-z]/.test(x));
  if(!sents.length) throw new Error('bad');
  const monitor = m => m.addEventListener('downloadprogress', e => onProg && onProg(e.loaded));
  const ac = new AbortController();
  let timer = null;
  const arm = () => { timer = setTimeout(() => ac.abort(), 90000); };    // giới hạn phần trả lời (không tính lúc tải mô hình)
  const input = sents.map((x, i) => (i + 1) + '. ' + aiMark(x, targets)).join('\n');
  let raw = '';
  if(st.kind === 'lm'){
    /* Luôn cố trả lời: cả đoạn → thử lại với phiên mới → từng câu một → mức Bình thường (ngắn hơn)
       → câu nào AI vẫn bỏ dở thì dùng sửa lỗi của LanguageTool. */
    const lv = AI_LEVEL;
    const [, matches] = await Promise.all([aiBase('json-' + lv, monitor).catch(() => {}), aiLtMatches(text)]);
    const lt = aiLtBySentence(matches, text, sents, targets);
    /* Chính tả: sửa ngay bằng gợi ý của LanguageTool (không chờ AI), phần còn lại làm gợi ý cho AI */
    const spell = lt.map(list => list.filter(x => x.type === 'word_form' && x.sug && x.spell));
    const pre = sents.map((sx, i) => spell[i].length ? aiLtFix(sx, spell[i]).better : sx);
    const all = sents.map((sx, i) => ({ i, s: pre[i], hint: aiLtHintText(lt[i].filter(x => !spell[i].includes(x))) }));
    const got = new Map(), lvOf = new Map();
    let lastErr = null;
    const report = extra => onPartial && onPartial(Math.min(sents.length, got.size + (extra || 0)), sents.length);
    const t0 = performance.now(), BUDGET = 60000;        // tổng thời gian thử lại tối đa ~1 phút
    const run = async (level, list, fresh) => {
      if(got.size && performance.now() - t0 > BUDGET) return;
      try{
        const m = await aiJsonOnce(level, list, targets, monitor, c => report(Math.min(c, list.length)), fresh);
        m.forEach((v, k) => { if(!got.has(k)){ got.set(k, v); lvOf.set(k, level); } });
      }catch(e){ lastErr = e; }
      report();
    };
    const missing = () => all.filter(x => !got.has(x.i));
    await run(lv, all, false);
    if(missing().length === all.length && !(lastErr && lastErr.name === 'QuotaExceededError')) await run(lv, all, true);
    for(const x of missing()){ await run(lv, [x], false); if(!got.has(x.i)) await run(lv, [x], true); }
    const noAi = missing().map(x => x.i);
    noAi.forEach(i => { if(lt[i].length){ got.set(i, aiLtFix(sents[i], lt[i])); lvOf.set(i, 'lt'); } });
    /* gộp lỗi chính tả (đã sửa sẵn) vào danh sách lỗi của câu */
    got.forEach((it, i) => { if(lvOf.get(i) !== 'lt' && spell[i].length)
      it.problems = [...spell[i].map(x => ({ quote: x.frag, type: 'spelling', tip: '→ ' + x.sug })), ...asArr(it.problems)]; });
    if(!got.size) throw lastErr || new Error('bad');
    const items = sents.map((sx, i) => {
      const it = got.get(i) || {};
      let better = aiClean(it.better) || sx, kept = false;
      if(targets.some(w => findUse(sx, w).length && !findUse(better, w).length)){ kept = aiNorm(better) !== aiNorm(sx); better = sx; }
      const changed = aiNorm(better) !== aiNorm(sx);
      const issues = !changed ? [] : asArr(it.problems).filter(q2 => q2 && q2.tip).slice(0, 8).map(q2 => ({
        quote: aiClean(q2.quote), type: AI_ISSUE_TYPES.includes(q2.type) ? q2.type : 'grammar', tip: String(q2.tip).trim() }));
      const alt = '';
      return { s: sx, better, changed, kept, issues, alt, link: changed ? aiLinkOf(sx, better) : '',
        via: lvOf.get(i) === 'lt' ? 'lt' : !got.has(i) ? 'none' : '' };
    });
    return { kind: 'lm', level: lv, items, fixed: items.map(x => x.better).join(' '),
      noAi: items.filter(x => x.via).length };
  }
  try{
    {
      const rw = await Rewriter.create({ tone: 'as-is', length: 'as-is', format: 'plain-text', expectedInputLanguages: ['en'], outputLanguage: 'en',
        monitor, sharedContext: 'Numbered sentences of one paragraph by a Vietnamese learner. Rewrite each line as a fluent native speaker would, '
          + 'fixing all mistakes and literal phrasing and linking the ideas smoothly. Keep the numbering and the meaning. '
          + 'Text inside « » must be copied exactly, keeping the « » marks.' });
      arm();
      try{ raw = await rw.rewrite(input, { signal: ac.signal }); }
      finally{ try{ rw.destroy(); }catch(e){} }
    }
  }finally{ clearTimeout(timer); }
  const lines = aiParseLines(raw, sents.length);
  if(!lines){                                      // AI gộp/tách câu → chỉ hiện cả đoạn
    const whole = aiClean(String(raw).replace(/^\s*\d+[.)]\s*/gm, '').replace(/\n+/g, ' '));
    if(!whole) throw new Error('bad');
    const lost = targets.filter(w => findUse(text, w).length && !findUse(whole, w).length);
    return { kind: st.kind, items: [], fixed: whole, lost };
  }
  const items = sents.map((sx, i) => {
    let better = aiClean(lines[i]) || sx, kept = false;
    if(targets.some(w => findUse(sx, w).length && !findUse(better, w).length)){ better = sx; kept = aiNorm(lines[i]) !== aiNorm(sx); }
    const changed = aiNorm(better) !== aiNorm(sx);
    return { s: sx, better, changed, kept, issues: [], link: changed ? aiLinkOf(sx, better) : '' };
  });
  return { kind: st.kind, items, fixed: items.map(x => x.better).join(' '), explaining: st.kind === 'lm' && items.some(x => x.changed) };
}
/* Bước 2: giải thích lỗi cho các câu đã đổi (chạy sau, không chặn việc hiện bản sửa) */
const aiExplainSet = new WeakSet();
const aiExplainBusy = r => aiExplainSet.has(r);
async function aiExplain(r){
  aiExplainSet.add(r);
  try{ return await aiExplainRun(r); }finally{ aiExplainSet.delete(r); }
}
async function aiExplainRun(r){
  const ch = asArr(r.items).map((x, i) => [x, i]).filter(([x]) => x.changed);
  if(!ch.length){ r.explaining = false; return; }
  const ses = await aiSession('exp');
  const ac = new AbortController(), timer = setTimeout(() => ac.abort(), 90000);
  try{
    const raw = await ses.prompt(ch.map(([x], k) => `${k + 1}. ORIGINAL: ${x.s}\n   REWRITTEN: ${x.better}`).join('\n'),
      { responseConstraint: AI_EXP_SCHEMA, signal: ac.signal });
    const j = aiParseJson(raw), byN = new Map(asArr(j && j.items).filter(Boolean).map((y, k) => [Number.isInteger(y.n) ? y.n : k + 1, y]));
    ch.forEach(([x], k) => {
      x.issues = asArr((byN.get(k + 1) || {}).issues).filter(q => q && q.tip && (!aiClean(q.quote) || x.s.toLowerCase().includes(aiClean(q.quote).toLowerCase()))).slice(0, 3).map(q => ({
        quote: aiClean(q.quote), type: AI_ISSUE_TYPES.includes(q.type) ? q.type : 'grammar', tip: String(q.tip).trim() }));
    });
  }finally{ clearTimeout(timer); r.explaining = false; try{ ses.destroy(); }catch(e){} }
}
/* So sánh theo từ: phần thêm <ins>, phần bỏ <del> */
function aiDiffHtml(a, b){
  const A = a.split(/(\s+)/).filter(Boolean), B = b.split(/(\s+)/).filter(Boolean);
  if(A.length * B.length > 400000) return esc(b);
  const n = A.length, m = B.length, L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for(let i = n - 1; i >= 0; i--) for(let j = m - 1; j >= 0; j--)
    L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const ops = [];                               // [loại, chữ]: '=' giữ · '-' bỏ · '+' thêm
  let i = 0, j = 0;
  while(i < n || j < m){
    if(i < n && j < m && A[i] === B[j]){ ops.push(['=', B[j]]); i++; j++; }
    else if(j < m && (i >= n || L[i][j + 1] >= L[i + 1][j])) ops.push(['+', B[j++]]);
    else ops.push(['-', A[i++]]);
  }
  /* Gom các thay đổi liền nhau (kể cả khoảng trắng giữa chúng) thành một cụm bỏ + một cụm thêm */
  let html = '', del = '', ins = '', pend = '';
  const flush = () => {
    if(del.trim()) html += `<del>${esc(del.trim())}</del>` + (ins.trim() ? ' ' : '');
    if(ins.trim()) html += `<ins>${esc(ins.trim())}</ins>`;
    del = ins = '';
  };
  for(const [k, w] of ops){
    const sp = /^\s+$/.test(w);
    if(k === '=' && sp && (del || ins)){ pend += w; continue; }
    if(k === '='){ if((del.trim() || ins.trim()) && !pend) pend = ' '; flush(); html += esc(pend) + esc(w); pend = ''; continue; }
    if(sp) continue;
    if(pend){ del += del ? ' ' : ''; ins += ins ? ' ' : ''; pend = ''; }
    if(k === '-') del += (del && !del.endsWith(' ') ? ' ' : '') + w;
    else ins += (ins && !ins.endsWith(' ') ? ' ' : '') + w;
  }
  flush(); html += esc(pend);
  return html;
}
/* Sửa văn phong — AI sửa từng câu (chỉ rõ lỗi, câu đã sửa) và thêm từ liên kết khi cần;
   có thể áp cả đoạn đã sửa vào ô viết (Viết) hoặc bản viết lại (Lịch sử). */
/* Tô các đoạn bị lỗi trong câu, đánh số khớp với danh sách lỗi bên dưới */
function aiHlIssues(text, issues){
  const low = text.toLowerCase(), rs = [];
  issues.forEach((q, k) => {
    if(!q.quote) return;
    let from = 0, at = -1;
    while((at = low.indexOf(q.quote.toLowerCase(), from)) >= 0 && rs.some(r => at < r[1] && at + q.quote.length > r[0])) from = at + 1;
    if(at >= 0){ rs.push([at, at + q.quote.length, k]); q.found = true; } else q.found = false;
  });
  rs.sort((a, b) => a[0] - b[0]);
  let html = '', pos = 0;
  for(const [a, b, k] of rs){
    html += esc(text.slice(pos, a)) + `<mark class="ai-q t-${issues[k].type}">${esc(text.slice(a, b))}<sup>${k + 1}</sup></mark>`; pos = b;
  }
  return html + esc(text.slice(pos));
}
function aiIssuesHtml(x){
  const iss = asArr(x.issues);
  if(!iss.length) return x.hint ? `<div class="ai-s-hint">${I('bulb')}<span>${esc(x.hint)}</span></div>` : '';
  return `<ol class="ai-iss">${iss.map((q, k) => `<li class="ai-is">
      <span class="ai-is-n t-${q.type}">${k + 1}</span>
      <div><span class="ai-is-type t-${q.type}">${t('aiIssue_' + q.type)}</span>${q.quote ? `<span class="ai-is-q ${q.found === false ? 'nf' : ''}">“${esc(q.quote)}”</span>` : ''}
        <div class="ai-is-tip">${I('bulb')}<span>${esc(q.tip)}</span></div></div></li>`).join('')}</ol>`;
}
function aiItemHtml(x, i, r){
  const via = x.via === 'lt' ? `<div class="ai-via">${I('bulb')}${t('aiViaLt')}</div>` : x.via === 'none' ? `<div class="ai-via">${I('x')}${t('aiViaNone')}</div>` : '';
  if(!x.changed) return `<li class="ai-s ${x.via === 'none' ? 'skip' : 'ok'}"><span class="ai-s-n">${x.via === 'none' ? i + 1 : I('check')}</span>
      <div class="ai-s-b"><div class="ai-s-t">${esc(x.s)}</div>${x.kept ? `<div class="tk-note" style="margin:4px 0 0">${t('aiKept')}</div>` : ''}${via}</div></li>`;
  return `<li class="ai-s bad">
      <span class="ai-s-n">${i + 1}</span>
      <div class="ai-s-b">
        <div class="ai-s-t">${aiHlIssues(x.s, asArr(x.issues))}</div>${via}
        ${asArr(x.issues).length ? aiIssuesHtml(x) : r && r.explaining && aiExplainBusy(r) ? `<div class="ai-s-exp"><span class="tk-spin"></span>${t('aiExplaining')}</div>` : ''}
        <div class="ai-s-ans"><span class="ai-s-lbl">${I('check')}${t('aiCorrected')}</span>${x.link ? `<span class="ai-link">${I('next')}${t('aiLinkAdded')}: <b>${esc(x.link)}</b></span>` : ''}
          <div class="ai-s-better">${aiDiffHtml(x.s, x.better)}</div>
          <div class="ai-s-act">${x.applied || (r && r.applied) ? `<span class="ai-applied">${I('check')}${t('aiOneApplied')}</span>`
            : `<button class="btn sm primary" data-ai="one" data-i="${i}">${I('check')}${t('aiApplyOne')}</button>`}</div></div>
      </div></li>`;
}
function aiResultHtml(r, cur, ctx){
  if(!r || !r.items || !r.fixed) return '';
  const items = asArr(r.items), lkN = items.filter(x => x.link).length;
  const chN = items.length ? items.filter(x => x.changed).length : (aiNorm(r.fixed) !== aiNorm(r.src) ? -1 : 0);
  const stale = ctx === 'write' && !r.applied && r.src !== cur;
  return `<div class="ai-box" data-ctx="${ctx}">
    <div class="ai-head">${I('spark')}${t('aiGuideTitle')}<span class="ai-badge">${t('aiOnDevice')}</span></div>
    <div class="ai-sum ${chN ? '' : 'good'}">${chN > 0 ? t('aiSumFix', chN, items.length, lkN) : chN < 0 ? t('aiSumWhole') : t('aiAllGood')}</div>
    ${items.length ? `<ol class="ai-ss">${items.map((x, i) => aiItemHtml(x, i, r)).join('')}</ol>` : ''}
    ${r.noAi ? `<div class="tk-note" style="margin:8px 0 0">${t('aiNoAiNote', r.noAi)} <button class="btn sm" data-ai-retry="${ctx}">${I('spark')}${t('aiRetry')}</button></div>` : ''}
    ${asArr(r.lost).length ? `<div class="tk-alert bad" style="margin-top:10px">${I('x')}<span>${esc(t('aiLost', asArr(r.lost).map(w => '"' + w + '"').join(', ')))}</span></div>` : ''}
    ${chN ? `<div class="ai-full">
      <div class="ai-full-h"><span class="ai-s-lbl">${t('aiFullTitle')}</span>
        <span class="ai-full-act">
          <button class="btn sm" data-ai="copy">${I('copy')}${t('aiCopyTxt')}</button>
          ${r.applied ? `<span class="ai-applied">${I('check')}${t(ctx === 'hist' ? 'aiAppliedHist' : 'aiApplied')}</span>`
            : `<button class="btn sm primary" data-ai="apply">${I('check')}${t(ctx === 'hist' ? 'aiApplyHist' : 'aiApply')}</button>`}
        </span></div>
      <div class="ai-text">${aiDiffHtml(r.src, r.fixed)}</div>
    </div>` : ''}
    <div class="ai-foot"><span class="tk-note">${stale ? t('aiStale') : t('aiNoteFix')}</span></div>
  </div>`;
}
function aiLoadingHtml(){
  return `<div class="ai-box"><div class="ai-head">${I('spark')}${t('aiThinking')}</div>
    <div class="ai-text ai-live" hidden></div>
    <div class="ai-foot"><span class="tk-spin"></span><span class="ai-prog" hidden><span></span></span><span class="tk-note ai-pct"></span></div></div>`;
}
async function aiRun(host, text, targets, btn, ctx){
  if(btn) btn.disabled = true;
  host.innerHTML = aiLoadingHtml();
  const prog = loaded => {
    const bar = host.querySelector('.ai-prog'), pct = host.querySelector('.ai-pct');
    if(!bar || loaded >= 1) { if(pct) pct.textContent = ''; return; }
    bar.hidden = false; bar.firstElementChild.style.width = Math.round(loaded * 100) + '%';
    pct.textContent = t('aiDownloading', Math.round(loaded * 100));
  };
  try{
    const live = (a, n) => { const el = host.querySelector('.ai-live'); if(el){ el.hidden = false; el.textContent = typeof a === 'number' ? t('aiProgress', a, n) : a; } };
    const r = await aiStyle(text, targets, prog, live);
    r.src = text; r.at = now();
    return r;
  }catch(e){
    const un = e && e.message === 'unsupported';
    if(host.isConnected) host.innerHTML = `<div class="tk-alert bad ai-err" style="margin-top:14px">${I('x')}<span>${t(un ? 'aiUnsupported' : 'aiError')}
      ${un ? '' : `<small class="ai-err-why">${esc(t('aiErrWhy', aiErrReason(e)))}</small>`}</span>
      ${un || !ctx ? '' : `<button class="btn sm" data-ai-retry="${ctx}">${I('spark')}${t('aiRetry')}</button>`}</div>`;
    return null;
  }finally{ if(btn) btn.disabled = false; }
}
function aiErrReason(e){
  const n = (e && (e.name || '')) + ' ' + (e && e.message || '');
  if(/Quota/i.test(n)) return t('aiWhy_quota');
  if(/Abort|timeout/i.test(n)) return t('aiWhy_timeout');
  if(/NotReadable|unsafe|filter/i.test(n)) return t('aiWhy_filtered');
  if(/bad/.test(n)) return t('aiWhy_bad');
  if(/NotAllowed|activation|gesture/i.test(n)) return t('aiWhy_gesture');
  return (e && (e.name || e.message)) || '?';
}
document.addEventListener('click', ev => {
  const b = ev.target.closest('[data-ai-retry]'); if(!b) return;
  if(b.dataset.aiRetry === 'write') writeAi(); else histAi();
});
/* Chạy bước giải thích rồi vẽ lại nếu khung vẫn đang hiện kết quả này */
function aiExplainLater(r, ctx){
  if(!r.explaining) return;
  const redraw = () => {
    saveTasks();
    if(ctx === 'write'){ const x = tasks.t.write, p = x.paras[x.idx], h = $('#wrAi');
      if(p && p.ai === r && h && tkView === 'write') h.innerHTML = aiResultHtml(r, ($('#wrBox') || {}).value ? $('#wrBox').value.trim() : '', 'write'); }
    else{ const e = writeLog.find(y => y.id === histView), h = $('#histAi'); if(e && e.ai === r && h) h.innerHTML = aiResultHtml(r, e.text, 'hist'); }
  };
  aiExplain(r).then(redraw, () => { r.explaining = false; redraw(); });
}
/* Áp riêng một câu đã sửa vào ô viết (Viết) hoặc bản viết lại (Lịch sử) */
function aiApplyOne(ctx, i){
  const write = ctx === 'write';
  const p = write ? tasks.t.write.paras[tasks.t.write.idx] : null, e = write ? null : writeLog.find(x => x.id === histView);
  const r = write ? p && p.ai : e && e.ai, x = r && asArr(r.items)[i];
  const el = write ? $('#wrBox') : $('#histRw');
  if(!x || !x.changed || !el) return;
  const base = write ? el.value : (el.value.trim() || e.text);
  const k = base.indexOf(x.s);
  if(k < 0){ toast(t('aiOneNotFound')); return; }
  el.value = base.slice(0, k) + x.better + base.slice(k + x.s.length);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  x.applied = true;
  if(asArr(r.items).every(y => !y.changed || y.applied)) r.applied = true;
  if(write) r.src = el.value.trim(); else histRwFlush();
  saveTasks();
  const h = write ? $('#wrAi') : $('#histAi');
  if(h) h.innerHTML = aiResultHtml(r, write ? el.value.trim() : e.text, ctx);
}
/* Áp đoạn đã sửa: Viết → thay vào ô viết · Lịch sử → đưa vào "Bản viết lại hoàn chỉnh" */
function aiApply(ctx){
  if(ctx === 'write'){
    const x = tasks.t.write, p = x.paras[x.idx], box = $('#wrBox'); if(!p || !p.ai || !box) return;
    box.value = p.ai.fixed; box.dispatchEvent(new Event('input'));
    p.ai.applied = true; saveTasks();
    $('#wrAi').innerHTML = aiResultHtml(p.ai, box.value.trim(), 'write');
    toast(t('aiAppliedToast'));
    box.focus();
    return;
  }
  const e = writeLog.find(x => x.id === histView), ta = $('#histRw'); if(!e || !e.ai || !ta) return;
  if(ta.value.trim() && ta.value.trim() !== e.ai.fixed && !confirm(t('aiReplaceConfirm'))) return;
  ta.value = e.ai.fixed; ta.dispatchEvent(new Event('input', { bubbles: true }));
  e.ai.applied = true; histRwFlush();
  $('#histAi').innerHTML = aiResultHtml(e.ai, e.text, 'hist');
}
document.addEventListener('click', ev => {
  const b = ev.target.closest('[data-ai]'); if(!b) return;
  const box = b.closest('.ai-box'); if(!box) return;
  const ctx = box.dataset.ctx;
  if(b.dataset.ai === 'apply') aiApply(ctx);
  else if(b.dataset.ai === 'one') aiApplyOne(ctx, +b.dataset.i);
  else if(b.dataset.ai === 'copy'){
    const r = ctx === 'write' ? tasks.t.write.paras[tasks.t.write.idx].ai : (writeLog.find(x => x.id === histView) || {}).ai;
    if(r && r.fixed) navigator.clipboard.writeText(r.fixed).then(() => toast(t('trCopied'))).catch(() => {});
  }
});
function aiWriteBtnSync(p){
  const b = $('#wrAiBtn'), box = $('#wrBox'); if(!b || !box) return;
  b.innerHTML = I('spark') + t(p && p.ai && p.ai.fixed ? 'aiAgain' : 'aiBtn');
}
async function writeAi(){
  const x = tasks.t.write, p = x.paras[x.idx], box = $('#wrBox'), host = $('#wrAi');
  if(!p || !box || !host) return;
  const text = box.value.trim();
  if(wordCount(text) < 8){ toast(t('aiTooShort')); return; }
  const r = await aiRun(host, text, p.words.map(w => w.word), $('#wrAiBtn'), 'write');
  if(!r || tkView !== 'write' || x.paras[x.idx] !== p) return;
  p.ai = r; saveTasks();
  aiWriteBtnSync(p);
  aiExplainLater(r, 'write');
  const h = $('#wrAi'); if(h){ h.innerHTML = aiResultHtml(r, $('#wrBox').value.trim(), 'write'); h.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
}
async function writeCheck(){
  const x = tasks.t.write, p = x.paras[x.idx], box = $('#wrBox'), btn = $('#wrCheckBtn'), el = $('#wrResult');
  if(!p || !box) return;
  const text = box.value;
  p.text = text;
  if(wordCount(text) < WRITE_MIN_WORDS){ toast(t('tkWrTooShort', WRITE_MIN_WORDS)); return; }
  btn.disabled = true;
  el.innerHTML = `<div class="tk-loading"><span class="tk-spin"></span>${t('tkWrChecking')}</div>`;
  let data;
  try{
    const r = await fetch('https://api.languagetool.org/v2/check', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ text, language: 'en-US' }),
    });
    if(!r.ok) throw new Error('HTTP ' + r.status);
    data = await r.json();
  }catch(e){
    if(tkView !== 'write') return;
    btn.disabled = false;
    el.innerHTML = `<div class="tk-alert bad">${I('x')}<span>${t('tkWrServiceErr')}</span></div>`;
    return;
  }
  if(tkView !== 'write' || x.paras[x.idx] !== p) return;
  const vocab = new Set(words.map(w => w.word.trim().toLowerCase()));
  const tforms = new Set(p.words.flatMap(w => w.word.toLowerCase().split(/[\s\/]+/).filter(Boolean).flatMap(tk => [...wordForms(tk)])));
  const errs = [];
  for(const m of (data.matches || [])){
    const type = ltType(m); if(!type) continue;
    const frag = text.substr(m.offset, m.length);
    if(type === 'spelling' && (vocab.has(frag.toLowerCase()) || tforms.has(frag.toLowerCase()))) continue;
    const overlapsTarget = p.words.some(w => findUse(text, w.word).some(q => q.parts.some(([a, b]) => a < m.offset + m.length && m.offset < b)));
    errs.push({ type: type === 'grammar' && overlapsTarget ? 'usage' : type, text: frag, offset: m.offset, length: m.length,
      msg: m.message || '', sug: (m.replacements || []).slice(0, 3).map(r => r.value).join(' / ') });
  }
  errs.push(...localUsageErrors(text, p.words));
  p.checks = (p.checks || 0) + 1;
  p.checkedText = text;
  p.errors = errs;
  if(!Array.isArray(p.issues)) p.issues = [];
  const seenIssue = new Set(p.issues.map(e => e.type + '|' + e.text + '|' + e.msg));
  errs.forEach(e => {                           // gom mọi lỗi đã gặp để xem lại trong lịch sử
    const k = e.type + '|' + e.text + '|' + e.msg;
    if(!seenIssue.has(k)){ seenIssue.add(k); p.issues.push({ type: e.type, text: e.text, msg: e.msg, sug: e.sug, miss: e.offset < 0 ? 1 : 0 }); }
  });
  saveTasks();
  btn.disabled = false;
  if(errs.length){ renderWriteErrors(p, true); return; }
  p.done = true; p.errors = [];
  logWriting(p, x.idx);
  saveTasks();
  el.innerHTML = `<div class="tk-alert good">${I('check')}<span>${t('tkWrParaDone', x.idx + 1)}</span></div>`;
  btn.disabled = true; box.disabled = true;
  setTimeout(() => {
    if(tkView !== 'write') return;
    const next = x.paras.findIndex(q => !q.done);
    if(next < 0){ completeTask('write'); return; }
    x.idx = next; saveTasks(); renderTasks();
  }, 1400);
}
