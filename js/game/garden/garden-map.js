/* Khu vườn (bản xem trước) — sinh từ scratchpad garden/build_app.py. Không phụ thuộc thư viện ngoài. */
/* ═══ GardenArt — bộ tạo sprite pixel-art cho khu vườn ═══
   Ánh sáng thống nhất từ trên-trái. Mỗi nhóm vật thể có cách tạo hình riêng:
   • tán cây/bụi: nhiều cụm lá (lobe) viền gợn sóng hữu cơ, vẽ từ sau ra trước; khe giữa cụm tối; mỗi cụm có các vòm lá nhỏ
     với vệt sáng hình cung phía trên-trái và vệt tối phía dưới-phải (cụm pixel có chủ đích, không dùng nhiễu)
   • thân cây: thuôn dần, rễ toả, cành lộ giữa tán, vân vỏ dọc
   • đá: đa giác bất quy tắc, mặt trên sáng / mặt trái trung / mặt phải tối, cạnh sáng, vết nứt, rêu
   • hoa, cỏ, nấm, dương xỉ: mẫu pixel vẽ tay có biến thể; luống: khung gỗ + đất có rãnh uốn nhẹ và cục đất có khối
   Trả về canvas (cache). Không làm mượt, không nội suy. */
const GardenArt = (() => {
  const hash = (x, y, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const cache = new Map(), memo = (k, f) => cache.has(k) ? cache.get(k) : (cache.set(k, f()), cache.get(k));

  /* ── bảng màu ── */
  const PAL = {
    leaf:  { out: '#1c3620', dk: '#284f2a', sh: '#356a33', base: '#4a8a3e', lt: '#68a84a', hi: '#93cc5e', rim: '#c4e98a' },
    leafC: { out: '#263c34', dk: '#344f44', sh: '#405f50', base: '#4f705c', lt: '#618268', hi: '#7a987c', rim: '#98b296' },   // hậu cảnh xa: lạnh, nhạt, ít tương phản
    leafY: { out: '#22381c', dk: '#33572a', sh: '#477434', base: '#61963f', lt: '#82b54c', hi: '#acd462', rim: '#dcef94' },   // bụi non, vàng hơn
    pine:  { out: '#14291e', dk: '#1d3d2a', sh: '#275236', base: '#336b43', lt: '#468752', hi: '#69a868', rim: '#9fd08c' },
    bark:  { out: '#24150c', dk: '#3c2414', sh: '#55331d', base: '#714628', lt: '#8f5c36', hi: '#b07a4c' },
    stone: { out: '#2a2f33', dk: '#4c5458', sh: '#687175', base: '#878f92', lt: '#a6adaf', hi: '#c9cecf', rim: '#eceeee' },
    moss:  ['#4f7f36', '#6f9f46', '#94bf5a'],
    wood:  { out: '#2b1a10', dk: '#4a2c17', sh: '#6e4425', base: '#8f5a32', lt: '#ad7444', hi: '#cc9461', rim: '#e6b884' },
    soil:  { dk: '#3a2314', sh: '#52321d', base: '#6b4427', lt: '#86583a', hi: '#a27350', rim: '#bb8c66' },
    soilW: { dk: '#28180e', sh: '#3a2416', base: '#4d3120', lt: '#62402b', hi: '#7b553c', rim: '#96704f' },
    grass: { dk: '#3f7d34', sh: '#4f9140', base: '#62a64b', lt: '#74b755', hi: '#8fca62', rim: '#b4df7f' }
  };

  /* ── bộ đệm pixel ── */
  class Buf {
    constructor(w, h){ this.w = w; this.h = h; this.p = new Array(w * h).fill(null); this.z = new Int16Array(w * h).fill(-1); }
    get(x, y){ return x < 0 || y < 0 || x >= this.w || y >= this.h ? null : this.p[y * this.w + x]; }
    set(x, y, c){ x = Math.round(x); y = Math.round(y); if(x >= 0 && y >= 0 && x < this.w && y < this.h) this.p[y * this.w + x] = c; }
    outline(col, sel){   // viền ngoài; sel: viền phía trên-trái nhạt hơn (kỹ thuật selective outline)
      const add = [];
      for(let y = 0; y < this.h; y++) for(let x = 0; x < this.w; x++){
        if(this.p[y * this.w + x]) continue;
        let n = 0, dir = 0; for(const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]){ if(this.get(x + dx, y + dy)){ n++; dir += dx + dy; } }
        if(n) add.push([x, y, sel && dir > 0 ? sel : col]);
      }
      for(const [x, y, c] of add) this.p[y * this.w + x] = c;
    }
    canvas(){ const c = mk(this.w, this.h), k = c.getContext('2d'); for(let y = 0; y < this.h; y++) for(let x = 0; x < this.w; x++){ const v = this.p[y * this.w + x]; if(v){ k.fillStyle = v; k.fillRect(x, y, 1, 1); } } return c; }
  }
  // mẫu ký tự → pixel
  function stamp(B, rows, pal, x, y, flip){ const w = rows[0].length; rows.forEach((r, j) => { for(let i = 0; i < w; i++){ const ch = r[i]; if(ch !== '.' && pal[ch]) B.set(x + (flip ? w - 1 - i : i), y + j, pal[ch]); } }); }
  function stampCtx(ctx, rows, pal, x, y, flip){ const w = rows[0].length; rows.forEach((r, j) => { for(let i = 0; i < w; i++){ const ch = r[i]; if(ch !== '.' && pal[ch]){ ctx.fillStyle = pal[ch]; ctx.fillRect(x + (flip ? w - 1 - i : i), y + j, 1, 1); } } }); }

  /* ── cụm lá hữu cơ ── */
  // bán kính gợn theo góc: tạo đường viền lồi lõm tự nhiên
  const lobeR = (R, th, s) => R * (1 + .10 * Math.sin(5 * th + s * 1.7) + .07 * Math.sin(8 * th + s * 3.1) + .04 * Math.sin(13 * th + s));
  function foliage(B, lobes, P, seed){
    // lobes: [{x, y, r, d}] d = độ sâu (0 sau → 1 trước). Vẽ từ sau ra trước, trên xuống dưới.
    lobes = lobes.slice().sort((a, b) => (a.d - b.d) || (a.y - b.y));
    const tone = [P.dk, P.sh, P.base, P.lt, P.hi, P.rim];
    lobes.forEach((L, li) => {
      const s = seed * 7 + li * 13, R = L.r, depthLift = L.d * .9;
      const inside = (px, py) => { const dx = px - L.x, dy = py - L.y, th = Math.atan2(dy, dx); return Math.hypot(dx, dy) <= lobeR(R, th, s); };
      const own = [];
      for(let y = Math.floor(L.y - R * 1.25); y <= L.y + R * 1.25; y++) for(let x = Math.floor(L.x - R * 1.25); x <= L.x + R * 1.25; x++){
        if(x < 0 || y < 0 || x >= B.w || y >= B.h || !inside(x + .5, y + .5)) continue;
        const dx = (x + .5 - L.x) / R, dy = (y + .5 - L.y) / R, d = Math.min(1, Math.hypot(dx, dy)), z = Math.sqrt(1 - d * d);
        let v = (-dx * .6 - dy * .85) * .95 + z * .45 + depthLift * .3 - .5 - Math.max(0, dy) * .25;          // ánh sáng trên-trái + độ cao + lớp trước sáng hơn
        own.push([x, y, v]);
      }
      // vòm lá nhỏ bên trong cụm: vệt sáng hình cung (trên-trái), vệt tối (dưới-phải)
      const sub = [], step = Math.max(3.2, R / 2.2);
      for(let gy = L.y - R; gy <= L.y + R; gy += step) for(let gx = L.x - R; gx <= L.x + R; gx += step){
        const jx = gx + (hash(s, Math.round(gx * 3), Math.round(gy * 3)) - .5) * step * .6, jy = gy + (hash(s + 1, Math.round(gx * 3), Math.round(gy * 3)) - .5) * step * .6;
        if(inside(jx, jy)) sub.push([jx, jy, step * .62]);
      }
      const set = new Map(own.map(([x, y, v]) => [y * B.w + x, v]));
      for(const [sx, sy, sr] of sub){
        for(let y = Math.floor(sy - sr - 1); y <= sy + sr + 1; y++) for(let x = Math.floor(sx - sr - 1); x <= sx + sr + 1; x++){
          const k = y * B.w + x; if(!set.has(k)) continue;
          const dx = x + .5 - sx, dy = y + .5 - sy, dist = Math.hypot(dx, dy), ang = (-dx * .6 - dy * .8) / (dist || 1);
          if(dist > sr - 1.1 && dist <= sr && ang > .45) set.set(k, set.get(k) + .32);        // cung sáng
          else if(dist > sr && dist <= sr + 1 && ang < -.35) set.set(k, set.get(k) - .42);   // khe tối
        }
      }
      // khe tối nơi cụm này đè lên cụm phía sau (bóng tiếp xúc)
      for(const [x, y] of own) for(const [dx, dy] of [[0, 1], [1, 1], [1, 0]]){ const X = x + dx, Y = y + dy; if(X < B.w && Y < B.h && B.get(X, Y) && !set.has(Y * B.w + X)) B.set(X, Y, P.dk); }
      for(const [k, v] of set){ const t = v > .72 ? 5 : v > .42 ? 4 : v > .12 ? 3 : v > -.22 ? 2 : v > -.55 ? 1 : 0; B.p[k] = tone[t]; }
    });
  }

  /* ── thân cây: thuôn, rễ toả, vân vỏ, cành ── */
  function trunk(B, cx, base, h, w0, w1, P, seed){
    for(let y = 0; y <= h; y++){
      const t = y / h, w = w0 + (w1 - w0) * t + (t < .25 ? (1 - t / .25) * 2.2 : 0), X = cx + Math.sin(t * 2.4 + seed) * .8, yy = base - y;
      for(let x = Math.floor(X - w / 2); x <= X + w / 2; x++){
        const u = (x + .5 - (X - w / 2)) / w;                  // 0 trái → 1 phải
        let c = u < .22 ? P.lt : u > .74 ? P.sh : P.base;
        if(u > .88) c = P.dk;
        if(Math.abs(Math.sin((x * 2.1 + seed) * 1.3)) > .93 && u > .2 && u < .8) c = P.sh;   // vân vỏ dọc
        if(u < .14 && (yy + seed) % 5 === 0) c = P.hi;
        B.set(x, yy, c);
      }
    }
    // rễ: 2–3 nhánh cong toả sang hai bên trên mặt đất
    for(const [dir, len] of [[-1, 4 + (seed % 2)], [1, 5], [-1, 2]]){
      for(let i = 0; i < len; i++){ const x = cx + dir * (w0 / 2 + i), y = base - Math.max(0, 1 - Math.floor(i / 2)); B.set(x, y, i > len - 2 ? P.sh : P.base); B.set(x, y + 1, P.dk); }
    }
  }
  function branch(B, pts, w, P){
    for(let i = 0; i < pts.length - 1; i++){ const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.5);
      for(let k = 0; k <= n; k++){ const t = k / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t; for(let o = 0; o < w; o++){ B.set(x + o, y, o === 0 ? P.lt : P.sh); } } }
  }

  /* ── cây lớn (sồi tán rộng) ── */
  function oak(size, seed, cool){
    return memo('oak' + size + seed + cool, () => {
      const P = cool ? PAL.leafC : PAL.leaf, R = size, W = Math.round(R * 3.1) + 6, H = Math.round(R * 3.3) + 8, B = new Buf(W, H), cx = Math.round(W / 2), base = H - 3;
      const th = Math.round(R * 1.15);
      trunk(B, cx, base, th + 4, Math.max(4, Math.round(R * .42)), Math.max(3, Math.round(R * .3)), PAL.bark, seed);
      branch(B, [[cx, base - th + 2], [cx - R * .55, base - th - R * .45]], 2, PAL.bark); branch(B, [[cx + 1, base - th + 1], [cx + R * .6, base - th - R * .55]], 2, PAL.bark);
      const top = base - th - R * .6, lobes = [];
      // cụm sau (tối), cụm giữa, cụm trước (sáng); kích thước và vị trí lệch nhau theo seed
      const J = k => (hash(seed, k, 3) - .5);
      lobes.push({ x: cx - R * .55 + J(1) * 2, y: top - R * .15, r: R * .62, d: .1 }, { x: cx + R * .58 + J(2) * 2, y: top - R * .05, r: R * .6, d: .1 }, { x: cx + J(3) * 2, y: top - R * .62, r: R * .62, d: .2 });
      lobes.push({ x: cx - R * .8, y: top + R * .38, r: R * .5, d: .45 }, { x: cx + R * .85, y: top + R * .42, r: R * .48, d: .45 }, { x: cx - R * .1 + J(4) * 2, y: top - R * .12, r: R * .7, d: .55 });
      lobes.push({ x: cx - R * .38, y: top + R * .5, r: R * .52, d: .85 }, { x: cx + R * .36, y: top + R * .55, r: R * .5, d: .8 }, { x: cx - R * .3 + J(5), y: top - R * .4, r: R * .42, d: .95 });
      foliage(B, lobes, P, seed);
      B.outline(P.out);
      return B.canvas();
    });
  }
  /* ── thông: các tầng lá răng cưa ── */
  function pine(h, seed, cool){
    return memo('pine' + h + seed + cool, () => {
      const P = cool ? PAL.leafC : PAL.pine, W = Math.round(h * .8) + 6, H = h + 8, B = new Buf(W, H), cx = W / 2, base = H - 3;
      trunk(B, Math.round(cx), base, 6, 4, 3, PAL.bark, seed);
      const tiers = 4;
      for(let t = 0; t < tiers; t++){
        const top = 1 + t * h * .2, bot = top + h * .34 + t * 1.5, half = h * (.14 + t * .075);
        for(let y = Math.floor(top); y <= bot && y < base - 3; y++){
          const k = (y - top) / (bot - top), saw = ((y + t) % 3) * .9, ww = half * k + 1 + (k > .3 ? saw : 0);
          for(let x = Math.floor(cx - ww); x <= cx + ww; x++){
            const u = (x + .5 - cx) / Math.max(1, ww), bottomBand = k > .82;
            let c = u < -.35 ? P.lt : u > .4 ? P.sh : P.base;
            if(bottomBand) c = u < -.2 ? P.base : P.dk;
            if(u < -.55 && (y + t) % 3 === 0) c = P.hi;
            if(Math.abs(u) < .12 && k < .3) c = P.lt;
            B.set(x, y, c);
          }
        }
      }
      B.set(Math.round(cx), 0, P.rim);
      B.outline(P.out);
      return B.canvas();
    });
  }
  /* ── bụi cây ── */
  function bush(size, seed, opt){
    opt = opt || {};
    return memo('bush' + size + seed + JSON.stringify(opt), () => {
      const P = opt.young ? PAL.leafY : PAL.leaf, R = size, W = Math.round(R * 3) + 4, H = Math.round(R * 2.1) + 4, B = new Buf(W, H), cx = W / 2, by = H - 2 - R * .62;
      const J = k => (hash(seed, k, 9) - .5) * 2;
      foliage(B, [{ x: cx - R * .75 + J(1), y: by + R * .1, r: R * .62, d: .2 }, { x: cx + R * .78 + J(2), y: by + R * .12, r: R * .6, d: .2 }, { x: cx + J(3), y: by - R * .3, r: R * .7, d: .5 },
        { x: cx - R * .35, y: by + R * .32, r: R * .5, d: .8 }, { x: cx + R * .4, y: by + R * .3, r: R * .48, d: .85 }], P, seed);
      if(opt.berry){ for(let i = 0; i < 6; i++){ const x = Math.round(cx + J(10 + i) * R * .9), y = Math.round(by + J(20 + i) * R * .55); if(B.get(x, y) && B.get(x + 1, y + 1)) stamp(B, ['ab', 'bc'], { a: opt.berry[2], b: opt.berry[1], c: opt.berry[0] }, x, y); } }
      if(opt.bloom){ for(let i = 0; i < 5; i++){ const x = Math.round(cx + J(30 + i) * R * .85), y = Math.round(by - R * .2 + J(40 + i) * R * .5); if(B.get(x, y)) stamp(B, ['.p.', 'pcp', '.p.'], { p: opt.bloom[0], c: opt.bloom[1] }, x - 1, y - 1); } }
      B.outline(P.out);
      return B.canvas();
    });
  }
  /* ── đá: đa giác bất quy tắc có mặt ── */
  function rock(size, seed, mossy){
    return memo('rock' + size + seed + mossy, () => {
      const P = PAL.stone, r = size, W = r * 2 + 4, H = Math.round(r * 1.5) + 4, B = new Buf(W, H), cx = W / 2, cy = H - 2 - r * .62;
      const n = 6 + (seed % 3), pts = [];
      for(let i = 0; i < n; i++){ const a = (i / n) * Math.PI * 2 + hash(seed, i, 1) * .5, rr = r * (.75 + hash(seed, i, 2) * .35); pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * .68]); }
      const inPoly = (x, y) => { let c = false; for(let i = 0, j = n - 1; i < n; j = i++){ const [xi, yi] = pts[i], [xj, yj] = pts[j]; if((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
      const ridge = cy - r * .12;                      // gờ chia mặt trên và các mặt bên
      for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){ if(!inPoly(x + .5, y + .5)) continue;
        const top = y + .5 < ridge + (x - cx) * .12, left = x + .5 < cx - r * .15 + (y - cy) * .4;
        let c = top ? P.lt : left ? P.base : P.sh;
        if(top && y + .5 < ridge - r * .35 && x < cx) c = P.hi;
        if(!top && y > cy + r * .45) c = left ? P.sh : P.dk;
        B.set(x, y, c);
      }
      // cạnh sáng dọc gờ trên-trái, vết nứt
      for(let x = 0; x < W; x++) for(let y = 0; y < H; y++){ if(B.get(x, y) && !B.get(x, y - 1) && x < cx + r * .4){ B.set(x, y, P.rim); break; } }
      const kx = Math.round(cx + r * .25); for(let k = 0; k < Math.max(2, r * .5); k++) if(B.get(kx + (k % 2), Math.round(ridge) + k)) B.set(kx + (k % 2), Math.round(ridge) + k, P.dk);
      if(mossy){ for(let x = Math.round(cx - r * .7); x < cx + r * .1; x++){ for(let y = 0; y < H; y++){ if(B.get(x, y)){ B.set(x, y, PAL.moss[(x + seed) % 3 === 0 ? 2 : 1]); if(hash(x, seed, 4) > .5) B.set(x, y + 1, PAL.moss[0]); break; } } } }
      B.outline(P.out);
      return B.canvas();
    });
  }

  /* ── hoa: mẫu vẽ tay, mỗi loại có cánh, nhụy, thân, lá ── */
  const FL = {
    daisy:    { rows: [[".p.p.", "pPcPp", ".pCp.", "..s..", "l.s.L", ".ls..", "..s.."], ["..p.p", ".pPcP", "..pCp", "..s..", "l.s.L", ".ls..", "..s.."]], pal: { p: '#ffffff', P: '#dfe6ea', c: '#ffd84a', C: '#e09a2a' } },
    tulip:    { rows: [[".r.r.", ".rRr.", ".rRR.", "..s..", ".ls..", "..sL.", "..s.."], ["..r.r", "..rRr", "..rRR", "..s..", ".ls..", "..sL.", "..s.."]], pal: { r: '#ff6a5a', R: '#c8302a' } },
    bluebell: { rows: [["..ss.", ".s..s", "bB.bB", "b...b", "..s..", ".ls..", "..s.."], ["...ss", "..s.s", ".bB.b", ".b..B", "..s..", ".ls..", "..s.."]], pal: { b: '#8fb0ff', B: '#5a78d8' } },
    lavender: { rows: [["..v..", ".vVv.", "..v..", ".vVv.", "..s..", ".ls..", "..sL."], ["...v.", "..vVv", "...v.", "..vVv", "..s..", ".ls..", "..sL."]], pal: { v: '#c9a2ff', V: '#8a62d8' } },
    butter:   { rows: [[".y...", "yYy.y", ".y.yY", ".s..y", ".s.s.", "ls.s.", ".ss.."], ["..y..", ".yYy.", "..y.y", "..syY", "..s.y", ".lss.", "..s.."]], pal: { y: '#ffe04a', Y: '#e09a20' } },
    poppy:    { rows: [[".rr..", "rRkr.", ".rr..", "..s..", "..s.L", ".ls..", "..s.."], ["..rr.", ".rRkr", "..rr.", "..s..", "..s.L", ".ls..", "..s.."]], pal: { r: '#ff8a4a', R: '#d84a2a', k: '#3a1a10' } }
  };
  const FL_BASE = { s: '#3f8a3a', l: '#5fae4a', L: '#2f6e2f' };
  function flower(ctx, kind, x, y, f){ const F = FL[kind]; stampCtx(ctx, F.rows[f ? 1 : 0], { ...FL_BASE, ...F.pal }, x - 2, y - 6); }
  const FLOWER_KINDS = Object.keys(FL);

  /* ── cỏ: nhiều dáng ── */
  const TUFTS = [
    ["..h..", ".hb.h", "hbd.b", ".dbd."],
    ["h...", "bh.h", "db.b", ".dd."],
    ["...h...", ".h.b..h", ".b.bh.b", "hd.db.d", ".ddddd."],
    ["..h", ".hb", "hbd", "dd."],
    ["h.....h", "bh.h.hb", "db.bhbd", ".dbdbd."]
  ];
  function tuft(ctx, x, y, v, P){ P = P || PAL.grass; const rows = TUFTS[v % TUFTS.length]; stampCtx(ctx, rows, { h: '#c8ec90', b: P.hi, d: '#356f2c' }, x - (rows[0].length >> 1), y - rows.length + 1, v > 4); }
  /* dương xỉ + nấm */
  function fern(seed){ return memo('fern' + seed, () => { const B = new Buf(19, 13), P = PAL.leafY;
    // 3 lá dương xỉ cong: sống lá + lá chét so le, mặt trên sáng, mặt dưới tối, nhỏ dần về ngọn
    for(const [a0, len, bend] of [[-150, 8, .05], [-92, 10, -.02], [-32, 8, -.05]]){
      let a = (a0 + (hash(seed, a0, 1) - .5) * 8) * Math.PI / 180, x = 9.5, y = 12;
      for(let i = 0; i < len; i++){ x += Math.cos(a); y += Math.sin(a); a += bend * (a0 < -90 ? 1 : -1) + .04 * Math.sign(Math.cos(a));
        const nx = -Math.sin(a), ny = Math.cos(a), L = Math.max(1, Math.round((len - i) / 3.2));
        B.set(x, y, P.sh);
        if(i > 0) for(let k = 1; k <= L; k++){ B.set(x + nx * k, y + ny * k, k === L ? P.base : P.sh); B.set(x - nx * k + Math.cos(a) * .4, y - ny * k + Math.sin(a) * .4, k === L ? P.hi : P.lt); }
      }
    }
    B.outline(P.out); return B.canvas(); }); }
  function mushrooms(seed){ return memo('mush' + seed, () => { const B = new Buf(11, 9);
    stamp(B, ["..rrrr.....", ".rRwrrr....", "rRRrrwrr...", "rkkkkkkr.rr", "..sS....rRw", "..sS...rkkk", "..sS....sS.", "..sS....sS."], { r: '#e0443a', R: '#ff7a6a', w: '#ffffff', k: '#9a2a22', s: '#f2e3c4', S: '#c9b48e' }, 0, 1);
    B.outline('#3a1a10'); return B.canvas(); }); }

  /* ── luống trồng: khung gỗ + đất có rãnh uốn nhẹ, mỗi luống một biến thể ── */
  function bed(size, seed, wet){
    return memo('bed' + size + seed + wet, () => {
      const S = wet ? PAL.soilW : PAL.soil, Wd = PAL.wood, W = size + 2, H = size + 4, B = new Buf(W, H), x0 = 1, y0 = 1, s = size;
      // đất bên trong (cách khung 2 px)
      for(let y = y0 + 2; y < y0 + s - 1; y++) for(let x = x0 + 2; x < x0 + s - 2; x++){
        const yy = y - (y0 + 2), wave = Math.round(Math.sin((x + seed) * .55) * .6 + Math.sin((x * .3 + seed * 1.7)) * .5), r = ((yy + wave) % 5 + 5) % 5;
        let c = r === 0 ? S.hi : r === 1 ? S.lt : r === 2 ? S.base : r === 3 ? S.sh : S.dk;
        B.set(x, y, c);
      }
      // cục đất có khối (sáng trên-trái, tối dưới-phải), đặt theo gờ
      for(let i = 0; i < 6; i++){ const x = x0 + 3 + Math.floor(hash(seed, i, 2) * (s - 7)), y = y0 + 3 + Math.floor(hash(seed, i, 3) * (s - 7)); if(B.get(x + 1, y + 1)) stamp(B, ['ab', 'bc'], { a: S.rim, b: S.lt, c: S.dk }, x, y); }
      if(hash(seed, 9, 4) > .4){ const x = x0 + 4 + Math.floor(hash(seed, 9, 5) * (s - 9)), y = y0 + 5 + Math.floor(hash(seed, 9, 6) * (s - 10)); stamp(B, ['.ab', 'abc', '.cc'], { a: PAL.stone.hi, b: PAL.stone.base, c: PAL.stone.dk }, x, y); }
      // khung gỗ: ván trên sáng, ván hai bên, ván dưới dày (mặt trước), đường nối ván + mấu gỗ lệch theo seed
      const seamT = x0 + 4 + Math.floor(hash(seed, 1, 7) * (s - 8)), seamB = x0 + 3 + Math.floor(hash(seed, 2, 7) * (s - 6));
      for(let x = x0; x < x0 + s; x++){ B.set(x, y0, Wd.rim); B.set(x, y0 + 1, x === seamT ? Wd.sh : Wd.lt); B.set(x, y0 + s - 1, Wd.lt); B.set(x, y0 + s, x === seamB ? Wd.dk : Wd.base); B.set(x, y0 + s + 1, Wd.sh); }
      for(let y = y0; y < y0 + s + 1; y++){ B.set(x0, y, Wd.hi); B.set(x0 + 1, y, Wd.base); B.set(x0 + s - 2, y, Wd.sh); B.set(x0 + s - 1, y, Wd.dk); }
      const knot = x0 + 3 + Math.floor(hash(seed, 3, 7) * (s - 6)); B.set(knot, y0 + s, Wd.dk); B.set(knot + 1, y0 + s, Wd.sh);
      // cọc góc có mũ
      for(const [cx, cy] of [[x0, y0], [x0 + s - 3, y0], [x0, y0 + s - 1], [x0 + s - 3, y0 + s - 1]]) stamp(B, ['abb', 'bcc', 'cdd'], { a: Wd.rim, b: Wd.hi, c: Wd.base, d: Wd.dk }, cx, cy - 1);
      if(wet) for(const [x, y] of [[6, 7], [15, 12], [10, 16]]) stamp(B, ['ab'], { a: '#cdeeff', b: '#7fb6d4' }, x, y);
      B.outline(Wd.out);
      return B.canvas();
    });
  }

  /* ── sinh vật ── */
  const BIRD = {
    pal: { o: '#2a1a10', H: '#9c6a3a', h: '#c99464', e: '#120d0a', i: '#ffffff', b: '#f0a030', B: '#c87a18', W: '#6e4425', w: '#b0804c', x: '#3a2414', C: '#f2e3c4', c: '#d8c3a0', T: '#4a2c17', f: '#e08a28' },
    stand: ["......ooo...", ".....oHhHo..", ".....oHeiHbb", "..oooxHHHoB.", ".oWwWwWCCCo.", "oTWWxWWCCco.", "oToWWWWcco..", ".o..oooco...", "....of.fo...", "....f..f...."],
    peck:  ["............", "..oooo......", ".oWwWwooo...", "oTWWxWWHhHo.", "oToWWWHHeiHo", ".o..oCCHHHbb", "....ocCooo.B", "....of.fo...", "....f..f...."],
    flap:  ["..oo........", ".owwo.ooo...", "oWwWooHhHo..", "oWWWxoHeiHbb", ".oWWxWHHHoB.", "..oWWWCCCo..", "..oWWWWcco..", "...o.oooco..", "....of.fo...", "....f..f...."],
    fly:   ["oo.......oo.", "owo.....owo.", ".oWo...oWo..", "..oWoooWo...", "...oHHHHo...", "...oHeiHbb..", "....oooo...."]
  };
  const HOP = {
    pal: { o: '#1f2e10', K: '#6f9628', k: '#4f7020', W: '#5a8228', w: '#8ab83c', B: '#a8d448', b: '#d6f07a', H: '#b8de52', e: '#120d0a', i: '#ffffff' },
    sit:  ["...........o.", ".oo.......o..", "oKKo.ooooo...", "oKkKoWwWWwoo.", ".okoBBBBBBHHo", "..obBBBBBBHeo", "..oKoBoBooHio", ".oK..o..o.oo."],
    jump: ["............o", "...........o.", "...ooooooooo.", "..oWwWWwWWwHo", ".obBBBBBBBHeo", "oKKooBoBooHio", "oKo..o..o.oo.", "oo..........."]
  };
  function bird(ctx, pose, x, y, dir){ const rows = BIRD[pose]; stampCtx(ctx, rows, BIRD.pal, Math.round(x - 6), Math.round(y - rows.length + 1), dir < 0); }
  function hopper(ctx, pose, x, y, dir){ const rows = HOP[pose]; stampCtx(ctx, rows, HOP.pal, Math.round(x - 6), Math.round(y - rows.length + 1), dir < 0); }


  /* ═══ MẪU CHUẨN v5 ═══ */
  /* ── luống đất tự nhiên: gò đất bo tròn, mép lượn nhẹ, các luống cày bằng cụm đất có khối, mặt trước 2 px, viền chọn lọc ── */
  function mound(size, seed, wet){
    return memo('mound' + size + seed + wet, () => {
      const S = wet ? PAL.soilW : PAL.soil, W = size + 2, H = size + 5, B = new Buf(W, H), s = size, x0 = 1, y0 = 1;
      const jit = (k, a) => Math.round(Math.sin(k * .9 + seed * 1.3 + a) * .55 + Math.sin(k * .37 + seed + a * 2) * .5);   // mép lượn ±1 px, mượt (không nhiễu)
      const top = x => y0 + Math.max(0, jit(x, 1)), bot = x => y0 + s - 1 + Math.min(0, jit(x, 2)), left = y => x0 + Math.max(0, jit(y, 3)), right = y => x0 + s - 1 + Math.min(0, jit(y, 4));
      const R = 3, inMask = (x, y) => { if(y < top(x) || y > bot(x) || x < left(y) || x > right(y)) return false;
        const cx = Math.min(x - x0, x0 + s - 1 - x), cy = Math.min(y - y0, y0 + s - 1 - y); if(cx < R && cy < R) return (R - cx - .5) ** 2 + (R - cy - .5) ** 2 <= R * R + .3; return true; };
      // mặt đất
      for(let y = 0; y < H; y++) for(let x = 0; x < W; x++) if(inMask(x, y)) B.set(x, y, S.base);
      // luống cày liền mạch: mỗi chu kỳ 5 px = gờ sáng → sườn → nền → rãnh → nền; các đường hơi uốn theo x (mượt, không nhiễu)
      const wave = x => Math.round(Math.sin(x * .42 + seed * .8) * .7 + Math.sin(x * .17 + seed * 2.1) * .6);
      const TONE = [S.hi, S.lt, S.base, S.sh, S.base];
      for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){ if(!B.get(x, y)) continue; const p = (((y - y0 - 2 + wave(x)) % 5) + 5) % 5; B.set(x, y, TONE[p]); }
      // cục đất tròn trên gờ: điểm sáng + bóng nhỏ phía dưới-phải, khoảng cách không đều
      for(let y = y0 + 2; y < y0 + s - 2; y++) for(let x = x0 + 3; x < x0 + s - 3; x++){
        const p = (((y - y0 - 2 + wave(x)) % 5) + 5) % 5;
        if(p === 1 && hash(seed, x * 31 + y, 7) > .82 && inMask(x + 1, y + 1)){ B.set(x, y - 1, S.rim); B.set(x, y, S.hi); B.set(x + 1, y, S.lt); B.set(x + 1, y + 1, S.sh); }
        if(p === 3 && hash(seed, x * 17 + y, 9) > .9) B.set(x, y, S.dk);
      }
      // sỏi nhỏ + một rễ/cọng rơm, đặt có chủ đích ở rãnh
      const px = x0 + 4 + Math.floor(hash(seed, 1, 8) * (s - 9)), py = y0 + 9 + (seed % 2) * 5; stamp(B, ['ab', 'bc'], { a: PAL.stone.hi, b: PAL.stone.base, c: PAL.stone.dk }, px, py);
      // mép: trên sáng, trái sáng vừa, phải tối; mặt trước dày 2 px
      for(let x = 0; x < W; x++){ for(let y = 0; y < H; y++){ if(B.get(x, y)){ if(!B.get(x, y - 1)) B.set(x, y, S.rim); break; } } }
      for(let y = 0; y < H; y++){ for(let x = 0; x < W; x++){ if(B.get(x, y)){ if(!B.get(x - 1, y)) B.set(x, y, S.hi); break; } } for(let x = W - 1; x >= 0; x--){ if(B.get(x, y)){ if(!B.get(x + 1, y)) B.set(x, y, S.sh); break; } } }
      for(let x = 0; x < W; x++){ let yb = -1; for(let y = H - 1; y >= 0; y--) if(B.get(x, y)){ yb = y; break; } if(yb >= 0){ B.set(x, yb + 1, S.sh); B.set(x, yb + 2, S.dk); if(hash(seed, x, 31) > .86) B.set(x, yb + 1, S.lt); } }
      if(wet) for(const [x, y] of [[6, 6], [15, 11], [9, 16]]) stamp(B, ['ab'], { a: '#d8f2ff', b: '#86bcd8' }, x, y);
      // viền chọn lọc: trên-trái nâu ấm, dưới-phải nâu sẫm (không dùng đen)
      B.outline(wet ? '#1a0f08' : '#2a170c', wet ? '#3a2416' : '#5a3a22');
      return B.canvas();
    });
  }
  /* ── ô chưa mở: một mẫu thống nhất, trầm màu: nền cỏ nhạt khô + viền chấm + cọc mốc 2 góc ── */
  function lockedCell(size){
    return memo('locked' + size, () => { const W = size, B = new Buf(W, W), c1 = '#8fae6e', c2 = '#86a566', c3 = '#a9c088', dot = '#a08a5c';
      for(let y = 1; y < W - 1; y++) for(let x = 1; x < W - 1; x++) B.set(x, y, ((x >> 2) + (y >> 2)) % 2 ? c1 : c2);
      for(let y = 3; y < W - 2; y += 6) for(let x = 3 + (y % 4); x < W - 2; x += 6){ B.set(x, y, c3); B.set(x + 1, y - 1, c3); }
      for(let k = 1; k < W - 1; k += 3){ B.set(k, 0, dot); B.set(k, W - 1, dot); B.set(0, k, dot); B.set(W - 1, k, dot); }
      stamp(B, ['a', 'b', 'b'], { a: '#d8b47a', b: '#8a5a32' }, 1, 1); stamp(B, ['a', 'b', 'b'], { a: '#d8b47a', b: '#8a5a32' }, W - 2, W - 4);
      return B.canvas(); });
  }

  /* ── chim (cổ đỏ): lưng xanh xám, ngực cam, bụng kem, mỏ vàng — tách khỏi nền xanh/nâu ── */
  const ROBIN = {
    pal: { o: '#22202e', H: '#55688f', h: '#8ea4cc', e: '#0e0c14', i: '#ffffff', b: '#ffc23a', B: '#c8841c', W: '#46557c', w: '#7c90bc', x: '#2e3a58', R: '#ec6a2e', r: '#ffa25a', C: '#f8eedc', T: '#2e3a58', f: '#e4a03c' },
    stand: ["........ooo...", ".......ohHHo..", ".......oHieHbb", "...oooooHHHoB.", "..owwWWWoRrRo.", ".oTWWwWWRRrRo.", "oTTxWWWWRRRCo.", "oo.oxxWWCCCo..", ".....ooooCo...", "......f..f....", ".....ff.ff...."],
    peck:  ["..............", "..............", "...oooo.......", "..owwWWooo....", ".oTWWwWWoHhHo.", "oTTxWWWWHHieHo", "oo.oxxWWRRHHbb", ".....oCCRRoBb.", ".....ooooo....", "......f..f....", ".....ff.ff...."],
    flap:  ["...oo...ooo...", "..owwo.ohHHo..", ".owWWwooHieHbb", ".oWWWWoHHHHoB.", "..oxWWWoRrRo..", ".oToWWWRRRrRo.", "oTTo.oWRRRRCo.", "oo....oCCCCo..", ".....ooooCo...", "......f..f....", ".....ff.ff...."],
    fly:   ["oo.........oo.", "owwo.....owwo.", ".oWWo...oWWo..", "..oWWoooWWo...", "...ohHHHRo....", "...oHieHRRbb..", "....ooooooB..."]
  };
  /* ── châu chấu (vàng đất): đùi sau gập hình chữ V màu nâu cam, cánh sẫm, râu dài ── */
  const LOCUST = {
    pal: { o: '#3a2a10', B: '#d6be3e', b: '#f4e07e', d: '#a6881e', W: '#86762e', w: '#b8a648', K: '#c4682a', k: '#8a4618', H: '#e2ca4a', e: '#140e06', a: '#5a4010' },
    sit:  ["...........aa.", "..ook.....a...", ".oKKKo...a....", "oKkooKooooooo.", "oKoWWwWWWWHHo.", ".obBBBBBBBHeHo", "..odBdBdddHHo.", "..ok.o.o..oo..", ".ok..o.o......"],
    jump: ["............aa", "...........a..", "..ooooooooooa.", ".oWWwWWWWWHHo.", "obBBBBBBBBHeHo", "KdBdBdddddHHo.", "Kk.o.o.....o..", "ok............", "o............."]
  };
  function robin(ctx, pose, x, y, dir){ const rows = ROBIN[pose]; stampCtx(ctx, rows, ROBIN.pal, Math.round(x - 7), Math.round(y - rows.length + 1), dir < 0); }
  function locust(ctx, pose, x, y, dir){ const rows = LOCUST[pose]; stampCtx(ctx, rows, LOCUST.pal, Math.round(x - 7), Math.round(y - rows.length + 1), dir < 0); }

  /* ── quầy hàng hoàn chỉnh (62×60): khung gỗ, kệ sau có hũ, mái vải sọc có nếp + diềm vỏ sò + bóng, quầy có mặt trên/mặt trước,
        giỏ nông sản, biển treo xích, chậu cây, thùng gỗ ── */
  function shop(fruits){
    return memo('shop', () => {
      const Wd = PAL.wood, W = 62, H = 60, B = new Buf(W, H);
      const rect = (x, y, w, h, f) => { for(let j = 0; j < h; j++) for(let i = 0; i < w; i++){ const c = f(i, j, w, h); if(c) B.set(x + i, y + j, c); } };
      const plank = (i, j, w, h, vertical) => { const k = vertical ? i : j; if(vertical && i % 5 === 4) return Wd.dk; return (vertical ? i % 5 === 0 : j === 0) ? Wd.hi : (vertical ? (j + i * 3) % 11 === 0 : (i + j * 7) % 13 === 0) ? Wd.sh : Wd.base; };
      // cột sau + vách kệ (tối hơn vì nằm trong bóng mái)
      rect(9, 20, 44, 18, (i, j) => j % 6 === 5 ? Wd.dk : i % 7 === 0 ? Wd.sh : '#6a4024');
      for(const sy of [26, 32]) rect(9, sy, 44, 1, () => Wd.lt);                                  // hai tầng kệ
      const jar = (x, y, c1, c2) => stamp(B, ['.oo.', 'owwo', 'oabo', 'oabo', '.oo.'], { o: '#2b1a10', w: '#e8f4f8', a: c1, b: c2 }, x, y);
      [['#f0b630', '#b47a10'], ['#ff7a5a', '#a8201a'], ['#8fe0b4', '#2fae84'], ['#b8a8ee', '#5e48a8'], ['#ffd0dc', '#d06a7a'], ['#dcefff', '#9cc3e0']].forEach(([a, b], k) => jar(11 + k * 7, 21, a, b));
      for(let k = 0; k < 5; k++) stamp(B, ['.oo.', 'oaao', 'obbo'], { o: '#2b1a10', a: '#e6c592', b: '#b08a55' }, 13 + k * 8, 28);   // túi hạt
      // cột trước (to, có mũ), xà mái
      for(const px of [5, 53]) rect(px, 12, 4, 40, (i, j) => i === 0 ? Wd.hi : i === 3 ? Wd.dk : j % 9 === 4 ? Wd.sh : Wd.base);
      rect(3, 11, 56, 3, (i, j) => j === 0 ? Wd.rim : j === 1 ? Wd.lt : Wd.sh);
      // mái vải: sọc đỏ/kem, mỗi sọc sáng-vừa-tối theo nếp, diềm vỏ sò, bóng đổ xuống kệ
      for(let x = 1; x < 61; x++){ const k = (x - 1) % 8, red = Math.floor((x - 1) / 8) % 2 === 0, sag = Math.round(Math.sin(((x - 1) % 8) / 8 * Math.PI) * 1);
        const c = red ? (k < 2 ? '#ff8a6a' : k > 5 ? '#b8382a' : '#e0503a') : (k < 2 ? '#ffffff' : k > 5 ? '#d8c49c' : '#fff1d6');
        for(let y = 5; y < 15 + sag; y++) B.set(x, y, y === 5 ? (red ? '#ffb090' : '#ffffff') : c);
        const sc = Math.round(Math.sin(k / 8 * Math.PI) * 3); for(let y = 15 + sag; y < 16 + sag + sc; y++) B.set(x, y, red ? '#c0402e' : '#e8d4ae');
        B.set(x, 16 + sag + sc, red ? '#8a2a1e' : '#b8a27a');
      }
      for(let x = 9; x < 53; x++){ B.set(x, 20, '#3e2414'); B.set(x, 21, B.get(x, 21) === '#6a4024' ? '#4f301b' : B.get(x, 21)); }
      // quầy: mặt trên 3 px sáng + mặt trước ván dọc
      rect(3, 38, 56, 3, (i, j) => j === 0 ? Wd.rim : j === 1 ? Wd.hi : Wd.lt);
      rect(4, 41, 54, 13, (i, j, w, h) => j === h - 1 ? Wd.dk : plank(i, j, w, h, true));
      rect(4, 41, 54, 1, () => Wd.sh);
      // giỏ đan có nông sản trên quầy
      const basket = (x, fr) => { stamp(B, ['oooooooo', 'oababab o'.replace(' ', ''), 'obababao', '.oooooo.'], { o: '#2b1a10', a: '#c99464', b: '#8f5a32' }, x, 35);
        for(let k = 0; k < 3; k++) stamp(B, ['.ab', 'abc', '.cc'], { a: fr[3], b: fr[2], c: fr[1] }, x + 1 + k * 2, 32 - (k === 1 ? 1 : 0)); };
      fruits.slice(0, 4).forEach((fr, k) => basket(7 + k * 12, fr));
      // chậu tiền xu nhỏ
      stamp(B, ['.yy.', 'yYYy', 'oyyo', 'oooo'], { y: '#ffe070', Y: '#c4901a', o: '#5a3a22' }, 52, 34);
      // biển hiệu treo xích, vẽ bông hoa
      for(const cx of [24, 37]){ B.set(cx, 1, '#5a5f66'); B.set(cx, 2, '#8a9096'); B.set(cx, 3, '#5a5f66'); B.set(cx, 4, '#8a9096'); }
      rect(19, -3, 24, 1, () => null);
      stamp(B, ['oooooooooooooooooo', 'oRRRRRRRRRRRRRRRRo', 'oRppppppppppppppPo', 'oRpppp.ff.ppppppPo', 'oRpppffYff pppppPo'.replace(' ', 'p'), 'oRppppfffppppppPPo', 'oRppppplppppppPPPo', 'oPPPPPPPPPPPPPPPPo', 'oooooooooooooooooo'],
        { o: '#2b1a10', R: Wd.hi, P: Wd.sh, p: '#f1e2b8', f: '#ff8fb0', Y: '#ffd84a', l: '#3f9a45' }, 22, 0);
      // chậu cây bên phải, thùng gỗ bên trái có bí
      stamp(B, ['..gg..', '.gGGg.', 'gGgGGg', '.gGgg.', '.oooo.', 'oaaaao', '.abba.', '.obbo.'], { g: '#4a8a3e', G: '#7cc35a', o: '#5a2a18', a: '#e08a5a', b: '#b8603a' }, 56, 46);
      stamp(B, ['.oooooo.', 'oPPPPPPo', 'oVvVvVVo', 'oaaaaaao', 'oabababo', 'oaaaaaao', 'oooooooo'], { o: '#2b1a10', a: Wd.lt, b: Wd.sh, P: '#7d68c4', V: '#b8a8ee', v: '#8a74d0' }, 0, 47);
      B.outline('#2b1a10');
      return B.canvas();
    });
  }

  return { mound, lockedCell, robin, locust, shop, PAL, Buf, stamp, stampCtx, foliage, oak, pine, bush, rock, flower, FLOWER_KINDS, tuft, fern, mushrooms, bed, bird, hopper, hash, memo };
})();

