# Premiere

**Paste a URL, get a launch trailer.**

**Try it live: [premiere-trailers.duckdns.org](https://premiere-trailers.duckdns.org)** · **[Watch the demo](https://youtu.be/LVTVQveyp3U)** (2:19)

[![Watch the demo: Premiere, from a link to a launch trailer](https://img.youtube.com/vi/LVTVQveyp3U/maxresdefault.jpg)](https://youtu.be/LVTVQveyp3U)

Premiere opens your app in a real browser, works out what it does, writes a script, clicks through the main flow while it films, and hands back a narrated trailer of about 45 seconds (or a 30 or 15 second cut, wide or vertical) with captions, music and thumbnails. It takes about two and a half minutes. Nobody records anything and nobody edits anything.

Every vibecoded app needs a demo video: for the launch post, the hackathon entry, the raise page. Most founders skip it or lose a day making one. Premiere makes it from the link alone.

Built in a week for Vibestarter's Vibeathon 02 (Night shift).

## What you get

| File | What it is |
| --- | --- |
| `trailer.mp4` | 1920×1080 (or 1080×1920 vertical), about 45, 30 or 15 seconds, H.264 and AAC, captions burned in, sound mastered to -16 LUFS |
| `thumbnail-1920.png`, `thumbnail-1280.png` | Posters for YouTube, X, Discord and raise pages, showing your app in your app's own color |
| `captions.srt` | Word-timed subtitles |

Each order picks:

- **The cut.** `hype`: punch titles and footage on a floating screen. `walkthrough`: a calm, full-frame tour.
- **The narrator.** One of eight voices, or `auto` to match the app's mood.
- **The captions.** `karaoke`, `boxed`, `bold` or `off`. The SRT ships either way.
- **The running time.** 45 seconds for the full trailer, or a 30 or 15 second cut for ads and social posts.
- **The screen.** Wide 16:9 for YouTube, X and raise pages, or tall 9:16 for TikTok, Reels and Shorts.
- **Director's notes** (optional). One line on what to show, click or type, such as "type a prompt, then click Generate".
- **A demo link** (optional). For apps behind a login: a link that opens the app signed in to a demo account. Premiere films what is behind the login, never stores the link, and keeps that trailer out of the gallery.

Then, in the screening room, **recut it**: change any line, the narrator or the captions, and Premiere records the new lines and cuts them over the same footage in about a minute, without filming again.

Trailers are free until 16 Nov 2026, within daily limits. After that a trailer costs a few USDC on Base, paid from your wallet.

## How it works

One job runs six steps, and Claude is called exactly once.

1. **Capture.** A locked-down Playwright browser opens the URL at 1920×1080, clears cookie banners, waits for the app to finish drawing, and maps every button, link and section, with screenshots. It signs in only through a demo link the person gives; otherwise, behind a login wall, it stays on the public pages. A site that answers with a bot check gets a clear refusal rather than a trailer of the check.
2. **Script.** One call to Claude Opus 5.5 reads the screenshots, the page map and any director's notes, and returns a shot list sized to the running time as structured JSON: what to click, hover, type or scroll to, one line of narration per shot, a punch title for each, and a judgment on whether the page is fit for the public gallery. There is no agent loop. The plan is validated (unknown elements, external links, destructive clicks and typing into sensitive fields are dropped), and if Claude is unavailable or over budget, a planner with no AI writes the script from the page's own words.
3. **Voice.** Deepgram Aura-2 reads each line, and Deepgram nova-3 transcribes it back so every word gets a timestamp for the captions. The browser for the shoot is already opening the app meanwhile. If Deepgram is down, Kokoro, an open-source voice model running on the worker, reads the script instead; if that fails too, the trailer still ships, with captions and music.
4. **Shoot.** The browser replays the shot list and films it through the Chrome DevTools screencast, each shot exactly as long as its line. A click on something inside a closed menu opens the menu first. Every step has a timeout. A step that fails is cut from the edit, never faked, and if no planned shot works at all, Premiere reshoots a simpler tour of the page. Only one job films at a time, so two shoots never compete for the machine and drop frames.
5. **Sound.** A score synthesized in code to the plan's mood, with hits on the titles and ticks on the clicks, ducked under the narration and mastered with ffmpeg.
6. **Cut.** Remotion renders the trailer: a virtual camera that eases toward each click, a spotlight on the thing being used, a drawn cursor (headless browsers record none), captions in the chosen look, titles in your app's own color, an end card with your URL, and the two thumbnails. A vertical cut carries the footage as a card across the middle of the frame, with the app's name above it and the captions below.

## For AI agents

One HTTP request orders a trailer, over [x402](https://www.x402.org/):

```bash
curl -X POST "$PREMIERE/api/x402/trailers" \
  -H "content-type: application/json" \
  -d '{"url": "https://yourapp.xyz", "style": "hype"}'
```

`$PREMIERE` is the site's address. The body also takes `voice`, `captions`, `length`, `format`, `notes`, `demoUrl` and `gallery` (off unless sent as `true`). The reply is `202 { id, status, page }`. Poll `GET /api/jobs/:id` until `result.trailer` is set, then fetch the files from `/api/jobs/:id/files/`. Once payments are on, the first request returns `402` with a `PAYMENT-REQUIRED` header; the agent signs a USDC authorization on Base and repeats the request with `PAYMENT-SIGNATURE`. `GET /api/x402/trailers` describes the endpoint and the current price.

Coding agents can use the MCP server in [`mcp/`](mcp/README.md) instead: Claude Code, Claude Desktop or Cursor gets `make_trailer`, `trailer_status` and `premiere_options`, so "make a launch trailer of my app" is one sentence to the agent.

## Built with AI

- **Claude Code** built this repo, working from [`CLAUDE.md`](CLAUDE.md): the spec, the decisions and what each one was based on, kept up to date as the build went.
- **Claude Opus 5.5** writes every trailer's script at runtime, in one structured-output call at low effort, for about 4 cents. It was picked in a bake-off on five real apps: Haiku 5.5, Sonnet 5.5 and Opus 5.5 all produced usable plans, Opus was tightest on length and picked the best actions, and the no-AI planner was clearly worse than all three (`npm run bakeoff` reruns it).
- **Deepgram** Aura-2 and nova-3 for the narration and its word timings.
- The Claude API spend has two caps: a monthly limit on its own Console workspace, and a ledger in the app that switches to the no-AI planner before that limit is reached.

## Safety

The worker films any URL someone pastes, so every URL is treated as hostile. Only `http` and `https` are allowed. Every browser connection goes through a local egress proxy that resolves the host itself, refuses private, loopback, link-local and cloud metadata addresses, and connects to the exact IP it checked, which also covers redirects, iframes and DNS rebinding. There are no downloads or extra permissions, each job gets a fresh browser, and page loads, jobs and output sizes all have hard limits.

A finished trailer goes into the public gallery only if the person who ordered it allowed it and Claude judged the page fit for a public wall. Made an app and want its trailer taken down? Open an issue.

## Run it yourself

You need Node 22 or later.

```bash
npm install
npx playwright install chromium
cp .env.example .env
npm run dev
```

Then open http://localhost:3000. In `.env`, `DEEPGRAM_KEY` gives the trailers a narrator (without it they come out with captions and music only), and `PREMIERE_ANTHROPIC_API_KEY` lets Claude write the scripts (without it the no-AI planner does). `.env.example` explains every setting.

From the command line:

```bash
npm run trailer -- https://yourapp.xyz --style walkthrough --voice athena
npm run trailer -- https://yourapp.xyz --length 15 --format vertical --notes "Click Generate"
```

| Command | What it does |
| --- | --- |
| `npm run dev` | The worker (port 8787) and the website (port 3000) together |
| `npm run trailer -- <url>` | A whole trailer, the same way the website makes one |
| `npm run trailer -- --rerender <job> [--thumbnails]` | Renders a finished job again from its saved edit and footage |
| `npm run plan -- <url>` | Plans one trailer and prints the script |
| `npm run bakeoff` | Plans each app with every model and the no-AI planner, side by side |
| `npm run gallery` | Lists finished trailers and where each stands in the gallery |
| `npm test`, `npm run typecheck` | Unit tests and types |

## Layout

- `web/`: the site and its API, in Next.js 16. The browser only ever talks to the site, which talks to the worker server-side.
- `mcp/`: the MCP server that lets coding agents order trailers through the site's public API.
- `worker/`: the job server and the pipeline, in Node with Playwright, Remotion and ffmpeg. `capture/`, `planner/`, `voice/`, `record/`, `audio/` and `render/` are the six steps; `safety/` holds the URL checks and the egress proxy; `payments/` holds x402.

The worker needs a real machine (a small VPS will do), since it drives a browser and renders video. The live site runs the site and the worker together on one Google Cloud VM behind Caddy; `deploy/` holds the setup and release scripts.
