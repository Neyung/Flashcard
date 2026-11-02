/* ═══════════════════════════════════════════════════════════
   CỬA SỔ NHỎ (kiểu YouTube thu nhỏ) — luôn nổi trên cùng kể cả khi chuyển sang trang/ứng dụng khác.
   Chỉ máy tính: Document Picture-in-Picture (Chrome/Edge 116+); điện thoại / máy tính bảng không bao giờ mở.
   - Nút bật/tắt dạng icon cạnh nút tài khoản (#miniToggle); lựa chọn ghi nhớ ở soTuMini_v2
   - Đang bật → tự mở ở lần bấm/gõ phím đầu tiên trên trang (trình duyệt bắt buộc phải có một thao tác
     của người dùng). Thêm handler "enterpictureinpicture" để Chrome tự mở khi chuyển tab trong lúc trang
     vừa phát âm (điều kiện của Chrome: có tiếng trong 2 giây gần nhất).
   - Tắt bằng ✕ / nút đóng của cửa sổ = tắt luôn (nút trên thanh tiêu đề chuyển sang tắt)
   - Thẻ hai mặt giống tab Flashcard: mặt trước chỉ có từ, mặt sau nghĩa + câu ví dụ; chạm để lật qua lại.
     Nhớ / Quên chấm bằng applyGrade rồi sang từ kế, bốc lần lượt từ toàn bộ sổ bằng pickWordLimited
   ═══════════════════════════════════════════════════════════ */
let mini = null;          // {win, root, fc, lastId, byApp}
const MINI_LS = 'soTuMini_v2';
let miniOn = (() => { try{ return localStorage.getItem(MINI_LS) !== 'off'; }catch(e){ return true; } })();

const miniSupported = () => 'documentPictureInPicture' in window && !isMobileDevice();
function miniSetOn(on){
  miniOn = on;
  try{ localStorage.setItem(MINI_LS, on ? 'on' : 'off'); }catch(e){}
  $('#miniToggle').setAttribute('aria-pressed', String(on));
}

async function openMini(){
  if(!miniSupported() || mini || !currentUser || !words || !words.length) return;
  let win;
  try{ win = await documentPictureInPicture.requestWindow({ width: 380, height: 420 }); }
  catch(e){ return; }                                     // chưa có thao tác người dùng → chờ lần bấm sau
  if(mini){ win.close(); return; }                        // hai lần bấm dồn dập
  const d = win.document;
  d.title = t('miniOpen');
  for(const href of [ document.querySelector('link[href*="fonts.googleapis"]').href,
                      new URL(document.querySelector('link[href*="css/quick.css"]').getAttribute('href').replace('quick.css', 'mini.css'), location.href).href ]){
    const l = d.createElement('link'); l.rel = 'stylesheet'; l.href = href; d.head.append(l);
  }
  d.body.append(document.querySelector('svg symbol').closest('svg').cloneNode(true));   // bộ icon dùng chung
  const root = d.createElement('div'); root.className = 'mn'; d.body.append(root);
  mini = { win, root, fc: null, lastId: null, byApp: false };
  root.addEventListener('click', miniClick);
  d.addEventListener('keydown', miniKey);
  win.addEventListener('pagehide', () => {
    if(!mini || mini.win !== win) return;
    if(!mini.byApp) miniSetOn(false);                     // người dùng tự đóng → nút chuyển sang tắt
    mini = null; stopSpeech();
  });
  miniNext(false);
}
/* byApp = app tự đóng (đổi người dùng), không tính là người dùng tắt */
function closeMini(byApp){ if(mini){ mini.byApp = !!byApp; mini.win.close(); } }

function miniNext(speak){
  if(!mini) return;
  if(!currentUser){ closeMini(true); return; }
  const pool = words.filter(w => w.id !== mini.lastId);
  const w = pickWordLimited(pool.length ? pool : words);
  if(!w){ mini.fc = null; mini.root.innerHTML = `${miniTop(null)}<div class="mn-empty">${t('miniAllSkipped')}</div>`; return; }
  mini.lastId = w.id;
  preloadWordAudio(w);
  mini.fc = { w, startAt: now(), flipped: false };
  miniRender();
  if(speak) speakWord(w);
}

