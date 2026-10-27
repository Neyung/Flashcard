/* ═════════════ DỊCH NHANH (Google Dịch) ═════════════
   Tự nhận diện Anh ↔ Việt (dấu tiếng Việt / ngôn ngữ Google trả về), hiện nghĩa
   khác theo từ loại, nghe phát âm, sao chép và thêm thẳng vào sổ từ vựng. */
const tr = { dir: 'auto', from: 'en', to: 'vi', q: '', res: null, pick: '', reqId: 0, timer: null };
const VI_RE = /[ăâđêôơưàảãáạằẳẵắặầẩẫấậèẻẽéẹềểễếệìỉĩíịòỏõóọồổỗốộờởỡớợùủũúụừửữứựỳỷỹýỵ]/i;
const TR_POS = { verb:'v', 'động từ':'v', noun:'n', 'danh từ':'n', adjective:'adj', 'tính từ':'adj', adverb:'adv', 'trạng từ':'adv',
  preposition:'prep', 'giới từ':'prep', pronoun:'pron', 'đại từ':'pron', conjunction:'conj', 'liên từ':'conj', phrase:'phrase', 'cụm từ':'phrase' };
async function trFetch(q, sl, tl){
  try{
    const u = 'https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&dt=bd&sl=' + sl + '&tl=' + tl
      + '&hl=' + (LANG === 'vi' ? 'vi' : 'en') + '&q=' + encodeURIComponent(q);
    const r = await fetch(u);
    if(!r.ok) throw 0;
    const d = await r.json();
    return {
      text: (d[0] || []).map(x => x && x[0] || '').join('').normalize('NFC').trim(),
      src: d[2] || sl,
      /* d[1]: [từ loại, [nghĩa…], [[nghĩa, [dịch ngược…], _, điểm tần suất?], …]] — Google xếp nghĩa
         phổ biến lên trước và chỉ gắn điểm cho những nghĩa dùng nhiều */
      alts: (d[1] || []).map(g => ({ pos: (g[0] || '').normalize('NFC'), terms: (g[2] || (g[1] || []).map(x => [x])).slice(0, 8).map((e, i) => ({
        w: String(e[0] || '').normalize('NFC'), back: (e[1] || []).slice(0, 4), common: i === 0 || typeof e[3] === 'number' })) })).filter(g => g.terms.length),
    };
  }catch(e){                                     // dự phòng: MyMemory
    const from = sl === 'auto' ? (VI_RE.test(q) ? 'vi' : 'en') : sl;
    const r = await fetch('https://api.mymemory.translated.net/get?q=' + encodeURIComponent(q) + '&langpair=' + from + '|' + tl);
    if(!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    const text = d && d.responseData && d.responseData.translatedText;
    if(!text) throw new Error('empty');
    return { text, src: from, alts: [] };
  }
}
async function trRun(force){
  const q = $('#trIn').value.trim();
  if(!q){ tr.q = ''; tr.res = null; trRender(); return; }
  if(q === tr.q && tr.res && !force) return;
  const id = ++tr.reqId;
  tr.q = q; tr.res = { loading: true }; tr.pick = ''; trRender();
  try{
    let from, to, res;
    if(tr.dir === 'auto'){
      from = VI_RE.test(q) ? 'vi' : 'en'; to = from === 'vi' ? 'en' : 'vi';
      res = await trFetch(q, 'auto', to);
      if(id !== tr.reqId) return;
      if(res.src === to){ from = to; to = from === 'vi' ? 'en' : 'vi'; res = await trFetch(q, from, to); }   // đoán sai chiều → dịch lại
      else from = res.src === 'vi' ? 'vi' : 'en';
    }else{
      [from, to] = tr.dir.split('-');
      res = await trFetch(q, from, to);
    }
    if(id !== tr.reqId) return;
    tr.from = from; tr.to = to; tr.res = res;
  }catch(e){
    if(id !== tr.reqId) return;
    tr.res = { error: true };
  }
  trRender();
}
function trRender(){
  $('#trFrom').textContent = tr.from.toUpperCase();
  $('#trTo').textContent = tr.to.toUpperCase();
  $('#trDir').title = t('trSwap') + ' · ' + (tr.dir === 'auto' ? t('trAuto') : t('trManual'));
  $('#trDir').classList.toggle('auto', tr.dir === 'auto');
  const out = $('#trOut'), r = tr.res;
  const q = $('#trIn').value.trim();
  $('#trGoogle').href = 'https://translate.google.com/?sl=' + (tr.dir === 'auto' ? 'auto' : tr.from) + '&tl=' + tr.to + '&op=translate&text=' + encodeURIComponent(q);
  const ready = r && !r.loading && !r.error && r.text;
  $('#trSpeak').disabled = !q; $('#trCopy').disabled = !ready; $('#trAdd').disabled = !ready || !currentUser;
  if(!r){ out.innerHTML = `<div class="tr-empty">${t('trEmpty')}</div>`; return; }
  if(r.loading){ out.innerHTML = `<div class="tk-loading" style="padding:6px"><span class="tk-spin"></span>${t('trLoading')}</div>`; return; }
  if(r.error){ out.innerHTML = `<div class="tr-empty" style="color:var(--red)">${t('trErr')}</div>`; return; }
  const mainLc = r.text.toLowerCase();
  const mainPos = (r.alts.find(g => g.terms.some(x => x.w.toLowerCase() === mainLc)) || r.alts[0] || {}).pos || '';
  out.innerHTML = `<div class="tr-main-box ${tr.pick === r.text ? 'on' : ''}">
      <div class="tr-lbl">${I('star')}${t('trMain')}${mainPos ? ` · <span>${esc(mainPos)}</span>` : ''}</div>
      <button class="tr-main" data-alt="${esc(r.text)}" data-pos="${esc(mainPos)}">${esc(r.text)}</button>
    </div>`
    + (r.alts.length ? `<div class="tr-alts"><div class="tr-lbl">${t('trMore')}<span class="tr-legend"><i></i>${t('trCommon')}</span></div>
      ${r.alts.map(g => `<div><div class="tr-pos">${esc(g.pos)}</div><div class="tr-alt-row">${g.terms.map(x =>
        `<button class="tr-alt ${x.common ? 'common' : ''} ${tr.pick === x.w ? 'on' : ''}" data-alt="${esc(x.w)}" data-pos="${esc(g.pos)}"
          title="${esc(x.back.join(', '))}">${esc(x.w)}</button>`).join('')}</div></div>`).join('')}</div>` : '');
}
function trOpen(){
  const sel = (window.getSelection && String(window.getSelection())).trim();
  lxClose();
  setDial(false);
  $('#trPanel').hidden = false; $('#trFab').classList.add('on'); updateTopFab();
  const inp = $('#trIn');
  if(sel && sel.length < 500 && !$('#trPanel').contains(window.getSelection().anchorNode)){ inp.value = sel; trRun(true); }
  else trRender();
  inp.focus(); inp.select();
}
function trClose(){ $('#trPanel').hidden = true; $('#trFab').classList.remove('on'); updateTopFab(); }
$('#trFab').addEventListener('mousedown', e => e.preventDefault());       // giữ nguyên vùng chữ đang bôi đen
$('#trFab').addEventListener('click', () => $('#trPanel').hidden ? trOpen() : trClose());
$('#trClose').addEventListener('click', trClose);
$('#trIn').addEventListener('input', () => { clearTimeout(tr.timer); tr.timer = setTimeout(() => trRun(), 550); });
$('#trIn').addEventListener('keydown', e => {
  if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); clearTimeout(tr.timer); trRun(true); }
  if(e.key === 'Escape'){ e.stopPropagation(); trClose(); }
});
$('#trDir').addEventListener('click', () => {
  tr.dir = tr.from === 'en' ? 'vi-en' : 'en-vi';
  [tr.from, tr.to] = tr.dir.split('-');
  const r = tr.res;                                // đảo chiều: đưa bản dịch lên làm nội dung cần dịch
  if(r && r.text && !r.loading && !r.error) $('#trIn').value = r.text;
  trRun(true);
});
$('#trOut').addEventListener('click', e => {
  const b = e.target.closest('.tr-alt, .tr-main'); if(!b) return;
  tr.pick = tr.pick === b.dataset.alt ? '' : b.dataset.alt; tr.pickPos = b.dataset.pos;
  trRender();
});
$('#trSpeak').addEventListener('click', () => {
  const q = $('#trIn').value.trim(), r = tr.res;
  const en = tr.from === 'en' ? q : (r && r.text) || '';
  if(en) speakTTS(en);
});
$('#trCopy').addEventListener('click', async () => {
  const txt = tr.pick || (tr.res && tr.res.text) || '';
  try{ await navigator.clipboard.writeText(txt); toast(t('trCopied')); }catch(e){}
});
$('#trAdd').addEventListener('click', () => {
  const q = $('#trIn').value.trim(), r = tr.res;
  if(!currentUser || !r || !r.text) return;
  const pick = tr.pick && tr.from === 'en' ? tr.pick : '';
  let en = tr.from === 'en' ? q : (tr.pick || r.text), vi = tr.from === 'en' ? (pick || r.text) : q;
  en = en.replace(/[.!?]+$/, '').trim();
  if(en.split(/\s+/).length > 6 || en.length > 60){ toast(t('trTooLong')); return; }
  if(words.some(w => w.word.trim().toLowerCase() === en.toLowerCase())){ toast(t('trExists', en)); return; }
  const posName = ((tr.pick && tr.pickPos) || (r.alts[0] && r.alts[0].pos) || '').toLowerCase();
  const w = makeWord(en, TR_POS[posName] || '', vi, '', '', /\s/.test(en) ? 'cụm' : 'đơn', false, '');
  words.push(w); save(); renderStats();
  if($('#tab-notes').classList.contains('active')) renderTable();
  if(w.kind === 'đơn') fetchPhonetics(w);
  toast(t('trAdded', en));
});
document.addEventListener('keydown', e => { if(e.key === 'Escape' && !$('#trPanel').hidden) trClose(); });
