// The demo video's narration. The opening trailer is read by a deep announcer voice and timed to
// the score's bars; the walkthrough is read by a calmer guide voice, one line per beat of the demo.

export const TRAILER_VOICE = "aura-2-zeus-en";
export const GUIDE_VOICE = "aura-2-pandora-en";

/** The opening trailer: each line starts at its second in the cut (the score runs at 120 bpm, so
 *  a bar is two seconds). */
export const TRAILER_LINES = [
  { key: "t-every", at: 4.3, text: "Every app needs a trailer." },
  { key: "t-skip", at: 8.3, text: "Most founders skip it. Or lose a day making one." },
  { key: "t-paste", at: 12.35, text: "Tonight, paste a link." },
  { key: "t-get", at: 14.3, text: "Get a trailer." },
  { key: "t-agent", at: 16.25, text: "An AI agent opens your app, writes the script, and films the real thing." },
  { key: "t-cut", at: 21.2, text: "Then cuts it, with a voice, captions and music." },
  { key: "t-any", at: 26.3, text: "Any app. About two minutes." },
  // Without punctuation: Aura-2 returned silence for the one-word line "Premiere."
  { key: "t-name", at: 30.45, text: "Premiere" },
] as const;

/** The walkthrough, in order. Each line plays over its own stretch of the screen recording (or
 *  its own motion graphic), which is sped up or held to fit the line. */
export const GUIDE_LINES = [
  { key: "home", text: "This is Premiere. The whole product is one ticket at the box office." },
  { key: "url", text: "Paste a link to any public app. Here's Fundable, Vibestarter's own scorer." },
  { key: "options", text: "Pick the cut, tune the radio to a narrator, and choose the captions, the running time and the screen." },
  { key: "roll", text: "Then roll camera." },
  { key: "capture", text: "A real browser opens the app, clears the cookie banners, and maps every button and section." },
  { key: "plan", text: "Claude Opus 5.5 writes the script in a single call: what to click, what to say, and a title for every shot." },
  { key: "film", text: "Deepgram reads each line, and the agent films every shot for exactly as long as its line runs." },
  { key: "cut", text: "Then it scores the music, mixes the sound, and cuts the trailer." },
  { key: "ready", text: "About two minutes after the order, it's ready: the trailer, two posters and word-timed subtitles." },
  { key: "recut", text: "Want another line, or another voice? Recut it. The new narration goes over the same footage in about thirty seconds." },
  { key: "formats", text: "There are fifteen and thirty second cuts too, and a vertical one for Reels, Shorts and TikTok." },
  { key: "agents", text: "And coding agents can order one themselves, with a single x402 request or the Premiere MCP server." },
  { key: "close", text: "Free until November sixteenth, then a few dollars in USDC on Base. Paste a URL. Get a launch trailer." },
] as const;

export type GuideKey = (typeof GUIDE_LINES)[number]["key"];
