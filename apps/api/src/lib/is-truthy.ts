export function isTruthy<T>(value: T | undefined | null): value is T {
  return Boolean(value);
}
