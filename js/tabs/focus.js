/* ═══════════════════════════════════════════════════════════
   §9 TẬP TRUNG — hẹn giờ, chuông nhắc khi rời cửa sổ, hoa nở
   ═══════════════════════════════════════════════════════════ */
let focus = null;          // {target(s), elapsed(s), running, tick}
let focusMin = 20;
let audioCtx = null;
let lastChime = 0;

/* Vườn hoa: hoa nhỏ là số phiên tập trung đã hoàn thành — CHỈ TĂNG, không bao
   giờ bị trừ/biến mất. Hoa lớn / cỏ may mắn / cây là huy hiệu thưởng THÊM,
   tính (không lưu riêng) từ tổng hoa nhỏ theo mốc mỗi 5: cứ mỗi 5 hoa nhỏ có
   thêm 1 hoa lớn, mỗi 5 hoa lớn có thêm 1 cỏ may mắn, mỗi 5 cỏ may mắn có
   thêm 1 cây — tất cả cộng dồn song song, không bậc nào tiêu hao bậc dưới. */
function gardenKey(){ return 'soTuGarden_' + currentUser; }
let garden = { small:0, taskDays:[], taskV:2 };
const TASK_FLOWERS = 2;           // hoàn thành đủ 5 nhiệm vụ trong ngày = 2 hoa nhỏ
function gardenDerived(small){
  const big = Math.floor(small / 5);
  const luck = Math.floor(big / 5);
  const diamond = Math.floor(luck / 5);
  return { big, luck, diamond };
}
function loadGarden(){
  garden = { small:0, taskDays:[], taskV:2 };
  let migrated = false;
  try{
    const raw = localStorage.getItem(gardenKey());
    if(raw){
      const v = JSON.parse(raw);
      if(typeof v === 'number'){
        garden.small = v;                                            // bản rất cũ: số nguyên đơn
      }else if(v && typeof v === 'object'){
        // quy đổi mọi định dạng cũ (kể cả bản gộp-trừ trước đây) về tổng hoa
        // nhỏ tương đương, để không ai bị mất tiến độ khi đổi sang cách tính mới
        garden.small = (v.small||0) + 5*(v.big||0) + 25*(v.luck||0) + 125*(v.diamond||0);
        garden.taskDays = [...new Set(asArr(v.taskDays).filter(d => typeof d === 'string'))];
        if(v.taskV !== 2 && garden.taskDays.length){       // bản trước: hoa nhiệm vụ đếm riêng → đổi sang hoa nhỏ
          garden.small += TASK_FLOWERS * garden.taskDays.length; migrated = true;
        }
      }
    }
  }catch(e){}
  if(migrated) saveGarden();
}
function saveGarden(){
  try{ localStorage.setItem(gardenKey(), JSON.stringify(garden)); }catch(e){}
  if(cloudOn() && currentUser){
    cloudPut('users/' + currentUser + '/garden', garden).catch(()=>{});
  }
}
function gardenAddFlower(n = 1){
  const before = gardenDerived(garden.small);
  garden.small += n;
  const after = gardenDerived(garden.small);
  const merges = [];
  if(after.big > before.big) merges.push('mergeMsgBig');
  if(after.luck > before.luck) merges.push('mergeMsgLuck');
  if(after.diamond > before.diamond) merges.push('mergeMsgDiamond');
  saveGarden();
  return merges;
}
/* Hoàn thành đủ 5 nhiệm vụ → thêm TASK_FLOWERS hoa nhỏ vào cùng luống hoa với
   Tập trung. taskDays chỉ để khoá theo ngày (không cộng trùng khi tải lại/làm lại).
   Trả về danh sách thông báo ghép bậc, hoặc null nếu hôm nay đã được cộng. */
function gardenAddTaskFlower(day){
  if(!Array.isArray(garden.taskDays)) garden.taskDays = [];
  if(garden.taskDays.includes(day)) return null;
  garden.taskDays.push(day);
  return gardenAddFlower(TASK_FLOWERS);
}
/* Số giả-ngẫu-nhiên ổn định theo seed chuỗi — dùng để xáo trộn ô lưới và
   rung nhẹ (jitter) vị trí từng bông hoa, không đổi qua các lần render */
