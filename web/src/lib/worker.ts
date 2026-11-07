// Server-side only: the browser talks to /api/*, and these routes talk to the worker.
// WORKER_URL and WORKER_TOKEN never reach the client.

import "server-only";
import { createHash } from "node:crypto";

const WORKER_URL = (process.env.WORKER_URL ?? "http://127.0.0.1:8787").replace(/\/+$/, "");
const WORKER_TOKEN = process.env.WORKER_TOKEN?.trim();

export async function workerFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (WORKER_TOKEN) headers.set("authorization", `Bearer ${WORKER_TOKEN}`);
  try {
    return await fetch(`${WORKER_URL}${path}`, { ...init, headers, cache: "no-store" });
  } catch {
    return Response.json(
      { error: "The trailer worker is not running. Start it with npm run dev from the repo root." },
      { status: 503 },
    );
  }
}

/** Reads a worker JSON endpoint for a server component; null when the worker is unreachable. */
export async function workerJson<T>(path: string): Promise<T | null> {
  const response = await workerFetch(path);
  if (!response.ok) return null;
  return (await response.json().catch(() => null)) as T | null;
}

/** Relays a worker JSON response with its status code, plus any of the named headers it set. */
export async function relayJson(response: Response, passHeaders: string[] = []): Promise<Response> {
  const body = await response.text();
  const headers: Record<string, string> = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
  for (const name of passHeaders) {
    const value = response.headers.get(name);
    if (value) headers[name] = value;
  }
  return new Response(body, { status: response.status, headers });
}

/** A hash of the caller's IP for per-visitor limits. The worker keys it again with a secret before
 *  storing it, so no IP (or reversible hash of one) is kept. */
export function visitorId(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "local";
  return createHash("sha256").update(`premiere-visitor:${ip}`).digest("hex").slice(0, 32);
}

/** The order fields the worker accepts, copied from a request body. */
export function orderFields(body: unknown): Record<string, unknown> {
  const raw = (body ?? {}) as Record<string, unknown>;
  const keys = ["url", "fresh", "code", "style", "voice", "captions", "length", "format", "notes", "demoUrl", "gallery"];
  return Object.fromEntries(keys.filter((k) => raw[k] !== undefined).map((k) => [k, raw[k]]));
}
