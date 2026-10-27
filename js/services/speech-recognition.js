/* ═════════════ GHI ÂM + NHẬN DIỆN GIỌNG NÓI ═════════════
   - MediaRecorder: lưu bản ghi để nghe lại
   - SpeechRecognition (Chrome/Edge/Safari): nhận diện điều người dùng nói;
     điểm = độ khớp giữa kết quả nhận diện và từ/câu mục tiêu. Không có kết
     quả nhận diện hợp lệ → KHÔNG chấm điểm. */
const SRClass = window.SpeechRecognition || window.webkitSpeechRecognition || null;
/* Mặc định Chrome gửi âm thanh lên máy chủ Google để nhận diện (cần Internet, kể cả
   khi app chạy local). Chrome mới hỗ trợ nhận diện NGAY TRÊN MÁY: dùng khi có sẵn,
   hoặc cho tải gói tiếng Anh 1 lần. */
let srLocal = 'unknown';          // 'available' | 'downloadable' | 'downloading' | 'unavailable'
let srUseLocal = false;
async function srCheckLocal(){
  if(!SRClass) return (srLocal = 'unavailable');
  try{
    if(typeof SRClass.available === 'function') srLocal = await SRClass.available({ langs: ['en-US'], processLocally: true });
    else if(typeof SRClass.availableOnDevice === 'function') srLocal = await SRClass.availableOnDevice('en-US');
    else srLocal = 'unavailable';
  }catch(e){ srLocal = 'unavailable'; }
  if(srLocal === 'available') srUseLocal = true;
  return srLocal;
}
async function srInstallLocal(){
  try{
    srLocal = 'downloading';
    let ok = false;
    if(typeof SRClass.install === 'function') ok = await SRClass.install({ langs: ['en-US'], processLocally: true });
    else if(typeof SRClass.installOnDevice === 'function') ok = await SRClass.installOnDevice('en-US');
    await srCheckLocal();
    return ok || srLocal === 'available';
  }catch(e){ srLocal = 'unavailable'; return false; }
}
srCheckLocal();
let recCur = null;
function recAbort(){
  const r = recCur; if(!r) return;
  recCur = null; r.aborted = true;
  clearTimeout(r.timer); clearTimeout(r.quietT);
  try{ if(r.sr) r.sr.abort(); }catch(e){}
  try{ if(r.mr && r.mr.state !== 'inactive') r.mr.stop(); }catch(e){}
  if(r.stream) r.stream.getTracks().forEach(tr => tr.stop());
}
async function recStart(opts, onFinish){
  recAbort();
  const r = { alts: [], segs: [], chunks: [], error: '', srDone: !SRClass, mrDone: false, aborted: false };
  recCur = r;
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){ recCur = null; onFinish({ error: 'nomic', alts: [] }); return; }
  try{ r.stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch(e){
    if(recCur === r) recCur = null;
    onFinish({ error: e && (e.name === 'NotAllowedError' || e.name === 'SecurityError') ? 'denied' : 'nomic', alts: [] });
    return;
  }
  if(r.aborted){ r.stream.getTracks().forEach(tr => tr.stop()); return; }
  r.finish = () => {
    if(r.aborted || r.finished || !r.srDone || !r.mrDone) return;
    r.finished = true;
    if(recCur === r) recCur = null;
    clearTimeout(r.timer); clearTimeout(r.quietT);
    r.stream.getTracks().forEach(tr => tr.stop());
    const url = r.chunks.length ? URL.createObjectURL(new Blob(r.chunks, { type: (r.mr && r.mr.mimeType) || 'audio/webm' })) : '';
    let alts = r.alts;
    if(opts.sentence && r.segs.length > 1) alts = [{ t: r.segs.map(s => s.t).join(' '), c: Math.min(...r.segs.map(s => s.c || 0)) }];
    onFinish({ alts, url, error: r.error });
  };
  if(window.MediaRecorder){
    try{
      r.mr = new MediaRecorder(r.stream);
      r.mr.ondataavailable = e => { if(e.data && e.data.size) r.chunks.push(e.data); };
      r.mr.onstop = () => { r.mrDone = true; r.finish(); };
      r.mr.start();
    }catch(e){ r.mr = null; r.mrDone = true; }
  }else r.mrDone = true;
  if(SRClass){
    const sr = r.sr = new SRClass();
    sr.lang = 'en-US'; sr.maxAlternatives = 5;
    if(srUseLocal){                              // nhận diện trên máy — không gửi âm thanh đi đâu
      try{ sr.processLocally = true; }catch(e){}
      try{ if('mode' in sr) sr.mode = 'ondevice-only'; }catch(e){}
    }
    sr.continuous = !!opts.sentence; sr.interimResults = !!opts.sentence;
    sr.onresult = e => {
      if(opts.sentence){                       // câu: ghép các đoạn cuối, tự dừng sau ~2s im lặng
        r.segs = [];
        for(let i = 0; i < e.results.length; i++){
          const res = e.results[i];
          if(res.isFinal) r.segs.push({ t: res[0].transcript, c: res[0].confidence || 0 });
        }
        if(r.segs.length === 1){
          const res = [...e.results].find(x => x.isFinal);
          r.alts = [...res].map(a => ({ t: a.transcript, c: a.confidence || 0 }));
        }else if(r.segs.length) r.alts = [{ t: r.segs.map(s => s.t).join(' '), c: 0 }];
        clearTimeout(r.quietT);
        r.quietT = setTimeout(recStop, 2200);
      }else{
        const res = e.results[e.results.length - 1];
        r.alts = [...res].map(a => ({ t: a.transcript, c: a.confidence || 0 }));
      }
    };
    sr.onerror = e => {
      if(e.error === 'aborted') return;
      r.error = ({ 'no-speech': 'nospeech', 'not-allowed': 'denied', 'service-not-allowed': 'service',
                   network: 'network', 'audio-capture': 'nomic', 'language-not-supported': 'service' })[e.error] || 'service';
      if(srUseLocal && r.error === 'service'){ srUseLocal = false; srLocal = 'unavailable'; }   // gói trên máy lỗi → quay về máy chủ
    };
    sr.onend = () => {
      r.srDone = true;
      try{ if(r.mr && r.mr.state !== 'inactive') r.mr.stop(); else r.mrDone = true; }catch(e){ r.mrDone = true; }
      r.finish();
    };
    try{ sr.start(); }catch(e){ r.srDone = true; r.error = 'service'; }
  }
  r.timer = setTimeout(recStop, (opts.sentence ? 16 : 6) * 1000);
}
function recStop(){
  const r = recCur; if(!r || !r.finish) return;
  if(r.sr && !r.srDone){ try{ r.sr.stop(); }catch(e){ r.srDone = true; } }
  if(!r.sr || r.srDone){
    try{ if(r.mr && r.mr.state !== 'inactive') r.mr.stop(); else r.mrDone = true; }catch(e){ r.mrDone = true; }
  }
  r.finish();
}

