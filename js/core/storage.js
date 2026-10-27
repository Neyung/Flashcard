/* ── Băm mật khẩu (SHA-256, có fallback khi mở bằng file://) ── */
async function hashText(text, salt){
  const input = salt + '::' + text;
  try{
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
    return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
  }catch(e){
    let h1=0x811c9dc5, h2=0x9e3779b9;
    for(const ch of input){ const c=ch.codePointAt(0);
      h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
      h2 = (Math.imul(h2 ^ c, 0x85ebca6b) + 0x27d4eb2f) >>> 0; }
    return 'f' + h1.toString(16) + h2.toString(16);
  }
}
const newSalt = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

/* ── Hồ sơ đăng nhập (mật khẩu + câu hỏi đặc biệt) ── */
function localAuth(){ try{ return JSON.parse(localStorage.getItem(AUTH_KEY) || '{}'); }catch(e){ return {}; } }
function setLocalAuth(user, rec){
  const a = localAuth();
  if(rec === null) delete a[user]; else a[user] = rec;
  try{ localStorage.setItem(AUTH_KEY, JSON.stringify(a)); }catch(e){}
}
async function getAuth(user){
  if(cloudOn()){
    try{
      const rec = await cloudGet('auth/' + user);
      if(rec && rec.pwHash){ setLocalAuth(user, rec); return rec; }
      return null;                       // trên mạng chưa có → coi như lần đầu
    }catch(e){ /* mất mạng → dùng bản trên máy */ }
  }
  const rec = localAuth()[user];
  return (rec && rec.pwHash) ? rec : null;
}
async function putAuth(user, rec){
  setLocalAuth(user, rec);
  if(cloudOn()){
    try{ await cloudPut('auth/' + user, rec); }
    catch(e){ toast(t('cloudAuthErr')); }
  }
}

/* ── Đám mây (Firebase Realtime Database, REST) ── */
const cloudOn = () => !!CLOUD_URL;
async function cloudGet(path){
  const r = await fetch(CLOUD_URL + '/' + path + '.json', { cache:'no-store' });
  if(!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
async function cloudPut(path, data){
  const r = await fetch(CLOUD_URL + '/' + path + '.json', { method:'PUT', body: JSON.stringify(data) });
  if(!r.ok) throw new Error('HTTP ' + r.status);
}
async function cloudDelete(path){
  const r = await fetch(CLOUD_URL + '/' + path + '.json', { method:'DELETE' });
  if(!r.ok) throw new Error('HTTP ' + r.status);
}
let syncT = null, syncWarned = false;
function setSyncDot(state){
  const d = $('#syncDot');
  if(!d) return;
  d.className = 'sync-dot' + (cloudOn() && state ? ' ' + state : '');
}
function cloudSaveWords(immediate){
  if(!cloudOn() || !currentUser) return;
  clearTimeout(syncT);
  const doPut = async () => {
    try{ await cloudPut('users/' + currentUser + '/words', words); setSyncDot('ok'); syncWarned = false; }
    catch(e){
      setSyncDot('err');
      if(!syncWarned){ toast(t('cloudSaveErr')); syncWarned = true; }
    }
  };
  if(immediate) doPut(); else syncT = setTimeout(doPut, 1200);
}

/* ── Nạp / lưu sổ tay theo người dùng ── */
async function loadUser(){
  words = null; memoryOnly = false;
  if(cloudOn()){                                   // 1) ưu tiên bản trên mạng
    try{
      const cw = await cloudGet('users/' + currentUser + '/words');
      if(Array.isArray(cw) && cw.length){
        words = cw;
        try{ localStorage.setItem(lsKey(), JSON.stringify(words)); }catch(e){ memoryOnly = true; }
        setSyncDot('ok');
      }
    }catch(e){ setSyncDot('err'); }
  }
  if(!words){                                      // 2) bản trên máy
    try{
      const raw = localStorage.getItem(lsKey());
      if(raw) words = JSON.parse(raw);
    }catch(e){ memoryOnly = true; }
  }
  if(cloudOn()){                                   // vườn hoa trên mây
    try{
      const g = await cloudGet('users/' + currentUser + '/garden');
      if(g != null){
        try{ localStorage.setItem('soTuGarden_' + currentUser, JSON.stringify(g)); }catch(e){}
      }
    }catch(e){}
  }
  if(!words){                                      // 3) lần đầu tiên — sổ trống
    words = [];
    save();
  }
  for(const w of words) normalizeWord(w);
}

/* Firebase tự lược bỏ mảng/đối tượng rỗng khi lưu — vá lại đầy đủ
   các trường để không bao giờ gặp undefined ở giữa chừng */
function normalizeWord(w){
  if(typeof w.group !== 'string') w.group = '';
  if(typeof w.note  !== 'string') w.note  = '';
  if(typeof w.sentence !== 'string') w.sentence = '';
  if(typeof w.pos !== 'string') w.pos = '';
  w.saved = !!w.saved;
  if(!w.stats || typeof w.stats !== 'object') w.stats = newStats();
  else w.stats = Object.assign(newStats(), w.stats);
  if(!Array.isArray(w.stats.times)) w.stats.times = [];
  if(typeof w.ipa   !== 'string') w.ipa   = '';
  if(typeof w.audio !== 'string') w.audio = '';
  if(w.cefr && (typeof w.cefr !== 'object' || !(w.cefr.lv === '' || CEFR.includes(w.cefr.lv)))) delete w.cefr;
}
