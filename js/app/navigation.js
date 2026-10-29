/* ═══════════════════════════════════════════════════════════
   TABS + NGÔN NGỮ + STATS
   ═══════════════════════════════════════════════════════════ */
function activateTab(btn){
  if(!btn) return;
  $$('.tab-btn').forEach(x=>x.classList.toggle('active', x===btn));
  $$('.tab-page').forEach(p=>p.classList.toggle('active', p.id==='tab-'+btn.dataset.tab));
  queueInfoLayout();
  const tab = btn.dataset.tab;
  if(tab==='quiz'){ fillQuizGroups(); startQuiz(); }
  if(tab==='flash'){ fcGroupFilter.fill(); startFc(); }
  if(tab==='notes'){ if(words && !words.length) addPanelSet(true); renderTable(true); cefrClassify(false); }
  if(tab==='focus'){ renderFocus(); renderGarden(); }
  if(tab==='topic') renderTopic();
  if(tab==='tasks') renderTasks(); else recAbort();
}
$$('.tab-btn').forEach(b=>b.addEventListener('click', ()=>activateTab(b)));


function refreshCurrentView(){
  const activeTab = $('.tab-btn.active'); if(!activeTab) return;
  const tab = activeTab.dataset.tab;
  if(tab==='notes') renderTable();
  else if(tab==='quiz'){ fillQuizGroups(); if(quiz) renderQuiz(); else startQuiz(); }
  else if(tab==='flash'){ fcGroupFilter.fill(); if(fc) renderFc(); else startFc(); }
  else if(tab==='tasks') renderTasks();
  else if(tab==='focus'){ renderFocus(); renderGarden(); }
  else if(tab==='topic') renderTopic(true);
}
function setLang(l){
  LANG = l;
  try{ localStorage.setItem('soTuLang_v1', l); }catch(e){}
  applyI18n();
  if($('#loginOverlay').style.display !== 'none' && currentLoginStep) currentLoginStep();
  else refreshCurrentView();
}
/* Điện thoại: menu tài khoản gom ngôn ngữ / lịch sử viết / đổi người dùng */
const hdrPanel = $('#hdrMenuPanel'), hdrBtn = $('#hdrMenuBtn');
function hdrMenuSet(open){
  hdrPanel.hidden = !open; hdrBtn.setAttribute('aria-expanded', String(open)); hdrBtn.classList.toggle('on', open);
  if(open){
    $('#hdrMenuName').textContent = currentUser || '';
    $$('#hdrMenuPanel .hdr-menu-lang button').forEach(b => b.classList.toggle('on', b.dataset.lang === LANG));
  }
}
hdrBtn.addEventListener('click', e => { e.stopPropagation(); hdrMenuSet(hdrPanel.hidden); });
hdrPanel.addEventListener('click', e => {
  const l = e.target.closest('[data-lang]');
  if(l){ if(l.dataset.lang !== LANG) setLang(l.dataset.lang); hdrMenuSet(true); return; }
  if(e.target.closest('#hdrHist')){ hdrMenuSet(false); $('#histBtn').click(); }
  else if(e.target.closest('#hdrSwitch')){ hdrMenuSet(false); $('#userChip').click(); }
});
document.addEventListener('click', e => { if(!hdrPanel.hidden && !e.target.closest('#hdrMenu')) hdrMenuSet(false); });
document.addEventListener('keydown', e => { if(e.key === 'Escape' && !hdrPanel.hidden) hdrMenuSet(false); });
$('#langSwitch').addEventListener('click', e=>{
  const b = e.target.closest('button'); if(!b) return;
  if(b.dataset.lang === LANG) return;
  setLang(b.dataset.lang);
});

function renderStats(){
  const due = words.filter(w => w.stats.seen > 0 && w.stats.due <= now()).length;
  $('#stTotal').textContent = words.length;
  $('#stSaved').textContent = words.filter(w => w.saved).length;
  $('#stDue').textContent = due;
  const b = $('#dueBadge');
  b.style.display = due ? '' : 'none';
  b.textContent = due > 99 ? '99+' : due;
}
