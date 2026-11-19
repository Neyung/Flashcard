/* ═══════════════════════════════════════════════════════════
   TAB FLASHCARD — trắc nghiệm chọn nghĩa đúng
   ═══════════════════════════════════════════════════════════ */
let fc = null; // {w, opts, correctIdx, startAt, answered, picked, flipped}

/* Bộ lọc nhóm giống hệt Luyện gõ: tick nhiều nhóm + "Tất cả nhóm" + "Không nhóm" */
let fcGroupDebounce = null;
const fcGroupFilter = makeCheckFilter($('#fcGroupSel'), {
  head: () => fcLevel.el,
  allKey:'qAllGroups', noneKey:'qGroupsNone', nKey:'qGroupsN',
  total: () => words.length,
  items: () => {
    const cnt = {}; words.forEach(w => { const k = wordGroupKey(w); cnt[k] = (cnt[k] || 0) + 1; });
    return quizGroupKeys().map(k => ({ k, label: k === NO_GROUP ? t('optNoGroup') : k, n: cnt[k] || 0 }));
  },
  onChange: () => { clearTimeout(fcGroupDebounce); fcGroupDebounce = setTimeout(startFc, 300); },   // tick liên tiếp chỉ làm lại 1 lần
});
function fcBase(){
  const savedOnly = $('#fcSavedOnly').checked;
  return words.filter(w => (!savedOnly || w.saved) && fcGroupFilter.ok(wordGroupKey(w)));
}
const fcLevel = makeLevelFilter({ base: fcBase, onChange: () => startFc(), tag: () => $('#fcGroupSel .gsel-lv') });
function fcPool(){ fcLevel.paint(); return fcBase().filter(fcLevel.ok); }

/* Tạo 4 phương án: 1 nghĩa đúng + 3 nghĩa nhiễu
   (ưu tiên cùng nhóm > cùng loại đơn/cụm — nhiễu càng "gần" càng khó đoán mò) */
function buildOptions(w){
  const right = pickMeaningPart(w);
  const seen = new Set(meaningParts(w.meaning).map(m => m.toLowerCase()));
  const rank = x => (x.group && x.group === w.group ? 2 : 0) + (x.kind === w.kind ? 1 : 0);
  const cands = shuffle(words.filter(x => x.id !== w.id && x.meaning))
                  .sort((a,b) => rank(b) - rank(a));
  const distract = [];
  for(const x of cands){
    const m = pickMeaningPart(x);
    if(!m || seen.has(m.toLowerCase())) continue;
    meaningParts(x.meaning).forEach(p => seen.add(p.toLowerCase()));
    distract.push(m);
    if(distract.length === 3) break;
  }
  const opts = shuffle([right, ...distract]);
  return { opts, correctIdx: opts.indexOf(right) };
}

/* ── Chiều thẻ TỰ ĐỘNG xào hợp lý (không cần người dùng chọn):
   'wm' = nhìn TỪ → chọn NGHĨA (nhận biết — dễ hơn) · 'mw' = nhìn NGHĨA → chọn TỪ (gợi nhớ — khó hơn)
   - Từ mới / đang học → nghiêng về 'wm' để làm quen trước; từ đã nhớ / thuộc → nghiêng về 'mw' để gợi nhớ chủ động.
   - Cùng một từ lần trước hỏi chiều nào thì lần sau ưu tiên chiều kia (ôn đủ cả hai chiều).
   - Không để quá 2 thẻ liền nhau cùng một chiều (tránh nhàm, tránh đoán theo quán tính).
   - Sổ quá ít từ để có đáp án nhiễu là từ tiếng Anh → dùng 'wm'. ── */
const FC_MW_P = { 'lv-new': .2, 'lv-learn': .45, 'lv-known': .65, 'lv-master': .75 };
const fcLastDir = new Map();          // id từ → chiều đã hỏi gần nhất (trong phiên)
let fcDirRun = [];                    // chiều của 2 thẻ gần nhất
function fcAutoDir(w){
  let p = FC_MW_P[masteryOf(w).cls] ?? .5;
  const prev = fcLastDir.get(w.id);
  if(prev) p = prev === "mw" ? p * .4 : Math.min(.85, p + .25);
  let dir = Math.random() < p ? 'mw' : 'wm';
  if(fcDirRun.length === 2 && fcDirRun[0] === fcDirRun[1] && fcDirRun[0] === dir) dir = dir === 'mw' ? 'wm' : 'mw';
  return dir;
}
/* Chiều Nghĩa → Từ: 1 từ đúng + 3 từ nhiễu (ưu tiên cùng nhóm > cùng loại từ > cùng đơn/cụm);
   bỏ các từ trùng nghĩa với từ đúng để không có hai đáp án cùng đúng */
