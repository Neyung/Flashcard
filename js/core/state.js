let currentLoginStep = null;

/* ── State ───────────────────────────────────────────────── */
let words = [];
let memoryOnly = false;

function uid(){ return 'w' + Math.random().toString(36).slice(2,9) + now().toString(36).slice(-4); }

function newStats(){
  return { seen:0, correct:0, wrong:0, streak:0, lapses:0,
           ease:2.5, interval:0, due:now(), lastSeen:0,
           times:[], avgTime:0 };
}

function makeWord(word, pos, meaning, sentence, note, kind, saved=false, group=''){
  return { id:uid(), word:word.trim(), pos:(pos||'').trim(), meaning:(meaning||'').trim(),
           sentence:(sentence||'').trim(), note:(note||'').trim(),
           kind: kind==='cụm' ? 'cụm' : 'đơn', saved:!!saved,
           group:(group||'').trim(), stats:newStats() };
}
const groupsOf = () => [...new Set(words.map(w => w.group).filter(Boolean))]
  .sort((a,b) => a.localeCompare(b, 'vi'));

/* Parser dùng chung khi nhập file note.
   Mỗi dòng: từ | loại từ | nghĩa | đặt câu | chú thích | đơn/cụm | nhóm
   Dòng tiêu đề dạng "# ── Tên nhóm ──" sẽ gán nhóm cho các dòng bên dưới */
function parseNoteText(text, existing){
  const entries = [];
  let skipped = 0, curGroup = '';
  const dupKey = w => (w.word + '¦' + w.meaning).toLowerCase();
  const seen = new Set((existing||[]).map(dupKey));
  text.split(/\r?\n/).forEach(line=>{
    line = line.trim();
    if(!line) return;
    if(line.startsWith('#')){
      const m = line.match(/^#\s*─*\s*(?:\d+[a-z]?\.\s*)?([^─(]+?)\s*(?:\(.*\))?\s*─*\s*$/);
      if(m && /─/.test(line)) curGroup = m[1].trim();   // chỉ nhận dòng tiêu đề có gạch ──
      return;
    }
    const parts = line.split('|').map(s=>s.trim());
    if(parts.length < 3 || !parts[0] || !parts[2]){ skipped++; return; }
    const [word, pos, meaning, sentence='', note='', kindRaw='', groupRaw=''] = parts;
    const kind = /cụm|cum|phrase/i.test(kindRaw) ? 'cụm'
               : /đơn|don|single/i.test(kindRaw) ? 'đơn'
               : (word.includes(' ') ? 'cụm' : 'đơn');
    const w = makeWord(word, pos, meaning, sentence, note, kind, false, groupRaw || curGroup);
    if(seen.has(dupKey(w))){ skipped++; return; }
    seen.add(dupKey(w));
    entries.push(w);
  });
  return { entries, skipped };
}

/* Danh sách từ mặc định (được nhúng từ notes.txt) */
