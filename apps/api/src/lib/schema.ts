import { Value } from "@sinclair/typebox/value";
import { type TSchema } from "elysia";

export function parseSchema<Schema extends TSchema>(
  schema: Schema,
  value: unknown,
): Schema["static"] {
  return Value.Parse<Schema, Schema["static"]>(schema, value);
}
