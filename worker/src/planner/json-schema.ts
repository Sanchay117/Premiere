// The JSON schema sent as the structured output format. Built from the zod schema with zod's
// own converter, then narrowed to what structured outputs accept. We do not use the SDK's
// zodOutputFormat helper here because it turns `enum` into a description hint, which would
// let the model return an action or mood outside the list.

import { z } from "zod";
import { PlanSchema } from "./schema";

type JsonSchema = { [key: string]: unknown };

function strict(node: JsonSchema): JsonSchema {
  const out: JsonSchema = {};
  for (const [key, value] of Object.entries(node)) {
    // Defaults fill in saved plans on our side; the model always writes the field.
    if (key === "$schema" || key === "default") continue;
    if (key === "properties") {
      out.properties = Object.fromEntries(
        Object.entries(value as Record<string, JsonSchema>).map(([name, child]) => [name, strict(child)]),
      );
    } else if (key === "items") {
      out.items = strict(value as JsonSchema);
    } else if (key === "anyOf") {
      out.anyOf = (value as JsonSchema[]).map(strict);
    } else {
      out[key] = value;
    }
  }
  // ["string", "null"] becomes anyOf, the documented way to express a nullable field.
  if (Array.isArray(out.type)) {
    const { type, description, ...rest } = out;
    return {
      ...(description === undefined ? {} : { description }),
      anyOf: (type as string[]).map((t) => strict({ ...rest, type: t })),
    };
  }
  if (out.type === "object") out.additionalProperties = false;
  return out;
}

export const PLAN_JSON_SCHEMA: JsonSchema = strict(
  z.toJSONSchema(PlanSchema, { target: "draft-2020-12", io: "output" }) as JsonSchema,
);
