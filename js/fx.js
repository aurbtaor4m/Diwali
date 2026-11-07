// =============================================================================
// fx.js — effects: particles, fireworks, shake, fire waves, sparks, lightning.
//
// THE BIG IDEA: every effect here is a *pure function of time*.
//
// A typical game (like reference/js/ui.js) keeps a list of particles and moves
// them a little every frame: `p.x += p.vx * dt`. That's "simulation". It's
// easy, but it means frame 400 depends on frames 0..399 having run first,
// with the same random numbers. You can't jump straight to frame 400, and
// recording would differ from preview if any frame was skipped.
//
// Instead, we compute each particle's position directly from physics:
//     x(age) = x0 + vx*age
//     y(age) = y0 + vy*age + ½·g·age²
// and every "random" choice comes from hash(particleIndex, seed), which always
// returns the same number for the same inputs. So drawing frame 400 gives the
// identical picture whether you played up to it, scrubbed to it, or exported.
//
// Pixel crispness: we never use ctx.arc()/ctx.lineTo() for effects, because
// canvas anti-aliases those into blurry half-transparent edges. Everything is
// drawn with fillRect on whole pixels (Bresenham lines, span-filled discs).
// =============================================================================
(function (root) {
  'use strict';

  const W = 480, H = 270; // internal resolution (see main.js)

  // ------------------------------------------------------------------ maths
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };      // smoothstep
  const easeOut = (t) => { t = clamp(t); return 1 - (1 - t) * (1 - t) * (1 - t); };
  const easeIn = (t) => { t = clamp(t); return t * t * t; };
  const easeOutBack = (t) => { t = clamp(t); const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  // seg(p, a, b): remap p so that a→0 and b→1, clamped. The workhorse of the
  // timeline: "this thing animates during 20%..50% of the scene" = seg(p,.2,.5)
  const seg = (p, a, b) => clamp((p - a) / (b - a));

  // ------------------------------------------------------- seeded randomness
  // mulberry32: a tiny, fast PRNG. Same seed → same sequence, every time.
  function mulberry32(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // hash(a, b, c): stateless random number in [0, 1) from up to 3 integers.
  // Use it like hash(particleIndex, seed, channel) — e.g. channel 0 for
  // angle, channel 1 for speed — so each property gets its own random value.
  function hash(a, b = 0, c = 0) {
    let h = Math.imul((a | 0) ^ 0x9E3779B9, 0x85EBCA6B);
    h = Math.imul(h ^ (b | 0) ^ (h >>> 13), 0xC2B2AE35);
    h = Math.imul(h ^ (c | 0) ^ (h >>> 16), 0x27D4EB2F);
    h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  const hrange = (lo, hi, a, b, c) => lo + (hi - lo) * hash(a, b, c);

  // ------------------------------------------------------ pixel primitives
  function px(ctx, x, y, col, s = 1) {
    ctx.fillStyle = col;
    ctx.fillRect(Math.round(x), Math.round(y), s, s);
  }

  // Bresenham's line algorithm: steps one pixel at a time so the line is
  // made of whole, solid pixels (no anti-aliasing).
  function line(ctx, x0, y0, x1, y1, col, s = 1) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    ctx.fillStyle = col;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    const o = Math.floor(s / 2);
    for (let guard = 0; guard < 2000; guard++) {
      ctx.fillRect(x0 - o, y0 - o, s, s);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  // Filled circle drawn as horizontal spans (one fillRect per row).
  function disc(ctx, cx, cy, r, col) {
    cx = Math.round(cx); cy = Math.round(cy);
    if (r < 0.5) { px(ctx, cx, cy, col); return; }
    ctx.fillStyle = col;
    const R = Math.round(r);
    for (let dy = -R; dy <= R; dy++) {
      const half = Math.floor(Math.sqrt(r * r - dy * dy) + 0.5);
      if (half >= 0) ctx.fillRect(cx - half, cy + dy, half * 2 + 1, 1);
    }
  }

  // Pixel-art glow: a few concentric discs, each faint. They overlap so the
  // centre is brightest, giving visible "bands" — a classic retro look.
  function glow(ctx, cx, cy, r, col, a = 0.5, steps = 4) {
    const base = ctx.globalAlpha;
    for (let k = steps; k >= 1; k--) {
      ctx.globalAlpha = base * a / steps;
      disc(ctx, cx, cy, (r * k) / steps, col);
    }
    ctx.globalAlpha = base;
  }

  // Full-screen colour wash (white flash, fade to black...).
  function flash(ctx, a, col = '#f4f4f4') {
    if (a <= 0) return;
    const base = ctx.globalAlpha;
    ctx.globalAlpha = base * clamp(a);
    ctx.fillStyle = col;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = base;
  }

  // Vertical gradient made of solid horizontal bands (no smooth gradient —
  // banding is part of the pixel-art look). cols = top→bottom colours.
  function bands(ctx, y0, y1, cols) {
    const n = cols.length;
    const h = (y1 - y0) / n;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = cols[i];
      ctx.fillRect(0, Math.floor(y0 + i * h), W, Math.ceil(h) + 1);
    }
  }

  // ----------------------------------------------------------------- shake
  // Returns an integer {x, y} offset. Strength decays linearly from `power`
  // at time t0 to 0 at t0+dur. Changes every frame (1/30 s) via the hash.
  function shake(t, t0, dur, power, seed = 1) {
    if (t < t0 || t > t0 + dur) return { x: 0, y: 0 };
    const k = power * (1 - (t - t0) / dur);
    const f = Math.floor(t * 30);
    return {
      x: Math.round((hash(f, seed, 1) - 0.5) * 2 * k),
      y: Math.round((hash(f, seed, 2) - 0.5) * 2 * k),
    };
  }

  // ------------------------------------------------------------- particles
  // emit(): a continuous particle emitter, computed analytically.
  // Particle i is born at time i/rate. At time t we only draw the ones still
  // alive (born within the last `life` seconds).
  //
  // o = {
  //   x, y        : spawn point — numbers, or functions of birth time (b) for
  //                 a moving source (e.g. the arrow's spark trail)
  //   spread      : random spawn jitter (px) around x,y   [or spreadX/spreadY]
  //   rate        : particles per second
  //   life        : seconds each particle lives (± 40% random)
  //   vx, vy      : [min, max] initial velocity (px/s)
  //   g           : gravity (px/s², positive = down)
  //   cols        : colours picked per particle (or by age if byAge = true)
  //   size        : pixel size (or [min,max])
  //   t0, t1      : only emit between these times
  //   seed        : makes two emitters with the same settings look different
  //   kind        : 'dot' | 'smoke' (growing soft blob) | 'spark' (dot+tail)
  //   fade        : fade out over the last part of life (default true)
  //   flicker     : 0..1 chance a particle blinks off in a given frame
  // }
  function emit(ctx, t, o) {
    const rate = o.rate || 30, life = o.life || 1, seed = o.seed || 7;
    const t0 = o.t0 ?? 0, t1 = o.t1 ?? 1e9;
    const first = Math.max(Math.ceil(t0 * rate), Math.ceil((t - life * 1.4) * rate));
    const last = Math.floor(Math.min(t, t1) * rate);
    const cols = o.cols || ['#ffcd75'];
    const frame = Math.floor(t * 30);
    const base = ctx.globalAlpha;
    for (let i = first; i <= last; i++) {
      const b = i / rate;                                 // birth time
      const L = life * (0.6 + 0.8 * hash(i, seed, 9));    // this particle's life
      const age = t - b;
      if (age < 0 || age > L) continue;
      if (o.flicker && hash(i, seed, frame) < o.flicker) continue;
      const sx = typeof o.x === 'function' ? o.x(b) : o.x;
      const sy = typeof o.y === 'function' ? o.y(b) : o.y;
      const spx = o.spreadX ?? o.spread ?? 0, spy = o.spreadY ?? o.spread ?? 0;
      const x0 = sx + (hash(i, seed, 1) - 0.5) * spx;
      const y0 = sy + (hash(i, seed, 2) - 0.5) * spy;
      const vx = o.vx ? hrange(o.vx[0], o.vx[1], i, seed, 3) : 0;
      const vy = o.vy ? hrange(o.vy[0], o.vy[1], i, seed, 4) : 0;
      const g = o.g || 0;
      const x = x0 + vx * age;
      const y = y0 + vy * age + 0.5 * g * age * age;
      const k = age / L; // 0 → 1 over the particle's life
      const col = o.byAge ? cols[Math.min(cols.length - 1, Math.floor(k * cols.length))]
        : cols[Math.floor(hash(i, seed, 5) * cols.length)];
      const size = Array.isArray(o.size) ? Math.round(hrange(o.size[0], o.size[1], i, seed, 6)) : (o.size || 1);
      ctx.globalAlpha = base * (o.fade === false ? 1 : clamp((1 - k) * 2.5));
      if (o.kind === 'smoke') {
        // grows as it rises, very transparent
        ctx.globalAlpha *= o.alpha ?? 0.35;
        disc(ctx, x, y, size * (0.6 + k * 1.4), col);
      } else if (o.kind === 'spark') {
        // a dot plus a 1-pixel tail pointing back along its velocity
        px(ctx, x, y, col, size);
        px(ctx, x - vx * 0.03, y - (vy + g * age) * 0.03, col, 1);
      } else {
        px(ctx, x, y, col, size);
      }
    }
    ctx.globalAlpha = base;
  }

  // burst(): a one-shot explosion of n particles from (x, y) at age seconds.
  // Uses air drag so particles fly out fast then slow down — that "pop" feel.
  //   o = { x, y, n, power, g, life, cols, seed, size, drag, trail }
  function burst(ctx, age, o) {
    if (age < 0) return;
    const n = o.n || 24, life = o.life || 1.2, seed = o.seed || 3;
    const drag = o.drag ?? 2.2;          // higher = stops sooner
    const g = o.g ?? 30;
    const cols = o.cols || ['#ffcd75', '#f4f4f4'];
    const frame = Math.floor((o.tAbs ?? age) * 30);
    const base = ctx.globalAlpha;
    // position along a dragged trajectory: distance = v·(1 - e^(-drag·t))/drag
    const travel = (v, a) => (v * (1 - Math.exp(-drag * a))) / drag;
    for (let i = 0; i < n; i++) {
      const L = life * (0.7 + 0.5 * hash(i, seed, 9));
      if (age > L) continue;
      // evenly spaced angles + a little jitter = a nice round burst
      const ang = (i / n) * Math.PI * 2 + (hash(i, seed, 1) - 0.5) * 0.5;
      const spd = (o.power || 90) * (0.55 + 0.45 * hash(i, seed, 2));
      const vx = Math.cos(ang) * spd, vy = Math.sin(ang) * spd;
      const k = age / L;
      const col = cols[Math.floor(hash(i, seed, 3) * cols.length)];
      // twinkle at the end of life
      if (k > 0.6 && hash(i, seed, frame) < (k - 0.6) * 1.5) continue;
      ctx.globalAlpha = base * clamp((1 - k) * 2);
      const tr = o.trail ?? 3; // draw a few points back in time = streaks
      for (let j = tr; j >= 0; j--) {
        const a = Math.max(0, age - j * 0.035);
        const x = o.x + travel(vx, a);
        const y = o.y + travel(vy, a) + 0.5 * g * a * a;
        px(ctx, x, y, j === 0 ? (o.head || col) : col, j === 0 ? (o.size || 1) : 1);
      }
    }
    ctx.globalAlpha = base;
  }

  // firework(): rocket rises from (x, yGround) to (x+drift, yTop) over `rise`
  // seconds, then bursts. t = time since launch.
  //   o = { x, yGround, yTop, rise, drift, cols, n, power, seed, ring }
  function firework(ctx, t, o) {
    if (t < 0) return;
    const rise = o.rise ?? 0.7;
    const seed = o.seed || 11;
    const xTop = o.x + (o.drift || 0);
    if (t < rise) {
      // rocket head + sparkly trail falling behind it
      const k = easeOut(t / rise);
      const x = lerp(o.x, xTop, k), y = lerp(o.yGround, o.yTop, k);
      emit(ctx, t, {
        x: (b) => lerp(o.x, xTop, easeOut(b / rise)), y: (b) => lerp(o.yGround, o.yTop, easeOut(b / rise)),
        rate: 60, life: 0.35, vx: [-8, 8], vy: [0, 20], g: 40, t1: rise,
        cols: ['#ffcd75', '#ef7d57', '#e6a33c'], seed: seed + 1, flicker: 0.2,
      });
      px(ctx, x - 1, y - 1, '#f4f4f4', 2);
      return;
    }
    const age = t - rise;
    // brief bright core at the burst point
    if (age < 0.12) glow(ctx, xTop, o.yTop, 10, '#f4f4f4', 0.7, 3);
    burst(ctx, age, {
      x: xTop, y: o.yTop, n: o.n || 36, power: o.power || 110, g: 25, life: o.life || 1.4,
      cols: o.cols || ['#ef7d57', '#ffcd75', '#41a6f6'], seed, trail: 4, drag: 2.4, tAbs: t, head: '#f4f4f4',
    });
    if (o.ring) {
      // optional inner ring of a second colour (two-tone shells look great)
      burst(ctx, age, {
        x: xTop, y: o.yTop, n: 18, power: (o.power || 110) * 0.5, g: 25, life: 1.0,
        cols: [o.ring], seed: seed + 50, trail: 2, drag: 2.4, tAbs: t,
      });
    }
  }

  // anaar(): the cone-shaped "flower pot" fountain firework.
  //   t = time since lit; o = { x, y, height, t1 (when it stops), seed }
  function anaar(ctx, t, o) {
    if (t < 0) return;
    const hgt = o.height || 80;
    const v = Math.sqrt(2 * 160 * hgt); // speed needed to reach `height` with g=160
    const ramp = clamp(t / 0.3);          // fountain grows in over 0.3 s
    emit(ctx, t, {
      x: o.x, y: o.y, rate: 140, life: 1.1, g: 160, kind: 'spark', t1: o.t1 ?? 99,
      vx: [-28 * ramp, 28 * ramp], vy: [-v * ramp, -v * 0.6 * ramp],
      cols: ['#f4f4f4', '#ffcd75', '#ffcd75', '#e6a33c', '#ef7d57'], seed: o.seed || 21,
      flicker: 0.15,
    });
    // the clay pot itself
    disc(ctx, o.x, o.y + 3, 3, '#8b5a3c');
    ctx.fillStyle = '#4f2f23'; ctx.fillRect(Math.round(o.x) - 3, Math.round(o.y) + 5, 7, 1);
    glow(ctx, o.x, o.y, 6, '#ffcd75', 0.6, 3);
  }

  // ---------------------------------------------------------------- fire
  // fireWall(): layered sine-wave fire bands that sweep across the screen.
  //   front : x position of the leading edge (fire exists left of it)
  //   o     = { baseY, layers: [{col, h, amp, freq, speed, phase}], ... }
  // Each layer is a row of 2-px-wide columns whose height wobbles with two
  // summed sine waves. Back layers are taller and darker (red), front layers
  // shorter and brighter (yellow) — that's what makes it read as flame.
  function fireWall(ctx, t, front, o) {
    const baseY = o.baseY ?? H;
    const layers = o.layers || [
      { col: '#b13e53', h: 150, amp: 22, freq: 0.045, speed: 5.0, phase: 0 },
      { col: '#ef7d57', h: 110, amp: 18, freq: 0.06, speed: 6.5, phase: 2 },
      { col: '#ffcd75', h: 70, amp: 14, freq: 0.08, speed: 8.0, phase: 4 },
      { col: '#f4f4f4', h: 30, amp: 8, freq: 0.11, speed: 9.5, phase: 1 },
    ];
    const scale = o.scale ?? 1; // shrink the whole fire (used when it calms)
    for (const Ly of layers) {
      ctx.fillStyle = Ly.col;
      for (let x = 0; x < W; x += 2) {
        // flame leans/tapers to nothing over the last 60 px before the front
        const edge = clamp((front - x) / 60);
        if (edge <= 0) continue;
        const wob = Math.sin(x * Ly.freq + t * Ly.speed + Ly.phase) * Ly.amp
          + Math.sin(x * Ly.freq * 2.3 - t * Ly.speed * 1.3 + Ly.phase) * Ly.amp * 0.5;
        const hgt = Math.max(0, (Ly.h + wob) * edge * scale);
        // quantise to 2-px steps so the top edge looks chunky, not smooth
        const hq = Math.round(hgt / 2) * 2;
        ctx.fillRect(x, baseY - hq, 2, hq);
      }
    }
  }

  // ------------------------------------------------------------- lightning
  // lightning(): a jagged electric arc between two points.
  // Built with "midpoint displacement": take the middle of the segment, push
  // it sideways by a random amount, then repeat on each half. `seed` should
  // change every couple of frames so the arc crackles.
  function lightning(ctx, x0, y0, x1, y1, seed, o = {}) {
    const pts = [[x0, y0], [x1, y1]];
    let amp = o.amp ?? 10;
    for (let depth = 0; depth < (o.depth ?? 4); depth++) {
      for (let i = pts.length - 1; i > 0; i--) {
        const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
        const mx = (ax + bx) / 2, my = (ay + by) / 2;
        // perpendicular direction to the segment
        const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
        const off = (hash(i, seed, depth) - 0.5) * 2 * amp;
        pts.splice(i, 0, [mx - (dy / len) * off, my + (dx / len) * off]);
      }
      amp *= 0.55;
    }
    const outer = o.col || '#41a6f6', core = o.core || '#f4f4f4';
    const base = ctx.globalAlpha;
    ctx.globalAlpha = base * 0.5;
    for (let i = 1; i < pts.length; i++) line(ctx, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], outer, 3);
    ctx.globalAlpha = base;
    for (let i = 1; i < pts.length; i++) line(ctx, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], o.mid || '#73eff7', 1);
    // bright core only on alternate segments — makes it flicker internally
    for (let i = 2; i < pts.length; i += 2) line(ctx, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], core, 1);
  }

  // ----------------------------------------------------------- speed lines
  // Anime-style radial "focus lines" pointing at (cx, cy). Each line starts
  // off-screen and reaches inward to a random radius; they re-randomise every
  // 2 frames so the background feels like it's rushing.
  function speedLines(ctx, t, cx, cy, o = {}) {
    const n = o.n || 70;
    const tick = Math.floor(t * 15);
    const rIn = o.rIn ?? 70;
    const cols = o.cols || ['#f4f4f4', '#94b0c2'];
    const base = ctx.globalAlpha;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + hash(i, tick, 1) * 0.08;
      const r0 = rIn + hash(i, tick, 2) * 80;
      const r1 = 400;
      ctx.globalAlpha = base * (o.alpha ?? 0.8);
      const w = hash(i, tick, 3) < 0.3 ? 2 : 1;
      line(ctx, cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0,
        cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1, cols[i % cols.length], w);
    }
    ctx.globalAlpha = base;
  }

  // ---------------------------------------------------------------- stars
  // Static star field with deterministic twinkle.
  function stars(ctx, t, o = {}) {
    const n = o.n || 80, seed = o.seed || 5, maxY = o.maxY ?? H * 0.6;
    for (let i = 0; i < n; i++) {
      const x = Math.floor(hash(i, seed, 1) * W);
      const y = Math.floor(hash(i, seed, 2) * maxY);
      const tw = Math.sin(t * (2 + hash(i, seed, 3) * 4) + i) * 0.5 + 0.5;
      const big = hash(i, seed, 4) < 0.12;
      const col = tw > 0.75 ? '#f4f4f4' : tw > 0.35 ? '#94b0c2' : '#566c86';
      px(ctx, x, y, col);
      if (big && tw > 0.6) { // little 4-point twinkle cross
        px(ctx, x - 1, y, '#566c86'); px(ctx, x + 1, y, '#566c86');
        px(ctx, x, y - 1, '#566c86'); px(ctx, x, y + 1, '#566c86');
      }
    }
  }

  root.FX = {
    W, H,
    clamp, lerp, ease, easeOut, easeIn, easeOutBack, seg,
    mulberry32, hash, hrange,
    px, line, disc, glow, flash, bands,
    shake, emit, burst, firework, anaar, fireWall, lightning, speedLines, stars,
  };
})(window);
