import { orderFields, relayJson, visitorId, workerFetch } from "@/lib/worker";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send JSON with a url." }, { status: 400 });
  }
  const response = await workerFetch("/jobs", {
    method: "POST",
    headers: { "content-type": "application/json", "x-visitor": visitorId(request) },
    body: JSON.stringify(orderFields(body)),
  });
  return relayJson(response);
}
