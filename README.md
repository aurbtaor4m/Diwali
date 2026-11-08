# Happy Diwali — a pixel-art Ramayana greeting card

A 37-second animated Diwali card drawn entirely in code: HTML5 canvas and
vanilla JavaScript, with no frameworks, no build step and no image files at
runtime. Every character is a small text grid of palette letters, and every
effect (fire, fireworks, lightning, rangoli) is computed from the frame number,
so the video looks identical every time it plays or records.

| # | Time | Scene |
|---|------|-------|
| 1 | 0–4 s | **Ravana** spins in over Lanka at night, lands with a shake, eyes glow red |
| 2 | 4–12 s | **Rama** walks in, draws the bow (lightning on the string), the arrow flies with a sparkler trail |
| 3 | 12–17 s | **Victory**: the arrow strikes, Ravana bursts into light, fire sweeps the screen, fireworks |
| 4 | 17–22 s | **Sita** appears in prayer in a golden glow; a rangoli draws itself petal by petal |
| 5 | 22–27 s | **Return to Ayodhya**: the Pushpak Viman crosses the sky; diyas light left to right |
| 6 | 27–31 s | **The court**: Rama and Sita enthroned with Lakshman, Hanuman and followers |
| 7 | 31–37 s | **Temple + title**: through a corridor to the temple, "HAPPY DIWALI", fade to black |

---

## 1. Preview

Browsers block some features on `file://` pages, so serve the folder with a
tiny local web server. Either option works:

**Option A: Python** (in this folder):

```
python -m http.server 8000 --bind 127.0.0.1
```

Then open <http://127.0.0.1:8000> in Chrome or Edge.

**Option B: VS Code Live Server**: open the folder in VS Code and click
**Go Live** in the status bar.

### Controls

| Key | Action |
|-----|--------|
| `Space` | Play / pause (at the end, starts again) |
| `R` | Restart from the beginning |
| `1`–`7` | Jump to a scene |
| `←` / `→` | Step one frame back / forward |
| `T` | Sprite test screen (on it, `←` / `→` choose a sprite) |
| Scrubber | Drag to any moment; hover the bar to make it fully visible |

> **Changes not showing?** Press **Ctrl+F5** to force-reload. Browsers
> sometimes keep an old copy of the `.js` files.

---

## 2. Record the video (WebM)

1. Open the page in **Chrome or Edge** and click **● Record** (bottom right).
2. **Keep the tab visible and in front** for about 38 seconds. The recorder
   paces itself in real time, and browsers slow down timers in background tabs.
3. When it finishes, **`diwali.webm`** downloads automatically. Expect about
   20–25 MB at 1920×1080. It has no audio.

**What "frame-accurate" means here:** the recorder does not capture whatever
happens to be on screen. It steps the timeline through frames 0, 1, 2 … 1109
exactly, draws each one at 4× (1920×1080, nearest-neighbour so pixels stay
square) and hands that exact image to the encoder. A slow frame cannot cause a
skipped or doubled animation step. The playback bar and help text are hidden
while recording and are never part of the video anyway, because recording uses
its own off-screen canvas.

---

## 3. Convert to MP4 for WhatsApp

In the folder where `diwali.webm` was downloaded, run exactly:

```
ffmpeg -i diwali.webm -vf scale=1920:1080:flags=neighbor -c:v libx264 -crf 23 -pix_fmt yuv420p -movflags +faststart diwali.mp4
```

What each part does:

- `scale=1920:1080:flags=neighbor`: guarantees 1080p using nearest-neighbour
  scaling, so pixel edges stay sharp. The recording is already 1080p, so this
  is a safety net.
- `-c:v libx264 -crf 23`: H.264 video, which every phone plays. CRF is the
  quality dial: lower means better quality and a bigger file.
- `-pix_fmt yuv420p`: the colour format WhatsApp and iPhones expect.
- `-movflags +faststart`: puts the index at the start of the file so the video
  starts playing before it has fully downloaded.

### Check the size: it must be under 16 MB

WhatsApp sends videos **under 16 MB** as a normal playable video. Check the
size in File Explorer, or in a terminal:

```
dir diwali.mp4
```

**If `diwali.mp4` is bigger than 16 MB, raise `-crf` to 26–28** and convert
again. Try 26 first, then 28 if needed:

```
ffmpeg -i diwali.webm -vf scale=1920:1080:flags=neighbor -c:v libx264 -crf 26 -pix_fmt yuv420p -movflags +faststart diwali.mp4
```

Each +3 on CRF roughly halves the file size. Flat-colour pixel art usually
compresses very well, so 23 may already fit.

---

## 3½. Add the sound effects (optional)

The sound effects are made **offline**: a script synthesises a 37-second
chiptune track, `sfx.wav`, with every sound placed at the exact video time of
its event. The visuals don't change. The script needs no packages, only Node.

```
node tools/sfx.js
```

