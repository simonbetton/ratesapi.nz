import { t } from "elysia";

export const Plan = t.Object(
  {
    id: t.String({
      pattern: "^plan:",
      examples: ["plan:amex:airpoint-card"],
    }),
    name: t.String({
      examples: ["Airpoint Card"],
    }),
    interestFreePeriodInMonths: t.Nullable(
      t.Number({
        examples: [55, 90],
      }),
    ),
    primaryFeeNZD: t.Nullable(
      t.Number({
        examples: [0.0, 149.0],
      }),
    ),
    balanceTransferRate: t.Nullable(
      t.Number({
        examples: [0.0, 5.95],
      }),
    ),
    balanceTransferPeriod: t.Nullable(
      t.String({
        examples: ["6 months"],
      }),
    ),
    cashAdvanceRate: t.Nullable(
      t.Number({
        examples: [0.0, 21.95],
      }),
    ),
    purchaseRate: t.Nullable(
      t.Number({
        examples: [0.0, 21.95],
      }),
    ),
  },
  { additionalProperties: false },
);

export type Plan = typeof Plan.static;
