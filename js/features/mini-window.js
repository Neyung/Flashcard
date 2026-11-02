/* ═══════════════════════════════════════════════════════════
   CỬA SỔ NHỎ (kiểu YouTube thu nhỏ) — luôn nổi trên cùng kể cả khi chuyển sang trang/ứng dụng khác.
   Dùng Document Picture-in-Picture: chỉ có trên Chrome/Edge máy tính (116+); trình duyệt khác ẩn nút.
   - Lần lượt 10 từ ưu tiên (quickList trong quick-review.js); hết 10 từ thì bốc lại 10 từ mới
   - 2 chế độ, người dùng chọn ngay trong cửa sổ (ghi nhớ ở soTuMini_v1):
       Tự chạy   — hiện từ + nghĩa, đọc từ, tự sang từ kế sau 3/5/8 giây; tạm dừng / lùi / tới
       Flashcard — hiện từ, bấm "Hiện nghĩa" rồi Đã nhớ / Chưa nhớ → applyGrade (cập nhật % đúng, SRS)
   - Tắt bằng nút ✕ trong cửa sổ hoặc nút đóng của trình duyệt
   ═══════════════════════════════════════════════════════════ */
const MINI_LS = 'soTuMini_v1', MINI_SECS = [3, 5, 8];
let mini = null;   // {win, root, list, i, revealed, paused, timer, shownAt, prefs}

/* Chỉ dành cho máy tính: điện thoại / máy tính bảng không bao giờ hiện, kể cả khi trình duyệt có API */
const miniIsMobile = () => !!(navigator.userAgentData && navigator.userAgentData.mobile)
  || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
  || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent))        // iPad báo là Mac
  || matchMedia('(hover: none) and (pointer: coarse)').matches;
const miniSupported = () => 'documentPictureInPicture' in window && !miniIsMobile();
function miniPrefs(){
  let p = {};
  try{ p = JSON.parse(localStorage.getItem(MINI_LS) || '{}') || {}; }catch(e){}
  return { mode: p.mode === 'flash' ? 'flash' : 'auto', sec: MINI_SECS.includes(p.sec) ? p.sec : 5 };
}
function miniSavePrefs(){ try{ localStorage.setItem(MINI_LS, JSON.stringify(mini.prefs)); }catch(e){} }

async function openMini(){
  if(!miniSupported()){ toast(t('miniNoSupport')); return; }
  if(mini){ mini.win.focus(); return; }
  const list = currentUser && words ? quickList() : [];
  if(!list.length){ toast(t('qrEmpty')); return; }
  let win;
  try{ win = await documentPictureInPicture.requestWindow({ width: 360, height: 270 }); }
  catch(e){ toast(t('miniNoSupport')); return; }
  const d = win.document;
  d.title = t('miniOpen');
  for(const href of [ document.querySelector('link[href*="fonts.googleapis"]').href,
                      new URL(document.querySelector('link[href*="css/quick.css"]').getAttribute('href').replace('quick.css', 'mini.css'), location.href).href ]){
    const l = d.createElement('link'); l.rel = 'stylesheet'; l.href = href; d.head.append(l);
  }
  d.body.append(document.querySelector('svg symbol').closest('svg').cloneNode(true));   // bộ icon dùng chung
  const root = d.createElement('div'); root.className = 'mn'; d.body.append(root);
  mini = { win, root, list, i: 0, revealed: false, paused: false, timer: null, shownAt: 0, prefs: miniPrefs() };
  root.addEventListener('click', miniClick);
  d.addEventListener('keydown', miniKey);
  win.addEventListener('pagehide', () => { if(mini && mini.win === win){ mini = null; stopSpeech(); } });
  miniShow(true);
}
function closeMini(){ if(mini) mini.win.close(); }

/* Hẹn giờ chạy bằng setTimeout của chính cửa sổ nhỏ: cửa sổ luôn hiển thị nên không bị trình duyệt
   bóp chậm như tab chính đang ở nền */
function miniSchedule(){
  mini.win.clearTimeout(mini.timer);                       // id hẹn giờ thuộc cửa sổ nhỏ, không phải tab chính
  if(mini.prefs.mode === 'auto' && !mini.paused)
    mini.timer = mini.win.setTimeout(() => miniStep(1), mini.prefs.sec * 1000);
}
function miniStep(dir){
  if(!mini) return;
  if(!currentUser){ closeMini(); return; }                  // đã đăng xuất / đổi người dùng
  mini.i += dir;
  if(mini.i >= mini.list.length){                           // hết 10 từ → bốc 10 từ mới theo điểm ưu tiên hiện tại
    mini.list = quickList(); mini.i = 0;
    if(!mini.list.length){ closeMini(); return; }
  }
  if(mini.i < 0) mini.i = mini.list.length - 1;
  mini.revealed = false;
  miniShow(true);
}

