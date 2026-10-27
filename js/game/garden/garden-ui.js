/* Khu vườn (bản xem trước) — sinh từ scratchpad garden/build_app.py. Không phụ thuộc thư viện ngoài. */
/* ═══ GardenUI — bộ component pixel-art dùng chung: nút chức năng + khung ô vật phẩm theo độ hiếm ═══
   Mọi thứ vẽ trên canvas ở độ phân giải gốc rồi phóng ×2/×3 bằng nearest neighbor (image-rendering: pixelated).
   Ánh sáng từ trên-trái, viền ngoài 1 px #2b1a10, thống nhất với sprite vật phẩm của Kho Đồ. */
const GardenUI = (() => {
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const px = (k, c, x, y, w = 1, h = 1) => { k.fillStyle = c; k.fillRect(x, y, w, h); };
  function stamp(k, rows, pal, x, y){ rows.forEach((r, j) => { for(let i = 0; i < r.length; i++){ const c = pal[r[i]]; if(c) px(k, c, x + i, y + j); } }); }
  const hexRGB = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mix = (a, b, t) => { const A = hexRGB(a), B = hexRGB(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };

  /* ── icon minh hoạ 22×22 ── */
  const ICON = {
    bag: { rows: [
      ".......oo...oo........", "........oRRRo.........", ".......oSRrRSo........", "......oSSoooSSo.......", ".....oSSssssssSo......", "....oSsssssssssSo.....",
      "...oSsss.sssssssSo....", "...oSssssggsssssSo....", "..oSsssgGGgsssssSSo...", "..oSssgGGGGgssssdSo...", "..oSsssgGGgsssssdSo...", "..oSsssssggssssddSo...",
      "..oSs.sssssssssddSo...", "..oSsssssssssdddSo....", "...oSssssssddddSo.....", "....ooddddddddoo..yy..", "......oooooooo...yYYy.", "..................yy.."],
      pal: { o: '#2b1a10', S: '#f4e2b8', s: '#dcc08c', d: '#a8885a', G: '#8fd46a', g: '#3f7a3a', R: '#e0503a', r: '#9a2a1e', y: '#ffe070', Y: '#c4901a' } },
    tools: { rows: [
      "........ooooooo.......", ".......oHHHHHHHo......", "......oHo.....oHo.....", "......oHo.....oHo.....", "..o...ooooooooooooo...", ".oWo.oCCCCCCCCCCCCCo..",
      ".oWWooCcWWccccccccCo..", "..oWWoCcWccccccccccCo.", "...oCCCccccccccccccCo.", "....ooCccccccccccccCo.", "......oCcccccccccccCo.", "......oCcccccccccccCo.",
      "......oCddddddddddCCo.", ".......oooooooooooooo.", "......................", "......................", "......................", "......................"],
      pal: { o: '#1e2a2e', H: '#2a7a9a', C: '#3f9fc4', c: '#7ad0ea', W: '#e0f8ff', d: '#2a7a9a' } },
    shop: { rows: [
      "....oooooooooooooo....", "...oRrWwRrWwRrWwRro...", "..oRrWwRrWwRrWwRrWwo..", "..oRrWwRrWwRrWwRrWwo..", "..ooRoWoRoWoRoWoRooo..", "...oP............Po...",
      "...oP.oo..oo..oo.Po...", "...oP.oao.obo.ogoPo...", "...oP.oAo.oBo.oGoPo...", "...oP..o...o...o.Po...", "..oooooooooooooooooo..", "..oTTTTTTTTTTTTTTTTo..",
      "..oKkkkkkkkkkkkkkkKo..", "..oKkkkKkkkkkKkkkkKo..", "..oKkkkKkkkkkKkkkkKo..", "..oKddddddddddddddKo..", "...oooooooooooooooo...", ".........oyyo.........",
      "........oyYYyo........", ".........oyyo........."],
      pal: { o: '#2b1a10', R: '#e8503a', r: '#b0382a', W: '#fff4dc', w: '#dcc9a0', P: '#8f5a32', a: '#ff7a5a', A: '#c0301c', b: '#f5c542', B: '#c4901a', g: '#8fe0b4', G: '#2fae84', y: '#ffe070', Y: '#c4901a', T: '#e0b07a', K: '#8f5a32', k: '#b07a4c', d: '#6e4425' } }
  };
  const ACCENT = { bag: ['#5fae4a', '#9be07a', '#2f6e2f'], tools: ['#3f9fc4', '#9ee0f4', '#1f5f7a'], shop: ['#e0503a', '#ff9a7a', '#8a2a1e'] };

  /* ── nút chức năng: viền ngoài + vành đồng thau 2 px + ván gỗ + ô icon lõm + đá màu riêng + bảng tên; bóng đổ pixel 2 px ── */
  function button(kind, state, W, H){
    const c = mk(W, H + 2), k = c.getContext('2d'), down = state === 'down', hov = state === 'hover' || state === 'open', open = state === 'open', A = ACCENT[kind];
    const y0 = down ? 1 : 0, BR = hov ? ['#fff4c0', '#f4c860', '#b07a28'] : ['#ffe8a0', '#d8a848', '#8a5a1c'];
    // bóng đổ pixel dưới nút (mất khi nhấn)
    if(!down){ px(k, 'rgba(18,13,10,.55)', 3, H, W - 6, 2); px(k, 'rgba(18,13,10,.3)', 2, H, 1, 1); px(k, 'rgba(18,13,10,.3)', W - 3, H, 1, 1); }
    const inside = (x, y) => { const cx = Math.min(x, W - 1 - x), cy = Math.min(y, H - 1 - y); return cx + cy >= 2; };
    for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){
      if(!inside(x, y)) continue;
      const d = Math.min(x, y, W - 1 - x, H - 1 - y) - (inside(x - 1, y - 1) && inside(x + 1, y + 1) ? 0 : 0);
      const ring = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1) ? 0 : (!inside(x - 2, y) || !inside(x + 2, y) || !inside(x, y - 2) || !inside(x, y + 2)) ? 1 : (!inside(x - 3, y) || !inside(x + 3, y) || !inside(x, y - 3) || !inside(x, y + 3)) ? 2 : 3;
      let col;
      if(ring === 0) col = open ? A[2] : '#2b1a10';
      else if(ring === 1) col = (x < W / 2 && y < H / 2) || (y < 3) || (x < 3) ? BR[0] : (y > H - 4 || x > W - 4) ? BR[2] : BR[1];
      else if(ring === 2) col = (y > H - 5 || x > W - 5) ? BR[2] : BR[1];
      else col = (y % 5 === 0 && (x * 3 + y) % 7) ? (hov ? '#a8703f' : '#8f5a32') : (hov ? '#c08048' : '#a8703f');
      px(k, col, x, y + y0 - (down ? 1 : 0) + (down ? 1 : 0) * 0);
    }
    // ô icon lõm
    const wx = 4, wy = 4 + y0, ww = W - 8, wh = H - 15;
    px(k, '#2b1a10', wx, wy, ww, wh); px(k, '#3e2616', wx + 1, wy + 1, ww - 2, wh - 2); px(k, '#2e1c10', wx + 1, wy + 1, ww - 2, 2); px(k, '#5a3a22', wx + 1, wy + wh - 2, ww - 2, 1);
    if(open){ px(k, A[2], wx + 1, wy + wh - 2, ww - 2, 1); }
    const I = ICON[kind], iw = I.rows[0].length, ih = I.rows.length, ix = wx + Math.round((ww - iw) / 2), iy = wy + Math.round((wh - ih) / 2) - (hov ? 1 : 0); stamp(k, I.rows, I.pal, ix, iy);
    if(kind === 'tools') stamp(k, ['.oo.oo.', 'oyyoyyo', 'oyoyoyo', 'oyyoyyo', '.oo.oo.'], { o: '#2b1a10', y: '#ffe070' }, ix, iy + ih - 5);
    // đá màu nhận diện trên vành trên
    const gx = Math.round(W / 2) - 2; stamp(k, ['.oo.', 'oabo', 'obco', '.oo.'], { o: '#2b1a10', a: hov ? '#ffffff' : A[1], b: A[0], c: A[2] }, gx, y0);
    // bảng tên
    const py = H - 11 + y0; px(k, '#2b1a10', 3, py, W - 6, 8); px(k, '#3b2414', 4, py + 1, W - 8, 6); px(k, A[2], 4, py + 1, W - 8, 1);
    return c;
  }

  /* ── khung ô vật phẩm theo bậc (đúng quy chuẩn bậc của Kho Đồ: Đồng, Bạc, Vàng, Ngọc, Tinh Thể, Cầu Vồng) ── */
  const TIERC = { 1: '#c27a45', 2: '#c9d1dc', 3: '#f0c04a', 4: '#3fc5a0', 5: '#a985f5' };
  function slot(tier, state, S){
    S = S || 28; const c = mk(S + 2, S + 2), k = c.getContext('2d'), o = 1;
    const empty = state === 'empty', locked = state === 'locked';
    const base = tier == null || empty || locked ? null : TIERC[tier];
    const rimAt = (i) => { if(tier === 'vip' && !empty && !locked){ const h = (i * 9) % 360; return `hsl(${h} 80% 62%)`; } return null; };
    // viền ngoài
    px(k, '#2b1a10', o + 1, o, S - 2, 1); px(k, '#2b1a10', o + 1, o + S - 1, S - 2, 1); px(k, '#2b1a10', o, o + 1, 1, S - 2); px(k, '#2b1a10', o + S - 1, o + 1, 1, S - 2);
    // vành 2 px: sáng trên-trái, tối dưới-phải; gỗ khi không có bậc; nâu xám khi trống/khoá
    const neutral = locked ? '#4a3c30' : empty ? '#3a2e24' : '#8f5a32';
    let i = 0;
    for(let y = o + 1; y < o + S - 1; y++) for(let x = o + 1; x < o + S - 1; x++){
      const ring = Math.min(x - o - 1, y - o - 1, o + S - 2 - x, o + S - 2 - y); if(ring > 1) continue;
      const lit = (x - o) + (y - o) < S, rc = rimAt(i++) || base || neutral;
      const col = rc.startsWith('hsl') ? rc : ring === 0 ? (lit ? mix(rc, '#ffffff', .35) : mix(rc, '#000000', .35)) : (lit ? rc : mix(rc, '#000000', .18));
      if(empty && (x + y) % 2) continue;                       // ô trống: vành chấm
      px(k, col, x, y);
    }
    // lòng ô tối như Kho Đồ; ô khoá tối hơn
    px(k, '#2b1a10', o + 3, o + 3, S - 6, S - 6); px(k, locked ? '#18120d' : '#1c1611', o + 4, o + 4, S - 8, S - 8); px(k, locked ? '#120d0a' : '#151009', o + 4, o + 4, S - 8, 1);
    // chi tiết góc theo bậc (không glow): III+ đinh góc, IV+ góc kim cương, V/VIP thêm điểm sáng
    if(base || tier === 'vip'){
      const t = tier === 'vip' ? 6 : tier, gem = tier === 'vip' ? '#ffffff' : mix(base, '#ffffff', .55);
      const corners = [[o + 1, o + 1], [o + S - 3, o + 1], [o + 1, o + S - 3], [o + S - 3, o + S - 3]];
      if(t >= 3) for(const [x, y] of corners){ px(k, gem, x, y); px(k, tier === 'vip' ? '#ffd76b' : base, x + 1, y + 1); }
      if(t >= 4) for(const [x, y] of corners){ px(k, '#2b1a10', x + (x < S / 2 ? 2 : -1), y + (y < S / 2 ? 2 : -1)); }
      if(t >= 5){ px(k, gem, o + Math.floor(S / 2), o); px(k, gem, o + Math.floor(S / 2), o + S - 1); }
    }
    if(locked){ stamp(k, ['.ooo.', 'o...o', 'ooooo', 'oaaao', 'oabao', 'ooooo'], { o: '#6b5a48', a: '#4a3c30', b: '#8a7660' }, o + Math.floor(S / 2) - 2, o + Math.floor(S / 2) - 3); }
    // đang chọn: khung ngoặc sáng ở 4 góc (khác hẳn màu bậc)
    if(state === 'sel'){ const s = '#fff3a0'; for(const [x, y, dx, dy] of [[0, 0, 1, 1], [S + 1, 0, -1, 1], [0, S + 1, 1, -1], [S + 1, S + 1, -1, -1]]){ px(k, s, x, y); px(k, s, x + dx, y); px(k, s, x + dx * 2, y); px(k, s, x, y + dy); px(k, s, x, y + dy * 2); } px(k, 'rgba(255,243,160,.18)', o + 4, o + 4, S - 8, S - 8); }
    if(state === 'hover'){ px(k, 'rgba(255,255,255,.07)', o + 4, o + 4, S - 8, S - 8); }
    return c;
  }
  return { button, slot, ICON, TIERC };
})();

