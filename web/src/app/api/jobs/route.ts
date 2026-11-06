import { relayJson, workerFetch } from "@/lib/worker";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send JSON with a url." }, { status: 400 });
  }
  const { url, planner, fresh } = (body ?? {}) as { url?: unknown; planner?: unknown; fresh?: unknown };
  const response = await workerFetch("/jobs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url, planner, fresh }),
  });
  return relayJson(response);
}
