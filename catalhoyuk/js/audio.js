// Procedural ambience with the Web Audio API: steppe wind, footsteps,
// hearth crackle and the occasional sheep. Nothing is downloaded.
export class Ambience {
  constructor() { this.ctx = null; this.muted = false; this.inside = 0; this._crackleT = 0; this._bleatT = 3; }
  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const C = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
    this.master = C.createGain(); this.master.gain.value = 0.9; this.master.connect(C.destination);
    // noise buffer
    const len = C.sampleRate * 2, buf = C.createBuffer(1, len, C.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    // wind: two filtered noise layers, slowly modulated
    const src = C.createBufferSource(); src.buffer = buf; src.loop = true;
    const bp = C.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 0.6;
    const lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    this.windGain = C.createGain(); this.windGain.gain.value = 0.0;
    this.windLP = lp;
    src.connect(bp); bp.connect(lp); lp.connect(this.windGain); this.windGain.connect(this.master);
    src.start();
    const lfo = C.createOscillator(); lfo.frequency.value = 0.07; const lfoG = C.createGain(); lfoG.gain.value = 180; lfo.connect(lfoG); lfoG.connect(bp.frequency); lfo.start();
    const lfo2 = C.createOscillator(); lfo2.frequency.value = 0.11; const lfo2G = C.createGain(); lfo2G.gain.value = 0.05; lfo2.connect(lfo2G); lfo2G.connect(this.windGain.gain); lfo2.start();
    this.windBase = 0.16;
  }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.1); }
  update(dt, inside, hearthDist, herdDist) {
    if (!this.ctx) return;
    this.inside += (inside - this.inside) * Math.min(1, dt * 3);
    const t = this.ctx.currentTime;
    this.windGain.gain.setTargetAtTime(this.windBase * (1 - this.inside * 0.75), t, 0.3);
    this.windLP.frequency.setTargetAtTime(900 - this.inside * 600, t, 0.3);
    // hearth crackle
    if (hearthDist < 9) {
      this._crackleT -= dt;
      if (this._crackleT <= 0) { this._crackleT = 0.03 + Math.random() * 0.22; this.crackle(Math.max(0, 1 - hearthDist / 9)); }
    }
    if (herdDist < 40) {
      this._bleatT -= dt;
      if (this._bleatT <= 0) { this._bleatT = 2.5 + Math.random() * 7; this.bleat(Math.max(0.08, 1 - herdDist / 40) * (1 - this.inside * 0.8)); }
    }
  }
  _burst(dur, freq, q, gain, type = 'bandpass') {
    const C = this.ctx, t = C.currentTime;
    const s = C.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = C.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = C.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  footstep(surface, run) {
    if (!this.ctx) return;
    if (surface === 'plaster') this._burst(0.09, 1400 + Math.random() * 400, 1.2, run ? 0.22 : 0.14);
    else if (surface === 'ladder') this._burst(0.08, 700, 2.5, 0.2);
    else this._burst(0.13, 500 + Math.random() * 250, 0.8, run ? 0.3 : 0.2, 'lowpass');
  }
  crackle(v) { this._burst(0.012 + Math.random() * 0.03, 2500 + Math.random() * 3000, 1.5, 0.08 * v, 'highpass'); }
  bleat(v) {
    const C = this.ctx, t = C.currentTime;
    const o = C.createOscillator(); o.type = 'sawtooth'; const f0 = 240 + Math.random() * 120; o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f0 * 0.85, t + 0.7);
    const vib = C.createOscillator(); vib.frequency.value = 9 + Math.random() * 4; const vg = C.createGain(); vg.gain.value = f0 * 0.05; vib.connect(vg); vg.connect(o.frequency);
    const f = C.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900 + Math.random() * 400; f.Q.value = 1.2;
    const g = C.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09 * v, t + 0.08); g.gain.setValueAtTime(0.09 * v, t + 0.45); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
    o.connect(f); f.connect(g); g.connect(this.master); o.start(t); vib.start(t); o.stop(t + 0.8); vib.stop(t + 0.8);
  }
}
