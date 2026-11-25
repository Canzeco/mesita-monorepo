import { EdgeError } from "@/lib/edge";

/** A mutation whose answer was lost: it may have happened. */
export function isOutcomeUnknown(err: unknown): boolean {
  return err instanceof EdgeError && err.retry === "reconcile-first";
}

const WAITS = [0, 3000, 5000];

/** Re-read the object the mutation acted on, at most three times in ten
 *  seconds. True when a re-read shows it happened. */
export async function reconcile(
  happened: () => Promise<boolean>,
  wait: (ms: number) => Promise<unknown> = (ms) => new Promise((done) => setTimeout(done, ms)),
): Promise<boolean> {
  for (const ms of WAITS) {
    await wait(ms);
    if (await happened().catch(() => false)) return true;
  }
  return false;
}