function buildWordOptions(w){
  const right = w.word.trim();
  const seen = new Set([right.toLowerCase()]);
  const mine = new Set(meaningParts(w.meaning).map(m => m.toLowerCase()));
  const rank = x => (x.group && x.group === w.group ? 2 : 0) + (x.pos && x.pos === w.pos ? 1 : 0) + (x.kind === w.kind ? 1 : 0);
  const cands = shuffle(words.filter(x => x.id !== w.id && x.word && x.word.trim()))
                  .sort((a, b) => rank(b) - rank(a));
  const distract = [];
  for(const x of cands){
    const k = x.word.trim().toLowerCase();
    if(seen.has(k) || meaningParts(x.meaning || '').some(m => mine.has(m.toLowerCase()))) continue;
    seen.add(k); distract.push(x.word.trim());
    if(distract.length === 3) break;
  }
  const opts = shuffle([right, ...distract]);
  return { opts, correctIdx: opts.indexOf(right) };
}
/* Tạo thẻ cho một từ theo chiều đang chọn (dùng chung với Ôn nhanh 10 từ) */
function makeFc(w, dir){
  dir = dir || fcAutoDir(w);
  let built = dir === 'mw' ? buildWordOptions(w) : buildOptions(w);
  if(dir === 'mw' && built.opts.length < 3){ dir = 'wm'; built = buildOptions(w); }   // quá ít từ nhiễu → hỏi nghĩa
  const { opts, correctIdx } = built;
  fcLastDir.set(w.id, dir); fcDirRun = [...fcDirRun, dir].slice(-2);
  const q = dir === 'mw' ? (pickMeaningPart(w) || w.meaning) : '';   // Nghĩa → Từ: hỏi 1 nghĩa (tách theo ; hoặc /) như chiều kia
  return { w, dir, q, opts, correctIdx, startAt: now(), answered:false, picked:-1, flipped:false };
}
const fcLenCls = s => s.length > 55 ? 'len-xlong' : s.length > 35 ? 'len-long' : s.length > 19 ? 'len-med' : '';

function startFc(){
  if(fcQuick) return startFcQuick();             // đang Ôn nhanh 10 từ (js/features/quick-review.js)
  const pool = fcPool();
  const area = $('#fcArea');
  if(!pool.length){
    area.innerHTML = `<div class="panel"><div class="empty">${I('leaf')}<br>
      ${fcGroupFilter.none() ? t('qNoGroupPicked') : fcLevel.active() ? lvEmptyHtml() : t('emptyFc', $('#fcSavedOnly').checked ? t('qExtraSaved') : '')}</div></div>`;
    fc = null; return;
  }
  const w = pageTakeWord('fw', pool) || pickWordLimited(pool);   // tải lại trang → giữ thẻ đang mở
  if(!w){
    area.innerHTML = `<div class="panel"><div class="empty">${I('leaf')}<br>${t('qAllSkipped')}</div></div>`;
    fc = null; return;
  }
  lastShownId = w.id;
  preloadWordAudio(w);
  fc = makeFc(w);
  renderFc();
}

