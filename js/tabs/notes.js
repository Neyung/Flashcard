/* ═══════════════════════════════════════════════════════════
   TAB GHI CHÚ
   ═══════════════════════════════════════════════════════════ */
let formKind = 'đơn';
$('#fKind').addEventListener('click', e=>{
  const b = e.target.closest('button'); if(!b) return;
  formKind = b.dataset.kind;
  $$('#fKind button').forEach(x=>x.classList.toggle('on', x===b));
});

// gợi ý: tự đoán đơn/cụm theo dấu cách
$('#fWord').addEventListener('input', e=>{
  const isPhrase = e.target.value.trim().includes(' ');
  formKind = isPhrase ? 'cụm' : 'đơn';
  $$('#fKind button').forEach(x=>x.classList.toggle('on', x.dataset.kind===formKind));
});

$('#btnAdd').addEventListener('click', ()=>{
  const word = $('#fWord').value.trim();
  const meaning = $('#fMeaning').value.trim();
  if(!word || !meaning){ toast(t('toastNeedWordMeaning')); return; }
  const dup = words.find(w => w.word.toLowerCase() === word.toLowerCase()
                           && w.meaning.toLowerCase() === meaning.toLowerCase());
  if(dup){ toast(t('toastDupWord')); return; }
  words.push(makeWord(word, $('#fPos').value, meaning, $('#fSentence').value, $('#fNote').value, formKind,
                      false, $('#fGroup').value));
  save(); renderTable(); renderStats(); clearForm();
  toast(t('toastAdded', word));
  const justAdded = words[words.length - 1];
  if(justAdded.kind === 'đơn'){
    fetchPhonetics(justAdded).then(ok => { if(ok){ renderTable();
      toast(t('toastIpaFound', justAdded.word, justAdded.ipa)); } });
  }
});
['fWord','fPos','fMeaning','fSentence','fNote','fGroup'].forEach(id =>
  $('#' + id).addEventListener('keydown', e => {
    if(e.key === 'Enter'){ e.preventDefault(); $('#btnAdd').click(); }
  }));
function clearForm(){
  ['fWord','fPos','fMeaning','fSentence','fNote','fGroup'].forEach(id=>$('#'+id).value='');
  $('#fWord').focus();
}
$('#btnClear').addEventListener('click', clearForm);

/* ── Bảng từ ─────────────────────────────────────────────── */
function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

let sortBy = null, sortDir = 1;
let editingId = null;

/* ── Bộ lọc tick nhiều lựa chọn dùng chung (nút + menu checkbox "Tất cả" + từng mục) ── */
function makeCheckFilter(root, o){
  const st = { all:true, set:new Set() };
  root.classList.add('gsel');
  root.innerHTML = `<button type="button" class="gsel-btn" aria-haspopup="true" aria-expanded="false">
      <span class="gsel-text"></span><svg class="ic caret" viewBox="0 0 24 24"><path d="M6 9.5l6 6 6-6"/></svg>
    </button><div class="gsel-menu" hidden></div>`;
  const btn = root.querySelector('.gsel-btn'), txt = root.querySelector('.gsel-text'), menu = root.querySelector('.gsel-menu');
  let items = [];
  const label = () => {
    if(st.all) return t(o.allKey);
    const n = st.set.size;
    if(!n) return t(o.noneKey);
    if(n === 1){ const k = [...st.set][0], it = items.find(x => x.k === k); return it ? it.label : k; }
    return t(o.nKey, n);
  };
  function sync(){
    menu.querySelectorAll('input[type=checkbox]').forEach(cb => {
      cb.checked = cb.hasAttribute('data-all') ? st.all : (st.all || st.set.has(cb.dataset.k));
    });
    const allCb = menu.querySelector('input[data-all]');
    if(allCb) allCb.indeterminate = !st.all && st.set.size > 0;
    txt.textContent = txt.title = label();
  }
  function toggle(force){
    const open = force !== undefined ? force : menu.hidden;
    menu.hidden = !open; root.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', String(open));
  }
  function fill(){
    items = o.items();
    const keys = items.map(x => x.k);
    if(!st.all) st.set = new Set([...st.set].filter(k => keys.includes(k)));
    const opt = (attr, lbl, n, cls) =>
      `<label class="gsel-opt ${cls}"><input type="checkbox" ${attr}><span>${esc(lbl)}</span><span class="n">${n}</span></label>`;
    menu.innerHTML = opt('data-all', t(o.allKey), o.total(), 'all')
      + items.map(x => opt(`data-k="${esc(x.k)}"`, x.label, x.n, '')).join('');
    sync();
  }
  btn.addEventListener('click', e => { e.stopPropagation(); toggle(); });
  document.addEventListener('click', e => { if(!root.contains(e.target)) toggle(false); });
  document.addEventListener('keydown', e => { if(e.key === 'Escape') toggle(false); });
  menu.addEventListener('change', e => {
    const cb = e.target.closest('input[type=checkbox]'); if(!cb) return;
    const keys = items.map(x => x.k);
    if(cb.hasAttribute('data-all')){
      st.all = cb.checked; st.set = new Set();
    }else{
      if(st.all){ st.all = false; st.set = new Set(keys); }   // đang "tất cả" → bỏ tick 1 mục
      cb.checked ? st.set.add(cb.dataset.k) : st.set.delete(cb.dataset.k);
      if(keys.length && keys.every(k => st.set.has(k))){ st.all = true; st.set = new Set(); }
    }
    sync(); o.onChange();
  });
  return { ok: k => st.all || st.set.has(k), none: () => !st.all && !st.set.size, fill, close: () => toggle(false),
           reset(){ st.all = true; st.set = new Set(); } };
}

