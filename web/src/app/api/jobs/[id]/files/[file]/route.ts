import { workerFetch } from "@/lib/worker";

export const dynamic = "force-dynamic";

const PASS_HEADERS = ["content-type", "content-length", "content-range", "accept-ranges", "content-disposition", "cache-control", "etag", "last-modified"];
/** Byte ranges so videos can seek, and the browser's cache checks so an unchanged file comes back
 *  as a quick 304 while a re-rendered one (new thumbnails, say) shows up straight away. */
const FORWARD_HEADERS = ["range", "if-range", "if-none-match"];

/** Streams a job file from the worker. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string; file: string }> }) {
  const { id, file } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id) || !/^[\w.-]+\.(jpg|png|mp4|srt)$/.test(file)) {
    return new Response("Not found", { status: 404 });
  }
  const download = new URL(request.url).searchParams.has("download") ? "?download=1" : "";
  const forward: Record<string, string> = {};
  for (const name of FORWARD_HEADERS) {
    const value = request.headers.get(name);
    if (value) forward[name] = value;
  }
  // The viewer's abort travels on to the worker, so a video someone stops watching does not keep
  // the worker's file open.
  const response = await workerFetch(`/jobs/${id}/files/${file}${download}`, { headers: forward, signal: request.signal });
  const headers = new Headers();
  for (const name of PASS_HEADERS) {
    const value = response.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (response.status === 304) return new Response(null, { status: 304, headers });
  if (!response.ok || !response.body) return new Response("Not found", { status: response.status === 416 ? 416 : 404 });
  return new Response(response.body, { status: response.status, headers });
}
