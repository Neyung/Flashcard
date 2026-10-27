/* ── Lịch sử bài viết (nút cạnh nút đăng nhập) ── */
function logWriting(p, idx){
  if(p.logged) return;
  p.logged = 1;
  writeLog.unshift({
    id: tasks.date + '_' + (idx + 1) + '_' + now().toString(36), date: tasks.date, at: now(), para: idx + 1,
    words: p.words.map(w => ({ word: w.word, meaning: w.meaning })), text: p.text, checks: p.checks || 1,
    issues: p.issues.slice(0, 60),
    ...(p.ai && p.ai.fixed ? { ai: p.ai } : {}),
  });
  if(writeLog.length > 500) writeLog.length = 500;
  updateHistBadge();
}
function updateHistBadge(){
  const b = $('#histBtn'); if(!b) return;
  b.setAttribute('aria-label', t('histTitle') + ' (' + writeLog.length + ')');
}
let histView = null;            // null = danh sách · id = chi tiết một bài
const histLocale = () => LANG === 'vi' ? 'vi-VN' : 'en-US';
function openHist(){
  if(!currentUser) return;
  histView = null; renderHist();
  $('#histModal').hidden = false;
  document.body.style.overflow = 'hidden';
  const c = $('#histModal [data-h="close"]'); if(c) c.focus();
}
function closeHist(){
  const m = $('#histModal'); if(!m || m.hidden) return;
  histRwFlush();
  m.hidden = true; document.body.style.overflow = '';
}
/* Lịch sử: AI sửa đoạn gốc; có thể đưa bản đã sửa vào "Bản viết lại hoàn chỉnh" */
function histAiBtnSync(){
  const b = $('#histAiBtn'), e = writeLog.find(x => x.id === histView); if(!b || !e) return;
  b.innerHTML = I('spark') + t(e.ai && e.ai.fixed ? 'aiAgain' : 'aiBtn');
}
async function histAi(){
  const e = writeLog.find(x => x.id === histView), host = $('#histAi'); if(!e || !host) return;
  const id = e.id, r = await aiRun(host, e.text, e.words.map(w => w.word), $('#histAiBtn'), 'hist');
  if(!r) return;
  e.ai = r; saveTasks();
  aiExplainLater(r, 'hist');
  if(histView === id){ const h = $('#histAi'); if(h) h.innerHTML = aiResultHtml(r, e.text, 'hist'); histAiBtnSync(); }
}
/* Bản viết lại: tự lưu khi gõ (trễ 700ms), lưu ngay khi rời ô / quay lại / đóng */
let histRwT = null, histRwPending = null;
function histRwAtText(e){
  return e.rewriteAt && (e.rewrite || '').trim() ? esc(t('histRewriteAt', new Date(e.rewriteAt).toLocaleString(histLocale(),
    { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))) : '';
}
function histRwFlush(){
  clearTimeout(histRwT);
  const e = histRwPending; histRwPending = null;
  if(!e) return;
  saveTasks();
  const st = $('#histRwSt');
  if(st && histView === e.id){ st.className = 'hist-rw-st saved'; st.innerHTML = I('check') + t('histRewriteSaved'); }
  const at = $('#histRwAt'); if(at && histView === e.id) at.innerHTML = histRwAtText(e);
}
$('#histModal').addEventListener('input', ev => {
  if(ev.target.id !== 'histRw') return;
  const e = writeLog.find(x => x.id === histView); if(!e) return;
  e.rewrite = ev.target.value; e.rewriteAt = now();
  histRwPending = e;
  const st = $('#histRwSt'); if(st){ st.className = 'hist-rw-st'; st.textContent = t('histRewriteSaving'); }
  const n = $('#histRwN'); if(n) n.textContent = t('histWordsN', wordCount(e.rewrite));
  clearTimeout(histRwT); histRwT = setTimeout(histRwFlush, 700);
});
$('#histModal').addEventListener('focusout', ev => { if(ev.target.id === 'histRw') histRwFlush(); });
function histHighlight(text, ws){
  const ranges = [];
  ws.forEach(w => findUse(text, w.word).forEach(m => ranges.push(...m.parts)));
  ranges.sort((a, b) => a[0] - b[0]);
  let html = '', pos = 0;
  for(const [a, b] of ranges){ if(a < pos) continue; html += esc(text.slice(pos, a)) + '<mark>' + esc(text.slice(a, b)) + '</mark>'; pos = b; }
  return html + esc(text.slice(pos));
}
function renderHist(){
  const box = $('#histBody'); if(!box) return;
  const e = histView && writeLog.find(x => x.id === histView);
  if(e){
    const d = new Date(e.at);
    $('#histTitle').textContent = t('histPara', e.para);
    box.innerHTML = `
      <button class="btn ghost sm" data-h="back">${I('back')}${t('histBack')}</button>
      <div class="hist-when">${I('calendar')}${esc(d.toLocaleDateString(histLocale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))} · ${esc(d.toLocaleTimeString(histLocale(), { hour: '2-digit', minute: '2-digit' }))}</div>
      <div class="hist-sec">${t('histTarget')}</div>
      <div class="tk-tws">${e.words.map(w => `<span class="tk-tw used"><span class="mono">${esc(w.word)}</span><small>${esc(w.meaning || '')}</small></span>`).join('')}</div>
      <div class="hist-sec">${t('histText')}</div>
      <div class="hist-text">${histHighlight(e.text, e.words)}</div>
      <div class="hist-stats"><span>${t('histWordsN', wordCount(e.text))}</span><span>${t('histChecks', e.checks)}</span><span>${t('histIssues', e.issues.length)}</span></div>
      <div class="hist-sec">${t('histFixed')}</div>
      ${e.issues.length ? `<ul class="tk-errs">${e.issues.map(i => `
        <li class="tk-errli"><span class="tk-etype t-${esc(i.type)}">${t('tkErrType_' + i.type)}</span>
          <div><div class="tk-ewrong ${i.miss ? 'missing' : ''}"><span class="mono">${esc(i.text)}</span></div>
          <div class="tk-emsg">${esc(i.msg)}</div>${i.sug ? `<div class="tk-esug">${I('bulb')}${esc(i.sug)}</div>` : ''}</div></li>`).join('')}</ul>`
        : `<div class="tk-alert good">${I('check')}<span>${t('histNoIssues')}</span></div>`}

      <div class="hist-ai-row"><span class="ai-ctl" hidden><button class="btn sm ai-btn" data-h="ai" id="histAiBtn" hidden>${I('spark')}${t('aiBtn')}</button></span></div>
      <div id="histAi">${e.ai && e.ai.fixed ? aiResultHtml(e.ai, e.text, 'hist') : ''}</div>
      <div class="hist-rw-head"><div class="hist-sec">${t('histRewrite')}</div><span class="hist-rw-st" id="histRwSt"></span></div>
      <textarea class="tk-wr-box hist-rw" id="histRw" spellcheck="true" placeholder="${esc(t('histRewritePh'))}">${esc(e.rewrite || '')}</textarea>
      <div class="hist-rw-foot"><span id="histRwN">${t('histWordsN', wordCount(e.rewrite || ''))}</span><span id="histRwAt">${histRwAtText(e)}</span></div>
`;
    box.scrollTop = 0;
    aiShowButton($('#histAiBtn')); histAiBtnSync();
    return;
  }
  histView = null;
  $('#histTitle').textContent = t('histTitle');
  if(!writeLog.length){
    box.innerHTML = `<div class="empty">${I('edit')}<br>${t('histEmpty')}</div>`;
    return;
  }
  let html = '', lastDay = '';
  for(const x of writeLog){
    const d = new Date(x.at), day = x.date || todayKey(d);
    if(day !== lastDay){
      lastDay = day;
      html += `<div class="hist-day">${esc(d.toLocaleDateString(histLocale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</div>`;
    }
    html += `<button class="hist-item" data-h="open" data-id="${esc(x.id)}">
      <span class="hist-item-top"><span>${t('histPara', x.para)}</span><span class="mono">${esc(d.toLocaleTimeString(histLocale(), { hour: '2-digit', minute: '2-digit' }))}</span></span>
      <span class="hist-words">${x.words.map(w => `<span class="hist-w">${esc(w.word)}</span>`).join('')}</span>
      <span class="hist-snip">${esc(x.text)}</span>
      <span class="hist-meta">${t('histWordsN', wordCount(x.text))} · ${t('histChecks', x.checks)} · ${t('histIssues', x.issues.length)}</span>
      ${x.rewrite && x.rewrite.trim() ? `<span class="hist-rw-tag">${I('check')}${t('histRewriteTag')}</span>` : ''}
    </button>`;
  }
  box.innerHTML = `<p class="tk-note" style="margin:0 0 4px">${t('histCount', writeLog.length)}</p>` + html;
}
$('#histBtn').addEventListener('click', openHist);
$('#histModal').addEventListener('click', e => {
  if(e.target === e.currentTarget){ closeHist(); return; }
  const el = e.target.closest('[data-h]'); if(!el) return;
  const a = el.dataset.h;
  if(a === 'close') closeHist();
  else if(a === 'back'){ histRwFlush(); histView = null; renderHist(); }
  else if(a === 'open'){ histView = el.dataset.id; renderHist(); }
  else if(a === 'ai') histAi();
});
document.addEventListener('keydown', e => { if(e.key === 'Escape') closeHist(); });
