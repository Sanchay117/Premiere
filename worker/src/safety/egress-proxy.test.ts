// End-to-end check that the browser cannot reach private addresses, directly or via a redirect.
// A fake resolver stands in for public DNS: "public.test" resolves to a local server that
// redirects to 127.0.0.1, which the proxy must refuse.

import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { launchSafeBrowser, newSafeContext } from "./browser";
import { resolvePublicHost } from "./url-guard";

const SECRET = "internal-secret-7f3a";
let secretServer: http.Server;
let redirectServer: http.Server;
let secretPort = 0;
let redirectPort = 0;

function listen(server: http.Server): Promise<number> {
  return new Promise((done) => server.listen(0, "127.0.0.1", () => done((server.address() as AddressInfo).port)));
}

before(async () => {
  secretServer = http.createServer((_req, res) => res.end(SECRET));
  secretPort = await listen(secretServer);
  redirectServer = http.createServer((_req, res) => {
    res.writeHead(302, { location: `http://127.0.0.1:${secretPort}/` });
    res.end();
  });
  redirectPort = await listen(redirectServer);
});

after(() => {
  secretServer?.close();
  redirectServer?.close();
});

/** Visits a URL in a fresh safe browser and returns the page body and the hosts the proxy refused. */
async function visit(url: string): Promise<{ body: string; blocked: Set<string> }> {
  const safe = await launchSafeBrowser({
    resolveHost: async (host) => (host === "public.test" ? ["127.0.0.1"] : resolvePublicHost(host)),
  });
  try {
    const context = await newSafeContext(safe.browser);
    const page = await context.newPage();
    await page.goto(url, { timeout: 10_000 }).catch(() => null);
    const body = await page.content().catch(() => "");
    return { body, blocked: safe.proxy.blocked };
  } finally {
    await safe.close();
  }
}

test("blocks loopback addresses", async () => {
  for (const host of ["127.0.0.1", "localhost"]) {
    const { body, blocked } = await visit(`http://${host}:${secretPort}/`);
    assert.doesNotMatch(body, new RegExp(SECRET), host);
    assert.ok(blocked.has(host), `${host} was refused by the proxy`);
  }
});

test("blocks a public URL that redirects to a private address", async () => {
  const { body, blocked } = await visit(`http://public.test:${redirectPort}/`);
  assert.doesNotMatch(body, new RegExp(SECRET));
  assert.ok(!blocked.has("public.test"), "the first hop was allowed");
  assert.ok(blocked.has("127.0.0.1"), "the redirect hop to 127.0.0.1 was refused");
});
