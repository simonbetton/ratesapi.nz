import { z } from "@hono/zod-openapi";

export const GenericApiError = z.object({
  code: z.number().openapi({
    examples: [404, 500],
  }),
  message: z.string().openapi({
    examples: ["Internal Server Error"],
  }),
});

export const TimeSeriesDateParameter = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .openapi({
      param: {
        name: "date",
        in: "query",
      },
      description: "Date in YYYY-MM-DD format for historical data",
      example: "2026-03-01",
    }),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .openapi({
      param: {
        name: "startDate",
        in: "query",
      },
      description: "Start date in YYYY-MM-DD format for time series range",
      example: "2026-01-01",
    }),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .openapi({
      param: {
        name: "endDate",
        in: "query",
      },
      description: "End date in YYYY-MM-DD format for time series range",
      example: "2026-03-01",
    }),
});
