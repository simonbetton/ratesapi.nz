import { isTruthy } from "./is-truthy";

export type Prefix = "institution" | "product" | "rate" | "issuer" | "plan";
export type Args = [Prefix, ...string[]];
const PrefixValues: Prefix[] = [
  "institution",
  "product",
  "rate",
  "issuer",
  "plan",
];

/**
 * Generates an ID based on the provided arguments.
 */
export function generateId(args: Args): string {
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

  if (!PrefixValues.some((prefix) => str.startsWith(prefix))) {
    throw new Error(
      `The generated ID must start with one of the following prefixes: ${PrefixValues.join(
        ", ",
      )}`,
    );
  }

  return str;
}
