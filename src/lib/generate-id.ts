import { isTruthy } from "./is-truthy";

const Prefix = {
  INSTITUTION: "institution",
  PRODUCT: "product",
  RATE: "rate",
  ISSUER: "issuer",
  PLAN: "plan",
} as const;

type Prefix = (typeof Prefix)[keyof typeof Prefix];
type Args = [Prefix, ...string[]];

/**
 * Generates an ID based on the provided arguments.
 */
export function generateId<T extends Prefix>(args: Args): `${T}:${string}` {
  const str = args
    .map((arg) => {
      return arg
        .toString()
        .toLowerCase()
        .trim()
        .replace(/</g, "less-than-")
        .replace(/>/g, "greater-than-")
        .replace(/\s+/g, "-") // Replace spaces with -
        .replace(/[^\w-]+/g, "") // Remove all non-word chars
        .replace(/--+/g, "-"); // Replace multiple - with single -
    })
    .filter(isTruthy)
    .join(":");

  if (!Object.values(Prefix).some((prefix) => str.startsWith(prefix))) {
    throw new Error(
      `The generated ID must start with one of the following prefixes: ${Object.values(
        Prefix,
      ).join(", ")}`,
    );
  }

  return str as `${T}:${string}`;
}
