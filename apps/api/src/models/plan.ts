import { t } from "elysia";

import { nullable } from "../lib/schema";

export const Plan = t.Object(
  {
    id: t.String({
      pattern: "^plan:",
      description: "The ID of the credit card plan.",
      examples: ["plan:amex:airpoint-card"],
    }),
    name: t.String({
      description: "The name of the plan that the issuer uses.",
      examples: ["Airpoint Card"],
    }),
    interestFreePeriodInMonths: nullable(
      t.Number({
        examples: [55],
      }),
      {
        description:
          "The longest interest-free period for purchases. The field name shows months, but the value is in days. For example, `55` is 55 days. The value is `null` if the plan has no interest-free period.",
      }
    ),
    primaryFeeNZD: nullable(
      t.Number({
        examples: [0, 149],
      }),
      {
        description:
          "The card fee for the primary cardholder, in New Zealand dollars (NZD). The value is `null` if the source does not give a fee.",
      }
    ),
    balanceTransferRate: nullable(
      t.Number({
        examples: [0, 5.95],
      }),
      {
        description:
          "The interest rate for a balance transfer, in %. The `balanceTransferPeriod` field gives the period of this rate. The value is `null` if the source does not give a rate.",
      }
    ),
    balanceTransferPeriod: nullable(
      t.String({
        examples: ["6 months"],
      }),
      {
        description:
          "The period of the balance transfer rate, as text. The value is `null` if the source does not give a period.",
      }
    ),
    cashAdvanceRate: nullable(
      t.Number({
        examples: [0, 21.95],
      }),
      {
        description:
          "The interest rate for a cash advance, in % for each year. The value is `null` if the source does not give a rate.",
      }
    ),
    purchaseRate: nullable(
      t.Number({
        examples: [0, 21.95],
      }),
      {
        description:
          "The interest rate for purchases, in % for each year. The value is `null` if the source does not give a rate.",
      }
    ),
  },
  { additionalProperties: false }
);

export type Plan = typeof Plan.static;