/* ── Chọn nhiều dòng để xoá hàng loạt (chỉ giữ các dòng đang hiển thị) ── */
function makeRowSelection(o){
  const sel = new Set();
  let shown = [], lastId = null;
  function sync(){
    const tb = $(o.tbody);
    tb.querySelectorAll('tr[data-id]').forEach(tr => {
      const on = sel.has(tr.dataset.id);
      tr.classList.toggle('sel', on);
      const cb = tr.querySelector('.row-cb'); if(cb) cb.checked = on;
    });
    const all = $(o.selAll), n = sel.size;
    all.checked = n > 0 && n === shown.length;
    all.indeterminate = n > 0 && n < shown.length;
    all.disabled = !shown.length;
    $(o.bar).hidden = !n;
    $(o.count).textContent = t('selCount', n);
  }
  function setShown(ids){
    shown = ids;
    const vis = new Set(ids);
    [...sel].forEach(id => { if(!vis.has(id)) sel.delete(id); });
  }
  $(o.tbody).addEventListener('click', e => {
    const cb = e.target.closest('.row-cb'); if(!cb) return;
    const id = cb.closest('tr').dataset.id;
    const i = shown.indexOf(id), j = shown.indexOf(lastId);
    if(e.shiftKey && lastId && i >= 0 && j >= 0){       // Shift+click: chọn cả đoạn
      const [a, b] = i < j ? [i, j] : [j, i];
      shown.slice(a, b + 1).forEach(x => cb.checked ? sel.add(x) : sel.delete(x));
    }else{
      cb.checked ? sel.add(id) : sel.delete(id);
    }
    lastId = id; sync();
  });
  $(o.selAll).addEventListener('change', e => {
    sel.clear();
    if(e.target.checked) shown.forEach(id => sel.add(id));
    sync();
  });
  $(o.clearBtn).addEventListener('click', () => { sel.clear(); sync(); });
  $(o.delBtn).addEventListener('click', () => { if(sel.size) o.onDelete(new Set(sel)); });
  return { sel, sync, setShown, cell: id => `<td class="sel-col"><input type="checkbox" class="row-cb" ${sel.has(id)?'checked':''}></td>` };
}

