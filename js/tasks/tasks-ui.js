/* ═════════════ GIAO DIỆN ═════════════ */
function tkDateLabel(){
  return new Date().toLocaleDateString(LANG === 'vi' ? 'vi-VN' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
const tkName = k => t('tkName_' + k, focusGoalMin());
const liveWord = it => words.find(w => w.id === it.id);
function tkSpeak(it){
  const w = liveWord(it);
  return w ? speakWord(w) : speakTTS(it.word);
}

function renderTasks(){
  const area = $('#tasksArea'); if(!area) return;
  if(!currentUser || !words){ area.innerHTML = ''; return; }
  ensureToday();
  tkLastFocusMin = Math.floor(focusTodaySec() / 60);
  if(tkView === 'done' && !tasks.completedAt) tkView = 'overview';
  if(tkView === 'overview') return renderTkOverview(area);
  if(tkView === 'trans') return renderTkTrans(area);
  if(tkView === 'done') return renderTkDone(area);
  renderTkTask(area, tkView);
}
let tkModePick = null;
const TK_MODE_ICON = { quick: 'flame', standard: 'target', deep: 'tree' };           // chế độ đang chọn (chưa chốt) trên trang tổng quan
function tkNeedMode(){
  if(!tasks || tasks.modeSet) return false;
  toast(t('tkModeFirst'));
  if(tkView !== 'overview'){ tkView = 'overview'; renderTasks(); }
  const pn = $('.tk-mode-panel');
  if(pn){ pn.scrollIntoView({ behavior: 'smooth', block: 'center' }); pn.classList.remove('nudge'); void pn.offsetWidth; pn.classList.add('nudge'); }
  return true;
}
function tkOpen(k){
  if(tkNeedMode()) return;
  recAbort(); stopSpeech();
  if(k === 'start'){ k = nextTaskKey(); if(!k){ tkView = 'done'; renderTasks(); return; } }
  ctxPop = -1; lsDraft = '';
  tkView = k; ctxSel = -1;
  pr = prFresh();
  renderTasks();
  window.scrollTo({ top: Math.max(0, $('#tabsNav').offsetTop - 10), behavior: 'smooth' });
}

/* ── Trang tổng quan ── */
function tkGoBtn(k, st){
  const lbl = t(st === 'done' ? 'tkGoReview' : st === 'active' ? 'tkGoResume' : 'tkGoStart');
  return `<button class="tk-go s-${st}" data-tk="open" data-k="${k}" title="${esc(lbl)}" aria-label="${esc(lbl + ': ' + tkName(k))}">${I(st === 'done' ? 'next' : 'play')}</button>`;
}
function tkPill(st){
  return st === 'done' ? `<span class="tk-pill done">${I('check')}${t('tkSt_done')}</span>`
    : st === 'active' ? `<span class="tk-pill active">${t('tkSt_doing')}</span>`
    : `<span class="tk-pill todo">${t('tkSt_todo')}</span>`;
}
/* Vòng hoa hướng dương + các đoạn 5 phút cho Focus */
function tkFocusRing(big){
  const sec = focusTodaySec(), g = focusGoalMin(), m = Math.floor(sec / 60);
  const pct = Math.min(100, sec / focusGoalSec() * 100);
  return `<span class="tk-fring ${big ? 'big' : ''} ${tasks.t.focus.done ? 'full' : ''}" style="--p:${pct}">
    <span class="tk-fring-in"><b>${Math.min(m, 999)}</b><small>/${g}${big ? ' ' + t('tkMin') : '′'}</small></span></span>`;
}
function tkFocusSegs(){
  const min = focusTodaySec() / 60, g = focusGoalMin();
  return `<span class="tk-fsegs">${Array.from({ length: g / 5 }, (_, i) =>
    `<span class="tk-fseg"><i style="width:${Math.max(0, Math.min(1, (min - i * 5) / 5)) * 100}%"></i></span>`).join('')}</span>`;
}
function renderTkOverview(area){
  const n = tasksDoneCount(), pct = tasksOverallPct();
  const statusLine = tasks.completedAt ? t('tkStatusDone')
    : tasks.started || n ? t('tkStatusProgress', 5 - n) : t('tkStatusNew');
  const modeBtn = m => {
    const c = TASK_MODES[m];
    return `<button class="tk-mode ${tkModePick === m ? 'on' : ''}" data-tk="mode" data-m="${m}" aria-pressed="${tkModePick === m}">
      <span class="tk-mode-name">${t('tkMode_' + m)}</span>
      <span class="tk-mode-min">${I('clock')}${t('tkModeMin_' + m)}</span>
      <span class="tk-mode-cnt">${t('tkModeCounts', m === 'quick' ? 20 : 30, c.pron, c.listen, c.context, c.write)}</span>
    </button>`;
  };
  const focusCard = () => {
    const st = taskStatus('focus'), running = !!(focus && focus.running);
    const left = Math.max(0, Math.ceil((focusGoalSec() - focusTodaySec()) / 60));
    return `<div class="tk-card tk-card-focus s-${st}" data-tk="open" data-k="focus">
      <svg class="ic tk-fdeco" aria-hidden="true"><use href="#i-flower"/></svg>
      ${tkFocusRing(false)}
      <span class="tk-body">
        <span class="tk-name">${tkName('focus')}${running ? `<span class="tk-livedot" title="${esc(t('tkFocusNow'))}"></span>` : ''}</span>
        <span class="tk-desc">${t('tkDesc_focus', focusGoalMin())}</span>
        ${tkFocusSegs()}
        <span class="tk-meta"><span>${I('clock')}${tasks.t.focus.done ? t('tkFocusReached') : running ? t('tkFocusNow') + ' · ' + t('tkFocusLeft', left) : t('tkFocusLeft', left)}</span></span>
      </span>
      ${tkPill(st)}${tkGoBtn('focus', st)}
    </div>`;
  };
  const card = (k, i) => {
    if(k === 'focus') return focusCard();
    const st = taskStatus(k), x = tasks.t[k];
    const done = x.inited ? (k === 'write' ? x.paras.filter(p => p.done).length
      : k === 'context' ? x.res.filter(r => r === 1).length : x.items.filter(it => it.done).length) : 0;
    const meta = `<span>${I('clock')}~${taskEstMin(k)} ${t('tkMin')}</span><span>${t('tkUnit_' + k, taskPlanned(k))}</span>`
      + (x.inited && !x.done && done ? `<span class="tk-meta-prog">${done}/${x.target}</span>` : '');
    return `<div class="tk-card s-${st}" data-tk="open" data-k="${k}">
      <span class="tk-num">${st === 'done' ? I('check') : i + 1}</span>
      <span class="tk-ico" style="background:${TASK_META[k].color}">${I(TASK_META[k].icon)}</span>
      <span class="tk-body">
        <span class="tk-name">${tkName(k)}</span>
        <span class="tk-desc">${t('tkDesc_' + k)}</span>
        <span class="tk-meta">${meta}</span>
      </span>
      ${tkPill(st)}${tkGoBtn(k, st)}
    </div>`;
  };
  area.innerHTML = `
    <div class="tk-hero ${tasks.completedAt ? 'is-done' : ''}">
      <div class="tk-hero-row">
        <div>
          <div class="tk-eyebrow">${I('calendar')}${esc(tkDateLabel())}</div>
          <h2 class="tk-title">${t('tkTitle')}</h2>
          <div class="tk-status">${statusLine}</div>
        </div>
        <div class="tk-count"><span class="num">${n}</span><span class="of">/5</span><span class="lbl">${t('tkDoneLbl')}</span></div>
      </div>
      <div class="tk-progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><div class="tk-progress-fill" style="width:${pct}%"></div></div>
      <div class="tk-progress-lbl"><span>${t('tkProgressLbl', n)}</span><span class="mono">${pct}%</span></div>
    </div>
    ${tasks.completedAt ? `<div class="tk-done-strip" data-tk="result">${tkDayBadge(false)}<div><b>${t('tkAllDoneTitle')}</b><br><span class="muted">${t('tkDoneStripSub')}</span></div>
      <button class="tk-go s-done" data-tk="result" title="${esc(t('tkCtaResult'))}" aria-label="${esc(t('tkCtaResult'))}">${I('next')}</button></div>` : ''}
    ${tasks.modeSet ? (() => {
      const m = tasks.mode, c = TASK_MODES[m];
      const chip = (k, txt) => `<span class="tk-ms-chip" title="${esc(tkName(k))}"><span class="tk-ms-ci" style="background:${TASK_META[k].color}">${I(TASK_META[k].icon)}</span>${txt}</span>`;
      return `<div class="panel tk-mode-panel is-set m-${m}">
        <svg class="ic tk-ms-deco" aria-hidden="true"><use href="#i-${TK_MODE_ICON[m]}"/></svg>
        <div class="tk-ms-row">
          <span class="tk-ms-badge">${I(TK_MODE_ICON[m])}</span>
          <div class="tk-ms-main">
            <span class="tk-mode-k">${t('tkModeToday')}</span>
            <span class="tk-ms-name">${t('tkMode_' + m)}<span class="tk-ms-min">${I('clock')}${t('tkModeMin_' + m)}</span></span>
          </div>
          <span class="tk-ms-lock">${I('lock')}<span>${t('tkModeLockedLbl')}<small>${t('tkModeTomorrow')}</small></span></span>
        </div>
        <div class="tk-ms-chips">
          ${chip('focus', `${m === 'quick' ? 20 : 30} ${t('tkMin')}`)}${chip('pron', t('tkUnit_pron', c.pron))}${chip('listen', t('tkUnit_listen', c.listen))}${chip('context', t('tkUnit_context', c.context))}${chip('write', t('tkUnit_write', c.write))}
        </div>
        ${infoCorner([t('tkModeNote')])}
      </div>`;
    })() : `<div class="panel tk-mode-panel is-pick">
      <div class="panel-title"><span class="dot" style="background:var(--sky)"></span>${t('tkModePickTitle')}</div>
      <p class="tk-mode-sub">${I('lock')}${t('tkModeOnce')}</p>
      <div class="tk-modes">${TASK_MODE_KEYS.map(modeBtn).join('')}</div>
      <div class="tk-mode-act">
        <button class="btn primary" data-tk="modeLock" ${tkModePick ? '' : 'disabled'}>${I('lock')}${tkModePick ? t('tkModeLockBtn', t('tkMode_' + tkModePick)) : t('tkModePickFirst')}</button>
      </div>
      ${infoCorner([t('tkModeNote')])}
    </div>`}
    <div class="tk-list ${tasks.modeSet ? '' : 'is-waiting'}">${TASK_KEYS.map(card).join('')}</div>`;
}

/* Thông báo phụ gom vào nút "!" — nhấn để xem */
let tkInfos = [];
function tkInfo(msgs, align){          // align: '' (mở sang trái) | 'left' | 'center'
  msgs = (msgs || []).filter(Boolean);
  if(!msgs.length) return '';
  return `<span class="tk-info-wrap ${align || ''}"><button class="tk-info" data-tk="info" aria-expanded="false" title="${esc(t('tkInfoLbl'))}" aria-label="${esc(t('tkInfoLbl'))}">!</button>
    <span class="tk-info-pop" hidden>${msgs.map(m => `<span class="tk-info-li">${I('bulb')}<span>${m}</span></span>`).join('')}</span></span>`;
}
/* Nút "!" đặt ở góc dưới bên phải của khu vực; nếu góc đó đã có phần tử khác thì
   chuyển lên góc trên bên phải; cả hai góc đều vướng thì xuống một hàng riêng. */
const infoCorner = (msgs) => { const h = tkInfo(msgs); return h ? `<div class="info-corner">${h}</div>` : ''; };
function infoCornerHits(corner){
  const cr = corner.getBoundingClientRect(), pad = 4;
  const meets = r => r.width > 0 && r.height > 0 && r.left < cr.right + pad && r.right > cr.left - pad && r.top < cr.bottom + pad && r.bottom > cr.top - pad;
  const covers = r => r.left <= cr.left && r.right >= cr.right && r.top <= cr.top && r.bottom >= cr.bottom;
  const hasBox = el => {
    const cs = getComputedStyle(el);
    return ['Top','Right','Bottom','Left'].some(k => parseFloat(cs['border' + k + 'Width']) > 0)
      || !/^(transparent|rgba\(0, 0, 0, 0\))$/.test(cs.backgroundColor) || cs.backgroundImage !== 'none';
  };
  const walk = node => {
    for(const ch of node.children){
      if(ch === corner || ch.matches('.tk-fdeco, [aria-hidden="true"], script, style, [hidden]')) continue;
      const r = ch.getBoundingClientRect();
      if(!meets(r)) continue;
      if(ch.matches('button, a[href], input, select, textarea, .btn')) return true;   // phần tử bấm được (kể cả nút trùm cả góc)
      const texts = [...ch.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim());
      if(!ch.children.length && !texts.length) return true;     // ô nhập, icon, khối trống có hình
      for(const n of texts){                                    // so đúng vùng chữ thật, không phải cả khối
        const rg = document.createRange(); rg.selectNodeContents(n);
        if([...rg.getClientRects()].some(meets)) return true;
      }
      if(!covers(r) && hasBox(ch)) return true;                 // khung có viền/nền lấn vào góc (bảng, nút…)
      if(walk(ch)) return true;
    }
    return false;
  };
  return walk(corner.parentElement);
}
function layoutInfoCorners(dirty){        // dirty: các phần tử vừa đổi (null = xếp lại tất cả)
  $$('.info-corner').forEach(c => {
    if(!c.firstElementChild) return;
    const host = c.parentElement;
    if(dirty && ![...dirty].some(el => host.contains(el) || el.contains(c))) return;   // khu vực này không đổi → giữ nguyên
    if(!c.offsetParent) return;
    c.parentElement.classList.add('has-info');
    c.classList.remove('at-top', 'inflow');
    if(!infoCornerHits(c)) return;                               // góc dưới bên phải còn trống
    c.classList.add('at-top');
    if(!infoCornerHits(c)) return;                               // góc trên bên phải còn trống
    c.classList.remove('at-top'); c.classList.add('inflow');
  });
}
/* Trước đây MỌI thay đổi DOM (gõ chữ, đồng hồ tập trung nhảy giây, toast…) đều quét lại toàn bộ
   các góc "!" bằng getBoundingClientRect → ép trình duyệt tính lại layout liên tục, gây giật.
   Giờ chỉ xếp lại góc nằm trong khu vực vừa đổi; bỏ qua các vùng nổi (toast, bảng dịch, popup)
   và các phần tử cập nhật dày đặc đã đánh dấu data-noinfo. */
let infoLayoutQueued = false, infoAll = false, infoDirty = new Set();
const INFO_SKIP = '#toast, .tk-info-pop, .tr-panel, .tr-fab, .sc-overlay, [data-noinfo]';
function queueInfoLayout(muts){
  if(Array.isArray(muts)){
    for(const m of muts){
      const el = m.target.nodeType === 1 ? m.target : m.target.parentElement;
      if(el && !el.closest(INFO_SKIP)) infoDirty.add(el);
    }
    if(!infoDirty.size) return;
  }else infoAll = true;
  if(infoLayoutQueued) return;
  infoLayoutQueued = true;
  requestAnimationFrame(() => {
    const dirty = infoAll ? null : infoDirty;
    infoLayoutQueued = false; infoAll = false; infoDirty = new Set();
    if(document.querySelector('.info-corner')) layoutInfoCorners(dirty);
  });
}
new MutationObserver(queueInfoLayout).observe(document.body, { childList: true, subtree: true });
window.addEventListener('resize', () => queueInfoLayout());
function closeTkInfos(except){
  $$('.tk-info-pop').forEach(p => {
    if(p === except || (p.hidden && !p._home)) return;
    p.hidden = true;
    const b = p._btn || p.previousElementSibling;
    if(b) b.setAttribute('aria-expanded', 'false');
    if(p._home){ if(p._home.isConnected) p._home.appendChild(p); else p.remove(); p._home = null; }   // trả bảng về chỗ cũ
  });
}
document.addEventListener('click', e => {
  const b = e.target.closest('.tk-info');
  if(b){
    e.preventDefault();
    const pop = b._pop || b.nextElementSibling, open = pop.hidden;
    closeTkInfos(pop); pop.hidden = !open; b.setAttribute('aria-expanded', String(open));
    if(open) placeInfoPop(b, pop);
    return;
  }
  if(!e.target.closest('.tk-info-wrap')) closeTkInfos();
});
/* Đặt bảng thông tin cạnh nút "!" nhưng luôn nằm trọn trong màn hình */
function placeInfoPop(b, pop){
  /* đưa bảng ra <body> để không bị khung cuộn / hiệu ứng của khối cha cắt mất */
  if(pop.parentElement !== document.body){ pop._home = pop.parentElement; b._pop = pop; pop._btn = b; document.body.appendChild(pop); }
  const r = b.getBoundingClientRect(), pw = Math.min(340, innerWidth - 16);
  Object.assign(pop.style, { position: 'fixed', width: pw + 'px', right: 'auto', transform: 'none' });
  let left = r.right - pw;
  if(left < 8) left = r.left;
  left = Math.max(8, Math.min(left, innerWidth - pw - 8));
  pop.style.left = left + 'px';
  const ph = pop.offsetHeight;
  let top = r.bottom + 8;
  if(top + ph > innerHeight - 8) top = Math.max(8, r.top - ph - 8);
  pop.style.top = top + 'px';
  infoScrollY = scrollY;
}
let infoScrollY = 0;                     // chỉ đóng khi người dùng cuộn trang thật sự
window.addEventListener('scroll', () => { if(Math.abs(scrollY - infoScrollY) > 40) closeTkInfos(); }, { passive: true });
window.addEventListener('resize', () => closeTkInfos());
document.addEventListener('keydown', e => { if(e.key === 'Escape') closeTkInfos(); });

/* ── Khung chung của một nhiệm vụ: thanh bước + tiến độ tổng ── */
function tkFrame(k, body){
  const pct = tasksOverallPct();
  const steps = TASK_KEYS.map((q, i) => {
    const st = taskStatus(q);
    return `<button class="tk-step s-${st} ${q === k ? 'here' : ''}" data-tk="open" data-k="${q}" title="${esc((i + 1) + '. ' + tkName(q))}">
      ${st === 'done' ? I('check') : I(TASK_META[q].icon)}</button>`;
  }).join('<span class="tk-step-line"></span>');
  return `
    <div class="tk-top">
      <button class="btn ghost sm" data-tk="overview">${I('back')}${t('tkBack')}</button>
      <div class="tk-steps">${steps}</div>
      <span class="tk-top-n mono">${tasksDoneCount()}/5</span>
    </div>
    <div class="tk-progress thin"><div class="tk-progress-fill" style="width:${pct}%"></div></div>
    <div class="tk-head">
      <span class="tk-ico big" style="background:${TASK_META[k].color}">${I(TASK_META[k].icon)}</span>
      <div><div class="tk-eyebrow">${t('tkStepOf', TASK_KEYS.indexOf(k) + 1)}</div>
      <h2 class="tk-title sm">${tkName(k)}</h2>
      <div class="tk-sub">${t('tkGoal_' + k, focusGoalMin())}</div></div>
    </div>
    ${body}`;
}
function tkPoolNote(x){                          // ghi chú nguồn dữ liệu → vào nút "!"
  if(!x.inited) return '';
  if(x.nFill > 0) tkInfos.push(t('tkPoolFill', x.nNew, x.nFill));
  if(x.target < x.want) tkInfos.push(t('tkPoolShort', x.target, x.want));
  return '';
}
function tkEmpty(msgKey){
  return `<div class="panel"><div class="empty">${I('leaf')}<br>${t(msgKey)}</div>
    <div class="tk-actions"><button class="btn sky" data-tk="goNotes">${I('note')}${t('tkGoNotes')}</button></div></div>`;
}
function tkItemBar(done, total, unitKey){
  return `<div class="tk-itembar"><span class="tk-itembar-lbl">${t(unitKey, done, total)}</span>
    <span class="tk-mini"><span style="width:${total ? done / total * 100 : 0}%"></span></span></div>`;
}
function renderTkTask(area, k){
  if(k !== 'focus' && !tasks.t[k].done) initTask(k);
  const x = tasks.t[k];
  tkInfos = [];
  let body;
  if(x.done && k !== 'focus') body = `<div class="panel tk-review">${I('check')}<div><b>${t('tkTaskDoneTitle')}</b><br>${esc(taskSummaryLine(k))}</div>
      <div class="tk-actions">${nextTaskKey() ? `<button class="btn primary" data-tk="start">${t('tkNextTask')}${I('next')}</button>` : ''}</div></div>`;
  else if(k === 'focus') body = tkFocusBody();
  else if(k === 'pron') body = x.inited ? tkPronBody(x) : tkEmpty('tkEmptyVocab');
  else if(k === 'listen') body = x.inited ? tkListenBody(x) : tkEmpty('tkEmptyVocab');
  else if(k === 'context') body = x.inited ? tkContextBody(x) : tkEmpty('tkEmptyContext');
  else if(k === 'write') body = x.inited ? tkWriteBody(x) : tkEmpty('tkEmptyVocab');
  area.innerHTML = tkFrame(k, body);
  const panels = area.querySelectorAll(':scope > .panel');      // "!" ở góc dưới bên phải của khung nhiệm vụ
  if(tkInfos.length) (panels.length ? panels[panels.length - 1] : area).insertAdjacentHTML('beforeend', infoCorner(tkInfos));
  if(x.done) return;
  if(k === 'listen' && x.inited) afterListenRender(x);
  if(k === 'context' && x.inited) afterContextRender(x);
  if(k === 'write' && x.inited) afterWriteRender(x);
}

/* ── 1. Focus ── */
function tkFocusBody(){
  const sec = focusTodaySec(), m = Math.floor(sec / 60), done = tasks.t.focus.done;
  const left = Math.max(0, Math.ceil((focusGoalSec() - sec) / 60));
  const running = !!(focus && focus.running);
  if(!tasks.t.focus.done) tkInfos.push(t('tkFocusNeed', focusGoalMin()));
  tkInfos.push(t('tkFocusRule'));
  return `<div class="panel tk-focus ${done ? 'is-done' : ''}">
      <svg class="ic tk-fdeco big" aria-hidden="true"><use href="#i-flower"/></svg>
      ${tkFocusRing(true)}
      ${tkFocusSegs()}
      ${done
        ? `<div class="tk-alert good">${I('check')}<span>${t('tkFocusDone', m)}</span></div>`
        : `<div class="tk-focus-stats"><span><b>${m}</b> ${t('tkFocusDoneMin')}</span><span><b>${left}</b> ${t('tkFocusLeftMin')}</span></div>
           ${running ? `<div class="tk-live">${t('tkFocusRunning')}</div>` : ''}`}
      <div class="tk-actions">
        ${done ? (nextTaskKey() ? `<button class="btn primary" data-tk="start">${t('tkNextTask')}${I('next')}</button>` : '')
               : `<button class="btn mint" data-tk="goFocus">${I('flower')}${t('tkGoFocus')}</button>`}
      </div>
    </div>`;
}

/* ── 2. Phát âm ── */
let pr = null;      // trạng thái tạm (không lưu): { phase, url, result, err }
const prFresh = () => ({ phase: 'idle', url: '', result: null, err: '', busy: false });
function tkPronBody(x){
  if(!pr) pr = prFresh();
  const doneN = x.items.filter(i => i.done).length;
  if(x.idx >= x.items.length || x.items[x.idx].done) x.idx = Math.max(0, x.items.findIndex(i => !i.done));
  const it = x.items[x.idx];
  const sent = it.stage === 'sent';
  const tries = sent ? it.sa : it.wa;
  const pass = sent ? PRON_SENT_PASS : PRON_WORD_PASS;
  const fails = tries.filter(s => s <= pass).length;
  const canSkip = fails >= PRON_SKIP_AFTER || ['unsupported','denied','nomic','service','network','installFail'].includes(pr.err) || !SRClass;
  let target;
  if(sent){
    const ms = findTarget(it.sentence, it.word);
    let html = '', pos = 0;
    ms.forEach(m => { html += esc(it.sentence.slice(pos, m.index)) + '<mark>' + esc(m[0]) + '</mark>'; pos = m.index + m[0].length; });
    html += esc(it.sentence.slice(pos));
    target = `<div class="tk-pr-sent">${html}</div>`;
  }else{
    target = `<div class="tk-pr-word">${esc(it.word)}</div>
      ${it.ipa ? `<div class="tk-pr-ipa mono">${esc(it.ipa)}</div>` : ''}
      <div class="tk-pr-mean">${esc(it.meaning)}${it.pos ? ` · <span class="pos-tag">${esc(it.pos)}</span>` : ''}</div>`;
  }
  const r = pr.result;
  let result = '';
  if(pr.phase === 'loadingSent') result = `<div class="tk-loading"><span class="tk-spin"></span>${t('tkPrFindingSent')}</div>`;
  else if(pr.phase === 'analyzing') result = `<div class="tk-loading"><span class="tk-spin"></span>${t('tkPrAnalyzing')}</div>`;
  else if(pr.phase === 'installing') result = `<div class="tk-loading"><span class="tk-spin"></span>${t('tkPrInstalling')}</div>`;
  else if(pr.err === 'switchedLocal') result = `<div class="tk-alert good">${I('check')}<span>${t('tkPrSwitchedLocal')}</span></div>`;
  else if(pr.err) result = `<div class="tk-alert ${pr.err === 'nospeech' ? 'warn' : 'bad'}">${I('x')}<span>${t('tkPrErr_' + pr.err)}${
      (pr.err === 'network' || pr.err === 'service') && navigator.brave ? ' ' + t('tkPrBrave') : ''}</span></div>
    ${(pr.err === 'network' || pr.err === 'service') && srLocal === 'downloadable'
      ? `<div class="tk-actions" style="margin-top:0"><button class="btn sky sm" data-tk="prInstall">${I('in')}${t('tkPrInstall')}</button></div>` : ''}`;
  else if(r){
    const ok = r.score > pass;
    let fbk = '';
    if(!sent && r.diff){
      const tg = normSpeech(it.word).replace(/ /g, '');
      const bad = r.diff.some(v => !v);
      fbk = bad ? `<div class="tk-pr-diff">${t('tkPrFocusOn')} <span class="mono">${[...tg].map((ch, i) => r.diff[i] ? esc(ch) : `<b>${esc(ch)}</b>`).join('')}</span></div>` : '';
    }else if(sent && r.marks){
      const miss = r.toks.filter((w, i) => r.marks[i] < 1);
      fbk = miss.length ? `<div class="tk-pr-diff">${t('tkPrWeakWords')} <span class="tk-pr-toks">${r.toks.map((w, i) =>
        `<span class="${r.marks[i] === 1 ? 'ok' : r.marks[i] ? 'part' : 'miss'}">${esc(w)}</span>`).join(' ')}</span></div>` : '';
    }
    result = `<div class="tk-score ${ok ? 'ok' : 'bad'}">
        <div class="tk-score-num" style="--p:${r.score}"><span>${r.score}</span></div>
        <div class="tk-score-txt"><b>${ok ? t('tkPrPass') : t('tkPrFail', pass)}</b>
          <div class="tk-heard">${t('tkPrHeard')} <span class="mono">“${esc(r.heard || '—')}”</span></div>
          ${fbk}${ok ? '' : `<div class="tk-tip">${t(sent ? 'tkPrTipSent' : 'tkPrTipWord')}</div>`}</div>
      </div>`;
  }
  const recOn = pr.phase === 'recording';
  return `
    ${tkItemBar(doneN, x.items.length, 'tkUnitProg_pron')}
    ${tkPoolNote(x)}${(tkInfos.push(t('tkPrEngine'), t(srUseLocal ? 'tkPrModeLocal' : 'tkPrModeCloud')), '')}
    ${!SRClass ? `<div class="tk-alert bad">${I('x')}<span>${t('tkPrErr_unsupported')}</span></div>` : ''}
    <div class="panel tk-pr">
      <div class="tk-pr-stage">
        <span class="tk-chip ${sent ? '' : 'on'}">1 · ${t('tkPrStageWord')}</span>
        <span class="tk-chip ${sent ? 'on' : ''}">2 · ${t('tkPrStageSent')}</span>
      </div>
      <div class="tk-pr-target">${target}</div>
      <div class="tk-pr-ctrl">
        <button class="tk-mic ${recOn ? 'rec' : ''}" data-tk="${recOn ? 'prStop' : 'prRec'}" ${pr.phase === 'analyzing' || pr.phase === 'loadingSent' || pr.busy ? 'disabled' : ''}
          aria-label="${recOn ? t('tkPrStop') : t('tkPrRecord')}">${recOn ? I('stop') : I('mic')}</button>
        <div class="tk-mic-lbl">${recOn ? t('tkPrListening') : t(sent ? 'tkPrHintSent' : 'tkPrHintWord')}</div>
      </div>
      <div class="tk-actions">
        <button class="btn sky sm" data-tk="prSample" ${recOn ? 'disabled' : ''}>${I('sound')}${t('tkPrSample')}</button>
        <button class="btn lav sm" data-tk="prPlay" ${pr.url ? '' : 'disabled'}>${I('play')}${t('tkPrPlayback')}</button>
        ${canSkip && pr.phase !== 'recording' ? `<button class="btn ghost sm" data-tk="prSkip">${I('skip')}${t('tkPrSkip')}</button>` : ''}
      </div>
      <div class="tk-pr-result">${result}</div>
      ${tries.length ? `<div class="tk-tries">${t('tkPrTries')} ${tries.map(s => `<span class="tk-try ${s > pass ? 'ok' : ''}">${s}</span>`).join('')}</div>` : ''}
    </div>`;
}
function pronItem(){ const x = tasks.t.pron; return x.items[x.idx]; }
function pronRecord(){
  const it = pronItem(); if(!it || pr.phase === 'recording') return;
  stopSpeech();
  if(pr.url){ URL.revokeObjectURL(pr.url); pr.url = ''; }
  pr.phase = 'recording'; pr.result = null; pr.err = '';
  renderTasks();
  const sent = it.stage === 'sent';
  recStart({ sentence: sent }, res => {
    if(tkView !== 'pron' || pronItem() !== it) return;
    pr.url = res.url || '';
    if(!SRClass){ pr.phase = 'idle'; pr.err = 'unsupported'; renderTasks(); return; }
    if(!res.alts || !res.alts.length){
      pr.phase = 'idle'; pr.err = res.error || 'nospeech';
      if(pr.err === 'network' || pr.err === 'service'){
        srCheckLocal().then(st => {
          if(tkView !== 'pron') return;
          if(st === 'available' && !srUseLocal){ srUseLocal = true; pr.err = 'switchedLocal'; }
          renderTasks();
        });
        return;
      }
      renderTasks(); return;
    }
    pr.phase = 'analyzing'; renderTasks();
    const r = sent ? scoreSentence(it.sentence, res.alts)
      : (/\s/.test(it.word.trim()) ? scoreSentence(it.word, res.alts) : scoreWord(it.word, res.alts));
    (sent ? it.sa : it.wa).push(r.score);
    saveTasks();
    pr.phase = 'idle'; pr.result = r; pr.err = '';
    const ok = r.score > (sent ? PRON_SENT_PASS : PRON_WORD_PASS);
    if(ok){ pr.busy = true; setTimeout(() => { if(pronItem() === it) pronAdvance(it, false); }, sent ? 1500 : 1200); }
    renderTasks();
  });
}
async function pronAdvance(it, skipped){
  const x = tasks.t.pron;
  pr = prFresh();
  if(it.stage === 'word'){
    if(skipped) it.skipW = true;
    if(!it.sentence && !it.noSent){                   // từ chưa có câu ví dụ → thử tra từ điển
      pr.phase = 'loadingSent'; renderTasks();
      const ex = await fetchExample(it.word);
      if(tkView !== 'pron' || pronItem() !== it) return;
      pr = prFresh();
      if(ex) it.sentence = ex; else it.noSent = true;
    }
    if(it.sentence){ it.stage = 'sent'; saveTasks(); renderTasks(); return; }
  }else if(skipped) it.skipS = true;
  it.done = true; it.stage = 'done';
  const next = x.items.findIndex(i => !i.done);
  saveTasks();
  if(next < 0){ completeTask('pron'); return; }
  x.idx = next; saveTasks();
  if(it.noSent) toast(t('tkPrNoSent', it.word));
  renderTasks();
}

/* ── 3. Nghe & viết lại ── */
let lsAutoplayed = '';
const normAns = s => (s || '').toLowerCase().replace(/[’‘`]/g, "'").replace(/\s+/g, ' ').trim().replace(/[.!?]+$/, '');
function tkListenBody(x){
  if(x.idx >= x.items.length || x.items[x.idx].done) x.idx = Math.max(0, x.items.findIndex(i => !i.done));
  const it = x.items[x.idx], doneN = x.items.filter(i => i.done).length, hint = it.hint || 0;
  tkPoolNote(x);
  tkInfos.push(t('tkLsInfo'));
  let hints = '';
  if(hint >= 1 && !it.revealed) hints += `<div class="tk-hint">${I('bulb')}<span>${/\s/.test(it.word.trim())
    ? t('qHintFirstWord', esc(it.word.trim().split(/\s+/)[0])) : t('qHintStart', esc(it.word.trim()[0]), it.word.replace(/ /g, '').length)}</span></div>`;
  if(hint >= 2 && !it.revealed){
    const full = it.word.trim();
    hints += `<div class="tk-hint">${I('bulb')}<span>${t('qHintHalf', esc(full.slice(0, Math.ceil(full.length / 2))), full.length)}</span></div>`;
  }
  const answer = it.revealed ? `<div class="tk-ls-answer">
      <div class="tk-eyebrow">${I('target')}${t('tkLsAnswerIs')}</div>
      <div class="tk-ls-ans-w mono">${esc(it.word)}</div>
      ${it.ipa ? `<div class="tk-pr-ipa mono">${esc(it.ipa)}</div>` : ''}
      <div class="tk-pr-mean">${esc(it.meaning)}</div>
    </div>` : '';
  return `
    ${tkItemBar(doneN, x.items.length, 'tkUnitProg_listen')}
    <div class="panel tk-ls">
      <button class="tk-play" data-tk="lsPlay" aria-label="${t('tkLsPlay')}" title="${t('tkLsReplay')}">${I('sound')}</button>
      <div class="tk-mic-lbl">${t(it.revealed ? 'tkLsTypeAgainLbl' : 'tkLsInstr')}</div>
      ${answer}
      <div class="tk-ls-form">
        <input id="lsInput" class="phrase-input" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${esc(t(it.revealed ? 'tkLsTypeAgain' : 'tkLsPh'))}">
        <div class="tk-actions">
          <button class="btn primary" data-tk="lsCheck">${I('check')}${t('tkCheck')}</button>
          <button class="btn lemon" data-tk="lsHint" ${hint >= 2 || it.revealed ? 'disabled' : ''}>${I('bulb')}${t('qHintBtn')}${hint ? ` (${hint}/2)` : ''}</button>
          <button class="btn ghost" data-tk="lsDontKnow" ${it.revealed ? 'disabled' : ''}>${I('x')}${t('tkLsDontKnow')}</button>
        </div>
      </div>
      <div class="feedback" id="lsFb"></div>
      ${hints}
      ${it.tries ? `<div class="tk-tries">${t('tkLsWrongN', it.tries)}</div>` : ''}
    </div>`;
}
let lsDraft = '';
function afterListenRender(x){
  const it = x.items[x.idx];
  const inp = $('#lsInput');
  if(inp){
    inp.value = lsDraft; lsDraft = '';
    inp.focus();
    inp.addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); listenCheck(); } });
  }
  const key = tasks.date + it.id + x.idx;
  if(lsAutoplayed !== key){ lsAutoplayed = key; setTimeout(() => { if(tkView === 'listen') tkSpeak(it); }, 350); }
}
function listenHint(){
  const x = tasks.t.listen, it = x.items[x.idx]; if(!it || it.done || it.revealed) return;
  it.hint = Math.min(2, (it.hint || 0) + 1); saveTasks();
  lsDraft = ($('#lsInput') || {}).value || '';
  renderTasks();
}
function listenDontKnow(){
  const x = tasks.t.listen, it = x.items[x.idx]; if(!it || it.done || it.revealed) return;
  it.revealed = true; saveTasks();
  lsDraft = '';
  renderTasks();
  tkSpeak(it);
}
function listenCheck(){
  const x = tasks.t.listen, it = x.items[x.idx], inp = $('#lsInput'), fb = $('#lsFb');
  if(!it || !inp || it.done) return;
  const v = normAns(inp.value);
  if(!v){ toast(t('tkLsEmpty')); inp.focus(); return; }
  if(v === normAns(it.word)){
    if(!it.tries && !it.revealed && !it.hint) it.firstTry = true;
    it.done = true; saveTasks();
    fb.className = 'feedback show good';
    fb.innerHTML = `${I('check')} ${t('tkLsCorrect')} <span class="ans">${esc(it.word)}</span> — ${esc(it.meaning)}`;
    inp.disabled = true;
    setTimeout(() => {
      if(tkView !== 'listen') return;
      const next = x.items.findIndex(i => !i.done);
      if(next < 0){ completeTask('listen'); return; }
      x.idx = next; saveTasks(); renderTasks();
    }, 1100);
  }else{
    it.tries++; saveTasks();
    lsDraft = inp.value;
    renderTasks();
    const fb2 = $('#lsFb'), inp2 = $('#lsInput');
    inp2.select();
    fb2.className = 'feedback show bad';
    fb2.innerHTML = `${I('x')} ${t('tkLsWrong')}`;
  }
}

/* ── 4. Điền từ vào câu: chạm chỗ trống để chọn từ hoặc gõ trực tiếp ── */
let ctxSel = -1;     // từ đang được chọn trong ngân hàng (chạm/nhấp)
let ctxPop = -1;     // chỗ trống đang mở bảng chọn/gõ
function tkContextBody(x){
  const n = x.items.length;
  const placed = new Set(x.slots.filter(v => v >= 0));
  const okN = x.res.filter(r => r === 1).length;
  const allFilled = x.slots.every(v => v >= 0), wrongPending = x.res.some(r => r === 2);
  if(ctxPop >= 0 && (ctxPop >= n || x.res[ctxPop] === 1)) ctxPop = -1;
  tkPoolNote(x);
  tkInfos.push(t('tkCtxInstr'), t('tkCtxPopHint'));
  const chip = (bi, where, slot) => {
    const locked = where === 'slot' && x.res[slot] === 1;
    return `<span class="tk-wchip ${ctxSel === bi && where === 'bank' ? 'sel' : ''} ${locked ? 'locked' : ''}"
      ${locked ? '' : `draggable="true" data-tk="ctxChip"`} data-b="${bi}" ${where === 'slot' ? `data-from="${slot}"` : ''}>${esc(x.items[bi].ans)}</span>`;
  };
  const bank = x.order.filter(bi => !placed.has(bi));
  const rows = x.items.map((it, i) => {
    const v = x.slots[i], r = x.res[i], open = ctxPop === i;
    const slot = `<span class="tk-slot ${v >= 0 ? 'filled' : ''} ${r === 1 ? 'ok' : r === 2 ? 'bad' : ''} ${ctxSel >= 0 && r !== 1 ? 'target' : ''} ${open ? 'open' : ''}"
      data-tk="ctxSlot" data-s="${i}" ${r === 1 ? '' : `title="${esc(t('tkCtxSlotTitle'))}"`}>${v >= 0 ? chip(v, 'slot', i) : `<span class="tk-slot-ph">${I('plus')}</span>`}</span>`;
    const body = it.parts.map((p, j) => esc(p) + (j < it.parts.length - 1 ? (j === 0 ? slot : '<span class="tk-ghost">····</span>') : '')).join('');
    const pop = open ? `<div class="tk-pop" data-s="${i}">
        <input class="tk-pop-in" id="ctxPopIn" placeholder="${esc(t('tkCtxPickPh'))}" autocomplete="off" autocapitalize="off" spellcheck="false">
        <div class="tk-pop-list">${bank.length ? bank.map(bi => `<button class="tk-pop-opt" data-tk="ctxPick" data-b="${bi}" data-s="${i}" data-w="${esc(x.items[bi].ans.toLowerCase())}">${esc(x.items[bi].ans)}</button>`).join('')
          : `<span class="tk-note" style="margin:0">${t('tkCtxBankEmpty')}</span>`}</div>
        ${v >= 0 ? `<div class="tk-pop-foot"><button class="btn ghost sm" data-tk="ctxRemove" data-s="${i}">${I('x')}${t('tkCtxRemove')}</button></div>` : ''}
      </div>` : '';
    return `<li class="tk-ctx-row ${r === 1 ? 'ok' : r === 2 ? 'bad' : ''}"><span class="tk-ctx-n">${i + 1}</span><span class="tk-ctx-s">${body}</span>
      ${r === 1 ? `<span class="tk-ctx-mark ok">${I('check')}</span>` : r === 2 ? `<span class="tk-ctx-mark bad">${I('x')}</span>` : ''}${pop}</li>`;
  }).join('');
  let status = '';
  if(wrongPending) status = `<div class="tk-alert bad">${I('x')}<span>${t('tkCtxFixWrong', x.res.filter(r => r === 2).length)}</span></div>`;
  else if(!allFilled) status = `<div class="tk-note center">${t('tkCtxFillAll', x.slots.filter(v => v < 0).length)}</div>`;
  return `
    ${tkItemBar(okN, n, 'tkUnitProg_context')}
    <div class="panel tk-ctx">
      <ol class="tk-ctx-list">${rows}</ol>
      ${status}
      <div class="tk-actions">
        <span class="tk-score-chip">${t('tkCtxScore', okN, n)}</span>
        <button class="btn primary" data-tk="ctxCheck" ${allFilled && !wrongPending ? '' : 'disabled'}>${I('check')}${t('tkCtxCheck')}</button>
      </div>
    </div>`;
}
function afterContextRender(x){
  const inp = $('#ctxPopIn'); if(!inp) return;
  const opts = () => $$('.tk-pop .tk-pop-opt');
  const filter = () => {
    const q = inp.value.trim().toLowerCase();
    let first = null;
    opts().forEach(o => {
      const show = !q || o.dataset.w.includes(q);
      o.style.display = show ? '' : 'none';
      o.classList.remove('hl');
      if(show && !first) first = o;
    });
    if(q && first) first.classList.add('hl');
  };
  inp.addEventListener('input', filter);
  inp.addEventListener('keydown', e => {
    if(e.key === 'Escape'){ e.preventDefault(); ctxPop = -1; renderTasks(); return; }
    if(e.key !== 'Enter') return;
    e.preventDefault();
    const q = inp.value.trim().toLowerCase(); if(!q) return;
    const vis = opts().filter(o => o.style.display !== 'none');
    const pick = vis.find(o => o.dataset.w === q) || (vis.length === 1 ? vis[0] : null);
    if(pick) ctxPlace(+pick.dataset.b, +pick.dataset.s);
    else toast(t(vis.length ? 'tkCtxMany' : 'tkCtxNoMatch'));
  });
  inp.focus({ preventScroll: true });
}
function ctxPlace(bi, s){
  const x = tasks.t.context;
  if(s < 0 || s >= x.slots.length || x.res[s] === 1) return;
  const from = x.slots.indexOf(bi);
  if(from >= 0){ if(x.res[from] === 1) return; x.slots[from] = -1; if(x.res[from] === 2) x.res[from] = 0; }
  x.slots[s] = bi;
  if(x.res[s] === 2) x.res[s] = 0;
  ctxSel = -1; ctxPop = -1; saveTasks(); renderTasks();
}
function ctxUnplace(s){
  const x = tasks.t.context;
  if(x.res[s] === 1 || x.slots[s] < 0) return;
  x.slots[s] = -1; if(x.res[s] === 2) x.res[s] = 0;
  ctxSel = -1; ctxPop = -1; saveTasks(); renderTasks();
}
function ctxCheck(){
  const x = tasks.t.context;
  if(!x.slots.every(v => v >= 0) || x.res.some(r => r === 2)) return;
  x.checks = (x.checks || 0) + 1;
  x.items.forEach((it, i) => {
    if(x.res[i] === 1) return;
    x.res[i] = x.items[x.slots[i]].ans.toLowerCase() === it.ans.toLowerCase() ? 1 : 2;
  });
  saveTasks();
  if(x.res.every(r => r === 1)){ completeTask('context'); return; }
  renderTasks();
  toast(t('tkCtxResult', x.res.filter(r => r === 1).length, x.items.length));
}