/* Khu vườn — giao diện (túi đồ, vật dụng vô hạn, cửa hàng, ô đất). */
(() => {
const { T, I, TIER, ROMAN, seedCol, prep, color, N } = window.GardenItems;
// biểu tượng 3 lối truy cập (cùng lưới 16×16, viền tự động như vật phẩm)
T.BAG = ["......tt........", ".....tsst.......", "......tt........", "....caaaab......", "...caaaaaab.....", "..caaaaaaaab....", ".caaayyyyaaab...", ".caaayglyaaab...", ".caaayggyaaab...", ".caaayyyyaaab...", ".caaaaaaaaabb...", "..aaaaaaaabb....", "...abbbbbbb....."];
T.TOOLBOX = [".....kkkkk......", "....k.....k.....", "..w.k.....k.s...", "..ww.......ss...", "..ts.......st...", "caaaaaaaaaaaab..", "cyyyyyyyyyyyyb..", "caaaaayyaaaaab..", "caaaaakkaaaaab..", "caaaaaaaaaaaab..", "caaaaaaaaaaabb..", ".bbbbbbbbbbbb..."];
T.STALLI = ["cdcdcdcdcdcdcd..", "dcdcdcdcdcdcdc..", ".dcdcdcdcdcdc...", "..s........s....", "..s.rr.yy..s....", "..s.rr.yy..s....", "tttttttttttttt..", "taaaaaaaaaaaab..", "taaywaaaaywaab..", "taaaaaaaaaaaab..", ".bbbbbbbbbbbb..."];
const ICONS = {
  bag: { tpl: 'BAG', pal: { a: '#c9955a', b: '#9a6a3a', c: '#e6b97a', y: '#7a4a2a', g: '#4caf50', l: '#9be07a', s: '#8a6440', t: '#5a3d25' } },
  tools: { tpl: 'TOOLBOX', pal: { a: '#d0603a', b: '#9a3a22', c: '#f08a5a', y: '#f0c04a', k: '#5a5f66', w: '#dfe6ee', s: '#a8703f', t: '#6e4425' } },
  shop: { tpl: 'STALLI', pal: { c: '#fff1d6', d: '#e0503a', s: '#8a5a36', r: '#ff5a3c', y: '#f5c542', t: '#6e4425', a: '#a8703f', b: '#6e4425', w: '#ffffff' } }
};
Object.values(ICONS).forEach(o => prep(o));

const cvCache = new Map();
function itemCanvas(it){
  if(cvCache.has(it)) return cvCache.get(it);
  if(!it._grid) prep(it);
  const c = document.createElement('canvas'); c.width = N; c.height = N; const x = c.getContext('2d');
  for(let y = 0; y < N; y++) for(let i = 0; i < N; i++){ const ch = it._grid[y][i]; if(ch === '.') continue; x.fillStyle = color(it, ch, i, y, 0); x.fillRect(i, y, 1, 1); }
  if(it.aura) [[2, 2], [17, 3], [2, 17], [17, 16]].forEach(([sx, sy], k) => { x.fillStyle = k % 2 ? '#d9c8ff' : '#fff6c8'; x.fillRect(sx, sy, 1, 1); x.fillRect(sx - 1, sy, 1, 1); x.fillRect(sx + 1, sy, 1, 1); x.fillRect(sx, sy - 1, 1, 1); x.fillRect(sx, sy + 1, 1, 1); });   // giống draw() của Kho Đồ
  cvCache.set(it, c); return c;
}
function paint(target, it){ const x = target.getContext('2d'); x.clearRect(0, 0, target.width, target.height); x.drawImage(itemCanvas(it), 0, 0); }
const byName = n => I.find(i => i.vi === n);
const seedOf = t => I.find(i => i.g === 2 && i.tpl === 'SEED' && i.tier === t);
const cropOf = t => I.find(i => i.g === 3 && i.tier === t);
const tierName = t => t == null ? 'Không phân bậc (dụng cụ cố định)' : `${ROMAN[t]} · ${TIER[t].vi} (${TIER[t].en})`;
// ô vật phẩm = khung bậc (GardenUI.slot, màu lấy từ it.tier) + sprite ở giữa; scale nguyên ×2 hoặc ×3
function slotCanvas(it, state, scale){
  const f = GardenUI.slot(it ? it.tier : null, state, 28), c = document.createElement('canvas'); c.width = f.width; c.height = f.height;
  const x = c.getContext('2d'); x.drawImage(f, 0, 0); if(it) x.drawImage(itemCanvas(it), 5, 5);
  c.style.width = f.width * (scale || 2) + 'px'; c.style.height = f.height * (scale || 2) + 'px'; if(it) c.title = it.vi + ' · Độ hiếm: ' + tierName(it.tier);
  return c;
}
const $ = id => document.getElementById('gv-' + id);

/* ---- trạng thái demo (dữ liệu mẫu, không lưu) ---- */
const flowers = () => { try { return Math.max(0, garden.small | 0); } catch(e){ return 0; } };   // luống hoa của tab Tập trung (focus.js), chỉ đọc
const derived = small => { const big = Math.floor(small / 5), luck = Math.floor(big / 5), diamond = Math.floor(luck / 5); return { big, luck, diamond, tree: Math.floor(diamond / 5) }; };   // cùng công thức gardenDerived() trong focus.js
const START_INV = [['Hạt Đồng', 8], ['Hạt Bạc', 4], ['Hạt Vàng', 2], ['Túi Hạt Đồng', 1], ['Củ Cải Sương', 3], ['Phân Bón Tinh Linh (Nhỏ)', 2], ['Bù Nhìn Rơm', 1], ['Khối Đất', 12], ['Chứng Thư Mở Đất', 1], ['Bánh Quy Thú Cưng', 5], ['Bình Máu Đỏ (Nhỏ)', 2], ['Rương Khởi Đầu · A1', 1]];
const START_PLOTS = [['empty'], ['planted', 1, 0, 'bird'], ['sprout', 1], ['grow', 2, 0, 'hopper'], ['ripe', 1], ['empty'], ['planted', 3, 1], ['sprout', 2, 0, 'bird'], ['grow', 3], ['ripe', 2, 0, 'hopper']];
// sinh vật gây hại: chỉ là hình ảnh + dấu hiệu phá hoại. Tần suất, thiệt hại và cách phòng chưa chốt (vật phẩm phòng đã có: Bù Nhìn Rơm, Thuốc Diệt Châu Chấu).
const PEST = { bird: { vi: 'Chim sẻ', eats: 'đang mổ hạt và mầm non', item: 'Bù Nhìn Rơm' }, hopper: { vi: 'Châu chấu', eats: 'đang gặm lá', item: 'Thuốc Diệt Châu Chấu' } };
let S = { inv: new Map(), fresh: new Set(), plots: [], hold: null };
function reset(data){
  S.inv = new Map(); S.fresh = new Set(); S.hold = null;
  (data && data.inv ? data.inv : START_INV).forEach(([n, c]) => { const it = byName(n); if(it) S.inv.set(it, c); });
  if(data && data.fresh) data.fresh.forEach(n => { const it = byName(n); if(it) S.fresh.add(it); });
  S.plots = Array.from({ length: GardenMap.FARM.count }, (_, i) => {
    const d = data && data.plots ? data.plots[i] : (i < GardenMap.FARM.open ? { s: START_PLOTS[i][0], tier: START_PLOTS[i][1] || null, wet: !!START_PLOTS[i][2], pest: START_PLOTS[i][3] || null, dmg: !!START_PLOTS[i][3] } : { s: 'locked' });
    return { ...d, col: d.tier ? seedCol[d.tier] || '#ffffff' : null };
  });
}
window.claude?.hot?.snapshot?.(() => ({ inv: [...S.inv].map(([it, c]) => [it.vi, c]), fresh: [...S.fresh].map(it => it.vi), plots: S.plots.map(p => ({ s: p.s, tier: p.tier || null, wet: !!p.wet, pest: p.pest || null, dmg: !!p.dmg })) }));

/* ---- bản đồ: tỉ lệ nguyên, cuộn trên điện thoại ---- */
const page = document.getElementById('tab-vuon');
const map = $('map'), mctx = map.getContext('2d'), scroller = $('scroller'), stage = $('stage');
let SC = 2, hover = -1, dirty = true;
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
// máy tính: bố cục ngang 10×5; điện thoại: bố cục dọc 5×10 — vườn luôn chiếm gần hết khung, phóng to theo bội số nguyên
function layout(){
  const pw = stage.parentElement.clientWidth, want = pw < 560 ? 'tall' : 'wide';
  if(GardenMap.layout !== want || !GardenMap.base) GardenMap.init(want);
  const W = GardenMap.W, H = GardenMap.H; map.width = W; map.height = H;
  // điện thoại: khung bản đồ được tràn vào lề hai bên (tới sát 4 px mép màn hình) để giữ tỉ lệ ×2
  const avail = want === 'tall' ? Math.min(document.documentElement.clientWidth - 8, pw + 32) - 6 : pw - 12;
  SC = Math.max(1, Math.floor(avail / W)); if(want === 'wide') SC = Math.max(2, SC);
  map.style.width = W * SC + 'px'; map.style.height = H * SC + 'px';
  const sw = W * SC + 6; stage.style.width = sw + 'px'; stage.style.maxWidth = 'none';
  stage.style.marginInline = sw > pw ? `${(pw - sw) / 2}px` : 'auto';
  scroller.style.maxHeight = want === 'tall' ? 'none' : '';
  dirty = true;
}
function centerOnFarm(){ const a = GardenMap.plotRect(0); scroller.scrollLeft = Math.max(0, a.x * SC - 40); scroller.scrollTop = 0; }
function render(t){
  mctx.drawImage(GardenMap.base, 0, 0);
  const tt = reduce.matches ? 0 : t;
  S.plots.forEach((p, i) => GardenMap.drawPlot(mctx, i, p, tt, { sel: i === hover && p.s !== 'locked', crop: p.s === 'ripe' ? itemCanvas(cropOf(p.tier)) : null }));
  S.plots.forEach((p, i) => { if(p.pest) GardenMap.drawPest(mctx, i, p.pest, tt); });
  GardenMap.animate(mctx, tt);
  GardenMap.drawFront(mctx);
}
let last = 0;
let running = false;
function loop(t){ if(!page.classList.contains('active')){ running = false; return; } if(dirty || (!reduce.matches && t - last > 120)){ render(t); last = t; dirty = false; } requestAnimationFrame(loop); }
function wake(){ if(!running){ running = true; dirty = true; requestAnimationFrame(loop); } }

/* ---- thông báo ngắn ---- */
let toastT = 0;
function toast(msg){ const el = $('toast'); el.textContent = msg; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 2600); }

/* ---- cầm vật dụng / hạt giống ---- */
function setHold(h){
  S.hold = h; const chip = $('holdChip');
  if(!h){ chip.hidden = true; } else { chip.hidden = false; paint($('holdIcon'), h.item); $('holdText').textContent = 'Đang cầm: ' + h.item.vi + (h.type === 'seed' ? ' (còn ' + (S.inv.get(h.item) || 0) + ')' : ''); }
  renderTools(); if(!$('pInv').hidden) renderInv(); dirty = true;
}
$('holdClear').addEventListener('click', () => setHold(null));

/* ---- bấm ô đất ---- */
const STATE_VI = { locked: 'Ô bị khoá', empty: 'Đất trống', planted: 'Đã gieo', sprout: 'Nảy mầm', grow: 'Đang lớn', ripe: 'Đã chín' };
function clickPlot(i){
  const p = S.plots[i], h = S.hold;
  if(p.pest && !(h && h.item.tpl === 'SICKLE' && p.s === 'ripe')){ const k = PEST[p.pest]; return toast(k.vi + ' ' + k.eats + '. Vật phẩm phòng: ' + k.item + ' (cách dùng và hiệu lực chưa chốt).'); }
  if(p.s === 'locked') return toast('Ô bị khoá. Mở rộng bằng Chứng Thư Mở Đất (10 → 50 ô); số ô mở mỗi lần chưa chốt.');
  if(h && h.type === 'seed'){
    if(p.s !== 'empty') return toast('Ô này đã có cây. Chọn một ô đất trống để gieo.');
    const left = S.inv.get(h.item) || 0; if(left <= 0){ setHold(null); return toast('Hết ' + h.item.vi + ' trong túi đồ.'); }
    S.inv.set(h.item, left - 1); if(left - 1 === 0) S.inv.delete(h.item);
    Object.assign(p, { s: 'planted', tier: h.item.tier, col: seedCol[h.item.tier] || '#ffffff', wet: false, dmg: false, pest: null });
    toast('Đã gieo ' + h.item.vi + '.'); setHold(left - 1 > 0 ? h : null); return;
  }
  if(h && h.item.tpl === 'CAN'){
    if(p.s === 'empty') return toast('Ô trống chưa có gì để tưới.');
    if(p.s === 'ripe') return toast('Cây đã chín, hãy dùng Liềm để thu hoạch.');
    p.wet = true; dirty = true; return toast('Đã tưới. Tác dụng của việc tưới chưa chốt.');
  }
  if(h && h.item.tpl === 'SICKLE'){
    if(p.s !== 'ripe') return toast('Chỉ thu hoạch được ô đã chín.');
    const crop = cropOf(p.tier); S.inv.set(crop, (S.inv.get(crop) || 0) + 1); S.fresh.add(crop);
    Object.assign(p, { s: 'empty', tier: null, col: null, wet: false, dmg: false, pest: null }); updateDot(); dirty = true;
    return toast('Thu hoạch: +1 ' + crop.vi + ' vào túi đồ (số lượng mỗi lần chưa chốt).');
  }
  const extra = p.tier ? ' · ' + seedOf(p.tier).vi : '';
  toast(STATE_VI[p.s] + extra + (p.wet ? ' · đất ướt' : '') + (p.s === 'empty' ? '. Mở Túi đồ để chọn hạt giống.' : p.s === 'ripe' ? '. Cầm Liềm để thu hoạch.' : '.'));
}
$('tick').addEventListener('click', () => {
  let n = 0; const next = { planted: 'sprout', sprout: 'grow', grow: 'ripe' };
  S.plots.forEach(p => { if(next[p.s]){ p.s = next[p.s]; p.wet = false; n++; } });
  // sinh vật đổi chỗ sang ô phù hợp (chim: hạt/mầm; châu chấu: cây có lá) — chỉ là hình ảnh demo
  const pests = S.plots.filter(p => p.pest).map(p => p.pest); S.plots.forEach(p => { p.pest = null; });
  for(const k of pests){ const ok = S.plots.filter(p => !p.pest && (k === 'bird' ? ['planted', 'sprout'] : ['grow', 'ripe']).includes(p.s)); if(ok.length){ const q = ok[Math.floor(Math.random() * ok.length)]; q.pest = k; q.dmg = true; } }
  dirty = true; toast(n ? n + ' ô lớn thêm một bước (chỉ để xem trạng thái).' : 'Không có ô nào đang lớn.');
});

/* ---- điều khiển chuột/chạm trên bản đồ ---- */
let down = null;
map.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, sl: scroller.scrollLeft, st: scroller.scrollTop, drag: false, mouse: e.pointerType === 'mouse' }; });
window.addEventListener('pointermove', e => {
  if(down && down.mouse && (e.buttons & 1)){ const dx = e.clientX - down.x, dy = e.clientY - down.y; if(Math.abs(dx) + Math.abs(dy) > 5){ down.drag = true; map.classList.add('gv-grab'); scroller.scrollLeft = down.sl - dx; scroller.scrollTop = down.st - dy; } }
  if(e.target === map){ const r = map.getBoundingClientRect(), mx = (e.clientX - r.left) / SC, my = (e.clientY - r.top) / SC, h = GardenMap.plotAt(mx, my); if(h !== hover){ hover = h; dirty = true; } }
});
window.addEventListener('pointerup', e => {
  const d = down; down = null; map.classList.remove('gv-grab');
  if(!d || d.drag || e.target !== map || Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 8) return;
  const r = map.getBoundingClientRect(), mx = (e.clientX - r.left) / SC, my = (e.clientY - r.top) / SC;
  const i = GardenMap.plotAt(mx, my); if(i >= 0) return clickPlot(i);
  if(GardenMap.hotAt(mx, my) === 'shop') return openPanel('pShop');
});
map.addEventListener('pointerleave', () => { if(hover !== -1){ hover = -1; dirty = true; } });

