/* ═══════════════════════════════════════════════════════════
   HƯỚNG DẪN TƯƠNG TÁC LẦN ĐẦU (tour) — bước đầu chọn ngôn ngữ, sau đó đi lần lượt từng phần của app:
   màn hình tối đi, chỉ nút / khu vực đang giới thiệu được khoanh sáng, thẻ giải thích đặt cạnh nó.
   - Chỉ tự mở MỘT LẦN cho tài khoản mới tạo (sổ trống, chưa từng dùng); tài khoản đã dùng không tự mở.
     Xong / bỏ qua → ghi nhớ ở localStorage soTuTour_v1_<user> và users/<user>/tourDone (đổi máy không phải xem lại)
   - Xem lại bất cứ lúc nào: nút "?" cạnh nút lịch sử (máy tính) hoặc mục "Xem hướng dẫn" trong menu tài khoản (điện thoại)
   - Mỗi bước: tab cần mở + phần tử cần khoanh (danh sách selector, lấy cái đang hiện). Không thấy phần tử
     (vd sổ chưa có từ, nút chỉ có trên máy tính) → bỏ qua bước, hoặc hiện giữa màn hình nếu bước có fallback
   - Phím: → / Enter = tiếp, ← = quay lại, Esc = thoát. Trong lúc xem, không bấm được vào app (tránh lạc bước)
   - Nội dung từng bước: khoá tour_<id> = [tiêu đề, nội dung] trong js/i18n/vi.js, en.js
   ═══════════════════════════════════════════════════════════ */
const TOUR_KEY = () => 'soTuTour_v1_' + currentUser;
/* tab: tab cần mở · sel: phần tử khoanh (lấy cái đầu tiên đang hiện) · multi: khoanh chung nhiều phần tử
   center: thẻ giữa màn hình, không khoanh
   fallback: không thấy phần tử thì vẫn hiện giữa màn hình · before: chuẩn bị trước khi đo (mở đúng màn hình con) */
const TOUR = [
  { id: 'lang', center: true, lang: true },
  { id: 'welcome', center: true },
  { id: 'stats', multi: ['#chipTotal', '#chipSaved', '#chipDue'] },
  { id: 'langSw', sel: '#langSwitch' },
  { id: 'hist', sel: '#histBtn' },
  { id: 'mini', sel: '#miniToggle' },
  { id: 'user', sel: '#userChip' },
  { id: 'menu', sel: '#hdrMenuBtn' },
  { id: 'tabs', sel: '#tabsNav' },
  { id: 'add', tab: 'notes', sel: '#addPanel', before: () => { if(matchMedia('(max-width:640px)').matches) addPanelSet(true); } },
  { id: 'search', tab: 'notes', sel: '#tab-notes .toolbar' },
  { id: 'more', tab: 'notes', sel: '#tbMoreBtn' },
  { id: 'table', tab: 'notes', multi: ['#tab-notes .table-wrap thead', '#wordTbody tr[data-id]:nth-child(1)', '#wordTbody tr[data-id]:nth-child(2)'] },   // bảng dài → chỉ khoanh tiêu đề + 2 dòng đầu
  { id: 'qFilter', tab: 'quiz', sel: '#tab-quiz .q-meta' },
  { id: 'qStreak', tab: 'quiz', sel: '#streakChip' },
  { id: 'qPrompt', tab: 'quiz', sel: '#quizArea .q-prompt', fallback: true },
  { id: 'qModes', tab: 'quiz', sel: '#quizArea .mode-pills' },
  { id: 'qActions', tab: 'quiz', sel: '#quizArea .quiz-actions' },
  { id: 'qAfter', tab: 'quiz', center: true },
  { id: 'fcCard', tab: 'flash', sel: '#fcCard', fallback: true },
  { id: 'fcOpts', tab: 'flash', sel: '#fcOpts' },
  { id: 'fcMeta', tab: 'flash', sel: '#tab-flash .q-meta' },
  { id: 'tkMode', tab: 'tasks', sel: '.tk-mode-panel', before: () => { if(tkView !== 'overview'){ tkView = 'overview'; renderTasks(); } } },
  { id: 'tkList', tab: 'tasks', sel: '.tk-list' },
  { id: 'tpForm', tab: 'topic', sel: '#tpForm' },
  { id: 'tpHist', tab: 'topic', sel: '#tpHist' },
  { id: 'fDur', tab: 'focus', sel: '#durRow' },
  { id: 'fStart', tab: 'focus', sel: '#tab-focus .focus-actions' },
  { id: 'garden', tab: 'focus', sel: '#garden' },
  { id: 'trFab', sel: '#trFab' },
  { id: 'lxFab', sel: '#lxFab' },
  { id: 'dial', sel: '#dialFab' },
  { id: 'help', sel: ['#tourBtn', '#hdrMenuBtn'] },
  { id: 'done', center: true },
];
let tour = null;          // {i, startTab, layer, spot, card, el, busy, ro, tick}

