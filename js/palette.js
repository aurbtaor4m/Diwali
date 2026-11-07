// =============================================================================
// palette.js — the ONE place where colours live.
//
// Every sprite in sprites.js is a grid of letters, and each letter is a key in
// PAL below. Keeping the palette small is what gives pixel art its cohesive
// look: if everything is drawn from the same ~30 colours, everything "matches".
//
// Lowercase letters = the original cardiHero palette (copied from
// reference/js/sprites.js, MIT licence). Uppercase letters = the handful of
// extra colours this card needs (Rama's blue skin, saffron, night sky...).
// =============================================================================
(function (root) {
  'use strict';

  const PAL = {
    // ---- cardiHero base palette (unchanged) --------------------------------
    k: '#1a1c2c', // near-black: outlines
    p: '#5d275d', // plum
    r: '#b13e53', // red (Sita's saree, kumkum)
    o: '#ef7d57', // orange (Hanuman, flames)
    y: '#ffcd75', // pale yellow (dhoti, highlights)
    l: '#a7f070', // lime
    g: '#38b764', // green (saree border, leaves)
    t: '#257179', // teal
    n: '#29366f', // navy (night)
    b: '#3b5dc9', // blue
    c: '#41a6f6', // sky blue (electric arcs)
    a: '#73eff7', // aqua (arc highlight)
    w: '#f4f4f4', // white
    s: '#94b0c2', // steel (arrow head)
    d: '#566c86', // slate
    e: '#333c57', // dark slate
    f: '#f2c19b', // peach skin (Lakshman)
    h: '#8b5a3c', // brown (wood, Ravana's skin)
    u: '#4f2f23', // dark brown (hair shading)
    m: '#73172d', // maroon (Ravana's armour)
    q: '#e6a33c', // gold
    v: '#1e5c3a', // dark green
    i: '#ff8fb0', // pink
    x: '#d9a066', // tan (Lakshman shadow)
    z: '#b55ac8', // violet

    // ---- extras for this card ------------------------------------------------
    B: '#6f9bea', // Rama's skin — light blue
    N: '#4569c4', // Rama's skin — shadow
    G: '#b8741a', // deep gold (shadow side of crowns / bow)
    F: '#ff9a1f', // saffron (Rama's sash, flags)
    D: '#10142e', // deepest night sky
    L: '#9fd8a0', // pale green (Lakshman's dhoti)
  };

  // Handy named aliases so scene code reads like English:
  // e.g. fillRect with COL.night instead of remembering that D is the sky.
  const COL = {
    outline: PAL.k, night: PAL.D, navy: PAL.n, blue: PAL.b, sky: PAL.c, aqua: PAL.a,
    white: PAL.w, gold: PAL.q, deepGold: PAL.G, yellow: PAL.y, orange: PAL.o,
    saffron: PAL.F, red: PAL.r, maroon: PAL.m, green: PAL.g, darkGreen: PAL.v,
    plum: PAL.p, pink: PAL.i, violet: PAL.z, steel: PAL.s, slate: PAL.d, dark: PAL.e,
    brown: PAL.h, darkBrown: PAL.u, teal: PAL.t,
  };

  root.PAL = PAL;
  root.COL = COL;
})(window);
