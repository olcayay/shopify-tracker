/**
 * Serialize errors for logging, including AggregateError support.
 * String(err) on AggregateError loses the nested .errors array —
 * this utility preserves them.
 */
export function serializeError(err: unknown): string {
  if (err instanceof AggregateError) {
    const nested = err.errors
      .map((e, i) => `  [${i}] ${e instanceof Error ? e.message : String(e)}`)
      .join("\n");
    return `AggregateError: ${err.message}\n${nested}`;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

/**
 * Get the error message suitable for storage (e.g. dead letter queue).
 * Includes nested errors from AggregateError.
 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof AggregateError) {
    const nested = err.errors
      .map((e) => (e instanceof Error ? e.message : String(e)))
      .join("; ");
    return `AggregateError: ${err.message} — [${nested}]`;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

/**
 * Get the stack trace, including nested stacks from AggregateError.
 */
export function getErrorStack(err: unknown): string | undefined {
  if (err instanceof AggregateError) {
    const ownStack = err.stack ?? "";
    const nestedStacks = err.errors
      .filter((e): e is Error => e instanceof Error && !!e.stack)
      .map((e, i) => `--- Nested error [${i}] ---\n${e.stack}`)
      .join("\n");
    return nestedStacks ? `${ownStack}\n${nestedStacks}` : ownStack || undefined;
  }
  if (err instanceof Error) {
    return err.stack;
  }
  return undefined;
}
