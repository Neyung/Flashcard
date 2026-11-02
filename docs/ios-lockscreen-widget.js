// ═══════════════════════════════════════════════════════════
// WIDGET MÀN HÌNH KHOÁ iPHONE — dùng app Scriptable (miễn phí)
// Hiện lần lượt 10 từ cần học (chỉ từ + nghĩa), chạm vào → mở web: Flashcard cho đúng 10 từ đó,
// học xong tự quay về sổ từ.
//
// CÀI ĐẶT (1 lần):
// 1. App Store → cài "Scriptable".
// 2. Scriptable → "+" → dán toàn bộ file này → đặt tên "So Ngu" → Done.
// 3. Giữ màn hình khoá → Tuỳ chỉnh → Màn hình khoá → thêm widget → Scriptable
//    → chọn ô chữ nhật (to nhất).
// 4. Chạm vào widget vừa thêm → Script: "So Ngu" · When Interacting: "Run Script"
//    · Parameter: tên người dùng của bạn (vd: Tom).
//    (Ở màn hình chính cũng thêm được widget cỡ Vừa/Lớn → hiện cả danh sách.)
//
// Thứ tự 10 từ giống hệt chế độ "Ôn nhanh 10 từ" trong web (js/features/quick-review.js):
// điểm ưu tiên priorityScore (js/core/srs.js), từ ⭐ ×1.8, bỏ từ "bỏ qua hôm nay".
// Đổi từ mỗi 5 phút: từ hiển thị được tính theo đồng hồ (mốc 5 phút) và widget xin iOS làm mới
// đúng mốc kế tiếp. iOS có "ngân sách" làm mới riêng nên đôi khi trễ hơn 5 phút — khi làm mới,
// widget luôn nhảy tới đúng từ của mốc hiện tại.
// ═══════════════════════════════════════════════════════════
const CLOUD_URL = 'https://flashcard-53fb0-default-rtdb.firebaseio.com';
const APP_URL = 'https://flashcard.knowlytics.work/?quick';
const USER = (args.widgetParameter || '').trim() || 'Tom';
const N = 10, DAY = 86400000, STAR_BOOST = 1.8, SLOT = 5 * 60 * 1000;

// Chạy script trong app Scriptable hoặc chạm widget → mở web Ôn nhanh
if (!config.runsInWidget) {
  Safari.open(APP_URL);
  Script.complete();
  return;
}

const now = Date.now();
const todayKey = () => { const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const acc = s => s.seen ? s.correct / s.seen : 0;

// Bản sao priorityScore trong js/core/srs.js — sửa bên đó thì sửa cả ở đây
function priorityScore(w) {
  const s = w.stats;
  let p = 10;
  if (s.seen === 0) p += 32;
  if (w.saved) p += 24;
  const a = acc(s);
  p += (1 - a) * 30;
  if (w.saved && a >= 0.9 && s.seen >= 4) p -= 20;
  const overdue = (now - s.due) / DAY;
  if (overdue >= 0) p += Math.min(34, 8 + overdue * 6);
  else p += Math.max(-26, overdue * 9);
  if (s.avgTime > 9000) p += 12;
  else if (s.avgTime > 5000) p += 6;
  else if (s.avgTime > 0 && s.avgTime < 2500) p -= 4;
  p += Math.min(12, (s.lapses || 0) * 3);
  p -= Math.min(14, (s.streak || 0) * 2);
  return Math.max(1, p);
}

// Lưu bản tải gần nhất → mất mạng vẫn hiện được
const fm = FileManager.local();
const cachePath = fm.joinPath(fm.documentsDirectory(), 'songu-' + USER + '.json');
let words = null;
try {
  const req = new Request(CLOUD_URL + '/users/' + encodeURIComponent(USER) + '/words.json');
  req.timeoutInterval = 10;
  words = await req.loadJSON();
} catch (e) {}
let state = {};
if (fm.fileExists(cachePath)) { try { state = JSON.parse(fm.readString(cachePath)); } catch (e) {} }
if (Array.isArray(words)) {
  state.words = words.map(w => ({ word: w.word, meaning: w.meaning, saved: !!w.saved, limitDay: w.limitDay, stats: w.stats }));
  fm.writeString(cachePath, JSON.stringify(state));
}
words = state.words || [];

const base = { seen: 0, correct: 0, streak: 0, lapses: 0, due: now, avgTime: 0 };
const list = words.filter(w => w && w.word && w.limitDay !== todayKey())
  .map(w => Object.assign(w, { stats: Object.assign({}, base, w.stats || {}) }))
  .map(w => ({ w, p: priorityScore(w) * (w.saved ? STAR_BOOST : 1) }))
  .sort((a, b) => b.p - a.p).slice(0, N).map(x => x.w);

const slot = Math.floor(now / SLOT);                   // mốc 5 phút hiện tại
const idx = list.length ? slot % list.length : 0;

const wg = new ListWidget();
wg.url = APP_URL;
wg.refreshAfterDate = new Date((slot + 1) * SLOT);    // xin làm mới đúng mốc 5 phút kế tiếp
const fam = config.widgetFamily || 'accessoryRectangular';

if (!list.length) {
  wg.addText(Array.isArray(state.words) ? 'Chưa có từ nào cần học' : 'Không tải được — kiểm tra tên người dùng');
} else if (fam.startsWith('accessory')) {           // màn hình khoá: chỉ từ + nghĩa, mỗi lần 1 từ
  // Ô chữ nhật chỉ cao ~4 dòng: bỏ lề, nghĩa tối đa 3 dòng và tự thu nhỏ chữ trước khi phải cắt "…";
  // nghĩa quá dài (nhiều nghĩa ngăn bởi ";" hoặc "/") → chỉ lấy nghĩa đầu tiên
  const w = list[idx];
  let mean = (w.meaning || '').trim();
  if (mean.length > 55) mean = mean.split(/[;\/]/)[0].trim() || mean;
  // từ / cụm từ dài (> 18 ký tự) được xuống 2 dòng thay vì bị cắt "…", nghĩa nhường lại 1 dòng
  const longWord = w.word.length > 18;
  wg.setPadding(0, 0, 0, 0);
  const h = wg.addText(w.word);
  h.font = Font.boldSystemFont(longWord ? 14 : 15); h.lineLimit = longWord ? 2 : 1; h.minimumScaleFactor = 0.6;
  const m = wg.addText(mean);
  m.font = Font.systemFont(13); m.lineLimit = longWord ? 2 : 3; m.minimumScaleFactor = 0.65;
} else {                                            // màn hình chính: cả danh sách
  wg.backgroundColor = new Color('#FFFDF4');
  const ink = new Color('#23284A');
  const t = wg.addText(`Sổ Ngữ · ${list.length} từ cần học`);
  t.font = Font.boldSystemFont(13); t.textColor = new Color('#1E5EFF');
  wg.addSpacer(6);
  const max = fam === 'large' ? N : fam === 'medium' ? 4 : 3;
  for (let k = 0; k < Math.min(max, list.length); k++) {
    const w = list[(idx + k) % list.length];
    const r = wg.addText(`${w.word} — ${w.meaning || ''}`);
    r.font = Font.systemFont(12); r.textColor = ink; r.lineLimit = 1;
    wg.addSpacer(3);
  }
}
Script.setWidget(wg);
Script.complete();
