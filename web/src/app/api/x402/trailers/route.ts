// Order a trailer with one HTTP request, the way AI agents (and the website, once payments are on)
// do it. x402 v2: an unpaid request gets 402 with a PAYMENT-REQUIRED header; the client signs a
// USDC authorization and repeats the request with PAYMENT-SIGNATURE. Until 16 Nov trailers are
// free and the first request is accepted.
//   POST /api/x402/trailers  { url, style?, voice?, captions?, length?, format?, notes?, demoUrl?, gallery? }
//   -> 202 { id, status, page }, then poll GET /api/jobs/:id until result.trailer is set.

import { orderFields, relayJson, visitorId, workerFetch } from "@/lib/worker";

export const dynamic = "force-dynamic";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, payment-signature, access-control-expose-headers",
  "access-control-expose-headers": "payment-required, payment-response",
};

function withCors(response: Response): Response {
  for (const [name, value] of Object.entries(CORS)) response.headers.set(name, value);
  return response;
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

/** A short description for agents that look before they buy. */
export async function GET() {
  const pricing = await workerFetch("/pricing").then((r) => (r.ok ? r.json() : null)).catch(() => null);
  return withCors(
    Response.json({
      name: "Premiere",
      description:
        "Turns a web app URL into a launch trailer: 45 seconds by default (or a 30 or 15 second cut), 1920x1080 or vertical 1080x1920, narrated, captioned and scored, with two thumbnails and an SRT.",
      method: "POST",
      body: {
        url: "https://yourapp.xyz",
        style: "hype | walkthrough",
        voice: "auto | atlas | zeus | asteria | thalia | ophelia | athena | draco | pandora",
        captions: "karaoke | boxed | bold | off",
        length: "45 | 30 | 15",
        format: "landscape | vertical",
        notes: "optional director's notes, up to 280 characters: what to show, click or type",
        demoUrl: "optional link that opens the app signed in to a demo account; kept secret, and that trailer stays out of the gallery",
        gallery: "false unless sent as true, which lets the finished trailer hang in the public gallery",
      },
      returns: "202 { id, status, page }. Poll status (GET) until result.trailer is set; files are under /api/jobs/:id/files/.",
      pricing,
    }),
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return withCors(Response.json({ error: "Send JSON with a url." }, { status: 400 }));
  }
  const headers: Record<string, string> = { "content-type": "application/json", "x-visitor": visitorId(request) };
  const signature = request.headers.get("payment-signature");
  if (signature) headers["payment-signature"] = signature;
  const response = await workerFetch("/x402/trailers", { method: "POST", headers, body: JSON.stringify(orderFields(body)) });
  return withCors(await relayJson(response, ["payment-required", "payment-response"]));
}
