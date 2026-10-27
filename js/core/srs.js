/* ═══════════════════════════════════════════════════════════
   BỘ LẬP LỊCH ƯU TIÊN (tự ghi nhận tần suất + thời gian học)
   ═══════════════════════════════════════════════════════════ */
function accuracy(w){ return w.stats.seen ? w.stats.correct / w.stats.seen : 0; }

/* ── §5 Mức độ ghi nhớ (giai đoạn học) & câu ngữ cảnh cloze ──
   Hiển thị theo nguyên tắc đã được nghiên cứu:
   - retrieval practice: gợi nhớ chủ động qua ô trống/cloze
   - encoding theo ngữ cảnh: từ luôn đi kèm câu ví dụ
   - phản hồi tức thì + theo dõi tiến độ: huy hiệu giai đoạn  */
function masteryOf(w){
  if(!w.stats.seen)            return { label:t('lvNew'),    cls:'lv-new'    };
  const iv = w.stats.interval || 0;
  if(iv < 3)                   return { label:t('lvLearn'),  cls:'lv-learn'  };
  if(iv < 14)                  return { label:t('lvKnown'),  cls:'lv-known'  };
  return                              { label:t('lvMaster'), cls:'lv-master' };
}
const lvBadge = w => { const m = masteryOf(w);
  return `<span class="lv ${m.cls}" title="${t('priorityTitle', Math.round(priorityScore(w)))}">${m.label}</span>`; };

function clozeHtml(w){            // câu ví dụ với từ bị che — mặt trước thẻ
  if(!w.sentence) return '';
  const i = w.sentence.toLowerCase().indexOf(w.word.toLowerCase());
  if(i < 0) return '';
  return esc(w.sentence.slice(0, i))
       + '<span class="blank">·····</span>'
       + esc(w.sentence.slice(i + w.word.length));
}
function highlightHtml(w){        // câu ví dụ với từ được tô sáng — mặt sau thẻ
  if(!w.sentence) return '';
  const i = w.sentence.toLowerCase().indexOf(w.word.toLowerCase());
  if(i < 0) return esc(w.sentence);
  return esc(w.sentence.slice(0, i))
       + '<mark>' + esc(w.sentence.slice(i, i + w.word.length)) + '</mark>'
       + esc(w.sentence.slice(i + w.word.length));
}

function priorityScore(w){
  const s = w.stats;
  let p = 10;

  if(s.seen === 0) p += 32;                       // từ mới → ưu tiên gặp sớm
  if(w.saved) p += 24;                            // từ ⭐ đang học → ưu tiên

  const acc = accuracy(w);
  p += (1 - acc) * 30;                            // hay sai → tăng tần suất
  if(w.saved && acc >= 0.9 && s.seen >= 4) p -= 20; // lưu nhưng đúng hết → giảm bớt

  const overdue = (now() - s.due) / DAY;          // SRS: đến hạn / quá hạn
  if(overdue >= 0) p += Math.min(34, 8 + overdue * 6);
  else p += Math.max(-26, overdue * 9);           // chưa đến hạn → hạ xuống

  if(s.avgTime > 9000) p += 12;                   // trả lời chậm = chưa thuộc
  else if(s.avgTime > 5000) p += 6;
  else if(s.avgTime > 0 && s.avgTime < 2500) p -= 4;

  p += Math.min(12, s.lapses * 3);                // hay quên (leech) → kèm thêm
  p -= Math.min(14, s.streak * 2);                // chuỗi đúng dài → giãn ra
  return Math.max(1, p);
}

let lastShownId = null;
const STAR_BOOST = 1.8;                           // từ ⭐ luôn hiện dày hơn từ thường cùng tình trạng
function pickWord(pool){
  if(!pool.length) return null;
  let cands = pool.filter(w => w.id !== lastShownId);
  if(!cands.length) cands = pool;
  const weights = cands.map(w => Math.pow(priorityScore(w), 1.6) * (w.saved ? STAR_BOOST : 1));
  const total = weights.reduce((a,b)=>a+b,0);
  let r = Math.random() * total;
  for(let i=0;i<cands.length;i++){ r -= weights[i]; if(r<=0) return cands[i]; }
  return cands[cands.length-1];
}

