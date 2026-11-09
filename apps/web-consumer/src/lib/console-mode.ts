// THE DESKTOP CONSOLE'S MODE (MESITA-3575). Pato: three modes, because the
// big terminal is hard on the eyes — "phone" (the phone alone), "functions"
// (the phone and the call log), "terminal" (the phone, the call log and the
// request/response panel). Remembered per browser; a blocked localStorage
// just means the default every load.

export type ConsoleMode = "phone" | "functions" | "terminal";

export const CONSOLE_MODES: ConsoleMode[] = ["phone", "functions", "terminal"];

const KEY = "mesita:console-mode";
const DEFAULT: ConsoleMode = "terminal";

let mode: ConsoleMode | null = null;
const listeners = new Set<() => void>();

export function readConsoleMode(): ConsoleMode {
  if (mode !== null) return mode;
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(KEY);
  } catch {
    stored = null;
  }
  mode = CONSOLE_MODES.includes(stored as ConsoleMode)
    ? (stored as ConsoleMode)
    : DEFAULT;
  return mode;
}

export function readConsoleModeOnServer(): ConsoleMode {
  return DEFAULT;
}

export function setConsoleMode(next: ConsoleMode): void {
  mode = next;
  try {
    window.localStorage.setItem(KEY, next);
  } catch {
    // Private window or blocked storage: the switch still works this load.
  }
  for (const listener of listeners) listener();
}

export function subscribeConsoleMode(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}