This writes `sfx.wav` (44.1 kHz, 16-bit stereo, peak normalised to −1 dB) in
the project folder and prints every cue time. Put `sfx.wav` in the same folder
as `diwali.mp4`, then combine them:

```
ffmpeg -i diwali.mp4 -i sfx.wav -c:v copy -c:a aac -b:a 192k -shortest diwali_sfx.mp4
```

- `-c:v copy` keeps the video exactly as it is (no re-encode, so it's instant
  and loses no quality).
- `-c:a aac -b:a 192k` encodes the sound as AAC, which every phone plays.
- `-shortest` stops at whichever input ends first (both are 37 s).

The sound adds about 0.6 MB, so the result stays well under WhatsApp's 16 MB.

**Tweaking:** every cue is in the **CUE TABLE** near the top of
`tools/sfx.js`, written as `at(scene, secondsIntoScene)`. `at()` converts a
scene time to a video time using the same frame maths as `js/main.js`. Each
line's comment names the `scenes.js` constant it comes from. Volumes are the
`vol` option, or the defaults in the sound library below the table. Re-run the
script after any change.

**No `node` command?** Install Node.js LTS (`winget install OpenJS.NodeJS.LTS`,
then open a new terminal). As a stop-gap, VS Code ships with Node built in. In
PowerShell:

```
$env:ELECTRON_RUN_AS_NODE=1; & "C:\Program Files\Microsoft VS Code\Code.exe" tools\sfx.js
```

(That runs the script but its printed output may not appear. Check that
`sfx.wav` was updated.)

---

## 4. Project layout

```
index.html        page + script tags (loaded in dependency order)
css/style.css     page styling, pixelated canvas scaling, hides the HUD while recording
js/palette.js     PAL: the colour palette (one letter per colour)
js/font.js        5-px bitmap font: draw(), measure(), typed() for the typewriter effect
js/fx.js          seeded randomness + every effect (particles, fireworks, fire, lightning…)
js/sprites.js     every character and prop as text grids, plus the sprite renderer
js/scenes.js      one draw function per scene + the sprite test screen
js/main.js        timeline, playback, keyboard, scrubber, recorder, self-test
tools/sfx.js      offline sound-effects renderer → sfx.wav (Node, no dependencies)
reference/        cardiHero (style reference only, ignored by git)
ramayan_sprites/  the character reference images (visual reference only)
```

---

## 5. How it works (the short version)

**One clock, one rule.** The only state is the frame number (0–1109). For each
frame, `main.js` finds which scene owns that moment and calls
`scene.draw(ctx, p)` with `p` from 0 to 1 through the scene. A draw function
may use **nothing but `p`**: no stored state and no `Math.random()`. That is
why you can scrub to any frame, and why the recording matches the preview
exactly.

**Randomness without `Math.random()`.** `FX.hash(a, b, c)` turns integers into
a repeatable "random" number. For example, particle *i* always gets the same
angle from `hash(i, seed, 1)`. Particle positions are calculated directly from
physics (`x = x0 + vx·t`, `y = y0 + vy·t + ½·g·t²`) rather than moved a little
each frame, so frame 400 never depends on frames 0–399.

**Sprites are text.** In `sprites.js`, each sprite is a list of strings where
every letter is a palette colour (`k` outline, `B` Rama's blue skin, `q` gold,
and so on) and `.` is transparent. `{ h: [...] }` sprites store only the left
half and get mirrored, which is used for symmetric things like Sita, the
temple, the throne and diyas. The first time a sprite is used, it is "baked"
into a tiny canvas; after that, drawing it is one `drawImage` call.

**Crisp pixels everywhere.** The art is drawn on a 480×270 canvas and scaled up
by a whole number (4× = 1920×1080) with smoothing off. Effects use whole-pixel
`fillRect`s (Bresenham lines, span-filled discs) instead of anti-aliased
`arc`/`lineTo`. Ravana's spin squashes `scaleX` instead of rotating, and the
rangoli petals are drawn by "inverse mapping" each pixel, so nothing is ever
rotated or blurred.

**Crossfades.** Each scene has an `xfade` time. During that time, the previous
scene's final frame is laid on top and faded out, so there is never an empty
frame.

---

## 6. Checking it

- **`?selftest`**: open <http://127.0.0.1:8000/?selftest>. It renders all 1110
  frames, flags any error or blank-looking frame, and checks that frame 500 is
  pixel-identical whether you reach it from frame 0 or from frame 1000. The
  result appears in the tab title and the console.
- **Other URL options**: `?scene=3`, `?frame=400` (opens paused there),
  `?test=1` (sprite test screen showing sprite #1), `?autorecord` (starts
  recording on load).

---

## Credits

- Palette, sprite format and bitmap font are adapted from **cardiHero**
  (`reference/`, MIT licence).
- Characters were redrawn as original pixel sprites using the images in
  `ramayan_sprites/` as visual reference only.
- Made by Abhiram Tawalare.
