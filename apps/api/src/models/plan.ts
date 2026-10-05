import { t } from "elysia";

import { nullable } from "../lib/schema";

export const Plan = t.Object(
  {
    condition: t.Optional(
      t.String({
        description:
          "Issuer conditions, promotional periods or product availability relevant to the quoted standard rate.",
      })
    ),
    sourceUrl: t.Optional(
      t.String({
        format: "uri",
        description:
          "The issuer website or first-party rate feed used for this plan. Historical records may omit this field.",
      })
    ),
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
          "The longest interest-free period for purchases. The field name shows months, but the value is in days. For example, `55` is 55 days. The value is `null` if the collected source does not give an interest-free period.",
      }
    ),
    primaryFeeNZD: nullable(
      t.Number({
        examples: [0, 149],
      }),
      {
        description:
          "The card fee for the primary cardholder, in New Zealand dollars (NZD). Direct collections give the annual fee, including when the issuer charges it in half-yearly instalments. The value is `null` if the source does not give a fee.",
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
