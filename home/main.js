// Fihrist home page: star-map background (same as the app), scroll reveals, count-ups, decode text, active tab.
(() => {
  'use strict';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };

  // ---------- stone star map (port of the app's SpaceMap) ----------
  function starmap() {
    const W = 1600, H = 1000, GREY = '#C9CED6', COPPER = '#C98B66', LIGHT = '#ECE8E1';
    const SYSTEMS = [
      { x: -60, y: 160, star: 5, ticks: true, orbits: [[230, 140, 1, 20, 4, COPPER, 1], [360, 220, 1, 70, 3, LIGHT], [520, 320, -1, 40, 5, GREY]] },
      { x: 1340, y: 720, star: 4, orbits: [[64, 34, 1, 0, 2.5, LIGHT], [118, 62, 1, 140, 3.5, COPPER], [186, 110, -1, 260, 4.5, GREY], [262, 180, 1, 60, 3, COPPER, 1]] },
      { x: 1040, y: 210, star: 3, orbits: [[46, 28, -1, 90, 2.2, LIGHT], [92, 70, -1, 200, 3, GREY], [150, 130, 1, 320, 2.5, COPPER, 1]] },
      { x: 330, y: 840, star: 3, orbits: [[40, 24, 1, 30, 2, COPPER], [78, 52, 1, 180, 3, LIGHT], [124, 96, -1, 300, 2.5, GREY]] },
      { x: 690, y: 520, star: 2, orbits: [[30, 20, -1, 0, 1.8, LIGHT], [58, 44, 1, 120, 2.2, COPPER]] },
    ];
    let seed = 77;
    const rnd = () => { let t = (seed += 0x6d2b79f5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

    const svg = el('svg', { id: 'starmap', viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'xMidYMid slice', 'aria-hidden': 'true' });
    const defs = el('defs', {}, svg);
    const g1 = el('radialGradient', { id: 'stoneLight', cx: '55%', cy: '35%', r: '75%' }, defs);
    el('stop', { offset: '0', 'stop-color': '#2E3238' }, g1); el('stop', { offset: '0.55', 'stop-color': '#202328' }, g1); el('stop', { offset: '1', 'stop-color': '#111315' }, g1);
    const g2 = el('radialGradient', { id: 'vignette', cx: '50%', cy: '45%', r: '72%' }, defs);
    el('stop', { offset: '0.6', 'stop-color': '#000', 'stop-opacity': '0' }, g2); el('stop', { offset: '1', 'stop-color': '#000', 'stop-opacity': '0.7' }, g2);
    const f1 = el('filter', { id: 'grain', x: '0', y: '0', width: '100%', height: '100%' }, defs);
    el('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.9', numOctaves: '3', stitchTiles: 'stitch' }, f1);
    el('feColorMatrix', { values: '0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.07 0' }, f1);
    const f2 = el('filter', { id: 'mottle', x: '0', y: '0', width: '100%', height: '100%' }, defs);
    el('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.006', numOctaves: '2', seed: '4' }, f2);
    el('feColorMatrix', { values: '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.35 0' }, f2);

    el('rect', { width: W, height: H, fill: 'url(#stoneLight)' }, svg);
    el('rect', { width: W, height: H, filter: 'url(#mottle)' }, svg);
    el('rect', { width: W, height: H, filter: 'url(#grain)' }, svg);
    const hl = el('g', { stroke: GREY, 'stroke-width': '0.6', opacity: '0.13' }, svg);
    el('line', { x1: -100, y1: 40, x2: 1700, y2: 980 }, hl); el('line', { x1: 200, y1: 1050, x2: 1500, y2: -60 }, hl); el('line', { x1: 0, y1: 610, x2: 1600, y2: 430 }, hl);
    for (let i = 0; i < 120; i++) el('circle', { cx: rnd() * W, cy: rnd() * H, r: 0.3 + rnd() * 0.9, fill: '#F2EFEA', opacity: 0.15 + rnd() * 0.45 }, svg);

    for (const sys of SYSTEMS) {
      const g = el('g', {}, svg);
      for (const [r, , , , , , copper] of sys.orbits) {
        el('circle', { cx: sys.x, cy: sys.y, r, fill: 'none', stroke: copper ? COPPER : GREY, 'stroke-width': copper ? 0.9 : 0.6, 'stroke-dasharray': copper ? '2 5' : 'none', opacity: copper ? 0.4 : 0.18 }, g);
      }
      if (sys.ticks) {
        const r1 = sys.orbits[1][0];
        for (let i = 0; i < 48; i++) {
          const a = (i * Math.PI) / 24, r2 = r1 + (i % 4 === 0 ? 10 : 5);
          el('line', { x1: sys.x + Math.cos(a) * r1, y1: sys.y + Math.sin(a) * r1, x2: sys.x + Math.cos(a) * r2, y2: sys.y + Math.sin(a) * r2, stroke: GREY, 'stroke-width': 0.6, opacity: 0.22 }, g);
        }
      }
      el('circle', { cx: sys.x, cy: sys.y, r: sys.star * 3, fill: COPPER, opacity: 0.12 }, g);
      el('circle', { cx: sys.x, cy: sys.y, r: sys.star, fill: '#F2E3D2', opacity: 0.85 }, g);
      // planets: groups rotated about the star by CSS (compositor animation)
      for (const [r, period, dir, phase, size, color] of sys.orbits) {
        const pg = el('g', {}, g);
        el('circle', { cx: sys.x + r, cy: sys.y, r: size * 2.4, fill: color, opacity: 0.12 }, pg);
        el('circle', { cx: sys.x + r, cy: sys.y, r: size, fill: color, opacity: 0.92 }, pg);
        pg.style.transformBox = 'view-box';
        pg.style.transformOrigin = `${sys.x}px ${sys.y}px`;
        if (reduce) pg.style.transform = `rotate(${phase * dir}deg)`;
        else {
          pg.style.animation = `orbit ${period}s linear infinite`;
          pg.style.animationDirection = dir < 0 ? 'reverse' : 'normal';
          pg.style.animationDelay = `${-(phase / 360) * period}s`;
        }
      }
    }
    el('rect', { width: W, height: H, fill: 'url(#vignette)' }, svg);
    document.body.prepend(svg);
  }

  // ---------- reveal on scroll ----------
  function reveals() {
    const items = document.querySelectorAll('[data-reveal]');
    items.forEach((n) => { const d = Number(n.getAttribute('data-d')); if (d > 0 && d < 2000) n.style.setProperty('--d', String(d)); });
    if (reduce || !('IntersectionObserver' in window)) { items.forEach((n) => n.classList.add('in')); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      io.unobserve(e.target);
      e.target.querySelectorAll('[data-count]').forEach(countUp);
    }), { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    items.forEach((n) => io.observe(n));
  }

  // ---------- number count-up (final text is already in the HTML) ----------
  function countUp(n) {
    const end = Number(n.getAttribute('data-count'));
    if (!Number.isFinite(end) || reduce) return;
    const fmt = (v) => Math.round(v).toLocaleString('en-US');
    const t0 = performance.now(), dur = 1400;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      n.textContent = fmt(end * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // ---------- HUD "decode" text ----------
  function decode() {
    if (reduce) return;
    const GLYPHS = '01·/\\<>=+*#%NASAFIHRIST';
    document.querySelectorAll('[data-decode]').forEach((n) => {
      const final = n.textContent;
      n.setAttribute('aria-label', final);
      const t0 = performance.now(), dur = 1100;
      const step = (t) => {
        const k = Math.min(1, (t - t0) / dur);
        const shown = Math.floor(final.length * k);
        let s = final.slice(0, shown);
        for (let i = shown; i < final.length; i++) s += final[i] === ' ' ? ' ' : GLYPHS[(Math.random() * GLYPHS.length) | 0];
        n.textContent = s;
        if (k < 1) requestAnimationFrame(step); else n.textContent = final;
      };
      requestAnimationFrame(step);
    });
  }

  // ---------- active tab while scrolling ----------
  function activeTabs() {
    const tabs = [...document.querySelectorAll('.tab')];
    if (!('IntersectionObserver' in window)) return;
    const map = new Map(tabs.map((t) => [t.getAttribute('href').slice(1), t]));
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      tabs.forEach((t) => t.classList.remove('on'));
      map.get(e.target.id)?.classList.add('on');
    }), { rootMargin: '-45% 0px -50% 0px' });
    map.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
  }

  const start = () => { starmap(); reveals(); decode(); activeTabs(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