/* ═══ Khu vườn — renderer pixel-art (v3) ═══
   Lớp vẽ (tách riêng):  bg  = nền cỏ, mảng sáng tối, lối đất, ao, sân vườn, hàng rào, cây/bụi hậu cảnh, quầy hàng  (vẽ sẵn 1 lần)
                         live = ô đất → cây trồng → sinh vật → nước/bướm/ong      (vẽ mỗi khung)
                         fg  = bụi cỏ và lá tiền cảnh ở mép dưới                  (vẽ sẵn, đè lên cùng)
   Mọi sprite (cây trồng, cây rìa, bụi, đá, hoa, sinh vật, quầy) dựng từ "primitive" pixel có viền + 3–4 bậc bóng,
   lưu cache thành canvas; không có hình chữ nhật trơn hay CSS. */
const GardenMap = (() => {
  /* ───────── tiện ích ───────── */
  const hx = h => { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
  const hash = (x, y, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
  function vn(x, y, sc, s = 0){ const X = x / sc, Y = y / sc, x0 = Math.floor(X), y0 = Math.floor(Y), fx = X - x0, fy = Y - y0;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), a = hash(x0, y0, s), b = hash(x0 + 1, y0, s), c = hash(x0, y0 + 1, s), d = hash(x0 + 1, y0 + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
  const R = (ctx, col, x, y, w = 1, h = 1) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
  const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  function shadow(ctx, cx, cy, rx, ry, a = .22){ ctx.fillStyle = `rgba(24,52,24,${a})`; for(let y = -ry; y <= ry; y++){ const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y / ry) ** 2))); if(w > 0) ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2, 1); } }

  /* ───────── bảng màu thống nhất ───────── */
  const C = {
    out: '#1b2b1a', outW: '#2b1a10',
    grass: ['#5c9748', '#66a150', '#70aa58', '#7bb362', '#8fc174'],      // hậu cảnh: bão hoà và tương phản thấp hơn khu trồng      // tối → sáng
    blade: '#4e9139', bladeL: '#b6e584',
    dirt: ['#8e6338', '#a8784a', '#c29462', '#d6ad7a', '#e6c592'],      // lối đất
    soil: ['#3f2615', '#5a3720', '#74492a', '#8f5d36', '#a97447', '#c18c5c'],
    soilW: ['#2c1a0f', '#3f2717', '#553420', '#6a432a', '#80553a', '#966a4c'],
    leaf: ['#2a5f2c', '#3c8139', '#57a447', '#7cc35a', '#b0e07c'],
    leafB: ['#24552f', '#336f3c', '#4a8d48', '#6aae58', '#9fd27a'],     // lá hậu cảnh hơi lạnh
    wood: ['#4a2c17', '#6e4425', '#8f5a32', '#a8703f', '#c98f55', '#e0b07a'],
    stone: ['#5b6266', '#7b8387', '#9ba2a5', '#bec4c5', '#e1e5e4'],
    water: ['#1f6f8a', '#2a8ea6', '#3fb0c0', '#6fd2d6', '#bdf1ee', '#f2fffd']
  };

  /* ───────── bộ dựng sprite từ primitive ───────── */
  class Buf {
    constructor(w, h){ this.w = w; this.h = h; this.p = new Array(w * h).fill(null); }
    get(x, y){ return x < 0 || y < 0 || x >= this.w || y >= this.h ? null : this.p[y * this.w + x]; }
    set(x, y, c){ if(x >= 0 && y >= 0 && x < this.w && y < this.h) this.p[y * this.w + x] = c; }
    // mask(x, y) → true nếu thuộc hình; col(x, y) → màu. Viền vẽ ở các điểm ngoài kề hình (nếu out).
    shape(x0, y0, x1, y1, mask, col, out){
      x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(this.w - 1, Math.ceil(x1)); y1 = Math.min(this.h - 1, Math.ceil(y1));
      const M = new Set();
      for(let y = y0; y <= y1; y++) for(let x = x0; x <= x1; x++) if(mask(x + .5, y + .5)) M.add(y * this.w + x);
      if(out) for(const k of M){ const x = k % this.w, y = (k / this.w) | 0; for(const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]){ const X = x + dx, Y = y + dy; if(X >= 0 && Y >= 0 && X < this.w && Y < this.h && !M.has(Y * this.w + X)) this.p[Y * this.w + X] = out; } }
      for(const k of M){ const x = k % this.w, y = (k / this.w) | 0, c = col(x + .5, y + .5); if(c) this.p[k] = c; }
      return M;
    }
    canvas(){ const c = mkCanvas(this.w, this.h), k = c.getContext('2d'); for(let y = 0; y < this.h; y++) for(let x = 0; x < this.w; x++){ const v = this.p[y * this.w + x]; if(v){ k.fillStyle = v; k.fillRect(x, y, 1, 1); } } return c; }
  }
  // lá nhọn: gốc (x, y), dài len, rộng wid, góc ang (độ; -90 = thẳng lên). pal [tối, vừa, sáng, gân]
  function leaf(B, x, y, len, wid, ang, pal, out = C.out){
    const a = ang * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), r = len + wid + 1;
    B.shape(x - r, y - r, x + r, y + r, (px, py) => { const dx = px - x, dy = py - y, u = dx * ca + dy * sa, v = -dx * sa + dy * ca; if(u < 0 || u > len) return false; return Math.abs(v) <= wid * Math.pow(Math.sin(Math.PI * Math.min(1, u / len * .92 + .04)), .7) + .3; },
      (px, py) => { const dx = px - x, dy = py - y, u = dx * ca + dy * sa, v = -dx * sa + dy * ca, dark = v * ca > 0;
        if(Math.abs(v) < .55 && u > 1 && u < len - 1.5) return pal[3];
        if(Math.abs(v) > wid * .62) return dark ? pal[0] : pal[1];
        return dark ? pal[1] : pal[2]; }, out);
  }
  // quả/khối tròn có bóng: pal [tối, vừa, sáng, điểm sáng]
  function orb(B, cx, cy, rx, ry, pal, out = C.out, ribs){
    B.shape(cx - rx - 1, cy - ry - 1, cx + rx + 1, cy + ry + 1, (px, py) => ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= 1,
      (px, py) => { const nx = (px - cx) / rx, ny = (py - cy) / ry, L = -(nx * .6 + ny * .8);
        if(ribs && Math.abs(Math.round(px - cx)) % ribs === 0 && Math.abs(nx) < .8 && L < .5) return pal[0];
        return L > .55 ? pal[2] : L < -.3 ? pal[0] : pal[1]; }, out);
    if(rx >= 1.5) B.set(Math.round(cx - rx * .4), Math.round(cy - ry * .45), pal[3]);
  }
  // đường thân/cành dày w
  function stem(B, pts, w, col, out = C.out){
    const segD = (px, py, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / L)) : 0; return Math.hypot(px - a[0] - t * dx, py - a[1] - t * dy); };
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for(const [x, y] of pts){ x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    B.shape(x0 - w - 1, y0 - w - 1, x1 + w + 1, y1 + w + 1, (px, py) => { for(let i = 0; i < pts.length - 1; i++) if(segD(px, py, pts[i], pts[i + 1]) <= w / 2) return true; return false; }, () => col, out);
  }
  // tán lá nhiều chùm: thân khối + các chùm lá tròn có bóng riêng (kiểu cây RPG pixel)
  function canopy(B, cx, cy, rx, ry, pal, seed, out = C.out){
    const inBody = (px, py) => ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= 1 + (vn(px, py, 3, seed) - .5) * .35;
    const M = B.shape(cx - rx - 2, cy - ry - 2, cx + rx + 2, cy + ry + 2, inBody, (px, py) => py > cy + ry * .35 ? pal[0] : pal[1], out);
    const n = Math.round(rx * ry / 7), clumps = [];
    for(let i = 0; i < n * 3 && clumps.length < n; i++){ const a = hash(seed, i, 1) * Math.PI * 2, d = Math.sqrt(hash(seed, i, 2)) * .85, x = cx + Math.cos(a) * rx * d, y = cy + Math.sin(a) * ry * d - ry * .12; if(inBody(x, y)) clumps.push([x, y, 2.6 + hash(seed, i, 3) * 2.2]); }
    clumps.sort((p, q) => (p[1] - q[1]));                     // chùm phía dưới vẽ sau → đè lên
    for(const [x, y, r] of clumps){
      const lift = (cy + ry - y) / (2 * ry);                    // chùm càng cao càng sáng
      for(let yy = Math.floor(y - r - 1); yy <= y + r + 1; yy++) for(let xx = Math.floor(x - r - 1); xx <= x + r + 1; xx++){
        if(!M.has(yy * B.w + xx)) continue; const d2 = ((xx + .5 - x) ** 2 + (yy + .5 - y) ** 2) / (r * r);
        if(d2 > 1){ if(d2 < 1.45 && (xx + .5 - x) + (yy + .5 - y) > 0) B.set(xx, yy, pal[0]); continue; }
        const nx = (xx + .5 - x) / r, ny = (yy + .5 - y) / r, L = -(nx * .6 + ny * .8) + lift * .55 - .1;
        B.set(xx, yy, L > .62 ? pal[4] : L > .25 ? pal[3] : L > -.2 ? pal[2] : pal[1]);
      }
    }
    return M;
  }

  /* ───────── cây trồng: sprite riêng cho từng loại × giai đoạn ───────── */
  // bậc hạt giống → loại cây (khớp nông sản trong dữ liệu vật phẩm)
  const CROPK = { 1: 'radish', 2: 'gourd', 3: 'berry', 4: 'grape', 5: 'apple', vip: 'peach' };
  const FRUIT = {
    radish: ['#9cc3e0', '#dcefff', '#ffffff', '#ffffff'], gourd: ['#5e48a8', '#8a74d0', '#b8a8ee', '#efe9ff'], berry: ['#a8201a', '#e0402c', '#ff7a5a', '#ffd2c2'],
    grape: ['#167a5c', '#2fae84', '#6fe0b4', '#d8fff0'], apple: ['#b47a10', '#f0b630', '#ffe070', '#fffbe0'], peach: ['#d06a5a', '#ff9c88', '#ffc8b4', '#fff2ea']
  };
  const SEEDC = { 1: '#d8b48a', 2: '#c9d1dc', 3: '#f0c04a', 4: '#3fc5a0', 5: '#a985f5', vip: '#ff9cc0' };
  const LV = [C.leaf[0], C.leaf[2], C.leaf[3], C.leaf[4]];
  const cropCache = new Map();
  const CL = { out: '#1c3620', dk: '#2a5a2a', sh: '#3a7a34', base: '#52a044', lt: '#72bf52', hi: '#a2dc6c', rim: '#d0f090' };     // lá cây trồng: tươi, sáng hơn cây rìa
  const LVp = [CL.sh, CL.base, CL.lt, CL.hi];
  function outlineBuf(B, col){ const add = []; for(let y = 0; y < B.h; y++) for(let x = 0; x < B.w; x++){ if(B.p[y * B.w + x]) continue; for(const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if(B.get(x + dx, y + dy)){ add.push([x, y]); break; } } for(const [x, y] of add) B.p[y * B.w + x] = col; }
  // lá có răng cưa: lá thường + khía mép xen kẽ
  function sLeaf(B, x, y, len, wid, ang){ leaf(B, x, y, len, wid, ang, LVp, CL.out); const a = ang * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    for(let u = 2; u < len - 1; u += 2){ const v = wid * Math.pow(Math.sin(Math.PI * u / len), .7) + .3, px = x + ca * u - sa * v, py = y + sa * u + ca * v; if(B.get(Math.round(px), Math.round(py)) && B.get(Math.round(px), Math.round(py)) !== CL.out) B.set(Math.round(px), Math.round(py), CL.out); } }
  const fruitStamp = (B, x, y, F, big) => A.stamp(B, big ? ['.abb.', 'abccb', 'bcccd', 'bccdd', '.ddd.'] : ['abb', 'bcd', '.dd'], { a: F[3], b: F[2], c: F[1], d: F[0] }, Math.round(x) - (big ? 2 : 1), Math.round(y) - (big ? 2 : 1));
  function cropSprite(kind, stage, frame){
    const key = kind + stage + frame; if(cropCache.has(key)) return cropCache.get(key);
    const B = new Buf(28, 32), bx = 14, by = 29, sw = frame ? 3 : 0, F = FRUIT[kind];
    if(stage === 'sprout'){
      if(kind === 'radish' || kind === 'gourd'){                        // hai lá mầm tròn/bầu + lá thật nhú giữa
        stem(B, [[bx, by], [bx, by - 5]], 1, CL.sh, CL.out);
        orb(B, bx - 3.5, by - 6, kind === 'gourd' ? 3.4 : 2.8, 2, [CL.sh, CL.base, CL.lt, CL.hi], CL.out); orb(B, bx + 3.5, by - 6.5, kind === 'gourd' ? 3.4 : 2.8, 2, [CL.sh, CL.base, CL.lt, CL.hi], CL.out);
        leaf(B, bx, by - 6, 4, 1.6, -90 + sw, LVp, CL.out);
      } else if(kind === 'berry'){ for(const a of [-140, -90, -40]) sLeaf(B, bx, by - 2, 6, 2.2, a + (a === -90 ? sw : 0)); }
      else if(kind === 'grape'){ stem(B, [[bx + 5, by], [bx + 5, by - 12]], 2, C.wood[3], C.outW); stem(B, [[bx, by], [bx + 1, by - 5], [bx + 4, by - 8]], 1, CL.sh, CL.out); sLeaf(B, bx, by - 4, 5, 2.6, -150); sLeaf(B, bx + 2, by - 7, 5, 2.6, -40); }
      else { A.stamp(B, ['..a', '.a.', 'ab.', 'b..'], { a: C.wood[4], b: C.wood[2] }, bx - 1, by - 8); stem(B, [[bx, by], [bx, by - 6]], 2, C.wood[3], C.outW); sLeaf(B, bx, by - 6, 5, 2, -150 + sw); sLeaf(B, bx + 1, by - 7, 5, 2, -30 - sw); sLeaf(B, bx, by - 7, 4, 1.6, -95); if(kind === 'peach') fruitStamp(B, bx + 3, by - 11, ['#d06a7a', '#ff9cb4', '#ffd0dc', '#ffffff']); }
    } else {
      const ripe = stage === 'ripe';
      if(kind === 'radish'){                       // hoa thị 6 lá dài răng cưa, củ trắng xanh có má hồng trồi khỏi đất
        const L = ripe ? 11 : 9;
        for(const [a, l, w] of [[-168, L - 2, 1.5], [-12, L - 2, 1.5], [-136 + sw, L, 1.9], [-44 - sw, L, 1.9], [-108, L + 2, 1.8], [-72, L + 2, 1.8]]) sLeaf(B, bx, by - (ripe ? 5 : 2), l, w, a);
        if(ripe){ orb(B, bx, by - 2, 5, 3.6, F, CL.out); A.stamp(B, ['p..p'], { p: '#ffb3c6' }, bx - 2, by - 1); B.set(bx - 1, by - 2, '#2a1d14'); B.set(bx + 1, by - 2, '#2a1d14'); }
      }
      if(kind === 'gourd'){                         // dây bò + lá to xẻ thuỳ + tua cuốn + hoa sao vàng; quả bí múi rõ
        stem(B, [[bx - 11, by - 1], [bx - 4, by - 3], [bx + 4, by - 2], [bx + 11, by - 4]], 1, CL.sh, CL.out);
        for(const [x, y, a] of [[bx - 5, by - 2, -155 + sw], [bx + 4, by - 2, -30 - sw], [bx - 1, by - 4, -100]]){ leaf(B, x, y, 9, 3.6, a, LVp, CL.out); const r = a * Math.PI / 180; B.set(x + Math.cos(r) * 6 - Math.sin(r) * 4, y + Math.sin(r) * 6 + Math.cos(r) * 4, CL.out); }
        A.stamp(B, ['.aa', 'a..', 'a.a', '.a.'], { a: CL.sh }, bx + 9, by - 9);
        if(ripe){ orb(B, bx + 3, by - 3, 7, 4.6, F, CL.out, 3); stem(B, [[bx + 3, by - 8], [bx + 4, by - 10], [bx + 6, by - 10]], 2, C.wood[2], C.outW); }
        else A.stamp(B, ['.y.', 'yoy', '.y.'], { y: '#ffd84a', o: '#e08a20' }, bx - 9, by - 9);
      }
      if(kind === 'berry'){                         // bụi nhiều cụm lá (cùng hệ tán cây), hoa trắng → quả mọng đỏ có điểm sáng
        A.stamp(B, ['a.a', '.a.', '.a.'], { a: C.wood[2] }, bx - 1, by - 3);
        A.foliage(B, [{ x: bx - 4, y: by - 9, r: 4.6, d: .2 }, { x: bx + 4, y: by - 9, r: 4.4, d: .2 }, { x: bx, y: by - 13, r: 5, d: .5 }, { x: bx - 2, y: by - 7, r: 3.8, d: .9 }, { x: bx + 3, y: by - 7, r: 3.6, d: .9 }], CL, 5 + sw);
        outlineBuf(B, CL.out);
        const pts = [[-5, -11], [3, -14], [5, -8], [-2, -7], [0, -15], [-6, -7]];
        for(const [dx, dy] of pts.slice(0, ripe ? 6 : 4)) ripe ? fruitStamp(B, bx + dx, by + dy, F) : A.stamp(B, ['.w.', 'wyw', '.w.'], { w: '#ffffff', y: '#ffd84a' }, bx + dx - 1, by + dy - 1);
      }
      if(kind === 'grape'){                         // giàn gỗ có vân, dây leo xoắn, lá xẻ; chùm nho hình tam giác
        for(const gx of [bx - 10, bx + 9]){ stem(B, [[gx, by], [gx, by - 23]], 2, C.wood[3], C.outW); for(let y = by - 20; y < by; y += 5) B.set(gx, y, C.wood[1]); }
        stem(B, [[bx - 11, by - 22], [bx + 11, by - 22]], 2, C.wood[4], C.outW);
        stem(B, [[bx, by], [bx - 2, by - 7], [bx + 2, by - 13], [bx - 1, by - 18], [bx + 3, by - 21]], 1, CL.sh, CL.out);
        for(const [x, y, a] of [[bx - 1, by - 6, -165], [bx + 1, by - 9, -15], [bx - 1, by - 14, -150 + sw], [bx + 1, by - 17, -30 - sw], [bx - 4, by - 21, -170], [bx + 5, by - 21, -10]]) sLeaf(B, x, y, 6, 3, a);
        if(ripe) for(const ox of [-5, 6]) A.stamp(B, ['..s..', '.oso.', 'oabao', 'obcbo', '.oabo', '..oco', '...o.'], { s: C.wood[2], o: '#0f3a2c', a: '#8ff0c8', b: '#2fae84', c: '#167a5c' }, bx + ox - 2, by - 20);
      }
      if(kind === 'apple' || kind === 'peach'){     // cây con: thân cong có cành + tán nhiều cụm lá; quả có điểm sáng
        const P = kind === 'peach' ? { out: '#1e3620', dk: '#2f5a30', sh: '#3f7a3e', base: '#5a9a4e', lt: '#7cb85e', hi: '#a8d47a', rim: '#f0c8d0' } : CL;
        A.stamp(B, ['.ab.', '.ab.', 'abb.', '.ab.', '.abb', '.ab.', 'aabb', 'a..b'], { a: C.wood[4], b: C.wood[2] }, bx - 2, by - 8);
        A.stamp(B, ['a...', '.a..', '..ab'], { a: C.wood[3], b: C.wood[2] }, bx - 5, by - 12); A.stamp(B, ['...a', '..a.', 'ba..'], { a: C.wood[3], b: C.wood[2] }, bx + 1, by - 12);
        A.foliage(B, [{ x: bx - 5, y: by - 15, r: 4.4, d: .2 }, { x: bx + 5, y: by - 15, r: 4.4, d: .2 }, { x: bx, y: by - 20, r: 5.2, d: .4 }, { x: bx - 3, y: by - 13, r: 3.8, d: .8 }, { x: bx + 3, y: by - 13, r: 3.8, d: .8 }, { x: bx - 1, y: by - 18, r: 3.4, d: 1 }], P, 11 + sw);
        outlineBuf(B, P.out);
        const pts = [[-5, -15], [4, -18], [1, -12], [6, -12], [-2, -20]];
        if(ripe) for(const [dx, dy] of pts) fruitStamp(B, bx + dx, by + dy, F); else for(const [dx, dy] of [[-4, -16], [3, -19], [5, -13]]) A.stamp(B, ['.w.', 'wcw', '.w.'], { w: kind === 'peach' ? '#ffc0d0' : '#ffffff', c: '#ffd84a' }, bx + dx - 1, by + dy - 1);
      }
    }
    const c = B.canvas(); cropCache.set(key, c); return c;
  }

  /* ───────── cây rìa, bụi, đá, hoa, cỏ ───────── */
  const objCache = new Map();
  const cached = (k, f) => objCache.has(k) ? objCache.get(k) : (objCache.set(k, f()), objCache.get(k));
  const A = GardenArt;
  const treeSprite = (r, seed, back) => (seed % 5 === 3 && !back) ? A.pine(Math.round(r * 2.3), seed, 0) : A.oak(r, seed, back);
  const bushSprite = (r, seed, berry) => A.bush(Math.max(4, Math.round(r * .85)), seed, berry ? { berry: ['#8a1a2a', '#d8304a', '#ff8a94'] } : (seed % 3 === 0 ? { bloom: ['#ffffff', '#ffd84a'] } : { young: seed % 2 }));
  const rockSprite = (r, seed) => A.rock(r + 1, seed, seed % 2);
  const FLOWERS = A.FLOWER_KINDS;
  const tuft = (ctx, x, y, v) => A.tuft(ctx, x, y, v);
  const flower = (ctx, x, y, k, sway) => A.flower(ctx, FLOWERS[k % FLOWERS.length], x, y, sway);

  /* ───────── bố cục hai cỡ màn hình ───────── */
  const PITCH = 26, PS = 22;
  const LAYOUTS = {
    wide: { W: 384, H: 216, cols: 10, rows: 5, x: 61, y: 68, gapCol: 4, gapRow: -1, shop: { x: 318, y: 14 }, pond: { x: 26, y: 178, rx: 22, ry: 13 } },
    tall: { W: 168, H: 368, cols: 5, rows: 10, x: 21, y: 72, gapCol: -1, gapRow: 4, shop: { x: 106, y: 14 }, pond: null }
  };
  let L = LAYOUTS.wide, layoutName = 'wide';
  const FARM = { count: 50, open: 10 };
  function plotRect(i){ const c = i % L.cols, r = Math.floor(i / L.cols); return { x: L.x + c * PITCH + (L.gapCol >= 0 && c > L.gapCol ? 6 : 0), y: L.y + r * PITCH + (L.gapRow >= 0 && r > L.gapRow ? 6 : 0), s: PS }; }
  function farmBox(){ const a = plotRect(0), b = plotRect(FARM.count - 1); return { x0: a.x - 7, y0: a.y - 8, x1: b.x + PS + 7, y1: b.y + PS + 7 }; }
  function plotAt(x, y){ for(let i = 0; i < FARM.count; i++){ const p = plotRect(i); if(x >= p.x - 2 && x < p.x + p.s + 2 && y >= p.y - 4 && y < p.y + p.s + 2) return i; } return -1; }
  const gateX = () => { const B = farmBox(); return Math.round((B.x0 + B.x1) / 2); };

  /* ───────── lớp nền ───────── */
  let bg = null, fg = null, shopRect = null, perches = [], flowerSpots = [], pondPx = [], decorFlowers = [];
  function pathPts(){
    const B = farmBox(), gx = gateX(), sh = L.shop;
    if(layoutName === 'wide') return [[[gx, B.y0 + 2], [gx, B.y0 - 10], [gx + 30, B.y0 - 18], [sh.x + 8, B.y0 - 14], [sh.x + 24, sh.y + 46]], [[gx, B.y0 - 10], [gx - 40, B.y0 - 22], [gx - 90, B.y0 - 30], [-4, B.y0 - 28]]];
    return [[[gx, B.y0 + 2], [gx, B.y0 - 10], [gx + 22, B.y0 - 18], [sh.x + 24, sh.y + 46]], [[gx, B.y0 - 10], [gx - 30, B.y0 - 20], [-4, B.y0 - 24]]];
  }
  const segD = (x, y, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], Ln = dx * dx + dy * dy, t = Ln ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / Ln)) : 0; return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy); };
  const lineD = (x, y, pts) => { let m = 1e9; for(let i = 0; i < pts.length - 1; i++) m = Math.min(m, segD(x, y, pts[i], pts[i + 1])); return m; };

  function buildBg(){
    const W = L.W, H = L.H, B = farmBox(), paths = pathPts(), P = L.pond;
    bg = mkCanvas(W, H); const ctx = bg.getContext('2d'), img = ctx.createImageData(W, H), d = img.data;
    const inPath = (x, y) => paths.some(p => lineD(x, y, p) < 5.2 + (vn(x, y, 6, 2) - .5) * 2.6);
    const inPond = (x, y) => P && ((x - P.x) / P.rx) ** 2 + ((y - P.y) / P.ry) ** 2 < 1 + (vn(x, y, 5, 3) - .5) * .3;
    // sân đất chỉ ở các hàng đã mở; phần còn lại trong rào là bãi cỏ chờ khai hoang
    const openRows = Math.ceil(FARM.open / L.cols), yEnd = plotRect(openRows * L.cols - 1).y + PS + 8;
    const inYard = (x, y) => x > B.x0 + (vn(x, y, 4, 5) - .5) * 3 && x < B.x1 + (vn(x, y, 4, 6) - .5) * 3 && y > B.y0 + (vn(x, y, 4, 7) - .5) * 3 && y < yEnd + (vn(x, y, 4, 8) - .5) * 4;
    const M = new Uint8Array(W * H);                      // 0 cỏ, 1 lối đất, 2 nước, 3 sân vườn
    for(let y = 0; y < H; y++) for(let x = 0; x < W; x++) M[y * W + x] = inPond(x, y) ? 2 : inYard(x, y) ? 3 : inPath(x, y) ? 1 : 0;
    const at = (x, y) => x < 0 || y < 0 || x >= W || y >= H ? -1 : M[y * W + x];
    const near = (x, y, t, r) => { for(let k = 1; k <= r; k++) for(let dy = -k; dy <= k; dy++) for(let dx = -k; dx <= k; dx++){ if(Math.max(Math.abs(dx), Math.abs(dy)) !== k) continue; const v = at(x + dx, y + dy); if(t === 'land' ? (v !== 2 && v !== -1) : v === t) return k; } return 0; };
    const put = (x, y, h) => { const c = hx(h), i = (y * W + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; };
    for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){
      const m = M[y * W + x], h = hash(x, y, 9);
      if(m === 2){ const e = near(x, y, 'land', 5); put(x, y, e === 1 ? C.water[5] : e === 2 ? C.water[4] : e === 3 ? C.water[3] : e === 4 ? C.water[2] : vn(x, y, 5, 4) > .5 ? C.water[1] : C.water[0]); pondPx.push([x, y, e]); continue; }
      if(m === 1 || m === 3){                                     // đất nện: viền tối 1 px, mảng sáng mòn ở giữa lối, mảng tối thưa
        const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => at(x + a, y + b) === 0), edge2 = !edge && [[2, 0], [-2, 0], [0, 2], [0, -2]].some(([a, b]) => at(x + a, y + b) === 0);
        const n = vn(x, y, 7, m), worn = m === 1 && lineD(x, y, paths[0]) < 1.8;
        put(x, y, edge ? C.dirt[0] : edge2 ? C.dirt[1] : worn || n > .68 ? C.dirt[3] : n < .28 ? C.dirt[1] : C.dirt[2]); continue; }
      // cỏ: 3 vùng sắc độ có ranh giới mềm hữu cơ (không chấm ngẫu nhiên); tối dần về mép cảnh và quanh mép nước
      const zone = vn(x, y, 30, 11) * .7 + vn(x, y, 12, 12) * .3, nw = near(x, y, 2, 2), edgeDark = Math.min(1, Math.min(y, H - y, x, W - x) / 22);
      let k = zone > .6 ? 3 : zone < .4 ? 1 : 2; if(edgeDark < .5) k--; if(edgeDark < .2) k--;
      if(nw === 1) k = -1; else if(nw === 2) k = Math.min(k, 0);
      put(x, y, k < 0 ? '#3d7a30' : C.grass[Math.max(0, Math.min(4, k))]);
    }
    ctx.putImageData(img, 0, 0);
    for(let gy = 4; gy < H; gy += 9) for(let gx = 3 + (gy % 2) * 4; gx < W; gx += 9){
      const x = Math.round(gx + (hash(gx, gy, 51) - .5) * 5), y = Math.round(gy + (hash(gx, gy, 52) - .5) * 5);
      if(at(x, y) !== 0 || at(x, y - 2) !== 0) continue;
      const z = vn(x, y, 30, 11) * .7 + vn(x, y, 12, 12) * .3, light = z > .5;
      const hi = light ? C.grass[3] : C.grass[2], lo = light ? C.grass[1] : C.grass[0]; R(ctx, hi, x, y - 1); R(ctx, lo, x, y); if(hash(x, y, 53) > .5){ R(ctx, hi, x + 2, y - 1); R(ctx, lo, x + 1, y); }
    }
    for(let i = 0; i < 400; i++){ const x = Math.floor(hash(i, 1, 61) * W), y = Math.floor(hash(i, 2, 61) * H); if(at(x, y) === 1 && at(x + 2, y) === 1 && at(x, y + 1) === 1 && hash(i, 3, 61) > .55){ R(ctx, C.dirt[4], x, y); R(ctx, C.dirt[1], x + 1, y); R(ctx, C.dirt[0], x, y + 1); R(ctx, C.dirt[0], x + 1, y + 1); } }

    // đá viền ao, lá súng, cói
    const objs = [];
    if(P){ for(let i = 0; i < 9; i++){ const a = i / 9 * Math.PI * 2 + .3, x = Math.round(P.x + Math.cos(a) * (P.rx + 2)), y = Math.round(P.y + Math.sin(a) * (P.ry + 2)); if(y < P.y + 2 || i % 2) objs.push({ foot: y, draw(c){ const s = rockSprite(2 + (i % 2), i); c.drawImage(s, x - s.width / 2, y - s.height + 2); } }); }
      for(const [dx, dy, f] of [[-8, -2, 1], [6, 3, 0], [10, -4, 0]]){ const x = P.x + dx, y = P.y + dy; R(ctx, C.out, x - 4, y - 1, 8, 4); R(ctx, '#3f8f3a', x - 3, y - 1, 6, 3); R(ctx, '#62b04c', x - 3, y - 1, 3, 1); R(ctx, C.water[1], x, y, 2, 1); if(f){ R(ctx, '#ff9cc0', x - 1, y - 3, 3, 2); R(ctx, '#ffd0de', x - 1, y - 3); R(ctx, '#ffd84a', x, y - 2); } }
      for(const [dx, dy] of [[P.rx - 4, -P.ry + 3], [-P.rx + 2, -3]]){ const x = P.x + dx, y = P.y + dy; objs.push({ foot: y, draw(c){ for(let i = 0; i < 4; i++){ const hh = 7 + (i % 2) * 3, X = x + i * 2; R(c, C.leaf[0], X, y - hh, 1, hh); R(c, C.leaf[2], X, y - hh, 1, 2); if(i % 2) R(c, '#7a4c2c', X, y - hh - 2, 1, 3); } } }); }
    }
    // sân vườn: viền gỗ thấp (khung luống) quanh toàn bộ sân
    // hàng rào gỗ có cổng
    objs.push({ foot: B.y0 - 1, draw(c){ fenceRun(c, B, 'top'); } }, { foot: B.y1 + 2, draw(c){ fenceRun(c, B, 'bottom'); } }, { foot: B.y1, draw(c){ fenceRun(c, B, 'sides'); } });
    // cây rìa hậu cảnh (hàng trên, hơi lạnh màu) và vài cây/bụi hai bên
    const deco = layoutName === 'wide' ? {
      far: [[0, 10, 14], [30, 6, 13], [60, 9, 14], [92, 5, 12], [124, 10, 14], [156, 6, 13], [190, 9, 14], [222, 5, 12], [254, 10, 13], [286, 6, 12], [318, 4, 12], [352, 8, 13], [384, 10, 13]],
      back: [[10, 30, 13], [40, 22, 11], [70, 30, 12], [104, 20, 10], [138, 26, 12], [172, 18, 10], [206, 26, 11], [240, 20, 12], [276, 30, 10], [372, 34, 12]],
      side: [[22, 92, 12, 't'], [30, 132, 6, 'b'], [356, 104, 12, 't'], [364, 150, 7, 'b'], [356, 196, 11, 't'], [88, 212, 6, 'b'], [300, 214, 6, 'b'], [306, 40, 5, 'b']]
    } : {
      far: [[0, 8, 12], [28, 4, 11], [58, 8, 12], [88, 4, 11], [118, 2, 10], [150, 6, 11], [170, 10, 12]],
      back: [[8, 28, 11], [36, 20, 10], [66, 28, 11], [96, 18, 9], [158, 34, 9]],
      side: [[8, 120, 6, 'b'], [162, 150, 6, 'b'], [10, 250, 6, 'b'], [160, 300, 6, 'b']]
    };
    for(const [x, y, r] of deco.far) objs.push({ foot: y - 40, draw(c){ const s = treeSprite(r, x * 5 + y + 99, 1); c.drawImage(s, Math.round(x - s.width / 2), y - s.height + 3); c.fillStyle = 'rgba(20,50,40,.22)'; c.fillRect(Math.round(x - s.width / 2), 0, s.width, Math.max(0, y + 3)); } });
    for(const [x, y, r] of deco.back) objs.push({ foot: y, draw(c){ const s = treeSprite(r, x * 3 + y, 1); shadow(c, x + 3, y, r * .8, 3, .25); c.drawImage(s, Math.round(x - s.width / 2), y - s.height + 3); } });
    for(const [x, y, r, k] of deco.side) objs.push({ foot: y, draw(c){ if(k === 't'){ const s = treeSprite(r, x + y * 7, 0); shadow(c, x + 3, y, r * .85, 3, .28); c.drawImage(s, Math.round(x - s.width / 2), y - s.height + 3); } else { const s = bushSprite(r, x * 5 + y, hash(x, y, 3) > .5 ? ['#d8304a', '#ff6a7a'] : null); shadow(c, x + 2, y, r + 1, 2, .25); c.drawImage(s, Math.round(x - s.width / 2), y - s.height + 2); } } });
    // đá nhỏ, hoa dại theo cụm (chỉ ở rìa, ven lối đi)
    const freeSpot = (x, y, pad) => at(x, y) === 0 && !(x > B.x0 - pad && x < B.x1 + pad && y > B.y0 - pad - 6 && y < B.y1 + pad) && !(x > L.shop.x - 8 && x < L.shop.x + 48 && y > L.shop.y - 10 && y < L.shop.y + 40) && y > 34;
    const rocks = layoutName === 'wide' ? [[52, 54], [338, 186]] : [[12, 200]];
    for(const [x, y] of rocks) objs.push({ foot: y, draw(c){ const s = rockSprite(3, x + y); shadow(c, x + 1, y, 4, 1.5, .25); c.drawImage(s, x - s.width / 2, y - s.height + 2); } });
    decorFlowers = [];
    const clusters = layoutName === 'wide' ? [[44, 62], [300, 70], [54, 160]] : [[12, 56], [156, 104]];   // góc rào, cạnh quầy, bờ ao
    for(const [cx, cy] of clusters){ const k = Math.floor(hash(cx, cy, 1) * FLOWERS.length); for(let j = 0; j < 5; j++){ const x = Math.round(cx + (hash(cx, j, 2) - .5) * 16), y = Math.round(cy + (hash(cy, j, 3) - .5) * 9); if(freeSpot(x, y, 4)) decorFlowers.push([x, y, k, hash(x, y, 5) * 6]); } }
    flowerSpots = decorFlowers.slice(0, 6).map(f => [f[0], f[1] - 5]);
    for(let i = 0; i < (layoutName === 'wide' ? 45 : 30); i++){ const x = Math.floor(hash(i, 1, 13) * W), y = Math.floor(hash(i, 2, 13) * H); if(freeSpot(x, y, 2)) tuft(ctx, x, y, i % 3); }
    // quầy hàng
    const st = stallObj(L.shop.x, L.shop.y); objs.push(st); shopRect = st.rect;
    objs.sort((a, b) => a.foot - b.foot); for(const o of objs) o.draw(ctx);
    // bóng râm dưới tán cây hậu cảnh + viền tối nhẹ (vignette) tạo chiều sâu
    ctx.fillStyle = 'rgba(16,40,20,.16)'; ctx.fillRect(0, 0, W, 3); ctx.fillRect(0, 0, 3, H); ctx.fillRect(W - 3, 0, 3, H); ctx.fillRect(0, H - 3, W, 3);
    ctx.fillStyle = 'rgba(16,40,20,.08)'; ctx.fillRect(0, 3, W, 4); ctx.fillRect(3, 0, 4, H); ctx.fillRect(W - 7, 0, 4, H);
    // chỗ đậu cho chim trang trí (đầu cột rào)
    perches = []; const top = B.y0 - 4; for(let x = B.x0 - 4; x < gateX() - 14; x += 26) perches.push([x + 1, top - 6]); for(let x = gateX() + 18; x < B.x1; x += 26) perches.push([x + 1, top - 6]);
  }
  function fenceRun(ctx, B, part){
    const x0 = B.x0 - 4, y0 = B.y0 - 4, x1 = B.x1 + 3, y1 = B.y1 + 3, gx = gateX(), gate = [gx - 9, gx + 9];
    // cột rào: cao thấp lệch 1 px, đỉnh vát, vân gỗ + mấu, đinh; bóng đổ xuống phải
    const post = (x, y, tall) => { const h = (tall ? 11 : 8) + (hash(x, y, 71) > .6 ? 1 : 0), cut = hash(x, y, 72) > .5; shadow(ctx, x + 3, y + 1, 3, 1, .3);
      R(ctx, C.outW, x - 1, y - h, 5, h + 1); R(ctx, C.wood[3], x, y - h + 1, 3, h - 1); R(ctx, C.wood[4], x, y - h + 1, 1, h - 1); R(ctx, C.wood[1], x + 2, y - h + 1, 1, h - 1);
      R(ctx, C.wood[5], x + (cut ? 0 : 1), y - h + 1, 2, 1); if(cut) R(ctx, C.outW, x + 2, y - h, 1, 1); else R(ctx, C.outW, x, y - h, 1, 1);
      if(hash(x, y, 73) > .5) R(ctx, C.wood[1], x + 1, y - h + 4, 1, 1); R(ctx, '#3a3f46', x + 1, y - h + 3, 1, 1); };
    const railH = (a, b, y) => { R(ctx, 'rgba(24,52,24,.25)', a, y + 1, b - a, 2); R(ctx, C.outW, a, y - 6, b - a, 4); R(ctx, C.wood[4], a, y - 5, b - a, 1); R(ctx, C.wood[2], a, y - 4, b - a, 1); for(let x = a + 2; x < b - 2; x += 5 + Math.floor(hash(x, y, 74) * 6)) R(ctx, hash(x, y, 75) > .5 ? C.wood[1] : C.wood[3], x, y - 4 - (hash(x, y, 76) > .7 ? 1 : 0), 2, 1); };
    const railV = (x, a, b) => { R(ctx, C.outW, x - 1, a, 5, b - a); R(ctx, C.wood[3], x, a, 1, b - a); R(ctx, C.wood[2], x + 1, a, 2, b - a); };
    if(part === 'top'){ for(const [a, b] of [[x0, gate[0]], [gate[1], x1]]){ railH(a, b, y0); for(let x = a; x <= b - 3; x += 13) post(x, y0); } post(gate[0] - 2, y0, 1); post(gate[1], y0, 1); }
    if(part === 'sides'){ railV(x0 + 1, y0, y1); railV(x1 - 4, y0, y1); for(let y = y0 + 13; y < y1; y += 13){ post(x0, y); post(x1 - 4, y); } }
    if(part === 'bottom'){ railH(x0, x1, y1); for(let x = x0; x <= x1 - 3; x += 13) post(x, y1); }
  }
  function stallObj(x, y){
    const w = 44, h = 34;
    return { foot: y + h, rect: { x0: x - 8, y0: y - 14, x1: x + 54, y1: y + 46 }, draw(ctx){ shadow(ctx, x + 25, y + 45, 30, 3, .28); ctx.drawImage(A.shop(['radish', 'gourd', 'berry', 'apple'].map(k => FRUIT[k])), x - 8, y - 14); } };
  }
  const stallSprite = () => cached('stall', () => {
    const W = 58, H = 50, B = new Buf(W, H), x = 6, y = 12, w = 44, h = 34;
    // cột + quầy gỗ
    for(const px of [x + 3, x + w - 5]) stem(B, [[px, y + 8], [px, y + h - 1]], 2, C.wood[2], C.outW);
    B.shape(x, y + h - 13, x + w, y + h, (px, py) => px >= x && px < x + w && py >= y + h - 12 && py < y + h, (px, py) => { const yy = py - (y + h - 12); return yy < 2 ? C.wood[5] : yy < 3 ? C.wood[4] : Math.floor(px) % 9 === 0 ? C.wood[1] : yy > 10 ? C.wood[1] : (Math.floor(px * 3 + yy) % 13 === 0 ? C.wood[2] : C.wood[3]); }, C.outW);
    // hàng trên quầy: giỏ nông sản dùng đúng màu quả trong vườn
    const fr = ['radish', 'gourd', 'berry', 'grape', 'apple'];
    fr.forEach((k, i) => { const cx = x + 6 + i * 8; B.shape(cx - 3, y + h - 16, cx + 3, y + h - 12, (px, py) => py >= y + h - 15 && py < y + h - 12 && px >= cx - 3 && px < cx + 4, (px, py) => py < y + h - 14 ? C.wood[4] : C.wood[2], C.outW); orb(B, cx - 1, y + h - 16, 1.8, 1.6, FRUIT[k]); orb(B, cx + 1.5, y + h - 16.5, 1.8, 1.6, FRUIT[k]); });
    // mái vải sọc có diềm vỏ sò, nếp gấp sáng tối
    B.shape(x - 4, y - 2, x + w + 4, y + 11, (px, py) => { if(px < x - 3 || px > x + w + 3 || py < y - 1) return false; if(py < y + 8) return true; const k = (px - (x - 3)) % 6; return py < y + 8 + Math.sin(k / 6 * Math.PI) * 3; },
      (px, py) => { const band = Math.floor((px - (x - 3)) / 6) % 2 === 0, k = (px - (x - 3)) % 6, red = band; let c = red ? (k < 1.5 ? '#ff7a5e' : k > 4.5 ? '#b8382a' : '#e0503a') : (k < 1.5 ? '#ffffff' : k > 4.5 ? '#e2cfa8' : '#fff1d6'); if(py < y + 1) c = red ? '#ff8c70' : '#ffffff'; if(py > y + 8) c = red ? '#c0402e' : '#ead8b0'; return c; }, C.outW);
    // biển hiệu treo có hình bông hoa
    B.shape(x + w / 2 - 7, y - 11, x + w / 2 + 7, y - 2, (px, py) => px >= x + w / 2 - 6 && px < x + w / 2 + 6 && py >= y - 10 && py < y - 3, (px, py) => py < y - 9 ? C.wood[5] : '#f1e2b8', C.outW);
    orb(B, x + w / 2, y - 6.5, 2, 2, ['#e05a7a', '#ff8fb0', '#ffd0de', '#ffffff']); B.set(x + w / 2, y - 7, '#ffd84a');
    // đèn lồng nhỏ treo góc mái + chậu cây
    stem(B, [[x + w + 1, y + 10], [x + w + 1, y + 13]], 1, '#3a3f46'); orb(B, x + w + 1, y + 16, 2, 2.4, ['#d88a20', '#ffc84a', '#fff0a0', '#ffffff']);
    B.shape(x - 5, y + h - 6, x + 1, y + h, (px, py) => px >= x - 5 && px < x && py >= y + h - 5 && py < y + h, (px, py) => py < y + h - 4 ? '#e08a5a' : '#b8603a', C.outW);
    leaf(B, x - 3, y + h - 6, 5, 2, -120, LV); leaf(B, x - 3, y + h - 6, 5, 2, -60, LV);
    return B.canvas();
  });

  /* ───────── lớp tiền cảnh: bụi cỏ cao + lá ở mép dưới ───────── */
  function buildFg(){
    const W = L.W, H = L.H; fg = mkCanvas(W, H); const ctx = fg.getContext('2d');
    for(let x = -6; x < W + 6; x += 9){ const r = 6 + Math.floor(hash(x, 1, 17) * 4), s = bushSprite(r, x * 11, hash(x, 2, 17) > .75 ? ['#ffffff', '#ffe08a'] : null); if(hash(x, 3, 17) > .35) ctx.drawImage(s, Math.round(x - s.width / 2), H - s.height + Math.round(r * .55)); }
    for(let x = 2; x < W; x += 4) tuft(ctx, x, H - 1 - Math.floor(hash(x, 4, 17) * 2), x % 3);
  }

  function init(name){
    layoutName = name in LAYOUTS ? name : 'wide'; L = LAYOUTS[layoutName]; pondPx = [];
    buildBg(); buildFg(); return bg;
  }

  /* ───────── ô đất ───────── */
  const soilCache = new Map();
  function soilSprite(wet, seedTier, dmg){
    const k = (wet ? 'w' : 'd') + (seedTier || '') + (dmg ? 'x' : ''); if(soilCache.has(k)) return soilCache.get(k);
    const S = wet ? C.soilW : C.soil, W = PS + 2, H = PS + 5, B = new Buf(W, H);
    // luống đất nổi: mặt trên (luống cày) + mặt trước dày 2 px + bo góc
    const inBed = (px, py) => { const x = px - 1, y = py - 1; if(x < 0 || y < 0 || x >= PS || y >= PS + 2) return false; const cx = Math.min(x, PS - 1 - x), cy = Math.min(y, PS + 1 - y); return !(cx < 1.2 && cy < 1.2) && !(cx + cy < 2.2); };
    B.shape(0, 0, W - 1, H - 1, inBed, (px, py) => {
      const x = Math.floor(px) - 1, y = Math.floor(py) - 1, h = hash(x, y, wet ? 3 : 2);
      if(y >= PS) return y === PS ? S[1] : S[0];                    // mặt trước luống
      if(y === 0) return S[5]; if(x === 0) return S[4]; if(x === PS - 1) return S[1]; if(y === PS - 1) return S[1];
      const r = (y - 2) % 5;                                       // 4 rãnh cày: gờ sáng, sườn, rãnh tối
      let c = r === 0 ? S[4] : r === 1 ? S[3] : r === 2 ? S[2] : r === 3 ? S[1] : S[2];
      if(h > .93) c = S[5]; else if(h < .05) c = S[0];
      return c;
    }, C.outW);
    // cục đất, sỏi nhỏ
    for(let i = 0; i < 4; i++){ const x = 3 + Math.floor(hash(i, 7, 5) * (PS - 5)), y = 3 + Math.floor(hash(i, 8, 5) * (PS - 6)); B.set(x, y, S[5]); B.set(x + 1, y, S[3]); }
    B.set(5, 15, C.stone[3]); B.set(6, 15, C.stone[1]); B.set(17, 6, C.stone[3]);
    if(wet) for(const [x, y] of [[5, 6], [16, 12], [10, 17]]){ B.set(x, y, '#9fdcff'); B.set(x + 1, y, '#d6f3ff'); }
    if(seedTier){                                                    // vừa gieo: 3 hốc có hạt trên gờ giữa
      for(const x of [6, 12, 18]){ B.set(x - 1, 12, S[0]); B.set(x, 12, S[0]); B.set(x + 1, 12, S[0]); B.set(x - 1, 11, S[5]); B.set(x + 1, 11, S[5]); if(!(dmg && x === 12)) { B.set(x, 11, SEEDC[seedTier]); B.set(x, 12, '#2a1d14'); } }
      if(dmg) for(const [x, y] of [[4, 6], [19, 17], [15, 5]]) B.set(x, y, SEEDC[seedTier]);
    }
    const c = B.canvas(); soilCache.set(k, c); return c;
  }
  // ô chưa mở: một khoảnh cỏ dại um tùm riêng từng ô (bụi nhỏ, dương xỉ, cỏ cao, hoa, nấm, đá) — chờ khai hoang
  const fernSprite = seed => A.fern(seed), mushSprite = seed => A.mushrooms(seed);
  function wildCell(ctx, x, y, s, i){
    const pick = Math.floor(hash(i, 0, 40) * 4), f = (k, a) => Math.floor(hash(i, k, a) * 1000);
    if(pick === 0){ const sp = bushSprite(4 + (i % 2), i * 7, hash(i, 9, 40) > .5 ? ['#ffffff', '#ffe08a'] : null); ctx.drawImage(sp, x + 11 - sp.width / 2, y + s - sp.height - 1); }
    if(pick === 1){ const sp = fernSprite(i); ctx.drawImage(sp, x + 3, y + 7); }
    if(pick === 2){ const sp = mushSprite(i); ctx.drawImage(sp, x + 4 + (f(1, 41) % 6), y + 9); }
    for(let k = 0; k < 6; k++){ const px = x + 2 + f(k, 42) % (s - 4), py = y + 5 + f(k, 43) % (s - 6); tuft(ctx, px, py, (i + k) % 3); }
    if(pick === 3 || hash(i, 1, 44) > .6){ const k = f(2, 44) % FLOWERS.length; for(let j = 0; j < 3; j++) flower(ctx, x + 5 + f(j, 45) % (s - 9), y + 9 + f(j, 46) % (s - 11), k, 0); }
    if(hash(i, 5, 47) > .8){ const sp = rockSprite(2, i); ctx.drawImage(sp, x + 13, y + 13); }
  }
  function drawPlot(ctx, i, pl, t, opt){
    const { x, y, s } = plotRect(i);
    if(pl.s === 'locked'){ ctx.drawImage(A.lockedCell(s), x, y); return; }      // một mẫu thống nhất, trầm màu
    ctx.fillStyle = 'rgba(40,24,10,.22)'; ctx.fillRect(x + 2, y + s + 3, s - 2, 1); ctx.fillStyle = 'rgba(40,24,10,.12)'; ctx.fillRect(x + 3, y + s + 4, s - 3, 1);   // bóng nhẹ dưới luống
    ctx.drawImage(A.mound(PS, i * 7 + 3, !!pl.wet), x - 1, y - 1);
    if(pl.s === 'planted'){                        // vừa gieo: 3 hốc đất có hạt trên gờ giữa
      const S = pl.wet ? A.PAL.soilW : A.PAL.soil, sc = SEEDC[pl.tier] || '#d8b48a';
      for(const dx of [5, 11, 17]){ R(ctx, S.rim, x + dx - 2, y + 10, 1, 1); R(ctx, S.rim, x + dx + 1, y + 10, 1, 1); R(ctx, S.dk, x + dx - 1, y + 11, 3, 1); R(ctx, S.sh, x + dx - 1, y + 10, 3, 1);
        if(!(pl.dmg && dx === 11)){ R(ctx, sc, x + dx, y + 10); R(ctx, '#2a1d14', x + dx, y + 11); } }
      if(pl.dmg) for(const [px, py] of [[4, 6], [18, 16], [14, 5]]) R(ctx, sc, x + px, y + py);
    }
    if(pl.s === 'sprout' || pl.s === 'grow' || pl.s === 'ripe'){
      const kind = CROPK[pl.tier] || 'radish', st = pl.s === 'sprout' ? 'sprout' : pl.s === 'grow' ? 'grow' : 'ripe';
      const fr = Math.floor(t / 700 + i * .37) % 2, c = cropSprite(kind, st, fr);
      ctx.drawImage(c, x + 11 - 14, y + s - 29 + (st === 'sprout' ? -3 : -2));
      if(pl.dmg) chewMarks(ctx, x, y, s, st);
      if(st === 'ripe' && Math.floor(t / 420 + i) % 5 === 0){ const sx = x + s - 3, sy = y - 6; R(ctx, '#ffffff', sx, sy); R(ctx, '#fff7b0', sx - 1, sy); R(ctx, '#fff7b0', sx + 1, sy); R(ctx, '#fff7b0', sx, sy - 1); R(ctx, '#fff7b0', sx, sy + 1); }
    }
    if(opt && opt.sel){ const k = '#fff3a0'; for(const [a, b, sx, sy] of [[x - 3, y - 3, 1, 1], [x + s + 2, y - 3, -1, 1], [x - 3, y + s + 4, 1, -1], [x + s + 2, y + s + 4, -1, -1]]){ R(ctx, k, a, b); R(ctx, k, a + sx, b); R(ctx, k, a + sx * 2, b); R(ctx, k, a, b + sy); R(ctx, k, a, b + sy * 2); } }
  }
  function chewMarks(ctx, x, y, s, st){              // vết gặm: lỗ trên lá + vụn lá rơi xuống luống
    const cx = x + 11, by = y + s;
    if(st === 'sprout'){ R(ctx, C.leaf[3], cx + 6, by - 3); R(ctx, C.leaf[2], cx - 7, by - 2); return; }
    for(const [dx, dy] of [[-6, -10], [5, -13], [-2, -17]]){ R(ctx, C.out, cx + dx, by + dy, 2, 1); R(ctx, '#c8a050', cx + dx, by + dy - 1); }
    R(ctx, C.leaf[2], cx - 9, by - 2); R(ctx, C.leaf[3], cx + 8, by - 1); R(ctx, C.leaf[2], cx + 4, by - 2, 2, 1);
  }

  /* ───────── sinh vật ───────── */
  function tpl(ctx, rows, pal, x, y, dir, ax){ const h = rows.length, w = rows[0].length;
    for(let j = 0; j < h; j++) for(let i = 0; i < w; i++){ const ch = rows[j][i]; if(ch === '.') continue; R(ctx, pal[ch], dir > 0 ? x - ax + i : x + ax - i, y - h + j); } }
  const bird = (ctx, x, y, dir, peck, flap) => { shadow(ctx, x, y + 1, 5, 1, .3); A.robin(ctx, peck ? 'peck' : flap ? 'flap' : 'stand', x, y + 1, dir); };
  const hopper = (ctx, x, y, dir, leg) => { if(!leg) shadow(ctx, x, y + 1, 5, 1, .22); A.locust(ctx, leg ? 'jump' : 'sit', x, y, dir); };
  function drawPest(ctx, i, kind, t){
    const { x, y, s } = plotRect(i), ph = hash(i, kind === 'bird' ? 1 : 2, 31) * 5000;
    if(kind === 'bird'){                    // mổ hạt → nhảy sang bên → vỗ cánh
      const k = (t + ph) % 3600, side = Math.floor((t + ph) / 3600) % 2 ? -1 : 1;
      const hop = k > 2600 && k < 2900 ? Math.round(Math.sin((k - 2600) / 300 * Math.PI) * 3) : 0;
      bird(ctx, x + 11 + side * (k > 2750 ? 4 : -2), y + s - 4 - hop, side, k < 2400 && Math.floor(k / 260) % 2 === 1, k > 2900 && k < 3300 && Math.floor(k / 80) % 2);
    } else {                                // đậu trên lá → bật nhảy sang lối đi cạnh luống → nhảy về
      const k = (t + ph) % 5200, out = Math.floor((t + ph) / 5200) % 2 === 1, home = [x + 14, y + s - 14], away = [x + s + 3, y + s + 2];
      const [a, b] = out ? [home, away] : [away, home];
      let px = a[0], py = a[1], leg = 0, dir = b[0] > a[0] ? 1 : -1;
      if(k > 4500){ const p = (k - 4500) / 700; px = a[0] + (b[0] - a[0]) * p; py = a[1] + (b[1] - a[1]) * p - Math.sin(p * Math.PI) * 10; leg = 1; }
      else { px = b[0]; py = b[1]; dir = -dir; }
      hopper(ctx, Math.round(px), Math.round(py), dir, leg, Math.floor((t + ph) / 320) % 2);
    }
  }

  /* ───────── hoạt ảnh môi trường ───────── */
  function animate(ctx, t){
    // nước: gợn sáng chạy chậm + vòng sóng thỉnh thoảng
    for(const [x, y, e] of pondPx){ if(e < 3) continue; const k = (x * 3 + y * 7 + Math.floor(t / 220)) % 41; if(k === 0) R(ctx, C.water[4], x, y, 2, 1); else if(k === 1) R(ctx, C.water[3], x, y); }
    const P = L.pond; if(P){ const p = (t % 3000) / 3000, r = 1 + p * 6; ctx.globalAlpha = 1 - p; for(let a = 0; a < 6.28; a += .5) R(ctx, C.water[4], P.x + 4 + Math.cos(a) * r, P.y + 2 + Math.sin(a) * r * .5); ctx.globalAlpha = 1; }
    // hoa dại đung đưa
    for(const [x, y, k, ph] of decorFlowers) flower(ctx, x, y, k, Math.floor(t / 800 + ph) % 2);
    // hai chú bướm + một chú ong quanh cụm hoa
    flowerSpots.slice(0, 3).forEach(([fx, fy], j) => { const a = t / (1400 + j * 300) + j * 2, bx = Math.round(fx + Math.cos(a) * 9), by = Math.round(fy - 4 + Math.sin(a * 1.7) * 4), fl = Math.floor(t / 130 + j) % 2;
      if(j < 2){ const col = j ? '#ffd84a' : '#ffffff', dk = j ? '#e0902a' : '#c9d1dc'; R(ctx, C.out, bx, by - 1, 1, 3); R(ctx, col, bx - (fl ? 2 : 1), by - 1, fl ? 2 : 1, 2); R(ctx, col, bx + 1, by - 1, fl ? 2 : 1, 2); R(ctx, dk, bx - (fl ? 2 : 1), by + 1); R(ctx, dk, bx + (fl ? 2 : 1), by + 1); }
      else { R(ctx, C.out, bx - 1, by - 1, 4, 3); R(ctx, '#ffd84a', bx, by, 2, 1); R(ctx, '#2a1d14', bx + 1, by); R(ctx, '#e8f6ff', bx, by - 2 + fl, 2, 1); } });
    // chim trang trí đậu trên đầu cột rào, thỉnh thoảng bay sang cột khác
    if(perches.length > 1){ const cyc = 7000, n = Math.floor(t / cyc), k = t % cyc, a = perches[(n * 3) % perches.length], b = perches[(n * 3 + 2) % perches.length];
      if(k < 5800){ bird(ctx, a[0], a[1], b[0] > a[0] ? 1 : -1, false, k > 5200 && Math.floor(k / 90) % 2); }
      else { const p = (k - 5800) / 1200, x = a[0] + (b[0] - a[0]) * p, y = a[1] + (b[1] - a[1]) * p - Math.sin(p * Math.PI) * 18; A.robin(ctx, Math.floor(k / 110) % 2 ? 'fly' : 'flap', x, y, b[0] > a[0] ? 1 : -1); } }
  }
  function drawFront(ctx){ if(fg) ctx.drawImage(fg, 0, 0); }
  const hotAt = (x, y) => shopRect && x >= shopRect.x0 && x <= shopRect.x1 && y >= shopRect.y0 && y <= shopRect.y1 ? 'shop' : null;
  return { init, drawPlot, drawPest, drawFront, plotAt, plotRect, animate, hotAt, FARM, cropSprite, CROPK, get base(){ return bg; }, get W(){ return L.W; }, get H(){ return L.H; }, get layout(){ return layoutName; } };
})();