function seededRand(seed){
  let h = 0;
  for(const ch of String(seed)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0;
  return (h % 10000) / 10000;
}
function seededShuffle(arr, seedBase){
  const a = arr.slice();
  for(let i = a.length - 1; i > 0; i--){
    const j = Math.floor(seededRand(seedBase + '_' + i) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
/* Luống chia thành lưới ô cố định — mỗi bông hoa chiếm 1 ô riêng (rung nhẹ vị
   trí trong ô) nên không bao giờ chồng lên nhau; thứ tự ô được xáo trộn theo
   người dùng để trông tự nhiên/ngẫu nhiên chứ không xếp hàng thẳng tắp */
const G_COLS = 4, G_ROWS = 3;   // 12 ô = tối đa 4 nhỏ + 4 lớn + 4 may mắn cùng lúc
function renderGarden(){
  const g = $('#garden'); if(!g) return;
  const { big, luck, diamond } = gardenDerived(garden.small);
  /* Hiện ĐỦ toàn bộ số hoa thật (không cắt bớt, không gộp "+N"). Luống chỉ
     có 12 ô cố định để rải đều — hoa thứ 13 trở đi sẽ quay lại dùng ô đã có
     hoa khác (chồng lên nhau là chấp nhận được) thay vì bị giấu bớt đi. */
  const specs = [
    ['small','i-flower', garden.small, '#C98A12', 21],
    ['big','i-flower-big', big, '#E5484D', 28],
    ['luck','i-clover', luck, '#13A35B', 25],
  ];
  const sprouts = [];
  specs.forEach(([key, icon, count, color, size]) => {
    for(let i = 0; i < count; i++) sprouts.push({ seed: currentUser + '_' + key + i, icon, color, size });
  });
  const cellOrder = seededShuffle(
    Array.from({ length: G_COLS * G_ROWS }, (_, i) => i), (currentUser || '') + '_gcells');
  const cellW = 92 / G_COLS, cellH = 76 / G_ROWS;
  let bedHtml = '';
  sprouts.forEach((sp, idx) => {
    const cell = cellOrder[idx % cellOrder.length];
    const col = cell % G_COLS, row = Math.floor(cell / G_COLS);
    const jx = 0.15 + seededRand(sp.seed + 'x') * 0.7;   // rung trong ô; khi ô bị dùng lại (>12 hoa)
    const jy = 0.15 + seededRand(sp.seed + 'y') * 0.7;   // độ rung khác nhau giúp các hoa không trùng khít
    const rot = (seededRand(sp.seed + 'r') * 30 - 15).toFixed(1);
    const left = (4 + col * cellW + cellW * jx).toFixed(1);
    const top = (10 + row * cellH + cellH * jy).toFixed(1);
    bedHtml += `<span class="g-sprout" style="left:${left}%;top:${top}%;transform:rotate(${rot}deg);color:${sp.color}">
      <svg class="ic" style="width:${sp.size}px;height:${sp.size}px"><use href="#${sp.icon}"/></svg></span>`;
  });
  const bed = sprouts.length
    ? `<div class="g-bed">${bedHtml}</div>`
    : `<div class="g-bed"><div class="g-bed-empty">${I('leaf')}<br>${t('gardenEmptyBed')}</div></div>`;
  const legend = `
    <div class="g-legend">
      <span class="g-legend-item"><svg class="ic" style="color:#C98A12"><use href="#i-flower"/></svg>${garden.small} ${t('gTier_small')}</span>
      <span class="g-legend-item"><svg class="ic" style="color:#E5484D"><use href="#i-flower-big"/></svg>${big} ${t('gTier_big')}</span>
      <span class="g-legend-item"><svg class="ic" style="color:#13A35B"><use href="#i-clover"/></svg>${luck} ${t('gTier_luck')}</span>
      <span class="g-legend-item special"><svg class="ic" style="color:#1E5EFF"><use href="#i-tree"/></svg>${diamond} ${t('gTier_diamond')}</span>
    </div>`;
  g.innerHTML = bed + legend;
}

/* Chuông nhỏ bằng Web Audio — không cần file âm thanh */
function chime(kind){
  try{
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const t0 = audioCtx.currentTime;
    const notes = kind === 'done' ? [[660,0],[880,.16],[1100,.32]] : [[880,0],[660,.18]];
    for(const [f, dt] of notes){
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t0 + dt);
      g.gain.linearRampToValueAtTime(0.055, t0 + dt + .02);   // nhỏ nhẹ thôi
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + .4);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(t0 + dt); o.stop(t0 + dt + .45);
    }
  }catch(e){}
}

function confettiBurst(){
  const panel = document.querySelector('.focus-panel');
  if(!panel) return;
  const colors = ['var(--mint)','var(--peach)','var(--lav)','var(--sky)','var(--lemon)','var(--pink)'];
  for(let i = 0; i < 26; i++){
    const c = document.createElement('span');
    c.className = 'confetti';
    const sz = 7 + Math.random() * 7;
    c.style.cssText = `left:${5 + Math.random()*90}%;width:${sz}px;height:${sz}px;
      background:${colors[i % colors.length]};
      border-radius:${Math.random() < .5 ? '50%' : '3px'};
      animation-duration:${1.6 + Math.random()*1.6}s;
      animation-delay:${Math.random()*.7}s`;
    panel.appendChild(c);
    setTimeout(() => c.remove(), 4200);
  }
}

const fmtMMSS = sec => {
  const m = Math.floor(sec / 60), ss = sec % 60;
  return String(m).padStart(2,'0') + ':' + String(ss).padStart(2,'0');
};

function setHtml(el, html){               // chỉ ghi lại khi khác → không tạo thay đổi DOM thừa mỗi giây
  if(el && el._html !== html){ el.innerHTML = html; el._html = html; }
}
function setPlant(p){               // p: 0..1 — cây lớn dần, nở theo mốc
  const clip = $('#sfClipRect'), svg = $('#sfSvg');
  if(!clip || !svg) return;
  const h = Math.round(170 * Math.min(1, p / 0.8));   // thân vươn hết ở 80%
  if(clip._h !== h){ clip._h = h; clip.setAttribute('y', 258 - h); clip.setAttribute('height', h); }
  svg.classList.toggle('h1', p >= 0.45 && p < 0.75);  // nụ
  svg.classList.toggle('h2', p >= 0.75 && p < 1);     // hé nở
  svg.classList.toggle('h3', p >= 1);                 // nở bung + đung đưa
}

function renderFocus(){
  const remain = focus ? Math.max(0, focus.target - focus.elapsed) : focusMin * 60;
  $('#focusTime').textContent = fmtMMSS(remain);
  const pct = focus ? Math.min(100, focus.elapsed / focus.target * 100) : 0;
  $('#focusFill').style.transform = `translateX(${pct - 100}%)`;
  $('#focusStart').style.display = focus && focus.running ? 'none' : '';
  setHtml($('#focusStart'), focus && !focus.running ? I('play') + t('focusResume') : I('play') + t('focusStart'));
  $('#focusPause').style.display = focus && focus.running ? '' : 'none';
  $('#focusStop').style.display = focus ? '' : 'none';
  $$('#durRow .dur-chip').forEach(c => c.disabled = !!focus);
  setPlant(focus ? focus.elapsed / focus.target : 0);
  renderFocusToday();
}
function renderFocusToday(){
  const el = $('#focusToday'); if(!el) return;
  if(!currentUser){ el.style.display = 'none'; return; }
  const m = Math.floor(focusTodaySec() / 60), ok = (tasks && tasks.t.focus.done) || focusTodaySec() >= focusGoalSec();
  el.style.display = '';
  el.classList.toggle('ok', ok);
  setHtml(el, (ok ? I('check') : I('target')) + esc(ok ? t('focusTodayDone', m) : t('focusTodayLine', m, focusGoalMin())));
}

function focusTickStart(){
  clearInterval(focus.tick);
  focus.tick = setInterval(() => {
    focus.elapsed++;
    const before = focusTodaySec();
    if(!isAway()) focusLogTick();        // chỉ tính khi đang ở trong cửa sổ ứng dụng
    if(scOnFocusSecond(before)) return;  // vừa chạm mốc 25 phút → mời thử thách (đồng hồ đã đóng băng)
    setTitle();
    if(focus.elapsed >= focus.target){ focusDone(); return; }
    renderFocus();
  }, 1000);
}
function startFocus(){
  if(focus && !focus.running){ focus.running = true; focusTickStart(); renderFocus(); return; }
  focus = { target: focusMin * 60, elapsed: 0, running: true, tick: null };
  awayCount = 0;
  askNotifPermission();
  if(typeof scWarm === 'function') scWarm();              // nạp sẵn mô hình AI cho thử thách
  $('#focusSub').textContent = t('focusRunning');
  focusTickStart(); renderFocus();
}
function pauseFocus(){
  if(!focus) return;
  focus.running = false; clearInterval(focus.tick);
  stopAwayAlarm(false);
  $('#focusSub').textContent = t('focusPaused');
  renderFocus();
}
function stopFocus(silent){
  if(focus) clearInterval(focus.tick);
  if(focus) saveFocusLog(true);
  stopAwayAlarm(false);
  focus = null;
  setTitle();
  if(!silent) $('#focusSub').textContent = t('focusEndedEarly');
  renderFocus();
}
function focusDone(){
  clearInterval(focus.tick);
  saveFocusLog(true);
  stopAwayAlarm(false);
  focus.elapsed = focus.target; focus.running = false;
  renderFocus(); setPlant(1);
  setTitle();
  confettiBurst();
  chime('done');
  const merges = gardenAddFlower(); renderGarden();
  $('#focusSub').textContent = t('focusDoneSub', focusMin);
  toast(t('toastFocusDone', focusMin));
  merges.forEach((key, i) => setTimeout(() => toast(t(key)), 2400 * (i + 1)));
  focus = null;
  $$('#durRow .dur-chip').forEach(c => c.disabled = false);
  $('#focusStop').style.display = 'none';
  $('#focusStart').style.display = '';
  $('#focusStart').innerHTML = I('play') + t('focusStart');
  setTitle();
}

/* Cảnh báo khi rời cửa sổ: chuông reng LIÊN TỤC + cửa sổ thông báo
   (chuông dừng ngay khi quay lại; thông báo hệ thống cần người dùng
   cho phép — app sẽ hỏi quyền khi bấm Bắt đầu lần đầu) */
let awayT = null, awayCount = 0, awayNotif = null;

function askNotifPermission(){
  if(!('Notification' in window)) return;
  if(Notification.permission === 'default'){
    try{ Notification.requestPermission(); }catch(e){}
  }
}
function showAwayNotif(){
  if(!('Notification' in window) || Notification.permission !== 'granted') return;
  try{
    if(awayNotif) awayNotif.close();
    awayNotif = new Notification(t('notifTitle'), {
      body: t('notifBody', focusMin),
      tag: 'soTuFocus', requireInteraction: true,
    });
    awayNotif.onclick = () => { try{ window.focus(); }catch(e){} awayNotif.close(); };
  }catch(e){}
}
function startAwayAlarm(){
  if(awayT) return;
  awayCount++;
  chime('warn');
  showAwayNotif();
  awayT = setInterval(() => chime('warn'), 2500);   // reng liên tục tới khi quay lại
}
function stopAwayAlarm(returned){
  if(awayT){ clearInterval(awayT); awayT = null; }
  if(awayNotif){ try{ awayNotif.close(); }catch(e){} awayNotif = null; }
  if(returned && focus){
    const bn = $('#awayBanner');
    $('#awayMsg').textContent = awayCount === 1 ? t('awayOnce') : t('awayMany', awayCount);
    bn.classList.add('show');
    setTimeout(() => bn.classList.remove('show'), 6000);
  }
}
function isAway(){ return document.hidden || !document.hasFocus(); }
document.addEventListener('visibilitychange', () => {
  if(!focus || !focus.running) return;
  if(document.hidden) startAwayAlarm(); else stopAwayAlarm(true);
});
window.addEventListener('blur', () => {
  if(focus && focus.running) setTimeout(() => { if(isAway()) startAwayAlarm(); }, 250);
});
window.addEventListener('focus', () => { if(awayT) stopAwayAlarm(true); });

/* Đếm ngược trên tiêu đề tab + chặn lỡ tay đóng trang giữa phiên */
function setTitle(){
  document.title = focus
    ? t('titleFocusing', fmtMMSS(Math.max(0, focus.target - focus.elapsed)))
    : t('appTitle');
}
window.addEventListener('beforeunload', e => {
  if(focus && focus.running){ e.preventDefault(); e.returnValue = ''; }
});

$('#durRow').addEventListener('click', e => {
  const c = e.target.closest('.dur-chip'); if(!c || focus) return;
  focusMin = +c.dataset.min;
  $$('#durRow .dur-chip').forEach(x => x.classList.toggle('on', x === c));
  $('#focusSub').textContent = t('focusDurChanged', focusMin);
  renderFocus();
});
$('#focusStart').addEventListener('click', startFocus);
$('#focusPause').addEventListener('click', pauseFocus);
$('#focusStop').addEventListener('click', () => stopFocus(false));
