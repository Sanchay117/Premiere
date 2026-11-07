import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** The demo folder, and its gitignored output: voice, recording, soundtrack and the render. */
export const DEMO = path.resolve(here, "..");
export const OUT = path.join(DEMO, ".out");
export const REPO = path.resolve(DEMO, "..");
export const JOBS = path.join(REPO, "worker", ".data", "jobs");
