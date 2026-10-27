/* Streak: cấp độ hiệu ứng tăng dần theo số câu đúng liên tiếp */
const streakTier = n => n >= 200 ? 11 : n >= 150 ? 10 : n >= 125 ? 9 : n >= 100 ? 8 : n >= 75 ? 7 : n >= 50 ? 6 : n >= 20 ? 5 : n >= 10 ? 4 : n >= 6 ? 3 : n >= 3 ? 2 : n >= 1 ? 1 : 0;
/* Lớp canvas phủ toàn màn hình cho hiệu ứng streak (không bị khung chứa cắt mất) */
function fxCanvas(){
  const W = innerWidth, H = innerHeight, dpr = Math.min(2, devicePixelRatio || 1);
  const cv = document.createElement('canvas'); cv.className = 'flare-cv';
  cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
  const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
  document.body.appendChild(cv);
  return { cv, ctx, W, H };
}
/* Thổi lửa vào ngọn lửa streak: canvas phủ màn hình (không bị khung cắt). Luồng lửa ngắn phụt từ một điểm
   cạnh chip (phía còn chỗ trống, hơi cao hơn) THẲNG VÀO ngọn lửa, thu hẹp dần như bị hút vào; ngọn lửa co lại
   giật giật trong lúc "ăn" lửa, rồi bùng lên với chớp sáng + tia lửa, sau đó giữ cỡ to hơn (CSS theo tier). */
const FLARE_PAL = {
  red:  [[255,255,235],[255,230,120],[255,150,40],[235,60,25]],
  blue: [[245,255,255],[160,240,255],[56,198,244],[59,91,255]],
};
function streakFlare(chip, kind){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ic = chip.querySelector('.ic') || chip, r = ic.getBoundingClientRect();
  const { cv, ctx, W, H } = fxCanvas();
  const tx = r.left + r.width / 2, ty = r.top + r.height / 2;            // đích: ngọn lửa của chip
  const dir = tx > W / 2 ? -1 : 1, D = 120;
  const sx = tx + dir * D, sy = ty - 38;                                   // nguồn: cạnh chip, chếch lên
  const pal = FLARE_PAL[kind] || FLARE_PAL.red, ps = [], sparks = [];
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const colAt = t => { const x = Math.min(.999, t) * (pal.length - 1), i = Math.floor(x); return mix(pal[i], pal[i + 1], x - i); };
  const blob = (x, y, R, c, al) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, R);
    g.addColorStop(0, `rgba(${c},${al})`); g.addColorStop(.5, `rgba(${c},${al * .5})`); g.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, 7); ctx.fill();
  };
  const FEED = 950, t0 = performance.now(); let last = t0, ignited = 0;
  chip.classList.remove('ignite'); chip.classList.add('feeding');
  function frame(now){
    const el = now - t0, dt = Math.min(2.5, (now - last) / 16.7); last = now;
    if(el < FEED){
      const n = Math.round(4 * dt * (0.7 + 0.3 * Math.sin(el / 40))) + 1;
      for(let i = 0; i < n; i++){
        const ang = Math.atan2(ty - sy, tx - sx) + (Math.random() - .5) * 0.5;
        const sp = 5.2 + Math.random() * 1.6;
        ps.push({ x: sx + (Math.random() - .5) * 6, y: sy + (Math.random() - .5) * 6,
                  vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, d0: Math.hypot(tx - sx, ty - sy), sz: 5 + Math.random() * 5 });
      }
    }else if(!ignited){                                                    // ngọn lửa đã "no" → bùng lên
      ignited = now;
      chip.classList.remove('feeding'); void chip.offsetWidth; chip.classList.add('ignite');
      for(let i = 0; i < 22; i++){
        const a = -Math.PI / 2 + (Math.random() - .5) * 2.4, sp = 3 + Math.random() * 4;
        sparks.push({ x: tx, y: ty, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 26 + Math.random() * 18 });
      }
    }
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    for(let i = ps.length - 1; i >= 0; i--){                               // luồng lửa bị hút vào đích
      const p = ps[i], dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
      if(d < 7){ ps.splice(i, 1); continue; }
      const k = 0.18 * dt;                                                 // bẻ hướng dần về đích (hội tụ)
      p.vx += (dx / d * 7 - p.vx) * k; p.vy += (dy / d * 7 - p.vy) * k;
      p.x += p.vx * dt; p.y += p.vy * dt;
      const prog = 1 - Math.min(1, d / p.d0);                              // 0 ở nguồn → 1 ở đích
      const R = p.sz * (1 + Math.sin(prog * Math.PI) * 1.4) * (1 - prog * .55);
      blob(p.x, p.y, R, colAt(.95 - prog * .7), .45);                   // đỏ cam ở miệng phun → vàng trắng khi vào lửa
    }
    if(el < FEED) blob(sx, sy, 14 + 3 * Math.sin(el / 30), pal[2], .55);   // đốm lửa ở miệng phun
    if(el < FEED + 80) blob(tx, ty, 18 + 22 * Math.min(1, el / FEED), pal[2], .55);   // đích nóng dần
    if(ignited){
      const k = (now - ignited) / 520;
      if(k < 1){                                                           // chớp sáng + vòng sóng
        blob(tx, ty, 30 + k * 70, pal[0], (1 - k) * .9);
        ctx.strokeStyle = `rgba(${pal[2]},${(1 - k) * .8})`; ctx.lineWidth = 4 * (1 - k) + 1;
        ctx.beginPath(); ctx.arc(tx, ty, 20 + k * 80, 0, 7); ctx.stroke();
      }
      for(let i = sparks.length - 1; i >= 0; i--){
        const s = sparks[i]; s.life += dt;
        if(s.life >= s.max){ sparks.splice(i, 1); continue; }
        s.vx *= Math.pow(.95, dt); s.vy = s.vy * Math.pow(.95, dt) + 0.08 * dt;
        s.x += s.vx * dt; s.y += s.vy * dt;
        blob(s.x, s.y, 5, colAt(s.life / s.max * .9), 1 - s.life / s.max);
      }
    }
    if(!ignited || ps.length || sparks.length || now - ignited < 520) requestAnimationFrame(frame);
    else cv.remove();
  }
  requestAnimationFrame(frame);
  setTimeout(() => chip.classList.remove('ignite'), FEED + 900);
}
/* Gãy chuỗi dài — mỗi mốc một kiểu, gói gọn quanh thanh streak:
   ≥50 băng vỡ tung · ≥100 sét đánh · ≥150 bóng tối vỡ tan · ≥200 ánh sáng xua màn đêm */
