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

    // -------------------------------------------------------------------------
    // RAVANA — ten crowned heads (one large centre head, 4 heads on one side
    // and 5 on the other), gold collar and belt, maroon armour skirt, curved
    // sword. 48 × 48, faces the viewer. Reference: ravana.png
    //   E = glowing eye pixels (scenes find these with Sprites.points())
    //   h/u = skin   q/y/G = gold   m/p = maroon armour + folds   s/w = blade
    // Built from three small hand-drawn parts (side head 5×10, centre head
    // 10×17, body) stamped together, then pasted here as one grid.
    // -------------------------------------------------------------------------
    ravana: { f: [
      '.....................kk.........................',
      '....................kyyk........................',
      '....................kqqk........................',
      '...................kyqqyk.......................',
      '...................kqrrqk.......................',
      '..................kyqrrqyk......................',
      '..................kyqqqqyk......................',
      '..k...k...k...k..kGqyqqyqGk..k...k...k...k...k..',
      '.kyk.kyk.kyk.kyk.kuhhhhhhuk.kyk.kyk.kyk.kyk.kyk.',
      'kqrqkqrqkqrqkqrqkkhhhwwhhhkkqrqkqrqkqrqkqrqkqrqk',
      'kGqGkGqGkGqGkGqGkkhkkhhkkhkkGqGkGqGkGqGkGqGkGqGk',
      'khhhkhhhkhhhkhhhkkhEEhhEEhkkhhhkhhhkhhhkhhhkhhhk',
      'kEhEkEhEkEhEkEhEkkhhhuuhhhkkEhEkEhEkEhEkEhEkEhEk',
      'khuhkhuhkhuhkhuhkkkkkkkkkkkkhuhkhuhkhuhkhuhkhuhk',
      'kkkkkkkkkkkkkkkkkkkhhrrhhkkkkkkkkkkkkkkkkkkkkkkk',
      '.khk.khk.khk.khk..khhhhhhk..khk.khk.khk.khk.khk.',
      '..k...k...k...k....kkkkkk....k...k...k...k...k..',
      '...................kuhhuk.......................',
      '...........kqqqkkqyqqqqqqyqkkqqqk...............',
      '..........kqyqqkqyqrqqqqrqyqkqqyqk..............',
      '..........kGqqGkkqyqqrrqqyqkkGqqGk..............',
      '..........kkGGkhhkqyqqqqyqkhhkGGkk..............',
      '..........khhkuhhhhkqyyqkeehhukhhk..............',
      '..........kqqkuhhhhhkrrkeehhhukqqk..............',
      '..........khhkuhhhhhhuueehhhhukhhk..............',
      '..........khhkuhhhhhhueehhhhhukhhk..............',
      '..........khhkuhhhhhheehhhhhhukuhhk.............',
      '..........kqqkuhhhhheeuhhhhhhukhqqk.............',
      '.........khhhhkhhuheeuhhuhhukhkhhk..............',
      '.........kkkkkqqyqqqyrryqqqyqkhhk...............',
      '.......kqyqqkkGGGGGGGGGGGGGGGGk.................',
      '........kswk.kmmpmmmpmmmpmmpmmk.................',
      '........kswk.kmmpmmmpmmmpmmpmmk.................',
      '.......kswk..kmmpmmmpmmmpmmpmmk.................',
      '.......kswk..kmmpmmmpmmmpmmpmmk.................',
      '......kswk..kmmmpmmmpmmmpmmpmmmk................',
      '.....kswk...kmmmpmmmpkkmpmmpmmmk................',
      '.....kswk...kmmmpmmmpkkmpmmpmmmk................',
      '....kswk....kmmmpmmmpkkmpmmpmmmk................',
      '...kswk....kyqqyqqyqqkkqyqqyqqyqk...............',
      '..kswk.....kqqyqqyqqykkyqqyqqyqqk...............',
      '.kswk......kqyqqyqqyqkkqqyqqyqqyk...............',
      '.ksk..........khhhk...kk...khhhk................',
      '.k............khuhk........khuhk................',
      '..............kqqqk........kqqqk................',
      '.............kuuuuk........kuuuuk...............',
      '.............kuuuuuk......kuuuuuk...............',
      '.............kkkkkkk......kkkkkkk...............',
    ] },

    // -------------------------------------------------------------------------
    // RAMA — walking frame. Same as rama_stand down to the knees; the legs are
    // in mid-stride. The walk cycle alternates rama_stand ↔ rama_step.
    // -------------------------------------------------------------------------
    rama_step: { f: [
      '................................',
      '................................',
      '................................',
      '..............k.................',
      '.............kyk................',
      '.............kqk................',
      '............kyqGk...............',
      '...........kyqqqGk..............',
      '..........kyqqqqqGk.............',
      '.........kyqqqirqqGk............',
      '.........kyqqqrrqqGk......kyk...',
      '.........kyqyqqqyqGk......ukyk..',
      '.........kyqqqqqqqGk......u.kyk.',
      '...w.w...kGqyqqqyqGk......u.kqk.',
      '..wswsw.knenBBBBrBBBk.....u.kqk.',
      '...khkh.kenNBkkBBkkBk.....u.kqk.',
      '...kqqqqknkNBwkBBwkBk.....u.kqk.',
      '...khhhukenNBBBBBBBBBk....u.kqk.',
      '...khhhuknqNBBBBNNBBk.....u.kqk.',
      '...khhhukenNNBBBBBBk......u.kqk.',
      '....khhukneekNNBBk........u..kqk',
      '.....kNBenBqBBBBqBBhNk....u..kqk',
      '.....kNBBBBBqBBqBBhBBNk...u..kqk',
      '.....kNBBBBBByqBBhBBBNk...u..kqk',
      '.....kNBkNBBBrBBhBkqyqk...u..kqk',
      '.....kNBkNBBBBBhBBkNBBk...u..kqk',
      '.....kNBkNBBBBhBBBkNBBBk..u..kqk',
      '.....kNBkNBBBhBBBBkNBBkkkkkkkkqk',
      '.....kNBkNBBhBBBBBkNBBBqBBBBBBrk',
      '.....kNBkNBhBBBBBBkkNNNqNNNNNNrk',
      '.....kqqkNhBBBBBBNk.kkkkkkkkkkrk',
      '.....kNBkkFFFFFFFFk.......u..krk',
      '.....kNNkkFqFFFqFFk.......u..kqk',
      '......kkkyyyFqFyyyqk......u..kqk',
      '.......kyyqyFqFyyyqqk.....u..kqk',
      '.......kyyqyFqFyyqyqk.....u..kqk',
      '......kyyyqyFqFyyyqyqk....u..kqk',
      '......kyyyqyFqFyyyqyqk....u.kqk.',
      '......kyyyqyyFyyyyqyqk....u.kqk.',
      '......kyyyqyyGyyyyqyqk....u.kqk.',
      '......kyyyqyqkkqyyyqqk....u.kqk.',
      '.....kyyyqyk...kyyyqyqk...u.kqk.', // stride: back foot lifts, front foot forward
      '....kyyqyqk.....kyyyqqk...u.kqk.',
      '....kqyqqk.......kyqyqk...u.kqk.',
      '....kGGGk........kGGGk....u.kyk.',
      '....kBBNk........kBBNk....ukyk..',
      '...kBBBk.........kBBBBNk..kyk...',
      '...kkkk..........kkkkkkk...k....',
    ] },

    // -------------------------------------------------------------------------
    // RAMA — drawing the bow (scene 2b close-up). Reference: rama_bow_closeup.png
    // Head, dhoti and legs are identical to rama_stand. The arms are horizontal:
    // the back hand is pulled to his chin, the front arm locks the bow out.
    // The bow is bent further than when standing because it's under tension.
    // NOTE: the bowSTRING and the arrow are NOT in this grid. scenes.js draws
    // them as lines between these points, so they can crackle with
    // electricity and snap straight on release:
    //   top tip (26,4)   bottom tip (26,38)   hand / nock point (16,20)
    // -------------------------------------------------------------------------
    rama_draw: { f: [
      '................................',
      '................................',
      '................................',
      '..............k.................',
      '.............kyk.........kyk....',
      '.............kqk..........kyk...',
      '............kyqGk..........kyk..',
      '...........kyqqqGk..........kyk.',
      '..........kyqqqqqGk.........kqk.',
      '.........kyqqqirqqGk.........kqk',
      '.........kyqqqrrqqGk.........kqk',
      '.........kyqyqqqyqGk.........kyk',
      '.........kyqqqqqqqGk.........kyk',
      '...w.w...kGqyqqqyqGk.........kyk',
      '..wswsw.knenBBBBrBBBk........kyk',
      '...khkh.kenNBkkBBkkBk........kqk',
      '...kqqqqknkNBwkBBwkBk........kqk',
      '...khhhukenNBBBBBBBBBk.......kqk',
      '...khhhuknqNBBBBNNBBk........kqk',
      '...khhhukenNNBBBBBBk.........kqk',
      '....khhukneekNNBBk...........krk',
      '..kkkkkkkkkkkkkkkBkkkkkkkkkkBBrk',
      '..kNBBBBBBBqBBBBkBBBqBBBBBBBBBrk',
      '..kNNNNNNNNNNNNNkhNNNNNNNNNNNNrk',
      '...kkkkkkkkkkkkkhBkkkkkkkkkkkkrk',
      '........kNBBBBBhBBk..........krk',
      '........kNBBBBhBBBk..........kqk',
      '........kNBBBhBBBBk..........kqk',
      '........kNBBhBBBBBk..........kqk',
      '........kNBhBBBBBBk..........kqk',
      '........kNhBBBBBBNk..........kqk',
      '........kkFFFFFFFFk..........kqk',
      '........kkFqFFFqFFk..........kqk',
      '......kkkyyyFqFyyyqk.........kqk',
      '.......kyyqyFqFyyyqqk.......kqk.',
      '.......kyyqyFqFyyqyqk.......kyk.',
      '......kyyyqyFqFyyyqyqk.....kyk..',
      '......kyyyqyFqFyyyqyqk....kyk...',
      '......kyyyqyyFyyyyqyqk...kyk....',
      '......kyyyqyyGyyyyqyqk..........',
      '......kyyyqyqkkqyyyqqk..........',
      '......kyyyqyk.kyyyqyqk..........',
      '......kyyqyqk.kyyyqqk...........',
      '......kqyqqk...kyqyqk...........',
      '.......kGGGk...kGGGk............',
      '.......kBBNk...kBBNk............',
      '......kBBBNk...kBBBBNk..........',
      '......kkkkkk...kkkkkkk..........',
    ] },

    // -------------------------------------------------------------------------
    // ARROW — 16 × 5, flies to the right. Red and white fletching, wooden
    // shaft, steel head. Reference: props/arrow.png (turned horizontal).
    // -------------------------------------------------------------------------
    arrow: { f: [
      '.rw.........k...',
      'rwwk........ksk.',
      'kkhhhhhhhhhhhssw',
      'rwwk........ksk.',
      '.rw.........k...',
    ] },

    // -------------------------------------------------------------------------
    // TEMPLE — 96 × 80, HALF sprite (48 columns, mirrored by rowsOf()).
    // Reference: objects/temple.png. Top to bottom: gold kalash, ribbed
    // amalaka stone, curved orange shikhara tower with cream ribs, cornice,
    // mandapa hall with pillars, bells and a dark arched door under a marigold
    // toran, then plinth, side platforms and stone steps.
    // The saffron flag is NOT here — scenes.js draws it so it can wave.
    //   o/x/f/h = orange, tan, cream, shadow stone   q/y/G = gold
    //   F/o + g = marigolds and leaves   s/w/d = steps
    // -------------------------------------------------------------------------
    temple: { h: [
      '...............................................k',
      '..............................................ky',
      '..............................................kq',
      '.............................................kyq',
      '............................................kyqq',
      '............................................kyqq',
      '.............................................kGq',
      '..............................................kq',
      '.............................................kyq',
      '............................................kqqq',
      '.......................................kkkkkkkkk',
      '......................................kfxfxfxfxf',
      '.....................................kxhxhxhxhxh',
      '......................................kkkkkkkkkk',
      '......................................khxooxofff',
      '....................................khoxxxooofff',
      '...................................khooxxoooofff',
      '...................................khooxxoooofff',
      '..................................khhhhhhhhhhxxx',
      '.................................khoooxxxoooofff',
      '................................khoooxoxxoooofff',
      '................................khoooxoxxoooofff',
      '...............................khoooxooxxoooofff',
      '...............................khhhhhhhhhhhhhxxx',
      '..............................khoooxoooxxoooofff',
      '..............................khoooxoooxxoooofff',
      '.............................khoooxooooxxoooofff',
      '.............................khoooxooooxxoooofff',
      '............................khhhhhhhhhhhhhhhhxxx',
      '............................khoooxoooooxxoooofkk',
      '...........................khoooxooooooxxooookuu',
      '...........................khoooxooooooxxooookuu',
      '..........................khoooxoooooooxxooookuu',
      '..........................khhhhhhhhhhhhhhhhhhkkk',
      '.........................khoooxooooooooxxoooofff',
      '.........................khoooxooooooooxxoooofff',
      '........................khoooxoooooooooxxoooofff',
      '........................khoooxoooooooooxxoooofff',
      '.......................khhhhhhhhhhhhhhhhhhhhhxxx',
      '.......................khoooxooooooooooxxoooofff',
      '.......................khoooxooooooooooxxoooofff',
      '......................khoooxoooooooooooxxoooofff',
      '......................khoooxoooooooooooxxoooofff',
      '.....................khhhhhhhhhhhhhhhhhhhhhhhxxx',
      '.....................khoooxooooooooooooxxoooofff',
      '....kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '....kfffffffffffffffffffffffffffffffffffffffffff',
      '....kxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      '.....koooooooooooooooooooooooooooooooooooooooooo',
      '.....khhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh',
      '.......khqqqqqqxxxxxxxxxxqqqqqqxxxxxxxxxxxxxxxxx',
      '.......khGGGGGGxxxxxxxxxxGGGGGGxxxxxxxxxxxxxxxxx',
      '.......khxffxhxxxxxxkxxxxxffxhxxxxxxxxxxxxxxxxxx',
      '.......khxffxhxxxxxxkxxxxxffxhxxxxxxkxxkkkkkkkkk',
      '.......khxffxhxxxxxkqkxxxxffxhxxxxxxkxkkkkkkkkkk',
      '.......khxffxhxxxxkqyqkxxxffxhxxxxoFoFoFokkkkkkk',
      '.......khxffxhxxxxkGGGkxxxffxhxxxxFFqFFqFFoFoFoF',
      '.......khxffxhxxxxxxkxxxxxffxhxxxxxgkuuguFqFFqFF',
      '.......khxffxhxxxxxxxxxxxxffxhxxxxxxkuukuuuguuug',
      '.......khxffxhxxxxxxxxxxxxffxhxxxxxxkuukuuuuuuuu',
      '.......khxffxhxxxxxxxxxxxxffxhxxxxxxkuukuuuuuuuu',
      '.......khxffxhxxxxxxxxxxxxffxhxxxxxxkuukuuuuuuuu',
      '.......khxffxhxxxxxxxxxxxxffxhxxxxxxkuukuuuuuuuu',
      '.......khxffxhxxxxxxxxxxxxffxhxxxxxxkuukuuuuuuuu',
      '.......khxffxhxxxxxxxxxxxxffxhxxxxxxkuukuuuuuuuu',
      '.......khxffxhxxxxxxxxxxxxffxhxxxxxxkuukuuuuuuuu',
      '.......khxffxhxxxxxxxxxxxxffxhxxxxxxkuukuuuuuuuu',
      '.......khxffxhxxxxxxxxxxxxffxhxxxxxxkuukuuuuuuuu',
      '.......khxffxhxxxxxxxxxxxxffxhxxxxxxkuukuuuuuuuu',
      '.......khxffxhxxxxxxxxxxxxffxhxxxxxxkuukuuuuuuuu',
      '.......khqqqqqqxxxxxxxxxxqqqqqqxxxxxkuukuuuuuuuu',
      '.......khxffxhxxxxxxxxxxxxffxhxxxxxxkuukuuuuuuuu',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '..kddddddddddddddddddddddddddddddddddddddddddddd',
      '..kssssssssssssssssskdddddddddddddkwwwwwwwwwwwww',
      '..kdddddddddddddddddkdddddddddddddksssssssssssss',
      '..kssssssssssssssssskdddddddddkwwwwwwwwwwwwwwwww',
      '..kssssssssssssssssskdddddddddksssssssssssssssss',
      '..kdddddddddddddddddkdddddkwwwwwwwwwwwwwwwwwwwww',
      '..kssssssssssssssssskdddddksssssssssssssssssssss',
    ] },

    // -------------------------------------------------------------------------
    // DIYA — 8 × 8 clay oil lamp, half sprite. Two frames so the flame
    // flickers: scenes alternate diya ↔ diya_b. Reference: props/diya.png
    // -------------------------------------------------------------------------
    diya: { h: [
      '...o',
      '..oy',
      '..yw',
      '...u',
      'kxqq', // rim, with the shine of the oil
      'khxx',
      '.khh',
      '..kk',
    ] },
    diya_b: { h: [
      '....',
      '...o',
      '..oy',
      '..yw',
      'kxqq',
      'khxx',
      '.khh',
      '..kk',
    ] },

    // -------------------------------------------------------------------------
    // SITA — in prayer, hands folded (namaste). 32 × 48, HALF sprite (16 cols
    // mirrored), since the pose faces the viewer and is symmetric.
    // Reference: sita_prayer.png — gold crown with ruby, black hair with a
    // centre parting, bindi, gold earrings, green blouse, red saree with gold
    // dots and a gold + green border.
    //   f/x skin   e/k hair   g blouse   r/m saree + pleats   q/y/G gold
    // -------------------------------------------------------------------------
    sita_pray: { h: [
      '................',
      '................',
      '................',
      '...............k',
      '..............ky',
      '.............kyq',
      '............kyqr',
      '...........kyqqq',
      '..........kGqyqq',
      '.........kGqqrqq',
      '........kkkeeeek',
      '.......keekfffff',
      '.......keekffffr',
      '.......keekfxxff',
      '.......keekfkkff',
      '.......kqekffffx',
      '.......kyekffffr',
      '.......keekkfffx',
      '.......keeeeekxf',
      '......keeekkkkgq',
      '......kekgggggqy',
      '......kekgggggqr',
      '......kekggggkkf',
      '......kekfgggkff',
      '......kekffggkfx',
      '......kekffgkffx',
      '......kekfkqyqfx',
      '......keekfkgqqk',
      '......keekkggrrr',
      '......keekkqyqqy',
      '.......kk.krrrmr',
      '.........krrrmrr',
      '.........kryrmrr',
      '.........krrrmrr',
      '........krrrrmry',
      '........kryrrmrr',
      '........krrrrmrr',
      '........krrryrmr',
      '.......krrrrrmrr',
      '.......kryrrrmrr',
      '.......krrrrrmrr',
      '.......kqqqqqqqq',
      '.......kgggggggg',
      '.......kkkkkkkkk',
      '.........kxffk..',
      '........kfffffk.',
      '........kkkkkkk.',
      '................',
    ] },

    // -------------------------------------------------------------------------
    // PUSHPAK VIMAN — 64 × 32, the flying chariot, facing right.
    // Reference: objects/pushpak_viman.png. A golden boat hull with a zigzag
    // band, a scroll-curled stern, a white swan-head prow with an orange beak,
    // and a domed pavilion in which tiny Rama (blue face, gold crown, saffron)
    // and Sita (red saree) ride home. Flag poles at (10,5) and (50,5): the
    // flags are drawn in code so they can flutter. Clouds are drawn in code.
    // -------------------------------------------------------------------------
    viman: { f: [
      '.................................kyk............................',
      '................................kyqqk...........................',
      '..............................kyqrrqqqk.........................',
      '............................kyqqqqqqqqqk.................kkk....',
      '..........................kyqqqqqqqqqqqqk...............kwwwk...',
      '..........q.............kyqqqqqqqqqqqqqqqk........q.....kwkwkoo.',
      '..........u...........kyqqqqqqqqqqqqqqqqqqk.......u.....kwwwkkk.',
      '..........u..........kkkkkkkkkkkkkkkkkkkkkkk......u......kwwk...',
      '..........u............kqkuuukykuuuuuuuukqk.......u......kwwk...',
      '..kkk.....u............kqkuukyqqkuukqkuukqk.......u.....kwwk....',
      '.kyqqk....u............kqkuukBBBkukkfkkukqk.......u.....kwwk....',
      'kyk.kqk...u............kqkuukBkBkukfkfkukqk.......u....kwwk.....',
      'kqk..kq...u............kqkuukBBBkukfffkukqk.......u....kwwk.....',
      '.kk..kq...u............kqkuuukkkuuukrkuukqk.......u...kwwwk.....',
      '.....kq...u............kqkuukFFFkukrrrkukqk.......u...kwwwk.....',
      '.....kq...u............kqkuukFFFkukrrrkukqk.......u..kqwwwk.....',
      '....kqqkkkkkkkkkkkkkkkkkqkkkkkkkkkkkkkkkkqkkkkkkkkkkkyqqqk......',
      '.....kyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyykwwkyykqqqk.......',
      '.....kGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGkwskGGGGGGk.......',
      '.....kqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqkkqqqqqqqk.......',
      '.....kGGyyGGyyGGyyGGyyGGyyGGyyGGyyGGyyGGyyGGyyGGyyGGyyGGk.......',
      '.....kGyyGGyyGGyyGGyyGGyyGGyyGGyyGGyyGGyyGGyyGGyyGGyyGGyk.......',
      '.....kqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqk.......',
      '.....kqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqk.........',
      '.......kqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqk...........',
      '.........kGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGk.............',
      '...........kGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGk...............',
      '.............kGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGk.................',
      '.................kkkkkkkkkkkkkkkkkkkkkkkkkkkkkk.................',
      '................................................................',
      '................................................................',
      '................................................................',
    ] },

    // -------------------------------------------------------------------------
    // LAKSHMAN — 32 × 48. Same stance as rama_stand (brothers, side by side),
    // recoloured to match lakshman.png: peach skin (f/x) and a pale-green
    // dhoti (L/g). Saffron sash and gold crown are kept.
    // -------------------------------------------------------------------------
    lakshman: { f: [
      '................................',
      '................................',
      '................................',
      '..............k.................',
      '.............kyk................',
      '.............kqk................',
      '............kyqGk...............',
      '...........kyqqqGk..............',
      '..........kyqqqqqGk.............',
      '.........kyqqqirqqGk............',
      '.........kyqqqrrqqGk......kyk...',
      '.........kyqyqqqyqGk......ukyk..',
      '.........kyqqqqqqqGk......u.kyk.',
      '...w.w...kGqyqqqyqGk......u.kqk.',
      '..wswsw.knenffffrfffk.....u.kqk.',
      '...khkh.kenxfkkffkkfk.....u.kqk.',
      '...kqqqqknkxfwkffwkfk.....u.kqk.',
      '...khhhukenxfffffffffk....u.kqk.',
      '...khhhuknqxffffxxffk.....u.kqk.',
      '...khhhukenxxffffffk......u.kqk.',
      '....khhukneekxxffk........u..kqk',
      '.....kxfenfqffffqffhxk....u..kqk',
      '.....kxfffffqffqffhffxk...u..kqk',
      '.....kxffffffyqffhfffxk...u..kqk',
      '.....kxfkxfffrffhfkqyqk...u..kqk',
      '.....kxfkxfffffhffkxffk...u..kqk',
      '.....kxfkxffffhfffkxfffk..u..kqk',
      '.....kxfkxfffhffffkxffkkkkkkkkqk',
      '.....kxfkxffhfffffkxfffqffffffrk',
      '.....kxfkxfhffffffkkxxxqxxxxxxrk',
      '.....kqqkxhffffffxk.kkkkkkkkkkrk',
      '.....kxfkkFFFFFFFFk.......u..krk',
      '.....kxxkkFqFFFqFFk.......u..kqk',
      '......kkkLLLFgFLLLgk......u..kgk',
      '.......kLLgLFgFLLLggk.....u..kgk',
      '.......kLLgLFgFLLgLgk.....u..kgk',
      '......kLLLgLFgFLLLgLgk....u..kgk',
      '......kLLLgLFgFLLLgLgk....u.kgk.',
      '......kLLLgLLFLLLLgLgk....u.kgk.',
      '......kLLLgLLGLLLLgLgk....u.kgk.',
      '......kLLLgLgkkgLLLggk....u.kgk.',
      '......kLLLgLk.kLLLgLgk....u.kgk.',
      '......kLLgLgk.kLLLggk.....u.kgk.',
      '......kgLggk...kLgLgk.....u.kgk.',
      '.......kGGGk...kGGGk......u.kyk.',
      '.......kffxk...kffxk......ukyk..',
      '......kfffxk...kffffxk....kyk...',
      '......kkkkkk...kkkkkkk.....k....',
    ] },

    // -------------------------------------------------------------------------
    // HANUMAN — 32 × 48, faces right (flip with sx: -1 to face left).
    // Reference: hanuman.png. Orange-red body (o/r) with a lighter muzzle (f),
    // gold crown and necklace, red loincloth with gold belt, gold gada resting
    // in his hand, and his tail curling up behind his back.
    // Built on the same body as rama_stand so the court figures match.
    // -------------------------------------------------------------------------
    hanuman: { f: [
      '................................',
      '................................',
      '................................',
      '..............k.................',
      '.............kyk................',
      '.............kqk..........kkkk..',
      '............kyqGk........kyyqqk.',
      '...........kyqqqGk......kyyqqqGk',
      '..........kyqqqqqGk.....kyqGqqGk',
      '.........kyqqqirqqGk....kqqGqGGk',
      '.........kyqqqrrqqGk....kqqqGGGk',
      '.........kyqyqqqyqGk.....kGGGGk.',
      '.........kyqqqqqqqGk......kqqk..',
      '.........kGqyqqqyqGk......kqk...',
      '........knenooooroook.....kqk...',
      '........kenrokkookkok.....kqk...',
      '........knkrowkoowkok.....kqk...',
      '....kk..kenroooffffffk....kqk...',
      '...koorkknqrooofrrffk.....kqk...',
      '..korkorkenrrooffffk......kqk...',
      '.kork.k.kneekrrook........kqk...',
      '.korkkroenoqooooqooork....kqk...',
      'kork.kroooooqooqooooork...kqk...',
      'kork.krooooooyqoooooork...kqk...',
      'kork.krokrooorooookqyqk...kqk...',
      'kork.krokrooooooookrook...kqk...',
      'kork.krokrooooooookroook..kqk...',
      'kork.krokrooooooookrookkkkkkkk..',
      'kork.krokrooooooookroooqoooooo..',
      'kork.krokrooooooookkrrrqrrrrrr..',
      '.korkkqqkrooooooork.kkkkkkkkkk..',
      '.korkkrokkqqqqqqqqk.............',
      '..korkrrkkqqqqqqqqk.............',
      '...korkkkrrrqmqrrrmk............',
      '....k..krrmrqmqrrrmmk...........',
      '.......krrmrqmqrrmrmk...........',
      '......krrrmrqmqrrrmrmk..........',
      '......krrrmrqmqrrrmrmk..........',
      '......kooorooooooorork..........',
      '......kooorooroooorork..........',
      '......kooororkkrooorrk..........',
      '......kooorok.kooorork..........',
      '......koorork.kooorrk...........',
      '......krorrk...korork...........',
      '.......kGGGk...kGGGk............',
      '.......koork...koork............',
      '......kooork...koooork..........',
      '......kkkkkk...kkkkkkk..........',
    ] },

    // -------------------------------------------------------------------------
    // RAMA SEATED — 32 × 48 (scene 6). Upper body identical to rama_stand,
    // with a seated lap, shins and feet. He keeps his bow at his side.
    // Reference: rama_throne.png
    // -------------------------------------------------------------------------
    rama_seated: { f: [
      '................................',
      '................................',
      '................................',
      '................................',
      '..............k.................',
      '.............kyk................',
      '.............kqk................',
      '............kyqGk...............',
      '...........kyqqqGk..............',
      '..........kyqqqqqGk.............',
      '.........kyqqqirqqGk............',
      '.........kyqqqrrqqGk......kyk...',
      '.........kyqyqqqyqGk......ukyk..',
      '.........kyqqqqqqqGk......u.kyk.',
      '...w.w...kGqyqqqyqGk......u.kqk.',
      '..wswsw.knenBBBBrBBBk.....u.kqk.',
      '...khkh.kenNBkkBBkkBk.....u.kqk.',
      '...kqqqqknkNBwkBBwkBk.....u.kqk.',
      '...khhhukenNBBBBBBBBBk....u.kqk.',
      '...khhhuknqNBBBBNNBBk.....u.kqk.',
      '...khhhukenNNBBBBBBk......u.kqk.',
      '....khhukneekNNBBk........u..kqk',
      '.....kNBenBqBBBBqBBhNk....u..kqk',
      '.....kNBBBBBqBBqBBhBBNk...u..kqk',
      '.....kNBBBBBByqBBhBBBNk...u..kqk',
      '.....kNBkNBBBrBBhBkqyqk...u..kqk',
      '.....kNBkNBBBBBhBBkNBBk...u..kqk',
      '.....kNBkNBBBBhBBBkNBBBk..u..kqk',
      '.....kNBkNBBBhBBBBkNBBkkkkkkkkqk',
      '.....kNBkNBBhBBBBBkNBBBqBBBBBBrk',
      '.....kNBkNBhBBBBBBkkNNNqNNNNNNrk',
      '.....kqqkNhBBBBBBNk.kkkkkkkkkkrk',
      '.....kNBkkFFFFFFFFk.......u..krk',
      '.....kNNkkFqFFFqFFk.......u..kqk',
      '...kkyyyyyFqFyyyyyyk......u..kqk',
      '..kyyyyqyyFqFyyqyyyyk.....u..kqk',
      '.kyyyqyyyyFqFyyyyqyyyk....u..kqk',
      '.kyyqyyyyyyFyyyyyyqyyk....u.kqk.',
      '.kkkkkkkkkkkkkkkkkkkkk....u.kqk.',
      '..kyqyk......kyqyk........u.kqk.',
      '..kyqyk......kyqyk........u.kqk.',
      '..kyqyk......kyqyk........u.kqk.',
      '..kGGGk......kGGGk........u.kqk.',
      '..kBBNk......kBBNk........u.kqk.',
      '.kBBBNk.....kBBBBNk.......u.kyk.',
      '.kkkkkk.....kkkkkkk.......ukyk..',
      '..........................kyk...',
      '...........................k....',
    ] },

    // -------------------------------------------------------------------------
    // SITA SEATED — 32 × 48, half sprite. Upper body identical to sita_pray,
    // saree spread over a seated lap. Reference: sita_throne.png
    // -------------------------------------------------------------------------
    sita_seated: { h: [
      '................',
      '................',
      '................',
      '................',
      '...............k',
      '..............ky',
      '.............kyq',
      '............kyqr',
      '...........kyqqq',
      '..........kGqyqq',
      '.........kGqqrqq',
      '........kkkeeeek',
      '.......keekfffff',
      '.......keekffffr',
      '.......keekfxxff',
      '.......keekfkkff',
      '.......kqekffffx',
      '.......kyekffffr',
      '.......keekkfffx',
      '.......keeeeekxf',
      '......keeekkkkgq',
      '......kekgggggqy',
      '......kekgggggqr',
      '......kekggggkkf',
      '......kekfgggkff',
      '......kekffggkfx',
      '......kekffgkffx',
      '......kekfkqyqfx',
      '......keekfkgqqk',
      '......keekkggrrr',
      '......keekkqyqqy',
      '.......kk.krrrmr',
      '.........krrrmrr',
      '.........kryrmrr',
      '......krrryrrmrr',
      '.....krryrrrrmrr',
      '....krrrrrryrmrr',
      '....kqqqqqqqqqqq',
      '....kggggggggggg',
      '....kkkkkkkkkkkk',
      '........krrmrrrr',
      '........krrmrrrr',
      '........kqqqqqqq',
      '........kggggggg',
      '.........kxffk..',
      '........kfffffk.',
      '........kkkkkkk.',
      '................',
    ] },

    // -------------------------------------------------------------------------
    // THRONE — 80 × 56, half sprite. Tall arched back in red velvet with gold
    // frame and medallions, round cushioned armrests, seat, carved gold base,
    // red footstool. Designed from the throne in rama_throne.png / sita_throne.png
    // but wide enough for two.
    // -------------------------------------------------------------------------
    throne: { h: [
      '....................................kqqy',
      '...................................kqqyq',
      '..................................kqqqqq',
      '.................................kqqqqqq',
      '.............................kqykqqqqqqq',
      '..........................kqyqrkqqqqqqqq',
      '........................kqyqrmrrrrrrrrrr',
      '.......................kqyqrmrrrrrrrrrrr',
      '......................kqyqrmrrrrrrrrrrrr',
      '.....................kqyqrmrrryrrrrrrrrr',
      '....................kqyqrmrrryyyrrrrrrrr',
      '...................kqyqrmrrrrryrrrrrrrrr',
      '..................kqyqrmrrrrrrrrrrrrrrrr',
      '.................kqyqrmrrrrrrrrrrrrrrrrr',
      '................kqyqrmrrrrrrrrrrrrrrrrrr',
      '................kqyqrmrrrrrrrryrrrrrrrrr',
      '...............kqyqrmrrrrrrrryyyrrrrrrrr',
      '..............kqyqrmrrrrrrrrrryrrrrrrrrr',
      '..............kqyqrmrrrrrrrrrrrrrrrrrrrr',
      '.............kqyqrmrrrrrrrrrrrrrrrrrrrrr',
      '............kqyqrmrrrrrrrrrrrrrrrrrrrrrr',
      '............kqyqrmrrrrrrrrrrrryrrrrrrrrr',
      '...........kqyqrmrrrrrrrrrrrryyyrrrrrrrr',
      '...........kqyqrmrrrrrrrrrrrrryrrrrrrrrr',
      '..........kqyqrmrrrrrrrrrrrrrrrrrrrrrrrr',
      '..........kqyqrmrrrrrrrrrrrrrrrrrrrrrrrr',
      '..........kqyqrmrrrrrrrrrrrrrrrrrrrrrrrr',
      '..........kqyqrmrrrrrrrrrrrrrryrrrrrrrrr',
      '..........kqyqrmrrrrrrrrrrrrryyyrrrrrrrr',
      '..........kqyqrmrrrrrrrrrrrrrryrrrrrrrrr',
      '...kqk....kqyqrmrrrrrrrrrrrrrrrrrrrrrrrr',
      '.kqqrqqk..kqyqrmrrrrrrrrrrrrrrrrrrrrrrrr',
      '.qrrrrrq..kqyqrmrrrrrrrrrrrrrrrrrrrrrrrr',
      'kqrrrrrqk.kqyqrmrrrrrrrrrrrrrrrrrrrrrrrr',
      'qrrryrrryyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy',
      'kqrrrrrqkrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr',
      '.qrrrrrqkrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr',
      '.kqqrqqkkrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr',
      '...kqk..kqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
      '........kqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '..kyqqqyGyGGGGyGGGGyGGGGyGGGGyGGGGyGGGGy',
      '..kyqqqyyGGGGyGGGGyGGGGyGGGGyGGGGyGGGGyG',
      '..kyqqqyGGGGyGGGGyGGGGyGGGGyGGGGyGGGGyGG',
      '..kyqqqyGGGyGGGGyGGGGyGGGGyGGGGyGGGGyGGG',
      '..kyqqqyGGyGGGGyGGGGyGGGGyGGGGyGGGGyGGGG',
      '..kyqqqyGyGGGGyGGGGyGGGGyGGGGyGGGGyGGGGy',
      '..kyqqqyyGGGGyGGGGyGGGGyGGGGyGGGGyGGGGyG',
      '..kyqqqyGGGGyGGGGyGGGGyGGGGyGGGGyGGGGyGG',
      '..kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
      '..............kkkkkkkkkkkkkkkkkkkkkkkkkk',
      '..............krrrrrrrrrrrrrrrrrrrrrrrrr',
      '..............krrrrrrrrrrrrrrrrrrrrrrrrr',
      '..............krrrrrrrrrrrrrrrrrrrrrrrrr',
      '..............kqqqqqqqqqqqqqqqqqqqqqqqqq',
      '..............kkkkkkkkkkkkkkkkkkkkkkkkkk',
    ] },

    // -------------------------------------------------------------------------
    // AKASH KANDIL — 12 × 16 hanging lantern, half sprite. Diamond body with
    // rainbow panels and tassels. Reference: props/lantern.png
    // -------------------------------------------------------------------------
    kandil: { h: [
      '.....u',
      '.....u',
      '....kq',
      '...krq',
      '..kryy',
      '.krygg',
      'kcrygg',
      'krygbb',
      '.krygg',
      '..kryy',
      '...krq',
      '....kq',
      '...r.y',
      '..i.g.',
      '...r.y',
      '..o.c.',
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

  // Where are all the pixels of colour `letter` in a sprite, on screen?
  // Pass the same x, y, sx, sy you gave draw() (bottom-centre anchor).
  // Returns the screen-space centre of each matching pixel.
  // Example: Sprites.points('ravana', 'E', 240, 230, 3, 3) → all 20 eyes,
  // so the scene can draw a glow on top of each one.
  const pointCache = {};
  function points(name, letter, x = 0, y = 0, sx = 1, sy = 1) {
    const key = name + ':' + letter;
    if (!pointCache[key]) {
      const rows = resolve(name).rows;
      const h = rows.length, w = rows[0].length;
      const list = [];
      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) if (rows[j][i] === letter) list.push([i + 0.5 - w / 2, j + 0.5 - h]);
      }
      pointCache[key] = list;
    }
    return pointCache[key].map(([px, py]) => ({ x: Math.round(x) + px * sx, y: Math.round(y) + py * sy }));
  }

  // Convert ONE sprite pixel (px, py) to screen coordinates, for a sprite
  // drawn with draw(ctx, name, x, y, {sx, sy}). Used to attach effects to a
  // specific spot, e.g. the bowstring to the bow's tips.
  function at(name, px, py, x, y, sx = 1, sy = 1) {
    const c = get(name);
    return { x: Math.round(x) + (px + 0.5 - c.width / 2) * sx, y: Math.round(y) + (py + 0.5 - c.height) * sy };
  }

  function size(name) { const c = get(name); return { w: c.width, h: c.height }; }
  function names() { return Object.keys(S).concat(Object.keys(VARIANTS)); }

  root.Sprites = { get, draw, points, at, size, names, raw: S };
})(window);
