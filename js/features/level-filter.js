/* ═══════════════════════════════════════════════════════════
   BỘ LỌC CẤP ĐỘ CEFR (A1 → C2) — gắn LUÔN vào menu lọc nhóm có sẵn (Sổ từ, Luyện gõ, Flashcard),
   không chiếm thêm hàng nào trên trang.
   - Đầu menu: dải 7 ô A1 A2 B1 B2 C1 C2 + "?" (chưa phân loại / AI chưa chắc), mỗi ô kèm số từ
     tính theo các bộ lọc KHÁC đang bật (nhóm, có sao, tìm kiếm); ô 0 từ bị mờ.
   - Bấm: bật/tắt · Shift+bấm: chọn khoảng (vd A2 → B2) · Nhấp đúp: chỉ giữ mức đó · "Bỏ lọc".
   - Không chọn ô nào = mọi cấp độ. Khi đang lọc, nút bộ lọc hiện thêm nhãn nhỏ "B1–B2".
   - Sổ chưa có từ nào được phân loại → ẩn phần cấp độ và không lọc gì.
   Dữ liệu cấp độ lấy từ w.cefr (js/features/cefr.js) — không tạo thêm dữ liệu riêng.
   ═══════════════════════════════════════════════════════════ */
const LV_KEYS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', '?'];
const wordLv = w => (w.cefr && w.cefr.lv) || '?';

/* o.base(): danh sách từ sau các bộ lọc khác · o.onChange(): làm lại danh sách
   o.tag(): phần tử nhãn nhỏ trong nút bộ lọc (hiện tóm tắt khi đang lọc) */
function makeLevelFilter(o){
  const sel = new Set();
  let shown = false, last = null, clickT = null;
  const root = document.createElement('div');
  root.className = 'lvf'; root.hidden = true;
  root.innerHTML = `<div class="lvf-head"><span class="lvf-lbl"></span><button type="button" class="lvf-x" hidden></button></div>`
    + `<div class="lvf-steps" role="group">`
    + LV_KEYS.map(k => `<button type="button" class="lvf-step lv-${k === '?' ? 'q' : k}" data-k="${k}" aria-pressed="false">`
      + `<b>${k}</b><span class="n">0</span></button>`).join('') + `</div>`;
  const btns = [...root.querySelectorAll('.lvf-step')], xBtn = root.querySelector('.lvf-x');

  /* Tóm tắt lựa chọn: "B1", "A2–B2", "A1, C1"; quá 2 đoạn → "4 cấp" */
  function summary(){
    if(!shown || !sel.size) return '';
    const idx = LV_KEYS.filter(k => sel.has(k)).map(k => LV_KEYS.indexOf(k));
    const runs = [];
    idx.forEach(i => { const r = runs[runs.length - 1]; r && r[1] === i - 1 ? r[1] = i : runs.push([i, i]); });
    if(runs.length > 2) return t('lvN', sel.size);
    return runs.map(([a, b]) => a === b ? LV_KEYS[a] : `${LV_KEYS[a]}–${LV_KEYS[b]}`).join(', ');
  }
  function paint(){
    const cnt = {};
    o.base().forEach(w => { const k = wordLv(w); cnt[k] = (cnt[k] || 0) + 1; });
    shown = words.some(w => w.cefr && w.cefr.lv);
    root.hidden = !shown;
    root.querySelector('.lvf-lbl').textContent = t('lvTitle');
    btns.forEach(b => {
      const k = b.dataset.k, n = cnt[k] || 0, on = sel.has(k);
      b.querySelector('.n').textContent = n;
      b.classList.toggle('on', on);
      b.classList.toggle('zero', !n && !on);
      b.hidden = k === '?' && !n && !on;          // "?" chỉ hiện khi còn từ chưa phân loại
      b.setAttribute('aria-pressed', String(on));
      b.title = (k === '?' ? t('lvUnknown') : k) + ` · ${n}\n` + t('lvTip');
    });
    root.classList.toggle('active', shown && sel.size > 0);
    xBtn.hidden = !shown || !sel.size;
    xBtn.textContent = t('lvClear');
    const s = summary(), tag = o.tag && o.tag();
    if(tag){ tag.hidden = !s; tag.textContent = s; tag.title = s ? 'CEFR: ' + s : ''; }
  }
  function changed(){ paint(); o.onChange(); }

  root.addEventListener('click', e => {
    if(e.target.closest('.lvf-x')){ sel.clear(); last = null; changed(); return; }
    const b = e.target.closest('.lvf-step'); if(!b) return;
    const k = b.dataset.k;
    if(e.detail === 2){                                    // nhấp đúp → chỉ mức này
      clearTimeout(clickT); sel.clear(); sel.add(k); last = k; changed(); return;
    }
    if(e.shiftKey && last && last !== k){                  // Shift → cả khoảng giữa 2 mức
      const [a, z] = [LV_KEYS.indexOf(last), LV_KEYS.indexOf(k)].sort((x, y) => x - y);
      LV_KEYS.slice(a, z + 1).forEach(x => { if(x !== '?' || k === '?' || last === '?') sel.add(x); });
    }else{
      sel.has(k) ? sel.delete(k) : sel.add(k);
    }
    last = k;
    if(sel.size === btns.filter(x => !x.hidden).length) sel.clear();   // chọn đủ = mọi cấp độ
    paint();
    clearTimeout(clickT); clickT = setTimeout(o.onChange, 280);       // bấm liên tiếp chỉ làm lại 1 lần
  });

  return {
    el: root,
    ok: w => !shown || !sel.size || sel.has(wordLv(w)),
    active: () => shown && sel.size > 0,
    paint,
    reset(){ sel.clear(); last = null; },
    get: () => [...sel],                                    // lưu / khôi phục khi tải lại trang
    set(v){ sel.clear(); (Array.isArray(v) ? v : []).forEach(k => { if(LV_KEYS.includes(k)) sel.add(k); }); },
  };
}

/* Lọc cấp độ làm rỗng danh sách → báo rõ lý do + nút bỏ lọc ngay tại chỗ */
const lvEmptyHtml = () => `${t('lvEmpty')}<br><button type="button" class="btn sm lv-reset-btn">${t('lvReset')}</button>`;
document.addEventListener('click', e => {
  if(!e.target.closest('.lv-reset-btn')) return;
  if(e.target.closest('#tab-quiz')){ quizLevel.reset(); startQuiz(); }
  else if(e.target.closest('#tab-flash')){ fcLevel.reset(); startFc(); }
  else if(e.target.closest('#tab-notes')){ notesLevel.reset(); renderTable(true); }
});
