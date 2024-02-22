type Prefix = "institution" | "product" | "rate";
type Args = [Prefix, ...string[]];

/**
 * Generates an ID based on the provided arguments.
 */
export function generateId(args: Args): string {
  return args
    .map((arg) => {
      return arg
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-") // Replace spaces with -
        .replace(/[^\w\-]+/g, "") // Remove all non-word chars
        .replace(/\-\-+/g, "-"); // Replace multiple - with single -
    })
    .join(":");
}
