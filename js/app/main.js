/* Lỗi bất ngờ → hiện toast thay vì đứng im */
window.addEventListener('error', e => {
  try{ toast(t('errGeneric', e.message || '?')); }catch(x){}
});

/* ── Khởi động ───────────────────────────────────────────── */
console.log('Sổ Ngữ', APP_VERSION);
applyI18n();
restoreSession().then(ok => { if(!ok) renderPick(); }, () => renderPick());   // còn phiên đăng nhập → vào thẳng app
