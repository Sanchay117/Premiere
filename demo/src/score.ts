// The demo's soundtrack, all synthesized here so nothing needs a license: a 120 bpm synthwave score
// cut to the opening trailer's beats (a film leader, an impact as the screen lights, a braam under
// the marquee, the drop on the montage, a big hit and a neon buzz on the title), a calmer bed under
// the walkthrough that steps aside for the finished trailer, then the full groove again to close.
// Both voices are compressed and sit on top; the music ducks under them. Mastered to -16 LUFS.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeLoudness } from "../../worker/src/audio/ffmpeg";
import { readWav, writeWav } from "../../worker/src/audio/wav";
import { wordFrame } from "../remotion/timing";
import type { DemoProps } from "../remotion/types";
import { Bus, compress, follow, highPass, limit, midiHz, Noise, pan, pingPong, polyBlep, reverb, saturate, SR, Svf } from "./dsp";
import { OUT } from "./paths";

const BEAT = 0.5;
/** A 10 ms fade at the end of every sound, so nothing is cut off mid-wave with a click. */
const tail = (i: number, len: number) => Math.min(1, (len - i) / 480);
const BAR = 2;
const TAU = Math.PI * 2;

export interface Cues {
  /** Video seconds of each pointer click, each key typed and each camera move worth a whoosh. */
  clicks: number[];
  keys: number[];
  moves: number[];
}

// Chords as pad voicings that move smoothly, with a bass root.
const CHORDS = {
  Am: { pad: [57, 60, 64], root: 33 },
  F: { pad: [57, 60, 65], root: 29 },
  C: { pad: [55, 60, 64], root: 36 },
  G: { pad: [55, 59, 62], root: 31 },
  Am9: { pad: [57, 60, 64, 71], root: 33 },
} as const;
type Chord = keyof typeof CHORDS;

class Score {
  readonly n: number;
  readonly drums: Bus;
  readonly bass: Bus;
  readonly pad: Bus;
  readonly arp: Bus;
  readonly fx: Bus;
  readonly ui: Bus;
  readonly verbSend: Bus;
  readonly gatedSend: Bus;
  readonly delaySend: Bus;
  readonly kicks: number[] = [];
  private noise = new Noise(1913);

  constructor(readonly duration: number) {
    this.n = Math.ceil(duration * SR);
    this.drums = new Bus(this.n);
    this.bass = new Bus(this.n);
    this.pad = new Bus(this.n);
    this.arp = new Bus(this.n);
    this.fx = new Bus(this.n);
    this.ui = new Bus(this.n);
    this.verbSend = new Bus(this.n);
    this.gatedSend = new Bus(this.n);
    this.delaySend = new Bus(this.n);
  }

  // Drums

  kick(t: number, vel = 1): void {
    this.kicks.push(t);
    const n0 = Math.round(t * SR);
    const len = Math.round(0.55 * SR);
    let phase = 0;
    for (let i = 0; i < len; i++) {
      const tt = i / SR;
      const f = 44 + 115 * Math.exp(-tt / 0.028);
      phase += f / SR;
      const amp = Math.exp(-tt / 0.3) * Math.min(1, i / 40) * vel;
      let s = Math.sin(TAU * phase) * amp;
      if (i < 120) s += this.noise.next() * Math.exp(-i / 25) * 0.35 * vel;
      s = Math.tanh(s * 1.6) * 0.72 * tail(i, len);
      this.drums.add(n0 + i, s, s);
    }
  }

  snare(t: number, vel = 1, gated = true): void {
    const n0 = Math.round(t * SR);
    const len = Math.round(0.45 * SR);
    const bp = new Svf(1900, 0.8);
    const hp = new Svf(400, 0.7);
    let phase = 0;
    for (let i = 0; i < len; i++) {
      const tt = i / SR;
      phase += (185 - 30 * Math.min(1, tt / 0.05)) / SR;
      const body = Math.sin(TAU * phase) * Math.exp(-tt / 0.06) * 0.6;
      bp.process(this.noise.next());
      hp.process(bp.band);
      const snap = hp.high * Math.exp(-tt / 0.16) * 1.8;
      const s = (body + snap) * vel * 0.7 * tail(i, len);
      const [l, r] = pan(0.04);
      this.drums.add(n0 + i, s * l, s * r);
      if (gated) this.gatedSend.add(n0 + i, s * 1.2, s * 1.2);
    }
  }

  clap(t: number, vel = 1): void {
    const n0 = Math.round(t * SR);
    const bp = new Svf(1300, 1.1);
    const len = Math.round(0.3 * SR);
    for (let i = 0; i < len; i++) {
      const tt = i / SR;
      // Three quick slaps, then the tail.
      const burst = tt < 0.03 ? (Math.floor(tt / 0.01) % 2 === 0 ? 1 : 0.4) * Math.exp(-(tt % 0.01) / 0.003) : Math.exp(-(tt - 0.03) / 0.09);
      bp.process(this.noise.next());
      const s = bp.band * burst * vel * 0.9 * tail(i, len);
      this.drums.add(n0 + i, s * 0.9, s);
      this.gatedSend.add(n0 + i, s * 0.6, s * 0.6);
    }
  }