const miniTop = w => `<div class="mn-top">
    <span class="mn-brand">${I('cards')}${t('miniOpen')}</span>
    ${w ? `<span class="mn-stat mono">${w.stats.seen ? Math.round(accuracy(w) * 100) + '%' : t('fcNewCard')}</span>` : ''}
    <button class="mn-x" data-act="close" title="${t('miniClose')}" aria-label="${t('miniClose')}">${I('x')}</button>
  </div>`;

function miniRender(){
  const { w, flipped } = mini.fc;
  mini.root.innerHTML = `${miniTop(w)}
    <div class="mn-scene"><div class="mn-card ${flipped ? 'flipped' : ''}" data-act="flip">
      <div class="mn-face mn-front">
        <div class="mn-tags">${w.pos ? `<span class="mn-pos">${esc(w.pos)}</span>` : ''}${lvBadge(w)}</div>
        <div class="mn-word ${w.word.length > 22 ? 'long' : ''}">${esc(w.word)}</div>
        <div class="mn-ipa"><button class="mn-spk" data-act="speak" title="${t('listenTitle')}">${I('sound')}</button>
          <span>${w.kind === 'đơn' ? esc(w.ipa || '') : ''}</span></div>
        <div class="mn-tap">${t('miniTapFlip')}</div>
      </div>
      <div class="mn-face mn-back">
        <div class="mn-mean">${esc(w.meaning)}</div>
        ${w.sentence ? `<div class="mn-sent">${highlightHtml(w)}</div>` : ''}
        <div class="mn-tap">${t('miniTapFlip')}</div>
      </div>
    </div></div>
    <div class="mn-grade">
      <button class="mn-g forgot" data-act="forgot">${I('x')}${t('fcForgot')}</button>
      <button class="mn-g knew" data-act="knew">${I('check')}${t('fcKnew')}</button>
    </div>`;
}

function miniGrade(grade){
  const f = mini.fc; if(!f) return;
  applyGrade(f.w, grade, now() - f.startAt);
  if(fc && fc.w.id === f.w.id) renderFc();                // cùng từ đang mở ở tab Flashcard → cập nhật
  miniNext(true);
}

function miniClick(e){
  if(!mini) return;
  const b = e.target.closest('[data-act]'); if(!b) return;
  switch(b.dataset.act){
    case 'close':  closeMini(); break;
    case 'speak':  if(mini.fc) speakWord(mini.fc.w); break;
    case 'flip':                                          // lật tại chỗ, không vẽ lại
      if(mini.fc){ mini.fc.flipped = !mini.fc.flipped; b.classList.toggle('flipped', mini.fc.flipped); } break;
    case 'knew':   miniGrade(2); break;
    case 'forgot': miniGrade(0); break;
  }
}
/* Phím tắt trong cửa sổ nhỏ: Space/Enter lật thẻ · 1 = Quên · 2 = Nhớ · Esc tắt */
function miniKey(e){
  if(!mini || !mini.fc) { if(e.key === 'Escape') closeMini(); return; }
  const click = act => { const el = mini.root.querySelector(`[data-act="${act}"]`); if(el){ e.preventDefault(); el.click(); } };
  if(e.key === 'Escape') closeMini();
  else if(e.key === ' ' || e.key === 'Enter') click('flip');
  else if(e.key === '1') click('forgot');
  else if(e.key === '2') click('knew');
}

/* Nút bật/tắt + tự mở */
if(miniSupported()){
  const tg = $('#miniToggle');
  tg.hidden = false;
  tg.setAttribute('aria-pressed', String(miniOn));
  tg.addEventListener('click', e => {
    e.stopPropagation();                                  // không để autoOpen bắt cùng cú bấm
    if(mini){ closeMini(); return; }                      // đang mở → tắt (pagehide đặt trạng thái tắt)
    miniSetOn(true); openMini();
  });
  const autoOpen = () => { if(miniOn && !mini && currentUser && $('#loginOverlay').style.display === 'none') openMini(); };
  document.addEventListener('click', autoOpen);
  document.addEventListener('keydown', autoOpen);
  try{ navigator.mediaSession.setActionHandler('enterpictureinpicture', autoOpen); }catch(e){}   // Chrome tự mở khi chuyển tab (nếu đủ điều kiện)
}
