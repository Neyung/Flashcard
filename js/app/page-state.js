/* ═══════════════════════════════════════════════════════════
   GIỮ TRẠNG THÁI TRANG KHI TẢI LẠI — thay vì luôn nhảy về tab Nhiệm vụ, mở lại đúng như lúc rời trang:
   tab đang xem, vị trí cuộn, bộ lọc nhóm + "chỉ từ có sao" (Luyện gõ / Flashcard / Sổ từ), ô tìm kiếm,
   từ đang gõ / thẻ đang mở và đề tài đang xem. Lưu riêng từng người dùng ở localStorage soTuPage_<user>
   (chỉ là trạng thái giao diện, không đụng tới dữ liệu từ vựng).
   ═══════════════════════════════════════════════════════════ */
const pageKey = () => 'soTuPage_' + currentUser;
let pageWant = {};        // id đang chờ dùng lại một lần: qw = từ Luyện gõ, fw = thẻ Flashcard, tc = đề tài
let pageY = 0;
try{ history.scrollRestoration = 'manual'; }catch(e){}     // tự cuộn sau khi dữ liệu đã vẽ xong (pageScroll)

function pageSave(){
  if(!currentUser || $('#loginOverlay').style.display !== 'none') return;
  const tab = $('.tab-btn.active');
  const s = {
    tab: tab ? tab.dataset.tab : 'tasks', y: Math.round(scrollY),
    qa: quizGroupAll, qs: [...quizGroupSet], qo: $('#quizSavedOnly').checked, qw: quiz ? quiz.w.id : pageWant.qw,
    ff: fcGroupFilter.get(), fo: $('#fcSavedOnly').checked, fw: fc && !fcQuick ? fc.w.id : pageWant.fw,
    nf: groupFilter.get(), ns: $('#search').value || '',
    tc: tp.user === currentUser && tp.cur ? tp.cur : pageWant.tc,
  };
  try{ localStorage.setItem(pageKey(), JSON.stringify(s)); }catch(e){}
}
window.addEventListener('pagehide', pageSave);
document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'hidden') pageSave(); });   // iPhone có thể tắt app nền mà không có pagehide

/* Gọi trong enterApp thay cho activateTab(Nhiệm vụ) */
function pageRestore(){
  let s = null;
  try{ s = JSON.parse(localStorage.getItem(pageKey()) || 'null'); }catch(e){}
  pageWant = {}; pageY = 0;
  if(s){
    quizGroupAll = s.qa !== false; quizGroupSet = new Set(s.qs || []);
    $('#quizSavedOnly').checked = !!s.qo; $('#fcSavedOnly').checked = !!s.fo;
    fcGroupFilter.set(s.ff); groupFilter.set(s.nf);
    $('#search').value = s.ns || '';
    pageWant = { qw: s.qw, fw: s.fw, tc: s.tc };
    pageY = s.y || 0;
  }
  const btn = s && $(`.tab-btn[data-tab="${s.tab}"]`);
  activateTab(btn && btn.style.display !== 'none' ? btn : $('.tab-btn[data-tab="tasks"]'));
}
/* Cuộn về chỗ cũ sau khi các tab đã vẽ (cuối enterApp) */
function pageScroll(){
  const y = pageY; pageY = 0;
  if(y) requestAnimationFrame(() => requestAnimationFrame(() => scrollTo(0, Math.min(y, document.documentElement.scrollHeight))));
}
/* Lấy lại đúng mục đã lưu (một lần duy nhất) nếu nó còn trong danh sách */
function pageTake(k, list){
  const id = pageWant[k]; delete pageWant[k];
  return id ? list.find(x => x.id === id) || null : null;
}
function pageTakeWord(k, pool){
  const w = pageTake(k, pool);
  return w && !isLimitedToday(w) ? w : null;
}