const NO_GROUP_F = '∅';
const groupFilter = makeCheckFilter($('#groupFilter'), {
  allKey:'nAllGroups', noneKey:'qGroupsNone', nKey:'qGroupsN',
  total: () => words.length,
  items: () => {
    const cnt = {}; words.forEach(w => { const k = w.group || NO_GROUP_F; cnt[k] = (cnt[k] || 0) + 1; });
    const list = groupsOf().map(g => ({ k:g, label:g, n:cnt[g] || 0 }));
    if(cnt[NO_GROUP_F]) list.push({ k:NO_GROUP_F, label:t('optNoGroup'), n:cnt[NO_GROUP_F] });
    return list;
  },
  onChange: () => renderTable(true),
});
function visibleWords(){
  const q = ($('#search').value||'').toLowerCase();
  return words.filter(w =>
    (!q || w.word.toLowerCase().includes(q) || w.meaning.toLowerCase().includes(q)
        || (w.note||'').toLowerCase().includes(q))
    && groupFilter.ok(w.group || NO_GROUP_F));
}
const wordSel = makeRowSelection({
  tbody:'#wordTbody', selAll:'#wordSelAll', bar:'#wordBulkBar', count:'#wordSelN',
  clearBtn:'#btnWordClearSel', delBtn:'#btnWordDelSel',
  onDelete: ids => {
    if(!confirm(t('confirmDeleteMany', ids.size))) return;
    words = words.filter(w => !ids.has(w.id));
    wordSel.sel.clear();
    save(); renderTable(); renderStats();
    toast(t('toastDeletedMany', ids.size));
  },
});

function saveEdit(w){
  const word = $('#eWord').value.trim(), meaning = $('#eMeaning').value.trim();
  if(!word || !meaning){ toast(t('toastWordMeaningEmpty')); return; }
  const wordChanged = word.toLowerCase() !== w.word.toLowerCase(), oldMeaning = w.meaning;
  w.word = word;
  w.pos = $('#ePos').value.trim();
  w.meaning = meaning;
  w.sentence = $('#eSentence').value.trim();
  w.note = $('#eNote').value.trim();
  w.kind = $('#eKind').value === 'cụm' ? 'cụm' : 'đơn';
  w.group = $('#eGroup').value.trim();
  if(wordChanged || w.kind === 'cụm'){ w.ipa = ''; w.audio = ''; ipaFailed.delete(w.id); }
  if(wordChanged || meaning !== oldMeaning) delete w.cefr;          // đổi từ/nghĩa → phân loại CEFR lại
  save(); editingId = null; renderTable(); renderStats();
  toast(t('toastUpdated', w.word));
  if(w.kind === 'đơn' && !w.ipa) fetchPhonetics(w).then(ok => { if(ok) renderTable(); });
}
const lvRank = w => !w.stats.seen ? 0 : (w.stats.interval||0) < 3 ? 1 : (w.stats.interval||0) < 14 ? 2 : 3;

/* Ước lượng ngày ôn lại theo lịch SRS (w.stats.due), tính theo ngày lịch */
const dayStart = ts => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
function dueInfo(w){
  if(!w.stats.seen) return { days: -2, kind: 'new' };
  let due = w.stats.due;
  if(isLimitedToday(w)) due = Math.max(due, dayStart(now()) + DAY);       // đã bỏ qua hôm nay → sớm nhất ngày mai
  if(due <= now()) return { days: -1, kind: 'now', due };
  return { days: Math.round((dayStart(due) - dayStart(now())) / DAY), kind: isLimitedToday(w) ? 'skip' : '', due };
}
function dueCell(w){
  const d = dueInfo(w);
  if(d.kind === 'new') return `<span class="due-tag new" title="${esc(t('dueNewTitle'))}">${t('dueNew')}</span>`;
  if(d.kind === 'now') return `<span class="due-tag now">${t('dueNow')}</span>`;
  const date = new Date(d.due).toLocaleDateString(LANG === 'vi' ? 'vi-VN' : 'en-GB', { day: 'numeric', month: 'numeric', year: 'numeric' });
  const lbl = d.days <= 0 ? t('dueToday') : d.days === 1 ? t('dueTomorrow') : t('dueDays', d.days);
  return `<span class="due-tag ${d.kind || (d.days <= 1 ? 'soon' : '')}" title="${esc(d.kind === 'skip' ? t('dueSkip') : t('dueOn', date))}">${lbl}</span>`;
}
/* Bảng sổ từ vẽ dần theo từng đợt TABLE_CHUNK hàng: sổ vài trăm từ trước đây tạo hơn 15.000 phần tử
   cùng lúc → chuyển tab, cuộn, gõ tìm kiếm đều phải tính layout cho cả bảng. Giờ chỉ vẽ phần
   đang cần, cuộn gần tới cuối (hoặc bấm "Hiện thêm") mới nạp tiếp. */
