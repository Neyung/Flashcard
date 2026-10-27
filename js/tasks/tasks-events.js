/* ── Màn chuyển tiếp giữa các nhiệm vụ ── */
function renderTkTrans(area){
  const k = tkTrans, nk = nextTaskKey();
  if(!k || !nk){ tkView = 'overview'; return renderTasks(); }
  area.innerHTML = `
    <div class="panel tk-trans">
      <div class="tk-trans-badge" style="background:${TASK_META[k].color}">${I('check')}</div>
      <div class="tk-eyebrow">${t('tkStepOf', TASK_KEYS.indexOf(k) + 1)}</div>
      <h2 class="tk-title sm">${t('tkTransDone', tkName(k))}</h2>
      <p class="tk-sub">${esc(taskSummaryLine(k))}</p>
      <div class="tk-progress"><div class="tk-progress-fill" style="width:${tasksOverallPct()}%"></div></div>
      <div class="tk-trans-next">
        <span class="tk-ico" style="background:${TASK_META[nk].color}">${I(TASK_META[nk].icon)}</span>
        <div><div class="tk-eyebrow">${t('tkTransNext')}</div><b>${TASK_KEYS.indexOf(nk) + 1}. ${tkName(nk)}</b><div class="tk-note">${t('tkDesc_' + nk, focusGoalMin())}</div></div>
      </div>
      <div class="tk-actions">
        <button class="btn ghost" data-tk="overview">${I('back')}${t('tkBack')}</button>
        <button class="btn primary" data-tk="start" id="tkTransGo">${t('tkContinue')}${I('next')}</button>
      </div>
    </div>`;
  const go = $('#tkTransGo'); if(go) go.focus();
}

/* ── Màn hoàn thành cả ngày ── */
function tkDayBadge(big){
  const d = new Date();
  const mon = LANG === 'vi' ? 'Th' + (d.getMonth() + 1) : d.toLocaleDateString('en-US', { month: 'short' });
  return `<span class="tk-daybadge ${big ? 'big' : ''}"><svg class="ic tk-daybadge-fl"><use href="#i-blossom"/></svg>
    <span class="tk-daybadge-d"><b>${d.getDate()}</b><small>${esc(mon)}</small></span></span>`;
}
function renderTkDone(area){
  const s = (taskHist[tasks.date] && taskHist[tasks.date].sum) || taskSummaryData();
  const anim = tkAnimDone; tkAnimDone = false;
  const petals = anim ? Array.from({ length: 16 }, (_, i) => {
    const c = ['var(--pink)','var(--lemon)','var(--lav)','var(--peach)'][i % 4];
    return `<span class="tk-petal" style="left:${4 + Math.random() * 92}%;background:${c};--dx:${(Math.random() * 120 - 60).toFixed(0)}px;
      animation-duration:${(3.2 + Math.random() * 2.4).toFixed(2)}s;animation-delay:${(Math.random() * 1.6).toFixed(2)}s"></span>`;
  }).join('') : '';
  const stat = (icon, val, lbl) => `<div class="tk-stat"><span class="tk-stat-ic">${I(icon)}</span><b>${val}</b><span>${lbl}</span></div>`;
  area.innerHTML = `
    <div class="panel tk-done ${anim ? 'anim' : ''}">
      ${petals}
      <div class="tk-glow"></div>
      ${tkDayBadge(true)}
      <h2 class="tk-title">${t('tkAllDoneTitle')}</h2>
      <p class="tk-sub">${t('tkAllDoneSub', 5)}</p>
      <div class="tk-stats">
        ${stat('flower', s.focusMin + ' ' + t('tkMin'), t('tkStatFocus'))}
        ${stat('mic', s.pron + (s.pronAvg ? ' · ' + s.pronAvg + '/100' : ''), t('tkStatPron', s.pronSkip))}
        ${stat('headphones', s.listenFirst + '/' + s.listen, t('tkStatListen'))}
        ${stat('puzzle', s.context, t('tkStatContext', s.contextChecks))}
        ${stat('edit', s.write, t('tkStatWrite', s.writeChecks))}
      </div>
      <div class="tk-alert good">${I('blossom')}<span>${tasks.flowerAdded === 0 ? t('tkFlowerAlready') : t('tkFlowerAdded')}</span></div>
      <div class="tk-actions">
        <button class="btn ghost" data-tk="overview">${I('back')}${t('tkBack')}</button>
        <button class="btn mint" data-tk="goGarden">${I('flower')}${t('tkGoGarden')}</button>
      </div>
    </div>`;
}

