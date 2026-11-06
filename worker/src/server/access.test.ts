import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

// access.ts reads its settings when it loads, so set them first (the repo .env never overrides
// variables that are already set) and keep its state in a throwaway folder.
const dir = await mkdtemp(path.join(os.tmpdir(), "premiere-access-"));
process.env.PREMIERE_DATA_DIR = dir;
process.env.ACCESS_CODES = "NIGHT:2";
process.env.ACCESS_PER_VISITOR_DAILY = "1";
process.env.ACCESS_DAILY_CAP = "10";
const { accessRequired, admit } = await import("./access");

test("entrant codes, per-visitor limits and code caps", async (t) => {
  t.after(() => rm(dir, { recursive: true, force: true }));
  assert.equal(accessRequired, true);

  assert.match((await admit(undefined, "visitor-a")).reason ?? "", /access code/);
  assert.match((await admit("WRONG", "visitor-a")).reason ?? "", /not valid/);
  assert.deepEqual(await admit(" night ", "visitor-a"), { ok: true, code: "NIGHT" });
  assert.match((await admit("NIGHT", "visitor-a")).reason ?? "", /today's 1 free/);
  assert.equal((await admit("NIGHT", "visitor-b")).ok, true);
  assert.match((await admit("NIGHT", "visitor-c")).reason ?? "", /used up/);

  const state = JSON.parse(await readFile(path.join(dir, "access.json"), "utf8"));
  assert.equal(state.total, 2);
  assert.equal(state.codes.NIGHT, 2);
  const keys = Object.keys(state.visitors);
  assert.equal(keys.length, 2);
  for (const key of keys) assert.match(key, /^[0-9a-f]{16}$/, "visitors are stored as keyed hashes only");

  const secret = (await readFile(path.join(dir, "access-secret"), "utf8")).trim();
  assert.match(secret, /^[0-9a-f]{64}$/);
});
