// =============================================================================
// scenes.js — one function per scene.
//
// Every scene is an object: { name, dur, xfade, draw(ctx, p) }
//   dur   : length in seconds
//   xfade : seconds of crossfade FROM the previous scene into this one
//           (0 = hard cut)
//   draw  : paints ONE complete frame. `p` goes from 0 (first frame of the
//           scene) to 1 (last frame). It must not depend on anything except
//           p — no stored state, no Math.random() — so any frame can be
//           drawn at any time, in any order. That's what makes scrubbing and
//           frame-accurate recording possible.
//
// Inside a scene we usually convert p back to seconds (t = p * dur) because
// physics (gravity, speeds) is easier to think about in seconds.
// =============================================================================
(function (root) {
  'use strict';

  const { W, H, seg, ease, easeOut, easeIn, clamp, lerp, hash } = FX;

  // ===========================================================================
  // Scenery helpers — simple shapes made of whole-pixel rectangles.
  // ===========================================================================
  function rect(ctx, x, y, w, h, col) {
    ctx.fillStyle = col;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  // A pointed spire/roof: a stack of 1-px rows that get wider going down.
  function spire(ctx, cx, yTop, halfW, h, col) {
    ctx.fillStyle = col;
    for (let j = 0; j < h; j++) {
      const w = Math.round((halfW * (j + 1)) / h);
      ctx.fillRect(Math.round(cx) - w, Math.round(yTop) + j, w * 2 + 1, 1);
    }
  }

  // Onion dome (the bulb shape on Lanka's palace): a circle with a spike on top.
  function onion(ctx, cx, yBase, r, col) {
    FX.disc(ctx, cx, yBase - r, r, col);
    spire(ctx, cx, yBase - r * 2.6, r * 0.55, Math.round(r * 1.2), col);
    rect(ctx, cx, yBase - r * 2.6 - 3, 1, 3, col); // finial
  }

  // Checkerboard blend between two colour bands — the classic pixel-art way
  // to fake a gradient without adding colours.
  function dither(ctx, y0, y1, col) {
    ctx.fillStyle = col;
    for (let y = y0; y < y1; y++) {
      for (let x = (y & 1); x < W; x += 2) ctx.fillRect(x, y, 1, 1);
    }
  }

  // A torch flame: 3-pixel-tall flicker + glow. `i` keeps torches out of sync.
  function torch(ctx, x, y, t, i) {
    const f = Math.floor(t * 12);               // flame changes 12×/s
    const h1 = hash(f, i, 1) < 0.5 ? 1 : 0;
    FX.light(ctx, x, y - 2, 7 + h1 * 2, PAL.o, 0.35, 3);
    rect(ctx, x - 1, y - 2, 3, 2, PAL.r);
    rect(ctx, x, y - 3 - h1, 1, 2 + h1, PAL.o);
    rect(ctx, x, y - 1, 1, 1, PAL.y);
    rect(ctx, x, y, 1, 4, PAL.u);               // the torch stick
  }

  // ===========================================================================
  // SCENE 1 — RAVANA (0–4 s)
  // Dark blue night over Lanka. Ravana spins in (squash-flip), lands with a
  // screen shake, his twenty eyes ignite, smoke and embers rise.
  // ===========================================================================

  // Background: sky, moon, sea, the Lanka fortress on its cliff, foreground rock.
  function drawLanka(ctx, t) {
    // --- sky: deepest navy at the top, a little lighter at the horizon
    rect(ctx, 0, 0, W, 120, PAL.D);
    dither(ctx, 120, 128, PAL.n);
    rect(ctx, 0, 128, W, 70, PAL.n);
    FX.stars(ctx, t, { n: 70, seed: 3, maxY: 115 });

    // --- crescent moon: a white disc with a sky-coloured disc bitten out of it
    FX.glow(ctx, 70, 46, 26, PAL.s, 0.18, 4);
    FX.disc(ctx, 70, 46, 12, PAL.w);
    FX.disc(ctx, 76, 42, 11, PAL.D);

    // --- distant hills on the left (lighter = further away)
    ctx.fillStyle = PAL.e;
    for (let x = 0; x < 230; x += 2) {
      const y = 182 - Math.round(10 * Math.sin(x * 0.03) + 6 * Math.sin(x * 0.071 + 1));
      ctx.fillRect(x, y, 2, 200 - y);
    }

    // --- sea, with wave glints that drift sideways over time
    rect(ctx, 0, 196, W, 50, PAL.D);
    for (let i = 0; i < 60; i++) {
      const y = 198 + Math.floor(hash(i, 4, 1) * 40);
      const x = ((hash(i, 4, 2) * W + t * (8 + (y - 198) * 0.6)) % (W + 20)) - 10;
      const len = 3 + Math.floor(hash(i, 4, 3) * 6);
      rect(ctx, x, y, len, 1, y > 220 ? PAL.b : PAL.n);
    }
    // moon's reflection: broken white dashes under the moon
    for (let j = 0; j < 8; j++) {
      const wob = Math.round(Math.sin(t * 3 + j) * 2);
      rect(ctx, 64 + wob - (j % 3), 199 + j * 4, 8 - (j % 3) * 2, 1, j < 3 ? PAL.w : PAL.s);
    }

    // --- Lanka cliff (near-black) rising on the right
    ctx.fillStyle = PAL.k;
    for (let x = 210; x < W; x += 2) {
      const rise = clamp((x - 210) / 60);
      const y = Math.round(lerp(240, 172, easeOut(rise)) + 3 * Math.sin(x * 0.2));
      ctx.fillRect(x, y, 2, H - y);
    }

    // --- the fortress (dark slate, so it reads against both sky and cliff)
    const c = PAL.e;
    rect(ctx, 262, 148, 210, 28, c);                       // long outer wall
    for (let x = 262; x < 472; x += 6) rect(ctx, x, 145, 3, 3, c); // battlements
    // towers: [x, width, height, roof type]
    const towers = [[268, 12, 46, 's'], [296, 14, 62, 'o'], [330, 10, 80, 's'], [352, 30, 58, 'O'],
      [396, 12, 70, 's'], [420, 16, 52, 'o'], [448, 12, 66, 's']];
    for (const [x, w, h, roof] of towers) {
      rect(ctx, x, 176 - h, w, h, c);
      const cx = x + w / 2 - 0.5;
      if (roof === 's') spire(ctx, cx, 176 - h - 18, w / 2 + 1, 18, c);
      else onion(ctx, cx, 176 - h, roof === 'O' ? 16 : w / 2 + 2, c);
    }
    // glowing windows (a few flicker)
    const wins = [[272, 140], [300, 124], [306, 124], [334, 110], [360, 132], [366, 132], [372, 132],
      [400, 118], [424, 136], [452, 124], [452, 140], [300, 150], [366, 150]];
    wins.forEach(([x, y], i) => {
      const on = hash(Math.floor(t * 4), i, 9) > 0.15;
      rect(ctx, x, y, 2, 3, on ? PAL.o : PAL.r);
    });
    // torches along the wall
    [[262, 146], [318, 146], [386, 146], [440, 146], [470, 146]].forEach(([x, y], i) => torch(ctx, x, y, t, i));

    // --- foreground rock ledge where Ravana lands
    ctx.fillStyle = PAL.k;
    for (let x = 0; x < W; x += 2) {
      const y = 240 + Math.round(2 * Math.sin(x * 0.09) + 2 * Math.sin(x * 0.023 + 2));
      ctx.fillRect(x, y, 2, H - y);
      ctx.fillStyle = PAL.e; ctx.fillRect(x, y, 2, 1); ctx.fillStyle = PAL.k; // rim light
    }
  }

  function sceneRavana(ctx, p) {
    const t = p * 4;            // seconds into the scene
    const LAND = 1.45;          // moment his feet hit the ground
    const X = 240, GROUND = 242, S = 3; // final position and scale (48 px → 144 px)

    drawLanka(ctx, t);

    // Smoke behind him: dark, slow, translucent blobs creeping up from the
    // ground — the "darkness" gathering around Ravana.
    FX.emit(ctx, t, {
      x: X, y: GROUND + 4, spreadX: 260, spreadY: 6, rate: 16, life: 3.0, t0: -2,
      vx: [-8, 8], vy: [-16, -6], cols: [PAL.k, PAL.D, PAL.e], size: [9, 15], kind: 'smoke', alpha: 0.55, seed: 11,
    });

    // ---- the entrance: squash-flip spin while growing and dropping in
    let sx = S, sy = S, y = GROUND;
    if (t < LAND) {
      const k = seg(t, 0.15, LAND);         // 0→1 over the entrance
      const s = lerp(0.35, S, easeIn(k));   // grows (comes towards camera)
      // scaleX = cos(angle): 1 → 0 (edge-on) → -1 (mirrored) → 0 → 1 ...
      // Two full turns (4π). No ctx.rotate, so pixels stay perfectly square.
      sx = s * Math.cos(k * Math.PI * 4);
      sy = s;
      y = lerp(150, GROUND, easeIn(k));     // drops from the sky
      if (t < 0.15) sx = 0;                 // not visible yet
      // dark trail of afterimages while spinning
      for (let j = 1; j <= 2; j++) {
        const kj = seg(t - j * 0.05, 0.15, LAND);
        if (kj <= 0) continue;
        const sj = lerp(0.35, S, easeIn(kj));
        Sprites.draw(ctx, 'ravana', X, lerp(150, GROUND, easeIn(kj)),
          { sx: sj * Math.cos(kj * Math.PI * 4), sy: sj, mode: 'k', alpha: 0.5 / j });
      }
    } else {
      // landing squash: wider and shorter for an instant, springing back
      const q = seg(t, LAND, LAND + 0.3);
      const squash = q < 1 ? 0.18 * (1 - q) * Math.cos(q * Math.PI * 2) : 0;
      sx = S * (1 + squash);
      sy = S * (1 - squash);
      // idle breathing after he settles: 1 art-pixel up/down
      if (t > LAND + 0.6) y = GROUND - (Math.sin((t - LAND) * 3) > 0.3 ? 1 : 0);
    }
    if (sx !== 0) {
      // ground shadow
      ctx.save(); ctx.globalAlpha = 0.5;
      rect(ctx, X - 50 * Math.abs(sx) / S, GROUND - 2, 100 * Math.abs(sx) / S, 4, PAL.D);
      ctx.restore();
      Sprites.draw(ctx, 'ravana', X, y, { sx, sy });
      // white hit-flash on the landing frame
      if (t >= LAND && t < LAND + 0.07) Sprites.draw(ctx, 'ravana', X, y, { sx, sy, mode: 'w', alpha: 0.8 });
    }

    // ---- landing impact: dust burst + ember burst + a dark-red sky flash
    if (t >= LAND) {
      const age = t - LAND;
      FX.burst(ctx, age, { x: X - 40, y: GROUND, n: 22, power: 130, g: 260, life: 0.9, cols: [PAL.e, PAL.d, PAL.s], seed: 31, trail: 1 });
      FX.burst(ctx, age, { x: X + 40, y: GROUND, n: 22, power: 130, g: 260, life: 0.9, cols: [PAL.e, PAL.d, PAL.s], seed: 32, trail: 1 });
      FX.burst(ctx, age, { x: X, y: GROUND - 20, n: 30, power: 170, g: 120, life: 1.2, cols: [PAL.o, PAL.y, PAL.r], seed: 33, trail: 3 });
    }

    // ---- red eyes: ignite 0.4 s after landing, then pulse
    const eyeOn = seg(t, LAND + 0.35, LAND + 0.75);
    if (eyeOn > 0 && sx !== 0) {
      const pulse = 0.75 + 0.25 * Math.sin(t * 9);
      for (const e of Sprites.points('ravana', 'E', X, y, sx, sy)) {
        FX.light(ctx, e.x, e.y, 5, PAL.E, 0.55 * eyeOn * pulse, 3);
        FX.px(ctx, e.x - 1, e.y - 1, PAL.w, 2);
      }
    }

    // Embers: hot sparks drifting upward in front of everything.
    FX.emit(ctx, t, {
      x: X, y: GROUND, spreadX: 300, spreadY: 10, rate: 40, life: 2.2,
      vx: [-12, 12], vy: [-55, -25], g: -4, cols: [PAL.o, PAL.y, PAL.r, PAL.E], size: [1, 2], flicker: 0.25, seed: 12,
      t0: -2,
    });

    // Screen shake: a hard jolt on landing, decaying over 0.7 s.
    FX.shakeFrame(ctx, FX.shake(t, LAND, 0.7, 7, 1));

    // Flash of dark red over the whole screen at the landing (no shake on it).
    if (t >= LAND) FX.flash(ctx, 0.35 * (1 - seg(t, LAND, LAND + 0.4)), PAL.m);
  }

  // ===========================================================================
  // SCENE 2 — RAMA (4–12 s), three cuts:
  //   A 0.0–2.4  Rama strides in from the left over anime speed lines (2×)
  //   B 2.4–5.4  close-up (3×): he draws the bow, blue lightning crackles
  //              along the string
  //   C 5.4–8.0  release, then a tracking shot of the arrow flying with a
  //              golden sparkler trail and afterimages (motion blur)
  // ===========================================================================
  const CUT_B = 2.4, CUT_C = 5.4;

  function sceneRama(ctx, p) {
    const t = p * 8;
    if (t < CUT_B) ramaWalkIn(ctx, t);
    else if (t < CUT_C) ramaDraw(ctx, t - CUT_B);
    else ramaRelease(ctx, t - CUT_C);
  }

  // --- Cut A: the hero walks in ------------------------------------------------
  function ramaWalkIn(ctx, t) {
    const S = 2, GROUND = 222;
    // background: blue with a bright core, radial speed lines pointing at Rama
    rect(ctx, 0, 0, W, H, PAL.n);
    FX.glow(ctx, 240, 150, 170, PAL.b, 0.9, 5);
    FX.glow(ctx, 240, 150, 60, PAL.c, 0.5, 3);
    FX.speedLines(ctx, t, 240, 150, { n: 90, rIn: 95, cols: [PAL.w, PAL.a, PAL.c], alpha: 0.75 });

    // position: eases from off-screen left to the centre, arriving at 1.5 s
    const k = seg(t, 0, 1.5);
    const x = lerp(-40, 232, easeOut(k));
    const moving = k < 1;
    // walk cycle: swap legs every 0.14 s while moving; step frames bob 1 art px
    const stepFrame = moving && Math.floor(t / 0.14) % 2 === 1;
    const y = GROUND - (stepFrame ? S : 0);

    // ground shadow
    ctx.save(); ctx.globalAlpha = 0.45;
    rect(ctx, x - 24, GROUND - 2, 48, 4, PAL.D);
    ctx.restore();
    // dust kicked up at his heels while walking
    FX.emit(ctx, t, {
      x: (b) => lerp(-40, 232, easeOut(seg(b, 0, 1.5))) - 10, y: GROUND - 2, t1: 1.4, rate: 18, life: 0.5,
      vx: [-40, -10], vy: [-30, -8], g: 60, cols: [PAL.s, PAL.w, PAL.d], size: [1, 2], seed: 41,
    });
    Sprites.draw(ctx, stepFrame ? 'rama_step' : 'rama_stand', x, y, { s: S });

    // once he stops: a glint runs up the crown, then a 4-point star twinkles
    if (t > 1.6) {
      const g = seg(t, 1.6, 2.0);
      const top = Sprites.at('rama_stand', 14, 4, x, y, S, S);
      const s = Math.round(Math.sin(g * Math.PI) * 6);
      if (s > 0) {
        FX.line(ctx, top.x - s, top.y, top.x + s, top.y, PAL.w);
        FX.line(ctx, top.x, top.y - s, top.x, top.y + s, PAL.w);
        FX.glow(ctx, top.x, top.y, 6, PAL.y, 0.6, 2);
      }
    }
  }

  // Screen positions of the bowstring's three points for rama_draw.
  function bowPoints(X, Y, S) {
    return {
      top: Sprites.at('rama_draw', 26, 4, X, Y, S, S),
      bot: Sprites.at('rama_draw', 26, 38, X, Y, S, S),
      nock: Sprites.at('rama_draw', 16, 20, X, Y, S, S),
    };
  }

  // --- Cut B: close-up, drawing the bow --------------------------------------
  function ramaDraw(ctx, u) {
    const S = 3, X = 196, Y = 262;
    const power = seg(u, 0.4, 2.6);               // charge builds up 0 → 1
    // dark backdrop; slow, dim speed lines; a blue aura that grows with power
    rect(ctx, 0, 0, W, H, PAL.D);
    FX.speedLines(ctx, u * 0.5, X + 40, 150, { n: 60, rIn: 120, cols: [PAL.n, PAL.b], alpha: 0.6 });
    FX.glow(ctx, X + 30, 160, 60 + power * 70, PAL.b, 0.35 + power * 0.3, 5);

    // the bow trembles by one pixel as tension peaks
    const tr = power > 0.7 ? (hash(Math.floor(u * 30), 7) < 0.5 ? -1 : 1) : 0;
    Sprites.draw(ctx, 'rama_draw', X + tr, Y, { s: S });
    const bp = bowPoints(X + tr, Y, S);

    // the string: two straight segments from the bow tips to his hand
    FX.line(ctx, bp.top.x, bp.top.y, bp.nock.x, bp.nock.y, PAL.w, 1);
    FX.line(ctx, bp.bot.x, bp.bot.y, bp.nock.x, bp.nock.y, PAL.w, 1);
    // the nocked arrow, held at the string
    Sprites.draw(ctx, 'arrow', bp.nock.x - 4, bp.nock.y - 7, { s: S, anchor: 'tl' });

    // electric arcs crackling along the string — reseeded every 2 frames
    if (power > 0) {
      const seed = Math.floor(u * 15);
      const amp = 3 + power * 7;
      ctx.save(); ctx.globalAlpha = clamp(power * 2);
      FX.lightning(ctx, bp.top.x, bp.top.y, bp.nock.x, bp.nock.y, seed, { amp });
      FX.lightning(ctx, bp.nock.x, bp.nock.y, bp.bot.x, bp.bot.y, seed + 99, { amp });
      // stray arcs leaping off the bow limbs
      if (power > 0.4) {
        for (let i = 0; i < 2; i++) {
          const from = i ? bp.top : bp.bot;
          const ang = hash(seed, i, 5) * Math.PI * 2;
          const len = 14 + hash(seed, i, 6) * 18 * power;
          FX.lightning(ctx, from.x, from.y, from.x + Math.cos(ang) * len, from.y + Math.sin(ang) * len, seed + i * 7, { amp: 5, depth: 3 });
        }
      }
      ctx.restore();
      // blue sparks drifting off the string
      FX.emit(ctx, u, {
        x: (b) => lerp(bp.top.x, bp.nock.x, hash(Math.floor(b * 60), 3)), y: (b) => lerp(bp.top.y, bp.bot.y, hash(Math.floor(b * 60), 4)),
        t0: 0.6, rate: 40 * power + 5, life: 0.5, vx: [-30, 30], vy: [-40, 10], g: 40,
        cols: [PAL.a, PAL.c, PAL.w], seed: 51, kind: 'spark',
      });
      // the arrowhead gathers light
      const tip = { x: bp.nock.x - 4 + 15 * S, y: bp.nock.y };
      FX.light(ctx, tip.x, tip.y, 6 + power * 10, PAL.a, 0.6 * power, 3);
      if (power > 0.9) FX.px(ctx, tip.x - 1, tip.y - 1, PAL.w, 3);
    }
    // a white flash right at the end bridges into the release cut
    FX.flash(ctx, seg(u, 2.85, 3.0) * 0.9, PAL.w);
  }

  // --- Cut C: release + the arrow in flight ----------------------------------
  function ramaRelease(ctx, v) {
    const REL = 0.4; // seconds of the release moment before the tracking shot
    if (v < REL) {
      // same close-up framing as cut B, string snaps back and vibrates
      const S = 3, X = 196, Y = 262;
      rect(ctx, 0, 0, W, H, PAL.D);
      FX.speedLines(ctx, v + 3, X + 40, 150, { n: 80, rIn: 70, cols: [PAL.c, PAL.a, PAL.w], alpha: 0.7 });
      Sprites.draw(ctx, 'rama_draw', X, Y, { s: S });
      const bp = bowPoints(X, Y, S);
      // string now straight between the tips, wobbling with decaying amplitude
      const wob = Math.round(Math.sin(v * 90) * 5 * (1 - v / REL));
      const midX = bp.top.x + wob, midY = (bp.top.y + bp.bot.y) / 2;
      FX.line(ctx, bp.top.x, bp.top.y, midX, midY, PAL.w, 1);
      FX.line(ctx, midX, midY, bp.bot.x, bp.bot.y, PAL.w, 1);
      // the arrow leaves at high speed with afterimages and sparks
      const ax = bp.nock.x - 4 + v * 1500, ay = bp.nock.y - 7;
      for (let j = 3; j >= 1; j--) Sprites.draw(ctx, 'arrow', ax - j * 30, ay, { s: S, anchor: 'tl', mode: 'w', alpha: 0.35 / j });
      Sprites.draw(ctx, 'arrow', ax, ay, { s: S, anchor: 'tl' });
      FX.burst(ctx, v, { x: bp.nock.x + 40, y: bp.nock.y, n: 26, power: 200, g: 60, life: 0.4, cols: [PAL.y, PAL.w, PAL.q], seed: 61, trail: 3 });
      FX.flash(ctx, (1 - v / 0.1) * 0.9, PAL.w); // continues the white flash from cut B
      FX.shakeFrame(ctx, FX.shake(v, 0, 0.3, 4, 3));
      return;
    }

    // ---- tracking shot: the camera flies alongside the arrow
    const w = v - REL;                 // 0 → 2.2
    const S = 4;
    rect(ctx, 0, 0, W, H, PAL.D);
    dither(ctx, 180, 188, PAL.n);
    rect(ctx, 0, 188, W, H - 188, PAL.n);
    // background streaks rush left — that's what sells the speed
    for (let i = 0; i < 70; i++) {
      const y = Math.floor(hash(i, 70, 1) * H);
      const speed = 500 + hash(i, 70, 2) * 900;
      const len = 10 + Math.floor(hash(i, 70, 3) * 50);
      const x = W - ((hash(i, 70, 4) * (W + 200) + w * speed) % (W + 200)) + 50;
      rect(ctx, x, y, len, 1, i % 4 === 0 ? PAL.c : i % 3 === 0 ? PAL.s : PAL.b);
    }

    // arrow position: drifts right slowly, then rockets off-screen at the end
    const out = seg(w, 1.95, 2.2);
    const ax = lerp(120, 250, ease(seg(w, 0, 1.9))) + easeIn(out) * 320;
    const ay = 128 + Math.round(Math.sin(w * 6) * 2);
    const tail = { x: ax, y: ay + 2 * S + 2 };     // fletching end of the arrow
    const head = { x: ax + 16 * S, y: tail.y };

    // golden phuljhadi (sparkler) trail streaming back from the tail.
    // The arrow barely moves on screen, so the sparks get a big leftward
    // velocity — the world is rushing past.
    FX.emit(ctx, w, {
      x: tail.x + 4, y: tail.y, spread: 4, t0: -0.6, rate: 220, life: 0.55,
      vx: [-420, -160], vy: [-70, 70], g: 140, kind: 'spark',
      cols: [PAL.w, PAL.y, PAL.y, PAL.q, PAL.o], seed: 71, flicker: 0.2,
    });
    // afterimages — fading white copies left behind = motion blur
    for (let j = 4; j >= 1; j--) Sprites.draw(ctx, 'arrow', ax - j * 18, ay, { s: S, anchor: 'tl', mode: 'w', alpha: 0.28 / j });
    FX.light(ctx, tail.x + 4, tail.y, 9, PAL.o, 1.2, 3);
    Sprites.draw(ctx, 'arrow', ax, ay, { s: S, anchor: 'tl' });
    // hot white point at the arrowhead
    FX.light(ctx, head.x, head.y, 7, PAL.y, 1.3, 3);
    FX.px(ctx, head.x - 1, head.y - 1, PAL.w, 3);
  }

  // ===========================================================================
  // SCENE 3 — VICTORY BURST (12–17 s)
  //   0.00–0.15  the arrow streaks in and strikes Ravana
  //   0.15–0.55  white flash, big shake, Ravana flickers white
  //   0.55       he bursts into golden light
  //   0.50–1.90  layered sine-wave fire bands sweep across the whole screen
  //   1.90–2.80  the fire calms and sinks to a low glow
  //   2.00–5.00  fireworks: anaar fountains + rockets bursting overhead
  // ===========================================================================

  // One table describing every rocket in the show, so the timing is easy to
  // tweak: [launch time, x, burst height, colours, extra ring colour]
  const ROCKETS = [
    [2.0, 120, 70, [PAL.o, PAL.y, PAL.w], PAL.c],
    [2.25, 340, 55, [PAL.i, PAL.w, PAL.z], null],
    [2.55, 240, 40, [PAL.y, PAL.q, PAL.w], PAL.r],
    [2.85, 60, 95, [PAL.c, PAL.a, PAL.w], null],
    [3.1, 410, 80, [PAL.l, PAL.g, PAL.w], PAL.y],
    [3.35, 180, 60, [PAL.r, PAL.o, PAL.y], null],
    [3.6, 300, 90, [PAL.z, PAL.i, PAL.w], PAL.a],
    [3.85, 440, 45, [PAL.y, PAL.w, PAL.o], null],
    [4.05, 100, 50, [PAL.a, PAL.c, PAL.w], PAL.i],
    [4.3, 260, 75, [PAL.o, PAL.y, PAL.r], PAL.w],
  ];
  // anaar (fountain) positions along the ground and when each is lit
  const ANAARS = [[70, 2.1, 70], [190, 2.3, 95], [300, 2.2, 85], [420, 2.4, 75]];

  function sceneVictory(ctx, p) {
    const t = p * 5;
    const X = 240, GROUND = 242, S = 3;  // Ravana exactly where scene 1 left him
    const HIT = 0.15, BURST = 0.55;

    drawLanka(ctx, t + 4);   // +4 so stars/torches continue from scene 1

    // --- the arrow arrives (continuing left-to-right from scene 2)
    const chest = Sprites.at('ravana', 22, 25, X, GROUND, S, S);
    if (t < HIT) {
      const ax = lerp(-60, chest.x - 48, t / HIT);
      for (let j = 3; j >= 1; j--) Sprites.draw(ctx, 'arrow', ax - j * 20, chest.y - 7, { s: S, anchor: 'tl', mode: 'w', alpha: 0.3 / j });
      FX.emit(ctx, t, {
        x: (b) => lerp(-60, chest.x - 48, b / HIT), y: chest.y, t0: -0.3, t1: HIT, rate: 200, life: 0.4,
        vx: [-200, -60], vy: [-60, 60], g: 120, kind: 'spark', cols: [PAL.w, PAL.y, PAL.q], seed: 81,
      });
    }

    // --- Ravana: struck, flickering, then gone in a burst of light
    if (t < BURST) {
      const struck = t >= HIT;
      // flicker white every other frame after the hit, and get knocked back a bit
      const flick = struck && Math.floor(t * 30) % 2 === 0;
      const knock = struck ? Math.round(6 * Math.sin(seg(t, HIT, BURST) * Math.PI)) : 0;
      // he swells slightly just before bursting
      const swell = 1 + 0.12 * easeIn(seg(t, 0.3, BURST));
      Sprites.draw(ctx, 'ravana', X + knock, GROUND, { sx: S * swell, sy: S * swell, mode: flick ? 'w' : 'n' });
      if (struck) Sprites.draw(ctx, 'arrow', chest.x - 48 + knock, chest.y - 7, { s: S, anchor: 'tl' });
    }
    // --- the fire wall: sweeps in from the left, towers, then calms down
    // `front` = x of the leading edge; `scale` = overall flame height
    const front = lerp(-80, W + 140, easeOut(seg(t, 0.85, 1.6)));
    const rise = easeOut(seg(t, 0.85, 1.4));
    const calm = ease(seg(t, 1.75, 2.6));
    const scale = rise * lerp(1.9, 0.3, calm);
    if (scale > 0) FX.fireWall(ctx, t, front, { scale });

    // Ravana's burst of light — drawn OVER the fire so it stays visible
    if (t >= BURST) {
      const age = t - BURST;
      // three layered bursts: big golden ring, orange core, white sparks
      FX.light(ctx, X, GROUND - 70, 90 * (1 - seg(age, 0, 0.6)), PAL.y, 0.9, 4);
      FX.burst(ctx, age, { x: X, y: GROUND - 70, n: 70, power: 260, g: 50, life: 1.6, cols: [PAL.y, PAL.q, PAL.w], seed: 91, trail: 4, drag: 1.6, tAbs: t });
      FX.burst(ctx, age, { x: X, y: GROUND - 70, n: 40, power: 140, g: 80, life: 1.2, cols: [PAL.o, PAL.r, PAL.y], seed: 92, trail: 3, tAbs: t });
      FX.burst(ctx, age, { x: X, y: GROUND - 110, n: 30, power: 320, g: 30, life: 1.0, cols: [PAL.w], seed: 93, trail: 5, drag: 2.8, tAbs: t });
    }
    // flying embers off the top of the fire
    FX.emit(ctx, t, {
      x: W / 2, y: H - 20, spreadX: W, spreadY: 20, t0: 0.6, rate: 60, life: 1.6,
      vx: [-20, 20], vy: [-110, -40], g: -10, cols: [PAL.y, PAL.o, PAL.w], size: [1, 2], flicker: 0.3, seed: 94,
    });

    // --- fireworks (drawn over the fire so the sky show reads clearly)
    for (let i = 0; i < ROCKETS.length; i++) {
      const [t0, x, yTop, cols, ring] = ROCKETS[i];
      FX.firework(ctx, t - t0, {
        x, yGround: H - 30, yTop, drift: (hash(i, 5) - 0.5) * 30, rise: 0.65,
        cols, ring, n: 40, power: 95 + hash(i, 6) * 40, seed: 100 + i * 7, life: 1.5,
      });
      // each shell briefly tints the whole sky its colour as it bursts
      const ba = t - t0 - 0.65;
      if (ba >= 0 && ba < 0.15) FX.flash(ctx, 0.1 * (1 - ba / 0.15), cols[0]);
    }
    for (const [x, tLit, hgt] of ANAARS) {
      FX.anaar(ctx, t - tLit, { x, y: H - 14, height: hgt, seed: 200 + x });
    }

    // --- overlays (not shaken): white flash on impact, then the big shake
    FX.flash(ctx, 1 - seg(t, HIT, HIT + 0.35), PAL.w);
    FX.flash(ctx, 0.8 * (1 - seg(t, BURST, BURST + 0.25)) * (t >= BURST ? 1 : 0), PAL.y);
    let sh = FX.shake(t, HIT, 0.9, 10, 4);
    if (t >= BURST) { const s2 = FX.shake(t, BURST, 0.8, 8, 5); sh = { x: sh.x + s2.x, y: sh.y + s2.y }; }
    FX.shakeFrame(ctx, sh);
  }

  // ===========================================================================
  // SCENE 4 — SITA (17–22 s)
  //   0.0–0.9  the last of the fire rises into waves of gold that fill the screen
  //   0.5–1.3  Sita appears: white silhouette → full colour, soft glow
  //   1.0–4.2  a rangoli draws itself on the floor around her, petal by petal
  // ===========================================================================

  // One rangoli petal, drawn pixel by pixel so it stays crisp at ANY angle.
  // For every pixel in the petal's bounding box we ask: "in the petal's own
  // coordinates (along = distance out from the centre, across = sideways),
  // am I inside the teardrop?"  This is called inverse mapping.
  //   k      : 0..1 growth (petals 'pop' in)
  //   squash : vertical squash, because the rangoli lies flat on the floor
  function petal(ctx, cx, cy, ang, r0, r1, w, col, core, k, squash) {
    if (k <= 0) return;
    const len = (r1 - r0) * k, ww = w * k;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    // bounding box of the petal on screen
    const ex = Math.abs(ca) * (r0 + len) + Math.abs(sa) * ww + 2;
    const ey = (Math.abs(sa) * (r0 + len) + Math.abs(ca) * ww) * squash + 2;
    for (let y = Math.floor(cy - ey); y <= cy + ey; y++) {
      for (let x = Math.floor(cx - ex); x <= cx + ex; x++) {
        const dx = x + 0.5 - cx, dy = (y + 0.5 - cy) / squash;
        const along = dx * ca + dy * sa - r0;
        const across = -dx * sa + dy * ca;
        if (along < 0 || along > len) continue;
        const s = along / len;                                // 0 at base → 1 at tip
        const half = ww * Math.pow(Math.sin(Math.PI * Math.pow(s, 0.75)), 0.8);
        if (Math.abs(across) > half) continue;
        ctx.fillStyle = (Math.abs(across) < half * 0.45 && s > 0.15 && s < 0.8) ? core : col;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  // The rangoli design as data: each ring = [count, r0, r1, width, colour,
  // core colour, angle offset]. Petals appear in this order, inner ring first.
  const RANGOLI = [
    [8, 10, 46, 12, PAL.r, PAL.y, 0],
    [8, 26, 66, 13, PAL.F, PAL.w, Math.PI / 8],
    [16, 64, 92, 7, PAL.g, PAL.l, 0],
    [16, 70, 96, 5, PAL.z, PAL.i, Math.PI / 16],
  ];
  const RANGOLI_T0 = 1.0, PETAL_GAP = 0.05;

  function drawRangoli(ctx, t, cx, cy) {
    const SQ = 0.5;   // flattened: it lies on the floor
    const RS = 0.92;  // overall size, so the outer ring stays on screen
    // list every petal with its appear time (inner rings first)
    const petals = [];
    let n = 0;
    RANGOLI.forEach(([count, r0, r1, w, col, core, off], ring) => {
      for (let i = 0; i < count; i++) petals.push({ ring, ang: off + (i / count) * Math.PI * 2, r0: r0 * RS, r1: r1 * RS, w: w * RS, col, core, t0: RANGOLI_T0 + (n++) * PETAL_GAP });
    });
    const tEnd = RANGOLI_T0 + n * PETAL_GAP;
    // outer ring of white dots and an orange border circle come in last
    const kRing = easeOut(seg(t, tEnd, tEnd + 0.5));
    if (kRing > 0) {
      for (let a = 0; a < Math.PI * 2 * kRing; a += 0.012) {
        FX.px(ctx, cx + Math.cos(a) * 112 * RS, cy + Math.sin(a) * 112 * RS * SQ, PAL.F, 2);
      }
      for (let i = 0; i < 32 * kRing; i++) {
        const a = (i / 32) * Math.PI * 2;
        FX.disc(ctx, cx + Math.cos(a) * 104 * RS, cy + Math.sin(a) * 104 * RS * SQ, 1.5, i % 2 ? PAL.w : PAL.c);
      }
    }
    // draw outer rings first so inner petals sit on top
    for (let ring = RANGOLI.length - 1; ring >= 0; ring--) {
      for (const P of petals) {
        if (P.ring !== ring) continue;
        const k = FX.easeOutBack(seg(t, P.t0, P.t0 + 0.25)); // overshoot = 'pop'
        petal(ctx, cx, cy, P.ang, P.r0, P.r1, P.w, P.col, P.core, Math.min(1.15, k), SQ);
      }
    }
    // the centre: a white flower that appears first
    const kc = FX.easeOutBack(seg(t, RANGOLI_T0 - 0.2, RANGOLI_T0 + 0.1));
    if (kc > 0) { FX.disc(ctx, cx, cy, 9 * kc, PAL.w); FX.disc(ctx, cx, cy, 4 * kc, PAL.q); }
    // a sparkle flies to each petal as it appears — the "drawing" hand
    for (const P of petals) {
      const a = t - P.t0;
      if (a < 0 || a > 0.15) continue;
      const tipR = P.r1;
      FX.light(ctx, cx + Math.cos(P.ang) * tipR, cy + Math.sin(P.ang) * tipR * SQ, 6, PAL.w, 0.9, 2);
    }
  }

  function sceneSita(ctx, p) {
    const t = p * 5;
    const X = 240, FEET = 214, S = 3;

    // --- background: dark night, then gold waves rise up and fill it
    rect(ctx, 0, 0, W, H, PAL.D);
    const goldRise = easeOut(seg(t, 0, 0.9));
    FX.fireWall(ctx, t, W + 200, {
      scale: 0.3 + goldRise * 2.2,
      layers: [
        { col: PAL.G, h: 140, amp: 14, freq: 0.04, speed: 3, phase: 0 },
        { col: PAL.q, h: 110, amp: 12, freq: 0.05, speed: 3.5, phase: 2 },
        { col: PAL.y, h: 60, amp: 10, freq: 0.07, speed: 4, phase: 4 },
      ],
    });
    // once filled: a calm gold room — wall, a dithered edge, and the floor
    const settle = seg(t, 0.7, 1.1);
    if (settle > 0) {
      ctx.save(); ctx.globalAlpha = settle;
      rect(ctx, 0, 0, W, 150, PAL.q);
      dither(ctx, 150, 156, PAL.G);
      rect(ctx, 0, 156, W, H - 156, PAL.G);
      ctx.restore();
    }
    // soft breathing glow behind her
    const glowK = seg(t, 0.4, 1.2);
    FX.light(ctx, X, 120, 110, PAL.y, 0.5 * glowK, 5);
    FX.light(ctx, X, 120, 60, PAL.w, (0.25 + 0.05 * Math.sin(t * 3)) * glowK, 3);

    // --- rangoli on the floor around her feet
    drawRangoli(ctx, t, X, FEET + 2);

    // --- Sita: white silhouette fades in, then her colours appear
    const kIn = seg(t, 0.5, 0.9), kCol = seg(t, 0.9, 1.3);
    const bob = t > 1.3 && Math.sin(t * 2.5) > 0.4 ? 1 : 0;     // gentle breathing
    if (kIn > 0) {
      if (kCol > 0) Sprites.draw(ctx, 'sita_pray', X, FEET - bob, { s: S, alpha: kCol });
      if (kCol < 1) Sprites.draw(ctx, 'sita_pray', X, FEET - bob, { s: S, mode: 'w', alpha: kIn * (1 - kCol) });
    }

    // --- marigold petals drifting down, and golden motes rising
    FX.emit(ctx, t, {
      x: W / 2, y: -6, spreadX: W, rate: 14, life: 4, t0: 0.8,
      vx: [-12, 12], vy: [28, 45], cols: [PAL.F, PAL.o, PAL.y], size: [2, 2], fade: false, seed: 401,
    });
    FX.emit(ctx, t, {
      x: X, y: 200, spreadX: 200, spreadY: 40, rate: 20, life: 2, t0: 0.6,
      vx: [-6, 6], vy: [-30, -12], cols: [PAL.w, PAL.y], size: [1, 1], flicker: 0.3, seed: 402,
    });
  }

  // ===========================================================================
  // SCENE 5 — RETURN TO AYODHYA (22–27 s)
  // Night sky with stars and moon. The Pushpak Viman glides across, carrying
  // Rama and Sita home. Below, the Ayodhya skyline: rows of diyas light up
  // one by one from left to right, and their reflections shimmer in the river.
  // ===========================================================================
  const BANK = 204;      // y of the riverbank (top of the water)

  // The skyline, described once as data: [x, width, height, roof]
  //   roof: 'f' flat with parapet, 'o' onion dome, 's' spire (shikhara), 'g' gate
  const AYODHYA_BACK = [[0, 40, 50, 'o'], [36, 30, 70, 's'], [62, 50, 44, 'f'], [104, 26, 64, 'o'], [128, 40, 52, 'f'],
    [166, 22, 84, 's'], [186, 50, 46, 'f'], [232, 18, 76, 's'], [248, 48, 58, 'o'], [294, 40, 48, 'f'],
    [332, 22, 82, 's'], [352, 44, 54, 'o'], [394, 36, 46, 'f'], [428, 22, 72, 's'], [448, 40, 50, 'o']];
  const AYODHYA_FRONT = [[0, 54, 26, 'f'], [52, 30, 34, 'o'], [80, 60, 22, 'f'], [138, 26, 40, 's'],
    [162, 56, 28, 'f'], [214, 52, 46, 'g'], [264, 50, 26, 'f'], [312, 28, 38, 'o'], [338, 56, 24, 'f'],
    [392, 26, 42, 's'], [416, 64, 28, 'f']];

  function building(ctx, x, w, h, roof, col, base) {
    const top = base - h, cx = x + w / 2;
    rect(ctx, x, top, w, h, col);
    if (roof === 'f') for (let i = x; i < x + w; i += 4) rect(ctx, i, top - 2, 2, 2, col);
    else if (roof === 'o') onion(ctx, cx, top, Math.min(12, w / 2.5), col);
    else if (roof === 's') spire(ctx, cx, top - 20, w / 2, 20, col);
    else if (roof === 'g') {                       // grand gate: arch + two small domes
      onion(ctx, x + 8, top, 6, col); onion(ctx, x + w - 8, top, 6, col);
      spire(ctx, cx, top - 14, 10, 14, col);
    }
    return top;
  }

  // Every diya in the scene, with the moment it lights. Lit left → right.
  function ayodhyaDiyas() {
    const list = [];
    // along the riverbank (the main row)
    for (let x = 6; x < W; x += 12) list.push({ x, y: BANK - 1, big: true });
    // along the rooftops of the front buildings
    for (const [bx, w, h, roof] of AYODHYA_FRONT) {
      if (roof !== 'f') continue;
      for (let x = bx + 4; x < bx + w - 2; x += 8) list.push({ x, y: BANK - h - 3, big: false });
    }
    for (const d of list) d.t0 = 0.5 + (d.x / W) * 3.0 + (d.big ? 0 : 0.12);
    return list;
  }
  const DIYAS5 = ayodhyaDiyas();

  function sceneAyodhya(ctx, p) {
    const t = p * 5;

    // --- sky: deep navy → indigo near the horizon, stars, crescent moon
    rect(ctx, 0, 0, W, 110, PAL.D);
    dither(ctx, 110, 118, PAL.n);
    rect(ctx, 0, 118, W, BANK - 118, PAL.n);
    FX.stars(ctx, t + 9, { n: 90, seed: 21, maxY: 120 });
    FX.light(ctx, 400, 40, 26, PAL.s, 0.35, 4);
    FX.disc(ctx, 400, 40, 11, PAL.w);
    FX.disc(ctx, 405, 36, 10, PAL.D);

    // --- skyline: a dark back layer, then the near-black front layer
    for (const [x, w, h, roof] of AYODHYA_BACK) building(ctx, x, w, h, roof, PAL.e, BANK);
    for (const [x, w, h, roof] of AYODHYA_FRONT) building(ctx, x, w, h, roof, PAL.k, BANK);
    // windows: a few warm squares that come on as the diya wave passes them
    for (let i = 0; i < 40; i++) {
      const [bx, w, h] = AYODHYA_FRONT[i % AYODHYA_FRONT.length];
      const x = bx + 4 + Math.floor(hash(i, 51, 1) * (w - 8));
      const y = BANK - 6 - Math.floor(hash(i, 51, 2) * (h - 10));
      const on = t > 0.6 + (x / W) * 3.0 + hash(i, 51, 3) * 0.4;
      rect(ctx, x, y, 2, 2, on ? (hash(i, 51, 4) < 0.5 ? PAL.y : PAL.o) : PAL.e);
    }

    // --- river: dark water with drifting ripple lines
    rect(ctx, 0, BANK, W, H - BANK, PAL.D);
    rect(ctx, 0, BANK, W, 1, PAL.e);
    for (let i = 0; i < 40; i++) {
      const y = BANK + 4 + Math.floor(hash(i, 52, 1) * (H - BANK - 6));
      const x = (hash(i, 52, 2) * W + t * 10) % (W + 20) - 10;
      rect(ctx, x, y, 4 + Math.floor(hash(i, 52, 3) * 8), 1, PAL.n);
    }

    // --- diyas: unlit = tiny dark pot; lit = flame + glow (+ a 'pop' as it lights)
    DIYAS5.forEach((d, i) => {
      const age = t - d.t0;
      if (age < 0) { rect(ctx, d.x - 2, d.y - 1, 4, 2, PAL.u); return; }
      const pop = 1 - seg(age, 0, 0.3);                     // extra brightness at ignition
      const fl = hash(Math.floor(t * 8), i, 7) < 0.5;
      // saffron (F), not salmon (o): additive salmon on navy turns pink
      FX.light(ctx, d.x, d.y - 3, (d.big ? 7 : 3) + pop * 4, PAL.F, 0.55 + pop * 0.3, 3);
      if (d.big) Sprites.draw(ctx, fl ? 'diya' : 'diya_b', d.x, d.y + 2);
      else { rect(ctx, d.x - 1, d.y - 1, 3, 2, PAL.h); rect(ctx, d.x, d.y - 3 - (fl ? 1 : 0), 1, 2, PAL.y); }
      // reflection in the river: a broken, wobbling vertical streak of light
      if (d.big) {
        for (let j = 0; j < 6; j++) {
          const wob = Math.round(Math.sin(t * 4 + j + i) * 1.5);
          ctx.save(); ctx.globalAlpha = 0.55 * (1 - j / 6);
          rect(ctx, d.x - 1 + wob, BANK + 3 + j * 4, 3 - (j > 2 ? 1 : 0), 2, j < 2 ? PAL.y : PAL.o);
          ctx.restore();
        }
      }
    });

    // --- the Pushpak Viman glides across the sky, gently bobbing
    const S = 2;
    const vx = lerp(-80, W + 80, seg(t, 0, 5));
    const vy = 96 + Math.round(Math.sin(t * 2.2) * 3) - Math.round(Math.sin(seg(t, 0, 5) * Math.PI) * 18);
    // gold sparkle trail behind it
    FX.emit(ctx, t, {
      x: (b) => lerp(-80, W + 80, seg(b, 0, 5)) - 40, y: (b) => 96 - Math.sin(seg(b, 0, 5) * Math.PI) * 18 - 4,
      t0: -1, rate: 50, life: 0.9, spreadY: 14, vx: [-40, -10], vy: [-6, 20], g: 20, cols: [PAL.y, PAL.w, PAL.q], flicker: 0.3, seed: 502,
    });
    // fluffy clouds riding under the hull
    for (let i = 0; i < 4; i++) {
      const cx = vx - 40 + i * 26 + Math.round(Math.sin(t * 3 + i) * 2);
      FX.disc(ctx, cx, vy - 2, 7 + (i % 2) * 2, PAL.s);
      FX.disc(ctx, cx, vy - 4, 6 + (i % 2) * 2, PAL.w);
    }
    Sprites.draw(ctx, 'viman', vx, vy, { s: S });
    // fluttering saffron flags on the two poles
    for (const pole of [[10, 5], [50, 5]]) {
      const pt = Sprites.at('viman', pole[0], pole[1], vx, vy, S, S);
      for (let i = 0; i < 12; i++) {
        const h = Math.round(7 * (1 - i / 12)) + 1;
        const wave = Math.round(Math.sin(t * 9 - i * 0.5) * 1.5);
        rect(ctx, pt.x - 1 - i, pt.y + wave + (7 - h) / 2, 1, h, i % 5 === 4 ? PAL.o : PAL.F); // flies backwards (wind)
      }
    }
  }

  // ===========================================================================
  // SCENE 7 — TEMPLE + TITLE (31–37 s)
  //   0.00–1.25  camera glides forward through a pillared corridor and out
  //   1.30–2.40  "HAPPY DIWALI" types in, letter by letter, with a gold glow
  //   2.50–3.25  "FROM ABHIRAM TAWALARE" types in below
  //   3.25–5.25  hold (2 s) — fireworks keep going, diyas flicker
  //   5.25–6.00  fade to black
  // ===========================================================================
  const TITLE = 'HAPPY DIWALI', BYLINE = 'FROM ABHIRAM TAWALARE';
  const T_TITLE = 1.3, PER_TITLE = 0.09;    // seconds per letter
  const T_BY = 2.5, PER_BY = 0.035;
  const T_FADE = 5.25;
  const ROCKETS7 = [
    [1.6, 70, 50, [PAL.y, PAL.w, PAL.q], PAL.r], [2.1, 410, 40, [PAL.i, PAL.w, PAL.z], null],
    [2.7, 110, 70, [PAL.c, PAL.a, PAL.w], PAL.y], [3.1, 380, 75, [PAL.o, PAL.y, PAL.w], null],
    [3.6, 40, 35, [PAL.l, PAL.w, PAL.g], PAL.i], [4.0, 440, 60, [PAL.y, PAL.q, PAL.w], PAL.c],
    [4.5, 140, 45, [PAL.z, PAL.i, PAL.w], null], [4.9, 350, 50, [PAL.a, PAL.w, PAL.c], PAL.y],
  ];

  // A round, layered tree: dark base, mid-green, light highlights; sways 1 px.
  function tree(ctx, x, yBase, r, t, i) {
    const sway = Math.sin(t * 1.5 + i) > 0.6 ? 1 : 0;
    rect(ctx, x - 2, yBase - r, 5, r, PAL.u);                  // trunk
    FX.disc(ctx, x + sway, yBase - r * 1.5, r, PAL.v);
    FX.disc(ctx, x - r * 0.45 + sway, yBase - r * 1.3, r * 0.7, PAL.v);
    FX.disc(ctx, x + r * 0.5 + sway, yBase - r * 1.25, r * 0.65, PAL.v);
    FX.disc(ctx, x - r * 0.2 + sway, yBase - r * 1.75, r * 0.6, PAL.g);
    FX.disc(ctx, x - r * 0.35 + sway, yBase - r * 1.9, r * 0.25, PAL.l);
  }

  // The outdoor view: dusk sky, trees, temple with waving flag, diyas.
  const TEMPLE_X = 240, TEMPLE_Y = 254, TS = 2;   // temple drawn at 2× (192×160)
  function drawTempleGrounds(ctx, t) {
    // deep blue dusk: navy at the top, brighter blue toward the horizon
    rect(ctx, 0, 0, W, 90, PAL.D);
    dither(ctx, 90, 98, PAL.n);
    rect(ctx, 0, 98, W, 70, PAL.n);
    dither(ctx, 168, 176, PAL.b);
    rect(ctx, 0, 176, W, 80, PAL.b);
    FX.stars(ctx, t, { n: 50, seed: 9, maxY: 150 });

    // trees on both sides (back row darker and smaller, then front row)
    [[20, 22], [70, 26], [118, 20], [362, 20], [410, 26], [460, 22]].forEach(([x, r], i) => tree(ctx, x, 252, r, t, i));
    // ground: dark grass with a lighter path leading to the steps
    rect(ctx, 0, 252, W, H - 252, PAL.v);
    rect(ctx, 0, 252, W, 1, PAL.g);
    rect(ctx, TEMPLE_X - 40, 253, 80, H - 253, PAL.d);

    // the temple, with a warm glow from inside the door
    FX.light(ctx, TEMPLE_X, TEMPLE_Y - 30, 40, PAL.o, 0.35, 3);
    Sprites.draw(ctx, 'temple', TEMPLE_X, TEMPLE_Y, { s: TS });
    // saffron flag on a pole above the kalash, waving: each column of the
    // triangle is shifted by a sine wave travelling along it
    const top = Sprites.at('temple', 47, 0, TEMPLE_X, TEMPLE_Y, TS, TS);
    rect(ctx, top.x, top.y - 26, 1, 26, PAL.u);
    for (let i = 0; i < 22; i++) {
      const h = Math.round(10 * (1 - i / 22)) + 1;               // tapers to a point
      const wave = Math.round(Math.sin(t * 6 - i * 0.35) * 2);
      rect(ctx, top.x + 1 + i, top.y - 26 + wave + (10 - h) / 2, 1, h, i % 7 === 6 ? PAL.o : PAL.F);
    }

    // diyas: on the two side platforms and in a row along the ground
    const spots = [];
    for (let i = 0; i < 4; i++) spots.push([TEMPLE_X - 88 + i * 10, TEMPLE_Y - 11], [TEMPLE_X + 58 + i * 10, TEMPLE_Y - 11]);
    for (let x = 14; x < W; x += 26) if (Math.abs(x - TEMPLE_X) > 44) spots.push([x, 266]);
    spots.forEach(([x, y], i) => {
      const fl = hash(Math.floor(t * 8), i, 3) < 0.5;              // 8 flickers / s
      FX.light(ctx, x, y - 6, fl ? 7 : 6, PAL.o, 0.55, 3);
      Sprites.draw(ctx, fl ? 'diya' : 'diya_b', x, y);
    });
  }

  // The corridor: dark interior, perspective pillars rushing past, and an
  // opening at the end through which the temple grounds are seen.
  // Perspective in one line: something at distance d appears 1/d as big.
  function drawCorridor(ctx, t, camZ) {
    const cx = W / 2, cy = 150;
    const proj = (d) => 1 / d;                       // screen scale at depth d
    const EXIT = 5.2;                                // depth of the doorway
    const dE = EXIT - camZ;
    if (dE <= 0.35) return;                          // we're outside now
    const s = proj(dE);
    const ox0 = cx - 150 * s, ox1 = cx + 150 * s;    // opening rectangle
    const oy0 = cy - 110 * s, oy1 = cy + 104 * s;
    // fill everything EXCEPT the opening with the dark interior
    ctx.fillStyle = PAL.u;
    ctx.fillRect(0, 0, W, Math.max(0, oy0));
    ctx.fillRect(0, oy1, W, H - oy1);
    ctx.fillRect(0, oy0, Math.max(0, ox0), oy1 - oy0);
    ctx.fillRect(ox1, oy0, W - ox1, oy1 - oy0);
    // floor: lighter stone bands that converge toward the opening
    for (let k = 0; k < 6; k++) {
      const d = (k + 1) * 1.0 - (camZ % 1.0);
      if (d <= 0.2 || d >= dE) continue;
      const y = cy + 104 / d;
      if (y < H) rect(ctx, 0, y, W, 2, PAL.h);
    }
    // ceiling beams
    for (let k = 0; k < 6; k++) {
      const d = (k + 1) * 1.0 - (camZ % 1.0);
      if (d <= 0.2 || d >= dE) continue;
      const y = cy - 110 / d;
      if (y > 0) rect(ctx, 0, y - 3 / d, W, Math.max(1, 4 / d), PAL.k);
    }
    // pillar pairs, drawn far → near so near ones cover far ones
    for (let z = 4; z >= 1; z--) {
      const d = z - camZ + 0.6;
      if (d <= 0.25 || d >= dE) continue;
      const k = proj(d);
      const pw = 30 * k;                              // pillar width
      const top = cy - 110 * k, bot = cy + 104 * k;
      for (const side of [-1, 1]) {
        const x = cx + side * 150 * k - (side < 0 ? pw : 0);
        rect(ctx, x, top, pw, bot - top, PAL.x);                       // body
        rect(ctx, x + pw * (side < 0 ? 0.65 : 0), top, pw * 0.35, bot - top, PAL.h); // inner shadow
        rect(ctx, x - 2 * k, top, pw + 4 * k, 6 * k, PAL.q);           // gold capital
        rect(ctx, x - 2 * k, bot - 6 * k, pw + 4 * k, 6 * k, PAL.G);   // base
        // a little lamp glowing on each pillar
        const lx = x + pw / 2, ly = cy - 10 * k;
        FX.light(ctx, lx, ly, 10 * k, PAL.o, 0.6, 3);
        rect(ctx, lx - k, ly - 2 * k, Math.max(1, 2 * k), Math.max(1, 3 * k), PAL.y);
      }
    }
  }

  function sceneTemple(ctx, p) {
    const t = p * 6;
    drawTempleGrounds(ctx, t);

    // fireworks overhead (behind the text)
    for (let i = 0; i < ROCKETS7.length; i++) {
      const [t0, x, yTop, cols, ring] = ROCKETS7[i];
      FX.firework(ctx, t - t0, { x, yGround: 250, yTop, drift: (hash(i, 8) - 0.5) * 20, rise: 0.7, cols, ring, n: 36, power: 85, seed: 300 + i * 11, life: 1.5 });
    }

    // camera moving forward: fast at first, easing out as we leave the corridor
    const camZ = 5.2 * easeOut(seg(t, 0, 1.25));
    drawCorridor(ctx, t, camZ);

    // --- the title, typed in. The newest letter flashes white for 2 frames.
    const title = Font.typed(TITLE, t, T_TITLE, PER_TITLE);
    if (title) {
      // outlineW 1 (not 2): a thick outline would fill the small holes in
      // letters like P and A and make "HAPPY" read as "HAFFY"
      const glow = { glow: PAL.q, glowR: 6, glowA: 0.9, outline: PAL.k, outlineW: 1 };
      // x is fixed for the FULL title, so letters don't shift as more appear
      const x0 = W / 2 - Font.measure(TITLE, 5) / 2;
      Font.draw(ctx, title, x0, 18, PAL.y, 5, glow);
      // when did the newest letter appear? flash it white for 0.07 s
      const idx = title.length - 1;
      if (t - (T_TITLE + idx * PER_TITLE) < 0.07) {
        const prefix = title.slice(0, idx);
        const x = x0 + (prefix ? Font.measure(prefix, 5) + 5 : 0); // +5 = one gap at scale 5
        Font.draw(ctx, title[idx], x, 18, PAL.w, 5);
      }
    }
    const by = Font.typed(BYLINE, t, T_BY, PER_BY);
    if (by) Font.draw(ctx, by, W / 2 - Font.measure(BYLINE, 2) / 2, 52, PAL.w, 2, { outline: PAL.k, glow: PAL.o, glowR: 3, glowA: 0.6 });

    // little sparkles twinkling around the title once it's complete
    if (t > T_TITLE + TITLE.length * PER_TITLE) {
      for (let i = 0; i < 6; i++) {
        const ph = (t * 1.3 + i / 6) % 1;
        const x = 120 + hash(i, Math.floor(t * 1.3 + i / 6), 1) * 240;
        const y = 12 + hash(i, Math.floor(t * 1.3 + i / 6), 2) * 36;
        const s = Math.round(Math.sin(ph * Math.PI) * 3);
        if (s > 0) { FX.line(ctx, x - s, y, x + s, y, PAL.w); FX.line(ctx, x, y - s, x, y + s, PAL.w); }
      }
    }

    // fade to black at the very end (the last frame is fully black)
    FX.flash(ctx, ease(seg(t, T_FADE, 6)), '#000000');
  }

  // ===========================================================================
  // Placeholders for scenes not built yet (replaced one at a time).
  // ===========================================================================
  function placeholder(title, sub, bg, fg) {
    return function (ctx, p) {
      FX.bands(ctx, 0, H, bg);
      Font.draw(ctx, title, W / 2, H / 2 - 16, fg, 3, { align: 'center', shadow: PAL.k });
      Font.draw(ctx, sub, W / 2, H / 2 + 6, PAL.w, 1, { align: 'center' });
      ctx.fillStyle = PAL.k; ctx.fillRect(W / 2 - 60, H / 2 + 20, 120, 4);
      ctx.fillStyle = fg; ctx.fillRect(W / 2 - 60, H / 2 + 20, Math.round(120 * p), 4);
    };
  }

  const SCENES = [
    { name: 'RAVANA', dur: 4, xfade: 0, draw: sceneRavana },
    { name: 'RAMA', dur: 8, xfade: 0.2, draw: sceneRama },
    { name: 'VICTORY', dur: 5, xfade: 0, draw: sceneVictory },
    { name: 'SITA', dur: 5, xfade: 0.3, draw: sceneSita },
    { name: 'AYODHYA', dur: 5, xfade: 0.3, draw: sceneAyodhya },
    { name: 'COURT', dur: 4, xfade: 0.2,
      draw: placeholder('6 COURT', 'THE ROYAL TABLEAU', [PAL.m, PAL.r], PAL.q) },
    { name: 'TEMPLE', dur: 6, xfade: 0.2, draw: sceneTemple },
  ];

  // ===========================================================================
  // SPRITE TEST SCREEN (press T; ←/→ to pick a sprite). Not part of the video.
  // Top row: every sprite at true size (1×). Middle: the selected sprite
  // magnified so you can inspect each pixel. Bottom: palette with letters.
  // ===========================================================================
  function drawTest(ctx, t, sel) {
    const names = Sprites.names();
    const name = names[((sel % names.length) + names.length) % names.length];
    const { w, h } = Sprites.size(name);
    const zoom = Math.max(1, Math.min(4, Math.floor(Math.min(170 / h, 300 / w))));

    FX.bands(ctx, 0, H, [PAL.e, PAL.e, PAL.d]);
    Font.draw(ctx, 'SPRITE TEST - ' + name.toUpperCase().replace(/_/g, ' '), 8, 8, PAL.y, 2, { shadow: PAL.k });
    Font.draw(ctx, '<- -> CHOOSE   T = BACK', W - 8, 8, PAL.s, 1, { align: 'right' });

    // gallery at 1× along the left, selected one highlighted
    let gx = 10;
    names.forEach((n, i) => {
      const s = Sprites.size(n);
      const isSel = n === name;
      if (isSel) rect(ctx, gx - 2, 26, s.w + 4, s.h + 4, PAL.q);
      rect(ctx, gx, 28, s.w, s.h, '#3a4462');
      Sprites.draw(ctx, n, gx, 28, { anchor: 'tl' });
      gx += s.w + 8;
    });

    // magnified view on a checkerboard (so transparent pixels are obvious)
    const bx = Math.round(W / 2 - (w * zoom) / 2), by = 236 - h * zoom;
    for (let y = by; y < 236; y += 8) {
      for (let x = bx; x < bx + w * zoom; x += 8) {
        rect(ctx, x, y, Math.min(8, bx + w * zoom - x), Math.min(8, 236 - y), ((x - bx + y - by) / 8) % 2 ? '#3a4462' : '#333c57');
      }
    }
    Sprites.draw(ctx, name, W / 2, 236, { s: zoom });
    Font.draw(ctx, zoom + 'X  (' + w + 'x' + h + ')', W / 2, 238, PAL.w, 1, { align: 'center' });
    // 1× copy beside it, with a little idle bob
    const bob = Math.sin(t * 3) > 0 ? 1 : 0;
    Sprites.draw(ctx, name, 50, 236 - bob);
    Font.draw(ctx, '1X', 50, 238, PAL.w, 1, { align: 'center' });

    // palette swatches. The font only has capitals, so the extra (uppercase)
    // colours are labelled in YELLOW and the base ones in white.
    let x = 8;
    for (const k of Object.keys(PAL)) {
      rect(ctx, x - 1, 247, 13, 13, PAL.k);
      rect(ctx, x, 248, 11, 11, PAL[k]);
      Font.draw(ctx, k, x + 5, 262, k === k.toUpperCase() ? PAL.y : PAL.w, 1, { align: 'center' });
      x += 14.5;
    }
  }

  root.SCENES = SCENES;
  root.drawTest = drawTest;
})(window);
