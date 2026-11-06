# Premiere

**Paste a URL, get a launch trailer.** An AI agent opens your app, clicks through its main flow, writes a script, records real footage, and returns a 45-second narrated trailer with captions, music and thumbnails in a few minutes.

This is our entry for **Vibestarter Vibeathon 02: Night shift**. This repo will be public, so keep secrets, emails and private notes out of this file.

## Status

The build window closes **9 Nov 2026, 22:00 UTC (10 Nov, 03:30 IST)**. Aim to submit by 8 Nov.

As of 6 Nov: URL to trailer works end to end, locally, from the website and the command line, in about two minutes (a hype trailer of Exdiv: 2 min 27 s from the website with its job page open on the same laptop, plus about 15 s when the capture is not cached; it was 3 min 48 s before the speed work). The worker captures the app (Playwright, egress proxy), plans it (one Opus 5.5 call, no-AI fallback, plan cache, spend guard), voices it (Deepgram Aura-2 with word timings), films it, scores and masters the sound (-16 LUFS), and renders `trailer.mp4`, two thumbnails and `captions.srt` with Remotion. People choose the cut (hype or walkthrough), the narrator (eight Aura-2 voices or auto) and the caption look. Finished jobs persist, and trailers Claude clears go straight into the gallery. USDC payments over x402 are built and switched off: trailers are free for everyone until Vibeathon 02 ends, within daily limits. The site was rebuilt as drive-in ephemera. Not built yet: hosting (Vercel plus a VPS for the worker), the homepage sample trailer (ideally Premiere made by Premiere, once it has a public URL), the Kokoro fallback voice.

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

**Each order chooses:** the cut (`hype`: punch titles and footage on a floating screen; `walkthrough`: a calm tour), the narrator (`auto` or one of eight Aura-2 voices, sampled in `web/public/voices`), the caption look (`karaoke`, `boxed`, `bold`, `off`; the SRT always ships), and whether it may appear in the gallery. Defaults: hype, auto, karaoke. Claude Opus 5.5 writes every script; there is no model choice on the site.

**Who pays what:**
- **Everyone, Vibeathon entrants included:** free until Vibeathon 02 ends (judging and the holder vote close 16 Nov), within the daily limits. That keeps the application's promise that entrants get theirs free. Entrant codes still exist as an emergency lever (`ACCESS_CODES`); the form asks for one only if the worker says so.
- **After the Vibeathon:** a few USDC per trailer (`PRICE_USDC`, default 3) on Base, paid from the visitor's wallet over x402. Turn on with `PAYMENTS=mainnet` (or `testnet` for Base Sepolia) and check with `npm run payments`. Receiving address: `PAYMENT_ADDRESS` in `.env`.
- **AI agents:** one x402 request, `POST /api/x402/trailers`, returns a job id (free during the Vibeathon). Default x402 clients refuse payments over $1 unless the agent raises its cap, so consider pricing agent orders at $1 or saying so in the docs.

