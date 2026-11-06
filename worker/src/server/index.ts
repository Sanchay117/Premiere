// npm run serve (in worker/) or npm run dev (repo root, with the web app).
// Small HTTP API the web app calls server-side:
//   POST /jobs                    { url, planner: "haiku" | "sonnet" | "opus" | "none", fresh? } -> 202 { id }
//   GET  /jobs/:id                -> JobView
//   GET  /jobs/:id/files/:name    -> one of the job's screenshots
//   GET  /health
// Binds to 127.0.0.1 by default. Set WORKER_TOKEN (here and in the web app) before exposing it.

import { timingSafeEqual } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { config } from "../config";
import { assertPublicUrl, UnsafeUrlError } from "../safety/url-guard";
import { accessRequired, admit } from "./access";
import { createJob, getJob, jobFile, toView } from "./jobs";
import type { PlannerChoice } from "./types";

const PORT = Number(process.env.WORKER_PORT) || 8787;
const HOST = process.env.WORKER_HOST?.trim() || "127.0.0.1";
const TOKEN = process.env.WORKER_TOKEN?.trim() || null;
const PLANNERS: PlannerChoice[] = ["haiku", "sonnet", "opus", "none"];
const MAX_BODY = 10_000;
const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".mp4": "video/mp4",
  ".srt": "application/x-subrip; charset=utf-8",
};

function send(res: http.ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(json);
}

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

  if (req.method === "POST" && pathname === "/jobs") {
    let body: Record<string, unknown>;
    try {
      body = await readJson(req);
    } catch {
      return send(res, 400, { error: "Send JSON like { \"url\": \"yourapp.xyz\" }." });
    }
    const rawUrl = typeof body.url === "string" ? body.url.trim().slice(0, 2000) : "";
    if (!rawUrl) return send(res, 400, { error: "Paste a link to your app." });
    const planner = PLANNERS.includes(body.planner as PlannerChoice) ? (body.planner as PlannerChoice) : "sonnet";
    let url: URL;
    try {
      url = await assertPublicUrl(rawUrl);
    } catch (err) {
      const message = err instanceof UnsafeUrlError || err instanceof Error ? err.message : "That link does not work.";
      return send(res, 400, { error: message });
    }
    // The web app forwards a hashed visitor id; direct callers fall back to their socket address.
    const visitor = String(req.headers["x-visitor"] ?? req.socket.remoteAddress ?? "unknown").slice(0, 128);
    const decision = await admit(typeof body.code === "string" ? body.code.slice(0, 64) : undefined, visitor);
    if (!decision.ok) return send(res, 403, { error: decision.reason });
    const job = createJob(url.href, planner, body.fresh === true);
    console.log(`job ${job.id.slice(0, 8)} admitted${decision.code ? ` with code ${decision.code}` : ""}`);
    return send(res, 202, { id: job.id });
  }

  const jobMatch = pathname.match(/^\/jobs\/([0-9a-f-]{36})$/);
  if (req.method === "GET" && jobMatch) {
    const job = getJob(jobMatch[1]!);
    return job ? send(res, 200, toView(job)) : send(res, 404, { error: "No such job. It may have expired." });
  }

  const fileMatch = pathname.match(/^\/jobs\/([0-9a-f-]{36})\/files\/([\w.-]+)$/);
  if (req.method === "GET" && fileMatch) {
    const job = getJob(fileMatch[1]!);
    const name = fileMatch[2]!;
    const file = job ? jobFile(job, name) : null;
    if (!file) return send(res, 404, { error: "Not found" });
    const info = await stat(file).catch(() => null);
    if (!info) return send(res, 404, { error: "Not found" });
    const headers: http.OutgoingHttpHeaders = {
      "content-type": CONTENT_TYPES[path.extname(name)] ?? "application/octet-stream",
      "accept-ranges": "bytes",
      "cache-control": "private, max-age=3600",
    };
    if (new URL(req.url ?? "/", "http://worker").searchParams.has("download")) {
      headers["content-disposition"] = `attachment; filename="${name}"`;
    }
    // Byte ranges, so the video player can seek.
    const range = req.headers.range?.match(/^bytes=(\d*)-(\d*)$/);
    if (range && (range[1] || range[2])) {
      const start = range[1] ? Number(range[1]) : Math.max(0, info.size - Number(range[2]));
      const end = range[1] && range[2] ? Math.min(Number(range[2]), info.size - 1) : info.size - 1;
      if (start > end || start >= info.size) {
        res.writeHead(416, { "content-range": `bytes */${info.size}` }).end();
        return;
      }
      res.writeHead(206, { ...headers, "content-range": `bytes ${start}-${end}/${info.size}`, "content-length": end - start + 1 });
      createReadStream(file, { start, end }).pipe(res);
      return;
    }
    res.writeHead(200, { ...headers, "content-length": info.size });
    createReadStream(file).pipe(res);
    return;
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
