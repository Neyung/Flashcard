/* ── Phiên âm + phát âm: tự tra Free Dictionary API (không cần key) ──
   - Chỉ tra từ đơn; kết quả (IPA + link audio) lưu vào từ và đồng bộ mây
   - Tra "lười": chỉ khi từ xuất hiện trên flashcard hoặc khi bấm loa,
     tránh dội 107 request một lúc. Thất bại chỉ ghi nhớ trong phiên,
     mất mạng thì lần sau vẫn thử lại. */
const ipaFailed = new Set();
/* IPA của Datamuse đặt dấu nhấn ngay trước nguyên âm (dɪsˈaɪd) và dùng ɫ, ʌ cho mọi âm yếu →
   chuyển về kiểu từ điển: dấu nhấn trước phụ âm đầu âm tiết (dɪˈsaɪd), l, ə ở âm tiết không nhấn,
   từ một âm tiết thì bỏ dấu nhấn. */
const IPA_V = /^(aɪ|aʊ|eɪ|oʊ|ɔɪ|[aeiouæɑɒɔəɛɜɝɚɪʊʌyɐ])/;
const IPA_ONSET = new Set(['pr','br','tr','dr','kr','gr','fr','θr','ʃr','pl','bl','kl','gl','fl','sl','sp','st','sk','sm','sn','sw','tw','kw','dw','gw','pj','bj','kj','mj','fj','hj','spr','str','skr','spl','skw']);
function ipaTidy(word){
  const segs = [];                         // tách thành âm vị
  let s = word.replace(/ɫ/g, 'l').replace(/ɡ/g, 'g');
  while(s){
    const m = s.match(/^(tʃ|dʒ|ˈ|ˌ)/) || s.match(IPA_V) || [s[0]];
    segs.push(m[0]); s = s.slice(m[0].length);
  }
  const isV = x => IPA_V.test(x) && x.length === (x.match(IPA_V) || [''])[0].length;
  const nV = segs.filter(isV).length;
  for(let i = 0; i < segs.length; i++){
    if(segs[i] !== 'ˈ' && segs[i] !== 'ˌ') continue;
    let j = i;                             // lùi qua phụ âm đầu âm tiết hợp lệ (tối đa 3)
    while(j > 0 && !isV(segs[j - 1]) && segs[j - 1] !== 'ˈ' && segs[j - 1] !== 'ˌ' && i - j < 3){
      const cl = segs.slice(j - 1, i).join('');
      if(i - (j - 1) === 1 ? segs[j - 1] === 'ŋ' : !IPA_ONSET.has(cl)) break;
      j--;
    }
    if(j < i){ const mk = segs.splice(i, 1)[0]; segs.splice(j, 0, mk); }
  }
  let stressed = false;                    // ʌ / ɝ ở âm tiết không nhấn → ə / ɚ
  for(let i = 0; i < segs.length; i++){
    if(segs[i] === 'ˈ'){ stressed = true; continue; }
    if(segs[i] === 'ˌ'){ stressed = false; continue; }
    if(isV(segs[i])){
      if(!stressed && nV > 1){ if(segs[i] === 'ʌ') segs[i] = 'ə'; else if(segs[i] === 'ɝ') segs[i] = 'ɚ'; }
      stressed = false;
    }
  }
  const out = segs.join('');
  return nV <= 1 ? out.replace(/[ˈˌ]/g, '') : out;
}
async function ipaDatamuse(text){           // IPA từ Datamuse; cụm từ → ghép IPA từng từ (thiếu từ nào thì bỏ)
  const ws = String(text || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
  if(!ws.length || ws.length > 6) return '';
  try{
    const ps = await Promise.all(ws.map(async x => {
      const r = await fetch('https://api.datamuse.com/words?sp=' + encodeURIComponent(x) + '&md=r&ipa=1&max=1');
      if(!r.ok) return '';
      const d = await r.json(), e = d[0];
      const tag = e && e.word === x && (e.tags || []).find(s => s.startsWith('ipa_pron:'));
      return tag ? ipaTidy(tag.slice(9).trim()) : '';
    }));
    return ps.every(Boolean) ? '/' + ps.join(' ') + '/' : '';
  }catch(e){ return ''; }
}
async function fetchPhonetics(w){
  if(w.kind !== 'đơn' || w.ipa || ipaFailed.has(w.id)) return !!w.ipa;
  try{
    const r = await fetch('https://api.dictionaryapi.dev/api/v2/entries/en/'
      + encodeURIComponent(w.word.toLowerCase().trim()));
    if(!r.ok) throw 0;
    const data = await r.json();
    const phs = (Array.isArray(data) && data[0] && data[0].phonetics) || [];
    /* Ưu tiên tuyệt đối bản Anh-Mỹ (file audio có đuôi -us.mp3) */
    const us = phs.find(p => p.audio && /-us\.mp3/i.test(p.audio));
    w.audio = (us || phs.find(p => p.audio) || {}).audio || '';
    w.ipa   = (us && us.text)
           || (phs.find(p => p.text) || {}).text
           || (data[0] && data[0].phonetic) || '';
    if(w.ipa || w.audio){ save(); return true; }
    throw 0;
  }catch(e){                               // Free Dictionary lỗi / chặn → lấy IPA từ Datamuse
    const ipa = await ipaDatamuse(w.word);
    if(ipa){ w.ipa = ipa; save(); return true; }
    ipaFailed.add(w.id); return false;
  }
}

/* Đọc to: ưu tiên audio từ điển; không có thì dùng giọng đọc trình duyệt.
   speakWord/playAudio/speakTTS đều trả về Promise — resolve khi ĐỌC XONG
   (hoặc lỗi / quá 8s) để nơi gọi có thể chờ. */
const audioCache = new Map();
const badAudio = new Set();            // link audio lỗi/treo trong phiên → bỏ qua, dùng TTS
let cancelSpeech = null;
function getAudio(url){
  let a = audioCache.get(url);
  if(!a){ a = new Audio(); a.preload = 'auto'; a.src = url; audioCache.set(url, a); }
  return a;
}
function preloadWordAudio(w){
  if(!w || w.kind !== 'đơn') return;
  if(w.audio){ if(!badAudio.has(w.audio)) getAudio(w.audio); return; }
  fetchPhonetics(w).then(() => { if(w.audio && !badAudio.has(w.audio)) getAudio(w.audio); });
}
function stopSpeech(){
  if(cancelSpeech){ const c = cancelSpeech; cancelSpeech = null; c(); }
  audioCache.forEach(a => { if(!a.paused) a.pause(); });
  try{
    if('speechSynthesis' in window && (speechSynthesis.speaking || speechSynthesis.pending)) speechSynthesis.cancel();
  }catch(e){}
}
function playAudio(url, fallbackText){
  return new Promise(resolve => {
    stopSpeech();
    const a = getAudio(url);
    let done = false, guard, startGuard;
    const end = next => {
      if(done) return; done = true;
      clearTimeout(guard); clearTimeout(startGuard);
      a.removeEventListener('ended', onEnd);
      a.removeEventListener('error', fallback);
      a.removeEventListener('playing', onPlaying);
      if(cancelSpeech === end) cancelSpeech = null;
      resolve(next);
    };
    const fallback = () => {
      if(done) return;
      badAudio.add(url);
      cancelSpeech = null;
      try{ a.pause(); }catch(e){}
      end(speakTTS(fallbackText));
    };
    const onPlaying = () => clearTimeout(startGuard);
    const onEnd = () => { (a.duration && a.duration < 0.25) ? fallback() : end(); };
    a.addEventListener('ended', onEnd);
    a.addEventListener('error', fallback);
    a.addEventListener('playing', onPlaying);
    cancelSpeech = end;
    guard = setTimeout(() => end(), 8000);
    startGuard = setTimeout(fallback, 1500);
    try{ a.currentTime = 0; }catch(e){}
    a.play().catch(() => { if(!done) fallback(); });
  });
}
function speakWord(w){
  if(w.kind !== 'đơn') return speakTTS(w.word);
  if(w.audio && !badAudio.has(w.audio)) return playAudio(w.audio, w.word);
  const p = speakTTS(w.word);
  if(!w.audio) fetchPhonetics(w).then(ok => {
    if(w.audio && !badAudio.has(w.audio)) getAudio(w.audio);
    if(ok){ if(fc && fc.w.id === w.id) updateFcIpa(); renderTable(); }
  });
  return p;
}
/* Tra sẵn phiên âm cho mọi từ đơn còn thiếu — chạy nền sau khi đăng nhập,
   cách nhau 300ms để lịch sự với API. IPA hiện ra ngay, không cần bấm loa. */
let ipaQueueRunning = false;
async function prefetchPhonetics(){
  if(ipaQueueRunning) return;
  ipaQueueRunning = true;
  const user = currentUser;
  const targets = words.filter(w => w.kind === 'đơn' && !w.ipa && !ipaFailed.has(w.id));
  let found = 0;
  for(const w of targets){
    if(currentUser !== user) break;          // đổi người dùng → dừng
    if(await fetchPhonetics(w)){
      found++;
      if(fc && fc.w.id === w.id) updateFcIpa();
    }
    await new Promise(r => setTimeout(r, 300));
  }
  if(found && currentUser === user) renderTable();
  ipaQueueRunning = false;
}

let enVoice = null;
function pickVoice(){
  if(enVoice) return enVoice;
  enVoice = speechSynthesis.getVoices().find(v => v.lang === 'en-US')
         || speechSynthesis.getVoices().find(v => v.lang.startsWith('en-US')) || null;
  return enVoice;
}
if('speechSynthesis' in window) speechSynthesis.addEventListener('voiceschanged', () => { enVoice = null; pickVoice(); });

function speakTTS(text){
  return new Promise(resolve => {
    try{
      if(!('speechSynthesis' in window)){ toast(t('speakUnsupported')); return resolve(); }
      stopSpeech();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US'; u.rate = 0.92;
      const v = pickVoice(); if(v) u.voice = v;
      let done = false, guard;
      const end = () => {
        if(done) return; done = true;
        clearTimeout(guard);
        if(cancelSpeech === end) cancelSpeech = null;
        resolve();
      };
      u.onend = end; u.onerror = end;
      cancelSpeech = end;
      guard = setTimeout(end, 8000);
      speechSynthesis.speak(u);
    }catch(e){ resolve(); }
  });
}