const TABLE_CHUNK = 60;
let tableLimit = TABLE_CHUNK, tableList = [], tableIO = null;
function renderTable(reset){
  if(reset === true) tableLimit = TABLE_CHUNK;            // lọc / tìm / sắp xếp / mở tab → về đợt đầu
  const tb = $('#wordTbody');
  let list = visibleWords();
  if(sortBy){
    const key = {
      word: w => w.word.toLowerCase(),
      kind: w => w.kind,
      acc:  w => w.stats.seen ? accuracy(w) : -1,
      due:  w => dueInfo(w).days,
      lv:   w => lvRank(w),
    }[sortBy];
    list = [...list].sort((a,b) => {
      const ka = key(a), kb = key(b);
      return (ka < kb ? -1 : ka > kb ? 1 : 0) * sortDir;
    });
  }
  groupFilter.fill();
  wordSel.setShown(list.map(w => w.id));
  $('#groupList').innerHTML = groupsOf().map(g => `<option value="${esc(g)}">`).join('');
  $$('th.sortable').forEach(th => {
    th.classList.toggle('sorted', th.dataset.sort === sortBy);
    th.querySelector('.arrow').textContent =
      th.dataset.sort === sortBy ? (sortDir > 0 ? '▲' : '▼') : '';
  });
  if(!list.length){
    tb.innerHTML = `<tr><td colspan="8"><div class="empty">${I('leaf')}<br>${t('emptyWords')}</div></td></tr>`;
    wordSel.sync();
    return;
  }
  tableList = list;
  const editIdx = editingId != null ? list.findIndex(w => w.id === editingId) : -1;
  const n = Math.min(list.length, Math.max(tableLimit, editIdx + 1));
  tableLimit = Math.max(TABLE_CHUNK, n);
  tb.innerHTML = list.slice(0, n).map(tableRowHtml).join('') + tableMoreHtml(n);
  wordSel.sync();
  watchTableMore();
}
function tableMoreHtml(n){
  const left = tableList.length - n;
  return left > 0 ? `<tr class="more-row"><td colspan="8"><button class="btn ghost sm" data-more="1">${t('tableMore', left)}</button></td></tr>` : '';
}
function appendTableRows(){
  const tb = $('#wordTbody'), more = tb.querySelector('.more-row'); if(!more) return;
  const from = tb.querySelectorAll('tr[data-id]').length, to = Math.min(tableList.length, from + TABLE_CHUNK);
  more.insertAdjacentHTML('beforebegin', tableList.slice(from, to).map(tableRowHtml).join(''));
  more.remove();
  tableLimit = Math.max(tableLimit, to);
  if(to < tableList.length) tb.insertAdjacentHTML('beforeend', tableMoreHtml(to));
  wordSel.sync();
  watchTableMore();
}
function watchTableMore(){
  if(!('IntersectionObserver' in window)) return;          // trình duyệt cũ → vẫn còn nút "Hiện thêm"
  if(!tableIO) tableIO = new IntersectionObserver(es => { if(es.some(e => e.isIntersecting)) appendTableRows(); }, { rootMargin: '0px 0px 700px 0px' });
  tableIO.disconnect();
  const m = document.querySelector('#wordTbody .more-row');
  if(m && $('#tab-notes').classList.contains('active')) tableIO.observe(m);
}
const kindLbl = k => LANG === 'en' ? (k === 'cụm' ? 'phrase' : 'single') : k;   // chỉ đổi chữ hiển thị
const kindTagHtml = w => (w.pos || '').trim().toLowerCase() === kindLbl(w.kind) ? ''          // trùng loại từ → không lặp nhãn
  : `<span class="kind-tag ${w.kind==='đơn'?'kind-don':'kind-cum'}">${kindLbl(w.kind)}</span>`;