  hat(t: number, vel = 0.5, open = false): void {
    const n0 = Math.round(t * SR);
    const decay = open ? 0.2 : 0.032;
    const len = Math.round((open ? 0.45 : 0.09) * SR);
    const hp = new Svf(7800, 0.9);
    const [l, r] = pan(open ? 0.25 : -0.18);
    for (let i = 0; i < len; i++) {
      hp.process(this.noise.next());
      const s = hp.high * Math.exp(-(i / SR) / decay) * vel * 0.8 * tail(i, len);
      this.drums.add(n0 + i, s * l, s * r);
    }
  }

  tom(t: number, vel = 0.7, pitch = 110): void {
    const n0 = Math.round(t * SR);
    let phase = 0;
    const len = Math.round(0.8 * SR);
    for (let i = 0; i < len; i++) {
      const tt = i / SR;
      phase += (pitch * (1 + 0.6 * Math.exp(-tt / 0.04))) / SR;
      const s = Math.sin(TAU * phase) * Math.exp(-tt / 0.22) * vel * 0.8 * tail(i, len);
      this.drums.add(n0 + i, s, s);
    }
  }

  // Melodic

  bassNote(t: number, dur: number, midi: number, vel = 0.8, bright = 1): void {
    const n0 = Math.round(t * SR);
    const len = Math.round((dur + 0.05) * SR);
    const lp = new Svf(300, 1.25);
    const f = midiHz(midi);
    let ph = 0;
    let sub = 0;
    for (let i = 0; i < len; i++) {
      const tt = i / SR;
      const dt = f / SR;
      ph += dt;
      if (ph >= 1) ph -= 1;
      sub += f / 2 / SR;
      const saw = 2 * ph - 1 - polyBlep(ph, dt);
      lp.set((260 + 1500 * bright * Math.exp(-tt / 0.11)) * (1 + 0.15 * bright), 1.25);
      const env = Math.min(1, i / 200) * (tt > dur ? Math.exp(-(tt - dur) / 0.015) : 1);
      const s = (lp.process(saw) * 0.85 + Math.sin(TAU * sub) * 0.36) * env * vel * 0.55 * tail(i, len);
      this.bass.add(n0 + i, s, s);
    }
  }

  padChord(t: number, dur: number, notes: readonly number[], vel = 0.6, cutoff = 1500, attack = 0.5, release = 1.4): void {
    const n0 = Math.round(t * SR);
    const len = Math.round((dur + release * 1.6) * SR);
    const voices: { f: number; ph: number; pan: [number, number] }[] = [];
    const detunes = [-0.14, -0.06, 0, 0.07, 0.13];
    notes.forEach((note, j) => {
      detunes.forEach((d, k) => {
        voices.push({ f: midiHz(note + d), ph: (j * 0.37 + k * 0.21) % 1, pan: pan(((k / (detunes.length - 1)) * 2 - 1) * 0.85) });
      });
    });
    const lpL = new Svf(cutoff, 0.8);
    const lpR = new Svf(cutoff, 0.8);
    const scale = 0.13 / Math.sqrt(voices.length);
    for (let i = 0; i < len; i++) {
      const tt = i / SR;
      let l = 0;
      let r = 0;
      for (const v of voices) {
        const dt = v.f / SR;
        v.ph += dt;
        if (v.ph >= 1) v.ph -= 1;
        const s = 2 * v.ph - 1 - polyBlep(v.ph, dt);
        l += s * v.pan[0];
        r += s * v.pan[1];
      }
      if (i % 32 === 0) {
        const c = cutoff * (1 + 0.25 * Math.sin(TAU * 0.11 * (t + tt)));
        lpL.set(c, 0.8);
        lpR.set(c, 0.8);
      }
      const a = Math.min(1, tt / attack);
      const env = (tt < dur ? a : a * Math.exp(-(tt - dur) / (release / 3))) * vel * tail(i, len);
      const ol = lpL.process(l) * env * scale * 6;
      const or = lpR.process(r) * env * scale * 6;
      this.pad.add(n0 + i, ol, or);
      this.verbSend.add(n0 + i, ol * 0.5, or * 0.5);
    }
  }

  arpNote(t: number, midi: number, vel = 0.5, bright = 1): void {
    const n0 = Math.round(t * SR);
    const len = Math.round(0.6 * SR);
    const f = midiHz(midi);
    const lp = new Svf(2000, 1.6);
    let ph = 0;
    const [l, r] = pan(((midi % 5) - 2) * 0.18);
    for (let i = 0; i < len; i++) {
      const tt = i / SR;
      const dt = f / SR;
      ph += dt;
      if (ph >= 1) ph -= 1;
      let sq = ph < 0.5 ? 1 : -1;
      sq += polyBlep(ph, dt);
      sq -= polyBlep((ph + 0.5) % 1, dt);
      const saw = 2 * ph - 1 - polyBlep(ph, dt);
      if (i % 16 === 0) lp.set(900 + 5200 * bright * Math.exp(-tt / 0.08), 1.6);
      const s = lp.process(sq * 0.6 + saw * 0.4) * Math.exp(-tt / 0.13) * Math.min(1, i / 60) * vel * 0.4 * tail(i, len);
      this.arp.add(n0 + i, s * l, s * r);
      this.delaySend.add(n0 + i, s * 0.55, s * 0.55);
      this.verbSend.add(n0 + i, s * 0.2, s * 0.2);
    }
  }

