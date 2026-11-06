import { createHash } from "node:crypto";
import { relayJson, workerFetch } from "@/lib/worker";

export const dynamic = "force-dynamic";

/** A hash of the caller's IP for per-visitor limits. The worker keys it again with a secret before
 *  storing it, so no IP (or reversible hash of one) is kept. */
function visitorId(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "local";
  return createHash("sha256").update(`premiere-visitor:${ip}`).digest("hex").slice(0, 32);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send JSON with a url." }, { status: 400 });
  }
  const { url, planner, fresh, code } = (body ?? {}) as { url?: unknown; planner?: unknown; fresh?: unknown; code?: unknown };
  const response = await workerFetch("/jobs", {
    method: "POST",
    headers: { "content-type": "application/json", "x-visitor": visitorId(request) },
    body: JSON.stringify({ url, planner, fresh, code }),
  });
  return relayJson(response);
}
