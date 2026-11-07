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

  const { W, H, seg, ease, clamp } = FX;

  // Small helper: a temporary "coming soon" frame so the timeline engine can
  // be tested before the real scenes exist. Will be deleted scene by scene.
  function placeholder(title, sub, bg, fg) {
    return function (ctx, p) {
      FX.bands(ctx, 0, H, bg);
      Font.draw(ctx, title, W / 2, H / 2 - 16, fg, 3, { align: 'center', shadow: PAL.k });
      Font.draw(ctx, sub, W / 2, H / 2 + 6, PAL.w, 1, { align: 'center' });
      // progress bar so you can see p moving 0 → 1
      ctx.fillStyle = PAL.k; ctx.fillRect(W / 2 - 60, H / 2 + 20, 120, 4);
      ctx.fillStyle = fg; ctx.fillRect(W / 2 - 60, H / 2 + 20, Math.round(120 * p), 4);
    };
  }

  const SCENES = [
    { name: 'RAVANA', dur: 4, xfade: 0,
      draw: placeholder('1 RAVANA', 'THE DARKNESS OVER LANKA', [PAL.D, PAL.n], PAL.r) },
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

  // ---------------------------------------------------------------------------
  // SPRITE TEST SCREEN (press T). Not part of the video.
  // Shows each finished sprite at 1× (true size) and 4× (to inspect pixels),
  // plus the palette with its letters so you can read the sprite grids.
  // `t` is seconds since the test screen opened (only used for a tiny bob).
  // ---------------------------------------------------------------------------
  function drawTest(ctx, t) {
    FX.bands(ctx, 0, H, [PAL.e, PAL.e, PAL.d]);
    // subtle checkerboard behind the big sprite so transparent pixels are obvious
    for (let y = 30; y < 230; y += 8) {
      for (let x = 150; x < 340; x += 8) {
        ctx.fillStyle = ((x + y) / 8) % 2 ? '#3a4462' : '#333c57';
        ctx.fillRect(x, y, 8, 8);
      }
    }
    Font.draw(ctx, 'SPRITE TEST - RAMA', 8, 8, PAL.y, 2, { shadow: PAL.k });
    Font.draw(ctx, 'T = BACK TO VIDEO', W - 8, 8, PAL.s, 1, { align: 'right' });

    // ground line
    ctx.fillStyle = PAL.k; ctx.fillRect(0, 230, W, 1);

    // 1× — true size, exactly how he'll look in the wide shots
    Sprites.draw(ctx, 'rama_stand', 70, 230);
    Font.draw(ctx, '1X', 70, 236, PAL.w, 1, { align: 'center' });
    // a 1× copy with an idle "breathing" bob (1 px), as used in the court scene
    const bob = Math.sin(t * 3) > 0 ? 1 : 0;
    Sprites.draw(ctx, 'rama_stand', 110, 230 - bob);
    Font.draw(ctx, '1X IDLE', 110, 236, PAL.w, 1, { align: 'center' });

    // 4× — 32×48 becomes 128×192
    Sprites.draw(ctx, 'rama_stand', 245, 230, { s: 4 });
    Font.draw(ctx, '4X', 245, 236, PAL.w, 1, { align: 'center' });

    // 1× mirrored (facing left) — sanity check for flipping
    Sprites.draw(ctx, 'rama_stand', 400, 230, { sx: -1 });
    Font.draw(ctx, '1X FLIP', 400, 236, PAL.w, 1, { align: 'center' });

    // palette swatches with their letters. The font only has capitals, so
    // the extra (uppercase) colours are labelled in YELLOW, base ones in white.
    const keys = Object.keys(PAL);
    let x = 8;
    for (const k of keys) {
      ctx.fillStyle = PAL.k; ctx.fillRect(x - 1, 247, 13, 13);
      ctx.fillStyle = PAL[k]; ctx.fillRect(x, 248, 11, 11);
      const extra = k === k.toUpperCase();
      Font.draw(ctx, k, x + 5, 262, extra ? PAL.y : PAL.w, 1, { align: 'center' });
      x += 15;
    }
  }

  root.SCENES = SCENES;
  root.drawTest = drawTest;
})(window);
