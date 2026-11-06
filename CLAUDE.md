# Premiere

**Paste a URL, get a launch trailer.** An AI agent opens your app, clicks through its main flow, writes a script, records real footage, and returns a 45-second narrated trailer with captions, music and thumbnails in a few minutes.

This is our entry for **Vibestarter Vibeathon 02: Night shift**. This repo will be public, so keep secrets, emails and private notes out of this file.

## Status

The build window closes **9 Nov 2026, 22:00 UTC (10 Nov, 03:30 IST)**. Aim to submit by 8 Nov.

As of 6 Nov: the worker has capture (Playwright, labelled screenshots, egress proxy), the planner (one Claude call, no-AI fallback, mock plans, plan cache, spend guard), a model bake-off harness and an HTTP job server. The bake-off picked **Sonnet 5.5** as the planner model. The website runs locally: the drive-in landing page and the screening room, where a job shows live progress and a storyboard preview built from the screenshots and the plan, with a planner picker for testing. Not built yet: record, voice, music, render (so no trailer.mp4 yet), entrant codes, payments, hosting.

## The hackathon

| | |
| --- | --- |
| Organizer | Vibestarter: time-released crowdfunding for vibecoded apps on Base and Robinhood Chain |
| Event page | https://app.vibestarter.xyz/vibeathon |
| Rules | https://blog.vibestarter.xyz/vibeathon-02 |
| Community | Discord https://discord.gg/Kfpj89bu82 · X https://x.com/vibestarterxyz |
| Field | 131 builders entered (organizer's figure); expect far fewer finished builds |

**Timeline (every deadline is 22:00 UTC):** build 2 to 9 Nov, judging and holder vote 9 to 16 Nov, results from 16 Nov. Submissions stay editable until the build window closes.

**Requirement:** a working MVP that people can actually use, with a live URL, submitted before the window closes. "Build something you intend to launch."

**Prizes:** $500 / $250 / $125 / $75 / $50 for places 1 to 5, plus Starter Card points for places 1 to 10. Strong entries may be invited to raise on Vibestarter; if invited, we commit to launching there.

**Rubric** (an entry's score is the average of every judge's scorecard):

| Criterion | Weight | What it means for Premiere |
| --- | --- | --- |
| Execution | 30% | A judge pastes a URL and gets a trailer, end to end, on the first try |
| Launch potential | 25% | "Would people back it?" Clear demand, clear price, low unit cost |
| Originality | 20% | Real footage of the real app, made by an agent, not stock video |
| Craft and UX | 15% | The site and the trailers both have to look great |
| Vibecoding leverage | 10% | How well AI tools were used to build it |

**Holder vote:** $VIBES holders count as one extra judge. Each holder picks one entry; the most-voted gets 100, others score in proportion, no votes gets 10. Entrants cannot vote for their own entry.

**Fundable:** Vibestarter's scorer for how fundable a vibecoded app is. Attach its result link when submitting; judges see it next to the entry.

**Sponsored seat:** we were granted a Claude Team seat in Vibestarter's workspace. It may only be used for this project, and it can be revoked if we don't submit.

**Provenance:** Vibestarter checks that the build is genuinely ours. All code commits must fall inside the build window (2 to 9 Nov), and the commit history should show steady, real work.

## What we promised in the application

> Premiere turns any app URL into a launch trailer. Paste a link and an AI agent opens the app, clicks through its main flow, writes a script, records real footage, and returns a 45-second narrated trailer with captions, music and thumbnails in a few minutes. Every vibecoded app needs a demo video for its launch post, its hackathon entry and its Vibestarter raise page, and most founders either skip it or lose a day making one. Trailers are paid per video in USDC on Base, and AI agents can order one with a single x402 request. Vibeathon 02 entrants get theirs free, so Premiere is proven on real apps before judging starts.

Every claim in that text has to be true at submission: real footage, 45 seconds, narration, captions, music, thumbnails, USDC on Base, x402, free for entrants.

## Product

**User flow:** paste a URL, watch live progress (opening the app, planning, recording, narrating, rendering), then download or share the trailer.

**Each trailer delivers:**
- `trailer.mp4`: 1920×1080, about 45 seconds, H.264/AAC, captions burned in, loudness normalized to -16 LUFS
- `thumbnail-1920.png` and `thumbnail-1280.png`
- `captions.srt`

**Who pays what:**
- **Vibeathon 02 entrants:** free, unlocked with an entrant code we hand out in the Vibestarter Discord.
- **Everyone else:** a few USDC per trailer on Base. Set the price once the unit cost is measured.
- **AI agents:** one x402 request (HTTP 402 payment in USDC on Base) returns a job id, then the trailer.

**Landing page:** a pre-made sample trailer plays above the fold, so a judge sees the output within 2 seconds. Below it, a gallery of trailers made for other Vibeathon entries (with their permission).

## Architecture

```
web (site + API)  ->  job queue  ->  worker  ->  storage  ->  web shows the result
```

- **Web:** Next.js on Vercel. Landing page, job form, job status page, payment and x402 routes. Built in `web/` (Next.js 16, Tailwind v4, Motion, Lenis). Its `/api/jobs` routes proxy to the worker server-side (`WORKER_URL`, `WORKER_TOKEN`), so the browser never talks to the worker.
- **Queue and storage:** for now the worker runs its own HTTP job server (`worker/src/server`) with an in-memory queue (one job at a time) and serves screenshots from disk. That is the simplest thing that works locally; before judging week decide whether it stays (worker on the VPS behind HTTPS with `WORKER_TOKEN`) or moves to a hosted database and object storage, and note the choice here.
- **Worker:** a Node process with Playwright, Remotion and ffmpeg. It cannot run on Vercel. Run it on the dev machine during development and on a small VPS for judging week (9 to 16 Nov), so it doesn't depend on a laptop staying awake.

### Repo layout and commands

npm workspaces, Node 22 or later (developed on Node 26). Root scripts forward to the worker.

- `worker/src/capture`: Playwright capture. In-page scripts live in `capture/inpage/*.js` as plain JS, sent to the page as text (the TypeScript loader would otherwise inject helpers that do not exist in the page).
- `worker/src/planner`: schema, prompt, Claude call, fallback, validation, plan cache, mock plans, pricing and spend ledger.
- `worker/src/safety`: URL checks, egress proxy, hardened browser launch. Reuse `launchSafeBrowser` for every browser that opens a submitted URL, including the recorder.
- `worker/.data` (gitignored): captures, plan cache, spend ledger, bake-off reports. `worker/fixtures/plans` (committed): mock plans.

| Command | What it does |
| --- | --- |
| `npm run dev` | Worker job server (port 8787) and the website (port 3000) together |
| `npm run capture -- <url>` | Fresh capture; prints elements, sections and screenshot paths |
| `npm run plan -- <url> [--planner claude\|mock\|fallback] [--model haiku\|sonnet\|opus] [--fresh] [--save-mock]` | Plans one trailer the way a job would and prints the script |
| `npm run bakeoff -- [urls] [--models haiku,sonnet,opus] [--effort low] [--save-mock <model>]` | Plans each app with every model plus the fallback; writes a side-by-side report |
| `npm run spend` | This month's API spend against the app-side budget |
| `npm test`, `npm run typecheck` | Unit tests (includes a real browser check that redirects to private addresses are blocked) and types |

### The pipeline (one job)

1. **Capture (no AI).** Playwright opens the URL at 1920×1080 and collects the title, meta description, headings, every clickable element (with a stable id), and 3 or 4 screenshots downscaled to about 1024 px wide. Dismiss cookie banners. If the app is behind a login, stay on the public pages.
2. **Plan (one AI call).** Claude returns a JSON shot list: ordered actions (click, scroll, type, hover, wait) that target element ids, with one narration line per shot, a title card and a closing call to action. About 110 words of narration for 45 seconds. Validate the output against the schema; if it fails, use the fallback planner.
3. **Record (no AI).** Playwright replays the shot list while recording. Each step has a timeout, a failed step is skipped, and the whole recording has a hard time cap.
4. **Voice.** Deepgram Aura-2 for narration, with word timestamps for captions (key: `DEEPGRAM_KEY` in `.env`). Fallback: Kokoro, an open-source voice model that runs on the worker.
5. **Music and sound.** Synthesized from code, so nothing needs a license.
6. **Render.** Remotion composition: title card, footage clips with gentle zoom toward each clicked element, captions timed to the words, end card with the app's URL and "Made with Premiere". A `<Still>` composition renders the thumbnails. Then master the loudness.

### Planner rules (Claude API)

- Model: **`claude-sonnet-5-5` at `effort: "low"`** (override with `PLANNER_MODEL`). Read the claude-api skill before changing this code.
- Why Sonnet (bake-off on 6 Nov, 5 apps, one run each, $0.23 total): every model produced usable plans. Sonnet 5.5 wrote the most vivid, screenshot-grounded scripts at about $0.015 and 5s per plan. Opus 5.5 was tightest on length and picked slightly better actions, at twice the cost. Haiku 5.5 was $0.001 per plan but overshot the word target on 3 of 5 apps and chose weaker actions (it clicked "Log in"). The no-AI fallback was clearly worse than all three. Rerun with `npm run bakeoff` after prompt changes.
- Server-side refusal fallback is on for Sonnet and Opus (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`): a cyber or frontier_llm refusal is retried on Sonnet 5 inside the same call. Cost is summed over `usage.iterations`, since top-level `usage` only covers the attempt that answered. If the whole chain refuses, the no-AI fallback planner takes over.
- Structured output via `output_config.format` with `PLAN_JSON_SCHEMA` (built from the zod schema). Do not switch to the SDK's `zodOutputFormat` helper: it turns `enum` into a description hint.
- Exactly **one** planning call per trailer. Never a screenshot-act-screenshot agent loop.
- Check `stop_reason`. On `refusal`, `max_tokens` or invalid JSON, use the fallback planner.
- Plans are cached per normalized URL and model, tied to the capture they were made from (element ids only hold for that capture), so re-rendering the same app costs nothing.
- Prompt version 3 asks for 5 to 7 shots, shot lines of 8 to 15 words and no more than 125 words in total; version 2 let Sonnet run to about 137 words (a 55 second trailer). Bump `PROMPT_VERSION` whenever the prompt or schema changes.
- `PLANNER=mock` returns saved example plans. Use it for all work on recording, voice and rendering.
- Every plan, from any planner, goes through `validatePlan`: unknown ids, external, mailto and destructive clicks, and typing into sensitive fields are dropped; em dashes are cleaned out of the copy.
- **Fallback planner (no AI):** hold on the hero, hover the primary call to action, scroll to the strongest sections (or hover the controls of a single-screen app), then click in, with a script built only from the page's own prose (description, headings, visible text). The app must keep working at $0 if the API is unavailable or the budget is hit.

### API budget

The Claude API credit is shared with another project, so Premiere must use as little as possible.

- Premiere has its own Console workspace with a small monthly spend limit, and its own API key. That limit is the hard cap.
- The key lives only in `.env` (gitignored) as `PREMIERE_ANTHROPIC_API_KEY`. It is deliberately not named `ANTHROPIC_API_KEY`, and the client is only built with that key passed explicitly, so it never picks up other credentials on the machine. Never export any API key in the shell: Claude Code would then bill the API key instead of the subscription.
- App-side budget: `PLANNER_MONTHLY_BUDGET_USD` (default $5, keep it at or below the Console limit). At about $0.015 per Sonnet plan, $5 covers roughly 300 trailers a month; raise both limits before judging week if traffic needs it. Each call's cost is computed from `usage` and recorded in a ledger; once the budget is reached, the planner switches to the fallback. The ledger is a local file for now and moves to the job database when the worker goes to the VPS.
- Free trailers are gated by entrant code, with a per-visitor limit and a global daily cap.

### Safety

The worker opens arbitrary URLs, so treat every submitted URL as hostile:
- Allow only `http` and `https`. Resolve the hostname and refuse private, loopback, link-local and cloud-metadata addresses, including after redirects.
- How: the URL is checked before launch, then every browser connection goes through a local egress proxy (`safety/egress-proxy.ts`) that resolves the host itself, refuses non-public addresses and connects to the exact IP it checked. This covers redirects, subresources, iframes and DNS rebinding. Playwright's `route()` is not enough on its own: redirect hops skip it.
- No downloads, no file access, no extra permissions. Fresh browser context per job.
- Hard limits on page load time, total job time and output size.

## Website design: the night-shift drive-in

The site is a drive-in theater for apps, open all night (the Vibeathon theme). Keep new pages inside this world rather than adding generic SaaS sections.

- **Hero:** the headline in a starry sky (seeded star field, crescent moon, the odd shooting star), the box office form and ticket-stub planner picker on the left, the big screen on posts playing the teaser reel (a made-up app called Nightjar) on the right, a bulb-lit marquee that spells the typed app name on letter tiles, and a lot of 1950s cars seen from behind with the projector beam over them. Mouse parallax moves stars, hills and cars by different amounts.
- **Sections, as the night's program:** Tonight's program (five reels from 2:00 to 2:05 a.m., with a clock that ticks as you scroll), Intermission (why it is called a trailer: ads spliced onto the end of the reel in 1913; say "one of the earliest", not "the first"), Take-home reels (the four files as film cans), Box office (entrants, founders, agents), Last show of the night, then rolling end credits.
- **Screening room** (`/jobs/[id]`): the same sky, a film-strip progress view of the five steps, then the storyboard preview player and the script. Steps that are not built yet show "Soon".
- **Look:** night ink `#07080c`, cream text `#f3ead8`, projector amber `#ffb547`, element-label pink `#e11d74`. Instrument Serif for display, Geist for text, Geist Mono for labels and timecodes, Bebas Neue for marquee tiles. Film grain over everything. Every animation has a `prefers-reduced-motion` fallback.

## Priorities

**Never cut:** URL to trailer working end to end, the live URL, the sample trailer on the home page, free entrant codes, USDC payment, the x402 endpoint (all are in the application text).

**Cut first if time runs short:** extra trailer styles, vertical format, accounts and history, fancy wallet UI.

**What wins judges:**
- The first paste works. Handle cookie banners, login walls, slow sites and timeouts gracefully, and always return something watchable.
- Make trailers for other entrants' apps early and show them in the gallery.
- The submission's demo video is a trailer of Premiere, made by Premiere.
- Post finished trailers on X tagging @vibestarterxyz and the builders; share in the Discord.
- Submit a day early with the Fundable result attached.

## Schedule

| Day | Goal |
| --- | --- |
| 5 Nov | Scaffold the repo; capture plus mock planner; record footage of one site locally |
| 6 Nov | Real planner on Sonnet 5.5 (picked by the bake-off); voice; Remotion render; first full trailer locally |
| 7 Nov | Web app, job queue, worker on the VPS; entrant codes; live URL up |
| 8 Nov | USDC payment and x402; gallery of entrant trailers; hardening; submit |
| 9 Nov | Demo video, README, Fundable, final checks; window closes 22:00 UTC |

## Conventions

- **No em dashes** anywhere in the project: UI text, docs, code comments, captions, narration scripts, commit messages. Use commas, colons, periods or parentheses. En dashes in number ranges are fine.
- **No Claude co-author lines** or other self-attribution in commits or pull requests.
- **Every video gets thumbnails** at 1920×1080 and 1280×720, including our own demo video.
- Secrets only in `.env`, never committed. Keep a `.env.example` with empty values.
- Commit small and often during the build window; the history is part of how the entry is judged.
