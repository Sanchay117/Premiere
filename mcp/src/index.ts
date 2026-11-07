// Premiere as an MCP server: a coding agent orders a launch trailer of the app it just built and
// hands the links to its user. It speaks stdio and calls the site's public API at PREMIERE_URL
// (the x402 order route and the job views), so it holds no keys and never pays.
//
//   npx -y tsx /path/to/Premiere/mcp/src/index.ts
//   node /path/to/Premiere/mcp/src/index.ts        (Node 22.18 or later strips the types itself)
//
// Relative imports carry their .ts extension and the code uses only erasable syntax, so plain
// node can run it: that spares Windows users the cmd /c wrapper npx needs there.

import { readFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  CAPTION_NOTES,
  CAPTIONS,
  DEFAULTS,
  FORMAT_NOTES,
  FORMATS,
  LENGTHS,
  listed,
  NOTES_MAX,
  optionsText,
  STYLE_NOTES,
  STYLES,
  VOICE_NOTES,
  VOICES,
} from "./options.ts";
import { describeJob, headline, isFinished } from "./report.ts";
import { type Order, type Ordered, Site, SiteError } from "./site.ts";
import type { JobView } from "./types.ts";

const DEFAULT_SITE = "http://localhost:3000";
const POLL_MS = 5_000;
const MAX_WAIT_SECONDS = 240;
const JOB_ID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };

/** PREMIERE_URL, forgiving a missing https:// since that is the usual slip. */
function siteBase(raw: string | undefined): string {
  const value = raw?.trim() || DEFAULT_SITE;
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    throw new Error(`PREMIERE_URL should be the Premiere site's address, such as https://premiere.example, but it is "${value}".`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`PREMIERE_URL should start with http:// or https://, but it is "${value}".`);
  }
  return `${url.origin}${url.pathname}`.replace(/\/+$/, "");
}

