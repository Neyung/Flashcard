/* ═══════════════════════════════════════════════════════════
   TAB LUYỆN GÕ
   ═══════════════════════════════════════════════════════════ */
let quiz = null;          // {w, mode, startAt, hintLevel(0-2), typed[], pickedIdx[]}
let quizStreak = 0;

function fillGroupSelect(sel){
  const keep = sel.value;
  sel.innerHTML = `<option value="">${t('nAllGroups')}</option>`
    + groupsOf().map(g => `<option value="${esc(g)}">${esc(g)}</option>`).join('');
  sel.value = [...sel.options].some(o => o.value === keep) ? keep : '';
}
/* ── Bộ lọc nhóm nhiều lựa chọn (tick từng nhóm + "Tất cả") ── */
const NO_GROUP = '__none__';
let quizGroupAll = true;                 // true = tất cả nhóm
let quizGroupSet = new Set();            // khi quizGroupAll=false: các nhóm đã tick
let groupDebounce = null;
const wordGroupKey = w => w.group || NO_GROUP;
function quizGroupKeys(){
  const keys = groupsOf();
  if(keys.length && words.some(w => !w.group)) keys.push(NO_GROUP);
  return keys;
}
const quizGroupOk = w => quizGroupAll || quizGroupSet.has(wordGroupKey(w));
function quizGroupLabel(){
  if(quizGroupAll) return t('qAllGroups');
  const n = quizGroupSet.size;
  if(n === 0) return t('qGroupsNone');
  if(n === 1){ const k = [...quizGroupSet][0]; return k === NO_GROUP ? t('optNoGroup') : k; }
  return t('qGroupsN', n);
}
function syncGroupMenu(){
  $$('#quizGroupMenu input[type=checkbox]').forEach(cb => {
    cb.checked = cb.hasAttribute('data-all') ? quizGroupAll : (quizGroupAll || quizGroupSet.has(cb.dataset.k));
  });
  const allCb = $('#quizGroupMenu input[data-all]');
  if(allCb) allCb.indeterminate = !quizGroupAll && quizGroupSet.size > 0;
  $('#quizGroupText').textContent = quizGroupLabel();
  $('#quizGroupText').title = quizGroupLabel();
}
function fillQuizGroups(){
  toggleGroupMenu(false);
  const keys = quizGroupKeys();
  if(!quizGroupAll) quizGroupSet = new Set([...quizGroupSet].filter(k => keys.includes(k)));
  const cnt = {}; words.forEach(w => { const k = wordGroupKey(w); cnt[k] = (cnt[k] || 0) + 1; });
  const opt = (attr, label, n, cls) =>
    `<label class="gsel-opt ${cls}"><input type="checkbox" ${attr}><span>${esc(label)}</span><span class="n">${n}</span></label>`;
  $('#quizGroupMenu').innerHTML = opt('data-all', t('qAllGroups'), words.length, 'all')
    + keys.map(k => opt(`data-k="${esc(k)}"`, k === NO_GROUP ? t('optNoGroup') : k, cnt[k] || 0, '')).join('');
  syncGroupMenu();
}
function toggleGroupMenu(force){
  const menu = $('#quizGroupMenu'), sel = $('#quizGroupSel'); if(!menu || !sel) return;
  const open = force !== undefined ? force : menu.hidden;
  menu.hidden = !open; sel.classList.toggle('open', open);
  $('#quizGroupBtn').setAttribute('aria-expanded', String(open));
}
$('#quizGroupBtn').addEventListener('click', e => { e.stopPropagation(); toggleGroupMenu(); });
document.addEventListener('click', e => { if(!e.target.closest('#quizGroupSel')) toggleGroupMenu(false); });
document.addEventListener('keydown', e => { if(e.key === 'Escape') toggleGroupMenu(false); });
$('#quizGroupMenu').addEventListener('change', e => {
  const cb = e.target.closest('input[type=checkbox]'); if(!cb) return;
  const keys = quizGroupKeys();
  if(cb.hasAttribute('data-all')){
    quizGroupAll = cb.checked; quizGroupSet = new Set();
  }else{
    if(quizGroupAll){ quizGroupAll = false; quizGroupSet = new Set(keys); }   // đang "tất cả" → bỏ tick 1 nhóm
    cb.checked ? quizGroupSet.add(cb.dataset.k) : quizGroupSet.delete(cb.dataset.k);
    if(keys.length && keys.every(k => quizGroupSet.has(k))){ quizGroupAll = true; quizGroupSet = new Set(); }
  }
  syncGroupMenu();
  clearTimeout(groupDebounce); groupDebounce = setTimeout(startQuiz, 300);   // tick liên tiếp chỉ làm lại 1 lần
});

function quizPool(){
  const savedOnly = $('#quizSavedOnly').checked;
  return words.filter(w => (!savedOnly || w.saved) && quizGroupOk(w));
}

/* Chế độ trả lời nhớ riêng cho từ đơn (Alphabet/Type) và cụm (Arrange words/Type) */
const modeKey = kind => kind === 'đơn' ? 'soTuSingleMode_v1' : 'soTuPhraseMode_v1';
const quizSpeakerOn = () => true;
