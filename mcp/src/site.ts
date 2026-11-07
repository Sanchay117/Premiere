// The Premiere site's public API, as any agent sees it: the x402 order route and the job views.
// Going through the site rather than the worker means this server needs no token or key, and
// every refusal it relays (bad link, daily limit, payment) is the one people get on the website.

import type { Caption, Format, Length, Style, Voice } from "./options.ts";
import type { JobView } from "./types.ts";

/** Long enough for a site that is waking up, short enough that a hung one does not eat a whole wait. */
const REQUEST_TIMEOUT_MS = 20_000;

/** The order body of POST /api/x402/trailers, named as the site names it. */
export interface Order {
  url: string;
  style: Style;
  voice: Voice;
  captions: Caption;
  length: Length;
  format: Format;
  notes?: string;
  demoUrl?: string;
  gallery: boolean;
  code?: string;
}

export interface Ordered {
  id: string;
  free: boolean;
  /** The site's own word on the order, such as when free trailers end. */
  note: string | null;
}

/** A failure worded so an agent can pass it straight to its user. */
export class SiteError extends Error {
  /** The HTTP status, or null when the site could not be reached at all. */
  readonly status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = "SiteError";
    this.status = status;
  }

  /** Worth another try in a few seconds: the site was unreachable or had a server error. */
  get transient(): boolean {
    return this.status === null || this.status >= 500;
  }
}

interface Reply {
  status: number;
  statusText: string;
  headers: Headers;
  json: Record<string, unknown> | null;
}

/** USDC on Base and Base Sepolia, the only assets Premiere asks for. Six decimals. */
const USDC = new Set(["0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", "0x036cbd53842c5426634e7929541ec2318f3dcf7e"]);
const NETWORKS: Record<string, string> = { "eip155:8453": "Base", "eip155:84532": "Base Sepolia" };

export class Site {
  readonly base: string;
  private readonly userAgent: string;

  constructor(base: string, version: string) {
    this.base = base;
    this.userAgent = `premiere-mcp/${version}`;
  }

  pageUrl(id: string): string {
    return `${this.base}/jobs/${id}`;
  }

  fileUrl(id: string, name: string): string {
    return `${this.base}/api/jobs/${id}/files/${encodeURIComponent(name)}`;
  }

  async order(order: Order, signal?: AbortSignal): Promise<Ordered> {
    const reply = await this.call("/api/x402/trailers", { method: "POST", body: JSON.stringify(order) }, signal);
    const said = typeof reply.json?.error === "string" ? reply.json.error : null;
    if (reply.status === 402) throw new SiteError(this.paymentNeeded(reply.headers.get("payment-required"), said), 402);
    if (reply.status < 200 || reply.status >= 300) {
      if (!said) throw this.notTheApi(reply);
      // A refusal over access codes says so (needsCode); older sites only say it in words.
      const hint = reply.json?.needsCode === true || /access code/i.test(said) ? " If the user has a code, call make_trailer again with access_code." : "";
      throw new SiteError(`Premiere did not take the order: ${said}${hint}`, reply.status);
    }
    const id = reply.json?.id;
    if (typeof id !== "string" || !id) throw new SiteError(`Premiere at ${this.base} accepted the order but sent back no job id.`, reply.status);
    return { id, free: reply.json?.free !== false, note: typeof reply.json?.note === "string" ? reply.json.note : null };
  }

  async job(id: string, signal?: AbortSignal): Promise<JobView> {
    const reply = await this.call(`/api/jobs/${id}`, { method: "GET" }, signal);
    // Premiere's 404 is JSON; an HTML one means PREMIERE_URL points somewhere else.
    if (reply.status === 404 && reply.json) {
      // Live jobs sit in the worker's memory and only ended ones are saved, so a restart loses
      // anything still in the queue or in progress.
      throw new SiteError(
        `Premiere at ${this.base} has no trailer job ${id}. Check the id; a job that was still queued or in progress when the site restarted is lost and has to be ordered again.`,
        404,
      );
    }
    if (reply.status < 200 || reply.status >= 300) {
      const said = typeof reply.json?.error === "string" ? reply.json.error : null;
      if (!said) throw this.notTheApi(reply);
      throw new SiteError(`Could not check trailer ${id}: ${said}`, reply.status);
    }
    const job = reply.json;
    if (!job || typeof job.status !== "string" || !Array.isArray(job.steps)) throw this.notTheApi(reply);
    return job as unknown as JobView;
  }