  /** A bell for a sparkle: a sine with two bright inharmonic partials. */
  bell(t: number, midi: number, vel = 0.4): void {
    const n0 = Math.round(t * SR);
    const f = midiHz(midi);
    const len = Math.round(3.2 * SR);
    for (let i = 0; i < len; i++) {
      const tt = i / SR;
      const s = tail(i, len) * (Math.sin(TAU * f * tt) + 0.35 * Math.sin(TAU * f * 2.76 * tt) * Math.exp(-tt / 0.3) + 0.2 * Math.sin(TAU * f * 5.4 * tt) * Math.exp(-tt / 0.12)) * Math.exp(-tt / 0.9) * Math.min(1, i / 30) * vel * 0.35;
      this.fx.add(n0 + i, s * 0.8, s);
      this.verbSend.add(n0 + i, s * 0.8, s * 0.8);
    }
  }

  // Trailer sound design

  /** The low brass blast of a trailer: stacked, detuned saws through a filter that bursts open. */
  braam(t: number, dur = 3, vel = 1): void {
    const n0 = Math.round(t * SR);
    const len = Math.round((dur + 0.6) * SR);
    const notes = [33, 45, 40, 52];
    const voices = notes.flatMap((note, j) => [-0.1, 0, 0.1].map((d, k) => ({ f: midiHz(note + d), ph: (j * 0.31 + k * 0.17) % 1 })));
    const lp = new Svf(150, 1.4);
    for (let i = 0; i < len; i++) {
      const tt = i / SR;
      let s = 0;
      for (const v of voices) {
        const dt = v.f / SR;
        v.ph += dt;
        if (v.ph >= 1) v.ph -= 1;
        s += 2 * v.ph - 1 - polyBlep(v.ph, dt);
      }
      if (i % 16 === 0) {
        const open = tt < 0.1 ? 150 + 2600 * (tt / 0.1) : 400 + 2350 * Math.exp(-(tt - 0.1) / 0.7);
        lp.set(open, 1.4);
      }
      const env = Math.min(1, tt / 0.025) * (tt < dur ? Math.exp(-tt / (dur * 0.9)) : Math.exp(-dur / (dur * 0.9)) * Math.exp(-(tt - dur) / 0.2));
      const o = Math.tanh(lp.process(s / voices.length) * 3.2) * env * vel * 0.55;
      this.fx.add(n0 + i, o, o);
      this.verbSend.add(n0 + i, o * 0.6, o * 0.6);
    }
  }

  impact(t: number, size = 1): void {
    const n0 = Math.round(t * SR);
    const len = Math.round(2.2 * SR);
    const lp = new Svf(900, 0.7);
    let phase = 0;
    const metal = [331, 517, 791, 1310];
    for (let i = 0; i < len; i++) {
      const tt = i / SR;
      phase += (26 + 34 * Math.exp(-tt / 0.25)) / SR;
      const sub = Math.sin(TAU * phase) * Math.exp(-tt / 0.75) * 1.1;
      const crack = lp.process(this.noise.next()) * Math.exp(-tt / 0.18) * 0.9;
      let ring = 0;
      for (const m of metal) ring += Math.sin(TAU * m * tt);
      ring *= Math.exp(-tt / 0.22) * 0.06;
      const s = Math.tanh((sub + crack + ring) * size * 1.3) * 0.8 * tail(i, len);
      this.fx.add(n0 + i, s, s);
      this.verbSend.add(n0 + i, (crack + ring) * size * 0.8, (crack + ring) * size * 0.8);
    }
  }

  /** Noise rising through a sweeping band, with a sine climbing under it, landing at `to`. */
  riser(from: number, to: number, vel = 0.6): void {
    const n0 = Math.round(from * SR);
    const len = Math.round((to - from) * SR);
    const bpL = new Svf(300, 1.3);
    const bpR = new Svf(300, 1.3);
    let phase = 0;
    for (let i = 0; i < len; i++) {
      const p = i / len;
      if (i % 32 === 0) {
        const c = 250 * Math.pow(9000 / 250, p);
        bpL.set(c, 1.3);
        bpR.set(c * 1.04, 1.3);
      }
      bpL.process(this.noise.next());
      bpR.process(this.noise.next());
      phase += (180 * Math.pow(8, p)) / SR;
      const amp = Math.pow(p, 2.2) * vel;
      const tone = Math.sin(TAU * phase) * 0.12;
      this.fx.add(n0 + i, (bpL.band * 1.6 + tone) * amp, (bpR.band * 1.6 + tone) * amp);
      this.verbSend.add(n0 + i, bpL.band * amp * 0.5, bpR.band * amp * 0.5);
    }
  }

  reverseCymbal(from: number, to: number, vel = 0.5): void {
    const n0 = Math.round(from * SR);
    const len = Math.round((to - from) * SR);
    const hpL = new Svf(5200, 0.7);
    const hpR = new Svf(5200, 0.7);
    for (let i = 0; i < len; i++) {
      const amp = Math.pow(i / len, 3) * vel;
      hpL.process(this.noise.next());
      hpR.process(this.noise.next());
      this.fx.add(n0 + i, hpL.high * amp, hpR.high * amp);
    }
  }