/* Bỏ qua từ trong hôm nay: từ bị đánh dấu (w.limitDay = ngày hôm nay) không xuất hiện lại
   trong Luyện gõ lẫn Flashcard cho tới hết ngày. Sang ngày mới limitDay không còn khớp
   → tự trở lại bình thường, không cần dọn dẹp. */
const todayKey = () => { const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); };
const isLimitedToday = w => w.limitDay === todayKey();
const LIMIT_LS = 'soTuLimitRate_v1';
function resetLimitLog(){ try{ localStorage.removeItem(LIMIT_LS); }catch(e){} }   // dọn khoá cũ (bản đếm tỉ lệ)
function pickWordLimited(pool){                    // null = mọi từ trong phạm vi đều đã bỏ qua hôm nay
  const norm = pool.filter(w => !isLimitedToday(w));
  return norm.length ? pickWord(norm) : null;
}

/* Nghĩa có thể gồm nhiều phần ngăn bởi ";" hoặc "/" — vd "một cách tập trung; dồn hết sự chú ý…".
   Khi hiển thị để đoán từ (Luyện gõ, Flashcard) chỉ lấy ngẫu nhiên MỘT phần. */
const meaningParts = m => { const ps = String(m || '').split(/[;\/]/).map(x => x.trim()).filter(Boolean);
  return ps.length ? ps : [String(m || '').trim()]; };
const pickMeaningPart = w => { const ps = meaningParts(w.meaning); return ps[Math.floor(Math.random() * ps.length)]; };

/* grade: 0 = quên/sai · 1 = mơ hồ · 2 = nhớ/đúng
   charCount (tuỳ chọn): số ký tự đã gõ trong Luyện gõ — dùng để chuẩn hoá
   tốc độ theo ms/ký tự thay vì thời gian gõ tuyệt đối, tránh thiên vị
   từ ngắn (vốn gõ nhanh hơn từ dài dù mức độ thuộc từ là như nhau) */
function applyGrade(w, grade, timeMs, charCount, hintLevel){
  if(!w.stats) w.stats = newStats();
  const s = w.stats;
  if(!Array.isArray(s.times)) s.times = [];
  s.seen++; s.lastSeen = now();
  if(timeMs){
    s.times.push(timeMs);
    if(s.times.length > 20) s.times.shift();
    s.avgTime = Math.round(s.times.reduce((a,b)=>a+b,0) / s.times.length);
  }
  if(grade === 0){
    s.wrong++; s.streak = 0; s.lapses++;
    s.ease = Math.max(1.3, s.ease - 0.2);
    s.interval = 0;
    s.due = now() + 10*60*1000;                   // gặp lại sau ~10 phút
  }else if(grade === 1 && hintLevel >= 2){
    s.correct++; s.streak = Math.floor(s.streak / 2);
    s.ease = Math.max(1.3, s.ease - 0.15);
    s.interval = Math.max(0.3, (s.interval || 0.3) * 0.6);
    s.due = now() + s.interval * DAY;
  }else if(grade === 1){
    s.correct++; s.streak++;
    s.ease = Math.max(1.3, s.ease - 0.05);
    s.interval = Math.max(0.5, (s.interval || 0.3) * 1.25);
    s.due = now() + s.interval * DAY;
  }else{
    s.correct++; s.streak++;
    const perChar = charCount ? timeMs / charCount : null;
    const isFast = perChar != null ? perChar < 180 : (timeMs && timeMs < 3000);
    if(isFast) s.ease = Math.min(2.9, s.ease + 0.08); // trả lời nhanh (chuẩn hoá theo độ dài nếu có)
    else s.ease = Math.min(2.8, s.ease + 0.03);
    s.interval = s.interval < 0.5 ? 1 : s.interval * s.ease;
    s.interval *= (0.95 + Math.random()*0.1);     // fuzz nhẹ chống dồn lịch
    s.interval = Math.min(s.interval, 180);
    s.due = now() + s.interval * DAY;
  }
  save(); renderStats();
}
