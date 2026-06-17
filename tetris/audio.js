/* ============================================================
   TÉTRISTE — Moteur audio (Web Audio API, 100% procédural)
   Effets sonores + musiques chiptune. Aucun fichier externe.
   ============================================================ */
const TetAudio = (function () {
  let ctx = null;
  let masterGain, musicGain, sfxGain;
  let musicVol = 0.6, sfxVol = 0.8;
  let musicEnabled = true;
  let started = false;

  // --- séquenceur ---
  let currentTrackId = 'korobeiniki';
  let scheduler = null;
  let nextNoteTime = 0;
  let trackStep = 0;
  const LOOKAHEAD = 0.1;       // s
  const SCHED_INTERVAL = 25;   // ms

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    masterGain = ctx.createGain(); masterGain.gain.value = 1;
    musicGain = ctx.createGain(); musicGain.gain.value = musicVol;
    sfxGain = ctx.createGain(); sfxGain.gain.value = sfxVol;
    musicGain.connect(masterGain);
    sfxGain.connect(masterGain);
    masterGain.connect(ctx.destination);
  }

  // doit être appelé suite à une interaction utilisateur
  function unlock() {
    init();
    if (ctx.state === 'suspended') ctx.resume();
    started = true;
  }

  // ---------- Notes ----------
  const NOTE_RE = /^([A-G])(#|b)?(-?\d)$/;
  const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function noteFreq(name) {
    if (name == null || name === '_') return 0; // silence
    const m = NOTE_RE.exec(name);
    if (!m) return 0;
    let semi = SEMI[m[1]];
    if (m[2] === '#') semi++; if (m[2] === 'b') semi--;
    const oct = parseInt(m[3], 10);
    const midi = semi + (oct + 1) * 12;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  // ---------- SFX ----------
  function blip(freq, dur, type = 'square', vol = 0.5, sweep = 0) {
    if (!ctx || !started) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (sweep) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(sfxGain);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol = 0.4, hp = 800) {
    if (!ctx || !started) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const filt = ctx.createBiquadFilter(); filt.type = 'highpass'; filt.frequency.value = hp;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(filt); filt.connect(g); g.connect(sfxGain);
    src.start(t);
  }

  const SFX = {
    move()      { blip(220, 0.05, 'square', 0.25); },
    rotate()    { blip(330, 0.06, 'square', 0.30, 1.3); },
    softdrop()  { blip(160, 0.04, 'triangle', 0.18); },
    harddrop()  { blip(120, 0.10, 'sawtooth', 0.4, 0.4); noise(0.08, 0.2, 400); },
    lock()      { blip(90, 0.08, 'square', 0.3, 0.7); },
    hold()      { blip(440, 0.09, 'triangle', 0.3, 1.5); },
    line()      { [523, 659, 784].forEach((f, i) => setTimeout(() => blip(f, 0.12, 'square', 0.35), i * 55)); },
    tetris()    { [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => blip(f, 0.16, 'square', 0.4), i * 70)); noise(0.3, 0.25, 600); },
    levelup()   { [392, 523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.14, 'triangle', 0.4), i * 60)); },
    gameover()  { [440, 392, 349, 294, 220, 165].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'sawtooth', 0.35, 0.9), i * 130)); },
    pause()     { blip(330, 0.08, 'sine', 0.3); },
    click()     { blip(660, 0.04, 'square', 0.2); },
    invalid()   { blip(110, 0.08, 'sawtooth', 0.25); },
  };
  function play(name) { if (SFX[name]) SFX[name](); }

  // ============================================================
  //  MUSIQUES — chaque piste : {bpm, lead:[...], bass:[...]}
  //  Chaque event = "Note:beats"  (beats = durée). "_" = silence.
  // ============================================================
  function parse(seq) {
    return seq.map(s => {
      const [n, d] = s.split(':');
      return { freq: noteFreq(n), beats: parseFloat(d) };
    });
  }

  const TRACKS = {
    none: { name: 'Aucune', icon: '🔇', bpm: 0, lead: [], bass: [] },

    korobeiniki: {
      name: 'Korobeïniki (classique)', icon: '🎼', bpm: 150,
      lead: parse([
        'E5:1','B4:.5','C5:.5','D5:1','C5:.5','B4:.5',
        'A4:1','A4:.5','C5:.5','E5:1','D5:.5','C5:.5',
        'B4:1.5','C5:.5','D5:1','E5:1',
        'C5:1','A4:1','A4:1','_:1',
        'D5:1','F5:.5','A5:1','G5:.5','F5:.5',
        'E5:1.5','C5:.5','E5:1','D5:.5','C5:.5',
        'B4:1','B4:.5','C5:.5','D5:1','E5:1',
        'C5:1','A4:1','A4:1','_:1',
      ]),
      bass: parse([
        'E3:1','E3:1','A3:1','A3:1','G#3:1','G#3:1','A3:1','A3:1',
        'A3:1','A3:1','A3:1','A3:1','G#3:1','G#3:1','E3:1','E3:1',
        'A3:1','A3:1','A3:1','A3:1','G#3:1','G#3:1','A3:1','A3:1',
        'A3:1','A3:1','A3:1','A3:1','G#3:1','G#3:1','A3:1','A3:1',
      ]),
    },

    neondrive: {
      name: 'Neon Drive (synthwave)', icon: '🌆', bpm: 124,
      lead: parse([
        'A4:1','C5:1','E5:1','A5:1','G5:1','E5:1','C5:1','D5:1',
        'F4:1','A4:1','C5:1','F5:1','E5:1','C5:1','A4:1','G4:1',
        'A4:.5','A4:.5','E5:1','D5:1','C5:1','B4:1','A4:1','E5:1','A5:1',
      ]),
      bass: parse([
        'A2:.5','A2:.5','A2:.5','A2:.5','A2:.5','A2:.5','A2:.5','A2:.5',
        'F2:.5','F2:.5','F2:.5','F2:.5','F2:.5','F2:.5','F2:.5','F2:.5',
        'A2:.5','A2:.5','A2:.5','A2:.5','E2:.5','E2:.5','E2:.5','E2:.5',
      ]),
    },

    aurora: {
      name: 'Aurora (ambiant chill)', icon: '🌌', bpm: 96,
      lead: parse([
        'C5:2','E5:1','G5:1','F5:2','E5:1','D5:1',
        'E5:2','G5:1','A5:1','G5:2','E5:1','C5:1',
        'D5:2','F5:1','A5:1','G5:3','_:1',
      ]),
      bass: parse([
        'C3:2','G3:2','A2:2','E3:2','F2:2','C3:2','G2:2','G3:2',
        'C3:2','G3:2','F2:2','C3:2','G2:4',
      ]),
    },

    arcade: {
      name: 'Arcade Rush (8-bit)', icon: '👾', bpm: 168,
      lead: parse([
        'C5:.5','C5:.5','G4:.5','C5:.5','E5:.5','G5:.5','C6:.5','G5:.5',
        'A5:.5','F5:.5','C5:.5','F5:.5','G5:.5','E5:.5','C5:.5','G4:.5',
        'C5:.5','E5:.5','G5:.5','E5:.5','C5:.5','E5:.5','G5:.5','B5:.5',
        'C6:1','G5:.5','E5:.5','C5:1','_:1',
      ]),
      bass: parse([
        'C3:.5','C3:.5','C3:.5','C3:.5','G2:.5','G2:.5','G2:.5','G2:.5',
        'F2:.5','F2:.5','F2:.5','F2:.5','G2:.5','G2:.5','G2:.5','G2:.5',
        'C3:.5','C3:.5','C3:.5','C3:.5','G2:.5','G2:.5','C3:.5','C3:.5',
      ]),
    },

    twilight: {
      name: 'Twilight (lo-fi)', icon: '🎹', bpm: 84,
      lead: parse([
        'E5:1.5','D5:.5','C5:1','D5:1','E5:1','G5:1','E5:2',
        'A4:1','C5:1','E5:1.5','D5:.5','C5:2',
        'D5:1','E5:1','D5:1','C5:1','B4:2','_:2',
      ]),
      bass: parse([
        'A2:1','E3:1','A2:1','E3:1','F2:1','C3:1','F2:1','C3:1',
        'C3:1','G3:1','C3:1','G3:1','G2:1','D3:1','G2:1','D3:1',
      ]),
    },
  };

  // ---------- Séquenceur de musique ----------
  function scheduleNote(track, gNode, ev, when, type, vol, isBass) {
    if (ev.freq <= 0) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const beatDur = 60 / track.bpm;
    const dur = ev.beats * beatDur * 0.92;
    osc.type = type;
    osc.frequency.setValueAtTime(ev.freq, when);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vol, when + 0.02);
    g.gain.exponentialRampToValueAtTime(vol * 0.6, when + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(g); g.connect(gNode);
    osc.start(when); osc.stop(when + dur + 0.02);
  }

  // état parallèle lead/bass : on avance sur la grille en beats
  let leadIdx = 0, leadTime = 0, bassIdx = 0, bassTime = 0;

  function tick() {
    if (!ctx) return;
    const track = TRACKS[currentTrackId];
    if (!track || track.bpm === 0 || !musicEnabled) return;
    const beatDur = 60 / track.bpm;

    while (nextNoteTime < ctx.currentTime + LOOKAHEAD) {
      // LEAD
      if (leadTime <= nextNoteTime + 0.001) {
        const ev = track.lead[leadIdx % track.lead.length];
        scheduleNote(track, musicGain, ev, Math.max(nextNoteTime, ctx.currentTime), 'square', 0.18, false);
        leadTime += ev.beats * beatDur;
        leadIdx++;
      }
      // BASS
      if (bassTime <= nextNoteTime + 0.001) {
        const ev = track.bass[bassIdx % track.bass.length];
        scheduleNote(track, musicGain, ev, Math.max(bassTime, ctx.currentTime), 'triangle', 0.22, true);
        bassTime += ev.beats * beatDur;
        bassIdx++;
      }
      nextNoteTime += beatDur * 0.25; // grille à la double-croche
    }
  }

  function startMusic() {
    if (!ctx || !musicEnabled) return;
    const track = TRACKS[currentTrackId];
    if (!track || track.bpm === 0) return;
    stopMusic();
    nextNoteTime = ctx.currentTime + 0.1;
    leadTime = nextNoteTime; bassTime = nextNoteTime;
    leadIdx = 0; bassIdx = 0;
    scheduler = setInterval(tick, SCHED_INTERVAL);
  }
  function stopMusic() {
    if (scheduler) { clearInterval(scheduler); scheduler = null; }
  }

  function setTrack(id) {
    currentTrackId = id;
    if (started && musicEnabled) startMusic();
  }
  function setMusicEnabled(on) {
    musicEnabled = on;
    if (!on) stopMusic();
    else if (started) startMusic();
  }
  function setMusicVolume(v) { musicVol = v; if (musicGain) musicGain.gain.value = v; }
  function setSfxVolume(v) { sfxVol = v; if (sfxGain) sfxGain.gain.value = v; }

  function pauseAll() { if (ctx && ctx.state === 'running') ctx.suspend(); }
  function resumeAll() { if (ctx && ctx.state === 'suspended') ctx.resume(); }

  function tracksMeta() {
    return Object.entries(TRACKS).map(([id, t]) => ({ id, name: t.name, icon: t.icon }));
  }

  return {
    unlock, play, startMusic, stopMusic, setTrack, setMusicEnabled,
    setMusicVolume, setSfxVolume, pauseAll, resumeAll, tracksMeta,
    get currentTrack() { return currentTrackId; },
    get isStarted() { return started; },
  };
})();