function renderFc(){
  const {w, opts, answered, flipped} = fc;
  const mw = fc.dir === 'mw';                      // Nghĩa → Từ: mặt trước là nghĩa, đáp án là từ tiếng Anh
  const dueIn = (w.stats.due - now()) / DAY;
  const ipaRow = `<div class="fc-ipa" id="fcIpa">
            <button class="speak-btn" id="fcSpeak" title="${t('listenTitle')}">${I('sound')}</button>
            <span id="fcIpaText">${w.kind === 'đơn' ? esc(w.ipa || '') : ''}</span>
          </div>`;
  const wordHtml = `<div class="fc-word ${fcLenCls(w.word)}">${esc(w.word)}</div>`;
  /* Mặt trước: từ + phiên âm (Từ → Nghĩa) · hoặc nghĩa, còn từ + phiên âm hiện sau khi trả lời (Nghĩa → Từ) */
  const frontMain = mw
    ? `<div class="fc-dir-tag">${t('fcDirMw')}</div>
          <div class="fc-mean-q ${fcLenCls(fc.q)}">${esc(fc.q)}</div>
          <div class="fc-mw-ans" ${answered ? '' : 'hidden'}>${wordHtml}${ipaRow}</div>`
    : `${wordHtml}
          ${ipaRow}`;

  const optsHtml = opts.length >= 2
    ? `<div class="opts ${mw ? 'opts-words' : ''}" id="fcOpts">${opts.map((m,i)=>{
        let cls = 'opt';
        if(answered){
          if(i === fc.correctIdx) cls += ' right';
          else if(i === fc.picked) cls += ' wrong';
          else cls += ' dim';
        }
        return `<button class="${cls}" data-i="${i}" ${answered?'disabled':''}>
          <span class="key">${i+1}</span><span>${esc(m)}</span></button>`;
      }).join('')}</div>`
    : `<div style="display:flex;gap:12px;justify-content:center;margin-bottom:16px">
        <button class="btn pink" id="fbForgot">${I('x')}${t('fcForgot')}</button>
        <button class="btn mint" id="fbKnew">${I('check')}${t('fcKnew')}</button>
      </div>
`;

  $('#fcArea').innerHTML = `${fcQuick ? qrTopHtml() : ''}
    <div class="fc-scene">
      <div class="fc-card ${flipped?'flipped':''}" id="fcCard">
        <div class="fc-face fc-front">
          <div class="fc-corner">
            ${w.pos?`<span class="pos-tag">${esc(w.pos)}</span>`:''}
            ${kindTagHtml(w)}
            ${w.group?`<span class="grp" style="cursor:default">${esc(w.group)}</span>`:''}
            <span class="fc-lv-inline">${lvBadge(w)}</span>
          </div>
          <button class="fc-star ${w.saved?'on':''}" id="fcStar" title="${t('saveToLearning')}">${I('star')}</button>
          ${frontMain}
          ${answered ? (fc.picked === fc.correctIdx
              ? `<div class="fc-verdict ok">${I('check')} ${t('fcCorrect')}</div>`
              : `<div class="fc-verdict bad">${I('x')} ${t('fcWrongAns', '<b>'+esc(opts[fc.correctIdx])+'</b>')}</div>`)
            : (clozeHtml(w) ? `<div class="fc-cloze">${clozeHtml(w)}</div>` : '')}
          <span class="fc-lv">${lvBadge(w)}</span>
          <div class="fc-tap">${answered ? t('fcTapAnswered') : t(mw ? 'fcTapChooseWord' : 'fcTapChoose')}</div>
        </div>
        <div class="fc-face fc-back">
          ${mw ? `<div class="fc-word ${fcLenCls(w.word)}">${esc(w.word)}</div><div class="fc-meaning sm">${esc(w.meaning)}</div>`
               : `<div class="fc-meaning">${esc(w.meaning)}</div>`}
          ${w.sentence?`<div class="fc-sentence">${highlightHtml(w)}</div>`:''}
          ${w.note?`<div class="fc-note">${I('pin')} ${esc(w.note)}</div>`:''}
          <div class="fc-tap">${t('fcTapBack')}</div>
        </div>
      </div>
    </div>
    ${optsHtml}
    ${answered ? `<div style="margin-bottom:6px">
      <button class="btn primary" id="fcNext">${fcNextLabel()} ${I('next')}</button></div>` : ''}
    <div class="fc-progress">
      ${t('fcSeen')} <b class="mono">${w.stats.seen}</b> · <b class="mono">${w.stats.seen?Math.round(accuracy(w)*100):0}%</b> ${t('fcCorrectPct')}
      · ${w.stats.interval ? t('fcReviewIn', `<b class="mono">${w.stats.interval<1?t('fcToday'):t('fcDays', Math.round(w.stats.interval))}</b>`) : t('fcNewCard')}
      ${dueIn<=0 && w.stats.seen ? ` · <b style="color:var(--red)">${t('fcDueNow')}</b>` : ''}
    </div>
    ${opts.length >= 2 ? '' : infoCorner([t('fcMoreWordsHelp')])}`;

  const spk = $('#fcSpeak');
  if(spk) spk.addEventListener('click', e => { e.stopPropagation(); speakWord(w); });
  if(w.kind === 'đơn' && !w.ipa){
    fetchPhonetics(w).then(ok => { if(ok) updateFcIpa(); });
  }
  $('#fcCard').addEventListener('click', e=>{
    if(e.target.closest('.fc-star') || e.target.closest('.speak-btn')) return;
    if(!fc.answered) return;                 // chưa trả lời thì không cho lật
    fc.flipped = !fc.flipped;
    $('#fcCard').classList.toggle('flipped', fc.flipped);   // lật tại chỗ — mượt và không vẽ lại
  });
  $('#fcStar').addEventListener('click', ()=>{
    w.saved = !w.saved; save(); renderStats();
    $('#fcStar').classList.toggle('on', w.saved);            // đổi sao tại chỗ
    toast(w.saved ? t('toastLearning', w.word) : t('toastUnstarred', w.word));
  });
  const optsEl = $('#fcOpts');
  if(optsEl) optsEl.addEventListener('click', e=>{
    const b = e.target.closest('.opt'); if(!b || fc.answered) return;
    answerFc(+b.dataset.i);
  });
  const next = $('#fcNext');
  if(next) next.addEventListener('click', startFc);
  const fg = $('#fbForgot'), kn = $('#fbKnew');
  if(fg) fg.addEventListener('click', ()=>{ qrCount(false); applyGrade(w, 0, now()-fc.startAt); startFc(); });
  if(kn) kn.addEventListener('click', ()=>{ qrCount(true); applyGrade(w, 2, now()-fc.startAt); startFc(); });
}

