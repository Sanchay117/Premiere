import { createHash } from "node:crypto";

const TRACKING_PARAMS = new Set(["fbclid", "gclid", "mc_cid", "mc_eid"]);

/** Parses user input into a URL, adding https:// when the scheme is missing, and drops tracking noise. */
export function normalizeUrl(input: string): URL {
  let s = input.trim();
  if (!s) throw new Error("Enter a link to your app.");
  if (!s.includes("://")) s = `https://${s}`;
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    throw new Error(`"${input}" is not a valid link.`);
  }
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (/^utm_/i.test(key) || TRACKING_PARAMS.has(key.toLowerCase())) url.searchParams.delete(key);
  }
  return url;
}

/** Cache identity for a URL: host without www, path without trailing slash, sorted query. */
export function urlKey(url: URL): string {
  const host = url.hostname.replace(/^www\./, "");
  const port = url.port ? `:${url.port}` : "";
  const pathname = url.pathname.replace(/\/+$/, "") || "/";
  const params = [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
  const query = params.length ? `?${new URLSearchParams(params).toString()}` : "";
  return `${host}${port}${pathname}${query}`;
}

/** File-system friendly, human readable and unique name for a URL. */
export function urlSlug(url: URL): string {
  const key = urlKey(url);
  const readable = key
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const hash = createHash("sha1").update(key).digest("hex").slice(0, 8);
  return `${readable}-${hash}`;
}

export function hostLabel(href: string): string {
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return href;
  }
}