/* ── Hiển thị được không: có kích thước, không bị ẩn / trong suốt ── */
function tourVisible(el){
  if(!el || !el.isConnected || !el.getClientRects().length) return false;
  const r = el.getBoundingClientRect();
  if(r.width < 2 || r.height < 2) return false;
  for(let e = el; e && e !== document.body; e = e.parentElement){
    const cs = getComputedStyle(e);                // (không xét opacity: tab vừa mở đang chạy hiệu ứng hiện dần)
    if(cs.visibility === 'hidden' || cs.display === 'none') return false;
  }
  return true;
}
function tourFind(sel){
  for(const s of [].concat(sel || [])){
    const el = [...document.querySelectorAll(s)].find(tourVisible);
    if(el) return el;
  }
  return null;
}
/* Tab vẽ không đồng bộ (vd Đề tài tải lịch sử) → chờ phần tử xuất hiện tối đa ms */
function tourWait(sel, ms){
  return new Promise(res => {
    const t0 = performance.now();
    (function tick(){
      const el = tourFind(sel);
      if(el || performance.now() - t0 > ms) return res(el);
      setTimeout(tick, 50);                        // không dùng requestAnimationFrame: tạm dừng khi tab không vẽ
    })();
  });
}

/* ── Mở / đóng ── */
function tourStart(fromIndex){
  if(tour || !currentUser || $('#loginOverlay').style.display !== 'none') return;   // chỉ sau khi đã vào app
  if(document.body.classList.contains('sc-open')) return;            // đang làm thử thách → để sau
  const layer = document.createElement('div');
  layer.id = 'tourLayer'; layer.className = 'tour-layer';
  layer.innerHTML = `<div class="tour-block"></div><div class="tour-spot" hidden></div>
    <div class="tour-card" role="dialog" aria-modal="true" aria-labelledby="tourTitle" tabindex="-1"></div>`;
  document.body.append(layer);
  document.body.classList.add('tour-on');
  const act = $('.tab-btn.active');
  tour = { i: -1, startTab: act ? act.dataset.tab : 'tasks', layer, spot: layer.querySelector('.tour-spot'),
           card: layer.querySelector('.tour-card'), el: null, busy: false,
           ro: window.ResizeObserver ? new ResizeObserver(() => tourPlace()) : null,
           tick: setInterval(() => tourPlace(), 500) };   // phần tử đổi cỡ / dịch chỗ (bảng vẽ thêm, ảnh tải xong…) → đặt lại
  layer.addEventListener('click', tourClick);
  ['pointerdown', 'mousedown', 'touchstart', 'wheel'].forEach(ev => layer.addEventListener(ev, e => e.stopPropagation(), { passive: true }));
  addEventListener('keydown', tourKey, true);
  addEventListener('resize', tourPlace);
  addEventListener('scroll', tourPlace, true);
  setDial(false); hdrMenuSet(false);
  tourGo(fromIndex || 0, 1);
}
function tourEnd(markDone){
  if(!tour) return;
  clearInterval(tour.tick); if(tour.ro) tour.ro.disconnect();
  removeEventListener('keydown', tourKey, true);
  removeEventListener('resize', tourPlace);
  removeEventListener('scroll', tourPlace, true);
  tourEls().forEach(x => x.classList.remove('tour-target'));
  tour.layer.remove();
  document.body.classList.remove('tour-on');
  setDial(false);
  const back = $(`.tab-btn[data-tab="${tour.startTab}"]`);
  tour = null;
  if(back && !back.classList.contains('active')) activateTab(back);   // quay về đúng tab lúc bắt đầu
  scrollTo({ top: 0, behavior: 'smooth' });
  if(markDone) tourMarkDone();
}
function tourMarkDone(){
  try{ localStorage.setItem(TOUR_KEY(), 'done'); }catch(e){}
  if(cloudOn() && currentUser) cloudPut('users/' + currentUser + '/tourDone', now()).catch(() => {});
}
/* Cuối enterApp: chỉ tự mở cho TÀI KHOẢN MỚI (sổ trống, chưa từng dùng). Tài khoản đã có từ / đã học
   → ghi nhớ là đã xem, không tự mở nữa (vẫn xem lại được bằng nút "?" / mục trong menu tài khoản) */