  whoosh(t: number, dur = 0.55, vel = 0.5, from = -0.7, to = 0.7): void {
    const n0 = Math.round(t * SR);
    const len = Math.round(dur * SR);
    const bp = new Svf(400, 1.1);
    for (let i = 0; i < len; i++) {
      const p = i / len;
      if (i % 32 === 0) bp.set(350 + 2600 * Math.sin(Math.PI * p), 1.1);
      bp.process(this.noise.next());
      const amp = Math.pow(Math.sin(Math.PI * p), 1.6) * vel;
      const [l, r] = pan(from + (to - from) * p);
      this.fx.add(n0 + i, bp.band * amp * l * 1.4, bp.band * amp * r * 1.4);
    }
  }

  beep(t: number, f = 1000, dur = 0.085, vel = 0.25): void {
    const n0 = Math.round(t * SR);
    for (let i = 0; i < Math.round(dur * SR); i++) {
      const s = Math.sin(TAU * f * (i / SR)) * vel * Math.min(1, i / 60, (dur * SR - i) / 60);
      this.fx.add(n0 + i, s, s);
    }
  }

  tick(t: number, vel = 0.3): void {
    const n0 = Math.round(t * SR);
    const hp = new Svf(3000, 0.8);
    for (let i = 0; i < Math.round(0.03 * SR); i++) {
      const tt = i / SR;
      hp.process(this.noise.next());
      const s = (hp.high * Math.exp(-tt / 0.002) + Math.sin(TAU * 2600 * tt) * Math.exp(-tt / 0.006) * 0.5) * vel;
      this.fx.add(n0 + i, s * 0.7, s);
    }
  }

  /** The projector: a filtered motor hum with the shutter's 24 a second flutter. */
  projector(from: number, to: number, vel = 0.12): void {
    const n0 = Math.round(from * SR);
    const len = Math.round((to - from) * SR);
    const lp = new Svf(700, 0.7);
    for (let i = 0; i < len; i++) {
      const tt = i / SR;
      const fade = Math.min(1, tt / 0.6, (len - i) / (0.3 * SR));
      const flutter = 0.6 + 0.4 * Math.max(0, Math.sin(TAU * 24 * tt));
      const s = (lp.process(this.noise.next()) * flutter + Math.sin(TAU * 48 * tt) * 0.15) * vel * fade;
      this.fx.add(n0 + i, s, s);
    }
  }

  /** A neon sign: crackles as it stutters on, then a mains hum. */
  neon(at: number, until: number, vel = 0.1): void {
    const pattern = [1, 0, 0, 1, 1, 0, 1, 0.3, 1, 1, 0, 1];
    const frameS = 1 / 30;
    pattern.forEach((on, k) => {
      if (on > 0.5 && (k === 0 || pattern[k - 1]! < 0.5)) this.tick(at + k * frameS, 0.35);
    });
    const n0 = Math.round(at * SR);
    const len = Math.round((until - at) * SR);
    for (let i = 0; i < len; i++) {
      const tt = i / SR;
      const k = Math.floor(tt / frameS);
      const on = k < pattern.length ? pattern[k]! : 1;
      const s = (Math.sin(TAU * 120 * tt) * 0.6 + Math.sin(TAU * 240 * tt) * 0.25 + Math.sin(TAU * 360 * tt) * 0.12) * on * vel * Math.min(1, (len - i) / (0.5 * SR));
      this.fx.add(n0 + i, s, s);
    }
  }

  /** A word landing on screen: a short low thump with a crack on top. */
  slam(t: number, vel = 0.6): void {
    const n0 = Math.round(t * SR);
    const len = Math.round(0.35 * SR);
    const hp = new Svf(1800, 0.8);
    let phase = 0;
    for (let i = 0; i < len; i++) {
      const tt = i / SR;
      phase += (62 + 50 * Math.exp(-tt / 0.03)) / SR;
      hp.process(this.noise.next());
      const s = (Math.sin(TAU * phase) * Math.exp(-tt / 0.1) * 0.9 + hp.high * Math.exp(-tt / 0.012) * 0.5) * vel * tail(i, len);
      this.fx.add(n0 + i, s, s);
      this.verbSend.add(n0 + i, s * 0.25, s * 0.25);
    }
  }

  /** A plastic marquee letter dropping into its slot. */
  letter(t: number, vel = 0.12): void {
    const n0 = Math.round(t * SR);
    const len = Math.round(0.05 * SR);
    const bp = new Svf(1400 + this.noise.next() * 300, 2.5);
    for (let i = 0; i < len; i++) {
      bp.process(this.noise.next());
      const s = bp.band * Math.exp(-(i / SR) / 0.008) * vel * 2 * tail(i, len);
      this.fx.add(n0 + i, s * 0.9, s);
    }
  }

  /** A soft click for the pointer, and a typewriter-light tick for keys. */
  uiClick(t: number, vel = 0.22): void {
    const n0 = Math.round(t * SR);
    const bp = new Svf(2400, 1.2);
    for (let i = 0; i < Math.round(0.04 * SR); i++) {
      const tt = i / SR;
      bp.process(this.noise.next());
      const s = (bp.band * Math.exp(-tt / 0.004) + Math.sin(TAU * 1500 * tt) * Math.exp(-tt / 0.01) * 0.4) * vel;
      this.ui.add(n0 + i, s, s);
    }
  }

  key(t: number, vel = 0.12): void {
    const n0 = Math.round(t * SR);
    const bp = new Svf(3200 + this.noise.next() * 600, 1.5);
    for (let i = 0; i < Math.round(0.025 * SR); i++) {
      bp.process(this.noise.next());
      const s = bp.band * Math.exp(-(i / SR) / 0.004) * vel * (0.8 + 0.2 * this.noise.next());
      this.ui.add(n0 + i, s * 0.9, s);
    }
  }

