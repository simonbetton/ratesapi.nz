import { isTruthy } from "./is-truthy";

type Prefix = "institution" | "product" | "rate" | "issuer" | "plan";
type Args<TPrefix extends Prefix> = [TPrefix, ...string[]];

const PREFIXES: Prefix[] = [
  "institution",
  "product",
  "rate",
  "issuer",
  "plan",
];

/**
 * Generates an ID based on the provided arguments.
 */
export function generateId<TPrefix extends Prefix>(
  args: Args<TPrefix>,
): `${TPrefix}:${string}` {
  const prefix = args[0];
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

  if (!PREFIXES.some((candidate) => str.startsWith(candidate))) {
    throw new Error(
      `The generated ID must start with one of the following prefixes: ${PREFIXES.join(
        ", ",
      )}`,
    );
  }

  if (!isPrefixedId(prefix, str)) {
    throw new Error(`Generated ID does not match expected prefix "${prefix}"`);
  }

  return str;
}

function isPrefixedId<TPrefix extends Prefix>(
  prefix: TPrefix,
  value: string,
): value is `${TPrefix}:${string}` {
  const prefixWithDelimiter = `${prefix}:`;
  return value.startsWith(prefixWithDelimiter) && value.length > prefixWithDelimiter.length;
}