const tourUsed = () => (words && words.length > 0) || Object.keys(focusLog || {}).length > 0
  || (writeLog || []).length > 0 || Object.keys(taskHist || {}).length > 0;
async function tourAutoStart(){
  const user = currentUser;
  try{ if(localStorage.getItem(TOUR_KEY())) return; }catch(e){ return; }
  if(tourUsed()){ tourMarkDone(); return; }
  if(cloudOn()){
    let done = null;
    try{ done = await cloudGet('users/' + user + '/tourDone'); }catch(e){}
    if(currentUser !== user) return;
    if(done){ try{ localStorage.setItem(TOUR_KEY(), 'done'); }catch(e){} return; }
  }
  if(/[?&]quick\b|#quick\b/.test(location.search + location.hash)) return;   // vào từ widget Ôn nhanh → không chen ngang
  setTimeout(() => { if(currentUser === user && $('#loginOverlay').style.display === 'none') tourStart(0); }, 600);
}

/* ── Chuyển bước ── */
async function tourGo(i, dir){
  if(!tour || tour.busy) return;
  tour.busy = true;
  try{
    for(; i >= 0 && i < TOUR.length; i += dir){
      const s = TOUR[i];
      if(s.tab){
        const b = $(`.tab-btn[data-tab="${s.tab}"]`);
        if(b && !b.classList.contains('active')) activateTab(b);
      }
      if(s.before) try{ s.before(); }catch(e){}
      if(s.center){ tourShow(i, null); return; }
      if(s.multi){
        const els = s.multi.map(tourFind).filter(Boolean);
        if(els.length){ tourShow(i, els); return; }
        continue;
      }
      const el = await tourWait(s.sel, s.tab === 'topic' ? 2500 : 600);
      if(!tour) return;
      if(el){ tourShow(i, el); return; }
      if(s.fallback){ tourShow(i, null); return; }
    }
    if(i >= TOUR.length) tourEnd(true);
    else if(i < 0){ tour.busy = false; tourGo(0, 1); }
  }finally{ if(tour) tour.busy = false; }
}
/* Số thứ tự hiển thị chỉ đếm các bước sẽ thực sự hiện trên máy này (ước lượng theo phần tử đang có) */
function tourCount(i){
  const shown = TOUR.filter(s => s.center || s.fallback || s.tab || (s.multi ? s.multi.some(tourFind) : tourFind(s.sel)));
  return { n: shown.indexOf(TOUR[i]) + 1 || i + 1, total: shown.length };
}
function tourShow(i, el){
  const s = TOUR[i];
  tour.i = i;
  tourEls().forEach(x => x.classList.remove('tour-target'));
  if(tour.ro) tour.ro.disconnect();
  tour.el = el;
  const [title, body] = t('tour_' + s.id) || ['', ''];
  const tabLbl = s.tab ? t('tab_' + s.tab) : '';
  const last = i === TOUR.length - 1, first = i === 0;
  const { n, total } = tourCount(i);
  const card = tour.card;
  card.className = 'tour-card' + (el ? '' : ' center') + (s.lang ? ' lang' : '');
  if(s.lang){
    card.innerHTML = `<div class="tour-lang-ico">${I('translate')}</div>
      <h2 class="tour-title" id="tourTitle">Chọn ngôn ngữ <span>·</span> Choose your language</h2>
      <p class="tour-body">Hướng dẫn và giao diện sẽ hiển thị theo ngôn ngữ bạn chọn — đổi lại được bất cứ lúc nào.<br>
        <span class="tour-en">The guide and the whole app will use this language — you can change it any time.</span></p>
      <div class="tour-langs">
        <button class="tour-lang ${LANG === 'vi' ? 'on' : ''}" data-tour="lang" data-lang="vi"><b>Tiếng Việt</b><small>Vietnamese</small></button>
        <button class="tour-lang ${LANG === 'en' ? 'on' : ''}" data-tour="lang" data-lang="en"><b>English</b><small>Tiếng Anh</small></button>
      </div>
      <button class="tour-skip solo" data-tour="skip">Bỏ qua hướng dẫn · Skip the tour</button>`;
  }else{
    card.innerHTML = `<div class="tour-head">
        ${tabLbl ? `<span class="tour-tab">${esc(tabLbl)}</span>` : ''}
        <span class="tour-step mono">${t('tourStepOf', n, total)}</span>
        <button class="tour-x" data-tour="skip" title="${esc(t('tourSkip'))}" aria-label="${esc(t('tourSkip'))}">${I('x')}</button>
      </div>
      <h2 class="tour-title" id="tourTitle">${title}</h2>
      <div class="tour-body">${body}</div>
      <div class="tour-bar"><i style="width:${Math.round(n / total * 100)}%"></i></div>
      <div class="tour-foot">
        ${last ? '' : `<button class="tour-skip" data-tour="skip">${t('tourSkip')}</button>`}
        <span class="tour-gap"></span>
        ${first || i === 1 ? '' : `<button class="btn sm ghost" data-tour="back">${I('back')}${t('tourBack')}</button>`}
        <button class="btn sm primary" data-tour="next">${last ? t('tourFinish') : i === 1 ? t('tourStart') : t('tourNext')}${last ? I('check') : I('next')}</button>
      </div>
      <span class="tour-arrow" aria-hidden="true"></span>`;
  }
  if(el) tourEls().forEach(x => { x.classList.add('tour-target'); if(tour.ro) tour.ro.observe(x); });
  tour.spot.hidden = !el;
  tour.layer.classList.toggle('dim', !el);
  card.classList.remove('in'); void card.offsetWidth; card.classList.add('in');
  if(el) tourScroll();
  tourPlace();
  setTimeout(tourPlace, 60);
  const focusBtn = card.querySelector('[data-tour="next"]') || card.querySelector('.tour-lang.on') || card;
  focusBtn.focus({ preventScroll: true });
}

const tourEls = () => tour && tour.el ? [].concat(tour.el) : [];
/* Cuộn cho phần tử vào khung nhìn: vừa thì đặt giữa; cao quá (không đủ chỗ cho thẻ bên dưới) thì sát mép trên */
function tourScroll(){
  const r = tourRect(); if(!r) return;
  const vh = innerHeight, ch = tour.card.offsetHeight, top = 70;
  let y;
  if(r.height + ch + 60 > vh) y = r.top - top;                         // khối lớn → sát trên, thẻ nằm phần dưới
  else y = r.top - (vh - r.height - ch - 20) / 2;                      // khối vừa → cả khối + thẻ nằm gọn giữa màn hình
  if(Math.abs(y) > 4) scrollBy({ top: y, behavior: 'instant' });   // cuộn tức thì → khung sáng luôn khớp (khung tự trượt mượt bằng CSS)
}
/* Khung bao chung của các phần tử đang khoanh */
function tourRect(){
  const rs = tourEls().filter(x => x.isConnected).map(x => x.getBoundingClientRect());
  if(!rs.length) return null;
  const l = Math.min(...rs.map(r => r.left)), t = Math.min(...rs.map(r => r.top));
  const rt = Math.max(...rs.map(r => r.right)), b = Math.max(...rs.map(r => r.bottom));
  return { left: l, top: t, right: rt, bottom: b, width: rt - l, height: b - t };
}
/* ── Đặt khung sáng + thẻ giải thích cạnh phần tử ── */
function tourPlace(){
  if(!tour) return;
  {                                                // tính ngay (rất nhẹ): requestAnimationFrame có thể không chạy khi tab không vẽ
    const card = tour.card, vw = innerWidth, vh = innerHeight, M = 12;
    const cw = card.offsetWidth, ch = card.offsetHeight, r = tourRect();
    if(!r){
      card.style.left = Math.max(M, (vw - cw) / 2) + 'px';
      card.style.top = Math.max(M, (vh - ch) / 2) + 'px';
      return;
    }
    const pad = 6;
    const x = Math.max(4, r.left - pad), y = Math.max(4, r.top - pad);
    const w = Math.min(vw - 8, r.right + pad) - x, h = Math.min(vh - 8, r.bottom + pad) - y;
    Object.assign(tour.spot.style, { left: x + 'px', top: y + 'px', width: Math.max(0, w) + 'px', height: Math.max(0, h) + 'px',
      borderRadius: Math.min(18, (parseFloat(getComputedStyle(tourEls()[0]).borderRadius) || 10) + pad) + 'px' });
    /* Ưu tiên dưới → trên → phải → trái; không đủ chỗ thì đè lên phần dưới màn hình (thẻ luôn nằm trong khung nhìn) */
    const below = vh - (y + h), above = y, right = vw - (x + w), left = x, gap = 14;
    let px, py, side;
    if(below >= ch + gap + M){ side = 'top'; py = y + h + gap; px = r.left + r.width / 2 - cw / 2; }
    else if(above >= ch + gap + M){ side = 'bottom'; py = y - gap - ch; px = r.left + r.width / 2 - cw / 2; }
    else if(right >= cw + gap + M){ side = 'left'; px = x + w + gap; py = r.top + r.height / 2 - ch / 2; }
    else if(left >= cw + gap + M){ side = 'right'; px = x - gap - cw; py = r.top + r.height / 2 - ch / 2; }
    else{ side = ''; px = (vw - cw) / 2; py = vh - ch - M; }
    px = Math.min(Math.max(M, px), vw - cw - M);
    py = Math.min(Math.max(M, py), vh - ch - M);
    card.style.left = px + 'px'; card.style.top = py + 'px';
    const arrow = card.querySelector('.tour-arrow');
    if(arrow){
      arrow.className = 'tour-arrow' + (side ? ' at-' + side : '');
      if(side === 'top' || side === 'bottom') arrow.style.left = Math.min(Math.max(18, r.left + r.width / 2 - px), cw - 18) + 'px', arrow.style.top = '';
      else if(side) arrow.style.top = Math.min(Math.max(18, r.top + r.height / 2 - py), ch - 18) + 'px', arrow.style.left = '';
    }
  }
}

/* ── Sự kiện ── */
function tourClick(e){
  e.stopPropagation();                             // không để app (vd tự mở cửa sổ nhỏ) bắt cú bấm trong lúc xem
  const b = e.target.closest('[data-tour]'); if(!b || !tour) return;
  const act = b.dataset.tour;
  if(act === 'lang'){ if(b.dataset.lang !== LANG) setLang(b.dataset.lang); tourGo(tour.i + 1, 1); }
  else if(act === 'next') tourGo(tour.i + 1, 1);
  else if(act === 'back') tourGo(tour.i - 1, -1);
  else if(act === 'skip') tourEnd(true);
}
function tourKey(e){
  if(!tour) return;
  e.stopImmediatePropagation();                    // phím không lọt xuống app (Luyện gõ, Flashcard…)
  const b = e.target.closest && e.target.closest('[data-tour]');
  if(e.key === 'Escape'){ e.preventDefault(); tourEnd(true); }
  else if((e.key === 'Enter' || e.key === ' ') && b){ e.preventDefault(); b.click(); }       // nút đang chọn (Bỏ qua / Quay lại / ngôn ngữ…)
  else if(e.key === 'ArrowRight' || e.key === 'Enter'){
    e.preventDefault();
    if(TOUR[tour.i].lang){ const on = tour.card.querySelector('.tour-lang.on'); if(on) on.click(); }
    else tourGo(tour.i + 1, 1);
  }
  else if(e.key === 'ArrowLeft'){ e.preventDefault(); if(tour.i > 1) tourGo(tour.i - 1, -1); }
  else if(TOUR[tour.i].lang && (e.key === 'ArrowUp' || e.key === 'ArrowDown')){   // đổi lựa chọn ngôn ngữ bằng phím
    e.preventDefault();
    const ls = [...tour.card.querySelectorAll('.tour-lang')], k = ls.findIndex(x => x.classList.contains('on'));
    ls.forEach(x => x.classList.remove('on')); const nx = ls[(k + 1) % ls.length]; nx.classList.add('on'); nx.focus();
  }
  else if(e.key === 'Tab'){                        // giữ con trỏ bàn phím trong thẻ
    const f = [...tour.card.querySelectorAll('button')]; if(!f.length) return;
    const k = f.indexOf(document.activeElement), nx = (k + (e.shiftKey ? -1 : 1) + f.length) % f.length;
    e.preventDefault(); f[nx].focus();
  }
}
$('#tourBtn').addEventListener('click', e => { e.stopPropagation(); tourStart(0); });
$('#hdrTour').addEventListener('click', () => { hdrMenuSet(false); tourStart(0); });
