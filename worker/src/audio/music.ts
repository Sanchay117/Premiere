// The score, synthesized from code so nothing needs a license. Four moods share one arrangement:
// a pad under the title card, the groove for the shots, a riser into the end card, an impact,
// and a held chord that fades out. Sound effects follow the edit (whoosh, click ticks).

import type { Pcm } from "./wav";

export type Mood = "energetic" | "calm" | "playful" | "bold";

interface MoodStyle {
  bpm: number;
  /** Chord roots (MIDI) and chord qualities, one chord per bar. */
  chords: { root: number; minor: boolean }[];
  kick: "four" | "half" | "none";
  hats: boolean;
  arp: boolean;
  padBrightness: number;
  bassLevel: number;
}

const STYLES: Record<Mood, MoodStyle> = {
  energetic: {
    bpm: 118,
    chords: [
      { root: 57, minor: true },
      { root: 53, minor: false },
      { root: 48, minor: false },
      { root: 55, minor: false },
    ],
    kick: "four",
    hats: true,
    arp: true,
    padBrightness: 0.55,
    bassLevel: 0.5,
  },
  bold: {
    bpm: 96,
    chords: [
      { root: 50, minor: true },
      { root: 46, minor: false },
      { root: 53, minor: false },
      { root: 48, minor: false },
    ],
    kick: "half",
    hats: true,
    arp: false,
    padBrightness: 0.7,
    bassLevel: 0.6,
  },
  playful: {
    bpm: 108,
    chords: [
      { root: 48, minor: false },
      { root: 57, minor: true },
      { root: 53, minor: false },
      { root: 55, minor: false },
    ],
    kick: "four",
    hats: true,
    arp: true,
    padBrightness: 0.45,
    bassLevel: 0.4,
  },
  calm: {
    bpm: 78,
    chords: [
      { root: 50, minor: false },
      { root: 57, minor: false },
      { root: 47, minor: true },
      { root: 55, minor: false },
    ],
    kick: "none",
    hats: false,
    arp: true,
    padBrightness: 0.3,
    bassLevel: 0.35,
  },
};

const freq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

/** Deterministic noise so renders are repeatable. */
function noiseSource(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return (s / 4294967296) * 2 - 1;
  };
}

export interface ScoreCues {
  /** Seconds: when the title card ends (the groove starts). */
  titleEnd: number;
  /** Seconds: when the end card starts (impact). */
  endStart: number;
  /** Seconds: click moments for soft ticks. */
  clicks: number[];
}

