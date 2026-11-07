// =============================================================================
// sprites.js — every character and prop, drawn as text.
//
// FORMAT (same as reference/js/sprites.js from cardiHero):
//   Each sprite is a list of strings, one string per pixel row.
//   Each character is a palette letter from palette.js ('k' = outline,
//   'B' = Rama's blue skin, ...). '.' means transparent.
//
//   { f: [...] }  "full"  — every row is written out completely.
//   { h: [...] }  "half"  — only the LEFT half is written; the right half is
//                           a mirror image. Great for symmetric things
//                           (diyas, lanterns, the temple) — half the typing.
//
// At startup nothing is drawn yet. The first time a sprite is needed, get()
// "bakes" it: it paints the letters onto a small offscreen canvas, 1 canvas
// pixel per letter, and caches it. After that, drawing a sprite is a single
// fast ctx.drawImage() call.
// =============================================================================
(function (root) {
  'use strict';

  const S = {
    // -------------------------------------------------------------------------
    // RAMA — standing, bow upright in his left hand, quiver on his back.
    // 32 × 48. Faces right (towards Ravana). Reference: rama_standing.png
    //
    // Colour key used here:
    //   k outline   B/N skin light/shadow   q/y/G gold mid/light/dark
    //   u hair & bowstring   h quiver/strap   F/o saffron sash   r tilak/grip
    //   w/s arrow fletching
    // -------------------------------------------------------------------------
    rama_stand: { f: [
      '................................',
      '................................',
      '................................',
      '..............k.................', // crown finial
      '.............kyk................',
      '.............kqk................',
      '............kyqGk...............', // rounded mukut dome
      '...........kyqqqGk..............',
      '..........kyqqqqqGk.............',
      '.........kyqqqirqqGk............', // ruby gem with a pink glint
      '.........kyqqqrrqqGk......kyk...', // bow: top tip
      '.........kyqyqqqyqGk......ukyk..',
      '.........kyqqqqqqqGk......u.kyk.',
      '...w.w...kGqyqqqyqGk......u.kqk.', // crown band; arrow fletching
      '..wswsw.knenBBBBrBBBk.....u.kqk.', // dark hair, forehead + tilak
      '...khkh.kenNBkkBBkkBk.....u.kqk.', // brows
      '...kqqqqknkNBwkBBwkBk.....u.kqk.', // eyes (looking right) + quiver rim
      '...khhhukenNBBBBBBBBBk....u.kqk.', // nose
      '...khhhuknqNBBBBNNBBk.....u.kqk.', // earring + smile
      '...khhhukenNNBBBBBBk......u.kqk.', // chin
      '....khhukneekNNBBk........u..kqk', // neck, hair falls behind
      '.....kNBenBqBBBBqBBhNk....u..kqk', // shoulders + necklace
      '.....kNBBBBBqBBqBBhBBNk...u..kqk',
      '.....kNBBBBBByqBBhBBBNk...u..kqk', // necklace point
      '.....kNBkNBBBrBBhBkqyqk...u..kqk', // pendant + gold armlet
      '.....kNBkNBBBBBhBBkNBBk...u..kqk',
      '.....kNBkNBBBBhBBBkNBBBk..u..kqk', // elbow
      '.....kNBkNBBBhBBBBkNBBkkkkkkkkqk', // forearm reaches for the bow
      '.....kNBkNBBhBBBBBkNBBBqBBBBBBrk', // bracelet + hand on red grip
      '.....kNBkNBhBBBBBBkkNNNqNNNNNNrk',
      '.....kqqkNhBBBBBBNk.kkkkkkkkkkrk', // back-arm bracelet
      '.....kNBkkFFFFFFFFk.......u..krk', // saffron waist sash
      '.....kNNkkFqFFFqFFk.......u..kqk',
      '......kkkyyyFqFyyyqk......u..kqk', // yellow dhoti begins
      '.......kyyqyFqFyyyqqk.....u..kqk',
      '.......kyyqyFqFyyqyqk.....u..kqk',
      '......kyyyqyFqFyyyqyqk....u..kqk',
      '......kyyyqyFqFyyyqyqk....u.kqk.',
      '......kyyyqyyFyyyyqyqk....u.kqk.', // pleat tapers
      '......kyyyqyyGyyyyqyqk....u.kqk.',
      '......kyyyqyqkkqyyyqqk....u.kqk.', // legs separate
      '......kyyyqyk.kyyyqyqk....u.kqk.',
      '......kyyqyqk.kyyyqqk.....u.kqk.',
      '......kqyqqk...kyqyqk.....u.kqk.',
      '.......kGGGk...kGGGk......u.kyk.', // gold anklets
      '.......kBBNk...kBBNk......ukyk..',
      '......kBBBNk...kBBBBNk....kyk...', // feet; bow bottom tip
      '......kkkkkk...kkkkkkk.....k....',
    ] },
  };

  // Named colour swaps: reuse one drawing with different colours.
  // e.g. VARIANTS.foo = ['rama_stand', { B: 'f', N: 'x' }] would give a
  // peach-skinned copy. (Used later for small things like diya flicker.)
  const VARIANTS = {};

  // Turn a sprite definition into an array of equal-length rows.
  function rowsOf(def) {
    if (def.f) {
      const w = Math.max(...def.f.map((r) => r.length));
      return def.f.map((r) => r.padEnd(w, '.'));
    }
    // half sprite: mirror each row  "abc" → "abccba"
    const w = Math.max(...def.h.map((r) => r.length));
    return def.h.map((r) => { const half = r.padEnd(w, '.'); return half + [...half].reverse().join(''); });
  }

  function resolve(name) {
    if (S[name]) return { rows: rowsOf(S[name]), swap: null };
    const v = VARIANTS[name];
    if (v) return { rows: rowsOf(S[v[0]]), swap: v[1] };
    return null;
  }

  // Bake a sprite into an offscreen canvas (cached).
  //   mode 'n' = normal colours
  //   mode 'w' = solid white silhouette (hit flash, afterimages)
  //   mode 'k' = solid dark silhouette (shadows, background followers)
  const cache = {};
  function get(name, mode = 'n') {
    const key = name + ':' + mode;
    if (cache[key]) return cache[key];
    const r = resolve(name);
    if (!r) throw new Error('Unknown sprite: ' + name);
    const rows = r.rows;
    const h = rows.length, w = rows[0].length;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let ch = rows[y][x];
        if (ch === '.' || ch === ' ') continue;
        if (r.swap && r.swap[ch]) ch = r.swap[ch];
        g.fillStyle = mode === 'w' ? '#f4f4f4' : mode === 'k' ? PAL.k : (PAL[ch] || '#ff00ff'); // magenta = typo!
        g.fillRect(x, y, 1, 1);
      }
    }
    cache[key] = c;
    return c;
  }

  // Draw a sprite with its BOTTOM-CENTRE at (x, y) — i.e. (x, y) is where the
  // character's feet touch the ground. Options:
  //   sx, sy  : scale factors. Negative sx mirrors (faces left). Using a
  //             non-integer sx is how we do the "squash-flip" spin without
  //             ctx.rotate: the canvas is low-res and smoothing is off, so the
  //             result still snaps to whole pixels and stays crisp.
  //   alpha   : opacity 0..1
  //   mode    : 'n' | 'w' | 'k' (see get())
  //   anchor  : 'bc' bottom-centre (default) | 'c' centre | 'tl' top-left
  function draw(ctx, name, x, y, o = {}) {
    const c = get(name, o.mode || 'n');
    const sx = o.sx ?? o.s ?? 1, sy = o.sy ?? o.s ?? 1;
    if (sx === 0 || sy === 0) return;
    const ax = o.anchor === 'tl' ? 0 : c.width / 2;
    const ay = o.anchor === 'tl' ? 0 : o.anchor === 'c' ? c.height / 2 : c.height;
    ctx.save();
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(sx, sy);
    ctx.drawImage(c, -ax, -ay);
    ctx.restore();
  }

  function size(name) { const c = get(name); return { w: c.width, h: c.height }; }
  function names() { return Object.keys(S).concat(Object.keys(VARIANTS)); }

  root.Sprites = { get, draw, size, names, raw: S };
})(window);
