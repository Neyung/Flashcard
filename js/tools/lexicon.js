/* ═════════════ TRA DẠNG TỪ & ĐỒNG / TRÁI NGHĨA ═════════════
   Hai mục tìm kiếm riêng, mỗi mục có ô nhập và kết quả của nó:
   - Dạng từ: họ từ cùng gốc (decide → decision, decisive, indecisive…) chia theo từ loại, cộng
     biến thể (-s, -ed, -ing, so sánh, động từ bất quy tắc). Ứng viên lấy từ Datamuse (các từ chứa
     phần gốc), rồi lọc bằng quy tắc hậu tố: phần khác nhau giữa hai từ phải là chuỗi hậu tố hợp lệ.
   - Đồng / Trái nghĩa: Free Dictionary API (theo từ loại) + Datamuse rel_syn / rel_ant;
     không có đồng nghĩa thì đưa các từ gần nghĩa (Datamuse ml). */
const lx = { tab: 'forms', forms: { q: '', res: null, reqId: 0 }, syn: { q: '', res: null, reqId: 0 } };
const LX_DER = new Set(('ss ly ily ion ions tion sion ation ations ition ive ives ative itive sive tive ness iness ment ments able ible '
  + 'ably ibly abilities ability ibility ility ilities al als ally ial ially ity ities ality ize ise izes ises ization isation ful fully '
  + 'less lessly lessness ous ously ious iously ence ences ency ance ances ancy ent ents ant ants ently antly ic ics ical ically ism '
  + 'isms ist ists ure ures age ery ory ee or ors ship hood ward wards wise ate ates ator ators ary ish sis tic tical tically ify '
  + 'ifies ification nation nations').split(' '));
const LX_INF = new Set('s es d ed ing ings r er ers st est ies ied'.split(' '));
const LX_WREM = new Set(['', 'e', 'y', 'de', 'te', 'se', 'ce', 've', 'le', 're', 'ze', 'ate', 'in']);   // đuôi của từ gốc có thể rụng
const LX_CW = new Set(['e', 'de', 'te', 'se', 'ce', 've', 'ze', 'in']);   // đuôi được phép ở từ ứng viên (vd decision → decide)
const LX_NEG = ['un', 'in', 'im', 'il', 'ir', 'dis', 'non', 'mis'];
const LX_POS = { noun: 'n', verb: 'v', adjective: 'adj', adverb: 'adv' };
const LX_IRR = ('be was were been|go went gone|have had|do did done|say said|get got gotten|make made|know knew known|think thought|'
  + 'take took taken|see saw seen|come came|give gave given|find found|tell told|become became|leave left|feel felt|bring brought|'
  + 'begin began begun|keep kept|hold held|write wrote written|stand stood|hear heard|let|mean meant|set|meet met|run ran|pay paid|'
  + 'sit sat|speak spoke spoken|lie lay lain|lead led|read|grow grew grown|lose lost|fall fell fallen|send sent|build built|'
  + 'understand understood|draw drew drawn|break broke broken|spend spent|cut|rise rose risen|drive drove driven|buy bought|wear wore worn|'
  + 'choose chose chosen|seek sought|throw threw thrown|catch caught|deal dealt|win won|forget forgot forgotten|lend lent|teach taught|'
  + 'eat ate eaten|drink drank drunk|sing sang sung|swim swam swum|fly flew flown|hide hid hidden|ride rode ridden|shake shook shaken|'
  + 'steal stole stolen|wake woke woken|fight fought|feed fed|sleep slept|sell sold|shoot shot|shine shone|bite bit bitten|'
  + 'blow blew blown|freeze froze frozen|forgive forgave forgiven|hang hung|hurt|put|quit|shut|spread|strike struck|swear swore sworn|'
  + 'tear tore torn|bear bore borne|beat beaten|bend bent|bind bound|bleed bled|breed bred|burn burnt|dig dug|dream dreamt|'
  + 'flee fled|forbid forbade forbidden|grind ground|kneel knelt|lay laid|lean leant|leap leapt|light lit|mistake mistook mistaken|'
  + 'overcome overcame|ring rang rung|seek sought|sew sewn|shrink shrank shrunk|sink sank sunk|slide slid|spin spun|split|'
  + 'spring sprang sprung|stick stuck|sting stung|stink stank stunk|strive strove striven|sweep swept|swing swung|tread trod trodden|'
  + 'undergo underwent undergone|undertake undertook undertaken|withdraw withdrew withdrawn|good better best|bad worse worst|'
  + 'far farther further farthest furthest|little less least|many more most|much more most').split('|').map(g => g.split(' '));