/* ---- bảng ---- */
const PANELS = { pInv: 'bInv', pTools: 'bTools', pShop: 'bShop' };
function openPanel(id){
  for(const [p, b] of Object.entries(PANELS)){ const on = p === id && $(p).hidden; $(p).hidden = !on; $(b).setAttribute('aria-expanded', on); }
  if(id === 'pInv' && !$(id).hidden){ renderInv(); }
  if(id === 'pShop' && !$(id).hidden) renderShop();
  if(id === 'pTools' && !$(id).hidden) renderTools();
}
for(const [p, b] of Object.entries(PANELS)) $(b).addEventListener('click', () => openPanel(p));
document.querySelectorAll('#tab-vuon [data-close]').forEach(x => x.addEventListener('click', () => { for(const [p, b] of Object.entries(PANELS)){ $(p).hidden = true; $(b).setAttribute('aria-expanded', false); } }));
document.addEventListener('keydown', e => { if(e.key === 'Escape' && page.classList.contains('active')){ for(const [p, b] of Object.entries(PANELS)){ if(!$(p).hidden){ $(p).hidden = true; $(b).setAttribute('aria-expanded', false); $(b).focus(); } } } });
function updateDot(){ const n = S.fresh.size, d = $('invDot'); d.hidden = !n; d.textContent = n; }

