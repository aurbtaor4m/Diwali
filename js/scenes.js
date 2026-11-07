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
    FX.glow(ctx, x, y - 2, 7 + h1 * 2, PAL.o, 0.35, 3);
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
        FX.glow(ctx, e.x, e.y, 5, PAL.E, 0.55 * eyeOn * pulse, 3);
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
    { name: 'RAMA', dur: 8, xfade: 0.2,
      draw: placeholder('2 RAMA', 'THE BOW IS DRAWN', [PAL.n, PAL.b], PAL.c) },
    { name: 'VICTORY', dur: 5, xfade: 0,
      draw: placeholder('3 VICTORY', 'FIRE AND FIREWORKS', [PAL.m, PAL.r], PAL.y) },
    { name: 'SITA', dur: 5, xfade: 0.3,
      draw: placeholder('4 SITA', 'RANGOLI OF LIGHT', [PAL.G, PAL.q], PAL.w) },
    { name: 'AYODHYA', dur: 5, xfade: 0.3,
      draw: placeholder('5 AYODHYA', 'THE RETURN HOME', [PAL.D, PAL.n], PAL.y) },
    { name: 'COURT', dur: 4, xfade: 0.2,
      draw: placeholder('6 COURT', 'THE ROYAL TABLEAU', [PAL.m, PAL.r], PAL.q) },
    { name: 'TEMPLE', dur: 6, xfade: 0.2,
      draw: placeholder('7 TEMPLE', 'HAPPY DIWALI', [PAL.n, PAL.t], PAL.y) },
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
