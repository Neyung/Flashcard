/* ═══════════════════════════════════════════════════════════
   TAB FLASHCARD — trắc nghiệm chọn nghĩa đúng
   ═══════════════════════════════════════════════════════════ */
let fc = null; // {w, opts, correctIdx, startAt, answered, picked, flipped}

/* Bộ lọc nhóm giống hệt Luyện gõ: tick nhiều nhóm + "Tất cả nhóm" + "Không nhóm" */
let fcGroupDebounce = null;
const fcGroupFilter = makeCheckFilter($('#fcGroupSel'), {
  allKey:'qAllGroups', noneKey:'qGroupsNone', nKey:'qGroupsN',
  total: () => words.length,
  items: () => {
    const cnt = {}; words.forEach(w => { const k = wordGroupKey(w); cnt[k] = (cnt[k] || 0) + 1; });
    return quizGroupKeys().map(k => ({ k, label: k === NO_GROUP ? t('optNoGroup') : k, n: cnt[k] || 0 }));
  },
  onChange: () => { clearTimeout(fcGroupDebounce); fcGroupDebounce = setTimeout(startFc, 300); },   // tick liên tiếp chỉ làm lại 1 lần
});
function fcPool(){
  const savedOnly = $('#fcSavedOnly').checked;
  return words.filter(w => (!savedOnly || w.saved) && fcGroupFilter.ok(wordGroupKey(w)));
}

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

function startFc(){
  const pool = fcPool();
  const area = $('#fcArea');
  if(!pool.length){
    area.innerHTML = `<div class="panel"><div class="empty">${I('leaf')}<br>
      ${fcGroupFilter.none() ? t('qNoGroupPicked') : t('emptyFc', $('#fcSavedOnly').checked ? t('qExtraSaved') : '')}</div></div>`;
    fc = null; return;
  }
  const w = pickWordLimited(pool);
  if(!w){
    area.innerHTML = `<div class="panel"><div class="empty">${I('leaf')}<br>${t('qAllSkipped')}</div></div>`;
    fc = null; return;
  }
  lastShownId = w.id;
  preloadWordAudio(w);
  const { opts, correctIdx } = buildOptions(w);
  fc = { w, opts, correctIdx, startAt: now(), answered:false, picked:-1, flipped:false };
  renderFc();
}

function renderFc(){
  const {w, opts, answered, flipped} = fc;
  const dueIn = (w.stats.due - now()) / DAY;

  const optsHtml = opts.length >= 2
    ? `<div class="opts" id="fcOpts">${opts.map((m,i)=>{
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

  $('#fcArea').innerHTML = `
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
          <div class="fc-word ${w.word.length>55?'len-xlong':w.word.length>35?'len-long':w.word.length>19?'len-med':''}">${esc(w.word)}</div>
          <div class="fc-ipa" id="fcIpa">
            <button class="speak-btn" id="fcSpeak" title="${t('listenTitle')}">${I('sound')}</button>
            <span id="fcIpaText">${w.kind === 'đơn' ? esc(w.ipa || '') : ''}</span>
          </div>
          ${answered ? (fc.picked === fc.correctIdx
              ? `<div class="fc-verdict ok">${I('check')} ${t('fcCorrect')}</div>`
              : `<div class="fc-verdict bad">${I('x')} ${t('fcWrongAns', '<b>'+esc(opts[fc.correctIdx])+'</b>')}</div>`)
            : (clozeHtml(w) ? `<div class="fc-cloze">${clozeHtml(w)}</div>` : '')}
          <span class="fc-lv">${lvBadge(w)}</span>
          <div class="fc-tap">${answered ? t('fcTapAnswered') : t('fcTapChoose')}</div>
        </div>
        <div class="fc-face fc-back">
          <div class="fc-meaning">${esc(w.meaning)}</div>
          ${w.sentence?`<div class="fc-sentence">${highlightHtml(w)}</div>`:''}
          ${w.note?`<div class="fc-note">${I('pin')} ${esc(w.note)}</div>`:''}
          <div class="fc-tap">${t('fcTapBack')}</div>
        </div>
      </div>
    </div>
    ${optsHtml}
    ${answered ? `<div style="margin-bottom:6px">
      <button class="btn primary" id="fcNext">${t('fcNextCard')} ${I('next')}</button></div>` : ''}
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
  if(fg) fg.addEventListener('click', ()=>{ applyGrade(w, 0, now()-fc.startAt); startFc(); });
  if(kn) kn.addEventListener('click', ()=>{ applyGrade(w, 2, now()-fc.startAt); startFc(); });
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
    if(tap) tap.textContent = t('fcTapAnswered');
  }
  const optsEl = $('#fcOpts');
  if(optsEl && !$('#fcNext')){
    const d = document.createElement('div');
    d.style.cssText = 'margin:14px 0 6px;text-align:center';
    const btn = document.createElement('button');
    btn.className = 'btn primary'; btn.id = 'fcNext';
    btn.innerHTML = t('fcNextCard') + ' ' + I('next');
    btn.addEventListener('click', startFc);
    d.appendChild(btn);
    optsEl.after(d);
    if(matchMedia('(max-width:640px), (max-height:500px)').matches) requestAnimationFrame(() => btn.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  }

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
