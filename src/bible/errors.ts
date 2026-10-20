/**
 * What went wrong, for a person to read. logoxide's and topos's errors are Errors whose message
 * is only their class ("LogoxideError"); what happened is in `value.message`, so that comes first.
 */
export function describeError(error: unknown): string {
  if (typeof error === "object" && error && "value" in error) {
    const value = (error as { value: { message?: unknown } | null }).value;
    if (typeof value?.message === "string" && value.message) return value.message;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}
