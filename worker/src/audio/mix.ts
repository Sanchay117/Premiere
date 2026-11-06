// Mixes narration and score into one stereo soundtrack. The score ducks under the voice, the
// result is peak-limited, and ffmpeg's loudnorm then masters it to -16 LUFS.

import { resample, type Pcm } from "./wav";

export interface PlacedVoice {
  pcm: Pcm;
  /** Seconds from the start of the trailer. */
  at: number;
}

const DUCKED = 0.3;

export function mixSoundtrack(duration: number, voices: PlacedVoice[], score: Pcm, sampleRate = 48000): Pcm {
  const n = Math.ceil(duration * sampleRate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);

  // Where the narrator is speaking, for ducking.
  const speaking = new Uint8Array(n);
  for (const v of voices) {
    const pcm = resample(v.pcm, sampleRate);
    const src = pcm.channels[0]!;
    const start = Math.floor(v.at * sampleRate);
    for (let i = 0; i < src.length && start + i < n; i++) {
      if (start + i < 0) continue;
      left[start + i]! += src[i]!;
      right[start + i]! += src[i]!;
      speaking[start + i] = 1;
    }
  }

  // Smooth gain: fast down (80 ms) before speech, slow back up (400 ms) after.
  const s = resample(score, sampleRate);
  const sl = s.channels[0]!;
  const sr = s.channels[1] ?? sl;
  const down = Math.exp(-1 / (0.08 * sampleRate));
  const up = Math.exp(-1 / (0.4 * sampleRate));
  const lookahead = Math.floor(0.12 * sampleRate);
  let gain = 1;
  for (let i = 0; i < n; i++) {
    const target = speaking[Math.min(n - 1, i + lookahead)] ? DUCKED : 1;
    const coeff = target < gain ? down : up;
    gain = target + (gain - target) * coeff;
    left[i]! += (sl[i] ?? 0) * gain;
    right[i]! += (sr[i] ?? 0) * gain;
  }

  // Peak-normalize to -1 dBFS so loudnorm starts from a clean signal.
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(left[i]!), Math.abs(right[i]!));
  const scale = peak > 0 ? 0.89 / peak : 1;
  for (let i = 0; i < n; i++) {
    left[i]! *= scale;
    right[i]! *= scale;
  }
  return { sampleRate, channels: [left, right] };
}
