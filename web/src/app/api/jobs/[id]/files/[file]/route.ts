import { workerFetch } from "@/lib/worker";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; file: string }> }) {
  const { id, file } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id) || !/^[\w.-]+\.jpg$/.test(file)) {
    return new Response("Not found", { status: 404 });
  }
  const response = await workerFetch(`/jobs/${id}/files/${file}`);
  if (!response.ok || !response.body) return new Response("Not found", { status: 404 });
  return new Response(response.body, {
    status: 200,
    headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=3600" },
  });
}
