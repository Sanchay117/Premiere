import { z } from "zod";
import { countWords } from "../lib/text";
import type { TrailerLength, TrailerStyle } from "../options";

// The shot list Claude returns (structured output) and every other planner produces.
// Field descriptions are part of the JSON schema the model sees, so they double as instructions.

export const ShotSchema = z.object({
  action: z
    .enum(["click", "hover", "type", "scroll", "wait"])
    .describe("One visible action. Its narration plays while the result is on screen."),
  target: z
    .string()
    .nullable()
    .describe(
      "Element id like e12 for click, hover and type. Element or section id (e12, s3) for scroll, or null to scroll down most of a screen. Null for wait.",
    ),
  text: z
    .string()
    .nullable()
    .describe("For type only: a short, harmless example to type, at most 60 characters. Null for every other action."),
  narration: z.string().describe("Line spoken during this shot, about what is on screen. Length follows the style rules."),
  punch: z
    .string()
    .default("")
    .describe("On-screen title for this shot, 1 to 4 words, specific to what it shows, for example: Paste any link."),
});

export const PlanSchema = z.object({
  appName: z.string().describe("The app's name as the site presents it."),
  tagline: z.string().describe("Title card subtitle, at most 8 words."),
  mood: z.enum(["energetic", "calm", "playful", "bold"]).describe("Music mood that suits the app."),
  hook: z.string().describe("Opening line spoken over the title card. Length follows the style rules."),
  shots: z.array(ShotSchema).describe("Shots in story order, exactly as many as the style rules ask for."),
  close: z.string().describe("Closing line spoken over the end card, inviting the viewer to try the app. Length follows the style rules."),
  cta: z.string().describe("End card button text, at most 5 words, for example: Try it free."),
  publicSafe: z
    .boolean()
    .default(false)
    .describe(
      "True for an ordinary app or site that could hang in a public gallery. False if the page shows adult, hateful, violent or gory content, promotes something illegal, or looks like phishing or a scam.",
    ),
});

export type Shot = z.infer<typeof ShotSchema>;
export type Plan = z.infer<typeof PlanSchema>;
/** A plan before validation: punch titles may be missing (saved and fallback plans). */
export type PlanInput = z.input<typeof PlanSchema>;

/** Narration targets across hook, shot lines and close, by style and running time. Narration is
 *  read at about 2.5 words a second; a hype cut spends a second on each punch title and a beat
 *  after each line, so it says less. */
export const WORDS_TARGETS: Record<TrailerStyle, Record<TrailerLength, { min: number; max: number }>> = {
  walkthrough: { 45: { min: 100, max: 125 }, 30: { min: 60, max: 80 }, 15: { min: 26, max: 38 } },
  hype: { 45: { min: 55, max: 85 }, 30: { min: 36, max: 52 }, 15: { min: 16, max: 26 } },
};

export const wordsTarget = (style: TrailerStyle, length: TrailerLength = 45) => WORDS_TARGETS[style][length];

/** The full 45 second targets. */
export const WORDS_TARGET = { walkthrough: WORDS_TARGETS.walkthrough[45], hype: WORDS_TARGETS.hype[45] };

export function planWords(plan: Plan): number {
  return countWords([plan.hook, ...plan.shots.map((s) => s.narration), plan.close].join(" "));
}