/* Túi đồ: nhóm theo phân loại đã chốt; tiền tệ hiển thị số quy đổi từ hoa */
const INV_TABS = [[2, 'Hạt giống'], [3, 'Nông sản'], [4, 'Chăm sóc vườn'], [5, 'Thú cưng'], [6, 'Chiến đấu'], [7, 'Rương'], [1, 'Tiền tệ']];
let invTab = 2, invSel = null;
function renderInv(){
  $('invTabs').innerHTML = INV_TABS.map(([g, n]) => { const cnt = g === 1 ? 5 : [...S.inv.keys()].filter(i => i.g === g).length, fr = [...S.fresh].some(i => i.g === g);
    return `<button type="button" role="tab" aria-selected="${g === invTab}" data-g="${g}">${n}${cnt ? ' ' + cnt : ''}${fr ? ' •' : ''}</button>`; }).join('');
  $('invTabs').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { invTab = +b.dataset.g; invSel = null; renderInv(); }));
  const grid = $('invGrid'); grid.innerHTML = '';
  let list;
  if(invTab === 1){ const d = derived(flowers()), q = [flowers(), d.big, d.luck, d.diamond, d.tree]; list = I.filter(i => i.g === 1).map((it, k) => [it, q[k]]); }
  else list = [...S.inv].filter(([it]) => it.g === invTab);
  if(!list.length){ grid.innerHTML = '<p class="gv-empty" style="grid-column:1/-1">Chưa có vật phẩm nào trong nhóm này.</p>'; }
  for(const [it, n] of list){
    const b = document.createElement('button'); b.type = 'button'; b.className = 'gv-cell' + (S.fresh.has(it) ? ' gv-new' : '');
    b.setAttribute('aria-pressed', invSel === it); b.setAttribute('aria-label', it.vi + ', số lượng ' + n + ', độ hiếm ' + tierName(it.tier));
    const w = document.createElement('span'); w.className = 'gv-sl'; w.append(slotCanvas(it, invSel === it ? 'sel' : 'normal', 2)); w.insertAdjacentHTML('beforeend', `<span class="gv-n">${n}</span>`);
    b.addEventListener('pointerenter', () => { if(invSel !== it) w.replaceChild(slotCanvas(it, 'hover', 2), w.firstChild); });
    b.addEventListener('pointerleave', () => { if(invSel !== it) w.replaceChild(slotCanvas(it, 'normal', 2), w.firstChild); });
    b.append(w); b.insertAdjacentHTML('beforeend', `<span class="gv-nm">${it.vi}</span>`);
    b.addEventListener('click', () => { invSel = it; S.fresh.delete(it); updateDot(); renderInv(); });
    grid.append(b);
  }
  // ô trống lấp đủ hàng cuối (5 ô/hàng) — chỉ để trình bày, không phải giới hạn sức chứa
  if(list.length) for(let k = list.length % 5 ? 5 - list.length % 5 : 0; k > 0; k--){ const e = document.createElement('div'); e.className = 'gv-cell gv-off'; e.setAttribute('aria-hidden', 'true'); e.append(slotCanvas(null, 'empty', 2)); grid.append(e); }
  const det = $('invDetail');
  if(!invSel){ det.innerHTML = invTab === 1 ? '<p class="gv-note">Tiền tệ lấy từ luống hoa của tab Focus. Các bậc trên là số quy đổi tương đương (5 bậc dưới = 1 bậc trên), giống cách tab Focus đang hiển thị.</p>' : '<p class="gv-note">Chọn một vật phẩm để xem chi tiết. Hạt giống có thể cầm đi gieo vào ô đất trống.</p>'; return; }
  const it = invSel, isSeed = it.g === 2 && it.tpl === 'SEED', holding = S.hold && S.hold.item === it;
  det.innerHTML = `<div class="gv-detail"><span class="gv-big"></span><div class="gv-t">${it.vi}</div><div class="gv-e">${it.en}</div><div class="gv-r">Độ hiếm: <b>${tierName(it.tier)}</b></div><div class="gv-d">${it.note || ''}</div>
    <div class="gv-act">${isSeed ? `<button type="button" class="gv-btn" id="gv-useSeed">${holding ? 'Bỏ cầm' : 'Cầm để gieo'}</button>` : `<span class="gv-note" style="flex:1">Cách dùng vật phẩm này trong vườn chưa được kết nối.</span>`}</div></div>`;
  det.querySelector('.gv-big').append(slotCanvas(it, 'normal', 3));
  const u = $('useSeed'); if(u) u.addEventListener('click', () => { setHold(holding ? null : { type: 'seed', item: it }); if(!holding){ openPanel('pInv'); toast('Bấm vào một ô đất trống để gieo ' + it.vi + '.'); } });
}

