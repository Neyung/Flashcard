/* ═══════════════════════════════════════════════════════════
   CỬA SỔ NHỎ (kiểu YouTube thu nhỏ) — luôn nổi trên cùng kể cả khi chuyển sang trang/ứng dụng khác.
   Chỉ máy tính: Document Picture-in-Picture (Chrome/Edge 116+); điện thoại / máy tính bảng không bao giờ mở.
   - Không có nút: tự bật ở lần bấm/gõ phím đầu tiên trên trang sau khi đăng nhập (trình duyệt bắt buộc phải
     có một thao tác của người dùng). Thêm handler "enterpictureinpicture" để Chrome tự bật khi chuyển tab
     trong lúc trang vừa phát âm (điều kiện của Chrome: có tiếng trong 2 giây gần nhất).
   - Người dùng tắt bằng ✕ hoặc nút đóng → không tự bật lại cho tới khi tải lại trang
   - Chỉ chế độ Flashcard: trắc nghiệm 4 nghĩa giống tab Flashcard, kèm câu ví dụ; từ được bốc lần lượt
     từ toàn bộ sổ bằng đúng bộ lập lịch (pickWordLimited) và chấm bằng applyGrade
   ═══════════════════════════════════════════════════════════ */
let mini = null;          // {win, root, fc, lastId, byApp}
let miniOff = false;      // người dùng đã tự tắt trong lần mở trang này

const miniSupported = () => 'documentPictureInPicture' in window && !isMobileDevice();

async function openMini(){
  if(!miniSupported() || mini || miniOff || !currentUser || !words || !words.length) return;
  let win;
  try{ win = await documentPictureInPicture.requestWindow({ width: 400, height: 470 }); }
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
    if(!mini.byApp) miniOff = true;                       // người dùng tự đóng → thôi tự bật
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
  const { opts, correctIdx } = buildOptions(w);
  mini.fc = { w, opts, correctIdx, startAt: now(), answered: false, picked: -1 };
  miniRender();
  if(speak) speakWord(w);
}

const miniTop = w => `<div class="mn-top">
    <span class="mn-brand">${I('cards')}${t('miniOpen')}</span>
    ${w ? `<span class="mn-stat mono">${w.stats.seen ? Math.round(accuracy(w) * 100) + '%' : t('fcNewCard')}</span>` : ''}
    <button class="mn-x" data-act="close" title="${t('miniClose')}" aria-label="${t('miniClose')}">${I('x')}</button>
  </div>`;

function miniRender(){
  const { w, opts, correctIdx, answered, picked } = mini.fc;
  const ok = picked === correctIdx, mc = opts.length >= 2;
  const sentence = answered ? (w.sentence ? `<div class="mn-sent">${highlightHtml(w)}</div>` : '')
                            : (clozeHtml(w) ? `<div class="mn-cloze">${clozeHtml(w)}</div>` : '');
  mini.root.innerHTML = `${miniTop(w)}
    <div class="mn-card ${answered ? (ok ? 'ok' : 'bad') : ''}">
      <div class="mn-tags">${w.pos ? `<span class="mn-pos">${esc(w.pos)}</span>` : ''}${lvBadge(w)}</div>
      <div class="mn-word ${w.word.length > 22 ? 'long' : ''}">${esc(w.word)}</div>
      <div class="mn-ipa"><button class="mn-spk" data-act="speak" title="${t('listenTitle')}">${I('sound')}</button>
        <span>${w.kind === 'đơn' ? esc(w.ipa || '') : ''}</span></div>
      ${answered ? `<div class="mn-verdict">${I(ok ? 'check' : 'x')}<span>${esc(w.meaning)}</span></div>` : ''}
      ${sentence}
    </div>
    ${mc ? `<div class="mn-opts">${opts.map((m, i) => {
        let c = 'mn-opt';
        if(answered) c += i === correctIdx ? ' right' : i === picked ? ' wrong' : ' dim';
        return `<button class="${c}" data-i="${i}" ${answered ? 'disabled' : ''}><span class="key">${i + 1}</span><span class="txt">${esc(m)}</span></button>`;
      }).join('')}</div>`
      : answered ? '' : `<div class="mn-opts">
        <button class="mn-opt wrong" data-act="forgot">${I('x')}<span class="txt">${t('fcForgot')}</span></button>
        <button class="mn-opt right" data-act="knew">${I('check')}<span class="txt">${t('fcKnew')}</span></button></div>`}
    ${answered ? `<button class="mn-next" data-act="next">${t('miniNextCard')} ${I('next')}</button>` : ''}`;
}

function miniAnswer(i, grade){
  const f = mini.fc;
  if(!f || f.answered) return;
  const elapsed = now() - f.startAt;
  f.answered = true; f.picked = i;
  if(grade == null) grade = i === f.correctIdx ? (elapsed < 7000 ? 2 : 1) : 0;   // giống answerFc
  applyGrade(f.w, grade, elapsed);
  if(fc && fc.w.id === f.w.id) renderFc();                // cùng từ đang mở ở tab Flashcard → cập nhật
  miniRender();
}

function miniClick(e){
  if(!mini) return;
  const o = e.target.closest('[data-i]');
  if(o) return miniAnswer(+o.dataset.i);
  const b = e.target.closest('[data-act]'); if(!b) return;
  switch(b.dataset.act){
    case 'close':  closeMini(); break;
    case 'speak':  if(mini.fc) speakWord(mini.fc.w); break;
    case 'next':   miniNext(true); break;
    case 'knew':   miniAnswer(mini.fc.correctIdx, 2); break;
    case 'forgot': miniAnswer(-1, 0); break;
  }
}
/* Phím tắt trong cửa sổ nhỏ: 1–4 chọn nghĩa · Enter/Space thẻ tiếp · Esc tắt */
function miniKey(e){
  if(!mini) return;
  const f = mini.fc;
  if(e.key === 'Escape') closeMini();
  else if(f && !f.answered && /^[1-4]$/.test(e.key) && +e.key <= f.opts.length) miniAnswer(+e.key - 1);
  else if(f && f.answered && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); miniNext(true); }
}

/* Tự bật: lần bấm / gõ phím đầu tiên trên trang (sau khi đăng nhập) */
if(miniSupported()){
  const autoOpen = () => { if(!mini && !miniOff && currentUser && $('#loginOverlay').style.display === 'none') openMini(); };
  document.addEventListener('click', autoOpen);
  document.addEventListener('keydown', autoOpen);
  try{ navigator.mediaSession.setActionHandler('enterpictureinpicture', autoOpen); }catch(e){}   // Chrome tự bật khi chuyển tab (nếu đủ điều kiện)
}
