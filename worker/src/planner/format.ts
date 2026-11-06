import type { Capture } from "../capture/types";
import type { Plan } from "./schema";

export function targetLabel(id: string | null, c: Capture): string {
  if (!id) return "";
  const el = c.elements.find((e) => e.id === id);
  if (el) return `${id} "${el.text}"`;
  const section = c.sections.find((s) => s.id === id);
  if (section) return `${id} "${section.heading}"`;
  return id;
}

/** Human-readable script: title card, numbered shots with their actions, and the close. */
export function formatPlan(plan: Plan, c: Capture): string[] {
  const lines = [`${plan.appName}: ${plan.tagline} (mood ${plan.mood}, end card "${plan.cta}")`, `Hook: ${plan.hook}`];
  plan.shots.forEach((s, i) => {
    const action = [s.action, targetLabel(s.target, c), s.text ? `typing "${s.text}"` : ""].filter(Boolean).join(" ");
    lines.push(`${i + 1}. [${action}] ${s.narration}`);
  });
  lines.push(`Close: ${plan.close}`);
  return lines;
}
