// One place that launches Chromium for untrusted pages: all traffic through the egress
// proxy, no downloads, no service workers, no permissions, no non-proxied UDP.

import { chromium, type Browser, type BrowserContext, type BrowserContextOptions } from "playwright";
import { startEgressProxy, type EgressProxy, type EgressProxyOptions } from "./egress-proxy";

export interface SafeBrowser {
  browser: Browser;
  proxy: EgressProxy;
  close(): Promise<void>;
}

export async function launchSafeBrowser(proxyOptions: EgressProxyOptions = {}): Promise<SafeBrowser> {
  const proxy = await startEgressProxy(proxyOptions);
  try {
    const browser = await chromium.launch({
      headless: true,
      // Playwright also forces loopback traffic through the proxy (<-loopback>), so
      // localhost and 127.0.0.1 cannot bypass the address check.
      proxy: { server: proxy.server },
      args: [
        "--mute-audio",
        "--disable-dev-shm-usage",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-quic",
        "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
      ],
    });
    return {
      browser,
      proxy,
      close: async () => {
        await browser.close().catch(() => {});
        await proxy.close();
      },
    };
  } catch (err) {
    await proxy.close();
    throw err;
  }
}

/** Fresh context per job with the hardening options every untrusted page gets. */
export async function newSafeContext(browser: Browser, options: BrowserContextOptions = {}): Promise<BrowserContext> {
  const context = await browser.newContext({
    acceptDownloads: false,
    serviceWorkers: "block",
    permissions: [],
    locale: "en-US",
    timezoneId: "UTC",
    ...options,
  });
  return context;
}
