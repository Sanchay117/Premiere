// The choices an order can make, in the words the site's box office uses (web/src/lib/options.ts;
// the worker checks the same ids in worker/src/options.ts). The tool schemas and premiere_options
// both read these lists, so what an agent is offered and what it is told cannot drift apart.

export const STYLES = ["hype", "walkthrough"] as const;
export const VOICES = ["auto", "atlas", "zeus", "asteria", "thalia", "ophelia", "athena", "draco", "pandora"] as const;
export const CAPTIONS = ["karaoke", "boxed", "bold", "off"] as const;
export const LENGTHS = [15, 30, 45] as const;
export const FORMATS = ["landscape", "vertical"] as const;

export type Style = (typeof STYLES)[number];
export type Voice = (typeof VOICES)[number];
export type Caption = (typeof CAPTIONS)[number];
export type Length = (typeof LENGTHS)[number];
export type Format = (typeof FORMATS)[number];

export const DEFAULTS = { style: "hype", voice: "auto", captions: "karaoke", length: 45, format: "landscape" } as const;

/** The longest director's note the site accepts. */
export const NOTES_MAX = 280;

export const STYLE_NOTES: Record<Style, string> = {
  hype: "punch titles slam in, then the footage plays on a floating screen; fast and loud",
  walkthrough: "a calm, full-frame tour of the app, one feature at a time",
};

export const VOICE_NOTES: Record<Voice, string> = {
  auto: "picked to suit the app's mood",
  atlas: "warm, confident announcer",
  zeus: "deep and smooth",
  asteria: "clear, bright ad read",
  thalia: "upbeat and enthusiastic",
  ophelia: "cheerful and expressive",
  athena: "calm storyteller",
  draco: "British baritone",
  pandora: "smooth, calm British",
};

export const CAPTION_NOTES: Record<Caption, string> = {
  karaoke: "each word lights up as it is spoken",
  boxed: "classic subtitles on a dark band",
  bold: "two or three words at a time, huge",
  off: "no burned-in captions; captions.srt still comes with the trailer",
};

export const FORMAT_NOTES: Record<Format, string> = {
  landscape: "16:9, for YouTube, X, launch posts and raise pages",
  vertical: "9:16, for Reels, Shorts and TikTok",
};

/** "id (note), id (note)" for a schema description. */
export function listed(notes: Record<string, string>): string {
  return Object.entries(notes)
    .map(([id, note]) => `${id} (${note})`)
    .join(", ");
}

const bullets = (notes: Record<string, string>, fallback: string) =>
  Object.entries(notes).map(([id, note]) => `- ${id}${id === fallback ? " (default)" : ""}: ${note}`);

/** What premiere_options returns: every choice, what comes back, and what it costs. */
export function optionsText(): string {
  return [
    "Premiere films a web app in a real browser and returns a narrated launch trailer. Every choice below is optional.",
    "",
    "style, the cut:",
    ...bullets(STYLE_NOTES, DEFAULTS.style),
    "",
    "voice, the narrator:",
    ...bullets(VOICE_NOTES, DEFAULTS.voice),
    "",
    "captions, the burned-in look:",
    ...bullets(CAPTION_NOTES, DEFAULTS.captions),
    "",
    `length: ${LENGTHS.join(", ").replace(/, (?=\d+$)/, " or ")} seconds (default ${DEFAULTS.length}).`,
    "",
    "format:",
    ...bullets(FORMAT_NOTES, DEFAULTS.format),
    "",
    `notes: director's notes, up to ${NOTES_MAX} characters, saying what to show, click or type (for example "type a prompt into the generator, then click Generate"). Without them Premiere finds the main flow itself.`,
    "demo_url: a link that opens the app already signed in to a throwaway demo account, so the trailer can show what is behind the login. It is kept secret. Without it Premiere stays on public pages.",
    "gallery: whether the finished trailer may hang in Premiere's public gallery (off unless asked for).",
    "",
    "Every trailer comes with: trailer.mp4 (H.264 and AAC, captions burned in, sound mastered to -16 LUFS), thumbnail-1920.png, thumbnail-1280.png and captions.srt.",
    "",
    "Price: free until 16 Nov 2026, within daily limits. After that a trailer costs a few USDC on Base, paid over x402. This MCP server cannot pay: once trailers cost money, make_trailer says the exact price and how to order with an x402-capable client or on the website.",
  ].join("\n");
}
