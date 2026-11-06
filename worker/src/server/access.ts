// Who may start a free trailer. Vibeathon entrants unlock trailers with a code shared in the
// Vibestarter Discord; every visitor has a daily limit and there is a global daily cap, so the
// API budget cannot be drained. With no codes configured (local development) access is open,
// but the caps still apply.

import { createHmac, randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "../config";

interface AccessState {
  day: string;
  total: number;
  visitors: Record<string, number>;
  /** Uses per code, all time. */
  codes: Record<string, number>;
}

export interface AccessDecision {
  ok: boolean;
  reason?: string;
  /** Which code was used, for logs. Never the visitor. */
  code?: string;
  /** The refusal is about the entrant code, so the form should ask for one. */
  needsCode?: boolean;
}

function parseCodes(raw: string | undefined): Map<string, number> {
  const codes = new Map<string, number>();
  for (const entry of (raw ?? "").split(",")) {
    const [code, max] = entry.trim().split(":");
    if (code) codes.set(code.trim().toUpperCase(), Number(max) > 0 ? Number(max) : Number.POSITIVE_INFINITY);
  }
  return codes;
}

const CODES = parseCodes(process.env.ACCESS_CODES);
const PER_VISITOR = Number(process.env.ACCESS_PER_VISITOR_DAILY) || 3;
const DAILY_CAP = Number(process.env.ACCESS_DAILY_CAP) || (CODES.size ? 80 : 200);
const FILE = path.join(config.dataDir, "access.json");
const SECRET_FILE = path.join(config.dataDir, "access-secret");
const today = () => new Date().toISOString().slice(0, 10);

export const accessRequired = CODES.size > 0;

let queue: Promise<unknown> = Promise.resolve();

async function readState(): Promise<AccessState> {
  try {
    const state = JSON.parse(await readFile(FILE, "utf8")) as AccessState;
    return state.day === today() ? state : { day: today(), total: 0, visitors: {}, codes: state.codes ?? {} };
  } catch {
    return { day: today(), total: 0, visitors: {}, codes: {} };
  }
}

async function writeState(state: AccessState): Promise<void> {
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(`${FILE}.tmp`, JSON.stringify(state, null, 2));
  await rename(`${FILE}.tmp`, FILE);
}

async function loadSecret(): Promise<string> {
  const existing = (await readFile(SECRET_FILE, "utf8").catch(() => "")).trim();
  if (existing) return existing;
  const fresh = randomBytes(32).toString("hex");
  await mkdir(path.dirname(SECRET_FILE), { recursive: true });
  await writeFile(SECRET_FILE, fresh);
  return fresh;
}

let secret: Promise<string> | null = null;

/** A random secret kept in the data folder (never committed). Keying the visitor hash with it means
 *  the stored hashes cannot be reversed by hashing every possible IP address. */
function visitorSecret(): Promise<string> {
  secret ??= loadSecret().catch((err) => {
    secret = null;
    throw err;
  });
  return secret;
}

/** Visitors are stored only as a keyed hash of the id the web app sends (itself a hash of the IP). */
async function visitorKey(visitor: string): Promise<string> {
  return createHmac("sha256", await visitorSecret()).update(visitor).digest("hex").slice(0, 16);
}

/** Checks a request and, if allowed, counts it. Serialized so parallel requests cannot overspend. */
export function admit(code: string | undefined, visitor: string): Promise<AccessDecision> {
  const task = queue.then(async (): Promise<AccessDecision> => {
    const state = await readState();
    const normalized = code?.trim().toUpperCase() ?? "";
    if (accessRequired) {
      if (!normalized) return { ok: false, needsCode: true, reason: "Free trailers need an access code right now. Grab one in the Vibestarter Discord." };
      const max = CODES.get(normalized);
      if (max === undefined) return { ok: false, needsCode: true, reason: "That access code is not valid. Check it in the Vibestarter Discord." };
      if ((state.codes[normalized] ?? 0) >= max) return { ok: false, reason: "That access code has been used up." };
    }
    if (state.total >= DAILY_CAP) return { ok: false, reason: "Tonight's free screenings are full. Come back tomorrow." };
    const key = await visitorKey(visitor);
    if ((state.visitors[key] ?? 0) >= PER_VISITOR) {
      return { ok: false, reason: `You have used today's ${PER_VISITOR} free trailers. Come back tomorrow.` };
    }
    state.total += 1;
    state.visitors[key] = (state.visitors[key] ?? 0) + 1;
    if (normalized && CODES.has(normalized)) state.codes[normalized] = (state.codes[normalized] ?? 0) + 1;
    await writeState(state);
    return { ok: true, code: normalized || undefined };
  });
  queue = task.catch(() => {});
  return task;
}
