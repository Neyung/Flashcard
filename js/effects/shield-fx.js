/* ═══ Hiệu ứng khiên & thiên sứ (canvas phủ màn hình, gói gọn quanh thanh streak) ═══ */
const fxReduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const fxEase = k => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);
function fxRun(dur, draw, done){
  const { cv, ctx, W, H } = fxCanvas(), t0 = performance.now();
  (function frame(nw){
    const e = nw - t0;
    ctx.clearRect(0, 0, W, H);
    if(e >= dur){ cv.remove(); if(done) done(); return; }
    ctx.save(); draw(ctx, e); ctx.restore();
    requestAnimationFrame(frame);
  })(t0);
}
function fxGlow(ctx, x, y, R, c, a){
  if(R <= 0 || a <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, R);
  g.addColorStop(0, `rgba(${c},${a})`); g.addColorStop(1, `rgba(${c},0)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, 7); ctx.fill();
}
function fxRR(ctx, x, y, w, h, r){
  r = Math.min(r, h / 2, w / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function fxBox(chip, pad){
  const r = chip.getBoundingClientRect();
  return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, x: r.left - pad, y: r.top - pad, w: r.width + pad * 2, h: r.height + pad * 2 };
}
function fxShards(B, n, sp, big){
  return Array.from({ length: n }, (_, i) => {
    const a = i / n * Math.PI * 2 + Math.random() * .25, v = sp * (.6 + Math.random() * .8), z = (big ? 6 : 4) + Math.random() * (big ? 8 : 6);
    return { x: B.cx + Math.cos(a) * B.w / 2, y: B.cy + Math.sin(a) * B.h / 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v * .7 - .8,
             r: Math.random() * 6, vr: (Math.random() - .5) * .3, p: [[0, -z], [z * .8, z * .6], [-z * .7, z * .5]] };
  });
}
function fxShardsDraw(ctx, list, k, fill, stroke){
  list.forEach(q => {
    q.vy += .12; q.x += q.vx; q.y += q.vy; q.r += q.vr;
    ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.r); ctx.globalAlpha = Math.max(0, k);
    ctx.beginPath(); q.p.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = 1.2; ctx.stroke(); ctx.restore();
  });
}
function fxSparks(ctx, list, c){
  ctx.globalCompositeOperation = 'lighter';
  for(let i = list.length - 1; i >= 0; i--){
    const p = list[i]; p.l++; if(p.l > p.m){ list.splice(i, 1); continue; }
    p.x += p.vx; p.y += p.vy; p.vy += p.g || 0;
    fxGlow(ctx, p.x, p.y, p.r || 4, p.c || c, 1 - p.l / p.m);
  }
  ctx.globalCompositeOperation = 'source-over';
}
/* Lần đầu nhận khiên — "Bình minh": thanh streak chìm trong đêm sao, một vầng dương nhô lên sau thanh, dải sáng
   vàng quét qua xua tan bóng đêm, huy hiệu khiên sáng rực hạ xuống rồi tan thành lớp khiên kính bao quanh thanh,
   hào quang + sao 4 cánh lấp lánh. Gói gọn quanh thanh streak. */
function fxShieldDawn(chip, done){
  if(fxReduced()) return done && done();
  let B = fxBox(chip, 7), cb = done;
  const fire = () => { if(cb){ const f = cb; cb = null; f(); } };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const stars = [...Array(14)].map(() => [rnd(.06, .94), rnd(.15, .85), rnd(.7, 1.5), rnd(0, 6)]);
  const twinkles = [...Array(6)].map((_, i) => [i / 6 * Math.PI * 2 + rnd(-.25, .25), rnd(3, 8), rnd(4, 6.5), rnd(0, 200)]);
  const sparks = [], S0 = 260, S1 = 760, CREST = 760, RING = 1050;
  const star4 = (ctx, x, y, R, a) => { ctx.fillStyle = `rgba(255,236,160,${a})`; ctx.beginPath();
    for(let i = 0; i < 8; i++){ const r2 = i % 2 ? R * .25 : R, an = i * Math.PI / 4 - Math.PI / 2; ctx.lineTo(x + Math.cos(an) * r2, y + Math.sin(an) * r2); }
    ctx.closePath(); ctx.fill(); };
  const shieldPath = (ctx, x, y, z) => { ctx.beginPath(); ctx.moveTo(x, y - z); ctx.lineTo(x + z * .85, y - z * .62); ctx.lineTo(x + z * .85, y + z * .05);
    ctx.quadraticCurveTo(x + z * .8, y + z * .78, x, y + z * 1.1); ctx.quadraticCurveTo(x - z * .8, y + z * .78, x - z * .85, y + z * .05);
    ctx.lineTo(x - z * .85, y - z * .62); ctx.closePath(); };
  fxRun(2000, (ctx, e) => {
    B = fxBox(chip, 7);
    const { cx, cy, x: x0, y: y0, w: cw, h: ch } = B;
    const night = fxEase(e / 220), sx = x0 - 24 + (cw + 48) * fxEase((e - S0) / (S1 - S0));
    // vầng dương nhô lên phía sau thanh
    const sun = fxEase((e - S0) / 500) * (1 - fxEase((e - 1450) / 500));
    if(sun > 0){ ctx.globalCompositeOperation = 'lighter';
      fxGlow(ctx, cx, cy + ch * .7 - 10 * sun, cw * .36, '255,200,90', .4 * sun);
      fxGlow(ctx, cx, cy + ch * .7 - 10 * sun, cw * .2, '255,240,190', .45 * sun);
      ctx.globalCompositeOperation = 'source-over'; }
    // màn đêm trên thanh — phần đã bị dải sáng quét qua thì tan biến
    ctx.save(); fxRR(ctx, x0, y0, cw, ch, ch / 2); ctx.clip();
    if(e < S1 + 60){
      ctx.save(); ctx.beginPath(); ctx.rect(e < S0 ? x0 - 30 : sx, y0 - 5, cw + 60, ch + 10); ctx.clip();
      const g = ctx.createLinearGradient(0, y0, 0, y0 + ch);
      g.addColorStop(0, `rgba(10,14,48,${.95 * night})`); g.addColorStop(1, `rgba(30,20,72,${.95 * night})`);
      ctx.fillStyle = g; ctx.fillRect(x0, y0, cw, ch);
      stars.forEach(([fx, fy, r2, ph]) => { ctx.fillStyle = `rgba(255,255,235,${night * (.55 + .45 * Math.sin(e / 110 + ph))})`;
        ctx.beginPath(); ctx.arc(x0 + cw * fx, y0 + ch * fy, r2, 0, 7); ctx.fill(); });
      ctx.restore();
    }
    if(e > S0 && e < S1 + 80){
      const g = ctx.createLinearGradient(sx - 46, 0, sx + 14, 0);
      g.addColorStop(0, 'rgba(255,200,60,0)'); g.addColorStop(.55, 'rgba(255,214,90,.9)'); g.addColorStop(.85, 'rgba(255,255,235,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(sx - 52, y0 + ch); ctx.lineTo(sx - 30, y0); ctx.lineTo(sx + 18, y0); ctx.lineTo(sx - 4, y0 + ch); ctx.closePath(); ctx.fill();
      for(let i = 0; i < 1; i++) sparks.push({ x: sx + (Math.random() - .5) * 14, y: y0 + Math.random() * ch, vx: (Math.random() - 1.2) * 1.4, vy: -.4 - Math.random() * 1.6, g: .03, l: 0, m: 28, r: 3.5 });
    }
    ctx.restore();
    if(e > S0 && e < S1 + 80){ ctx.globalCompositeOperation = 'lighter'; fxGlow(ctx, sx - 8, cy, 22, '255,210,90', .45); ctx.globalCompositeOperation = 'source-over'; }
    // huy hiệu khiên sáng rực hạ xuống, tan vào thanh
    const cr = e - CREST;
    if(cr > -250 && cr < 520){
      const k = fxEase((cr + 250) / 420), fade = 1 - fxEase((cr - 260) / 260), sy = cy - ch / 2 - 16 + 14 * fxEase(cr / 520);
      ctx.globalCompositeOperation = 'lighter'; fxGlow(ctx, cx, sy, 16, '255,226,140', .6 * k * fade); ctx.globalCompositeOperation = 'source-over';
      shieldPath(ctx, cx, sy, 7.5 * (.6 + .4 * k));
      const sg = ctx.createLinearGradient(0, sy - 8, 0, sy + 9); sg.addColorStop(0, `rgba(255,250,225,${k * fade})`); sg.addColorStop(1, `rgba(240,190,60,${k * fade})`);
      ctx.fillStyle = sg; ctx.fill(); ctx.strokeStyle = `rgba(154,107,0,${k * fade})`; ctx.lineWidth = 1.6; ctx.stroke();
    }
    // lớp khiên kính kết tinh quanh thanh + hào quang xoay
    const rk = fxEase((e - RING + 160) / 360), fa = 1 - fxEase((e - 1500) / 450);
    if(rk > 0){
      ctx.globalCompositeOperation = 'lighter';
      for(let i = 0; i < 10; i++){
        const an = i / 10 * Math.PI * 2 + e / 1500, L = (cw / 2 + 8) * rk;
        const gg = ctx.createLinearGradient(cx, cy, cx + Math.cos(an) * L, cy + Math.sin(an) * L * .55);
        gg.addColorStop(0, 'rgba(255,236,170,0)'); gg.addColorStop(.6, `rgba(255,236,170,${.26 * fa})`); gg.addColorStop(1, 'rgba(255,236,170,0)');
        ctx.fillStyle = gg; ctx.beginPath(); ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(an - .06) * L, cy + Math.sin(an - .06) * L * .55); ctx.lineTo(cx + Math.cos(an + .06) * L, cy + Math.sin(an + .06) * L * .55);
        ctx.closePath(); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      const gr = 7 * (1 - rk);
      fxRR(ctx, x0 - gr, y0 - gr, cw + gr * 2, ch + gr * 2, ch / 2 + gr);
      ctx.fillStyle = `rgba(210,235,255,${.18 * rk * fa})`; ctx.fill();
      ctx.strokeStyle = `rgba(255,226,140,${fa})`; ctx.lineWidth = 2.5; ctx.shadowColor = '#FFD54A'; ctx.shadowBlur = 10; ctx.stroke(); ctx.shadowBlur = 0;
      if(rk >= 1) fire();
      const h = e - RING;
      twinkles.forEach(([an, dx, R, d]) => { const q = (h - d) / 420; if(q > 0 && q < 1)
        star4(ctx, cx + Math.cos(an) * (cw / 2 + dx), cy + Math.sin(an) * (ch / 2 + dx * .7), R * Math.sin(q * Math.PI), Math.sin(q * Math.PI)); });
      if(h > 0 && h < 300 && Math.random() < .35){ const an = Math.random() * 7;
        sparks.push({ x: cx + Math.cos(an) * cw / 2, y: cy + Math.sin(an) * ch / 2, vx: Math.cos(an) * .4, vy: -.4 - Math.random() * .6, l: 0, m: 30, r: 2.2 }); }
    }
    fxSparks(ctx, sparks, '255,215,110');
  }, fire);
}
/* Nhận thêm khiên: một vệt sáng chạy quanh viền khiên + sao lấp lánh — gọn, không che thanh streak */
function fxShieldUp(chip, done){
  if(fxReduced()) return done && done();
  let B = fxBox(chip, 7), cb = done;
  const sparks = [];
  fxRun(1000, (ctx, e) => {
    B = fxBox(chip, 7);
    const k = fxEase(e / 700), fa = 1 - fxEase((e - 700) / 300);
    fxRR(ctx, B.x, B.y, B.w, B.h, B.h / 2);
    ctx.strokeStyle = `rgba(150,205,255,${.5 * fa})`; ctx.lineWidth = 2; ctx.stroke();
    const per = 2 * (B.w - B.h) + Math.PI * B.h;
    ctx.setLineDash([per * .18, per]); ctx.lineDashOffset = -per * k;
    ctx.strokeStyle = `rgba(255,236,170,${fa})`; ctx.lineWidth = 3; ctx.shadowColor = '#FFD54A'; ctx.shadowBlur = 9; ctx.stroke();
    ctx.setLineDash([]); ctx.shadowBlur = 0;
    if(e < 700 && Math.random() < .3){ const a = Math.random() * 7;
      sparks.push({ x: B.cx + Math.cos(a) * B.w / 2, y: B.cy + Math.sin(a) * B.h / 2, vx: Math.cos(a) * .8, vy: Math.sin(a) * .8 - .3, l: 0, m: 24, r: 3 }); }
    fxSparks(ctx, sparks, '255,226,140');
    if(e > 380 && cb){ const f = cb; cb = null; f(); }
  }, () => { if(cb){ const f = cb; cb = null; f(); } });
}
/* Khiên chịu đòn — gợn sóng lục giác: điểm va chạm loé sáng trên mép khiên, một gợn sóng lan khắp mặt khiên kính
   làm lưới lục giác sáng lên theo đợt sóng, rồi vài mảnh lục giác nhỏ bong ra rơi xuống. Gọn trong viền khiên. */
function fxShieldCrack(chip, done){
  if(fxReduced()) return done && done();
  let B = fxBox(chip, 7), cb = done, frags = null;
  const fire = () => { if(cb){ const f = cb; cb = null; f(); } };
  const fx = .25 + Math.random() * .5, CHIP = 300, rnd = (a, b) => a + Math.random() * (b - a);
  const hex = (ctx, x, y, r) => { ctx.beginPath();
    for(let i = 0; i < 6; i++){ const a = Math.PI / 3 * i + Math.PI / 6; i ? ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
    ctx.closePath(); };
  chip.classList.remove('sh-hit'); void chip.offsetWidth; chip.classList.add('sh-hit');
  setTimeout(() => chip.classList.remove('sh-hit'), 450);
  fxRun(1000, (ctx, e) => {
    if(!frags) B = fxBox(chip, 7);
    const ix = B.x + B.w * fx, iy = B.y + 1;
    const R = fxEase(e / 600) * B.w * .8, fa = 1 - fxEase((e - 300) / 500);
    ctx.save(); fxRR(ctx, B.x - 1, B.y - 1, B.w + 2, B.h + 2, B.h / 2 + 1); ctx.clip();
    const hr = 5.5, dx = hr * Math.sqrt(3), dy = hr * 1.5;
    for(let row = 0, y = B.y - hr; y < B.y + B.h + hr; row++, y += dy)
      for(let x = B.x - dx + (row % 2 ? dx / 2 : 0); x < B.x + B.w + dx; x += dx){
        const w = 1 - Math.min(1, Math.abs(Math.hypot(x - ix, (y - iy) * 1.5) - R) / 16);
        if(w <= 0) continue;
        hex(ctx, x, y, hr - .9);
        ctx.fillStyle = `rgba(150,205,255,${.45 * w * fa})`; ctx.fill();
        ctx.strokeStyle = `rgba(70,150,240,${w * fa})`; ctx.lineWidth = 1.4; ctx.stroke();
      }
    ctx.restore();
    fxRR(ctx, B.x, B.y, B.w, B.h, B.h / 2);
    ctx.strokeStyle = `rgba(150,205,255,${.85 * fa})`; ctx.lineWidth = 2; ctx.shadowColor = '#9CD0FF'; ctx.shadowBlur = 8; ctx.stroke(); ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = 'lighter';
    fxGlow(ctx, ix, iy, 14 + 10 * fxEase(e / 200), '255,120,140', .7 * (1 - fxEase(e / 280)));
    fxGlow(ctx, ix, iy, 9, '225,242,255', .9 * (1 - fxEase(e / 380)));
    ctx.globalCompositeOperation = 'source-over';
    if(e >= CHIP && !frags){
      fire();
      frags = [...Array(6)].map(() => ({ x: ix + rnd(-8, 8), y: iy + rnd(0, 4), vx: rnd(-1.3, 1.3), vy: rnd(-1.8, -.6), r: rnd(2.2, 3.6), a: rnd(0, 3), va: rnd(-.2, .2) }));
    }
    if(frags){
      const k = 1 - fxEase((e - CHIP) / 650);
      frags.forEach(f => { f.vy += .08; f.x += f.vx; f.y += f.vy; f.a += f.va;
        ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.a); hex(ctx, 0, 0, f.r);
        ctx.fillStyle = `rgba(200,232,255,${.75 * k})`; ctx.fill(); ctx.strokeStyle = `rgba(255,255,255,${k})`; ctx.lineWidth = 1; ctx.stroke(); ctx.restore(); });
    }
  }, fire);
}
/* Khiên cuối cùng — "Đêm nuốt chửng": vòng phù chú hắc ám xoay quanh thanh, những xúc tu bóng tối bò từ hai đầu
   vào, nuốt trọn thanh (một đôi mắt đỏ loé lên trong bóng tối), lớp khiên vỡ thành mảnh đen viền tím cùng tàn lửa
   tím–đỏ; rồi bóng tối tan đi, thanh streak hiện lại nguyên vẹn (chuỗi vẫn được giữ). */
function fxNightDevour(chip, done){
  if(fxReduced()) return done && done();
  let B = fxBox(chip, 7), cb = done, shards = null;
  const BREAK = 1000, sparks = [], smoke = [];
  const rnd = (a, b) => a + Math.random() * (b - a);
  const tentacles = [...Array(6)].map((_, i) => ({ side: i % 2 ? 1 : -1, off: rnd(-.7, .7), ph: rnd(0, 6), w: rnd(2.2, 3.6), d: rnd(0, 160) }));
  const RUNES = [[[0,-4,0,4],[0,-4,3,-1]], [[-3,-4,3,4],[3,-4,-3,4]], [[0,-4,0,4],[-3,0,3,0]], [[-3,4,0,-4],[0,-4,3,4]],
                 [[-3,-4,-3,4],[-3,0,3,-4],[-3,0,3,4]], [[0,-4,0,4],[0,-1,3,-4],[0,-1,-3,-4]], [[-3,-3,3,-3],[0,-3,0,4],[-2,4,2,4]]];
  fxRun(2200, (ctx, e) => {
    if(!shards) B = fxBox(chip, 7);
    const { cx, cy, x: x0, y: y0, w: cw, h: ch } = B;
    const dark = fxEase(e / 380) * (1 - fxEase((e - 1250) / 800));
    // quầng tối bao quanh
    fxGlow(ctx, cx, cy, cw * .44, '14,6,26', .45 * dark);
    // vòng phù chú tím xoay quanh thanh
    const rn = fxEase(e / 350) * (1 - fxEase((e - 1100) / 500));
    if(rn > 0){
      ctx.save(); ctx.lineCap = 'round'; ctx.shadowColor = '#B026FF'; ctx.shadowBlur = 9;
      ctx.strokeStyle = `rgba(150,60,220,${.35 * rn})`; ctx.lineWidth = 1.2; ctx.setLineDash([3, 5]);
      ctx.beginPath(); ctx.ellipse(cx, cy, cw / 2 + 9, ch / 2 + 8, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      for(let i = 0; i < 12; i++){
        const an = i / 12 * Math.PI * 2 - e / 900, gx = cx + Math.cos(an) * (cw / 2 + 9), gy = cy + Math.sin(an) * (ch / 2 + 8);
        ctx.save(); ctx.translate(gx, gy); ctx.rotate(an + Math.PI / 2);
        ctx.strokeStyle = `rgba(${i % 3 ? '205,120,255' : '255,70,90'},${rn * (.6 + .4 * Math.sin(e / 90 + i))})`; ctx.lineWidth = 1.3; ctx.scale(.8, .8);
        ctx.beginPath(); RUNES[i % RUNES.length].forEach(([a, b, c2, d]) => { ctx.moveTo(a, b); ctx.lineTo(c2, d); }); ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }
    // xúc tu bóng tối bò từ hai đầu vào giữa
    const tg = fxEase((e - 100) / 550) * (1 - fxEase((e - 1000) / 400));
    if(tg > 0){
      ctx.lineCap = 'round';
      tentacles.forEach(tn => {
        const k = Math.max(0, Math.min(1, tg * 1.15 - tn.d / 1000)); if(!k) return;
        const sx = cx + tn.side * (cw / 2 + 10), ex = cx + tn.side * (cw / 2 - cw * .55 * k);
        ctx.strokeStyle = `rgba(16,6,30,${.85 * tg})`; ctx.lineWidth = tn.w;
        ctx.beginPath();
        for(let i = 0; i <= 16; i++){
          const u = i / 16, x = sx + (ex - sx) * u, y = cy + tn.off * ch * .45 * (1 - u * .5) + Math.sin(u * 7 + e / 110 + tn.ph) * 3.5 * (1 - u * .4);
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
      });
    }
    // lớp khiên còn lại: nhấp nháy, nhuốm tím trước khi vỡ
    if(e < BREAK){
      const fl = .55 + .45 * Math.sin(e / 35) * Math.sin(e / 13);
      fxRR(ctx, x0, y0, cw, ch, ch / 2);
      ctx.strokeStyle = `rgba(${Math.round(150 - 40 * fxEase(e / 700))},${Math.round(205 - 150 * fxEase(e / 700))},255,${.9 * fl})`;
      ctx.lineWidth = 2.5; ctx.shadowColor = '#8A3FFF'; ctx.shadowBlur = 10; ctx.stroke(); ctx.shadowBlur = 0;
    }
    // bóng tối nuốt trọn thanh + đôi mắt đỏ
    const sw = fxEase((e - 400) / 400) * (1 - fxEase((e - 1200) / 600));
    if(sw > 0){
      ctx.save(); fxRR(ctx, x0, y0, cw, ch, ch / 2); ctx.clip();
      ctx.fillStyle = `rgba(10,4,20,${.93 * sw})`; ctx.fillRect(x0, y0, cw, ch);
      for(let i = 0; i < 4; i++) fxGlow(ctx, x0 + cw * (.2 + .2 * i) + Math.sin(e / 180 + i) * 8, cy + Math.cos(e / 230 + i) * 4, 20, '80,20,120', .5 * sw);
      ctx.restore();
      const ey = (e - 620) / 360;
      if(ey > 0 && ey < 1){ const a = Math.sin(ey * Math.PI);
        ctx.globalCompositeOperation = 'lighter';
        [-1, 1].forEach(sd => { fxGlow(ctx, cx + sd * 9, cy - 2, 7, '255,40,60', .85 * a);
          ctx.fillStyle = `rgba(255,190,190,${a})`; ctx.beginPath(); ctx.ellipse(cx + sd * 9, cy - 2, 2.8, 1.2 * a + .3, sd * .25, 0, 7); ctx.fill(); });
        ctx.globalCompositeOperation = 'source-over'; }
    }
    if(e >= BREAK){
      if(cb){ const f = cb; cb = null; f(); shards = fxShards(B, 16, 2);
        for(let i = 0; i < 18; i++){ const an = Math.random() * 7, v = .8 + Math.random() * 2;
          sparks.push({ x: cx + Math.cos(an) * cw / 3, y: cy + Math.sin(an) * ch / 3, vx: Math.cos(an) * v, vy: Math.sin(an) * v * .7 - .4,
                        l: 0, m: 22 + Math.random() * 14, r: 2 + Math.random() * 1.5, c: Math.random() < .55 ? '190,90,255' : '255,60,80' }); }
        for(let i = 0; i < 6; i++){ const an = Math.random() * 7;
          smoke.push({ x: cx + Math.cos(an) * cw / 3, y: cy + Math.sin(an) * ch / 3, vx: Math.cos(an) * .6, vy: Math.sin(an) * .35 - .25, l: 0, m: 45 + Math.random() * 20 }); } }
      const t2 = e - BREAK;
      if(t2 < 240){ ctx.globalCompositeOperation = 'lighter'; fxGlow(ctx, cx, cy, 18 + t2 * .3, '170,80,255', .75 * (1 - t2 / 240)); ctx.globalCompositeOperation = 'source-over'; }
      fxShardsDraw(ctx, shards, 1 - fxEase(t2 / 800), 'rgba(16,8,30,.92)', 'rgba(190,110,255,.95)');
      for(let i = smoke.length - 1; i >= 0; i--){ const p = smoke[i]; p.l++; if(p.l > p.m){ smoke.splice(i, 1); continue; }
        p.x += p.vx; p.y += p.vy; fxGlow(ctx, p.x, p.y, 7 + p.l * .22, '20,8,36', .4 * (1 - p.l / p.m)); }
      fxSparks(ctx, sparks);
    }
  }, () => { if(cb){ const f = cb; cb = null; f(); } });
}
