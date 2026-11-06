// Server-side only: the browser talks to /api/*, and these routes talk to the worker.
// WORKER_URL and WORKER_TOKEN never reach the client.

import "server-only";

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

/** Relays a worker JSON response with its status code. */
export async function relayJson(response: Response): Promise<Response> {
  const body = await response.text();
  return new Response(body, {
    status: response.status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
