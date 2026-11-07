// =============================================================================
// font.js — tiny 5-pixel-tall bitmap font.
//
// Adapted from reference/js/font.js (cardiHero, MIT licence). Each glyph is a
// list of 5 strings; '#' = lit pixel, '.' = empty. Glyphs have different
// widths (an "I" is narrower than an "M"), which looks much nicer than a
// fixed-width font.
//
// Additions for this card:
//   - opts.glow   : soft halo behind the text (stacked, fading outlines)
//   - typed(...)  : how many characters of a string are visible at time t
//                   (used for the "HAPPY DIWALI" typewriter effect)
// =============================================================================
(function (root) {
  'use strict';

  const G = {
    A: ['.#.', '#.#', '###', '#.#', '#.#'],
    B: ['##.', '#.#', '##.', '#.#', '##.'],
    C: ['.##', '#..', '#..', '#..', '.##'],
    D: ['##.', '#.#', '#.#', '#.#', '##.'],
    E: ['###', '#..', '##.', '#..', '###'],
    F: ['###', '#..', '##.', '#..', '#..'],
    G: ['.##.', '#...', '#.##', '#..#', '.##.'],
    H: ['#.#', '#.#', '###', '#.#', '#.#'],
    I: ['###', '.#.', '.#.', '.#.', '###'],
    J: ['..#', '..#', '..#', '#.#', '.#.'],
    K: ['#..#', '#.#.', '##..', '#.#.', '#..#'],
    L: ['#..', '#..', '#..', '#..', '###'],
    M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
    N: ['#..#', '##.#', '#.##', '#..#', '#..#'],
    O: ['.##.', '#..#', '#..#', '#..#', '.##.'],
    P: ['##.', '#.#', '##.', '#..', '#..'],
    Q: ['.##.', '#..#', '#..#', '#.#.', '.#.#'],
    R: ['##.', '#.#', '##.', '#.#', '#.#'],
    S: ['.##', '#..', '.#.', '..#', '##.'],
    T: ['###', '.#.', '.#.', '.#.', '.#.'],
    U: ['#.#', '#.#', '#.#', '#.#', '###'],
    V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
    W: ['#...#', '#...#', '#.#.#', '##.##', '#...#'],
    X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
    Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
    Z: ['###', '..#', '.#.', '#..', '###'],
    0: ['###', '#.#', '#.#', '#.#', '###'],
    1: ['.#.', '##.', '.#.', '.#.', '###'],
    2: ['##.', '..#', '.#.', '#..', '###'],
    3: ['##.', '..#', '.#.', '..#', '##.'],
    4: ['#.#', '#.#', '###', '..#', '..#'],
    5: ['###', '#..', '##.', '..#', '##.'],
    6: ['.##', '#..', '###', '#.#', '###'],
    7: ['###', '..#', '.#.', '.#.', '.#.'],
    8: ['###', '#.#', '###', '#.#', '###'],
    9: ['###', '#.#', '###', '..#', '##.'],
    ' ': ['..', '..', '..', '..', '..'],
    '.': ['.', '.', '.', '.', '#'],
    ',': ['..', '..', '..', '.#', '#.'],
    '!': ['#', '#', '#', '.', '#'],
    '?': ['##.', '..#', '.#.', '...', '.#.'],
    ':': ['.', '#', '.', '#', '.'],
    "'": ['#', '#', '.', '.', '.'],
    '-': ['...', '...', '###', '...', '...'],
    '+': ['...', '.#.', '###', '.#.', '...'],
    '/': ['..#', '..#', '.#.', '#..', '#..'],
    '(': ['.#', '#.', '#.', '#.', '.#'],
    ')': ['#.', '.#', '.#', '.#', '#.'],
    '=': ['...', '###', '...', '###', '...'],
    '_': ['...', '...', '...', '...', '###'],
    '<': ['..#', '.#.', '#..', '.#.', '..#'],
    '>': ['#..', '.#.', '..#', '.#.', '#..'],
  };

  // Pre-parse every glyph once into a flat list of lit pixels [x0,y0,x1,y1,...]
  // so drawing is just a loop of fillRect calls.
  const glyphs = {};
  for (const ch in G) {
    const rows = G[ch];
    const px = [];
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < rows[y].length; x++) if (rows[y][x] === '#') px.push(x, y);
    }
    glyphs[ch] = { w: rows[0].length, px };
  }

  function glyph(ch) {
    return glyphs[ch] || glyphs[ch.toUpperCase()] || glyphs['?'];
  }

  // Width in screen pixels of a string at a given integer scale.
  // (1 pixel of spacing between letters.)
  function measure(text, scale = 1) {
    let w = 0;
    for (const ch of String(text)) w += glyph(ch).w + 1;
    return Math.max(0, w - 1) * scale;
  }

  // Low-level: paint the lit pixels of `text` in one colour.
  function raw(ctx, text, x, y, color, scale) {
    let cx = x;
    ctx.fillStyle = color;
    for (const ch of String(text)) {
      const g = glyph(ch);
      for (let i = 0; i < g.px.length; i += 2) {
        ctx.fillRect(cx + g.px[i] * scale, y + g.px[i + 1] * scale, scale, scale);
      }
      cx += (g.w + 1) * scale;
    }
  }

  // Draw text.
  //   opts.align   : 'left' (default) | 'center' | 'right'
  //   opts.outline : colour of a 1-"pixel" outline around the letters
  //   opts.shadow  : colour of a drop shadow one pixel below
  //   opts.glow    : colour of a soft halo (drawn as fading rings)
  //   opts.glowR   : halo radius in screen pixels (default = scale*2)
  //   opts.glowA   : halo strength 0..1 (default 0.35)
  function draw(ctx, text, x, y, color = '#f4f4f4', scale = 1, opts = {}) {
    x = Math.round(x); y = Math.round(y);
    if (opts.align === 'center') x = Math.round(x - measure(text, scale) / 2);
    else if (opts.align === 'right') x = Math.round(x - measure(text, scale));

    if (opts.glow) {
      // Each ring = the text stamped at 8 offsets of radius r, very transparent.
      // Stacking a few rings gives a halo that's brightest near the letters.
      const R = opts.glowR || scale * 2;
      const A = opts.glowA ?? 0.35;
      const base = ctx.globalAlpha; // respect any fade the caller already set
      ctx.save();
      for (let r = R; r >= 1; r--) {
        ctx.globalAlpha = base * A * (1 - r / (R + 1)) * 0.5;
        for (const [dx, dy] of [[-r, 0], [r, 0], [0, -r], [0, r], [-r, -r], [r, -r], [-r, r], [r, r]]) {
          raw(ctx, text, x + dx, y + dy, opts.glow, scale);
        }
      }
      ctx.restore();
    }
    if (opts.outline) {
      const s = opts.outlineW || scale;
      for (const [dx, dy] of [[-s, 0], [s, 0], [0, -s], [0, s], [-s, -s], [s, -s], [-s, s], [s, s]]) {
        raw(ctx, text, x + dx, y + dy, opts.outline, scale);
      }
    } else if (opts.shadow) {
      raw(ctx, text, x, y + scale, opts.shadow, scale);
    }
    raw(ctx, text, x, y, color, scale);
  }

  // Typewriter helper: how many characters of `text` should be visible.
  //   t0    = time (s) the first letter appears
  //   perCh = seconds per character
  // Spaces count as characters so the rhythm feels natural.
  function typed(text, t, t0, perCh) {
    if (t < t0) return '';
    const n = Math.min(text.length, Math.floor((t - t0) / perCh) + 1);
    return text.slice(0, n);
  }

  root.Font = { draw, measure, typed, H: 5 };
})(window);
