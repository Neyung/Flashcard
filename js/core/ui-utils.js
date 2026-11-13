function save(){
  if(!currentUser || !words) return;
  if(!memoryOnly){
    try{ localStorage.setItem(lsKey(), JSON.stringify(words)); }
    catch(e){ memoryOnly = true; }
  }
  cloudSaveWords();
}
/* Lưu gộp cho cập nhật chạy nền (phiên âm, CEFR…): mỗi lần save() là chuyển cả sổ thành chuỗi + ghi localStorage
   + đẩy cả sổ lên mạng → làm sau SAVE_SOON_MS, nhiều thay đổi dồn thành 1 lần. Thao tác của người dùng vẫn save() ngay. */
const SAVE_SOON_MS = 4000;
let saveSoonT = null;
function saveSoon(){ if(!saveSoonT) saveSoonT = setTimeout(saveFlush, SAVE_SOON_MS); }
function saveFlush(){ if(saveSoonT){ clearTimeout(saveSoonT); saveSoonT = null; save(); } }
addEventListener('pagehide', saveFlush);
/* Việc nền chỉ chạy lúc người dùng rảnh tay: trang đang mở và ≥ ms không gõ / bấm / cuộn,
   rồi đợi requestIdleCallback → không tranh tài nguyên với thao tác đang làm */
let lastUserInput = 0;
['keydown', 'pointerdown', 'wheel', 'touchstart'].forEach(ev => addEventListener(ev, () => { lastUserInput = Date.now(); }, { capture: true, passive: true }));
const userIdleFor = () => Date.now() - lastUserInput;
async function whenIdle(ms = 3000){
  for(;;){
    if(document.visibilityState === 'visible' && userIdleFor() >= ms){
      await new Promise(r => window.requestIdleCallback ? requestIdleCallback(r, { timeout: 2000 }) : setTimeout(r, 50));
      if(userIdleFor() >= ms) return;
    }else await new Promise(r => setTimeout(r, 500));
  }
}

/* ── Toast ───────────────────────────────────────────────── */
let toastT;
function toast(msg){
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(()=>t.classList.remove('show'), 2200);
}