let site: Site;
try {
  site = new Site(siteBase(process.env.PREMIERE_URL), version);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

/** Demo links given in this session. Each one signs in to an account, so it is cut out of all this
 *  server says, even if the site repeats one in an error. */
const secrets = new Set<string>();

function redact(text: string): string {
  let out = text;
  for (const secret of secrets) out = out.split(secret).join("[demo link]");
  return out;
}

const reply = (text: string): CallToolResult => ({ content: [{ type: "text", text: redact(text) }] });
const refuse = (text: string): CallToolResult => ({ content: [{ type: "text", text: redact(text) }], isError: true });

const INSTRUCTIONS = [
  "Premiere films a web app in a real browser and returns a narrated launch trailer (about 45 seconds by default) with captions, music, two thumbnails and an SRT.",
  "Typical flow: call make_trailer with the app's public URL; it returns a job id at once. Then call trailer_status with that id and wait_seconds (for example 180), again until it reports done, and give the user the trailer, thumbnail and caption links. A trailer takes about 2 to 3 minutes once it starts.",
  "The app must be reachable on the public internet (localhost and private addresses are refused). Leave gallery off unless the user wants the trailer shown publicly. premiere_options lists the cuts, narrators, caption looks, lengths, formats and pricing.",
].join("\n");

const server = new McpServer({ name: "premiere", title: "Premiere", version }, { instructions: INSTRUCTIONS });

const orderShape = {
  url: z
    .string()
    .trim()
    .min(1)
    .max(2000)
    .describe(
      "The app to film, such as https://yourapp.xyz. It must be reachable from the public internet: localhost and private network addresses are refused, so deploy first (a preview URL works). Premiere stays on public pages unless demo_url signs it in.",
    ),
  style: z.enum(STYLES).default(DEFAULTS.style).describe(`The cut: ${listed(STYLE_NOTES)}.`),
  voice: z.enum(VOICES).default(DEFAULTS.voice).describe(`The narrator: ${listed(VOICE_NOTES)}.`),
  captions: z.enum(CAPTIONS).default(DEFAULTS.captions).describe(`The burned-in caption look: ${listed(CAPTION_NOTES)}.`),
  length: z.literal(LENGTHS).default(DEFAULTS.length).describe("Running time in seconds: 45 for the full trailer, 30 or 15 for ads and social posts."),
  format: z.enum(FORMATS).default(DEFAULTS.format).describe(`The frame: ${listed(FORMAT_NOTES)}.`),
  notes: z
    .string()
    .trim()
    .max(NOTES_MAX)
    .optional()
    .describe(
      `Director's notes, up to ${NOTES_MAX} characters: what to show, click or type, such as "type a prompt into the generator, then click Generate". Leave out to let Premiere find the main flow itself.`,
    ),
  demo_url: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .describe(
      "A link that opens the app already signed in to a demo account (a magic link or a URL with a demo token), so the trailer can show what is behind the login. Use a throwaway demo account, since anything it shows may be filmed. Kept secret: this server never repeats it.",
    ),
  gallery: z
    .boolean()
    .default(false)
    .describe(
      "Whether the finished trailer may hang in Premiere's public gallery. Defaults to false, since the app may be a private or staging build; set true only when the user wants it shown publicly.",
    ),
  access_code: z
    .string()
    .trim()
    .max(64)
    .optional()
    .describe("Only if Premiere answers that free trailers need an access code: the code the user was given. Leave out otherwise."),
};

type OrderArgs = z.output<z.ZodObject<typeof orderShape>>;

server.registerTool(
  "make_trailer",
  {
    title: "Make a launch trailer",
    description:
      "Order a launch trailer of a web app. Premiere opens the app in a real browser, writes a script, films the main flow and returns a narrated trailer with captions, music, two thumbnails and an SRT. Returns at once with a job id and the screening room link; the trailer takes about 2 to 3 minutes once it starts (longer if others are queued). Then call trailer_status with the id and wait_seconds.",
    inputSchema: orderShape,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  async (args, extra) => {
    const demoUrl = args.demo_url || undefined;
    if (demoUrl) secrets.add(demoUrl);
    const order: Order = {
      url: args.url,
      style: args.style,
      voice: args.voice,
      captions: args.captions,
      length: args.length,
      format: args.format,
      // Always sent: the site hangs a trailer in the gallery when the field is missing.
      gallery: args.gallery,
      ...(args.notes ? { notes: args.notes } : {}),
      ...(demoUrl ? { demoUrl } : {}),
      ...(args.access_code ? { code: args.access_code } : {}),
    };
    let ordered: Ordered;
    try {
      ordered = await site.order(order, extra.signal);
    } catch (err) {
      if (err instanceof SiteError) return refuse(err.message);
      throw err;
    }
    // One look at the queue so the receipt can say when it starts; not worth failing the order over.
    const job = await site.job(ordered.id, extra.signal).catch(() => null);
    return reply(receipt(ordered, args, job));
  },
);

function receipt(ordered: Ordered, args: OrderArgs, job: JobView | null): string {
  const id = ordered.id;
  const extras = [args.notes && "director's notes", args.demo_url && "the demo sign-in link", args.access_code && "an access code"].filter(Boolean);
  return [
    `Ordered. Job id: ${id}`,
    `Screening room (live progress, then the trailer): ${site.pageUrl(id)}`,
    `Order: ${args.style} cut, ${args.length} s, ${args.format}, narrator ${args.voice}, captions ${args.captions}, gallery ${args.gallery ? "on" : "off"}${extras.length ? `, with ${extras.join(" and ")}` : ""}.`,
    ...(job ? [`Now: ${headline(job)}.`] : []),
    ...(ordered.note ? [ordered.note] : []),
    `A trailer takes about 2 to 3 minutes once it starts. Next: call trailer_status with id "${id}" and wait_seconds 180, then again until it reports done (if a call times out, use wait_seconds 50).`,
  ].join("\n");
}

server.registerTool(
  "trailer_status",
  {
    title: "Check a trailer",
    description:
      "Check a trailer ordered with make_trailer. With wait_seconds (up to 240) it keeps checking every 5 seconds until the trailer is done or failed, or the time is up; 0 checks once. When done it returns the duration, the narrator, any notes, and links to trailer.mp4, both thumbnails, captions.srt and the screening room. If it is not done yet, call it again.",
    inputSchema: {
      id: z.string().trim().min(1).max(500).describe("The job id make_trailer returned. A screening room link works too."),
      wait_seconds: z
        .number()
        .int()
        .min(0)
        .max(MAX_WAIT_SECONDS)
        .default(0)
        .describe(
          `How long to wait for the trailer to finish, 0 to ${MAX_WAIT_SECONDS} seconds (0 checks once). If the call times out in your client, use 50.`,
        ),
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  async ({ id: given, wait_seconds: wait }, extra) => {
    const id = given.match(JOB_ID)?.[0]?.toLowerCase();
    if (!id) {
      return refuse(`"${given.slice(0, 80)}" is not a Premiere job id. Use the id make_trailer returned, which looks like 3f2b8c1e-5d4a-4e9b-9c7d-1a2b3c4d5e6f.`);
    }
    const token = extra._meta?.progressToken;
    const started = Date.now();
    const deadline = started + wait * 1000;
    let job: JobView | null = null;
    let problem: SiteError | null = null;
    for (;;) {
      try {
        job = await site.job(id, extra.signal);
        problem = null;
      } catch (err) {
        // A site that restarts or hiccups mid-wait is worth waiting out; a missing job is not.
        if (!(err instanceof SiteError)) throw err;
        if (!err.transient) return refuse(err.message);
        problem = err;
      }
      if (job && isFinished(job)) break;
      const left = deadline - Date.now();
      if (left <= 0) break;
      if (token !== undefined) {
        // The spec wants progress to rise with every notification, and the job's steps can sit
        // still for longer than one poll, so the count is seconds waited; the message says where
        // the job stands. Clients that reset their timeout on progress also stay patient this way.
        await extra
          .sendNotification({
            method: "notifications/progress",
            params: {
              progressToken: token,
              progress: Math.round((Date.now() - started) / 100) / 10,
              total: wait,
              message: job ? headline(job) : problem?.message,
            },
          })
          .catch(() => {});
      }
      await sleep(Math.min(POLL_MS, left), undefined, { signal: extra.signal });
    }
    if (!job) return refuse(problem?.message ?? `Could not check trailer ${id}.`);
    const stale = problem ? `\nThe latest check failed (${problem.message}), so this is the status from the check before.` : "";
    return reply(describeJob(job, site) + stale);
  },
);

server.registerTool(
  "premiere_options",
  {
    title: "Premiere's options and price",
    description:
      "List Premiere's choices (cuts, narrators, caption looks, lengths, formats), what every trailer comes with, and the price. Call it when the user wants to pick a style or a voice, or asks what a trailer costs.",
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  async () => reply(optionsText()),
);

// When the client goes away, its end of the pipe closes. Exit then: a wait in progress would
// otherwise keep an orphaned server alive, since npx on Windows does not pass the kill along.
process.stdin.on("end", () => process.exit(0));

await server.connect(new StdioServerTransport());
console.error(`Premiere MCP server ${version} is ready, ordering from ${site.base}`);
