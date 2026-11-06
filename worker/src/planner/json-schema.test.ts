import assert from "node:assert/strict";
import { test } from "node:test";
import { PLAN_JSON_SCHEMA } from "./json-schema";

type Node = Record<string, any>;

test("plan schema keeps real enums and strict objects", () => {
  const root = PLAN_JSON_SCHEMA as Node;
  const shot = root.properties.shots.items as Node;
  assert.equal(root.$schema, undefined);
  assert.equal(root.additionalProperties, false);
  assert.equal(shot.additionalProperties, false);
  assert.deepEqual(root.properties.mood.enum, ["energetic", "calm", "playful", "bold"]);
  assert.deepEqual(shot.properties.action.enum, ["click", "hover", "type", "scroll", "wait"]);
  assert.deepEqual(shot.properties.target.anyOf, [{ type: "string" }, { type: "null" }]);
  assert.deepEqual(shot.required, ["action", "target", "text", "narration"]);
  assert.doesNotMatch(JSON.stringify(root), /minLength|maxLength|minimum|maximum|"type":\[/);
});
