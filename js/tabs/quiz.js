function startQuiz(){
  stopSpeech();                                    // sang từ mới → ngắt giọng đọc đang chạy (nếu có)
  const pool = quizPool();
  const area = $('#quizArea');
  if(!pool.length){
    const none = !quizGroupAll && quizGroupSet.size === 0;
    area.innerHTML = `<div class="panel"><div class="empty">${I('leaf')}<br>
      ${none ? t('qNoGroupPicked') : t('emptyQuiz', $('#quizSavedOnly').checked ? t('qExtraSaved') : '')}</div></div>`;
    quiz = null; return;
  }
  const w = pickWordLimited(pool);
  if(!w){
    area.innerHTML = `<div class="panel"><div class="empty">${I('leaf')}<br>${t('qAllSkipped')}</div></div>`;
    quiz = null; return;
  }
  lastShownId = w.id;
  preloadWordAudio(w);
  quiz = { w, mode: w.kind, meaning: pickMeaningPart(w), startAt: now(), hintLevel:0, typed:[], pickedIdx:[],
           phraseMode: localStorage.getItem(modeKey(w.kind)) === 'type' ? 'type' : 'chips',
           typedPhrase: '' };           
  if(w.kind === 'đơn'){
    const letters = w.word.toLowerCase().split('');
    quiz.shuffled = shuffle(letters.map((ch,i)=>({ch,i})).filter(x=>x.ch!==' '));
  }else{
    const ws = w.word.split(/\s+/);
    quiz.shuffled = shuffle(ws.map((t,i)=>({t,i})));
  }
  renderQuiz();
}