function tableRowHtml(w){
    const acc = w.stats.seen ? Math.round(accuracy(w)*100) : null;
    if(w.id === editingId){
      return `<tr class="edit-row" data-id="${w.id}"><td colspan="8">
        <div class="edit-grid">
          <label>${t('editWordLbl')}<input id="eWord" value="${esc(w.word)}"></label>
          <label>${t('nPosLbl')}<input id="ePos" value="${esc(w.pos)}"></label>
          <label>${t('nMeaningLbl')}<input id="eMeaning" value="${esc(w.meaning)}"></label>
          <label>${t('nSentenceLbl')}<input id="eSentence" value="${esc(w.sentence)}"></label>
          <label>${t('nNoteLbl')}<input id="eNote" value="${esc(w.note)}"></label>
          <label>${t('thKind')}<select id="eKind" class="themed">
            <option value="đơn" ${w.kind==='đơn'?'selected':''}>đơn</option>
            <option value="cụm" ${w.kind==='cụm'?'selected':''}>cụm</option></select></label>
          <label>${t('nGroupLbl')}<input id="eGroup" value="${esc(w.group)}" list="groupList"></label>
          <span class="edit-actions">
            <button class="btn mint sm" data-act="saveEdit" data-id="${w.id}">${I('check')}${t('save')}</button>
            <button class="btn ghost sm" data-act="cancelEdit" data-id="${w.id}">${t('cancel')}</button>
            ${tkInfo([t('editHelp')])}
          </span>
        </div>
      </td></tr>`;
    }
    return `<tr data-id="${w.id}">
      ${wordSel.cell(w.id)}
      <td class="c-star"><button class="star-btn ${w.saved?'on':''}" data-act="star" data-id="${w.id}" title="${t('saveToLearning')}">${I('star')}</button></td>
      <td class="c-word"><div class="wcell">
        <button class="speak-btn sm" data-act="say" data-id="${w.id}" title="${t('listenTitle')}">${I('sound')}</button>
        <div class="wtxt"><span class="w">${esc(w.word)}</span>
          ${w.kind === 'đơn' && w.ipa ? `<span class="tb-ipa">${esc(w.ipa)}</span>` : ''}
          <span class="wtags">${w.pos?`<span class="pos-tag">${esc(w.pos)}</span>`:''}${kindTagHtml(w)}</span></div>
      </div></td>
      <td class="c-mean"><div class="m-main">${esc(w.meaning)}</div>${w.sentence ? `<div class="m-ex">${highlightHtml(w)}</div>` : ''}${w.note ? `<div class="m-note">${I('pin')}<span>${esc(w.note)}</span></div>` : ''}</td>
      <td class="c-acc">${acc===null
            ? '<span class="muted">—</span>'
            : `<span class="acc" title="${esc(t('accTitle', w.stats.correct, w.stats.seen))}"><span class="acc-bar"><span class="acc-fill ${acc < 50 ? 'lo' : acc < 80 ? 'mid' : ''}" style="width:${acc}%"></span></span><b>${acc}%</b></span>`}
      </td>
      <td class="c-due">${dueCell(w)}</td>
      <td class="c-lv">${lvBadge(w)}${cefrBadge(w)}</td>
      <td class="c-act">
        <button class="icon-btn" data-act="edit" data-id="${w.id}" title="${t('edit')}">${I('edit')}</button>
        <button class="icon-btn" data-act="del" data-id="${w.id}" title="${t('delete')}">${I('trash')}</button></td>
    </tr>`;
}
$('#wordTbody').addEventListener('click', e => { if(e.target.closest('[data-more]')) appendTableRows(); });
/* Điện thoại: form "Thêm từ mới" thu gọn thành 1 thanh để sổ từ hiện ngay màn đầu; sổ trống thì mở sẵn */
function addPanelSet(open){
  $('#addPanel').classList.toggle('open', open);
  $('#addPanelTitle').setAttribute('aria-expanded', String(open));
}
$('#addPanelTitle').addEventListener('click', () => {
  if(!matchMedia('(max-width:640px)').matches) return;
  const open = !$('#addPanel').classList.contains('open');
  addPanelSet(open);
  if(open) setTimeout(() => $('#fWord').focus(), 50);
});
let searchT = null;                       // gõ liên tục → chỉ vẽ lại bảng khi ngừng gõ ~120ms
$('#search').addEventListener('input', () => { clearTimeout(searchT); searchT = setTimeout(() => renderTable(true), 120); });
/* Menu "⋯" của thanh công cụ sổ từ: gom các chức năng ít dùng */
const tbMenu = $('#tbMenu'), tbMoreBtn = $('#tbMoreBtn');
function tbMenuSet(open){ tbMenu.hidden = !open; tbMoreBtn.setAttribute('aria-expanded', String(open)); tbMoreBtn.classList.toggle('on', open); }
tbMoreBtn.addEventListener('click', e => { e.stopPropagation(); tbMenuSet(tbMenu.hidden); });
tbMenu.addEventListener('click', e => { if(e.target.closest('.tb-item')) tbMenuSet(false); });
document.addEventListener('click', e => { if(!tbMenu.hidden && !e.target.closest('#tbMore')) tbMenuSet(false); });
document.addEventListener('keydown', e => { if(e.key === 'Escape' && !tbMenu.hidden) tbMenuSet(false); });
$('#btnBulkGroup2').addEventListener('click', () => $('#btnBulkGroup').click());
$('#btnBulkGroup').addEventListener('click', () => {
  const list = wordSel.sel.size ? words.filter(w => wordSel.sel.has(w.id)) : visibleWords();
  if(!list.length){ toast(t('toastNoneShown')); return; }
  const g = prompt(t('bulkGroupPrompt', list.length), '');
  if(g === null) return;
  list.forEach(w => w.group = g.trim());
  save(); renderTable();
  toast(g.trim() ? t('toastGroupSet', list.length, g.trim()) : t('toastGroupCleared', list.length));
});
$('#wordTbody').addEventListener('keydown', e => {
  if(!e.target.closest('.edit-row')) return;
  if(e.key === 'Enter'){
    e.preventDefault();
    const w = words.find(x => x.id === editingId);
    if(w) saveEdit(w);
  }else if(e.key === 'Escape'){
    editingId = null; renderTable();
  }
});
document.querySelector('thead').addEventListener('click', e => {
  const th = e.target.closest('th.sortable'); if(!th) return;
  if(sortBy === th.dataset.sort) {
    if(sortDir === 1) sortDir = -1;
    else { sortBy = null; sortDir = 1; }        // bấm lần 3: về thứ tự gốc
  } else { sortBy = th.dataset.sort; sortDir = 1; }
  renderTable(true);
});

