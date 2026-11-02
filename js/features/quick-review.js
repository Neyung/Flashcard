/* ═══════════════════════════════════════════════════════════
   ÔN NHANH 10 TỪ — chạy ngay trong tab Flashcard (cùng thẻ, trắc nghiệm, lật thẻ, chấm điểm)
   nhưng chỉ lần lượt 10 từ được bốc ra; học xong quay về sổ từ (tab Ghi chú).
   - Mở bằng đường dẫn ?quick (widget màn hình khoá iPhone) hoặc nút "Ôn nhanh 10 từ"
   - 10 từ = ưu tiên cao nhất theo bộ lập lịch (priorityScore, từ ⭐ ×STAR_BOOST, bỏ từ
     "bỏ qua hôm nay") — cùng thứ tự với widget Scriptable (docs/ios-lockscreen-widget.js)
   - Chấm điểm vẫn qua applyGrade trong flashcard.js → % đúng và lịch SRS cập nhật như thường
   ═══════════════════════════════════════════════════════════ */
const QR_N = 10;
let fcQuick = null;   // {list, i, ok, done}

function quickList(){
  return words.filter(w => !isLimitedToday(w))
    .map(w => ({ w, p: priorityScore(w) * (w.saved ? STAR_BOOST : 1) }))
    .sort((a, b) => b.p - a.p)
    .slice(0, QR_N).map(x => x.w);
}

function openQuick(){
  if(!currentUser || !words || !words.length){ toast(t('qrEmpty')); return; }
  const list = quickList();
  if(!list.length){ toast(t('qAllSkipped')); return; }
  fcQuick = { list, i: 0, ok: 0, done: 0 };
  fc = null;
  $('#tab-flash').classList.add('fc-quick');
  activateTab($('.tab-btn[data-tab="flash"]'));          // → startFc() → startFcQuick()
}
/* silent = không tự mở lại Flashcard thường (đang chuyển tab khác) */
function quitQuick(silent){
  fcQuick = null;
  $('#tab-flash').classList.remove('fc-quick');
  if(/[?&]quick\b|#quick\b/.test(location.search + location.hash))
    history.replaceState(null, '', location.pathname);   // tải lại trang không tự mở lại
  if(!silent) startFc();
}
function finishQuick(){
  const { ok, done } = fcQuick;
  quitQuick(true);
  toast(t('qrDoneToast', ok, done));
  activateTab($('.tab-btn[data-tab="notes"]'));
}
/* Gọi cuối enterApp: vào từ widget (…/?quick) → mở thẳng */
function qrAutoOpen(){
  if(/[?&]quick\b|#quick\b/.test(location.search + location.hash)) openQuick();
}

/* Bản rút gọn của startFc trong flashcard.js: lấy từ kế tiếp trong danh sách thay vì bốc ngẫu nhiên */
function startFcQuick(){
  if(fcQuick.i >= fcQuick.list.length) return finishQuick();
  const w = fcQuick.list[fcQuick.i++];
  lastShownId = w.id;
  preloadWordAudio(w);
  const { opts, correctIdx } = buildOptions(w);
  fc = { w, opts, correctIdx, startAt: now(), answered:false, picked:-1, flipped:false };
  renderFc();
  speakWord(w);                                          // nghe từ luôn (iOS chỉ phát sau một lần chạm)
}
function qrCount(ok){ if(fcQuick){ fcQuick.done++; if(ok) fcQuick.ok++; } }
const fcNextLabel = () => fcQuick && fcQuick.i >= fcQuick.list.length ? t('qrFinish') : t('fcNextCard');
function qrTopHtml(){
  const n = fcQuick.list.length;
  return `<div class="qr-top">
    <span class="qr-step">${t('qrOpen')} · <b class="mono">${fcQuick.i}/${n}</b></span>
    <div class="qr-bar"><i style="width:${(fcQuick.i - 1) / n * 100}%"></i></div>
    <button class="btn qr-exit" id="qrExit">${I('x')}${t('qrExit')}</button>
  </div>`;
}

$('#fcArea').addEventListener('click', e => { if(e.target.closest('#qrExit')) quitQuick(); });
$('#qrOpenBtn').addEventListener('click', openQuick);
