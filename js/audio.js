/* ==========================================================================
   Audio Engine (Web Audio API — zero external assets)
   ========================================================================== */

window.SoundFX = (function () {
  let ctx = null;
  let muted = localStorage.getItem('sloppy_forgeries_muted') === '1';

  function ensureContext() {
    if (muted) return null;
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      ctx = new AudioCtx();
    }
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  function playTone(freq, duration, type = 'sine', gainVal = 0.08, slideTo = null) {
    const c = ensureContext();
    if (!c) return;
    const now = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainVal, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  return {
    isMuted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      localStorage.setItem('sloppy_forgeries_muted', muted ? '1' : '0');
      if (!muted) this.click();
      return muted;
    },
    click() {
      playTone(520, 0.055, 'triangle', 0.07, 680);
    },
    brushSelect() {
      playTone(340, 0.05, 'sine', 0.06, 420);
    },
    startRound() {
      playTone(440, 0.12, 'triangle', 0.09);
      setTimeout(() => playTone(660, 0.18, 'triangle', 0.09), 90);
    },
    peek() {
      playTone(300, 0.22, 'sine', 0.07, 620);
    },
    tick(urgent = false) {
      playTone(urgent ? 880 : 620, 0.06, 'square', urgent ? 0.05 : 0.03);
    },
    finish(accuracy) {
      if (accuracy >= 70) {
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
          setTimeout(() => playTone(f, 0.24, 'triangle', 0.09), i * 85);
        });
      } else {
        [440, 523.25, 493.88].forEach((f, i) => {
          setTimeout(() => playTone(f, 0.22, 'triangle', 0.08), i * 110);
        });
      }
    }
  };
})();
