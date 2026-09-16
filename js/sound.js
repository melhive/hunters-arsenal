/* Sound — short synthesized sci-fi tones via the Web Audio API.
   No audio files: everything is generated on the fly, so it stays tiny and
   works fully offline. Off by default; gated by Store's `sound` setting. */

const Sound = (function () {
  let ctx = null;
  let enabled = false;

  function getCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    // Browsers suspend AudioContext until a user gesture resumes it.
    // Every call site here is already inside a click/tap handler, so this is safe.
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function setEnabled(v) { enabled = !!v; }
  function isEnabled() { return enabled; }

  // Single tone. type: 'sine' | 'square' | 'triangle' | 'sawtooth'.
  function tone(freq, startOffset, duration, opts) {
    const o = opts || {};
    const c = getCtx();
    if (!c || !enabled) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, c.currentTime + startOffset);
    if (o.slideTo) {
      osc.frequency.linearRampToValueAtTime(o.slideTo, c.currentTime + startOffset + duration);
    }
    const vol = o.volume != null ? o.volume : 0.16;
    gain.gain.setValueAtTime(0, c.currentTime + startOffset);
    gain.gain.linearRampToValueAtTime(vol, c.currentTime + startOffset + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + startOffset + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(c.currentTime + startOffset);
    osc.stop(c.currentTime + startOffset + duration + 0.02);
  }

  // A quick sequence of tones, e.g. an arpeggio. notes: [{freq, at, dur, ...opts}]
  function sequence(notes) {
    notes.forEach(n => tone(n.freq, n.at, n.dur, n));
  }

  /* ---- Named effects ---- */

  function click() {
    tone(720, 0, 0.045, { type: 'square', volume: 0.06 });
  }

  function checkOff() {
    sequence([
      { freq: 660, at: 0, dur: 0.07, type: 'sine', volume: 0.14 },
      { freq: 990, at: 0.045, dur: 0.09, type: 'sine', volume: 0.12 }
    ]);
  }

  function uncheck() {
    tone(420, 0, 0.06, { type: 'sine', volume: 0.08 });
  }

  function levelUp() {
    sequence([
      { freq: 523.25, at: 0, dur: 0.11, type: 'triangle', volume: 0.15 },   // C5
      { freq: 659.25, at: 0.09, dur: 0.11, type: 'triangle', volume: 0.15 }, // E5
      { freq: 783.99, at: 0.18, dur: 0.22, type: 'triangle', volume: 0.17 }  // G5
    ]);
  }

  function rankUp() {
    // Bigger fanfare: a rising arpeggio into a held chord-like tail.
    sequence([
      { freq: 392.00, at: 0, dur: 0.10, type: 'sawtooth', volume: 0.10 },   // G4
      { freq: 523.25, at: 0.08, dur: 0.10, type: 'sawtooth', volume: 0.11 }, // C5
      { freq: 659.25, at: 0.16, dur: 0.10, type: 'sawtooth', volume: 0.12 }, // E5
      { freq: 783.99, at: 0.24, dur: 0.10, type: 'sawtooth', volume: 0.13 }, // G5
      { freq: 1046.50, at: 0.32, dur: 0.38, type: 'triangle', volume: 0.18 } // C6 held
    ]);
  }

  function achievement() {
    sequence([
      { freq: 880.00, at: 0, dur: 0.09, type: 'sine', volume: 0.14 },
      { freq: 1108.73, at: 0.07, dur: 0.16, type: 'sine', volume: 0.16 }
    ]);
  }

  function perfectDay() {
    sequence([
      { freq: 587.33, at: 0, dur: 0.09, type: 'triangle', volume: 0.13 },
      { freq: 739.99, at: 0.07, dur: 0.09, type: 'triangle', volume: 0.13 },
      { freq: 880.00, at: 0.14, dur: 0.18, type: 'triangle', volume: 0.15 }
    ]);
  }

  function penalty() {
    tone(220, 0, 0.32, { type: 'sawtooth', volume: 0.11, slideTo: 110 });
  }

  return { setEnabled, isEnabled, click, checkOff, uncheck, levelUp, rankUp, achievement, perfectDay, penalty };
})();