function miniShow(speak){
  const { list, i, prefs, revealed, paused } = mini, w = list[i];
  const auto = prefs.mode === 'auto', showMean = auto || revealed;
  mini.root.innerHTML = `
    <div class="mn-top">
      <div class="mn-modes" role="group">
        <button class="${auto ? 'on' : ''}" data-mode="auto">${I('play')}${t('miniAuto')}</button>
        <button class="${auto ? '' : 'on'}" data-mode="flash">${I('cards')}${t('miniFlash')}</button>
      </div>
      <span class="mn-step mono">${i + 1}/${list.length}</span>
      <button class="mn-icon" data-act="close" title="${t('miniClose')}" aria-label="${t('miniClose')}">${I('x')}</button>
    </div>
    <div class="mn-card ${showMean ? 'shown' : ''}">
      <div class="mn-word ${w.word.length > 22 ? 'long' : ''}">${esc(w.word)}</div>
      <div class="mn-ipa"><button class="mn-icon sm" data-act="speak" title="${t('listenTitle')}">${I('sound')}</button>
        <span>${w.kind === 'đơn' ? esc(w.ipa || '') : ''}</span></div>
      <div class="mn-mean">${showMean ? esc(w.meaning) : '· · ·'}</div>
      <div class="mn-acc">${w.stats.seen ? `${t('miniAcc', Math.round(accuracy(w) * 100))}` : t('fcNewCard')}</div>
    </div>
    <div class="mn-ctl">${auto
      ? `<button class="mn-icon" data-act="prev" title="${t('miniPrev')}">${I('back')}</button>
         <button class="mn-btn" data-act="pause">${I(paused ? 'play' : 'pause')}${paused ? t('miniPlay') : t('miniPause')}</button>
         <button class="mn-icon" data-act="next" title="${t('miniNext')}">${I('next')}</button>
         <div class="mn-secs" role="group">${MINI_SECS.map(s => `<button class="${s === prefs.sec ? 'on' : ''}" data-sec="${s}">${s}s</button>`).join('')}</div>`
      : revealed
        ? `<button class="mn-btn pink" data-act="forgot">${I('x')}${t('miniForgot')}</button>
           <button class="mn-btn mint" data-act="knew">${I('check')}${t('miniKnew')}</button>`
        : `<button class="mn-btn primary wide" data-act="reveal">${t('miniReveal')}</button>`}
    </div>`;
  mini.shownAt = now();
  if(speak && !(auto && paused)) speakWord(w);
  miniSchedule();
}

function miniClick(e){
  if(!mini) return;
  const m = e.target.closest('[data-mode]'), s = e.target.closest('[data-sec]'), b = e.target.closest('[data-act]');
  if(m){
    if(m.dataset.mode === mini.prefs.mode) return;
    mini.prefs.mode = m.dataset.mode; mini.revealed = false; mini.paused = false; miniSavePrefs(); miniShow(false); return;
  }
  if(s){ mini.prefs.sec = +s.dataset.sec; miniSavePrefs(); miniShow(false); return; }
  if(!b) return;
  const w = mini.list[mini.i];
  switch(b.dataset.act){
    case 'close':  closeMini(); break;
    case 'speak':  speakWord(w); break;
    case 'prev':   miniStep(-1); break;
    case 'next':   miniStep(1); break;
    case 'pause':  mini.paused = !mini.paused; miniShow(false); break;
    case 'reveal': mini.revealed = true; miniShow(false); break;
    case 'knew': case 'forgot':
      applyGrade(w, b.dataset.act === 'knew' ? 2 : 0, now() - mini.shownAt);
      if(fc && fc.w.id === w.id) renderFc();                // thẻ đang mở ở tab Flashcard → cập nhật % đúng
      miniStep(1); break;
  }
}
/* Phím tắt trong cửa sổ nhỏ: Space = tạm dừng / hiện nghĩa · ←/→ = lùi/tới · 1 = Chưa nhớ · 2 = Đã nhớ */
function miniKey(e){
  if(!mini) return;
  const click = act => { const el = mini.root.querySelector(`[data-act="${act}"]`); if(el){ e.preventDefault(); el.click(); } };
  if(e.key === ' ') click(mini.prefs.mode === 'auto' ? 'pause' : 'reveal');
  else if(e.key === 'ArrowRight') click('next');
  else if(e.key === 'ArrowLeft') click('prev');
  else if(e.key === '1') click('forgot');
  else if(e.key === '2') click('knew');
  else if(e.key === 'Escape') closeMini();
}

const miniBtn = $('#miniOpenBtn');
miniBtn.hidden = !miniSupported();
miniBtn.addEventListener('click', openMini);