/* Vật dụng vô hạn: đúng các dụng cụ mặc định đã chốt */
function renderTools(){
  const rows = $('toolRows'); rows.innerHTML = '';
  for(const it of I.filter(i => i.g === 0)){
    const pending = it.tpl === 'SPADE', holding = S.hold && S.hold.item === it;
    const r = document.createElement('div'); r.className = 'gv-row';
    r.append(slotCanvas(it, holding ? 'sel' : pending ? 'locked' : 'normal', 2));
    r.insertAdjacentHTML('beforeend', `<div><div class="gv-t">${it.vi}</div><div class="gv-s">${it.en} · ${pending ? 'Chờ xác nhận nhóm, chưa dùng được.' : it.note}</div></div>`);
    const b = document.createElement('button'); b.type = 'button'; b.className = 'gv-btn'; b.textContent = pending ? 'Chờ' : holding ? 'Bỏ cầm' : 'Cầm';
    if(pending){ b.disabled = true; b.title = 'Nhóm của dụng cụ này chưa được xác nhận'; }
    else b.addEventListener('click', () => { setHold(holding ? null : { type: 'tool', item: it }); if(!holding){ openPanel('pTools'); toast(it.tpl === 'CAN' ? 'Bấm vào ô đã gieo để tưới.' : 'Bấm vào ô đã chín để thu hoạch.'); } });
    r.append(b); rows.append(r);
  }
}