/* ── Sự kiện (uỷ quyền trên khung tab) ── */
$('#tasksArea').addEventListener('click', e => {
  const el = e.target.closest('[data-tk]');
  if(ctxPop >= 0 && tkView === 'context' && !e.target.closest('.tk-pop') && !(el && /^ctx(Slot|Chip|Pick|Remove)$/.test(el.dataset.tk))){
    ctxPop = -1; if(!el){ renderTasks(); return; }        // nhấn ra ngoài → đóng bảng chọn từ
  }
  if(!el) return;
  const a = el.dataset.tk;
  if(a === 'info') return;                 // nút "!" xử lý chung ở document
  if(a === 'open') tkOpen(el.dataset.k);
  else if(a === 'result'){ tkView = 'done'; renderTasks(); }
  else if(a === 'start') tkOpen('start');
  else if(a === 'overview'){ recAbort(); stopSpeech(); tkView = 'overview'; renderTasks(); }
  else if(a === 'mode'){
    const m = el.dataset.m; if(!TASK_MODES[m] || tasks.modeSet) return;
    tkModePick = m; renderTasks();
  }
  else if(a === 'modeLock'){
    const m = tkModePick; if(!TASK_MODES[m] || tasks.modeSet) return;
    tasks.mode = m; tasks.modeSet = true; tasks.modeAt = now(); taskModePref = m; tkModePick = null;
    toast(t('tkModeLockedToast', t('tkMode_' + m)));
    if(checkFocusTask()) toast(t('tkFocusDoneToast', focusGoalMin()));
    saveTasks(true); renderTasks();
  }
  else if(a === 'goFocus' || a === 'goGarden') activateTab($('.tab-btn[data-tab="focus"]'));
  else if(a === 'goNotes') activateTab($('.tab-btn[data-tab="notes"]'));
  else if(a === 'prRec') pronRecord();
  else if(a === 'prStop') recStop();
  else if(a === 'prSample'){ const it = pronItem(); if(it) (it.stage === 'sent' ? speakTTS(it.sentence) : tkSpeak(it)); }
  else if(a === 'prPlay'){ if(pr && pr.url){ stopSpeech(); new Audio(pr.url).play().catch(() => {}); } }
  else if(a === 'prInstall'){
    pr.phase = 'installing'; pr.err = ''; renderTasks();
    srInstallLocal().then(ok => {
      if(tkView !== 'pron') return;
      pr.phase = 'idle';
      if(ok){ srUseLocal = true; pr.err = 'switchedLocal'; } else pr.err = 'installFail';
      renderTasks();
    });
  }
  else if(a === 'prSkip'){ const it = pronItem(); if(it){ recAbort(); pronAdvance(it, true); } }
  else if(a === 'lsPlay'){ const x = tasks.t.listen; tkSpeak(x.items[x.idx]); const i = $('#lsInput'); if(i) i.focus(); }
  else if(a === 'lsCheck') listenCheck();
  else if(a === 'lsHint') listenHint();
  else if(a === 'lsDontKnow') listenDontKnow();
  else if(a === 'ctxChip'){
    const from = el.dataset.from;
    if(from !== undefined){                       // chạm chữ trong ô → thay bằng từ đang chọn / mở bảng chọn
      if(ctxSel >= 0) ctxPlace(ctxSel, +from); else { ctxPop = ctxPop === +from ? -1 : +from; renderTasks(); }
      return;
    }
    const bi = +el.dataset.b; ctxSel = ctxSel === bi ? -1 : bi; renderTasks();
  }
  else if(a === 'ctxSlot'){
    const s = +el.dataset.s;
    if(ctxSel >= 0) ctxPlace(ctxSel, s);
    else if(tasks.t.context.res[s] !== 1){ ctxPop = ctxPop === s ? -1 : s; renderTasks(); }
  }
  else if(a === 'ctxPick') ctxPlace(+el.dataset.b, +el.dataset.s);
  else if(a === 'ctxRemove') ctxUnplace(+el.dataset.s);
  else if(a === 'ctxCheck') ctxCheck();
  else if(a === 'wrCheck') writeCheck();
  else if(a === 'wrAi') writeAi();
  else if(a === 'wrJump'){
    const box = $('#wrBox'); if(!box) return;
    const o = +el.dataset.o, l = +el.dataset.l;
    box.focus(); box.setSelectionRange(o, Math.min(box.value.length, o + l));
  }
});
/* Kéo thả (chuột/bút); trên cảm ứng dùng chạm-để-chọn ở trên */
$('#tasksArea').addEventListener('dragstart', e => {
  const c = e.target.closest('.tk-wchip[draggable="true"]'); if(!c) return;
  e.dataTransfer.setData('text/plain', c.dataset.b);
  e.dataTransfer.effectAllowed = 'move';
  c.classList.add('dragging');
});
$('#tasksArea').addEventListener('dragend', e => { const c = e.target.closest('.tk-wchip'); if(c) c.classList.remove('dragging'); });
$('#tasksArea').addEventListener('dragover', e => {
  const z = e.target.closest('.tk-slot'); if(!z) return;
  e.preventDefault(); z.classList.add('over');
});
$('#tasksArea').addEventListener('dragleave', e => { const z = e.target.closest('.tk-slot'); if(z) z.classList.remove('over'); });
$('#tasksArea').addEventListener('drop', e => {
  const z = e.target.closest('.tk-slot'); if(!z) return;
  e.preventDefault(); z.classList.remove('over');
  const bi = +e.dataTransfer.getData('text/plain');
  if(isNaN(bi)) return;
  const x = tasks.t.context;
  ctxPlace(bi, +z.dataset.s);
});
