/* ═══════════════════════════════════════════════════════════
   SỔ NGỮ — Flashcard học từ vựng & luyện viết
   MỤC LỤC:
     §1  Cấu hình & người dùng        §6  Tab Ghi chú (bảng, nhập/xuất)
     §2  Dữ liệu mặc định & parser    §7  Tab Luyện gõ
     §3  Lưu trữ máy + đám mây        §8  Tab Flashcard (trắc nghiệm)
     §4  Bộ lập lịch SRS              §9  Tab Tập trung (hẹn giờ + hoa)
     §5  Mức độ ghi nhớ & cloze       §10 Đăng nhập & khởi động
   - Dữ liệu lưu localStorage (fallback bộ nhớ) + nhập/xuất file note
   - Bộ lập lịch ưu tiên: tần suất tự điều chỉnh theo
     (1) từ có ⭐ lưu hay không, (2) độ chính xác, (3) thời gian
     trả lời, (4) khoảng cách ôn tập giãn dần để nhớ lâu (SRS)
   ═══════════════════════════════════════════════════════════ */

/* ── Người dùng & đồng bộ đám mây ────────────────────────────
   Để sổ tay theo người dùng trên MỌI thiết bị:
   1. Vào console.firebase.google.com → tạo project (miễn phí)
   2. Build → Realtime Database → Create (chọn chế độ test mode)
   3. Copy URL database (dạng https://ten-project-default-rtdb...firebasedatabase.app)
      và dán vào CLOUD_URL bên dưới (bỏ dấu / ở cuối nếu có).
   Để trống '' = chỉ lưu trên trình duyệt của từng máy.            */
const CLOUD_URL = 'https://flashcard-53fb0-default-rtdb.firebaseio.com';
const APP_VERSION = 'v4.0 · 14-10-2026';

const DEFAULT_USERS = ['Ni','Tom','Dinh'];
const USERS_KEY = 'soTuUsers_v1';
const PALETTE = ['var(--mint)','var(--sky)','var(--peach)','var(--lav)','var(--lemon)','var(--pink)'];
let userList = [...DEFAULT_USERS];
const userColor = u => PALETTE[Math.max(0, userList.indexOf(u)) % PALETTE.length];

async function loadUserList(){
  let list = null;
  if(cloudOn()){
    try{ const cl = await cloudGet('meta/users'); if(Array.isArray(cl) && cl.length) list = cl; }
    catch(e){}
  }
  if(!list){
    try{ const raw = localStorage.getItem(USERS_KEY); if(raw) list = JSON.parse(raw); }catch(e){}
  }
  userList = (Array.isArray(list) && list.length) ? list : [...DEFAULT_USERS];
  for(const d of DEFAULT_USERS) if(!userList.includes(d)) userList.push(d);
}
async function saveUserList(){
  try{ localStorage.setItem(USERS_KEY, JSON.stringify(userList)); }catch(e){}
  if(cloudOn()){
    try{ await cloudPut('meta/users', userList); }
    catch(e){ toast(t('cloudUsersErr')); }
  }
}

/* ── Mốc đăng nhập gần nhất của từng người ── */
const LASTLOGIN_KEY = 'soTuLastLogin_v1';
let lastLogins = {};                       // { Tên: timestamp(ms) }
async function loadLastLogins(){
  let map = {};
  try{ map = JSON.parse(localStorage.getItem(LASTLOGIN_KEY) || '{}'); }catch(e){}
  if(cloudOn()){
    try{
      const cl = await cloudGet('meta/lastLogin');
      if(cl && typeof cl === 'object') map = { ...map, ...cl };
    }catch(e){}
  }
  lastLogins = map;          // gán một lần — tránh hai lần gọi chồng nhau xoá dữ liệu của nhau
}
async function markLogin(){
  lastLogins[currentUser] = Date.now();
  try{ localStorage.setItem(LASTLOGIN_KEY, JSON.stringify(lastLogins)); }catch(e){}
  if(cloudOn()){
    try{ await cloudPut('meta/lastLogin/' + currentUser, lastLogins[currentUser]); }catch(e){}
  }
}
function lastLoginLabel(u){
  const ts = lastLogins[u];
  if(!ts) return t('neverLoggedIn');
  const days = Math.floor((Date.now() - ts) / 86400000);
  if(days <= 0) return t('today');
  if(days === 1) return t('yesterday');
  return t('daysAgo', days);
}
/* Mật khẩu xác nhận xoá tài khoản — chỉ lưu bản băm SHA-256 (không lưu chữ
   thô trong code) để đối chiếu bằng hashText() có sẵn của app. */
const DELETE_PW_SALT = 'sngu_del_2026';
const DELETE_PW_HASH = '33c5d769ba607a9f12ccc59f1e0a2899b07954536cad5e5ae24e586f6bbee6c9';
/* Xoá vĩnh viễn một tài khoản: khỏi danh sách người dùng, mật khẩu, mốc đăng
   nhập, và toàn bộ dữ liệu (từ vựng, nhiệm vụ, vườn hoa) trên máy lẫn trên
   mây — 'users/<tên>' trên Firebase chứa cả words/sentences_v2/garden nên
   một lệnh xoá là đủ cho tất cả. */
async function deleteUserAccount(user){
  userList = userList.filter(u => u !== user);
  await saveUserList();
  await putAuth(user, null);
  delete lastLogins[user];
  try{ localStorage.setItem(LASTLOGIN_KEY, JSON.stringify(lastLogins)); }catch(e){}
  try{ localStorage.removeItem('soTu_v3_' + user); }catch(e){}
  try{ localStorage.removeItem('soTuSentences_v4_' + user); }catch(e){}
  try{ localStorage.removeItem('soTuGarden_' + user); }catch(e){}
  try{ localStorage.removeItem('soTuTasks_' + user); }catch(e){}
  try{ localStorage.removeItem('soTuFocusLog_' + user); }catch(e){}
  try{ localStorage.removeItem('soTuSacred_' + user); localStorage.removeItem('soTuQuizStreak_' + user); }catch(e){}
  if(cloudOn()){
    try{ await cloudDelete('users/' + user); }catch(e){}
    try{ await cloudDelete('meta/lastLogin/' + user); }catch(e){}
  }
}
let currentUser = null;
const lsKey  = () => 'soTu_v3_' + currentUser;
const AUTH_KEY = 'soTuAuth_v1';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const now = () => Date.now();
const DAY = 86400000;
const I = n => `<svg class="ic"><use href="#i-${n}"/></svg>`;
