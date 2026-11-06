// Small hand-made capture for planner tests (no browser needed).

import type { Capture, CapturedElement } from "../capture/types";

function element(id: string, kind: CapturedElement["kind"], text: string, extra: Partial<CapturedElement> = {}): CapturedElement {
  return {
    id,
    kind,
    text,
    role: null,
    inputType: kind === "input" ? "text" : null,
    href: null,
    navigates: false,
    external: false,
    region: "main",
    box: { x: 800, y: 500, w: 220, h: 56 },
    aboveFold: true,
    selector: `#${id}`,
    sensitive: false,
    ...extra,
  };
}

export function testCapture(): Capture {
  return {
    version: 2,
    url: "https://example-app.test/",
    finalUrl: "https://example-app.test/",
    capturedAt: "2026-11-06T00:00:00.000Z",
    title: "Tidy | Clean up messy notes in seconds",
    description:
      "Tidy turns messy meeting notes into clear action items. Paste your notes and get a summary, owners and deadlines. Share the result with your team in one click.",
    siteName: "",
    lang: "en",
    ogImage: null,
    themeColor: null,
    textExcerpt: "Clean up messy notes in seconds\nPricing\nPaste your notes and Tidy finds every decision and deadline.\n3 plans",
    pageHeight: 3200,
    viewport: { width: 1920, height: 1080 },
    loginWall: false,
    botWall: false,
    elements: [
      element("e1", "link", "Pricing", { region: "nav", href: "https://example-app.test/pricing", navigates: true, box: { x: 1500, y: 20, w: 80, h: 30 } }),
      element("e2", "input", "Paste your notes here"),
      element("e3", "button", "Get started free", { href: null }),
      element("e4", "input", "Email", { inputType: "email", sensitive: true }),
      element("e5", "link", "GitHub", { href: "https://github.com/example/tidy", navigates: true, external: true }),
      element("e6", "button", "Log out"),
      element("e7", "link", "Try the demo", { href: "https://example-app.test/demo", navigates: true }),
      element("e8", "link", "Contact", { href: "mailto:hi@example-app.test", region: "footer", aboveFold: false }),
      element("e9", "link", "Log in", { region: "nav", href: "https://example-app.test/login", navigates: true }),
    ],
    sections: [
      { id: "s1", heading: "Clean up messy notes in seconds", level: 1, text: "Paste anything. Tidy does the rest.", y: 300 },
      { id: "s2", heading: "Action items, not walls of text", level: 2, text: "Every task gets an owner and a due date.", y: 1300 },
      { id: "s3", heading: "Built for teams", level: 2, text: "Share summaries to Slack or email with one click.", y: 2100 },
      { id: "s4", heading: "Private by default", level: 2, text: "Your notes never train any model.", y: 2700 },
    ],
    screenshots: [],
    notes: [],
    warnings: [],
  };
}
