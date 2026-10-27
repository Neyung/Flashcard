function save(){
  if(!currentUser || !words) return;
  if(!memoryOnly){
    try{ localStorage.setItem(lsKey(), JSON.stringify(words)); }
    catch(e){ memoryOnly = true; }
  }
  cloudSaveWords();
}

/* ── Toast ───────────────────────────────────────────────── */
let toastT;
function toast(msg){
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(()=>t.classList.remove('show'), 2200);
}
