import type { SchemaOptions } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { t } from "elysia";
import type { TSchema } from "elysia";

export function parseSchema<Schema extends TSchema>(
  schema: Schema,
  value: unknown
): Schema["static"] {
  return Value.Parse<Schema, Schema["static"]>(schema, value);
}

// Elysia's t.Nullable adds the OpenAPI 3.0 `nullable` keyword next to the
// JSON Schema null type, which is invalid in the OpenAPI 3.1 document.
export function nullable<Schema extends TSchema>(
  schema: Schema,
  options: SchemaOptions = {}
) {
  return t.Union([schema, t.Null()], options);
}