function streakBreak(chip, prev){
  const kind = prev >= 200 ? 'light' : prev >= 150 ? 'shadow' : prev >= 100 ? 'bolt' : 'ice';
  const { cv, ctx, W, H } = fxCanvas();
  const r = chip.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const cw = r.width + 10, ch = r.height + 10, rnd = (a, b) => a + Math.random() * (b - a);
  const LR = 130;                                       // bán kính vùng hiệu ứng quanh chip — chỉ gói gọn quanh streak
  const rr = (x, y, w, h, rad) => { ctx.beginPath(); ctx.moveTo(x + rad, y); ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad); ctx.arcTo(x, y + h, x, y, rad); ctx.arcTo(x, y, x + w, y, rad); ctx.closePath(); };
  const glow = (x, y, R, c, a) => { const g = ctx.createRadialGradient(x, y, 0, x, y, R);
    g.addColorStop(0, `rgba(${c},${a})`); g.addColorStop(1, `rgba(${c},0)`); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, 7); ctx.fill(); };
  const ease = k => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);
  const cls = (c, ms) => { chip.classList.add(c); setTimeout(() => chip.classList.remove(c), ms); };
  let draw, dur;

  // Cắt thanh streak thành các mảnh tam giác (lưới lệch ngẫu nhiên) — dùng cho băng vỡ & bóng tối vỡ
  const x0 = cx - cw / 2, y0 = cy - ch / 2;
  const makeShards = (cols, rows, speed) => {
    const P = [];
    for(let j = 0; j <= rows; j++) for(let i = 0; i <= cols; i++){
      const edge = i === 0 || j === 0 || i === cols || j === rows;
      P.push([x0 + cw * i / cols + (edge && i % cols === 0 ? 0 : rnd(-.3, .3) * cw / cols),
              y0 + ch * j / rows + (edge && j % rows === 0 ? 0 : rnd(-.3, .3) * ch / rows)]);
    }
    const at = (i, j) => P[j * (cols + 1) + i], out = [];
    for(let j = 0; j < rows; j++) for(let i = 0; i < cols; i++){
      const q = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)];
      (Math.random() < .5 ? [[q[0], q[1], q[2]], [q[0], q[2], q[3]]] : [[q[0], q[1], q[3]], [q[1], q[2], q[3]]]).forEach(tri => {
        const gx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3, gy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
        const a = Math.atan2(gy - cy, (gx - cx) * .6) , v = speed * rnd(.6, 1.3);
        out.push({ gx, gy, pts: tri.map(([x, y]) => [x - gx, y - gy]), x: 0, y: 0, rot: 0,
                   vx: Math.cos(a) * v, vy: Math.sin(a) * v - rnd(.5, 2), vr: rnd(-.25, .25) });
      });
    }
    return out;
  };
  const drawShard = (sd, fill, stroke, alpha) => {
    ctx.save(); ctx.translate(sd.gx + sd.x, sd.gy + sd.y); ctx.rotate(sd.rot);
    rr(x0 - sd.gx, y0 - sd.gy, cw, ch, ch / 2); ctx.clip();          // giữ mép bo tròn của thanh streak
    ctx.beginPath(); sd.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
    ctx.globalAlpha = alpha; ctx.fillStyle = fill; ctx.fill();
    ctx.strokeStyle = stroke; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.restore();
  };
  const stepShards = (shards, g) => shards.forEach(sd => { sd.vy += g; sd.x += sd.vx; sd.y += sd.vy; sd.rot += sd.vr; });
  const crackLines = (shards, k, color) => {                          // vết nứt = mép các mảnh, hiện dần từ điểm va chạm
    ctx.strokeStyle = color; ctx.lineWidth = 1.3; ctx.beginPath();
    shards.forEach(sd => { if(Math.hypot(sd.gx - cx, (sd.gy - cy) * 2) > k * cw * .6) return;
      sd.pts.forEach(([x, y], i) => i ? ctx.lineTo(sd.gx + x, sd.gy + y) : ctx.moveTo(sd.gx + x, sd.gy + y)); ctx.closePath(); });
    ctx.stroke();
  };

  if(kind === 'ice'){                     // ── Băng vỡ: chip đóng băng, nứt toác rồi vỡ tung toé thành mảnh băng + bụi tuyết
    dur = 1800; cls('frozen', 700);
    const BREAK = 620, shards = makeShards(6, 2, 4.2), dust = [];
    draw = e => {
      if(e < BREAK){
        const form = ease(e / 200);
        rr(x0, y0, cw, ch, ch / 2);
        const g = ctx.createLinearGradient(0, y0, 0, y0 + ch);
        g.addColorStop(0, `rgba(235,250,255,${.85 * form})`); g.addColorStop(1, `rgba(140,205,245,${.8 * form})`);
        ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = `rgba(90,169,214,${form})`; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = `rgba(255,255,255,${.6 * form})`; ctx.fillRect(x0 + 14, y0 + 5, cw * .35, 3);
        const c = ease((e - 230) / 360);
        if(c > 0) crackLines(shards, c, `rgba(255,255,255,${.95})`);
        if(e > 230) glow(cx, cy, 14 + 10 * c, '255,255,255', .5 * c);
      }else{
        const t = e - BREAK, f = 1 - ease(t / 1100);
        if(!dust.length) for(let i = 0; i < 34; i++){ const a = rnd(0, Math.PI * 2), v = rnd(1.5, 5.5);
          dust.push({ x: cx + rnd(-cw / 3, cw / 3), y: cy + rnd(-6, 6), vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.5, s: rnd(1.2, 3) }); }
        if(t < 220) glow(cx, cy, 30 + t * .4, '220,245,255', .9 * (1 - t / 220));      // chớp lạnh lúc vỡ
        stepShards(shards, .2);
        shards.forEach(sd => drawShard(sd, 'rgba(190,232,255,.85)', 'rgba(255,255,255,.95)', f));
        dust.forEach(d => { d.vy += .12; d.x += d.vx; d.y += d.vy;
          ctx.fillStyle = `rgba(235,250,255,${f})`; ctx.beginPath(); ctx.arc(d.x, d.y, d.s, 0, 7); ctx.fill(); });
      }
    };
    setTimeout(() => { chip.classList.remove('lost'); void chip.offsetWidth; cls('lost', 400); }, BREAK);
  }else if(kind === 'bolt'){              // ── Sét đánh: trời tối sầm, tia sét giật 3 lần xuống chip, cháy xém + khói
    dur = 1900;
    const bolt = (x1, y1, x2, y2, spread, out) => {     // tia sét gấp khúc (chia đôi đoạn + lệch ngẫu nhiên)
      if(spread < 4){ out.push([x1, y1, x2, y2]); return out; }
      const mx = (x1 + x2) / 2 + rnd(-spread, spread), my = (y1 + y2) / 2 + rnd(-spread * .3, spread * .3);
      bolt(x1, y1, mx, my, spread / 2, out); bolt(mx, my, x2, y2, spread / 2, out);
      if(Math.random() < .15 && spread > 10) bolt(mx, my, mx + rnd(-30, 30), my + rnd(15, 40), spread / 2.5, out);   // nhánh phụ
      return out;
    };
    const bolts = [0, 1, 2].map(() => bolt(cx + rnd(-45, 45), cy - 120, cx + rnd(-8, 8), cy, 30, []));
    const strikes = [[90, 200], [260, 330], [400, 470]], sparks = [], smoke = [];
    let hit = false;
    draw = e => {
      glow(cx, cy, LR, '12,14,40', .6 * Math.min(1, e / 90) * (1 - ease((e - 700) / 600)));
      strikes.forEach(([a, b], i) => {
        if(e < a || e > b) return;
        const k = 1 - (e - a) / (b - a);
        glow(cx, cy, LR * .9, '230,240,255', .55 * k);                                 // chớp trắng quanh chip
        ctx.lineCap = 'round';
        [[10, `rgba(120,190,255,${.45 * k})`], [4, `rgba(200,230,255,${.9 * k})`], [1.6, `rgba(255,255,255,${k})`]].forEach(([lw, c]) => {
          ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.beginPath();
          bolts[i].forEach(([x1, y1, x2, y2]) => { ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); }); ctx.stroke();
        });
        glow(cx, cy, 70, '200,230,255', .8 * k);
      });
      if(e >= 90 && !hit){
        hit = true; cls('zapped', 1300);
        for(let i = 0; i < 26; i++){ const a = rnd(0, Math.PI * 2), v = rnd(1.5, 4);
          sparks.push({ x: cx + rnd(-cw / 3, cw / 3), y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, l: 0, m: rnd(22, 40) }); }
      }
      if(e > 420 && e < 1500 && Math.random() < .5)
        smoke.push({ x: cx + rnd(-cw / 2.5, cw / 2.5), y: cy - 6, r: rnd(6, 10), l: 0, m: rnd(45, 70) });
      ctx.globalCompositeOperation = 'lighter';
      for(let i = sparks.length - 1; i >= 0; i--){
        const p = sparks[i]; p.l++; if(p.l > p.m){ sparks.splice(i, 1); continue; }
        p.vy += .22; p.x += p.vx; p.y += p.vy;
        ctx.strokeStyle = `rgba(255,${200 + 55 * (1 - p.l / p.m) | 0},120,${1 - p.l / p.m})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 2, p.y - p.vy * 2); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      for(let i = smoke.length - 1; i >= 0; i--){
        const p = smoke[i]; p.l++; if(p.l > p.m){ smoke.splice(i, 1); continue; }
        const k = p.l / p.m; p.y -= .9; p.x += Math.sin(p.l / 8) * .4;
        glow(p.x, p.y, p.r + k * 16, '70,70,80', .35 * (1 - k));
      }
    };
  }else if(kind === 'shadow'){            // ── Bóng tối vỡ tan: thanh streak tối dần, nứt sáng tím rồi vỡ vụn thành mảnh đen
    dur = 2000;
    const BREAK = 1000, shards = makeShards(7, 2, 3.2), wisps = [];
    draw = e => {
      if(e < BREAK){
        const k = ease(e / 650);
        ctx.save(); rr(x0, y0, cw, ch, ch / 2); ctx.clip();
        ctx.fillStyle = `rgba(14,8,30,${.95 * k})`; ctx.fillRect(x0, y0, cw, ch);
        for(let i = 0; i < 4; i++)                                   // khói tím cuộn bên trong thanh
          glow(x0 + cw * (.2 + .2 * i) + Math.sin(e / 200 + i) * 10, cy + Math.cos(e / 260 + i) * 5, 22, '90,40,150', .55 * k);
        ctx.restore();
        rr(x0, y0, cw, ch, ch / 2); ctx.strokeStyle = `rgba(120,70,190,${k})`; ctx.lineWidth = 2; ctx.stroke();
        if(Math.random() < .5 * k) wisps.push({ x: rnd(x0 + 10, x0 + cw - 10), y: y0, l: 0 });
        const c = ease((e - 650) / 330);
        if(c > 0){ ctx.shadowColor = '#C77DFF'; ctx.shadowBlur = 8; crackLines(shards, c, 'rgba(215,170,255,.95)'); ctx.shadowBlur = 0; }
      }else{
        const t = e - BREAK, f = 1 - ease(t / 950);
        if(t < 240) glow(cx, cy, 30 + t * .45, '225,190,255', .85 * (1 - t / 240));
        stepShards(shards, .14);
        shards.forEach(sd => drawShard(sd, 'rgba(14,8,30,.95)', 'rgba(199,125,255,.95)', f));
      }
      for(let i = wisps.length - 1; i >= 0; i--){                    // làn khói đen bốc lên khỏi thanh
        const w = wisps[i]; w.l++; if(w.l > 40){ wisps.splice(i, 1); continue; }
        w.y -= .7; glow(w.x + Math.sin(w.l / 6) * 3, w.y, 7 + w.l * .2, '20,10,40', .4 * (1 - w.l / 40));
      }
    };
    setTimeout(() => { chip.classList.remove('lost'); void chip.offsetWidth; cls('lost', 400); }, BREAK);
  }else{                                  // ── Ánh sáng xua màn đêm: thanh streak chìm vào đêm sao, một dải sáng vàng quét qua
    dur = 2000;                           //    xua tan bóng tối, rồi vầng hào quang + sao lấp lánh quanh thanh
    const stars = [...Array(14)].map(() => [rnd(x0 + 8, x0 + cw - 8), rnd(y0 + 5, y0 + ch - 5), rnd(.7, 1.6), rnd(0, 6)]);
    const twinkles = [...Array(9)].map((_, i) => { const a = i / 9 * Math.PI * 2 + rnd(-.3, .3);
      return [cx + Math.cos(a) * (cw / 2 + rnd(10, 24)), cy + Math.sin(a) * (ch / 2 + rnd(8, 18)), rnd(7, 12), rnd(0, 300)]; });
    const S0 = 420, S1 = 1150, sparks = [];
    const star4 = (x, y, R, a) => { ctx.fillStyle = `rgba(255,236,160,${a})`; ctx.beginPath();
      for(let i = 0; i < 8; i++){ const rr2 = i % 2 ? R * .25 : R, an = i * Math.PI / 4 - Math.PI / 2;
        ctx.lineTo(x + Math.cos(an) * rr2, y + Math.sin(an) * rr2); } ctx.closePath(); ctx.fill(); };
    draw = e => {
      const night = ease(e / 300), sx = x0 - 20 + (cw + 40) * ease((e - S0) / (S1 - S0));   // vị trí dải sáng
      ctx.save(); rr(x0, y0, cw, ch, ch / 2); ctx.clip();
      if(e < S1 + 50){                                               // màn đêm trên thanh — phần đã bị quét thì biến mất
        ctx.save(); ctx.beginPath(); ctx.rect(e < S0 ? x0 - 30 : sx, y0 - 5, cw + 60, ch + 10); ctx.clip();
        const g = ctx.createLinearGradient(0, y0, 0, y0 + ch);
        g.addColorStop(0, `rgba(10,14,48,${.95 * night})`); g.addColorStop(1, `rgba(28,20,70,${.95 * night})`);
        ctx.fillStyle = g; ctx.fillRect(x0, y0, cw, ch);
        stars.forEach(([x, y, r2, ph]) => { ctx.fillStyle = `rgba(255,255,235,${night * (.55 + .45 * Math.sin(e / 120 + ph))})`;
          ctx.beginPath(); ctx.arc(x, y, r2, 0, 7); ctx.fill(); });
        ctx.restore();
      }
      const sweeping = e > S0 && e < S1 + 80;
      if(sweeping){                                                  // dải sáng chéo vàng rực
        const g = ctx.createLinearGradient(sx - 46, 0, sx + 14, 0);
        g.addColorStop(0, 'rgba(255,200,60,0)'); g.addColorStop(.55, 'rgba(255,214,90,.9)'); g.addColorStop(.85, 'rgba(255,255,235,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(sx - 52, y0 + ch); ctx.lineTo(sx - 30, y0); ctx.lineTo(sx + 18, y0); ctx.lineTo(sx - 4, y0 + ch); ctx.closePath(); ctx.fill();
        for(let i = 0; i < 2; i++) sparks.push({ x: sx + rnd(-8, 8), y: rnd(y0, y0 + ch), vx: rnd(-2, 1), vy: rnd(-2.4, .6), l: 0 });
      }
      ctx.restore();
      if(sweeping){ ctx.globalCompositeOperation = 'lighter'; glow(sx - 8, cy, 34, '255,210,90', .55); ctx.globalCompositeOperation = 'source-over'; }
      ctx.globalCompositeOperation = 'lighter';
      for(let i = sparks.length - 1; i >= 0; i--){
        const p = sparks[i]; p.l++; if(p.l > 28){ sparks.splice(i, 1); continue; }
        p.x += p.vx; p.y += p.vy; p.vy += .03; glow(p.x, p.y, 4, '255,215,110', 1 - p.l / 28);
      }
      const h = e - S1;
      if(h > 0){                                                     // hào quang bo theo thanh nở ra + sao 4 cánh
        const k = ease(h / 650), a = 1 - ease(h / 850);
        rr(x0 - 4 - 14 * k, y0 - 4 - 14 * k, cw + 8 + 28 * k, ch + 8 + 28 * k, ch / 2 + 14 * k);
        ctx.strokeStyle = `rgba(255,214,90,${a})`; ctx.lineWidth = 5 * a + .5; ctx.shadowColor = '#FFC107'; ctx.shadowBlur = 18;
        ctx.stroke(); ctx.shadowBlur = 0;
        if(h < 40) for(let i = 0; i < 16; i++){ const an = i / 16 * Math.PI * 2, v = rnd(2.2, 3.6);   // chùm tia vàng bung ra
          sparks.push({ x: cx + Math.cos(an) * cw * .45, y: cy + Math.sin(an) * ch * .5, vx: Math.cos(an) * v, vy: Math.sin(an) * v * .6, l: 0 }); }
        glow(cx, cy, cw * .55, '255,225,140', .35 * a);
        twinkles.forEach(([x, y, R, d]) => { const q = (h - d) / 450; if(q > 0 && q < 1) star4(x, y, R * Math.sin(q * Math.PI), Math.sin(q * Math.PI)); });
      }
      ctx.globalCompositeOperation = 'source-over';
    };
    cls('blessed', 1900);
  }

  const t0 = performance.now();
  (function frame(now){
    const e = now - t0;
    ctx.clearRect(0, 0, W, H);
    if(e >= dur){ cv.remove(); return; }
    ctx.save(); ctx.beginPath(); ctx.ellipse(cx, cy, cw / 2 + LR, LR + 10, 0, 0, 7); ctx.clip();
    draw(e);
    ctx.restore();
    requestAnimationFrame(frame);
  })(t0);
}
function updateStreakUI(prev, shielded){
  const chip = $('#streakChip'), num = $('#quizStreak'); if(!chip || !num) return;
  const n = quizStreak, oldTier = parseInt(chip.dataset.tier || '0', 10), tier = streakTier(n);
  const retrigger = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
  num.textContent = n;
  chip.dataset.tier = tier;
  if(currentUser) try{ localStorage.setItem(streakKey(), String(n)); }catch(e){}   // giữ chuỗi khi tải lại trang
  if(shielded){                                    // khiên vừa chịu đòn: vỡ 1 lớp (lớp cuối → thiên thần ôm chuỗi)
    const last = shieldsLeft() === 0;
    renderShieldAura(chip, shieldsLeft() + 1);
    (last ? fxNightDevour : fxShieldCrack)(chip, () => renderShieldAura(chip, shieldsLeft()));
    toast(t(last ? 'shieldLast' : 'shieldSaved'));
    return;
  }
  renderShieldAura(chip, shieldsLeft());
  if(n > (prev || 0)){
    retrigger(num, 'pop');
    if(tier > oldTier && tier >= 2){
      retrigger(chip, 'tier-up');
      clearTimeout(chip._tu); chip._tu = setTimeout(() => chip.classList.remove('tier-up'), 750);
      if(tier >= 6) toast(t('qStreakMilestone', n));             // mốc 50 / 75 / 100 / 125 / 150 / 200
      if(tier === 8 || tier === 11) streakFlare(chip, tier === 11 ? 'blue' : 'red');
    }
  }else if(n === 0 && (prev || 0) >= 3){
    if(prev >= 50 && !matchMedia('(prefers-reduced-motion: reduce)').matches) streakBreak(chip, prev);   // gãy chuỗi dài → hiệu ứng riêng
    else { retrigger(chip, 'lost'); setTimeout(() => chip.classList.remove('lost'), 400); }
  }
}
