// Backup narrator: Kokoro, an open-source voice model (82M parameters, Apache-2.0) that runs on the
// worker's CPU, for when Deepgram cannot be reached. Placeholder until it is built.

import type { VoiceChoice } from "../options";
import type { Plan } from "../planner/schema";
import type { VoiceLine } from "./deepgram";

/** Voices every line of the plan (hook, one per shot, close) with Kokoro. */
export async function kokoroLines(_plan: Plan, _voice: VoiceChoice, _onProgress?: (detail: string) => void): Promise<VoiceLine[]> {
  throw new Error("The Kokoro backup voice is not built yet.");
}

/** The name shown for the backup narrator. */
export function kokoroVoiceName(_voice: VoiceChoice, _mood: Plan["mood"]): string {
  return "Kokoro";
}
