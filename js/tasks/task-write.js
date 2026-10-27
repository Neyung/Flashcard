/* ── 5. Viết đoạn văn ── */
const LT_USAGE_CATS = ['CONFUSED_WORDS','COLLOCATIONS','SEMANTICS','NONSTANDARD_PHRASES','FALSE_FRIENDS'];
const LT_GRAMMAR_CATS = ['GRAMMAR','CASING','MISC'];
function ltType(m){
  const cat = (m.rule && m.rule.category && m.rule.category.id) || '';
  const it = m.rule && m.rule.issueType;
  if(it === 'misspelling' || cat === 'TYPOS') return 'spelling';
  if(LT_USAGE_CATS.includes(cat)) return 'usage';
  if(LT_GRAMMAR_CATS.includes(cat) || it === 'grammar') return 'grammar';
  return '';                                     // văn phong / dấu câu / kiểu chữ: ngoài phạm vi kiểm tra
}
function splitSentences(text){
  const out = []; const re = /[^.!?\n]+[.!?]*/g; let m;
  while((m = re.exec(text))) if(m[0].trim()) out.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
  return out;
}
const wordCount = s => ((s || '').match(/[A-Za-z][A-Za-z'’-]*/g) || []).length;
function usageProblem(tw, m, sent, targets, text){
  const n = wordCount(sent.text);
  if(n < 5) return 'short';
  const hits = targets.filter(x => findUse(sent.text, x.word).length).length;
  if(hits >= 3 && n < hits * 3) return 'list';
  const before = text.slice(sent.start, m.index).toLowerCase();
  if(/["“'‘«]\s*$/.test(before) || /\b(word|term|phrase|vocabulary|expression)\s*$/.test(before)) return 'mention';
  const form = m[0].toLowerCase(), base = tw.word.toLowerCase().trim(), pos = (tw.pos || '').toLowerCase();
  if(!/\s/.test(base) && form !== base){
    if(/^(n|noun|danh)/.test(pos) && /ed$/.test(form) && !/ed$/.test(base)) return 'pos';
    if(/^(adj|tính)/.test(pos) && /(s|ed|ing)$/.test(form) && !/(s|ed|ing)$/.test(base) && !/(er|est|ly|ily)$/.test(form)) return 'pos';
  }
  return '';
}
function localUsageErrors(text, targets){
  const errs = [], sents = splitSentences(text);
  targets.forEach(tw => {
    const ms = findUse(text, tw.word);
    if(!ms.length){
      const cs = chunkStatus(text, tw.word);
      if(cs.length > 1){
        const miss = cs.filter(c => !c.ok).map(c => '"' + c.label + '"');
        errs.push({ type: 'usage', text: tw.word, offset: -1, length: 0,
          msg: miss.length ? t('tkWrMissingParts', tw.word, miss.join(', ')) : t('tkWrPartsOrder', tw.word),
          sug: t('tkWrPartsSug', cs.map(c => c.label).join(' → ')) });
      }else errs.push({ type: 'usage', text: tw.word, offset: -1, length: 0, msg: t('tkWrMissing', tw.word), sug: t('tkWrMissingSug') });
      return;
    }
    let bad = null;
    for(const m of ms){
      const s = sents.find(q => m.index >= q.start && m.index < q.end) || { start: 0, end: text.length, text };
      const why = usageProblem(tw, m, s, targets, text);
      if(!why){ bad = null; break; }
      if(!bad) bad = { m, why };
    }
    if(bad) errs.push({ type: 'usage', text: bad.m[0], offset: bad.m.index, length: bad.m[0].length,
      msg: t('tkWrUse_' + bad.why, bad.m[0], tw.pos), sug: t('tkWrUseSug') });
  });
  return errs;
}
function tkWriteBody(x){
  if(x.idx >= x.paras.length || x.paras[x.idx].done) x.idx = Math.max(0, x.paras.findIndex(p => !p.done));
  const p = x.paras[x.idx], doneN = x.paras.filter(q => q.done).length;
  tkInfos.push(t('tkWrInstr', p.words.length, WRITE_MIN_WORDS));
  if(x.short) tkInfos.push(t('tkWrShortVocab'));
  tkInfos.push(t('tkWrEngine'), t('aiInfo'));
  const tilt = [-3, 2, -1.5, 2.5, -2];
  const tabs = x.paras.map((q, i) => `<span class="tk-wr-tab ${i === x.idx ? 'on' : ''} ${q.done ? 'done' : ''}">${q.done ? I('check') : ''}${t('tkWrPara', i + 1, x.paras.length)}</span>`).join('');
  const stickers = p.words.map((w, i) => {
    const ks = keyChunks(w.word);
    return `<span class="tk-stk ${ks.length > 1 ? 'long' : ''}" data-i="${i}" style="--c:${PALETTE[i % PALETTE.length]};--r:${tilt[i % tilt.length]}deg">
      <span class="tk-stk-ok">${I('check')}</span>${ks.length > 1 ? `<span>${esc(w.word)}</span>` : esc(w.word)}${ks.length > 1 ? `<span class="tk-kcs">${ks.map((k, j) =>
        `<span class="tk-kc" data-j="${j}">${esc(k.label)}</span>`).join('<span class="tk-kc-ar">→</span>')}</span>` : ''}</span>`;
  }).join('');
  if(p.words.some(w => keyChunks(w.word).length > 1)) tkInfos.push(t('tkWrPartsRule'));
  return `
    ${tkItemBar(doneN, x.paras.length, 'tkUnitProg_write')}
    <div class="panel tk-wr">
      <div class="tk-wr-tabs">${tabs}</div>
      <div class="tk-wr-board">
        <div class="tk-wr-board-h"><span>${I('target')}${t('tkWrTargets', p.words.length)}</span><span class="tk-wr-used" id="wrUsedN"></span></div>
        <div class="tk-stks" id="wrTargets">${stickers}</div>
      </div>
      <div class="tk-wr-paper"><textarea id="wrBox" class="tk-wr-box" spellcheck="false" placeholder="${esc(t('tkWrPh'))}">${esc(p.text)}</textarea></div>
      <div class="tk-wr-foot">
        <div class="tk-wr-meter"><span class="tk-mini"><span id="wrMeter"></span></span><span class="tk-note" id="wrCount"></span></div>
        <span class="ai-ctl" hidden><button class="btn ai-btn" data-tk="wrAi" id="wrAiBtn" hidden title="${esc(t('aiTitle'))}">${I('spark')}${t('aiBtn')}</button></span>
        <button class="btn primary" data-tk="wrCheck" id="wrCheckBtn">${I('check')}${t('tkWrCheck')}</button>
      </div>
      <div id="wrResult"></div>
      <div id="wrAi"></div>
    </div>`;
}
let wrSaveT = null;
function afterWriteRender(x){
  const p = x.paras[x.idx], box = $('#wrBox');
  const sync = () => {
    const txt = box.value, wc = wordCount(txt);
    $('#wrCount').textContent = t('tkWrWords', wc, WRITE_MIN_WORDS);
    const meter = $('#wrMeter');
    meter.style.width = Math.min(100, wc / WRITE_MIN_WORDS * 100) + '%';
    meter.classList.toggle('ok', wc >= WRITE_MIN_WORDS);
    let used = 0;
    $$('#wrTargets .tk-stk').forEach(el => {
      const w = p.words[+el.dataset.i].word, ok = findUse(txt, w).length > 0;
      el.classList.toggle('used', ok); if(ok) used++;
      const kcs = el.querySelectorAll('.tk-kc');
      if(kcs.length) chunkStatus(txt, w).forEach((c, j) => kcs[j] && kcs[j].classList.toggle('ok', c.ok));
    });
    const u = $('#wrUsedN');
    u.textContent = t('tkWrUsed', used, p.words.length);
    u.classList.toggle('all', used === p.words.length);
  };
  box.addEventListener('input', () => {
    p.text = box.value; sync(); aiWriteBtnSync(p);
    clearTimeout(wrSaveT); wrSaveT = setTimeout(saveTasks, 800);
  });
  sync();
  if(p.errors.length) renderWriteErrors(p);
  aiShowButton($('#wrAiBtn'));
  if(p.ai && p.ai.explaining && !aiExplainBusy(p.ai)) p.ai.explaining = false;
  if(p.ai && p.ai.fixed) $('#wrAi').innerHTML = aiResultHtml(p.ai, (p.text || '').trim(), 'write');
  aiWriteBtnSync(p);
  box.focus();
  box.setSelectionRange(box.value.length, box.value.length);
}
function renderWriteErrors(p, fresh){
  const el = $('#wrResult'); if(!el) return;
  const text = p.checkedText || '';
  const list = p.errors;
  if(!list.length){ el.innerHTML = ''; return; }
  const marks = list.filter(e => e.offset >= 0).sort((a, b) => a.offset - b.offset);
  let html = '', pos = 0;
  marks.forEach(e => {
    if(e.offset < pos) return;
    html += esc(text.slice(pos, e.offset)) + `<mark class="tk-err t-${e.type}" data-tk="wrJump" data-o="${e.offset}" data-l="${e.length}">${esc(text.slice(e.offset, e.offset + e.length))}</mark>`;
    pos = e.offset + e.length;
  });
  html += esc(text.slice(pos));
  const stale = (p.text || '') !== text;
  el.innerHTML = `
    <div class="tk-alert bad">${I('x')}<span>${t('tkWrErrCount', list.length)}${stale ? ' ' + t('tkWrStale') : ''}</span></div>
    ${marks.length ? `<div class="tk-wr-preview">${html}</div>` : ''}
    <ul class="tk-errs">${list.map(e => `
      <li class="tk-errli" ${e.offset >= 0 ? `data-tk="wrJump" data-o="${e.offset}" data-l="${e.length}"` : ''}>
        <span class="tk-etype t-${e.type}">${t('tkErrType_' + e.type)}</span>
        <div><div class="tk-ewrong ${e.offset < 0 ? 'missing' : ''}"><span class="mono">${esc(e.text)}</span></div>
        <div class="tk-emsg">${esc(e.msg)}</div>
        ${e.sug ? `<div class="tk-esug">${I('bulb')}${esc(e.sug)}</div>` : ''}</div>
      </li>`).join('')}</ul>`;
  if(fresh) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
