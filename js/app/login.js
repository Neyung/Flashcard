/* ════ ĐĂNG NHẬP ═══════════════════════════════════════════ */
const loginSteps = () => $('#loginSteps');
const avatarHtml = u => `<span class="user-avatar" style="background:${userColor(u)}">${esc(u[0]||'?')}</span>`;

async function renderPick(){
  currentLoginStep = renderPick;
  loginSteps().innerHTML = `<p class="login-sub">${t('loadingUsers')}</p>`;
  await loadUserList();
  await loadLastLogins();
  loginSteps().innerHTML = `
    <p class="login-sub">${t('pickUserSub')}</p>
    <div class="user-grid many">
      ${userList.map(u => `
        <div class="user-card" data-user="${esc(u)}">
          <button class="user-del" data-del="${esc(u)}" title="${t('deleteAccountTitle')}">${I('trash')}</button>
          ${avatarHtml(u)}${esc(u)}
          <span class="user-last">${lastLoginLabel(u)}</span>
        </div>`).join('')}
      <button class="user-card add" id="addUserBtn">
        <span class="user-avatar">${I('plus')}</span>${t('addPerson')}</button>
    </div>
    ${cloudOn() ? '' : infoCorner([t('loginNoteNoCloud')])}`;
  $$('#loginSteps .user-card[data-user]').forEach(card =>
    card.addEventListener('click', e => {
      if(e.target.closest('.user-del')) return;
      pickUser(card.dataset.user);
    }));
  $$('#loginSteps .user-del').forEach(btn =>
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const u = btn.dataset.del;
      const pw = prompt(t('deletePwPrompt', u));
      if(pw === null) return;                          // huỷ hộp thoại
      const h = await hashText(pw, DELETE_PW_SALT);
      if(h !== DELETE_PW_HASH){ toast(t('deletePwWrong')); return; }
      await deleteUserAccount(u);
      toast(t('toastAccountDeleted', u)); renderPick();
    }));
  $('#addUserBtn').addEventListener('click', renderAddUser);
}

