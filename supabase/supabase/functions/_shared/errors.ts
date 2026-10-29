// The message of anything thrown: an Error's message, else String(value).
// Twin of render/src/run-log.ts thrownMessage, minus its one-line squash, so
// every log line reads byte-for-byte as the inline ternaries it replaced.

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
