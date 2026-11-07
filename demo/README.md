# The demo video

Premiere's submission video, built in code: a motion graphics trailer, then a narrated walkthrough of the real site. Everything in it is made here. The narration is Deepgram Aura-2 (Asteria for the trailer, Pandora for the walkthrough). The score and sound design are synthesized in `src/score.ts`, so nothing needs a license. The footage is a Playwright recording of an actual order and recut on the running site.

## Rebuild it

With `npm run dev` running and `DEEPGRAM_KEY` in the repo's `.env`:

```bash
npx tsx demo/src/voice.ts            # narration, word timings (or: voice.ts <key> to redo one line)
npx tsx demo/src/record.ts           # drives the site through an order of Fundable and a recut
npx tsx demo/src/build.ts            # the edit (demo/.out/props.json) and the mastered soundtrack
npx tsx demo/src/render.ts --video final
npx tsx demo/src/render.ts --poster  # thumbnail-1920.png and thumbnail-1280.png
```

For review: `render.ts --stills 5,20,40` renders frames at those seconds, `sheet.ts` lays them out as one contact sheet, and `analyze.ts` measures how far the voice sits above the music in every line.

## How it fits together

- `src/script.ts`: every line of narration, with the trailer's lines placed on the score's bars (120 bpm, a bar is two seconds).
- `src/record.ts`: the screen recording, from the DevTools screencast, with every pointer move, click and on-screen box logged so the edit can draw the cursor and aim the camera.
- `src/build.ts`: maps each walkthrough line onto its stretch of the recording (long waits become time-lapses), sets the camera moves, chapters and the finished trailers that play over the page's player.
- `src/score.ts` and `src/dsp.ts`: a synthwave score and trailer sound design (leader beeps, risers, braams, impacts, a neon hum), voice levelling, multiband ducking under speech, a look-ahead limiter, then loudness to -16 LUFS.
- `remotion/`: the compositions. `Intro.tsx` is the 34 second trailer, `Demo.tsx` the walkthrough stage, `Graphics.tsx` the closing beats and the poster, `art.tsx` the drive-in drawn after the website's own art.

Output goes to `demo/.out` (gitignored).
