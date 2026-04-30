import { t } from "elysia";

export const RateSchema = t.Object(
  {
    id: t.String({
      pattern: "^rate:",
      examples: ["rate:anz:standard:18-months"],
    }),
    rate: t.Number({
      examples: [4.29],
    }),
  },
  { additionalProperties: false },
);

export const Rate = RateSchema;

export type Rate = typeof RateSchema.static;