function updateFcIpa(){
  const t = $('#fcIpaText');
  if(t && fc) t.textContent = fc.w.ipa || '';
}

function answerFc(i){
  if(!fc || fc.answered) return;
  fc.picked = i;
  fc.answered = true;
  const elapsed = now() - fc.startAt;
  const correct = i === fc.correctIdx;

  /* Phản hồi tại chỗ — đổi trực tiếp các phần tử đang hiển thị,
     không vẽ lại thẻ nên không thể bị kẹt trên bất kỳ trình duyệt nào */
  $$('#fcOpts .opt').forEach((b, j) => {
    b.disabled = true;
    if(j === fc.correctIdx) b.classList.add('right');
    else if(j === i)        b.classList.add('wrong');
    else                    b.classList.add('dim');
  });
  const front = document.querySelector('.fc-front');
  if(front){
    const cz = front.querySelector('.fc-cloze');
    if(cz) cz.remove();                       // câu cloze nhường chỗ cho kết quả
    const v = document.createElement('div');
    v.className = 'fc-verdict ' + (correct ? 'ok' : 'bad');
    v.innerHTML = correct
      ? I('check') + ' ' + t('fcCorrect')
      : I('x') + ' ' + t('fcWrongAns', '<b>'+esc(fc.opts[fc.correctIdx])+'</b>');
    const tap = front.querySelector('.fc-tap');
    front.insertBefore(v, tap);
    const ans = front.querySelector('.fc-mw-ans');
    if(ans){ ans.hidden = false; speakWord(fc.w); }   // Nghĩa → Từ: lộ từ đúng + phiên âm và đọc to
    if(tap) tap.textContent = t('fcTapAnswered');
  }
  const optsEl = $('#fcOpts');
  if(optsEl && !$('#fcNext')){
    const d = document.createElement('div');
    d.style.cssText = 'margin:14px 0 6px;text-align:center';
    const btn = document.createElement('button');
    btn.className = 'btn primary'; btn.id = 'fcNext';
    btn.innerHTML = fcNextLabel() + ' ' + I('next');
    btn.addEventListener('click', startFc);
    d.appendChild(btn);
    optsEl.after(d);
    if(matchMedia('(max-width:640px), (max-height:500px)').matches) requestAnimationFrame(() => btn.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  }

  qrCount(correct);
  applyGrade(fc.w, correct ? (elapsed < 7000 ? 2 : 1) : 0, elapsed);   // chấm điểm SAU khi đã hiện kết quả
}

/* Phím tắt cho flashcard: 1–4 chọn đáp án, Enter/Space sang thẻ kế */
document.addEventListener('keydown', e=>{
  if(!fc) return;
  if(!$('#tab-flash').classList.contains('active')) return;
  if(e.target.matches('input,textarea,select') || e.target.closest('.gsel') || document.body.classList.contains('sc-open')) return;
  if(!fc.answered && /^[1-4]$/.test(e.key)){
    const i = +e.key - 1;
    if(i < fc.opts.length) answerFc(i);
  }else if(fc.answered && (e.key === 'Enter' || e.key === ' ')){
    e.preventDefault(); startFc();
  }
});
$('#fcSavedOnly').addEventListener('change', startFc);
try{ localStorage.removeItem('soTuFcDir_v1'); }catch(e){}     // lựa chọn chiều cũ không còn dùng (nay tự động)