/* Cửa hàng: chỉ giao diện; danh mục tạm theo nhóm vật phẩm, giá chưa chốt */
const SHOP_TABS = [[2, 'Hạt giống'], [4, 'Chăm sóc vườn'], [5, 'Thú cưng'], [6, 'Chiến đấu']];
let shopTab = 2;
function renderShop(){
  const d = derived(flowers()), q = [flowers(), d.big, d.luck, d.diamond, d.tree];
  $('shopWallet').innerHTML = '';
  I.filter(i => i.g === 1).forEach((it, k) => { const w = document.createElement('div'); w.title = it.vi; const c = document.createElement('canvas'); c.width = N; c.height = N; paint(c, it); w.append(c, String(q[k])); $('shopWallet').append(w); });
  $('shopTabs').innerHTML = SHOP_TABS.map(([g, n]) => `<button type="button" role="tab" aria-selected="${g === shopTab}" data-g="${g}">${n}</button>`).join('');
  $('shopTabs').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { shopTab = +b.dataset.g; renderShop(); }));
  const rows = $('shopRows'); rows.innerHTML = '';
  for(const it of I.filter(i => i.g === shopTab && !(i.g === 2 && i.tpl === 'SEED'))){
    const r = document.createElement('div'); r.className = 'gv-row';
    r.append(slotCanvas(it, 'normal', 2));
    r.insertAdjacentHTML('beforeend', `<div><div class="gv-t">${it.vi}</div><div class="gv-s">${it.en}</div></div>`);
    const right = document.createElement('div'); right.style.cssText = 'display:flex;flex-direction:column;align-items:flex-end;gap:4px';
    right.innerHTML = '<span class="gv-price">Giá: chưa chốt</span><button type="button" class="gv-btn" disabled title="Giá và luật mua chưa chốt">Mua</button>';
    r.append(right); rows.append(r);
  }
}

