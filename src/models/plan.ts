import { z } from "@hono/zod-openapi";
import { toTitleFormat } from "../utils/transforms";

export type PlanId = `plan:${string}`;

export const Plan = z
  .object({
    id: z
      .string()
      .regex(/^plan:/, "String must start with 'plan:'")
      .openapi({
        examples: ["plan:amex:airpoint-card"],
      }),
    name: z
      .string()
      .transform(toTitleFormat)
      .openapi({
        examples: ["Airpoint Card"],
      }),
    interestFreePeriodInMonths: z
      .number()
      .nullable()
      .openapi({
        examples: [55, 90],
      }),
    primaryFeeNZD: z
      .number()
      .nullable()
      .openapi({
        examples: [0.0, 149.0],
      }),
    balanceTransferRate: z
      .number()
      .nullable()
      .openapi({
        examples: [0.0, 5.95],
      }),
    balanceTransferPeriod: z
      .string()
      .transform(toTitleFormat)
      .nullable()
      .openapi({
        examples: ["6 months"],
      }),
    cashAdvanceRate: z
      .number()
      .nullable()
      .openapi({
        examples: [0.0, 21.95],
      }),
    purchaseRate: z
      .number()
      .nullable()
      .openapi({
        examples: [0.0, 21.95],
      }),
  })
  .strict();
// The inferred type from a Zod schema using .regex() for string patterns
// would result in a generic string type when inferred.
// To enforce the pattern and have a specific type for the id,
// we intersect the inferred type with a literal type.
export type Plan = z.infer<typeof Plan> & {
  id: PlanId;
};
