import { relayJson, workerFetch } from "@/lib/worker";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return Response.json({ error: "No such job." }, { status: 404 });
  return relayJson(await workerFetch(`/jobs/${id}`));
}