/* ---- chú thích trạng thái ô đất ---- */
function legend(){
  const L = $('legend'); L.innerHTML = '';
  const demo = [[{ s: 'locked' }, 'Khoá (mở rộng sau)'], [{ s: 'empty' }, 'Đất trống'], [{ s: 'planted', tier: 3 }, 'Đã gieo'], [{ s: 'sprout', tier: 3 }, 'Nảy mầm'], [{ s: 'grow', tier: 3 }, 'Đang lớn'], [{ s: 'ripe', tier: 3 }, 'Đã chín'], [{ s: 'planted', tier: 3, wet: true }, 'Đất ướt'],
    [{ s: 'planted', tier: 1, dmg: true, pest: 'bird' }, 'Chim mổ hạt'], [{ s: 'grow', tier: 2, dmg: true, pest: 'hopper' }, 'Châu chấu gặm lá']];
  const r0 = GardenMap.plotRect(0);
  for(const [pl, label] of demo){
    const c = document.createElement('canvas'); c.width = 30; c.height = 36; const x = c.getContext('2d');
    x.fillStyle = '#d7b47a'; x.fillRect(0, 0, 30, 36); x.translate(-r0.x + 4, -r0.y + 11);
    GardenMap.drawPlot(x, 0, pl, 0, { crop: pl.s === 'ripe' ? itemCanvas(cropOf(pl.tier)) : null }); if(pl.pest) GardenMap.drawPest(x, 0, pl.pest, 300);
    const sp = document.createElement('span'); sp.append(c, label); L.append(sp);
  }
}