/* ── Chấm điểm từ kết quả nhận diện ── */
const normSpeech = s => (s || '').toLowerCase().replace(/[’‘`]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
function lev(a, b){
  const m = a.length, n = b.length;
  if(!m) return n; if(!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for(let i = 1; i <= m; i++){
    const cur = [i];
    for(let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
const simStr = (a, b) => (!a && !b) ? 1 : 1 - lev(a, b) / Math.max(a.length, b.length);
const confFactor = c => c > 0 ? 0.75 + 0.25 * c : 1;      // trình duyệt không trả độ tin cậy → không phạt
function scoreWord(target, alts){
  const tg = normSpeech(target).replace(/ /g, ''), nTok = normSpeech(target).split(' ').length;
  let best = { score: 0, heard: '', match: '' };
  alts.forEach((a, i) => {
    const toks = normSpeech(a.t).split(' ').filter(Boolean);
    const cands = [toks.join(' ')];
    for(let k = 0; k + nTok <= toks.length; k++) cands.push(toks.slice(k, k + nTok).join(' '));
    for(const c of cands){
      const s = simStr(c.replace(/ /g, ''), tg) * confFactor(a.c) * (1 - 0.04 * i);
      if(s > best.score) best = { score: s, heard: a.t.trim(), match: c.replace(/ /g, '') };
    }
  });
  return { score: Math.round(best.score * 100), heard: best.heard, diff: letterDiff(tg, best.match) };
}
function letterDiff(target, heard){              // đánh dấu chữ cái của từ mục tiêu không khớp
  const m = target.length, n = heard.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for(let i = m - 1; i >= 0; i--) for(let j = n - 1; j >= 0; j--)
    dp[i][j] = target[i] === heard[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ok = new Array(m).fill(false);
  let i = 0, j = 0;
  while(i < m && j < n){
    if(target[i] === heard[j]){ ok[i] = true; i++; j++; }
    else if(dp[i + 1][j] >= dp[i][j + 1]) i++; else j++;
  }
  return ok;
}
function scoreSentence(target, alts){
  const tt = normSpeech(target).split(' ').filter(Boolean);
  let best = { score: 0, heard: '', marks: tt.map(() => 0) };
  alts.forEach((a, ai) => {
    const ht = normSpeech(a.t).split(' ').filter(Boolean);
    const m = tt.length, n = ht.length;
    const w = (x, y) => x === y ? 1 : simStr(x, y) >= 0.7 ? 0.5 : 0;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for(let i = m - 1; i >= 0; i--) for(let j = n - 1; j >= 0; j--){
      const ww = w(tt[i], ht[j]);
      dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1], ww ? dp[i + 1][j + 1] + ww : 0);
    }
    const marks = tt.map(() => 0);
    let i = 0, j = 0;
    while(i < m && j < n){
      const ww = w(tt[i], ht[j]);
      if(ww && dp[i][j] === dp[i + 1][j + 1] + ww){ marks[i] = ww; i++; j++; }
      else if(dp[i + 1][j] >= dp[i][j + 1]) i++; else j++;
    }
    const extra = Math.max(0, n - m) / Math.max(m, 1);          // nói thừa nhiều → trừ nhẹ
    const s = dp[0][0] / Math.max(m, 1) * confFactor(a.c) * (1 - 0.04 * ai) * (1 - Math.min(0.2, extra * 0.3));
    if(s > best.score) best = { score: s, heard: a.t.trim(), marks };
  });
  return { score: Math.round(best.score * 100), heard: best.heard, marks: best.marks, toks: tt };
}
