// EVERY ERROR IS SAID (Pato, MESITA-3021: "if an error, in general, in the
// app, log the errors as a notification"). One place turns a failure into an
// error toast, and the console line beside it. Server code imports this too
// (through lib/api/_invoke.ts), so it is a no-op without `window`.

import { toast } from "./toast";

/** Background calls whose failure the guest should never hear about. */
const SILENT_EFS = new Set([
  "consumer-web-track-event",
  "consumer-web-track-activity",
]);

/** Show `message` as an error notification. */
export function reportError(message: string, detail?: unknown): void {
  if (typeof window === "undefined") return;
  console.error("[mesita]", message, detail ?? "");
  toast.error(message);
}

/** A failed Edge Function call. A 4xx is an answer the screen handles (a
 *  place that is gone, a refused booking) and says in its own words; a
 *  network failure, an expired session or a server error is not, so it is
 *  said here. */
export function reportEFFailure(
  fn: string,
  message: string,
  status: number | null,
): void {
  if (SILENT_EFS.has(fn)) return;
  if (status != null && status >= 400 && status < 500 && status !== 401) return;
  const said =
    status == null
      ? "Couldn't reach Mesita. Check your connection."
      : status === 401
        ? "Your session expired. Sign in again."
        : `Something went wrong: ${message}`;
  reportError(said, { fn, status, message });
}
