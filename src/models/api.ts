import { z } from "@hono/zod-openapi";
import { MortgageRates } from "./mortgage-rates";
import { PersonalLoanRates } from "./personal-loan-rates";

const Models = z.discriminatedUnion("type", [MortgageRates, PersonalLoanRates]); // TODO: Add more models

export const ApiSuccess = Models.and(
  z.object({
    termsOfUse: z.string().openapi({}),
  })
);
export type ApiSuccess = z.infer<typeof ApiSuccess>;

export const ApiError = z.object({
  code: z.number().openapi({
    example: 500,
  }),
  message: z.string().openapi({
    example: "Internal Server Error",
  }),
});
