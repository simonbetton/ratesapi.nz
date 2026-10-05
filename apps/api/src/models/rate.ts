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
    sourceUrl: t.Optional(
      t.String({
        format: "uri",
        description:
          "The institution website or first-party rate feed used for this rate. Historical records may omit this field.",
      })
    ),
    rateType: t.Optional(
      t.Union(
        [t.Literal("advertised"), t.Literal("from"), t.Literal("range")],
        {
          description:
            "Whether the rate is a single advertised rate, a starting rate, or the lower end of a published range. Individual offers can differ.",
        }
      )
    ),
    rateMaximum: t.Optional(
      t.Number({
        minimum: 0,
        maximum: 100,
        description:
          "The upper end of a published annual interest rate range, in %. Present only when rateType is range.",
      })
    ),
  },
  { additionalProperties: false }
);