function shuffle(a){
  a = a.slice();
  for(let i=a.length-1;i>0;i--){ const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}

const normPhrase = t => t.toLowerCase().replace(/[.,!?;:"""'’]/g, ' ').replace(/\s+/g, ' ').trim();

function renderQuiz(){
  const {w} = quiz;
  let hint = '';
  if(quiz.hintLevel >= 1){
    hint = `<div class="hintline">${I('bulb')} ${w.kind==='đơn'
        ? t('qHintStart', esc(w.word[0]), w.word.replace(/ /g,'').length)
        : t('qHintFirstWord', esc(w.word.split(/\s+/)[0]))}
        ${w.note?` · ${esc(w.note)}`:''}</div>`;
  }
  if(quiz.hintLevel >= 2){
    const full = w.word.trim();
    hint += `<div class="hintline">${I('bulb')} ${t('qHintHalf', esc(full.slice(0, Math.ceil(full.length/2))), full.length)}</div>`;
  }
  const typeMode = quiz.phraseMode === 'type';
  const spk = quizSpeakerOn();
  const promptHtml = `
    <div class="q-prompt ${spk?'has-speak':''}">
      <button class="star-btn q-star ${w.saved?'on':''}" id="qStar" title="${t('saveToLearning')}" aria-pressed="${!!w.saved}">${I('star')}</button>
      ${spk ? `<button class="speak-btn q-speak" id="qSpeak" title="${t('listenTitle')}">${I('sound')}</button>` : ''}
      <div class="label">${t(w.kind==='đơn' ? (typeMode?'qLabelSingleType':'qLabelSingle') : (typeMode?'qLabelPhraseType':'qLabelPhrase'))}</div>
      <div class="meaning">${esc(quiz.meaning)} ${w.pos?`<span class="pos-tag">${esc(w.pos)}</span>`:''}</div>
      ${w.kind==='cụm' && w.sentence && w.sentence.toLowerCase()!==w.word.toLowerCase()
        ? `<div class="hintline">${t('qExample')} <span class="mono">${esc(w.sentence)}</span></div>` : ''}
      ${hint}
    </div>`;

  let bodyHtml = '';
  const pills = `
      <div class="mode-pills">
        <button class="mode-pill ${quiz.phraseMode==='chips'?'on':''}" data-pm="chips">${w.kind==='đơn'?t('qModeAlpha'):t('qModeChips')}</button>
        <button class="mode-pill ${quiz.phraseMode==='type'?'on':''}" data-pm="type">${t('qModeType')}</button>
      </div>`;
  if(typeMode){
    bodyHtml = pills + `
        <input class="phrase-input" id="phraseInput" autocomplete="off" spellcheck="false"
          placeholder="${esc(t(w.kind==='đơn'?'qWordPh':'qPhrasePh'))}"
          value="${esc(quiz.typedPhrase)}">`;
  }else if(w.kind === 'đơn'){
    bodyHtml = pills + `
      <div class="tiles" id="tiles">${tilesHtml()}</div>
      <div class="chips" id="chips">${quiz.shuffled.map((o,idx)=>
        `<span class="chip-w letter ${quiz.pickedIdx.includes(idx)?'used':''}" data-idx="${idx}">${esc(o.ch)}</span>`).join('')}
      </div>`;
  }else{
    bodyHtml = pills + `
        <div class="answer-line" id="ansLine">${quiz.pickedIdx.length
          ? quiz.pickedIdx.map((idx,k)=>`<span class="chip-w" data-k="${k}">${esc(quiz.shuffled[idx].t)}</span>`).join('')
          : `<span class="placeholder">${t('qAnsPlaceholder')}</span>`}
        </div>
        <div class="chips" id="chips">${quiz.shuffled.map((o,idx)=>
          `<span class="chip-w ${quiz.pickedIdx.includes(idx)?'used':''}" data-idx="${idx}">${esc(o.t)}</span>`).join('')}
        </div>`;
  }

  $('#quizArea').innerHTML = `
    ${promptHtml}
    ${bodyHtml}
    <div class="quiz-actions">
      <button class="btn lemon" id="btnHint" ${quiz.hintLevel>=2?'disabled':''}>${I('bulb')}${t('qHintBtn')}${quiz.hintLevel?` (${quiz.hintLevel}/2)`:''}</button>
      <button class="btn primary" id="btnCheck">${I('check')}${t('qCheckBtn')}</button>
      <button class="btn ghost" id="btnSkip">${t('qSkipBtn')} ${I('next')}</button>
      <button class="btn sky ${isLimitedToday(w)?'limit-on':''}" id="btnLimit" title="${esc(t('qLimitTitle'))}" aria-pressed="${isLimitedToday(w)}">${I('clock')}${t(isLimitedToday(w)?'qLimitedBtn':'qLimitBtn')}</button>
    </div>
    <div class="feedback" id="quizFb"></div>`;

  const refocus = () => { const pi = $('#phraseInput'); if(pi && !quiz.graded) pi.focus(); };
  const spBtn = $('#qSpeak');
  if(spBtn) spBtn.addEventListener('click', e => { speakWord(quiz.w); e.currentTarget.blur(); refocus(); });
  $('#qStar').addEventListener('click', e => {
    const sw = quiz.w, b = e.currentTarget;
    sw.saved = !sw.saved; save(); renderStats();
    b.classList.toggle('on', sw.saved); b.setAttribute('aria-pressed', String(sw.saved));   // đổi sao tại chỗ
    toast(sw.saved ? t('toastLearning', sw.word) : t('toastUnstarred', sw.word));
    b.blur(); refocus();
  });
  $('#btnLimit').addEventListener('click', e => {
    const lw = quiz.w;
    if(isLimitedToday(lw)){ delete lw.limitDay; toast(t('qLimitOff', lw.word)); }
    else { lw.limitDay = todayKey(); toast(t('qLimitOn', lw.word)); }
    save();
    const on = isLimitedToday(lw), b = e.currentTarget;
    b.classList.toggle('limit-on', on); b.setAttribute('aria-pressed', String(on));
    b.lastChild.textContent = t(on ? 'qLimitedBtn' : 'qLimitBtn');
    b.blur(); refocus();
  });

  $('#btnCheck').addEventListener('click', checkQuiz);
  $('#btnSkip').addEventListener('click', ()=>{ applyGrade(quiz.w, 0); startQuiz(); });
  $('#btnHint').addEventListener('click', ()=>{ if(quiz.hintLevel < 2){ quiz.hintLevel++; renderQuiz(); } });
  $$('#quizArea .mode-pill').forEach(p => p.addEventListener('click', () => {
    if(quiz.graded || quiz.phraseMode === p.dataset.pm) return;
    quiz.phraseMode = p.dataset.pm;
    try{ localStorage.setItem(modeKey(quiz.w.kind), quiz.phraseMode); }catch(e){}
    quiz.pickedIdx = []; quiz.typed = []; quiz.typedPhrase = '';        // đổi chế độ → làm lại từ đầu, giữ đồng hồ
    renderQuiz();
  }));
  const pIn = $('#phraseInput');
  if(pIn){
    pIn.addEventListener('input', () => {
      quiz.typedPhrase = pIn.value;
      const a = normPhrase(pIn.value), b = normPhrase(quiz.w.word);
      if(a === b || a.length >= b.length) { autoCheck(true); }
    });
    pIn.addEventListener('keydown', e => {
      if(e.key === 'Enter'){ e.preventDefault(); if(!quiz.graded) checkQuiz(); }
    });
    if(!quiz.graded && !document.querySelector('.gsel.open')) pIn.focus();
  }
  const chipsEl = $('#chips');
  if(chipsEl) chipsEl.addEventListener('click', e=>{
    if(quiz.graded) return;
    const c = e.target.closest('.chip-w'); if(!c || c.classList.contains('used')) return;
    quiz.pickedIdx.push(+c.dataset.idx);
    if(quiz.mode==='đơn') quiz.typed.push(quiz.shuffled[+c.dataset.idx].ch);
    renderQuiz();
    autoCheck();
  });
  const ans = $('#ansLine');
  if(ans) ans.addEventListener('click', e=>{
    if(quiz.graded) return;
    const c = e.target.closest('.chip-w'); if(!c) return;
    quiz.pickedIdx.splice(+c.dataset.k, 1);
    renderQuiz();
  });
}

/* Tự động kiểm tra khi hoàn tất chữ cái / từ cuối cùng */
function autoCheck(fromTyping){
  if(!quiz || quiz.graded) return;
  if(quiz.phraseMode === 'type'){
    if(fromTyping) checkQuiz();
  }else if(quiz.mode === 'đơn'){
    const maxLen = quiz.w.word.replace(/ /g,'').length;
    if(quiz.typed.length >= maxLen) checkQuiz();
  }else{
    if(quiz.pickedIdx.length >= quiz.shuffled.length) checkQuiz();
  }
}

function tilesHtml(){
  const target = quiz.w.word.toLowerCase();
  let typedPos = 0, html = '', cursorSet = false;
  for(const ch of target){
    if(ch === ' '){ html += '<span class="tile space"></span>'; continue; }
    const t = quiz.typed[typedPos];
    const isCursor = !cursorSet && t === undefined;
    if(isCursor) cursorSet = true;
    html += `<span class="tile ${t?'filled':''} ${isCursor?'cursor':''}">${t?esc(t):''}</span>`;
    typedPos++;
  }
  return html;
}

document.addEventListener('keydown', e=>{
  if(!quiz) return;
  if(!$('#tab-quiz').classList.contains('active')) return;
  if(e.target.matches('textarea,select,input:not([type=checkbox])') || e.target.closest('.gsel') || document.body.classList.contains('sc-open')) return;
  if(quiz.graded){
    // Enter: sang từ kế ngay lập tức, ngắt giọng đọc đang chạy (không đợi đọc xong)
    if(e.key === 'Enter' && !e.repeat){ e.preventDefault(); stopSpeech(); startQuiz(); }
    return;
  }
  if(quiz.mode !== 'đơn' || quiz.phraseMode === 'type') return;
  if(e.key === 'Enter'){ checkQuiz(); return; }
  if(e.key === 'Backspace'){
    quiz.typed.pop(); quiz.pickedIdx.pop(); renderQuiz(); return;
  }
  if(/^[a-zA-ZÀ-ỹ'’-]$/.test(e.key)){
    const maxLen = quiz.w.word.replace(/ /g,'').length;
    if(quiz.typed.length >= maxLen) return;
    quiz.typed.push(e.key.toLowerCase());
    // đánh dấu chip tương ứng nếu có
    const free = quiz.shuffled.findIndex((o,idx)=>!quiz.pickedIdx.includes(idx) && o.ch===e.key.toLowerCase());
    quiz.pickedIdx.push(free); // -1 nếu chữ không có trong chip — vẫn cho gõ
    renderQuiz();
    autoCheck();
  }
});

function checkQuiz(){
  if(!quiz || quiz.graded) return;
  quiz.graded = true;
  const {w} = quiz;
  const timeMs = now() - quiz.startAt;
  let userAns, correct;
  if(w.kind === 'đơn' && quiz.phraseMode !== 'type'){
    userAns = quiz.typed.join('');
    correct = userAns === w.word.toLowerCase().replace(/ /g,'');
  }else if(quiz.phraseMode === 'type'){
    const pIn = $('#phraseInput');
    userAns = pIn ? pIn.value : quiz.typedPhrase;
    correct = normPhrase(userAns) === normPhrase(w.word);
    if(pIn){ pIn.disabled = true; pIn.blur(); }       // nhả Enter cho "từ tiếp theo"
  }else{
    userAns = quiz.pickedIdx.map(i=>quiz.shuffled[i].t).join(' ');
    correct = userAns.toLowerCase() === w.word.toLowerCase();
  }
  const charCount = w.kind === 'đơn'
    ? w.word.replace(/ /g,'').length
    : normPhrase(w.word).replace(/\s/g,'').length;
  const fb = $('#quizFb');
  const prevStreak = quizStreak;
  let shielded = false;
  if(correct){
    quizStreak++;
    applyGrade(w, quiz.hintLevel ? 1 : 2, timeMs, charCount, quiz.hintLevel);    
    const wpm = charCount ? Math.round((charCount/5) / (timeMs/60000)) : null;
    fb.className = 'feedback show good';
    fb.innerHTML = `${I('check')} ${t('qCorrect')} <span class="ans">${esc(w.word)}</span>
      ${w.sentence?` — <span class="mono">${esc(w.sentence)}</span>`:''}
      <span class="muted">(${(timeMs/1000).toFixed(1)}s${wpm?` · ~${wpm} WPM`:''}${quiz.hintLevel?' '+t('qHintUsedSuffix')+(quiz.hintLevel>1?' ×2':''):''})</span>`;
      $$('#tiles .tile:not(.space)').forEach(t=>t.classList.add('ok'));
    quiz.speaking = true;
    const cur = quiz;
    Promise.all([speakWord(w), new Promise(r => setTimeout(r, 1400))]).then(() => {
      if(quiz === cur) startQuiz();
    });
  }else{
    shielded = prevStreak >= SHIELD_MIN && sacredConsume('quiz_' + w.id + '_' + quiz.startAt);
    if(!shielded) quizStreak = 0;        // còn khiên → khiên chịu thay, chuỗi giữ nguyên
    applyGrade(w, 0, timeMs, charCount);
    fb.className = 'feedback show bad';
    fb.innerHTML = `${I('x')} ${t('qWrong')} <span class="ans">${esc(w.word)}</span>
      ${w.note?`<br>${I('pin')} ${esc(w.note)}`:''}${shielded?`<br>${I('shield')} ${t('qShielded')}`:''}<br>
      <button class="btn sm mint" style="margin-top:8px" onclick="startQuiz()">${t('qNextWord')} ${I('next')}</button>`;
    $$('#tiles .tile:not(.space)').forEach(t=>t.classList.add('bad'));
  }
  updateStreakUI(prevStreak, shielded);
}
$('#quizSavedOnly').addEventListener('change', startQuiz);
