// Small DSP kit for the demo's score: band-limited oscillators, a zero-delay-feedback state
// variable filter, a Freeverb-style stereo reverb, a ping-pong delay and a seeded noise source.
// Everything works on Float32Array buffers at 48 kHz.

export const SR = 48000;

export const midiHz = (note: number) => 440 * Math.pow(2, (note - 69) / 12);
export const db = (d: number) => Math.pow(10, d / 20);

/** PolyBLEP: rounds the corner of a saw or square edge so it does not alias. */
export function polyBlep(t: number, dt: number): number {
  if (t < dt) {
    const x = t / dt;
    return x + x - x * x - 1;
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt;
    return x * x + x + x + 1;
  }
  return 0;
}

export class Noise {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0 || 1;
  }
  next(): number {
    this.s = (Math.imul(this.s, 1664525) + 1013904223) >>> 0;
    return (this.s / 4294967296) * 2 - 1;
  }
}

/** Zero-delay-feedback state variable filter (Zavalishin's TPT form): stable at any cutoff. */
export class Svf {
  private ic1 = 0;
  private ic2 = 0;
  private g = 0;
  private k = 1;
  private a1 = 0;
  private a2 = 0;
  private a3 = 0;
  low = 0;
  band = 0;
  high = 0;
  constructor(cutoff = 1000, q = 0.707) {
    this.set(cutoff, q);
  }
  set(cutoff: number, q = 0.707): void {
    const fc = Math.min(Math.max(cutoff, 20), SR * 0.45);
    this.g = Math.tan((Math.PI * fc) / SR);
    this.k = 1 / q;
    this.a1 = 1 / (1 + this.g * (this.g + this.k));
    this.a2 = this.g * this.a1;
    this.a3 = this.g * this.a2;
  }
  process(x: number): number {
    const v3 = x - this.ic2;
    const v1 = this.a1 * this.ic1 + this.a2 * v3;
    const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
    this.ic1 = 2 * v1 - this.ic1;
    this.ic2 = 2 * v2 - this.ic2;
    this.low = v2;
    this.band = v1;
    this.high = x - this.k * v1 - v2;
    return v2;
  }
}

/** A stereo pair of buffers. */
export class Bus {
  readonly l: Float32Array;
  readonly r: Float32Array;
  constructor(readonly length: number) {
    this.l = new Float32Array(length);
    this.r = new Float32Array(length);
  }
  add(i: number, l: number, r: number): void {
    if (i >= 0 && i < this.length) {
      this.l[i]! += l;
      this.r[i]! += r;
    }
  }
  /** Adds another bus into this one, scaled. */
  mix(other: Bus, gain = 1): void {
    for (let i = 0; i < this.length; i++) {
      this.l[i]! += other.l[i]! * gain;
      this.r[i]! += other.r[i]! * gain;
    }
  }
}

/** Equal-power pan: -1 left, 1 right. */
export function pan(p: number): [number, number] {
  const a = ((p + 1) / 2) * (Math.PI / 2);
  return [Math.cos(a), Math.sin(a)];
}

/** Freeverb: eight damped combs and four allpasses per side, the right side detuned for width. */
export function reverb(input: Bus, { room = 0.82, damp = 0.35, width = 1, predelay = 0.02 }: { room?: number; damp?: number; width?: number; predelay?: number } = {}): Bus {
  const scale = SR / 44100;
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
  const alls = [556, 441, 341, 225];
  const spread = 23;
  const feedback = 0.28 + room * 0.7;
  const out = new Bus(input.length);
  const pre = Math.round(predelay * SR);
  for (const side of [0, 1] as const) {
    const dst = side === 0 ? out.l : out.r;
    const cb = combs.map((c) => new Float32Array(Math.round((c + side * spread) * scale)));
    const ci = combs.map(() => 0);
    const cf = combs.map(() => 0);
    const ab = alls.map((a) => new Float32Array(Math.round((a + side * spread) * scale)));
    const ai = alls.map(() => 0);
    for (let n = 0; n < input.length; n++) {
      // Both sides hear the same mono input; their different comb lengths make the width.
      const x = n >= pre ? (input.l[n - pre]! + input.r[n - pre]!) * 0.5 * 0.015 : 0;
      let acc = 0;
      for (let c = 0; c < 8; c++) {
        const buf = cb[c]!;
        const idx = ci[c]!;
        const y = buf[idx]!;
        cf[c] = y * (1 - damp) + cf[c]! * damp;
        buf[idx] = x + cf[c]! * feedback;
        ci[c] = idx + 1 >= buf.length ? 0 : idx + 1;
        acc += y;
      }
      for (let a = 0; a < 4; a++) {
        const buf = ab[a]!;
        const idx = ai[a]!;
        const b = buf[idx]!;
        const y = -acc + b;
        buf[idx] = acc + b * 0.5;
        ai[a] = idx + 1 >= buf.length ? 0 : idx + 1;
        acc = y;
      }
      dst[n] = acc;
    }
  }
  if (width < 1) {
    for (let n = 0; n < out.length; n++) {
      const mid = (out.l[n]! + out.r[n]!) * 0.5;
      out.l[n] = mid + (out.l[n]! - mid) * width;
      out.r[n] = mid + (out.r[n]! - mid) * width;
    }
  }
  return out;
}