$('#wordTbody').addEventListener('click', e=>{
  ['pointerover','touchstart'].forEach(ev => $('#wordTbody').addEventListener(ev, e => {
    const b = e.target.closest('[data-act="say"]'); if(!b) return;
    const w = words.find(x => x.id === b.dataset.id);
    if(w) preloadWordAudio(w);
  }, {passive:true}));
  const b = e.target.closest('button'); if(!b) return;
  const w = words.find(x=>x.id===b.dataset.id); if(!w) return;
  if(b.dataset.act==='saveEdit'){
    saveEdit(w);
  }else if(b.dataset.act==='cancelEdit'){
    editingId = null; renderTable();
  }else if(b.dataset.act==='edit'){
    editingId = w.id; renderTable();
    const f = $('#eWord'); if(f){ f.focus(); f.select(); }
  }else if(b.dataset.act==='editSave'){
    saveEdit(w);
  }else if(b.dataset.act==='editCancel'){
    editingId = null; renderTable();
  }else if(b.dataset.act==='say'){
    speakWord(w);
  }else if(b.dataset.act==='star'){
    w.saved = !w.saved; save(); renderTable(); renderStats();
    toast(w.saved ? t('toastLearning', w.word) : t('toastUnstarred', w.word));
  }else if(b.dataset.act==='del'){
    if(confirm(t('confirmDelete', w.word))){
      words = words.filter(x=>x.id!==w.id);
      wordSel.sel.delete(w.id);
      save(); renderTable(); renderStats();
      toast(t('toastDeleted', w.word));
    }
  }
});

/* ── Nhập / xuất file note ───────────────────────────────── */
$('#btnImport').addEventListener('click', ()=>$('#fileInput').click());
$('#fileInput').addEventListener('change', e=>{
  const f = e.target.files[0]; if(!f) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    const { entries, skipped } = parseNoteText(reader.result, words);
    words.push(...entries);
    save(); renderTable(); renderStats();
    toast(t('toastImportDone', entries.length, skipped));
    e.target.value = '';
  };
  reader.readAsText(f, 'utf-8');
});

$('#btnExport').addEventListener('click', ()=>{
  if(!words.length){ toast(t('toastEmptyBook')); return; }
  const header = '# Sổ Ngữ — file note (từ | loại từ | nghĩa | đặt câu | chú thích | đơn/cụm | nhóm)\n';
  const body = words.map(w =>
    [w.word, w.pos, w.meaning, w.sentence, w.note, w.kind, w.group || ''].join(' | ')).join('\n');
  const blob = new Blob([header + body + '\n'], {type:'text/plain;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'notes.txt';
  a.click();
  URL.revokeObjectURL(a.href);
  toast(t('toastExported'));
});
