"use client";

/*
  Rip audio.

  Every sound is synthesised with the Web Audio API — no licensed samples, no
  network requests, and the foil tear is driven frame-by-frame by the drag
  speed instead of being a fixed clip. Audio only starts from a user gesture
  (the grab), never on mount.
*/

export class RipAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private tear: { source: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode } | null = null;
  private muted = false;

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.85, this.ctx.currentTime, 0.05);
    }
  }

  get isMuted() {
    return this.muted;
  }

  /** Call from a gesture handler. Safe to call repeatedly. */
  ensure(): boolean {
    if (typeof window === "undefined") return false;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return false;
      try {
        this.ctx = new Ctor();
      } catch {
        return false;
      }
      const master = this.ctx.createGain();
      master.gain.value = this.muted ? 0 : 0.85;
      master.connect(this.ctx.destination);
      this.master = master;

      const seconds = 2;
      const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * seconds, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      this.noise = buffer;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return true;
  }

  private get now() {
    return this.ctx?.currentTime ?? 0;
  }

  private noiseSource() {
    if (!this.ctx || !this.noise) return null;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noise;
    source.loop = true;
    return source;
  }

  /** A small, dry click for the grab. */
  grab() {
    if (!this.ensure() || !this.ctx || !this.master) return;
    const t = this.now;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.16);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.22, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.2);

    const crunch = this.noiseSource();
    if (crunch) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 2400;
      filter.Q.value = 0.8;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      crunch.connect(filter).connect(g).connect(this.master);
      crunch.start(t);
      crunch.stop(t + 0.12);
    }
  }

  startTear() {
    if (!this.ensure() || !this.ctx || !this.master) return;
    if (this.tear) return;
    const source = this.noiseSource();
    if (!source) return;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1600;
    filter.Q.value = 1.1;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.0001;
    source.connect(filter).connect(gain).connect(this.master);
    source.start();
    this.tear = { source, filter, gain };
  }

  /** `speed` is 0..1 of pointer velocity, `progress` is 0..1 of the tear. */
  updateTear(progress: number, speed: number) {
    if (!this.ctx || !this.tear) return;
    const t = this.now;
    const energy = Math.min(1, 0.18 + speed * 1.6);
    this.tear.gain.gain.setTargetAtTime(0.035 + energy * 0.075, t, 0.05);
    this.tear.filter.frequency.setTargetAtTime(1100 + progress * 2200 + speed * 1400, t, 0.08);
  }

  stopTear() {
    if (!this.ctx || !this.tear) return;
    const t = this.now;
    const { source, gain } = this.tear;
    gain.gain.setTargetAtTime(0.0001, t, 0.05);
    try {
      source.stop(t + 0.3);
    } catch {
      /* already stopped */
    }
    this.tear = null;
  }

  /** The pack coming apart. */
  pop() {
    this.stopTear();
    if (!this.ensure() || !this.ctx || !this.master) return;
    const t = this.now;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.4);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.42, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.55);

    const burst = this.noiseSource();
    if (burst) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(5200, t);
      filter.frequency.exponentialRampToValueAtTime(900, t + 0.45);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.26, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      burst.connect(filter).connect(g).connect(this.master);
      burst.start(t);
      burst.stop(t + 0.55);
    }
  }

  /** Air moving as the card slides out. */
  whoosh(duration = 1.3) {
    if (!this.ensure() || !this.ctx || !this.master) return;
    const t = this.now;
    const source = this.noiseSource();
    if (!source) return;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(320, t);
    filter.frequency.exponentialRampToValueAtTime(2600, t + duration * 0.7);
    filter.Q.value = 1.4;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.14, t + duration * 0.35);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    source.connect(filter).connect(gain).connect(this.master);
    source.start(t);
    source.stop(t + duration + 0.1);
  }

  /** Roulette click. `step` shifts the pitch as the wheel turns. */
  tick(step = 0) {
    if (!this.ensure() || !this.ctx || !this.master) return;
    const t = this.now;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "square";
    osc.frequency.value = 1180 + (step % 7) * 90;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.045, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.06);
  }

  /** The roulette landing on the real rarity. */
  land() {
    if (!this.ensure() || !this.ctx || !this.master) return;
    const t = this.now;
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = "sine";
    sub.frequency.setValueAtTime(120, t);
    sub.frequency.exponentialRampToValueAtTime(38, t + 0.55);
    subGain.gain.setValueAtTime(0.5, t);
    subGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    sub.connect(subGain).connect(this.master);
    sub.start(t);
    sub.stop(t + 0.65);

    const hit = this.noiseSource();
    if (hit) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 3000;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.2, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      hit.connect(filter).connect(g).connect(this.master);
      hit.start(t);
      hit.stop(t + 0.35);
    }
  }

  /** Card turning over, with a bright shimmer. */
  reveal() {
    if (!this.ensure() || !this.ctx || !this.master) return;
    const t = this.now;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t + i * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.075, t + 0.08 + i * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      osc.connect(gain).connect(this.master!);
      osc.start(t + i * 0.04);
      osc.stop(t + 1.7);
    });

    const air = this.noiseSource();
    if (air) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = 4200;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.08, t + 0.12);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      air.connect(filter).connect(g).connect(this.master);
      air.start(t);
      air.stop(t + 1.2);
    }
  }

  dispose() {
    this.stopTear();
    if (this.ctx) {
      void this.ctx.close().catch(() => undefined);
      this.ctx = null;
      this.master = null;
    }
  }
}