function renderAddUser(){
  currentLoginStep = renderAddUser;
  loginSteps().innerHTML = `
    <p class="login-sub">${t('newUserSub')}</p>
    <div class="login-form">
      <div class="fg"><label>${t('newUserNameLbl')}</label>
        <input type="text" id="lgNewName" maxlength="12" placeholder="${esc(t('newUserNamePh'))}"></div>
      <p class="login-err" id="lgErr"></p>
      <div class="login-actions">
        <button class="login-back" id="lgBack">${t('backBtn')}</button>
        <button class="btn mint sm" id="lgAddGo">${I('plus')}${t('createUserBtn')}</button>
      </div>
    </div>`;
  $('#lgBack').addEventListener('click', renderPick);
  const go = async () => {
    const name = $('#lgNewName').value.trim();
    const err = $('#lgErr');
    if(!name){ err.textContent = t('errEnterName'); return; }
    if(/[.#$\[\]\/]/.test(name)){ err.textContent = t('errNameChars'); return; }
    if(userList.some(u => u.toLowerCase() === name.toLowerCase())){
      err.textContent = t('errNameTaken'); return; }
    userList.push(name);
    await saveUserList();
    pickUser(name);            // người mới → đi thẳng vào bước tạo mật khẩu
  };
  $('#lgAddGo').addEventListener('click', go);
  $('#lgNewName').addEventListener('keydown', e => { if(e.key === 'Enter') go(); });
  $('#lgNewName').focus();
}

async function pickUser(u){
  currentUser = u;
  loginSteps().innerHTML = `<p class="login-sub">${t('checking')}</p>`;
  const rec = await getAuth(u);
  if(rec) renderLogin(rec); else renderSetup();
}

/* Lần đầu: tạo mật khẩu mới + câu hỏi đặc biệt */
function renderSetup(){
  currentLoginStep = renderSetup;
  loginSteps().innerHTML = `
    <div class="login-who">${avatarHtml(currentUser)}<div><b>${currentUser}</b>
      <p class="login-sub" style="margin:2px 0 0">${t('setupSub')}</p></div></div>
    <div class="login-form">
      <div class="fg"><label>${t('newPwLbl')}</label>
        <input type="password" id="lgPw1" autocomplete="new-password"></div>
      <div class="fg"><label>${t('newPw2Lbl')}</label>
        <input type="password" id="lgPw2" autocomplete="new-password"></div>
      <div class="fg"><label>${t('secQLbl')}</label>
        <input type="text" id="lgQ" placeholder="${esc(t('secQPh'))}"></div>
      <div class="fg"><label>${t('secALbl')}</label>
        <input type="text" id="lgA"></div>
      <p class="login-err" id="lgErr"></p>
      <div class="login-actions">
        <button class="login-back" id="lgBack">${t('backOtherUser')}</button>
        <button class="btn mint sm" id="lgCreate"><svg class="ic"><use href="#i-check"/></svg>${t('createAndEnter')}</button>
      </div>
    </div>`;
  $('#lgBack').addEventListener('click', renderPick);
  $('#lgCreate').addEventListener('click', doSetup);
  $('#lgA').addEventListener('keydown', e => { if(e.key === 'Enter') doSetup(); });
  $('#lgPw1').focus();
}

async function doSetup(){
  const pw1 = $('#lgPw1').value, pw2 = $('#lgPw2').value;
  const q = $('#lgQ').value.trim(), a = $('#lgA').value.trim();
  const err = $('#lgErr');
  if(pw1.length < 4)        { err.textContent = t('errPwLen'); return; }
  if(pw1 !== pw2)           { err.textContent = t('errPwMismatch'); return; }
  if(!q || !a)              { err.textContent = t('errFillSecQ'); return; }
  err.textContent = '';
  const salt = newSalt();
  const rec = {
    salt,
    pwHash: await hashText(pw1, salt),
    q,
    aHash: await hashText(a.toLowerCase(), salt),
  };
  await putAuth(currentUser, rec);
  enterApp(rec.pwHash);
}

/* Lần sau: nhập mật khẩu + quên mật khẩu */
function renderLogin(rec){
  currentLoginStep = () => renderLogin(rec);
  loginSteps().innerHTML = `
    <div class="login-who">${avatarHtml(currentUser)}<div><b>${currentUser}</b>
      <p class="login-sub" style="margin:2px 0 0">${t('loginSub')}</p></div></div>
    <div class="login-form">
      <div class="fg"><label>${t('pwLbl')}</label>
        <input type="password" id="lgPw" autocomplete="current-password"></div>
      <p class="login-err" id="lgErr"></p>
      <div class="login-actions">
        <button class="login-back" id="lgBack">${t('backOtherUser')}</button>
        <div>
          <button class="login-link" id="lgForgot">${t('forgotPw')}</button>
          <button class="btn sky sm" id="lgGo"><svg class="ic"><use href="#i-lock"/></svg>${t('loginBtn')}</button>
        </div>
      </div>
    </div>`;
  $('#lgBack').addEventListener('click', renderPick);
  $('#lgForgot').addEventListener('click', () => renderForgot(rec));
  const go = async () => {
    const h = await hashText($('#lgPw').value, rec.salt);
    if(h === rec.pwHash) enterApp(rec.pwHash);
    else $('#lgErr').textContent = t('errPwWrong');
  };
  $('#lgGo').addEventListener('click', go);
  $('#lgPw').addEventListener('keydown', e => { if(e.key === 'Enter') go(); });
  $('#lgPw').focus();
}

/* Quên mật khẩu: trả lời câu hỏi đặc biệt → quay lại tạo mật khẩu mới */
function renderForgot(rec){
  currentLoginStep = () => renderForgot(rec);
  loginSteps().innerHTML = `
    <div class="login-who">${avatarHtml(currentUser)}<div><b>${currentUser}</b>
      <p class="login-sub" style="margin:2px 0 0">${t('forgotSub')}</p></div></div>
    <div class="login-form">
      <div class="fg"><label>${t('secQLbl')}</label>
        <input type="text" value="${rec.q.replace(/"/g,'&quot;')}" disabled style="background:var(--lemon)"></div>
      <div class="fg"><label>${t('secALbl')}</label>
        <input type="text" id="lgA"></div>
      <p class="login-err" id="lgErr"></p>
      <div class="login-actions">
        <button class="login-back" id="lgBack">${t('backBtn')}</button>
        <button class="btn peach sm" id="lgReset"><svg class="ic"><use href="#i-next"/></svg>${t('continueBtn')}</button>
      </div>
    </div>`;
  $('#lgBack').addEventListener('click', () => renderLogin(rec));
  const reset = async () => {
    const h = await hashText($('#lgA').value.trim().toLowerCase(), rec.salt);
    if(h !== rec.aHash){ $('#lgErr').textContent = t('errAnsWrong'); return; }
    await putAuth(currentUser, null);   // xoá mật khẩu cũ
    toast(t('toastVerified'));
    renderSetup();                       // quay lại cửa sổ tạo mật khẩu ban đầu
  };
  $('#lgReset').addEventListener('click', reset);
  $('#lgA').addEventListener('keydown', e => { if(e.key === 'Enter') reset(); });
  $('#lgA').focus();
}

/* Ghi nhớ đăng nhập trên máy: tải lại trang không phải đăng nhập lại.
   Lưu kèm bản băm mật khẩu lúc đăng nhập — đổi mật khẩu / xoá tài khoản → phiên tự hết hiệu lực.
   "Đổi người dùng" xoá phiên; quá SESSION_DAYS ngày cũng phải đăng nhập lại. */
const SESSION_KEY = 'soTuSession_v1', SESSION_DAYS = 30;
function saveSession(user, pwHash){
  try{ localStorage.setItem(SESSION_KEY, JSON.stringify({ user, pwHash, at: now() })); }catch(e){}
}
function clearSession(){ try{ localStorage.removeItem(SESSION_KEY); }catch(e){} }
async function restoreSession(){
  let s = null;
  try{ s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }catch(e){}
  if(!s || !s.user || !s.pwHash || now() - (s.at || 0) > SESSION_DAYS * DAY){ clearSession(); return false; }
  loginSteps().innerHTML = `<p class="login-sub">${t('checking')}</p>`;
  await loadUserList();
  const rec = userList.includes(s.user) ? await getAuth(s.user) : null;
  if(!rec || rec.pwHash !== s.pwHash){ clearSession(); return false; }
  currentUser = s.user;
  await enterApp(rec.pwHash);
  return true;
}

/* Vào app sau khi đăng nhập */
async function enterApp(pwHash){
  if(pwHash) saveSession(currentUser, pwHash);
  loginSteps().innerHTML = `<p class="login-sub">${t('openingBook', currentUser)}</p>`;
  await loadUser();
  await loadTasks();
  await loadSacred();
  markLogin();
  $('#userName').textContent = currentUser;
  $('#loginOverlay').style.display = 'none';
  quiz = null; fc = null; quizGroupAll = true; quizGroupSet = new Set(); groupFilter.reset(); fcGroupFilter.reset(); wordSel.sel.clear(); resetLimitLog(); updateStreakUI(quizStreak); lastShownId = null;
  applyI18n();
  activateTab($('.tab-btn[data-tab="tasks"]'));
  $('#trFab').hidden = false; $('#lxFab').hidden = false; $('#topFab').hidden = false; $('#dialFab').hidden = false; updateTopFab();
  loadGarden();
  renderTable();
  renderStats();
  prefetchPhonetics();
  if(memoryOnly) toast(t('memoryOnlyWarn'));
  cefrInit();
  scShowPending();                       // thử thách còn dang dở (tải lại trang giữa chừng) → mở lại
}

/* Đổi người dùng */
$('#userChip').addEventListener('click', () => {
  clearSession();                       // chủ động đổi người → lần sau phải đăng nhập lại
  stopFocus(true);                      // dừng phiên tập trung nếu đang chạy
  recAbort();
  if(words) cloudSaveWords(true);       // đẩy nốt thay đổi đang chờ
  if(tasks) saveTasks(true);
  saveFocusLog(true);
  closeHist(); trClose(); lxClose(); $('#trFab').hidden = true; $('#lxFab').hidden = true; $('#topFab').hidden = true; $('#dialFab').hidden = true; setDial(false);
  currentUser = null; words = []; tasks = null; focusLog = {}; writeLog = [];
  updateTasksBadge(); updateHistBadge();
  renderTable(); renderStats();
  setSyncDot('');
  $('#loginOverlay').style.display = 'flex';
  renderPick();
});