export function synthScore(duration: number, mood: Mood, cues: ScoreCues, sampleRate = 48000): Pcm {
  const style = STYLES[mood];
  const n = Math.ceil(duration * sampleRate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  const beat = 60 / style.bpm;
  const bar = beat * 4;
  const noise = noiseSource(1913);

  const add = (i: number, l: number, r: number) => {
    if (i >= 0 && i < n) {
      left[i]! += l;
      right[i]! += r;
    }
  };

  // Pad: three detuned saws per chord tone through a gentle low-pass, spread left and right.
  const voices = [0, 1, 2].map((v) => ({ phase: [0, 0, 0], lp: 0, detune: [-0.07, 0, 0.07][v]!, pan: [-0.6, 0, 0.6][v]! }));
  const cutoff = 600 + style.padBrightness * 1600;
  const lpAlpha = 1 - Math.exp((-2 * Math.PI * cutoff) / sampleRate);
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const chord = style.chords[Math.floor(t / bar) % style.chords.length]!;
    const tones = [chord.root + 12, chord.root + 12 + (chord.minor ? 3 : 4), chord.root + 19];
    // Level: soft under the title, fuller in the body, held through the end card, faded at the end.
    let level = t < cues.titleEnd ? 0.08 + 0.05 * (t / Math.max(0.1, cues.titleEnd)) : 0.11;
    if (t > duration - 1.6) level *= Math.max(0, (duration - t) / 1.6);
    for (let v = 0; v < voices.length; v++) {
      const voice = voices[v]!;
      let sample = 0;
      for (let k = 0; k < tones.length; k++) {
        voice.phase[k] = (voice.phase[k]! + (freq(tones[k]!) * (1 + voice.detune * 0.01)) / sampleRate) % 1;
        sample += 2 * voice.phase[k]! - 1;
      }
      voice.lp += lpAlpha * (sample / tones.length - voice.lp);
      const s = voice.lp * level * 0.45;
      add(i, s * (1 - voice.pan) * 0.5, s * (1 + voice.pan) * 0.5);
    }
  }

  // Groove from the end of the title card to the end card.
  const grooveStart = cues.titleEnd;
  const grooveEnd = cues.endStart;
  for (let tBeat = grooveStart; tBeat < grooveEnd; tBeat += beat / 2) {
    const step = Math.round((tBeat - grooveStart) / (beat / 2));
    const onBeat = step % 2 === 0;
    const beatInBar = Math.floor(step / 2) % 4;
    const start = Math.floor(tBeat * sampleRate);
    const chord = style.chords[Math.floor(tBeat / bar) % style.chords.length]!;
    // Kick: a pitch-swept sine.
    const kickHere = style.kick === "four" ? onBeat : style.kick === "half" ? onBeat && (beatInBar === 0 || beatInBar === 2) : false;
    if (kickHere) {
      let phase = 0;
      for (let k = 0; k < sampleRate * 0.35; k++) {
        const kt = k / sampleRate;
        phase += (45 + 75 * Math.exp(-kt * 28)) / sampleRate;
        const s = Math.sin(2 * Math.PI * phase) * Math.exp(-kt * 9) * 0.55;
        add(start + k, s, s);
      }
    }
    // Clap on 2 and 4.
    if (style.kick !== "none" && onBeat && (beatInBar === 1 || beatInBar === 3)) {
      let prev = 0;
      for (let k = 0; k < sampleRate * 0.18; k++) {
        const x = noise();
        const s = (x - prev) * Math.exp(-(k / sampleRate) * 22) * 0.22;
        prev = x;
        add(start + k, s * 0.9, s);
      }
    }
    // Hats on the off-beats.
    if (style.hats && !onBeat) {
      let prev = 0;
      for (let k = 0; k < sampleRate * 0.05; k++) {
        const x = noise();
        const s = (x - prev) * Math.exp(-(k / sampleRate) * 70) * 0.09;
        prev = x;
        add(start + k, s, s * 0.8);
      }
    }
    // Bass on every beat: chord root, soft saturated sine.
    if (onBeat) {
      const f = freq(chord.root - 12);
      for (let k = 0; k < sampleRate * beat * 0.9; k++) {
        const kt = k / sampleRate;
        const s = Math.tanh(Math.sin(2 * Math.PI * f * kt) * 1.6) * Math.exp(-kt * 3.5) * 0.16 * style.bassLevel;
        add(start + k, s, s);
      }
    }
    // Arp: triangle plucks walking the chord.
    if (style.arp) {
      const tones = [0, chord.minor ? 3 : 4, 7, 12];
      const f = freq(chord.root + 24 + tones[step % tones.length]!);
      const pan = step % 2 ? 0.35 : -0.35;
      for (let k = 0; k < sampleRate * 0.25; k++) {
        const kt = k / sampleRate;
        const ph = (f * kt) % 1;
        const tri = 4 * Math.abs(ph - 0.5) - 1;
        const s = tri * Math.exp(-kt * 14) * 0.05;
        add(start + k, s * (1 - pan), s * (1 + pan));
      }
    }
  }

  // Whoosh at the very start.
  for (let k = 0; k < sampleRate * 1.1; k++) {
    const kt = k / sampleRate;
    const env = Math.sin(Math.PI * Math.min(1, kt / 1.1)) ** 2;
    const s = noise() * env * 0.05;
    add(k, s * (1 - kt / 1.1), s * (kt / 1.1));
  }

  // Riser into the end card, then an impact.
  const riserLen = Math.min(2.2, cues.endStart - cues.titleEnd);
  const riserStart = Math.floor((cues.endStart - riserLen) * sampleRate);
  let lp = 0;
  for (let k = 0; k < riserLen * sampleRate; k++) {
    const p = k / (riserLen * sampleRate);
    const alpha = 0.01 + p * p * 0.5;
    lp += alpha * (noise() - lp);
    const s = lp * p * p * 0.16;
    add(riserStart + k, s, s);
  }
  const impact = Math.floor(cues.endStart * sampleRate);
  let phase = 0;
  for (let k = 0; k < sampleRate * 1.6; k++) {
    const kt = k / sampleRate;
    phase += (38 + 60 * Math.exp(-kt * 14)) / sampleRate;
    const boom = Math.sin(2 * Math.PI * phase) * Math.exp(-kt * 2.6) * 0.5;
    const air = noise() * Math.exp(-kt * 4) * 0.04;
    add(impact + k, boom + air, boom - air);
  }

  // Soft ticks on clicks.
  for (const at of cues.clicks) {
    const start = Math.floor(at * sampleRate);
    for (let k = 0; k < sampleRate * 0.03; k++) {
      const kt = k / sampleRate;
      const s = Math.sin(2 * Math.PI * 2200 * kt) * Math.exp(-kt * 180) * 0.07;
      add(start + k, s, s);
    }
  }

  return { sampleRate, channels: [left, right] };
}
