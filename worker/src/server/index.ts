// npm run serve (in worker/) or npm run dev (repo root, with the web app).
// Small HTTP API the web app calls server-side:
//   POST /jobs                    { url, style?, voice?, captions?, gallery?, code?, fresh? } -> 202 { id }
//   GET  /jobs/:id                -> JobView (live, or read back from the job's job.json)
//   GET  /jobs/:id/files/:name    -> a screenshot, or the trailer, thumbnails and captions once rendered
//   GET  /gallery                 -> approved trailers whose makers opted in, newest first
//   GET  /pricing                 -> free, or the price, network and receiving address
//   POST /x402/trailers           { url, style?, voice?, captions? } -> 202 { id, status, page }; with payments
//                                   on, 402 + PAYMENT-REQUIRED until it carries a PAYMENT-SIGNATURE
//   GET  /health
// Binds to 127.0.0.1 by default. Set WORKER_TOKEN (here and in the web app) before exposing it.

import { timingSafeEqual } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import { pipeline } from "node:stream";
import path from "node:path";
import { config } from "../config";
import { assertPublicUrl, UnsafeUrlError } from "../safety/url-guard";
import { parseNotes, parseOptions, type TrailerOptions } from "../options";
import { charge, paymentConfig, paymentsEnabled, pricing } from "../payments";
import { accessRequired, admit } from "./access";
import { warmRenderer } from "../render/render";
import { galleryEntries } from "./gallery";
import { createJob, findJob, jobFile, toView } from "./jobs";

const PORT = Number(process.env.WORKER_PORT) || 8787;
const HOST = process.env.WORKER_HOST?.trim() || "127.0.0.1";
const TOKEN = process.env.WORKER_TOKEN?.trim() || null;
const MAX_BODY = 10_000;
const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".mp4": "video/mp4",
  ".srt": "application/x-subrip; charset=utf-8",
};

function send(res: http.ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  const json = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers });
  res.end(json);
}

type JobRequest =
  | { ok: true; url: URL; options: TrailerOptions; gallery: boolean; fresh: boolean; code: string | undefined; notes: string | null; demoUrl: string | null }
  | { ok: false; status: number; error: string };

/** Parses and checks an order for a trailer. The URL is vetted before anything is charged. */
async function readJobRequest(req: http.IncomingMessage): Promise<JobRequest> {
  let body: Record<string, unknown>;
  try {
    body = await readJson(req);
  } catch {
    return { ok: false, status: 400, error: "Send JSON like { \"url\": \"yourapp.xyz\" }." };
  }
  const rawUrl = typeof body.url === "string" ? body.url.trim().slice(0, 2000) : "";
  if (!rawUrl) return { ok: false, status: 400, error: "Paste a link to your app." };
  let url: URL;
  try {
    url = await assertPublicUrl(rawUrl);
  } catch (err) {
    const message = err instanceof UnsafeUrlError || err instanceof Error ? err.message : "That link does not work.";
    return { ok: false, status: 400, error: message };
  }
  // A demo link opens the app signed in. It gets the same safety checks as any URL, and it is
  // never echoed back, logged or saved.
  let demoUrl: string | null = null;
  if (typeof body.demoUrl === "string" && body.demoUrl.trim()) {
    try {
      demoUrl = (await assertPublicUrl(body.demoUrl.trim().slice(0, 2000))).href;
    } catch {
      return { ok: false, status: 400, error: "That demo link does not work. It needs to be a public http or https link." };
    }
  }
  return {
    ok: true,
    url,
    demoUrl,
    options: parseOptions(body),
    gallery: body.gallery !== false,
    fresh: body.fresh === true,
    code: typeof body.code === "string" ? body.code.slice(0, 64) : undefined,
    notes: parseNotes(body.notes),
  };
}

/** The web app forwards a hashed visitor id; direct callers fall back to their socket address. */
const visitorOf = (req: http.IncomingMessage) => String(req.headers["x-visitor"] ?? req.socket.remoteAddress ?? "unknown").slice(0, 128);

const jobLinks = (id: string) => ({ id, status: `${paymentConfig.publicUrl}/api/jobs/${id}`, page: `${paymentConfig.publicUrl}/jobs/${id}` });

