// Hero hologram: a floating field projected in 3D (no library). Three crop strips in the app's rotation colours
// grow and fade in turn (a rotation through the seasons), sway in the wind, and are swept by a scan beam,
// above a rotating astrolabe projector ring. Decorative only; pauses off-screen; still frame for reduced motion.
(() => {
  'use strict';
  const canvas = document.getElementById('holo');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const COPPER = [232, 179, 145], TEAL = [111, 214, 191], FROST = [156, 194, 242], GREY = [201, 206, 214], WHITE = [242, 239, 234];
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a)).toFixed(3)})`;

  // field strips: x range, colour, crop shape, label, season phase
  const STRIPS = [
    { x0: -1, x1: -0.38, c: COPPER, kind: 'wheat', label: 'WINTER WHEAT', phase: 0 },
    { x0: -0.31, x1: 0.31, c: TEAL, kind: 'legume', label: 'CHICKPEA · FIXES N', phase: 1 / 3 },
    { x0: 0.38, x1: 1, c: FROST, kind: 'sorghum', label: 'SORGHUM · LOW WATER', phase: 2 / 3 },
  ];
  const ROW = 0.105, STEP = 0.11;
  const plants = [];
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (const s of STRIPS) {
    for (let x = s.x0 + 0.05; x <= s.x1 - 0.04; x += ROW) {
      for (let z = -0.95; z <= 0.95; z += STEP) plants.push({ s, x: x + (rnd() - 0.5) * 0.02, z: z + (rnd() - 0.5) * 0.03, h: 0.85 + rnd() * 0.3, ph: rnd() * 6.28 });
    }
  }
  const motes = Array.from({ length: 70 }, () => ({ x: rnd() * 2 - 1, z: rnd() * 2 - 1, y: rnd(), v: 0.05 + rnd() * 0.08, s: 0.6 + rnd() * 1.2 }));
  const ground = (x, z) => 0.035 * Math.sin(2.3 * x + 0.7) * Math.cos(1.9 * z) + 0.02 * Math.sin(3.1 * z + 1.3);

  let W = 0, H = 0, cx = 0, cy = 0, S = 1, D = 6, yaw = 0, pitch = 0.52, wide = true;
  let ptrX = 0, ptrY = 0, ex = 0, ey = 0;

  function resize() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    wide = W >= 900;
    cx = wide ? W * 0.73 : W * 0.5;
    cy = wide ? H * 0.52 : H * 0.84;
    S = wide ? Math.min(W * 0.19, H * 0.34) : Math.min(W * 0.3, H * 0.16);
  }

  function project(x, y, z) {
    const cyw = Math.cos(yaw), syw = Math.sin(yaw);
    const X = x * cyw - z * syw, Z0 = x * syw + z * cyw;
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const Y = y * cp + Z0 * sp, Z = Z0 * cp - y * sp;
    const f = D / (D + Z);
    return [cx + X * S * f, cy - Y * S * f, f];
  }
  const fade = (f) => 0.35 + 0.65 * Math.min(1, Math.max(0, (f - 0.78) / 0.4)); // dimmer far away

  function line(a, b, c, alpha, w = 1) {
    ctx.strokeStyle = rgba(c, alpha); ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  }
  function dot(p, r, c, alpha) {
    ctx.fillStyle = rgba(c, alpha);
    ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 6.2832); ctx.fill();
  }
  function ring(y, r, c, alpha, dash, rot = 0, ticks = 0) {
    ctx.strokeStyle = rgba(c, alpha); ctx.lineWidth = 1; ctx.setLineDash(dash || []);
    ctx.beginPath();
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * 6.2832 + rot;
      const p = project(Math.cos(a) * r, y, Math.sin(a) * r);
      i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
    }
    ctx.stroke(); ctx.setLineDash([]);
    for (let i = 0; i < ticks; i++) {
      const a = (i / ticks) * 6.2832 + rot, long = i % 6 === 0;
      line(project(Math.cos(a) * r, y, Math.sin(a) * r), project(Math.cos(a) * (r + (long ? 0.09 : 0.045)), y, Math.sin(a) * (r + (long ? 0.09 : 0.045))), c, alpha * (long ? 1.2 : 0.8));
    }
  }

  function frame(t) {
    // camera: slow turn + pointer parallax (eased)
    ex += (ptrX - ex) * 0.04; ey += (ptrY - ey) * 0.04;
    yaw = -0.62 + Math.sin(t * 0.09) * 0.28 + ex * 0.3;
    pitch = 0.5 + ey * 0.1;
    const flicker = 0.93 + 0.07 * Math.sin(t * 23) * Math.sin(t * 3.7);

    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';

    // projector base: astrolabe rings below the field
    const base = -0.55;
    ring(base, 1.22, GREY, 0.18, null, t * 0.05, 72);
    ring(base, 1.05, COPPER, 0.34, [2, 6], -t * 0.12);
    ring(base, 0.36, WHITE, 0.25, null);
    dot(project(0, base, 0), 3, COPPER, 0.9);
    // light cone from the base to the field corners
    for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) line(project(x * 0.3, base, z * 0.3), project(x, ground(x, z), z), TEAL, 0.07);

    // ground grid
    const N = 16;
    for (let i = 0; i <= N; i++) {
      const u = -1 + (2 * i) / N;
      let pa = null, pb = null;
      for (let j = 0; j <= N; j++) {
        const v = -1 + (2 * j) / N;
        const a = project(u, ground(u, v), v), b = project(v, ground(v, u), u);
        if (pa) line(pa, a, TEAL, 0.11 * fade(a[2]) * flicker);
        if (pb) line(pb, b, TEAL, 0.11 * fade(b[2]) * flicker);
        pa = a; pb = b;
      }
    }
    // field frame with HUD corner brackets
    const corner = (x, z, dx, dz) => {
      const p = project(x, ground(x, z), z);
      line(p, project(x + dx * 0.22, ground(x + dx * 0.22, z), z), WHITE, 0.75, 1.5);
      line(p, project(x, ground(x, z + dz * 0.22), z + dz * 0.22), WHITE, 0.75, 1.5);
    };
    corner(-1, -1, 1, 1); corner(1, -1, -1, 1); corner(1, 1, -1, -1); corner(-1, 1, 1, -1);

    // scan beam sweeping along z
    const sz = -1.25 + ((t * 0.22) % 1) * 2.5;
    if (sz > -1 && sz < 1) {
      const a = project(-1, ground(-1, sz), sz), b = project(1, ground(1, sz), sz);
      const a2 = project(-1, 0.7, sz), b2 = project(1, 0.7, sz);
      const g = ctx.createLinearGradient(0, (a[1] + b[1]) / 2, 0, (a2[1] + b2[1]) / 2);
      g.addColorStop(0, rgba(WHITE, 0.14)); g.addColorStop(1, rgba(WHITE, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(b2[0], b2[1]); ctx.lineTo(a2[0], a2[1]); ctx.closePath(); ctx.fill();
      line(a, b, WHITE, 0.8, 1.4);
    }

    // crops: each strip's growth follows its own season, so the strips take turns (a rotation)
    for (const s of STRIPS) {
      const season = (t * 0.06 + s.phase) % 1;
      s.g = Math.pow(Math.max(0, Math.sin(season * Math.PI)), 0.7); // 0 → 1 → 0 over its season
    }
    for (const p of plants) {
      const s = p.s, g = s.g;
      if (g < 0.04) continue;
      const y0 = ground(p.x, p.z);
      const hgt = (s.kind === 'sorghum' ? 0.42 : s.kind === 'wheat' ? 0.32 : 0.17) * p.h * g;
      const sway = 0.03 * g * Math.sin(t * 1.4 + p.x * 3 + p.z * 2.2 + p.ph * 0.3);
      const b = project(p.x, y0, p.z), top = project(p.x + sway, y0 + hgt, p.z + sway * 0.4);
      const near = Math.abs(p.z - sz) < 0.09 ? 1 : 0; // lit by the scan
      const a = (0.38 + 0.5 * near) * fade(b[2]) * flicker;
      if (s.kind === 'legume') {
        const mid = project(p.x + sway * 0.6, y0 + hgt * 0.55, p.z);
        line(b, top, s.c, a * 0.8);
        dot(mid, 1.6 * b[2], s.c, a);
        dot(top, 1.9 * b[2], s.c, a + 0.15);
      } else {
        line(b, top, s.c, a, s.kind === 'sorghum' ? 1.2 : 1);
        const ear = project(p.x + sway * 1.15, y0 + hgt * 1.12, p.z + sway * 0.45);
        line(top, ear, s.kind === 'wheat' ? WHITE : s.c, a + 0.2, 2.2);
        if (s.kind === 'sorghum') dot(ear, 2.2 * b[2], WHITE, a * 0.9);
      }
      if (near) dot(b, 1.2, WHITE, 0.5);
    }

    // rising motes
    for (const m of motes) {
      m.y += m.v * 0.016; if (m.y > 1) { m.y = 0; m.x = Math.random() * 2 - 1; m.z = Math.random() * 2 - 1; }
      const p = project(m.x, ground(m.x, m.z) + m.y * 0.9, m.z);
      dot(p, m.s * p[2], WHITE, 0.5 * Math.sin(m.y * Math.PI) * fade(p[2]));
    }

    // HUD callouts (labels only; no numbers on decoration)
    ctx.globalCompositeOperation = 'source-over';
    ctx.font = `500 ${wide ? 10 : 9}px "Exo 2", Inter, sans-serif`;
    ctx.textBaseline = 'middle';
    STRIPS.forEach((s, i) => {
      if (!wide) return; // narrow screens: no side labels (they would be cut off)
      const xm = (s.x0 + s.x1) / 2, zm = -0.55 + i * 0.1;
      const anchor = project(xm, ground(xm, zm) + 0.42 * (0.35 + 0.65 * s.g), zm);
      const up = (wide ? 46 : 30) + i * 14, dir = wide ? 1 : (i === 0 ? -1 : 1);
      const elbow = [anchor[0] + 18 * dir, anchor[1] - up];
      const end = [elbow[0] + (wide ? 70 : 40) * dir, elbow[1]];
      const a = 0.45 + 0.5 * s.g;
      line(anchor, elbow, s.c, a * 0.7); line(elbow, end, s.c, a * 0.7);
      dot(anchor, 2.4, s.c, a);
      if (wide || i !== 1) {
        ctx.fillStyle = rgba(s.c, a);
        ctx.textAlign = dir > 0 ? 'left' : 'right';
        ctx.fillText(s.label, end[0] + 6 * dir, end[1]);
        ctx.fillStyle = rgba(GREY, a * 0.8);
        ctx.fillText(s.g > 0.5 ? 'IN SEASON' : 'RESTING', end[0] + 6 * dir, end[1] + 13);
      }
    });
    if (wide) {
      ctx.textAlign = 'center';
      ctx.fillStyle = rgba(GREY, 0.6);
      ['NASA POWER · DAILY WEATHER   ·   MODIS NDVI · CROP GREENNESS   ·   FAO-56 · SOIL WATER'].forEach((txt) => ctx.fillText(txt, cx, cy + S * 1.55));
    }
  }

  let raf = 0, visible = true, t0 = performance.now();
  const loop = (now) => { frame((now - t0) / 1000); raf = requestAnimationFrame(loop); };
  const run = () => { if (!raf && visible && !document.hidden && !reduce) raf = requestAnimationFrame(loop); };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };

  resize();
  if (reduce) { frame(8); } else run();
  window.addEventListener('resize', () => { resize(); if (reduce) frame(8); });
  window.addEventListener('pointermove', (e) => { ptrX = (e.clientX / window.innerWidth) * 2 - 1; ptrY = (e.clientY / window.innerHeight) * 2 - 1; }, { passive: true });
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : run()));
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? run() : stop(); }).observe(canvas);
  }
})();