  // Arrangement helpers

  /** Bars of groove from `from` to `to`, chord per bar from the cycle. */
  groove(from: number, to: number, cycle: Chord[], level: "full" | "bed" | "build", offset = 0): void {
    const bars = Math.round((to - from) / BAR);
    for (let b = 0; b < bars; b++) {
      const t0 = from + b * BAR;
      const chord = CHORDS[cycle[(b + offset) % cycle.length]!];
      const full = level === "full";
      const bed = level === "bed";
      // Pad across the bar.
      this.padChord(t0, BAR, chord.pad, bed ? 0.42 : 0.55, bed ? 1500 : full ? 3200 : 2400, 0.25, 1.2);
      for (let s = 0; s < 16; s++) {
        const t = t0 + s * (BEAT / 4);
        // Kick: four on the floor in full, beats one and three in the bed.
        if (s % 4 === 0 && (full || level === "build" || s % 8 === 0)) this.kick(t, bed ? 0.62 : 1);
        // Snare and clap on two and four (the bed keeps a soft snare on three only).
        if (full && (s === 4 || s === 12)) {
          this.snare(t, 0.95);
          this.clap(t, 0.7);
        }
        if (bed && s === 8) this.snare(t, 0.4, true);
        // Hats: sixteenths in full, eighths in the bed, accent on the off-beat.
        if (full) this.hat(t, s % 4 === 2 ? 0.55 : 0.28, s % 8 === 6);
        else if (s % 2 === 0) this.hat(t, s % 4 === 2 ? (bed ? 0.22 : 0.4) : bed ? 0.1 : 0.2);
        // Bass: eighths, root and octave.
        if (s % 2 === 0) this.bassNote(t, BEAT / 2 - 0.02, chord.root + 12 + (s % 4 === 2 ? 12 : 0), bed ? 0.5 : 0.85, bed ? 0.35 : full ? 1 : 0.7);
        // Arp: sixteenths over the chord, up and back.
        const steps = [0, 1, 2, 3, 2, 1, 0, 1];
        const tones = [chord.pad[0]! + 12, chord.pad[1]! + 12, chord.pad[2]! + 12, chord.pad[0]! + 24];
        if (!bed || s % 2 === 0) this.arpNote(t, tones[steps[s % 8]!]!, bed ? 0.32 : full ? 0.55 : 0.42, bed ? 0.4 : 1);
      }
    }
  }

  snareRoll(from: number, to: number): void {
    const steps = Math.round((to - from) / (BEAT / 4));
    for (let i = 0; i < steps; i++) {
      const p = i / steps;
      this.snare(from + i * (BEAT / 4), 0.25 + 0.7 * p, false);
      if (p > 0.5) this.snare(from + i * (BEAT / 4) + BEAT / 8, 0.25 + 0.6 * p, false);
    }
  }
}

/** Gain that dips after each kick, so the pad, bass and arp breathe with the beat. */
function sidechain(n: number, kicks: number[], depthAt: (t: number) => number, release = 0.16): Float32Array {
  const g = new Float32Array(n).fill(1);
  for (const k of kicks) {
    const depth = depthAt(k);
    const n0 = Math.round(k * SR);
    for (let i = 0; i < Math.round(release * 4 * SR); i++) {
      const idx = n0 + i;
      if (idx >= n) break;
      const attack = Math.min(1, i / (0.004 * SR));
      const dip = 1 - depth * attack * Math.exp(-(i / SR) / release);
      if (dip < g[idx]!) g[idx] = dip;
    }
  }
  return g;
}

/** A level curve for the music: points in seconds, linear between. */
function curve(n: number, points: [number, number][]): Float32Array {
  const g = new Float32Array(n);
  let k = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    while (k < points.length - 2 && t > points[k + 1]![0]) k++;
    const [t0, v0] = points[k]!;
    const [t1, v1] = points[Math.min(k + 1, points.length - 1)]!;
    g[i] = t <= t0 ? v0 : t >= t1 ? v1 : v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
  }
  return g;
}

/** Holds the reverb only for a moment after each hit: the 1980s gated snare. */
function gate(bus: Bus, hits: number[], open = 0.24): void {
  const g = new Float32Array(bus.length);
  for (const h of hits) {
    const n0 = Math.round(h * SR);
    for (let i = 0; i < Math.round((open + 0.03) * SR); i++) {
      const idx = n0 + i;
      if (idx >= bus.length) break;
      g[idx] = i < open * SR ? 1 : 1 - (i - open * SR) / (0.03 * SR);
    }
  }
  for (let i = 0; i < bus.length; i++) {
    bus.l[i] = bus.l[i]! * g[i]!;
    bus.r[i] = bus.r[i]! * g[i]!;
  }
}

/** Places a voiced line, levelled so every line speaks at the same loudness (its RMS while
 *  speaking, at -18 dBFS), whichever voice read it. */
