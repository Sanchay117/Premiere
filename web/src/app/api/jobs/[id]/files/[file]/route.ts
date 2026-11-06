import { workerFetch } from "@/lib/worker";

export const dynamic = "force-dynamic";

const PASS_HEADERS = ["content-type", "content-length", "content-range", "accept-ranges", "content-disposition", "cache-control"];

/** Streams a job file from the worker, passing byte ranges through so videos can seek. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string; file: string }> }) {
  const { id, file } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id) || !/^[\w.-]+\.(jpg|png|mp4|srt)$/.test(file)) {
    return new Response("Not found", { status: 404 });
  }
  const download = new URL(request.url).searchParams.has("download") ? "?download=1" : "";
  const range = request.headers.get("range");
  // The viewer's abort travels on to the worker, so a video someone stops watching does not keep
  // the worker's file open.
  const response = await workerFetch(`/jobs/${id}/files/${file}${download}`, { headers: range ? { range } : {}, signal: request.signal });
  if (!response.ok || !response.body) return new Response("Not found", { status: response.status === 416 ? 416 : 404 });
  const headers = new Headers();
  for (const name of PASS_HEADERS) {
    const value = response.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(response.body, { status: response.status, headers });
}