const lxLcp = (a, b) => { let i = 0; while(i < a.length && i < b.length && a[i] === b[i]) i++; return i; };
const lxDecoMemo = new Map();
function lxDeco(r, afterInf){             // r có tách được thành chuỗi hậu tố hợp lệ không
  if(!r) return true;
  if(afterInf) return r === 'ly' || r === 'ness';   // sau hậu tố biến thể chỉ còn -ly / -ness (decidedly)
  if(lxDecoMemo.has(r)) return lxDecoMemo.get(r);
  let ok = false;
  for(const x of LX_DER) if(r.startsWith(x) && lxDeco(r.slice(x.length))){ ok = true; break; }
  if(!ok) for(const x of LX_INF) if(r.startsWith(x) && lxDeco(r.slice(x.length), true)){ ok = true; break; }
  lxDecoMemo.set(r, ok);
  return ok;
}
function lxRelated(w, c){
  if(c === w) return true;
  for(const p of ['', ...LX_NEG]){
    if(p && !c.startsWith(p)) continue;
    const cc = c.slice(p.length), i = lxLcp(w, cc);
    if(i < 3 || i < w.length - 2) continue;
    const wr = w.slice(i), cr = cc.slice(i);
    if(wr[0] === 'y' && cr[0] === 'i' && lxDeco(cr.slice(1))) return true;          // happy → happiness
    if(!(LX_WREM.has(wr) || lxDeco(wr))) continue;
    if(cr.startsWith('ss') && !wr) continue;                                        // care ≠ caress
    if(lxDeco(cr) || (LX_CW.has(cr) && wr && lxDeco(wr))) return true;
  }
  return false;
}
function lxBases(w){                      // từ gốc + các dạng đã bỏ một hậu tố (decision → decis, deci)
  const bs = [w];
  for(let k = 4; k < w.length; k++){ const r = w.slice(k);
    if(LX_DER.has(r) || ['s', 'es', 'ed', 'ing', 'ies', 'ied'].includes(r)) bs.push(w.slice(0, k)); }
  return bs;
}
function lxIsInfl(b, c){                  // c là biến thể ngữ pháp của b (-s, -ed, -ing, -er, -est)
  if(c === b) return false;
  const i = lxLcp(b, c), wr = b.slice(i), cr = c.slice(i);
  if(!wr){
    if(['s', 'es', 'ed', 'ing', 'er', 'est'].includes(cr)) return true;
    if(b.endsWith('e') && ['d', 'r', 's', 'st'].includes(cr)) return true;
    if(cr.length >= 3 && cr[0] === b[b.length - 1] && ['ed', 'ing', 'er', 'est'].includes(cr.slice(1))) return true;   // stop → stopped
  }
  if(wr === 'e' && ['ed', 'ing', 'er', 'est'].includes(cr)) return true;
  if(wr === 'y' && ['ies', 'ied', 'ier', 'iest'].includes(cr)) return true;
  return false;
}
async function lxDm(params){
  const r = await fetch('https://api.datamuse.com/words?' + params);
  if(!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
const lxFreq = x => { const f = (x.tags || []).find(s => s.startsWith('f:')); return f ? parseFloat(f.slice(2)) || 0 : 0; };
const lxPosOf = x => (x.tags || []).map(s => s.toLowerCase()).find(s => ['n', 'v', 'adj', 'adv'].includes(s)) || 'other';
async function lxForms(q){
  const n = q.length, bs = lxBases(q), root = bs.reduce((a, b) => b.length < a.length ? b : a);
  let P = n <= 3 ? q : q.slice(0, Math.max(Math.min(4, n - 1), Math.min(5, n - 2)));
  if(lxLcp(P, root) >= 3) P = P.slice(0, lxLcp(P, root));
  const lists = await Promise.all([lxDm('sp=' + P + '*&md=pf&max=1000'), lxDm('sp=*' + P + '*&md=pf&max=1000'), lxDm('sp=' + q + '&md=pf&max=1')]);
  const seen = new Map();
  lists.flat().forEach(x => { if(!seen.has(x.word)) seen.set(x.word, x); });
  const by = { n: [], v: [], adj: [], adv: [], infl: [], other: [] }, irr = LX_IRR.find(g => g.includes(q) || bs.some(b => g[0] === b));
  for(const x of seen.values()){
    const c = x.word;
    if(!/^[a-z]+$/.test(c) || (x.tags || []).includes('prop')) continue;
    if(c !== q && lxFreq(x) < 0.3) continue;
    if(!bs.some(b => lxRelated(b, c))) continue;
    const g = c !== q && bs.some(b => lxIsInfl(b, c)) ? 'infl' : lxPosOf(x);
    by[g].push({ w: c, f: lxFreq(x) });
  }
  if(irr) irr.forEach(f => { if(f !== q && !by.infl.some(x => x.w === f)) by.infl.push({ w: f, f: 1e6 }); });
  if(!Object.values(by).some(l => l.some(x => x.w === q))) by.other.unshift({ w: q, f: 1e9 });
  return ['n', 'v', 'adj', 'adv', 'infl', 'other'].map(k => ({ lbl: k === 'infl' ? 'lxInfl' : 'lxPos_' + k,
    items: by[k].sort((a, b) => b.f - a.f).slice(0, 18).map(x => x.w) })).filter(g => g.items.length);
}
async function lxSyns(q){
  const enc = encodeURIComponent(q);
  const [syn, ant, self, dict] = await Promise.all([lxDm('rel_syn=' + enc + '&md=p&max=40'), lxDm('rel_ant=' + enc + '&md=p&max=20'),
    lxDm('sp=' + enc + '&md=p&max=1'),
    fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + enc).then(r => r.ok ? r.json() : []).catch(() => [])]);
  const S = {}, A = {};
  const add = (M, pos, w) => { w = String(w || '').trim(); if(!w || w.toLowerCase() === q) return;
    const l = M[pos] || (M[pos] = []); if(!l.some(x => x.toLowerCase() === w.toLowerCase())) l.push(w); };
  (Array.isArray(dict) ? dict : []).forEach(e => (e.meanings || []).forEach(m => {
    const pos = LX_POS[m.partOfSpeech] || 'other';
    (m.synonyms || []).forEach(w => add(S, pos, w)); (m.antonyms || []).forEach(w => add(A, pos, w));
    (m.definitions || []).forEach(d => { (d.synonyms || []).forEach(w => add(S, pos, w)); (d.antonyms || []).forEach(w => add(A, pos, w)); });
  }));
  /* Datamuse gắn từ loại của chính từ đồng/trái nghĩa (content → danh từ) → quy về từ loại của từ đang tra */
  const own = (((self[0] || {}).word === q && self[0].tags) || []).map(x => x.toLowerCase()).filter(x => ['n', 'v', 'adj', 'adv'].includes(x));
  Object.keys(S).concat(Object.keys(A)).forEach(p => { if(p !== 'other' && !own.includes(p)) own.push(p); });
  const posFor = x => { const ts = (x.tags || []).map(s => s.toLowerCase()); return own.find(p => ts.includes(p)) || own[0] || lxPosOf(x); };
  syn.forEach(x => add(S, posFor(x), x.word));
  ant.forEach(x => add(A, posFor(x), x.word));
  const order = ['n', 'v', 'adj', 'adv', 'other'];
  const groups = [];
  order.forEach(p => { if(S[p]) groups.push({ lbl: 'lxSyn', pos: p, items: S[p].slice(0, 18) }); });
  if(!groups.length){
    const near = (await lxDm('ml=' + enc + '&md=p&max=30')).filter(x => !/\s/.test(x.word) || q.includes(' '));
    const N = {}; near.forEach(x => add(N, lxPosOf(x), x.word));
    groups.push({ note: 'lxNoSyn' });
    order.forEach(p => { if(N[p]) groups.push({ lbl: 'lxNear', pos: p, items: N[p].slice(0, 12) }); });
  }
  const ants = order.filter(p => A[p]).map(p => ({ lbl: 'lxAnt', pos: p, items: A[p].slice(0, 18) }));
  return groups.concat(ants.length ? ants : [{ note: 'lxNoAnt' }]);
}
const lxIn = kind => $(kind === 'forms' ? '#lxInForms' : '#lxInSyn');
async function lxRun(kind, force){
  const st = lx[kind];
  const q = lxIn(kind).value.trim().toLowerCase().replace(/\s+/g, ' ');
  if(!q){ st.q = ''; st.res = null; lxRender(kind); return; }
  if(q === st.q && st.res && !force) return;
  const id = ++st.reqId;
  st.q = q;
  if(VI_RE.test(q)){ st.res = { msg: 'lxEnOnly' }; lxRender(kind); return; }
  if(kind === 'forms' && !/^[a-z][a-z'-]*$/.test(q)){ st.res = { msg: 'lxOneWord' }; lxRender(kind); return; }
  st.res = { loading: true }; lxRender(kind);
  try{
    const groups = await (kind === 'forms' ? lxForms(q) : lxSyns(q));
    if(id !== st.reqId) return;
    st.res = groups.some(g => g.items && g.items.length) ? { groups } : { msg: 'lxNone' };
  }catch(e){
    if(id !== st.reqId) return;
    st.res = { msg: 'lxErr', err: true };
  }
  lxRender(kind);
}
function lxRender(kind){
  const st = lx[kind], out = $(kind === 'forms' ? '#lxOutForms' : '#lxOutSyn'), r = st.res;
  if(kind === lx.tab){
    const q = encodeURIComponent(st.q || lxIn(kind).value.trim().toLowerCase());
    $('#lxExt').href = kind === 'forms' ? 'https://dictionary.cambridge.org/dictionary/english/' + q : 'https://www.thesaurus.com/browse/' + q;
    $('#lxExtLbl').textContent = t(kind === 'forms' ? 'lxExtForms' : 'lxExtSyn');
  }
  if(!r){ out.innerHTML = `<div class="tr-empty">${t('lxEmpty')}</div>`; return; }
  if(r.loading){ out.innerHTML = `<div class="tk-loading" style="padding:6px"><span class="tk-spin"></span>${t('lxLoading')}</div>`; return; }
  if(r.msg){ out.innerHTML = `<div class="tr-empty" ${r.err ? 'style="color:var(--red)"' : ''}>${t(r.msg)}</div>`; return; }
  out.innerHTML = r.groups.map(g => g.note ? `<div class="lx-grp lx-none">${t(g.note)}</div>`
    : `<div class="lx-grp"><div class="tr-pos">${t(g.lbl)}${g.pos ? ` <small>· ${t('lxPos_' + g.pos)}</small>` : ''}</div>
      <div class="tr-alt-row">${g.items.map(w => `<button class="tr-alt lx-chip ${w === st.q ? 'self' : ''}" data-w="${esc(w)}">${esc(w)}</button>`).join('')}</div></div>`).join('');
}
function lxSetTab(kind){
  lx.tab = kind;
  $$('#lxPanel .lx-tab').forEach(b => b.classList.toggle('on', b.dataset.lx === kind));
  $$('#lxPanel .lx-sec').forEach(s => s.hidden = s.dataset.sec !== kind);
  lxRender(kind);
  const inp = lxIn(kind); inp.focus(); inp.select();
}
function lxLookup(w){                     // điền sẵn cho cả hai mục rồi tra
  lxIn('forms').value = w; lxIn('syn').value = w;
  lxRun('forms', true); lxRun('syn', true);
}
function lxOpen(){
  const sel = (window.getSelection && String(window.getSelection())).trim();
  trClose();
  setDial(false);
  $('#lxPanel').hidden = false; $('#lxFab').classList.add('on'); updateTopFab();
  if(sel && sel.length < 40 && !$('#lxPanel').contains(window.getSelection().anchorNode)) lxLookup(sel);
  lxSetTab(lx.tab);
}
function lxClose(){ $('#lxPanel').hidden = true; $('#lxFab').classList.remove('on'); updateTopFab(); }
