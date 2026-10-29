// THE CALL LOG (MESITA-3040). Every Edge Function call this browser makes
// and every screen change, timed, kept as the last few lines for CallLog to
// print under the route badge. Pato asked to watch the app talk to the
// backend live, to see which call is slow or failing without opening
// devtools. React-free on purpose: invokeEF (also used on the server)
// writes here, and a server write is dropped so one request never leaks
// into another.

export type CallLine = {
  id: number;
  at: number;
  kind: "ef" | "nav";
  label: string;
  // "ok", an HTTP status, "net" (no response), or "fail" (a 2xx `ok:false`).
  status: string;
  ms: number | null;
};

const MAX_LINES = 40;

let lines: CallLine[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

export function logCall(line: Omit<CallLine, "id" | "at">): void {
  if (typeof window === "undefined") return;
  lines = [{ ...line, id: nextId++, at: Date.now() }, ...lines].slice(
    0,
    MAX_LINES,
  );
  for (const listener of listeners) listener();
}

export function subscribeCallLog(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function readCallLog(): CallLine[] {
  return lines;
}

const EMPTY: CallLine[] = [];
export function readCallLogOnServer(): CallLine[] {
  return EMPTY;
}

// The tap that started a navigation, so the screen change can say how long
// it took from the finger to the new path.
let navStart: { at: number; href: string } | null = null;

export function markNavStart(href: string): void {
  navStart = { at: performance.now(), href };
}

/** Milliseconds since the last tap, if one happened in the last 20 s. */
export function takeNavStart(): number | null {
  const start = navStart;
  navStart = null;
  if (!start) return null;
  const ms = performance.now() - start.at;
  return ms < 20_000 ? Math.round(ms) : null;
}
