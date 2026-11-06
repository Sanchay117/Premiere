// Cookie and consent banners cover the footage, so the capture (and later the recorder)
// gets rid of them. Prefers the privacy-preserving choice: reject, then accept, then hide.

import type { Page } from "playwright";
import { inpageScript } from "./inpage-scripts";

const REJECT_SELECTORS = [
  "#onetrust-reject-all-handler",
  "#CybotCookiebotDialogBodyButtonDecline",
  "#CybotCookiebotDialogBodyLevelButtonLevelOptinDeclineAll",
  "#didomi-notice-disagree-button",
  ".qc-cmp2-summary-buttons button[mode='secondary']",
  ".osano-cm-denyAll",
  "[data-tid='banner-decline']",
  ".cc-deny",
  "[data-testid='uc-deny-all-button']",
  ".cmplz-deny",
  ".iubenda-cs-reject-btn",
  ".cky-btn-reject",
  ".cm-btn-decline",
  "#truste-consent-required",
];

const ACCEPT_SELECTORS = [
  "#onetrust-accept-btn-handler",
  "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll",
  "#didomi-notice-agree-button",
  ".qc-cmp2-summary-buttons button[mode='primary']",
  ".osano-cm-accept-all",
  "[data-tid='banner-accept']",
  ".cc-dismiss",
  ".cc-allow",
  "[data-testid='uc-accept-all-button']",
  ".cmplz-accept",
  ".iubenda-cs-accept-btn",
  ".cky-btn-accept",
  ".cm-btn-accept-all",
  "#truste-consent-button",
  ".fc-cta-consent",
];

const REJECT_TEXT =
  /^\s*(reject( all)?( cookies)?|decline( all)?|deny( all)?|refuse( all)?|(use )?(only )?(strictly )?necessary( cookies)?( only)?|continue without accepting)\s*$/i;
const ACCEPT_TEXT =
  /^\s*(accept( all)?( cookies)?|allow( all)?( cookies)?|i agree|agree|got it|ok(ay)?|i understand|understood|close|dismiss)\s*[.!]?\s*$/i;

const BANNER = [
  '[id*="cookie" i]',
  '[class*="cookie" i]',
  '[id*="consent" i]',
  '[class*="consent" i]',
  '[aria-label*="cookie" i]',
  '[aria-label*="consent" i]',
  '[id*="gdpr" i]',
  '[class*="gdpr" i]',
]
  .map((s) => `${s}:not(html):not(body)`)
  .join(", ");

const BUTTONS = "button, [role='button'], a, input[type='button'], input[type='submit']";

/** What find-consent.js looks for, best choice first. */
const FIND = {
  rejectSelectors: REJECT_SELECTORS,
  rejectText: REJECT_TEXT.source,
  acceptSelectors: ACCEPT_SELECTORS,
  acceptText: ACCEPT_TEXT.source,
  banner: BANNER,
  buttons: BUTTONS,
};

/** Returns a note describing what was dismissed, or null when no banner was found. */
export async function dismissCookieBanners(page: Page): Promise<string | null> {
  const frames = page
    .frames()
    .filter(
      (f) =>
        f === page.mainFrame() ||
        /consent|cookie|cmp|privacy|sp_message|gdpr|trustarc|usercentrics|didomi/i.test(f.url()),
    );
  for (const frame of frames) {
    // One in-page pass finds and tags the candidates; clicks only happen when there is a banner.
    const labels = (await frame.evaluate(inpageScript("find-consent", FIND)).catch(() => [])) as string[];
    for (const [i, text] of labels.entries()) {
      const button = frame.locator(`[data-premiere-consent="${i}"]`).first();
      if (await button.click({ timeout: 1500 }).then(() => true, () => false)) {
        await page.waitForTimeout(500);
        return `Dismissed a cookie banner ("${text || "button"}").`;
      }
    }
  }
  const hidden = (await page.evaluate(inpageScript("hide-overlays")).catch(() => 0)) as number;
  return hidden > 0 ? `Hid ${hidden} cookie overlay${hidden === 1 ? "" : "s"}.` : null;
}