/** Ping-pong delay with a darkening feedback path. */
export function pingPong(input: Bus, seconds: number, feedback = 0.38, tone = 3200): Bus {
  const d = Math.round(seconds * SR);
  const out = new Bus(input.length);
  const bl = new Float32Array(d);
  const br = new Float32Array(d);
  const lpL = new Svf(tone);
  const lpR = new Svf(tone);
  let i = 0;
  for (let n = 0; n < input.length; n++) {
    const yl = bl[i]!;
    const yr = br[i]!;
    out.l[n] = yl;
    out.r[n] = yr;
    const mono = (input.l[n]! + input.r[n]!) * 0.5;
    // Left feeds right and right feeds left, so the echoes bounce across.
    bl[i] = mono + lpR.process(yr) * feedback;
    br[i] = lpL.process(yl) * feedback;
    i = i + 1 >= d ? 0 : i + 1;
  }
  return out;
}

/** A soft clipper for buses and the master. */
export function saturate(bus: Bus, drive = 1.2): void {
  const norm = Math.tanh(drive);
  for (let n = 0; n < bus.length; n++) {
    bus.l[n] = Math.tanh(bus.l[n]! * drive) / norm;
    bus.r[n] = Math.tanh(bus.r[n]! * drive) / norm;
  }
}

/** An envelope follower: fast attack, slower release, on the louder side. */
export function follow(bus: Bus, attack = 0.01, release = 0.25): Float32Array {
  const env = new Float32Array(bus.length);
  const a = Math.exp(-1 / (attack * SR));
  const r = Math.exp(-1 / (release * SR));
  let e = 0;
  for (let n = 0; n < bus.length; n++) {
    const x = Math.max(Math.abs(bus.l[n]!), Math.abs(bus.r[n]!));
    e = x > e ? a * e + (1 - a) * x : r * e + (1 - r) * x;
    env[n] = e;
  }
  return env;
}

/** A gentle compressor for the voice: evens it out so it sits steady over the music. */
export function compress(bus: Bus, { threshold = -20, ratio = 3, attack = 0.004, release = 0.08, makeup = 4 }: { threshold?: number; ratio?: number; attack?: number; release?: number; makeup?: number } = {}): void {
  const env = follow(bus, attack, release);
  const thr = db(threshold);
  const gainUp = db(makeup);
  for (let n = 0; n < bus.length; n++) {
    const e = env[n]!;
    const g = e > thr ? Math.pow(e / thr, 1 / ratio - 1) : 1;
    bus.l[n] = bus.l[n]! * g * gainUp;
    bus.r[n] = bus.r[n]! * g * gainUp;
  }
}

/** A high-pass filter over a bus, to clear rumble from the voice. */
export function highPass(bus: Bus, cutoff: number): void {
  const fl = new Svf(cutoff);
  const fr = new Svf(cutoff);
  for (let n = 0; n < bus.length; n++) {
    fl.process(bus.l[n]!);
    bus.l[n] = fl.high;
    fr.process(bus.r[n]!);
    bus.r[n] = fr.high;
  }
}

/** A look-ahead peak limiter: gain falls ahead of any peak over the ceiling and recovers slowly,
 *  so transients are caught cleanly instead of clipped. */
export function limit(bus: Bus, ceilingDb = -1.5, lookahead = 0.005, release = 0.08): void {
  const ceiling = db(ceilingDb);
  const n = bus.length;
  const ahead = Math.round(lookahead * SR);
  // The gain each sample needs on its own.
  const need = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = Math.max(Math.abs(bus.l[i]!), Math.abs(bus.r[i]!));
    need[i] = p > ceiling ? ceiling / p : 1;
  }
  // Look ahead: take the smallest need in the coming window, then smooth the recovery.
  const gain = new Float32Array(n);
  const rel = Math.exp(-1 / (release * SR));
  let g = 1;
  const window: number[] = [];
  let head = 0;
  for (let j = 0; j < Math.min(n, ahead); j++) {
    while (window.length > head && need[window[window.length - 1]!]! >= need[j]!) window.pop();
    window.push(j);
  }
  for (let i = 0; i < n; i++) {
    const enter = i + ahead;
    if (enter < n) {
      while (window.length > head && need[window[window.length - 1]!]! >= need[enter]!) window.pop();
      window.push(enter);
    }
    while (window[head]! < i) head++;
    const m = need[window[head]!]!;
    g = m < g ? m : rel * g + (1 - rel) * m;
    gain[i] = Math.min(g, m);
  }
  for (let i = 0; i < n; i++) {
    bus.l[i] = bus.l[i]! * gain[i]!;
    bus.r[i] = bus.r[i]! * gain[i]!;
  }
}
