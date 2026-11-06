import { z } from "zod";
import { countWords } from "../lib/text";

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
  narration: z.string().describe("Line spoken during this shot, 8 to 15 words, about what is on screen."),
});

export const PlanSchema = z.object({
  appName: z.string().describe("The app's name as the site presents it."),
  tagline: z.string().describe("Title card subtitle, at most 8 words."),
  mood: z.enum(["energetic", "calm", "playful", "bold"]).describe("Music mood that suits the app."),
  hook: z.string().describe("Opening line spoken over the title card, 6 to 12 words."),
  shots: z.array(ShotSchema).describe("5 to 7 shots in story order."),
  close: z.string().describe("Closing line spoken over the end card, inviting the viewer to try the app, 6 to 12 words."),
  cta: z.string().describe("End card button text, at most 5 words, for example: Try it free."),
});

export type Shot = z.infer<typeof ShotSchema>;
export type Plan = z.infer<typeof PlanSchema>;

/** Narration target for a 45 second trailer, across hook, shot lines and close. */
export const WORDS_TARGET = { min: 95, max: 125 } as const;

export function planWords(plan: Plan): number {
  return countWords([plan.hook, ...plan.shots.map((s) => s.narration), plan.close].join(" "));
}
