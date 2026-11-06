import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "inpage");
const cache = new Map<string, string>();

/**
 * Returns an expression that runs one of the plain-JS in-page scripts with the given options.
 * The scripts are read as text and never pass through the TypeScript loader, which would
 * otherwise inject helpers (such as __name) that do not exist inside the page.
 */
export function inpageScript(name: "extract" | "marks" | "hide-overlays", options: unknown = {}): string {
  let source = cache.get(name);
  if (!source) {
    source = readFileSync(path.join(dir, `${name}.js`), "utf8").trim();
    cache.set(name, source);
  }
  return `(${source})(${JSON.stringify(options)})`;
}