function authorized(req: http.IncomingMessage): boolean {
  if (!TOKEN) return true;
  const given = Buffer.from(req.headers.authorization ?? "");
  const expected = Buffer.from(`Bearer ${TOKEN}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function readJson(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw new Error("Request body too large");
    chunks.push(chunk as Buffer);
  }
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
}

async function handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  if (!authorized(req)) return send(res, 401, { error: "Unauthorized" });
  const { pathname } = new URL(req.url ?? "/", "http://worker");

  if (req.method === "GET" && pathname === "/health") {
    return send(res, 200, { ok: true, claude: Boolean(config.apiKey), voice: Boolean(config.deepgramKey), model: config.model, accessRequired });
  }

  if (req.method === "GET" && pathname === "/pricing") {
    return send(res, 200, pricing());
  }

  // The website's box office. While trailers are free it admits within the daily limits; once
  // payments are on, people pay through the x402 route below instead.
  if (req.method === "POST" && pathname === "/jobs") {
    const order = await readJobRequest(req);
    if (!order.ok) return send(res, order.status, { error: order.error });
    if (paymentsEnabled()) {
      return send(res, 402, { error: `A trailer costs $${paymentConfig.priceUsd} in USDC. Pay with your wallet below.`, payment: true });
    }
    const decision = await admit(order.code, visitorOf(req));
    if (!decision.ok) return send(res, 403, { error: decision.reason, needsCode: decision.needsCode ?? false });
    const job = createJob(order.url.href, order.fresh, order.options, order.gallery, { notes: order.notes, demoUrl: order.demoUrl });
    console.log(`job ${job.id.slice(0, 8)} admitted${decision.code ? ` with code ${decision.code}` : ""}`);
    return send(res, 202, { id: job.id });
  }

  // One request orders a trailer: for agents, and for people paying from the website.
  if (req.method === "POST" && pathname === "/x402/trailers") {
    const order = await readJobRequest(req);
    if (!order.ok) return send(res, order.status, { error: order.error });
    if (!paymentsEnabled()) {
      const decision = await admit(order.code, visitorOf(req));
      if (!decision.ok) return send(res, 403, { error: decision.reason });
      const job = createJob(order.url.href, false, order.options, order.gallery, { notes: order.notes, demoUrl: order.demoUrl });
      console.log(`job ${job.id.slice(0, 8)} ordered over x402 (free)`);
      return send(res, 202, { ...jobLinks(job.id), free: true, note: "Trailers are free until 16 Nov 2026." });
    }
    const signature = req.headers["payment-signature"];
    const paid = await charge(typeof signature === "string" ? signature : undefined);
    if (!paid.ok) return send(res, paid.status, { error: paid.error }, paid.headers);
    const job = createJob(order.url.href, false, order.options, order.gallery, { notes: order.notes, demoUrl: order.demoUrl });
    console.log(`job ${job.id.slice(0, 8)} paid by ${paid.payer}, tx ${paid.transaction}`);
    return send(res, 202, { ...jobLinks(job.id), free: false, transaction: paid.transaction }, paid.headers);
  }

  const jobMatch = pathname.match(/^\/jobs\/([0-9a-f-]{36})$/);
  if (req.method === "GET" && jobMatch) {
    const job = await findJob(jobMatch[1]!);
    return job ? send(res, 200, toView(job)) : send(res, 404, { error: "No such job. It may have expired." });
  }

  const fileMatch = pathname.match(/^\/jobs\/([0-9a-f-]{36})\/files\/([\w.-]+)$/);
  if (req.method === "GET" && fileMatch) {
    const job = await findJob(fileMatch[1]!);
    const name = fileMatch[2]!;
    const file = job ? jobFile(job, name) : null;
    if (!file) return send(res, 404, { error: "Not found" });
    const info = await stat(file).catch(() => null);
    if (!info) return send(res, 404, { error: "Not found" });
    // A finished job's files can still be re-rendered (new thumbnails, a new caption look), so
    // browsers check back every time and get a quick 304 while the file is unchanged.
    const etag = `"${info.size.toString(36)}-${Math.floor(info.mtimeMs).toString(36)}"`;
    const headers: http.OutgoingHttpHeaders = {
      "content-type": CONTENT_TYPES[path.extname(name)] ?? "application/octet-stream",
      "accept-ranges": "bytes",
      "cache-control": "private, no-cache",
      etag,
      "last-modified": info.mtime.toUTCString(),
    };
    if (new URL(req.url ?? "/", "http://worker").searchParams.has("download")) {
      headers["content-disposition"] = `attachment; filename="${name}"`;
    }
    if (req.headers["if-none-match"]?.split(/\s*,\s*/).includes(etag)) {
      res.writeHead(304, headers).end();
      return;
    }
    // Byte ranges, so the video player can seek. A range for an older copy of the file (If-Range
    // names another version) gets the whole new file instead.
    const range = req.headers.range?.match(/^bytes=(\d*)-(\d*)$/);
    const ifRange = req.headers["if-range"];
    if (range && (range[1] || range[2]) && (!ifRange || ifRange === etag)) {
      const start = range[1] ? Number(range[1]) : Math.max(0, info.size - Number(range[2]));
      const end = range[1] && range[2] ? Math.min(Number(range[2]), info.size - 1) : info.size - 1;
      if (start > end || start >= info.size) {
        res.writeHead(416, { "content-range": `bytes */${info.size}` }).end();
        return;
      }
      res.writeHead(206, { ...headers, "content-range": `bytes ${start}-${end}/${info.size}`, "content-length": end - start + 1 });
      // pipeline, not pipe: when a viewer stops a video early, pipe would leave the file open.
      pipeline(createReadStream(file, { start, end }), res, () => {});
      return;
    }
    res.writeHead(200, { ...headers, "content-length": info.size });
    pipeline(createReadStream(file), res, () => {});
    return;
  }

  if (req.method === "GET" && pathname === "/gallery") {
    return send(res, 200, { trailers: await galleryEntries() });
  }

  send(res, 404, { error: "Not found" });
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error("request failed:", err);
    if (!res.headersSent) send(res, 500, { error: "Internal error" });
    else res.end();
  });
});

server.listen(PORT, HOST, () => {
  warmRenderer();
  console.log(`Premiere worker on http://${HOST}:${PORT} (Claude ${config.apiKey ? "on" : "off"}, default ${config.model})`);
  if (!TOKEN && HOST !== "127.0.0.1" && HOST !== "localhost") {
    console.warn("WORKER_TOKEN is not set while listening beyond localhost. Set it before exposing the worker.");
  }
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1000).unref();
  });
}
