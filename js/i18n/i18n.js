/* ═══════════════════════════════════════════════════════════
   ĐA NGÔN NGỮ (VI / EN)
   ═══════════════════════════════════════════════════════════ */
let LANG = (()=>{ try{ return localStorage.getItem('soTuLang_v1') || 'vi'; }catch(e){ return 'vi'; } })();
const I18N = { vi: I18N_VI, en: I18N_EN };
function t(key, ...args){
  const dict = I18N[LANG] || I18N.vi;
  const v = (key in dict) ? dict[key] : (I18N.vi[key] !== undefined ? I18N.vi[key] : key);
  return typeof v === 'function' ? v(...args) : v;
}
const I18N_BINDINGS = [
  ['stTotalLbl','text','statWords'], ['stSavedLbl','text','statLearning'], ['stDueLbl','text','statDue'],
  ['nAddTitle','text','nAddTitle'], ['nWordLbl','text','nWordLbl'], ['nGroupLbl','text','nGroupLbl'], ['fGroup','placeholder','nGroupPh'],
  ['nPosLbl','text','nPosLbl'], ['nMeaningLbl','text','nMeaningLbl'], ['nKindLbl','text','nKindLbl'],
  ['nKindSingle','text','nKindSingle'], ['nKindPhrase','text','nKindPhrase'],
  ['nSentenceLbl','text','nSentenceLbl'], ['nNoteLbl','text','nNoteLbl'], ['fNote','placeholder','nNotePh'],
  ['nAddBtn','text','nAddBtn'], ['nClearBtn','text','nClearBtn'], ['nListTitle','text','nListTitle'], ['search','placeholder','nSearchPh'],
  ['groupFilter','title','nGroupFilterTitle'], ['nDelSelBtn','text','delSelBtn'], ['nClearSelBtn','text','clearSelBtn'],
  ['wordSelAll','title','selAllTitle'], ['histBtn','title','histTitle'], ['trFab','title','trFab'], ['trFab','aria-label','trFab'], ['lxFab','title','lxFab'], ['lxFab','aria-label','lxFab'], ['topFab','title','toTop'], ['topFab','aria-label','toTop'], ['dialFab','title','fabTools'], ['hdrLangLbl','text','hdrLang'], ['hdrLangVi','text','langNameVi'], ['hdrLangEn','text','langNameEn'], ['hdrHistLbl','text','histTitle'], ['hdrSwitchLbl','text','switchUser'], ['hdrMenuBtn','aria-label','hdrMenuTitle'], ['hdrMenuBtn','title','hdrMenuTitle'], ['dialFab','aria-label','fabTools'], ['lxTitle','text','lxTitle'], ['lxTabForms','text','lxTabForms'], ['lxTabSyn','text','lxTabSyn'], ['lxInForms','placeholder','lxPhForms'], ['lxInSyn','placeholder','lxPhSyn'], ['trTitle','text','trTitle'],
  ['trIn','placeholder','trPh'], ['trDir','title','trSwap'], ['trSpeak','title','trSpeak'], ['trCopy','title','trCopy'],
  ['trAddLbl','text','trAdd'], ['trGoogleLbl','text','trOpenGoogle'], ['btnBulkGroup','title','nBulkGroupTitle'], ['btnCefr','title','cefrTitle'],
  ['nBulkGroupBtn','text','nBulkGroupBtn'], ['nBulkGroupBtn2','text','nBulkGroupBtn'], ['tbMoreLbl','text','tbMore'], ['tbMoreBtn','title','tbMoreTitle'], ['tbMoreBtn','aria-label','tbMoreTitle'], ['nImportBtn','text','nImportBtn'], ['nExportBtn','text','nExportBtn'],
  ['thWord','text','thWord'], ['thPos','text','thPos'], ['thMeaning','text','thMeanFull'], ['thSentence','text','thSentence'],
  ['thNote','text','thNote'], ['thKind','text','thKind'], ['thAcc','text','thAcc'], ['thDue','text','thDue'], ['thDue','title','thDueTitle'], ['thLv','text','thLv'],
  ['qAllGroups','text','qAllGroups'], ['qSavedOnlyLbl','text','qSavedOnlyLbl'], ['qStreakLbl','text','qStreakLbl'],
  ['fSavedOnlyLbl','text','fSavedOnlyLbl'],
  ['awayMsg','text','awayDefault'], ['focusSub','text','focusSubDefault'],
  ['focusPauseLbl','text','focusPause'], ['focusStopLbl','text','focusStop'], ['gardenTitle','text','gardenTitle'],
];
function applyI18n(){
  document.title = t('appTitle');
  $$('.tab-btn[data-tab]').forEach(b=>{
    const lbl = b.querySelector('.tlabel');
    if(lbl) lbl.textContent = t('tab_' + b.dataset.tab);
  });
  $('#langViBtn').textContent = t('langNameVi');
  $('#langEnBtn').textContent = t('langNameEn');
  $$('#langSwitch button').forEach(b => b.classList.toggle('on', b.dataset.lang===LANG));
  $$('#durRow .dur-chip').forEach(b => b.textContent = t('durLabel', +b.dataset.min));
  for(const [id, prop, key] of I18N_BINDINGS){
    const el = document.getElementById(id); if(!el) continue;
    const val = t(key);
    if(prop==='text') el.textContent = val;
    else if(prop==='placeholder') el.setAttribute('placeholder', val);
    else if(prop==='title') el.title = val;
    else if(prop==='html') el.innerHTML = val;
    else el.setAttribute(prop, val);
  }
  $('#userChip').title = t('switchUser');
  $('#nListInfo').innerHTML = tkInfo([t('nFormatNote')]);
  $('#gardenInfo').innerHTML = tkInfo([t('gardenInfo')]);
  $('#quizInfo').innerHTML = tkInfo([t('qTilesHelp')]);
  $('#trInfo').innerHTML = tkInfo([t('trTip'), t('trNote')]);
  $('#lxInfo').innerHTML = tkInfo([t('lxSubForms'), t('lxSubSyn'), t('lxTip'), t('lxNote')]);
  if(window.lxReady){ lxRender('forms'); lxRender('syn'); }
  if(typeof renderStats === 'function' && words) renderStats();
}
