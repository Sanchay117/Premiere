import { relayJson, visitorId, workerFetch } from "@/lib/worker";

export const dynamic = "force-dynamic";

/** The fields a recut may carry; anything else is dropped before it reaches the worker. */
function recutFields(body: unknown): Record<string, unknown> {
  const raw = (body ?? {}) as Record<string, unknown>;
  const keys = ["hook", "shots", "close", "voice", "captions", "code"];
  return Object.fromEntries(keys.filter((k) => raw[k] !== undefined).map((k) => [k, raw[k]]));
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return Response.json({ error: "No such job." }, { status: 404 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send the edited script as JSON." }, { status: 400 });
  }
  const response = await workerFetch(`/jobs/${id}/recut`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-visitor": visitorId(request) },
    body: JSON.stringify(recutFields(body)),
  });
  return relayJson(response);
}
