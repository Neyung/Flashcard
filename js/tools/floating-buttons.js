/* Nút lên đầu trang: hiện khi đã cuộn xuống > 400px; ẩn khi bảng Dịch nhanh / Dạng từ đang mở (bảng che chỗ nút) */
function updateTopFab(){
  const b = document.getElementById('topFab'); if(!b) return;
  const panelOpen = !document.getElementById('trPanel').hidden || !document.getElementById('lxPanel').hidden;
  b.classList.toggle('show', scrollY > 400 && !panelOpen);
}
let topFabQueued = false;
window.addEventListener('scroll', () => {
  if(topFabQueued) return;
  topFabQueued = true;
  requestAnimationFrame(() => { topFabQueued = false; updateTopFab(); });
}, { passive: true });
$('#topFab').addEventListener('click', e => { window.scrollTo({ top: 0, behavior: 'smooth' }); e.currentTarget.blur(); setDial(false); });
/* Điện thoại: gộp 3 nút nổi vào 1 nút công cụ (chạm để bung / thu) — chỉ còn 1 nút nhỏ đè lên nội dung */
function setDial(open){
  document.body.classList.toggle('dial-open', open);
  const d = document.getElementById('dialFab'); if(d) d.setAttribute('aria-expanded', String(open));
}
$('#dialFab').addEventListener('click', e => { e.stopPropagation(); setDial(!document.body.classList.contains('dial-open')); });
document.addEventListener('click', e => {
  if(document.body.classList.contains('dial-open') && !e.target.closest('.tr-fab')) setDial(false);
});
$('#lxFab').addEventListener('mousedown', e => e.preventDefault());       // giữ nguyên vùng chữ đang bôi đen
$('#lxFab').addEventListener('click', () => $('#lxPanel').hidden ? lxOpen() : lxClose());
$('#lxClose').addEventListener('click', lxClose);
$$('#lxPanel .lx-tab').forEach(b => b.addEventListener('click', () => lxSetTab(b.dataset.lx)));
['forms', 'syn'].forEach(kind => {
  let timer = null;
  lxIn(kind).addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => lxRun(kind), 600); });
  lxIn(kind).addEventListener('keydown', e => {
    if(e.key === 'Enter'){ e.preventDefault(); clearTimeout(timer); lxRun(kind, true); }
    if(e.key === 'Escape'){ e.stopPropagation(); lxClose(); }
  });
});
$('#lxPanel').addEventListener('click', e => {
  const b = e.target.closest('.lx-chip'); if(!b) return;
  lxLookup(b.dataset.w);
});
document.addEventListener('keydown', e => { if(e.key === 'Escape' && !$('#lxPanel').hidden) lxClose(); });
window.lxReady = true;
lxRender('forms'); lxRender('syn');
