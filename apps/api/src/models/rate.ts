import { t } from "elysia";

export const RateSchema = t.Object(
  {
    id: t.String({
      pattern: "^rate:",
      description: "The ID of the rate.",
      examples: ["rate:anz:standard:18-months"],
    }),
    rate: t.Number({
      description:
        "The interest rate for each year, in %. For example, `4.29` is 4.29 %.",
      examples: [4.29],
    }),
  },
  { additionalProperties: false },
);
