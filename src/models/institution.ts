import { t } from "elysia";
import { Product } from "./product";

export const Institution = t.Object(
  {
    id: t.String({
      pattern: "^institution:",
      examples: ["institution:anz"],
    }),
    name: t.String({
      examples: ["ANZ", "Kiwibank", "Westpac"],
    }),
    products: t.Array(Product),
  },
  { additionalProperties: false },
);

export type Institution = typeof Institution.static;