  private async call(path: string, init: { method: string; body?: string }, signal?: AbortSignal): Promise<Reply> {
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`${this.base}${path}`, {
        ...init,
        headers: { accept: "application/json", "user-agent": this.userAgent, ...(init.body ? { "content-type": "application/json" } : {}) },
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
      // Read inside the try, so a body that stalls is covered by the same timeout.
      const text = await response.text();
      return { status: response.status, statusText: response.statusText, headers: response.headers, json: parseObject(text) };
    } catch (err) {
      // A cancel from the client ends the call quietly instead of reporting a fault.
      if (signal?.aborted) throw err;
      if (timeout.aborted) throw new SiteError(`Premiere at ${this.base} did not answer within ${REQUEST_TIMEOUT_MS / 1000} s. Try again in a minute.`, null);
      throw new SiteError(`Could not reach Premiere at ${this.base} (${reason(err)}). Check that PREMIERE_URL is the site's address and that the site is up.`, null);
    }
  }

  private notTheApi(reply: Reply): SiteError {
    return new SiteError(
      `Premiere at ${this.base} answered ${reply.status} ${reply.statusText} without the JSON its API sends. Check that PREMIERE_URL is the site's address.`,
      reply.status,
    );
  }

  /** This server holds no wallet, so a 402 becomes directions: the price, and who can pay it. */
  private paymentNeeded(header: string | null, said: string | null): string {
    const lines = [
      `Premiere did not start this trailer: it needs payment first. ${said ?? "A trailer costs a few USDC on Base."}`,
      `This MCP server cannot pay. To order it, send the same order to ${this.base}/api/x402/trailers from an x402-capable client (one that can sign a USDC payment from a wallet): the first answer is 402 with a PAYMENT-REQUIRED header, and the client repeats the request with a PAYMENT-SIGNATURE header. Or the user can order it on the website, ${this.base}, and pay from their wallet there.`,
    ];
    const offer = describeOffer(header);
    if (offer) lines.push(`Payment requested (x402 v2): ${offer}.`);
    return lines.join("\n");
  }
}

/** The first payment option in an x402 v2 PAYMENT-REQUIRED header (base64 JSON), in words. */
function describeOffer(header: string | null): string | null {
  if (!header) return null;
  try {
    const required = JSON.parse(Buffer.from(header, "base64").toString("utf8")) as {
      accepts?: { scheme?: string; network?: string; amount?: string; asset?: string; payTo?: string }[];
    };
    const offer = required.accepts?.[0];
    if (!offer?.amount || !offer.network) return null;
    const usdc = offer.asset !== undefined && USDC.has(offer.asset.toLowerCase());
    const amount = usdc ? `${Number(offer.amount) / 1e6} USDC (${offer.amount} in base units)` : `${offer.amount} base units of ${offer.asset ?? "an unnamed asset"}`;
    const network = NETWORKS[offer.network] ? `${NETWORKS[offer.network]} (${offer.network})` : offer.network;
    return `${offer.scheme ?? "exact"} payment of ${amount} on ${network}${offer.payTo ? ` to ${offer.payTo}` : ""}`;
  } catch {
    return null;
  }
}

function parseObject(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Node's fetch hides the useful part (ECONNREFUSED, ENOTFOUND) in the error's cause. */
function reason(err: unknown): string {
  const cause = err instanceof Error ? (err.cause as { code?: unknown; message?: unknown } | undefined) : undefined;
  if (typeof cause?.code === "string") return cause.code;
  if (typeof cause?.message === "string" && cause.message) return cause.message;
  return err instanceof Error ? err.message : String(err);
}