/* ---- cụm nút: khung pixel-art (GardenUI) với trạng thái thường / di chuột / nhấn / đang mở ---- */
const DOCK = [['bInv', 'bag'], ['bTools', 'tools'], ['bShop', 'shop']], frameCache = new Map();
const dockSize = () => matchMedia('(max-width:560px)').matches ? [28, 33] : [32, 36];
function paintDock(){
  const [w, h] = dockSize();
  for(const [b, k] of DOCK){ const btn = $(b), c = btn.querySelector('canvas'), st = btn.classList.contains('gv-is-down') ? 'down' : btn.getAttribute('aria-expanded') === 'true' ? 'open' : btn.classList.contains('gv-is-hover') ? 'hover' : 'normal', key = k + st + w;
    if(!frameCache.has(key)) frameCache.set(key, GardenUI.button(k, st, w, h));
    const f = frameCache.get(key); c.width = f.width; c.height = f.height; const x = c.getContext('2d'); x.clearRect(0, 0, f.width, f.height); x.drawImage(f, 0, 0); c.style.width = f.width * 2 + 'px'; c.style.height = f.height * 2 + 'px'; }
}
function setupDock(){
  for(const [b] of DOCK){ const btn = $(b);
    btn.addEventListener('pointerenter', () => { btn.classList.add('gv-is-hover'); paintDock(); });
    btn.addEventListener('pointerleave', () => { btn.classList.remove('gv-is-hover', 'gv-is-down'); paintDock(); });
    btn.addEventListener('pointerdown', () => { btn.classList.add('gv-is-down'); paintDock(); });
    btn.addEventListener('pointerup', () => { btn.classList.remove('gv-is-down'); paintDock(); });
    btn.addEventListener('click', () => setTimeout(paintDock, 0));
  }
  paintDock(); window.addEventListener('resize', paintDock);
}

/* ---- khởi động: dựng khi mở tab lần đầu ---- */
let booted = false;
function boot(){
  if(!booted){
    booted = true; reset(null);
    setupDock();
    [['pInv', 'bag'], ['pTools', 'tools'], ['pShop', 'shop']].forEach(([p, k]) => paint($(p).querySelector('header canvas'), ICONS[k]));
    paint($('walletIcon'), I.find(i => i.g === 1));
    layout(); legend(); updateDot(); centerOnFarm();
    window.addEventListener('resize', () => { if(!page.classList.contains('active')) return; const k = GardenMap.layout; layout(); if(k !== GardenMap.layout){ legend(); centerOnFarm(); } });
  } else { const k = GardenMap.layout; layout(); if(k !== GardenMap.layout){ legend(); centerOnFarm(); } }
  $('walletN').textContent = flowers(); wake();
}
const tabBtn = document.querySelector('.tab-btn[data-tab="vuon"]');
if(tabBtn) tabBtn.addEventListener('click', () => setTimeout(boot, 0));      // chạy sau khi navigation.js đã bật tab
if(page.classList.contains('active')) setTimeout(boot, 0);

})();
