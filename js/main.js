// =============================================================================
// main.js — timeline, playback, controls and recording.
//
// HOW TIME WORKS
//   The single source of truth is `state.frame`, an integer 0 … TOTAL-1.
//   At 30 fps, frame f is at time t = f / 30 seconds.
//   renderFrame(f) works out which scene owns time t, computes that scene's
//   progress p (0..1), and calls scene.draw(ctx, p).
//
//   - Playing in the browser: a requestAnimationFrame loop advances `frame`
//     according to real elapsed time (so it plays at real speed).
//   - Recording: we ignore real time and step frame = 0, 1, 2 … exactly,
//     drawing every single frame once. Nothing is skipped or doubled.
//
// TWO CANVASES
//   `buf`     : 480×270 — the "true" pixel-art frame. Scenes draw here.
//   `screen`  : the visible canvas, 480·k × 270·k for the largest whole
//               number k that fits the window. We copy buf → screen with
//               imageSmoothingEnabled = false so every art pixel becomes a
//               crisp k×k block.
// =============================================================================
(function () {
  'use strict';

  const W = 480, H = 270, FPS = 30;
  const REC_W = 1920, REC_H = 1080; // export size (4× the art resolution)

  // ---------------------------------------------------------------- timeline
  // Precompute where each scene starts/ends, in frames.
  const timeline = [];
  let acc = 0;
  for (const s of SCENES) {
    const frames = Math.round(s.dur * FPS);
    timeline.push({ scene: s, start: acc, frames });
    acc += frames;
  }
  const TOTAL = acc; // 37 s × 30 = 1110 frames

  function sceneIndexAt(f) {
    for (let i = timeline.length - 1; i >= 0; i--) if (f >= timeline[i].start) return i;
    return 0;
  }

  // ------------------------------------------------------------- canvases
  const screen = document.getElementById('screen');
  const sctx = screen.getContext('2d');

  function makeBuffer() {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    return c;
  }
  const buf = makeBuffer(), bctx = buf.getContext('2d');
  const prevBuf = makeBuffer(), pctx = prevBuf.getContext('2d'); // for crossfades

  // Draw scene i at progress p into context c, starting from a clean state.
  function drawScene(c, i, p) {
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.imageSmoothingEnabled = false;
    c.fillStyle = PAL.k;           // safety net: never a transparent frame
    c.fillRect(0, 0, W, H);
    timeline[i].scene.draw(c, Math.min(1, Math.max(0, p)));
    c.restore();
  }

  // Render frame f of the video into `buf`.
  function renderFrame(f) {
    const i = sceneIndexAt(f);
    const T = timeline[i];
    // p = 0 on the scene's first frame, 1 on its last frame
    const p = T.frames > 1 ? (f - T.start) / (T.frames - 1) : 0;
    drawScene(bctx, i, p);

    // Crossfade: for the first `xfade` seconds of this scene, lay the
    // previous scene's final frame on top and fade it out.
    const xf = Math.round((T.scene.xfade || 0) * FPS);
    const into = f - T.start;
    if (i > 0 && xf > 0 && into < xf) {
      drawScene(pctx, i - 1, 1);
      bctx.save();
      bctx.globalAlpha = 1 - (into + 1) / (xf + 1);
      bctx.drawImage(prevBuf, 0, 0);
      bctx.restore();
    }
  }

  // Copy the 480×270 art onto the big visible canvas, pixel-perfect.
  function present() {
    sctx.imageSmoothingEnabled = false;
    sctx.drawImage(buf, 0, 0, screen.width, screen.height);
  }

  // Pick the largest integer scale that fits the window. We work in *device*
  // pixels (CSS px × devicePixelRatio) — on a laptop with 125% Windows
  // scaling, 1 CSS px is 1.25 real pixels, and ignoring that would make the
  // art pixels uneven.
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const k = Math.max(1, Math.floor(Math.min(window.innerWidth * dpr / W, window.innerHeight * dpr / H)));
    screen.width = W * k;
    screen.height = H * k;
    screen.style.width = (W * k / dpr) + 'px';
    screen.style.height = (H * k / dpr) + 'px';
    redraw();
  }

  // ---------------------------------------------------------------- state
  const state = {
    frame: 0,
    playing: true,
    test: false,          // sprite test screen (T)
    testT0: 0,
    testIdx: 0,           // which sprite the test screen magnifies (←/→)
    recording: false,
    lastTime: 0,
    frac: 0,              // fractional frames carried between rAF ticks
  };

  function redraw() {
    if (state.test) {
      bctx.save();
      bctx.imageSmoothingEnabled = false;
      drawTest(bctx, (performance.now() - state.testT0) / 1000, state.testIdx);
      bctx.restore();
    } else {
      renderFrame(state.frame);
    }
    present();
    updateHud();
  }

  // ------------------------------------------------------------- playback
  function tick(now) {
    if (!state.recording) {
      const dt = Math.min(0.1, (now - state.lastTime) / 1000); // cap after tab switch
      if (state.playing && !state.test) {
        if (sound.src) {
          // Sound is playing: the AUDIO clock decides which frame we show, so
          // picture and sound can never drift apart. outputLatency = how long
          // the sound takes to reach the speakers; subtracting it keeps the
          // picture in step with what you actually hear.
          const c = sound.ctx;
          const heard = Math.max(0, c.currentTime - sound.startCtx - (c.outputLatency || c.baseLatency || 0));
          state.frame = sound.startFrame + Math.floor(heard * FPS);
        } else {
          state.frac += dt * FPS;
          const step = Math.floor(state.frac);
          state.frac -= step;
          state.frame += step;
        }
        if (state.frame >= TOTAL - 1) { state.frame = TOTAL - 1; state.playing = false; }
      }
      syncSound();
      redraw();
    }
    state.lastTime = now;
    requestAnimationFrame(tick);
  }

  function seek(f) {
    state.frame = Math.max(0, Math.min(TOTAL - 1, Math.round(f)));
    state.frac = 0;
    stopSound();   // syncSound() restarts it from the new position on the next tick
  }

  // ---------------------------------------------------------------- sound
  // sfx.wav (made by `node tools/sfx.js`) is played with the Web Audio API:
  // the whole file is decoded into memory once, and each time playback starts
  // we play it from the current frame's time (frame / 30 seconds in).
  // If sfx.wav doesn't exist the page simply stays silent.
  const sound = {
    status: 'loading',   // 'loading' | 'ready' | 'missing'
    ctx: null,           // the AudioContext
    buf: null,           // decoded sfx.wav
    src: null,           // the AudioBufferSourceNode playing right now (or null)
    startCtx: 0,         // ctx.currentTime when that source started
    startFrame: 0,       // the frame it started from
    muted: false,
  };

  async function loadSound() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) throw new Error('no Web Audio');
      const res = await fetch('sfx.wav', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      sound.ctx = new AC();
      sound.buf = await sound.ctx.decodeAudioData(await res.arrayBuffer());
      sound.status = 'ready';
    } catch (e) {
      sound.status = 'missing';
    }
    updateSoundBtn();
  }

  function startSound() {
    const src = sound.ctx.createBufferSource();
    src.buffer = sound.buf;
    src.connect(sound.ctx.destination);
    sound.startCtx = sound.ctx.currentTime;
    sound.startFrame = state.frame;
    src.start(0, state.frame / FPS);   // start playing from this frame's moment
    sound.src = src;
  }

  function stopSound() {
    if (!sound.src) return;
    try { sound.src.stop(); } catch (_) { /* already stopped */ }
    sound.src.disconnect();
    sound.src = null;
  }

  // Called every animation frame: start or stop the sound to match playback.
  function syncSound() {
    const want = sound.status === 'ready' && !sound.muted && state.playing && !state.test
      && !state.recording && sound.ctx.state === 'running';
    if (want && !sound.src) startSound();
    else if (!want && sound.src) stopSound();
  }

  // Browsers only allow sound after the user clicks or presses a key, so the
  // first interaction "unlocks" the AudioContext.
  function unlockSound(e) {
    if (e && e.target === soundBtn) return;   // the sound button handles itself
    if (sound.ctx && sound.ctx.state === 'suspended') sound.ctx.resume().then(updateSoundBtn);
  }
  window.addEventListener('pointerdown', unlockSound);
  window.addEventListener('keydown', unlockSound);

  const soundBtn = document.getElementById('sound');
  function updateSoundBtn() {
    const label = sound.status === 'loading' ? '… sound'
      : sound.status === 'missing' ? 'no sfx.wav'
        : sound.muted ? '🔇 muted'
          : sound.ctx.state !== 'running' ? '🔈 click me' : '🔊 sound';
    if (soundBtn.textContent !== label) soundBtn.textContent = label;
    soundBtn.title = sound.status === 'missing'
      ? 'No sound: run "node tools/sfx.js" to create sfx.wav, then reload'
      : 'Sound on/off (M)';
  }
  function toggleSound() {
    if (sound.status !== 'ready') return;
    if (sound.ctx.state !== 'running') { sound.ctx.resume().then(updateSoundBtn); return; }
    sound.muted = !sound.muted;
    updateSoundBtn();
  }
  soundBtn.addEventListener('click', toggleSound);

  // ---------------------------------------------------------------- HUD
  const hud = document.getElementById('hud');
  const scrub = document.getElementById('scrub');
  const timeLabel = document.getElementById('time');
  const playBtn = document.getElementById('play');
  const recBtn = document.getElementById('rec');
  const status = document.getElementById('status');
  scrub.max = TOTAL - 1;

  // little tick marks on the scrubber showing where scenes start
  const marks = document.getElementById('marks');
  timeline.forEach((T, i) => {
    const m = document.createElement('span');
    m.style.left = (T.start / (TOTAL - 1) * 100) + '%';
    m.textContent = i + 1;
    marks.appendChild(m);
  });

  function updateHud() {
    if (state.recording) return;
    scrub.value = state.frame;
    const i = sceneIndexAt(state.frame);
    const label = state.test ? 'SPRITE TEST' : `${(state.frame / FPS).toFixed(2)}s / ${(TOTAL / FPS).toFixed(0)}s · ${i + 1} ${timeline[i].scene.name}`;
    if (timeLabel.textContent !== label) timeLabel.textContent = label;
    playBtn.textContent = state.playing ? '❚❚' : '▶';
    updateSoundBtn();
  }

  scrub.addEventListener('input', () => { seek(+scrub.value); state.test = false; });
  playBtn.addEventListener('click', togglePlay);
  recBtn.addEventListener('click', () => record(false));
  document.getElementById('recsound').addEventListener('click', () => record(true));

  function togglePlay() {
    if (state.frame >= TOTAL - 1) seek(0); // at the end? start over
    state.playing = !state.playing;
    state.test = false;
  }

  // ------------------------------------------------------------- keyboard
  window.addEventListener('keydown', (e) => {
    if (state.recording) return;
    const k = e.key;
    if (k === ' ') { e.preventDefault(); togglePlay(); }
    else if (k === 'r' || k === 'R') { seek(0); state.playing = true; state.test = false; }
    else if (k === 't' || k === 'T') { state.test = !state.test; state.testT0 = performance.now(); }
    else if (k === 'm' || k === 'M') toggleSound();
    else if (k >= '1' && k <= '9') {
      const i = +k - 1;
      if (i < timeline.length) { seek(timeline[i].start); state.test = false; }
    }
    // ←/→ : on the test screen they pick a sprite; otherwise step one frame
    else if (k === 'ArrowRight') { if (state.test) state.testIdx++; else { state.playing = false; seek(state.frame + 1); } }
    else if (k === 'ArrowLeft') { if (state.test) state.testIdx--; else { state.playing = false; seek(state.frame - 1); } }
  });

  // ------------------------------------------------------------- recording
  // Frame-accurate export, silent or with sound.
  // 1. A hidden 1920×1080 canvas gets each frame scaled up 4× (nearest
  //    neighbour) — we record at full size so video compression can't smear
  //    the art pixels before they're enlarged.
  // 2. captureStream(0) means "only capture when I say so". After drawing
  //    frame f we call track.requestFrame(), handing exactly that image to
  //    the encoder.
  // 3. MediaRecorder stamps frames with the time they arrive, so we hand
  //    frame f over at exactly t0 + f/30 seconds. The CONTENT is driven by the
  //    frame counter, so a slow frame can never cause a skipped animation step.
  // 4. With sound: sfx.wav is played into a MediaStreamAudioDestinationNode
  //    (a "virtual microphone" carrying the sound as a stream track) that is
  //    recorded alongside the video. The frames are then paced by the AUDIO
  //    clock instead of the wall clock, so frame f is captured exactly when
  //    the sound reaches f/30 s — they stay in sync for the whole 37 s.
  async function record(withSound) {
    if (state.recording) return;
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
      alert('This browser cannot record canvas video. Please use Chrome or Edge.');
      return;
    }
    if (withSound && sound.status !== 'ready') {
      alert('sfx.wav is not loaded, so there is no sound to record.\n\nRun "node tools/sfx.js" in the project folder, then reload this page.');
      return;
    }
    const rc = document.createElement('canvas');
    rc.width = REC_W; rc.height = REC_H;
    const rctx = rc.getContext('2d');
    rctx.imageSmoothingEnabled = false;

    const stream = rc.captureStream(0);
    const track = stream.getVideoTracks()[0];
    const manual = typeof track.requestFrame === 'function';
    if (!manual) { // very old browsers: fall back to automatic 30 fps capture
      track.stop();
    }
    const videoStream = manual ? stream : rc.captureStream(FPS);
    const videoTrack = videoStream.getVideoTracks()[0];

    // sound: sfx.wav → (speakers, so you can hear it) + (the recording)
    let audioSrc = null, audioDest = null;
    if (withSound) {
      await sound.ctx.resume();
      stopSound();
      audioDest = sound.ctx.createMediaStreamDestination();
      audioSrc = sound.ctx.createBufferSource();
      audioSrc.buffer = sound.buf;
      audioSrc.connect(audioDest);
      if (!sound.muted) audioSrc.connect(sound.ctx.destination);
    }
    const recStream = new MediaStream([videoTrack, ...(audioDest ? audioDest.stream.getAudioTracks() : [])]);

    const types = withSound
      ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
      : ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    const mimeType = types.find((m) => MediaRecorder.isTypeSupported(m));
    if (!mimeType) { alert('WebM recording is not supported in this browser.'); return; }
    const rec = new MediaRecorder(recStream, { mimeType, videoBitsPerSecond: 16_000_000, audioBitsPerSecond: 192_000 });
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const stopped = new Promise((res) => { rec.onstop = res; });

    state.recording = true;
    state.test = false;
    state.playing = false;
    document.body.classList.add('recording');

    // The clock that paces the frames (in seconds): the audio clock when
    // recording sound, otherwise the ordinary wall clock.
    const clock = withSound ? () => sound.ctx.currentTime : () => performance.now() / 1000;
    const waitUntil = (sec) => new Promise((res) => setTimeout(res, Math.max(0, (sec - clock()) * 1000)));

    try {
      // paint frame 0 before starting so the stream never begins blank
      renderFrame(0);
      rctx.drawImage(buf, 0, 0, REC_W, REC_H);
      rec.start();
      const t0 = clock() + 0.05;                   // a tiny lead-in, then go
      if (audioSrc) audioSrc.start(t0);            // sound starts exactly at frame 0
      for (let f = 0; f < TOTAL; f++) {
        await waitUntil(t0 + f / FPS);             // frame f belongs at t0 + f/30 s
        renderFrame(f);
        rctx.drawImage(buf, 0, 0, REC_W, REC_H);
        if (manual) videoTrack.requestFrame();
        present();                                 // live preview while recording
        state.frame = f;
        if (f % 15 === 0) status.textContent = `● REC${withSound ? ' + SOUND' : ''}  frame ${f + 1}/${TOTAL}  — keep this tab visible`;
      }
      // hold the last frame until the full 37 s have passed, then stop
      await waitUntil(t0 + TOTAL / FPS + 0.25);
      rec.stop();
      await stopped;

      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'diwali.webm';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      status.textContent = `Saved diwali.webm${withSound ? ' with sound' : ''} (${(blob.size / 1e6).toFixed(1)} MB). Convert it with ffmpeg — see README.`;
      if (q.has('autorecord')) console.info(`RECORD OK: ${blob.size} bytes, ${mimeType}`);
    } catch (err) {
      console.warn('Recording failed:', err);
      status.textContent = 'Recording failed: ' + err.message;
      try { if (rec.state !== 'inactive') rec.stop(); } catch (_) { /* already stopped */ }
    } finally {
      recStream.getTracks().forEach((tr) => tr.stop());
      if (audioSrc) { try { audioSrc.stop(); } catch (_) { /* already stopped */ } audioSrc.disconnect(); }
      state.recording = false;
      document.body.classList.remove('recording');
      seek(TOTAL - 1);
      redraw();
      setTimeout(() => { if (!state.recording) status.textContent = ''; }, 8000);
    }
  }

  // ------------------------------------------------------------- self-test
  // Open index.html?selftest to check the whole video without watching it:
  //  1. renders all 1110 frames and catches any error,
  //  2. flags any frame that looks blank (fewer than 3 colours in a sample;
  //     the very last frame is skipped — it's meant to be black),
  //  3. proves determinism: frame 500 must be pixel-identical whether we
  //     arrive at it from frame 0 or from frame 1000.
  function selfTest() {
    const t0 = performance.now();
    const problems = [];
    // read pixels from a separate canvas flagged for frequent reads, so the
    // main buffer stays GPU-fast during normal playback
    const rb = makeBuffer();
    const rbx = rb.getContext('2d', { willReadFrequently: true });
    const pixels = () => { rbx.clearRect(0, 0, W, H); rbx.drawImage(buf, 0, 0); return rbx.getImageData(0, 0, W, H).data; };
    for (let f = 0; f < TOTAL; f++) {
      try { renderFrame(f); } catch (e) { problems.push(`frame ${f}: ${e.message}`); continue; }
      if (f === TOTAL - 1) continue;
      const d = pixels();
      const seen = new Set();
      for (let i = 0; i < d.length && seen.size < 3; i += 4 * 97) seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
      if (seen.size < 3) problems.push(`frame ${f}: looks blank`);
    }
    const grab = () => pixels().join(',');
    renderFrame(0); renderFrame(500); const a = grab();
    renderFrame(1000); renderFrame(500); const b = grab();
    if (a !== b) problems.push('frame 500 differs depending on the previous frame (not deterministic)');
    const ms = Math.round(performance.now() - t0);
    const msg = problems.length
      ? 'SELFTEST FAILED: ' + problems.slice(0, 20).join(' | ')
      : `SELFTEST OK: ${TOTAL} frames rendered in ${ms} ms, none blank, deterministic`;
    console.info(msg);
    document.title = msg;
  }

  // ---------------------------------------------------------------- boot
  // URL options (handy for testing):
  //   ?frame=300  ?scene=3  ?test=1  ?paused=1  ?selftest  ?autorecord  ?autorecord=sound
  const q = new URLSearchParams(location.search);
  if (q.has('frame')) seek(+q.get('frame'));
  if (q.has('scene')) seek(timeline[Math.max(0, Math.min(timeline.length - 1, +q.get('scene') - 1))].start);
  if (q.has('test')) { state.test = true; state.testT0 = performance.now(); state.testIdx = +q.get('test') || 0; }
  if (q.has('paused') || q.has('frame')) state.playing = false;

  window.addEventListener('resize', resize);
  resize();
  state.lastTime = performance.now();
  requestAnimationFrame(tick);
  if (q.has('selftest')) { state.playing = false; selfTest(); }
  loadSound();
  // ?autorecord = silent recording, ?autorecord=sound = recording with sound
  if (q.has('autorecord')) setTimeout(() => record(q.get('autorecord') === 'sound'), 1500);
})();