async function placeVoice(bus: Bus, file: string, at: number, gain = 1): Promise<void> {
  const pcm = readWav(await readFile(path.join(OUT, file)));
  const ch = pcm.channels[0]!;
  let sum = 0;
  let count = 0;
  for (const x of ch) {
    if (Math.abs(x) > 0.01) {
      sum += x * x;
      count++;
    }
  }
  const speaking = Math.sqrt(sum / Math.max(1, count));
  gain *= Math.min(4, Math.max(0.3, Math.pow(10, -18 / 20) / Math.max(1e-6, speaking)));
  const ratio = pcm.sampleRate / SR;
  const n0 = Math.round(at * SR);
  for (let i = 0; i < Math.floor(ch.length / ratio); i++) {
    const s = ch[Math.floor(i * ratio)]! * gain;
    bus.add(n0 + i, s, s);
  }
}

export async function makeSoundtrack(props: DemoProps, outFile: string, cues: Cues): Promise<void> {
  const duration = props.durationInFrames / props.fps;
  const s = new Score(duration);
  const intro = props.introSeconds;

  // The opening trailer.
  s.projector(0, 4.05, 0.1);
  for (const t of [0.5, 1.5, 2.5]) s.beep(t, 1000, 0.08, t === 1.5 ? 0.3 : 0.18);
  s.riser(2.0, 4.0, 0.35);
  s.reverseCymbal(3.0, 4.0, 0.45);
  s.impact(4.0, 1.15);
  s.padChord(4.0, 2, CHORDS.Am.pad, 0.5, 900, 0.8, 1.2);
  s.padChord(6.0, 2, CHORDS.F.pad, 0.5, 1000, 0.4, 1.2);
  for (let t = 4.0; t < 8; t += BEAT / 2) s.bassNote(t, BEAT / 2 - 0.02, (t < 6 ? CHORDS.Am.root : CHORDS.F.root) + 12, 0.55, 0.25);
  s.padChord(8.0, 2, CHORDS.C.pad, 0.55, 1200, 0.3, 1.2);
  s.padChord(10.0, 2, CHORDS.G.pad, 0.6, 1400, 0.3, 1.0);
  for (let t = 8.0; t < 12; t += BEAT / 2) s.bassNote(t, BEAT / 2 - 0.02, (t < 10 ? CHORDS.C.root : CHORDS.G.root) + 12, 0.65, 0.4 + (t - 8) / 8);
  for (let t = 8.0; t < 12; t += BEAT / 4) s.tick(t, 0.09 + 0.06 * ((t - 8) / 4) + (Math.round(t / (BEAT / 4)) % 4 === 0 ? 0.06 : 0));
  for (let t = 8.0; t < 12; t += BEAT) s.tom(t, 0.35 + 0.1 * ((t - 8) / 4), 70);
  s.riser(10.6, 12.0, 0.5);
  s.reverseCymbal(11.2, 12.0, 0.5);
  s.braam(12.0, 2.8, 1);
  s.impact(12.0, 1.0);
  s.bell(12.45, 81, 0.45);
  s.bell(12.7, 88, 0.3);
  s.padChord(12.0, 2, CHORDS.Am.pad, 0.5, 1300, 0.6, 1.2);
  s.padChord(14.0, 2, CHORDS.F.pad, 0.6, 1800, 0.2, 0.8);
  for (let t = 13.0; t < 16; t += BEAT / 2) s.bassNote(t, BEAT / 2 - 0.02, (t < 14 ? CHORDS.Am.root : CHORDS.F.root) + 12 + (Math.round(t / (BEAT / 2)) % 2) * 12, 0.75, 0.5 + (t - 13) / 6);
  for (let t = 14.0; t < 15.5; t += BEAT) s.kick(t, 0.9);
  s.snareRoll(15.0, 15.875);
  s.riser(13.6, 16.0, 0.6);
  // The drop: the montage, five bars.
  s.impact(16.0, 0.9);
  s.groove(16.0, 26.0, ["Am", "F", "C", "G"], "full");
  for (const t of [17.5, 18.5, 19.5]) s.whoosh(t - 0.22, 0.4, 0.4);
  s.whoosh(21.3, 0.5, 0.5);
  s.impact(21.5, 0.55);
  // The wall of apps, then the build into the title.
  s.groove(26.0, 30.0, ["F", "G"], "full");
  s.riser(27.4, 30.0, 0.7);
  s.snareRoll(29.0, 29.875);
  // The title: a big hit, the braam, the neon.
  s.impact(30.0, 1.4);
  s.braam(30.0, 3.4, 1.05);
  s.padChord(30.0, 3.2, CHORDS.Am9.pad, 0.6, 1600, 0.05, 2.2);
  s.bassNote(30.0, 3.0, CHORDS.Am.root, 0.8, 0.3);
  s.neon(30.07, 34.0, 0.05);

  // Foley for the opening's picture: slams on the words, letters into the marquee, the typewriter,
  // the projector under the film strip, pops as the editing tracks appear, the wall flipping in.
  const frame = (sceneStart: number, f: number) => sceneStart + f / 30;
  // The same word-timed slams as the picture (wordFrame in remotion/Intro.tsx).
  const said = (key: string, word: string, sceneStart: number, fallback: number) => frame(sceneStart, wordFrame(props.trailerLines, key, word, sceneStart, fallback));
  for (const t of [
    frame(4, 10),
    frame(4, 33),
    frame(8, 10),
    said("t-skip", "skip", 8, 27),
    said("t-skip", "or", 8, 58),
    said("t-skip", "making", 8, 78),
    frame(17.5, 0),
    frame(17.5, 4),
    frame(18.5, 0),
    frame(18.5, 4),
    frame(19.5, 0),
    frame(21.5, 0),
    frame(21.5, 7),
    said("t-any", "any", 26, 16),
    said("t-any", "about", 26, 35),
  ]) {
    s.slam(t, 0.55);
  }
  const letters = (sceneStart: number, startFrame: number, text: string) =>
    Array.from(text).forEach((ch, i) => ch !== " " && s.letter(frame(sceneStart, startFrame + i * 2)));
  letters(12, 32, "PASTE A LINK.");
  letters(12, 77, "GET A TRAILER.");
  s.uiClick(frame(17.5, 16), 0.3);
  for (let i = 0; i < 26; i++) s.key(18.52 + i * 0.036, 0.14);
  s.projector(19.5, 21.5, 0.08);
  const cut = props.trailerLines.find((l) => l.key === "t-cut");
  if (cut) {
    for (const word of ["voice", "captions", "music"]) {
      const w = cut.words.find((x) => x.text.toLowerCase().startsWith(word));
      if (w) s.bell(cut.at + w.start, 88, 0.18);
    }
  }
  for (let i = 0; i < 12; i++) s.whoosh(frame(26, ((i * 7) % 12) * 2), 0.25, 0.08, -0.8 + (i % 4) * 0.5, -0.6 + (i % 4) * 0.5);
  s.whoosh(33.3, 0.75, 0.6, -0.9, 0.9);
  s.reverseCymbal(33.4, 34.0, 0.3);

  // The walkthrough bed, stepping aside for the finished trailer.
  const close = props.graphics.find((g) => g.key === "close");
  const bedEnd = close ? close.start : duration;
  const bedFrom = intro;
  const bedBars = Math.floor((bedEnd - bedFrom) / BAR);
  s.groove(bedFrom, bedFrom + bedBars * BAR, ["Am", "F", "C", "G"], "bed");
  for (const g of props.graphics) {
    s.whoosh(g.start - 0.3, 0.6, 0.45);
  }
  s.whoosh(intro - 0.05, 0.5, 0.35);
  // The close: the full groove again, landing on a final hit at the last word.
  if (close) {
    const lastLine = props.guideLines.at(-1)!;
    // The last hit lands on the beat nearest the start of the final word ("trailer").
    const lastWord = lastLine.words.at(-1);
    const target = lastLine.at + (lastWord ? lastWord.start : lastLine.duration - 0.4);
    const hit = close.start + Math.round((target - close.start) / BEAT) * BEAT;
    // The bed stops on its last full bar; a riser carries the gap up to the close's first hit.
    const bedStop = bedFrom + bedBars * BAR;
    if (close.start - bedStop > 0.4) {
      s.riser(bedStop, close.start, 0.42);
      s.reverseCymbal(Math.max(bedStop, close.start - 1.0), close.start, 0.35);
    }
    s.impact(close.start, 0.8);
    const bars = Math.max(1, Math.floor((hit - close.start) / BAR));
    s.groove(close.start, close.start + bars * BAR, ["Am", "F", "C", "G"], "full");
    if (hit - (close.start + bars * BAR) >= BEAT) s.snareRoll(close.start + bars * BAR, hit - 0.125);
    s.impact(hit, 1.25);
    s.braam(hit, 3.2, 0.85);
    s.padChord(hit, 3.2, CHORDS.Am9.pad, 0.55, 1500, 0.05, 2.6);
    s.bassNote(hit, 2.8, CHORDS.Am.root, 0.8, 0.3);
    s.riser(hit - 1.8, hit, 0.55);
  }
  // Interface sounds under the walkthrough.
  for (const t of cues.clicks) s.uiClick(t);
  for (const t of cues.keys) s.key(t);
  for (const t of cues.moves) s.whoosh(t, 0.7, 0.12, -0.3, 0.3);

  // Buses: sidechain, the gated snare reverb, the arp's echoes, a big hall for the rest.
  const closeAt = close ? close.start : duration;
  const sc = sidechain(s.n, s.kicks, (t) => (t < intro || t >= closeAt ? 0.55 : 0.28));
  for (const bus of [s.bass, s.pad, s.arp]) {
    for (let i = 0; i < s.n; i++) {
      bus.l[i] = bus.l[i]! * sc[i]!;
      bus.r[i] = bus.r[i]! * sc[i]!;
    }
  }
  const gated = reverb(s.gatedSend, { room: 0.9, damp: 0.2, predelay: 0.005 });
  const snareHits = s.kicks.length ? findSnareHits(s) : [];
  gate(gated, snareHits, 0.22);
  const echoes = pingPong(s.delaySend, 0.375, 0.42, 2600);
  const hall = reverb(s.verbSend, { room: 0.88, damp: 0.42, predelay: 0.03 });
  saturate(s.drums, 1.15);

  const music = new Bus(s.n);
  music.mix(s.drums, 0.85);
  music.mix(gated, 0.9);
  music.mix(s.bass, 0.8);
  music.mix(s.pad, 0.85);
  music.mix(s.arp, 0.85);
  music.mix(echoes, 0.4);
  music.mix(hall, 0.9);
  music.mix(s.fx, 0.9);
  const airL = new Svf(2500, 0.7);
  const airR = new Svf(2500, 0.7);
  for (let i = 0; i < s.n; i++) {
    airL.process(music.l[i]!);
    airR.process(music.r[i]!);
    music.l[i] = music.l[i]! + airL.high * 0.7;
    music.r[i] = music.r[i]! + airR.high * 0.7;
  }

  // The voices: compressed, with a touch of hall on the trailer voice.
  const trailerVoice = new Bus(s.n);
  for (const line of props.trailerLines) await placeVoice(trailerVoice, line.file, line.at, 1);
  const guideVoice = new Bus(s.n);
  for (const line of props.guideLines) await placeVoice(guideVoice, line.file, line.at, 1);
  for (const v of [trailerVoice, guideVoice]) {
    highPass(v, 90);
    compress(v, { threshold: -22, ratio: 3, makeup: 5 });
  }
  const voiceHall = reverb(trailerVoice, { room: 0.6, damp: 0.5, predelay: 0.02 });
  const voices = new Bus(s.n);
  voices.mix(trailerVoice, 1);
  voices.mix(voiceHall, 0.18);
  voices.mix(guideVoice, 1);

  // Music level: full in the trailer, a bed under the guide, out for the finished trailer, full to close.
  const points: [number, number][] = [
    [0, 0.8],
    [intro - 0.3, 0.8],
    [intro + 0.6, 0.55],
  ];
  for (const o of props.overlays) points.push([o.start - 0.6, 0.55], [o.start - 0.05, 0], [o.end - 0.1, 0], [o.end + 0.6, 0.55]);
  if (close) points.push([close.start - 0.2, 0.55], [close.start, 0.8]);
  points.push([duration, 0.8]);
  points.sort((a, b) => a[0] - b[0]);
  // The music before ducking, for checking its tonal balance (demo/src/analyze.ts).
  await mkdir(path.join(path.dirname(outFile), "stems"), { recursive: true });
  await writeFile(path.join(path.dirname(outFile), "stems", "music-dry.wav"), writeWav({ sampleRate: SR, channels: [music.l.map((x) => x * 0.45), music.r.map((x) => x * 0.45)] }));
  const level = curve(s.n, points);
  const env = follow(voices, 0.02, 0.32);
  // Multiband ducking: under the voice the mids and highs, where speech lives, step well back,
  // while the kick and bass below 200 Hz only dip, so the music keeps its punch.
  const lowL = new Svf(200, 0.7);
  const lowR = new Svf(200, 0.7);
  for (let i = 0; i < s.n; i++) {
    const t = i / SR;
    const inClose = close !== undefined && t >= close.start;
    const highDepth = t < intro ? 0.82 : inClose ? 0.8 : 0.75;
    const lowDepth = t < intro ? 0.45 : inClose ? 0.45 : 0.6;
    const speaking = Math.min(1, env[i]! / 0.06);
    const gHigh = level[i]! * (1 - highDepth * speaking);
    const gLow = level[i]! * (1 - lowDepth * speaking);
    const ll = lowL.process(music.l[i]!);
    const lr = lowR.process(music.r[i]!);
    music.l[i] = ll * gLow + (music.l[i]! - ll) * gHigh;
    music.r[i] = lr * gLow + (music.r[i]! - lr) * gHigh;
  }

  const master = new Bus(s.n);
  master.mix(music, 0.45);
  master.mix(voices, 1);
  master.mix(s.ui, 1);
  // Stems for checking the balance by measurement (demo/src/analyze.ts).
  const stems = path.join(path.dirname(outFile), "stems");
  await mkdir(stems, { recursive: true });
  await writeFile(path.join(stems, "music.wav"), writeWav({ sampleRate: SR, channels: [music.l.map((x) => x * 0.45), music.r.map((x) => x * 0.45)] }));
  await writeFile(path.join(stems, "voices.wav"), writeWav({ sampleRate: SR, channels: [voices.l, voices.r] }));
  await writeFile(path.join(stems, "ui.wav"), writeWav({ sampleRate: SR, channels: [s.ui.l, s.ui.r] }));
  saturate(master, 1.05);
  // Ceiling at -3 dBFS before the loudness pass, which then has room to stay linear.
  limit(master, -3);
  // A short fade at the very end.
  for (let i = Math.max(0, s.n - Math.round(0.6 * SR)); i < s.n; i++) {
    const g = (s.n - i) / (0.6 * SR);
    master.l[i] = master.l[i]! * g;
    master.r[i] = master.r[i]! * g;
  }
  const raw = outFile.replace(/\.wav$/, "-raw.wav");
  await writeFile(raw, writeWav({ sampleRate: SR, channels: [master.l, master.r] }));
  const { measuredLufs } = await normalizeLoudness(raw, outFile);
  console.log(`Soundtrack: ${duration.toFixed(1)} s, mixed at ${measuredLufs.toFixed(1)} LUFS, mastered to -16 LUFS`);
}

/** Where the gated snares landed: the snare hits in full grooves fall on beats two and four. */
function findSnareHits(s: Score): number[] {
  // Every gated snare was sent at a known grid time; recover them from the send's onsets.
  const hits: number[] = [];
  const env = follow(s.gatedSend, 0.001, 0.05);
  let armed = true;
  for (let i = 0; i < s.n; i++) {
    if (armed && env[i]! > 0.05) {
      hits.push(i / SR);
      armed = false;
    } else if (!armed && env[i]! < 0.01) armed = true;
  }
  return hits;
}