**Landing page:** a pre-made sample trailer plays above the fold, so a judge sees the output within 2 seconds (still the made-up Nightjar teaser; swap in Premiere's own trailer once deployed). Below it, the gallery of trailers made for other apps, with their makers' permission.

## Architecture

```
web (site + API)  ->  job queue  ->  worker  ->  storage  ->  web shows the result
```

- **Web:** Next.js on Vercel. Landing page, job form, job status page, payment and x402 routes. Built in `web/` (Next.js 16, Tailwind v4, Motion, Lenis). Its `/api/jobs` routes proxy to the worker server-side (`WORKER_URL`, `WORKER_TOKEN`), so the browser never talks to the worker.
- **Queue and storage:** for now the worker runs its own HTTP job server (`worker/src/server`) with an in-memory queue (one job at a time) and serves files from disk. Each job that ends is saved as `job.json` in its folder, so its page and gallery entry survive restarts. That is the simplest thing that works locally; before judging week decide whether it stays (worker on the VPS behind HTTPS with `WORKER_TOKEN`) or moves to a hosted database and object storage, and note the choice here.
- **Gallery:** `worker/src/server/gallery.ts`. A finished trailer goes up by itself when its maker ticked the box and Claude, in the same planning call, judged the page fit for a public wall (`publicSafe` in the plan: false for adult, hateful, violent or gory content, illegal goods, phishing or scams). Fallback plans and older jobs have no such judgment, so they are held until `npm run gallery -- approve <id>`; `npm run gallery -- remove <id>` takes any trailer down for good. Only the newest listed trailer of each app (host plus path) hangs, and the list refreshes as soon as a job finishes. This matters because the worker films any URL someone pastes.
- **Payments:** `worker/src/payments` (x402 v2 through `@x402/core` and `@x402/evm`). The worker verifies and settles through a facilitator (x402.org for Base Sepolia, PayAI for Base) before a paid job starts, and never holds a key. The site's checkout (`web/src/lib/checkout.ts`) signs in the visitor's wallet and loads only when payments are on.
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
| `npm run trailer -- <url> [--planner opus\|sonnet\|haiku\|none] [--style hype\|walkthrough] [--voice <name>] [--captions <look>]` | A whole trailer from the command line, the same way a job makes one (Opus unless told otherwise; the other models stay for testing) |
| `npm run trailer -- --rerender <job> [--captions <look>]` | Renders a finished job again from its `edit.json` and footage (no new voice or filming), for iterating on the look |
| `npm run gallery [-- approve <id> \| remove <id>]` | Lists finished jobs with where each stands (in the gallery, held, removed, opted out); puts a held one up or takes any down |
| `npm run -w worker payments` | Whether trailers are free or paid with the current `.env`, and the 402 a client would see |
| `npm run -w worker voice-samples` | Records the narrator samples the picker plays (`web/public/voices`) |
| `npm run capture -- <url>` | Fresh capture; prints elements, sections and screenshot paths |
| `npm run plan -- <url> [--planner claude\|mock\|fallback] [--model haiku\|sonnet\|opus] [--fresh] [--save-mock]` | Plans one trailer the way a job would and prints the script |
| `npm run bakeoff -- [urls] [--models haiku,sonnet,opus] [--effort low] [--save-mock <model>]` | Plans each app with every model plus the fallback; writes a side-by-side report |
| `npm run spend` | This month's API spend against the app-side budget |
| `npm test`, `npm run typecheck` | Unit tests (includes a real browser check that redirects to private addresses are blocked) and types |

### The pipeline (one job)

1. **Capture (no AI).** Playwright opens the URL at 1920×1080 and collects the title, meta description, headings, every clickable element (with a stable id), and 3 or 4 screenshots downscaled to about 1024 px wide. Dismiss cookie banners. If the app is behind a login, stay on the public pages. Many apps boot, sit quiet, then fetch and draw their real content several seconds in (Exdiv's market cards land at 6.5 s), so the page gets at least 7 s from navigation and then one quiet second (`waitForContent`, shared with the recorder) before it is mapped. Pages that keep their main thread busy make every Playwright round trip wait its turn, so the cookie sweep (`inpage/find-consent.js`), the scroll-through and the stability check are each one in-page call, and screenshots come straight from DevTools (`Page.captureScreenshot`) rather than Playwright's screenshot, which makes several round trips first.
2. **Plan (one AI call).** Claude returns a JSON shot list: ordered actions (click, scroll, type, hover, wait) that target element ids, with one narration line and one punch title (1 to 4 words) per shot, a title card, a closing call to action and the gallery judgment, written for the chosen cut: about 70 words in 5 or 6 shots for hype, 110 in 5 to 7 for walkthrough. Validate the output against the schema; if it fails, use the fallback planner.
3. **Voice** (runs before recording, so each shot is filmed for exactly as long as its line). Meanwhile the recorder's browser opens the app (`openStage`), so its launch, page load and the app's own boot are off the clock. Deepgram Aura-2, one request per line, five lines at a time (the pay-as-you-go limit is 15 concurrent Aura-2 requests per project; 429s and 5xx are retried with backoff), in the narrator the person picked (`worker/src/options.ts` lists the eight), or with `auto` one that suits the plan's mood (Atlas for energetic and bold, Asteria for playful, Athena for calm). Aura returns no timestamps, so each line is transcribed with Deepgram `nova-3` and the words are aligned back onto the script (`voice/deepgram.ts`, `alignWords`). Key: `DEEPGRAM_KEY` in `.env`. Fallback still to build: Kokoro, an open-source voice model that runs on the worker.
4. **Record (no AI).** `record/recorder.ts` replays the shot list in the hardened browser. Frames come from the Chrome DevTools screencast (JPEG, timestamped); the screencast sends nothing while a page is static, so a real screenshot is taken as a keyframe at the start of every shot. Each shot: setup off camera (find the element again, scroll it into view), a 0.7 s lead-in, the action, then a hold for the narration. A scroll to a section parks its heading about a fifth of the way down the screen, clear of sticky headers (parking it at the very top put the spotlight on Exdiv's nav bar). Clicks fall back to a real mouse event at the element's center when Playwright's actionability checks refuse an overlaid element. A failed step is skipped in the edit, never faked; the recording has a hard time cap.
5. **Music and sound.** `audio/music.ts` synthesizes the score per mood (tempo, chords, drums), plus a whoosh on the title, ticks on clicks, and a riser and impact into the end card. A hype cut runs the groove at 124 bpm or more, drops it out under each punch title and lands a swell and an impact on every title. `audio/mix.ts` ducks it under the narration; ffmpeg `loudnorm` (two pass) masters the soundtrack to -16 LUFS before rendering.
6. **Render.** `render/timeline.ts` times the edit from the voice. A hype cut adds a 1 s punch title before each shot and a 0.4 s beat after each line; `pacing()` trims both evenly (down to 0.75 s of punch and a 0.2 s pause after each line) when the cut would pass 46 s, and the recorder films to the same pacing. Remotion (`render/remotion/`) renders the title card, each filmed shot with a virtual camera that eases toward the target, an amber spotlight on the thing being clicked, hovered or typed into (never on a scroll, and only when the target sits wholly in frame and is smaller than most of the screen), a drawn cursor and click ripple (headless Chrome records no pointer), word-timed captions in the chosen look, and the end card with the app's URL and "Made with Premiere". Hype: the app name slams in (League Gothic), each punch title rises on a dark screen, and the footage plays inside a browser window that flies in tilted and settles. Walkthrough: the serif title card, full-frame shots with a quiet chapter label. A `<Still>` renders both thumbnails. Output: `trailer.mp4` (H.264 CRF 18, x264 `veryfast`, AAC 192k), `thumbnail-1920.png`, `thumbnail-1280.png`, `captions.srt`, plus `edit.json`. Speed (benchmarked 6 Nov on the 16-thread dev laptop): one Chrome tops out around 25 to 30 frames a second whatever the concurrency (4, 8, 12 and 16 all landed there), the GPU backend (`gl: "angle"`) gains only 10% and software `swangle` is 7x slower, and the hype look costs at most 20% over a plain walkthrough. So the render shares one browser for the video and both thumbnails (rendered alongside the video), uses `veryfast` (10% quicker, slightly smaller files), and the worker bundles the compositions when it boots. Two Chrome instances in parallel reach about 36 fps together, so chunked rendering would only pay on a machine with many cores. Frames rendered scale with trailer length, which is one more reason to hold cuts near 45 s. Remotion reuses Playwright's Chrome Headless Shell, and its compositor package ships the ffmpeg the worker uses, so there is no separate ffmpeg install. Remotion is free for individuals and companies of up to three people; check the license before Premiere grows past that.

### Planner rules (Claude API)

- Model: **`claude-opus-5-5` at `effort: "low"`** for every trailer (override with `PLANNER_MODEL` on the worker; the site offers no choice). Read the claude-api skill before changing this code.
- Why Opus (bake-off on 6 Nov, 5 apps, one run each, $0.23 total): every model produced usable plans. Opus 5.5 was tightest on length and picked slightly better actions, at about twice Sonnet's cost; we chose it after first defaulting to Sonnet. Sonnet 5.5 wrote vivid, screenshot-grounded scripts at about $0.015 and 5 s per plan. Haiku 5.5 was $0.001 per plan but overshot the word target on 3 of 5 apps and chose weaker actions (it clicked "Log in"). The no-AI fallback was clearly worse than all three. Rerun with `npm run bakeoff` after prompt changes.
- Server-side refusal fallback is on for Sonnet and Opus (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`): a cyber or frontier_llm refusal is retried on Sonnet 5 inside the same call. Cost is summed over `usage.iterations`, since top-level `usage` only covers the attempt that answered. If the whole chain refuses, the no-AI fallback planner takes over.
- Structured output via `output_config.format` with `PLAN_JSON_SCHEMA` (built from the zod schema). Do not switch to the SDK's `zodOutputFormat` helper: it turns `enum` into a description hint.
- Exactly **one** planning call per trailer. Never a screenshot-act-screenshot agent loop.
- Check `stop_reason`. On `refusal`, `max_tokens` or invalid JSON, use the fallback planner.
- Plans are cached per normalized URL, model and style, tied to the capture they were made from (element ids only hold for that capture), so re-rendering the same app costs nothing.
- Prompt version 5 has a style section: walkthrough asks for 5 to 7 shots, lines of 8 to 15 words and at most 125 words; hype asks for 5 or 6 shots, lines of 5 to 10 words, about 70 words and at most 85, because every shot costs a punch title (a 7-shot, 76-word hype plan read by Thalia ran 53.8 s under version 4). It also asks for `publicSafe`, the gallery judgment. Every shot gets a punch title; plans without one (fallback, older saved plans) get one from the page in `validatePlan`. The JSON schema strips `default` so the model always writes the field. Version 2 let Sonnet run to about 137 words (a 55 second trailer). Bump `PROMPT_VERSION` whenever the prompt or schema changes.
- `PLANNER=mock` returns saved example plans. Use it for all work on recording, voice and rendering.
- Every plan, from any planner, goes through `validatePlan`: unknown ids, external, mailto and destructive clicks, and typing into sensitive fields are dropped; em dashes are cleaned out of the copy.
- **Fallback planner (no AI):** hold on the hero, hover the primary call to action, scroll to the strongest sections (or hover the controls of a single-screen app), then click in, with a script built only from the page's own prose (description, headings, visible text). The app must keep working at $0 if the API is unavailable or the budget is hit.

### API budget

The Claude API credit is shared with another project, so Premiere must use as little as possible.

- Premiere has its own Console workspace with a small monthly spend limit, and its own API key. That limit is the hard cap.
- The key lives only in `.env` (gitignored) as `PREMIERE_ANTHROPIC_API_KEY`. It is deliberately not named `ANTHROPIC_API_KEY`, and the client is only built with that key passed explicitly, so it never picks up other credentials on the machine. Never export any API key in the shell: Claude Code would then bill the API key instead of the subscription.
- App-side budget: `PLANNER_MONTHLY_BUDGET_USD` (default $5, keep it at or below the Console limit). At about $0.04 per Opus plan, $5 covers roughly 120 trailers a month; raise both limits before judging week if traffic needs it. Each call's cost is computed from `usage` and recorded in a ledger; once the budget is reached, the planner switches to the fallback. The ledger is a local file for now and moves to the job database when the worker goes to the VPS.
- Free trailers have a per-visitor daily limit (3) and a global daily cap, and access codes can gate them as an emergency lever (`worker/src/server/access.ts`, set with `ACCESS_CODES`, `ACCESS_PER_VISITOR_DAILY` and `ACCESS_DAILY_CAP`; the form calls them access codes). The web app sends a hash of the visitor's IP; the worker stores only an HMAC of that, keyed with a random secret it creates in `.data/access-secret`, with the day's counts in `.data/access.json`. A plain hash would not do: anyone could hash every IPv4 address and reverse it. Admission is counted when a job starts, so a failed job still uses one of the visitor's free trailers. With no codes set, access is open but the limits still apply.

### Safety

The worker opens arbitrary URLs, so treat every submitted URL as hostile:
- Allow only `http` and `https`. Resolve the hostname and refuse private, loopback, link-local and cloud-metadata addresses, including after redirects.
- How: the URL is checked before launch, then every browser connection goes through a local egress proxy (`safety/egress-proxy.ts`) that resolves the host itself, refuses non-public addresses and connects to the exact IP it checked. This covers redirects, subresources, iframes and DNS rebinding. Playwright's `route()` is not enough on its own: redirect hops skip it.
- No downloads, no file access, no extra permissions. Fresh browser context per job.
- Hard limits on page load time, total job time and output size.

## Website design: the night-shift drive-in

The site is a drive-in theater for apps, open all night (the Vibeathon theme). Keep new pages inside this world rather than adding generic SaaS sections. Every element should be a real object from a drive-in (a sign, a ticket, a handbill, a slide, a can, a board), not a themed card. The first version read as AI slop because every section repeated one formula: a tiny mono label, a serif headline with one italic amber word, and a grid of rounded glowing cards. Do not bring that back.

- **Hero:** a starry sky (no moon here; it sits behind the sign), a full-width roadside marquee whose crooked black changeable letters carry the headline and whose bottom row spells the typed app name, the box office ticket (the order form) on the left, the big screen on posts playing the Nightjar teaser on the right with an honest caption that it is a sample, and the lot: 1950s cars as silhouettes rimmed with screen light. Mouse parallax moves stars, hills and cars by different amounts.
- **The ticket** (`components/hero/UrlForm.tsx`, `pickers.tsx`): ADMIT ONE on paper stock with a perforated edge and a red serial. Tick boxes for the cut, a car radio for the narrator (drive-ins played the soundtrack over FM; each voice is a station with a sample to hear), little frames for the caption looks, and the gallery opt-in. The site never says "Vibeathon": it reads as a product, free until 16 Nov and then a few USDC (only code comments and these notes mention the event).
- **Sections, as the night's program:** Tonight's program (a printed handbill of five reels timed to the second like a running order, 2:00:00 to 2:01:16 a.m. and ready before 2:03, from a real job; a clock's red second hand sweeps as you scroll; keep the times honest if the pipeline speeds up or slows down), Previously on the big screen (the gallery as lobby cards), Intermission (a projected teal slide: why it is called a trailer, ads spliced onto the end of the reel in 1913; say "one of the earliest", not "the first"), Four cans go home with you (steel film cans with masking-tape labels in marker), Box office (a felt letter board, plus a typed card for agents with the x402 request), Last show, then rolling end credits.
- **Screening room** (`/jobs/[id]`): the same sky, a film-strip progress view of the five steps, the trailer with download tickets, then the storyboard and the script. The gallery page is `/gallery`.
- **Type:** League Gothic (the condensed poster gothic on old movie posters and marquees) for headlines, prices and signs, set in capitals; Yellowtail (a sign painter's script) for the neon wordmark and a few lit signs; Libre Franklin (a Franklin Gothic revival) for reading; Courier Prime for anything typed (labels, times, the screenplay); Permanent Marker only for labels written on tape. No italics as decoration.
- **Look:** night ink `#07080c`, cream `#f3ead8`, incandescent amber `#ffb547`, ticket red `#c8372d`, paper `#efe3c6` with dark ink `#241a10`, slide teal `#0f4a4f`, and element-label pink `#e11d74` for the storyboard only. Hero entrances are CSS (`.rise`), so the page reads before it hydrates, and they wait for the film leader. Every animation has a `prefers-reduced-motion` fallback.
- **Grain stays behind text.** A static grain is baked into the page and sky backgrounds. Never put an overlay (grain, noise, vignette) above the content: an animated grain layer on top made all text look blurry, especially on scaled Windows displays.

## Priorities

**Never cut:** URL to trailer working end to end, the live URL, the sample trailer on the home page, free trailers for entrants (now free for everyone until the Vibeathon ends), USDC payment (built, switched off until then), the x402 endpoint (all are in the application text).

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
