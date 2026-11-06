// Minimal 16-bit PCM WAV reading and writing. All audio work happens on Float32 samples in
// the range -1..1; channels are kept as separate arrays.

export interface Pcm {
  sampleRate: number;
  channels: Float32Array[];
}

export function durationOf(pcm: Pcm): number {
  return (pcm.channels[0]?.length ?? 0) / pcm.sampleRate;
}

/** Parses a PCM WAV (8, 16, 24 or 32-bit integer). Skips unknown chunks. */
export function readWav(buffer: Buffer): Pcm {
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("Not a WAV file");
  }
  let offset = 12;
  let channelCount = 1;
  let sampleRate = 48000;
  let bits = 16;
  let dataStart = -1;
  let dataLength = 0;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString("ascii", offset, offset + 4);
    let size = buffer.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === "fmt ") {
      channelCount = buffer.readUInt16LE(body + 2);
      sampleRate = buffer.readUInt32LE(body + 4);
      bits = buffer.readUInt16LE(body + 14);
    } else if (id === "data") {
      dataStart = body;
      // Streamed WAVs can carry a placeholder size; trust the actual buffer length then.
      if (size === 0 || size === 0xffffffff || body + size > buffer.length) size = buffer.length - body;
      dataLength = size;
      break;
    }
    offset = body + size + (size % 2);
  }
  if (dataStart < 0) throw new Error("WAV has no data chunk");
  const bytes = bits / 8;
  const frames = Math.floor(dataLength / (bytes * channelCount));
  const channels = Array.from({ length: channelCount }, () => new Float32Array(frames));
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channelCount; c++) {
      const at = dataStart + (i * channelCount + c) * bytes;
      let v: number;
      if (bits === 16) v = buffer.readInt16LE(at) / 32768;
      else if (bits === 24) v = buffer.readIntLE(at, 3) / 8388608;
      else if (bits === 32) v = buffer.readInt32LE(at) / 2147483648;
      else v = (buffer.readUInt8(at) - 128) / 128;
      channels[c]![i] = v;
    }
  }
  return { sampleRate, channels };
}

export function writeWav(pcm: Pcm): Buffer {
  const channelCount = pcm.channels.length;
  const frames = pcm.channels[0]?.length ?? 0;
  const dataLength = frames * channelCount * 2;
  const buffer = Buffer.alloc(44 + dataLength);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataLength, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channelCount, 22);
  buffer.writeUInt32LE(pcm.sampleRate, 24);
  buffer.writeUInt32LE(pcm.sampleRate * channelCount * 2, 28);
  buffer.writeUInt16LE(channelCount * 2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataLength, 40);
  let at = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channelCount; c++) {
      const v = Math.max(-1, Math.min(1, pcm.channels[c]![i]!));
      buffer.writeInt16LE(Math.round(v * 32767), at);
      at += 2;
    }
  }
  return buffer;
}

/** Linear-interpolation resample, good enough for speech and synth beds. */
export function resample(pcm: Pcm, sampleRate: number): Pcm {
  if (pcm.sampleRate === sampleRate) return pcm;
  const ratio = pcm.sampleRate / sampleRate;
  const frames = Math.floor((pcm.channels[0]?.length ?? 0) / ratio);
  return {
    sampleRate,
    channels: pcm.channels.map((src) => {
      const out = new Float32Array(frames);
      for (let i = 0; i < frames; i++) {
        const x = i * ratio;
        const i0 = Math.floor(x);
        const frac = x - i0;
        out[i] = (src[i0] ?? 0) * (1 - frac) + (src[i0 + 1] ?? src[i0] ?? 0) * frac;
      }
      return out;
    }),
  };
}
