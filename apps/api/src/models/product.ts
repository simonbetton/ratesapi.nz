import { t } from "elysia";
import { Rate } from "./rate";

export const Product = t.Object(
  {
    id: t.String({
      pattern: "^product:",
      examples: ["product:anz:standard"],
    }),
    name: t.String({
      examples: ["Standard"],
    }),
    rates: t.Array(Rate),
  },
  { additionalProperties: false },
);

export type Product = typeof Product.static;
