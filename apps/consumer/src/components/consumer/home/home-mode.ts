// Home mode contract, shared between the /home server page (which parses
// ?mode= for deep links) and the client hub (which reads it back via
// useSearchParams and writes it via history.replaceState). Lives outside
// the "use client" modules so the server page can call parseHomeMode
// without pulling a client reference.

export type HomeMode = "swipe" | "askAi" | "social" | "favorites";

export const HOME_MODE_PARAM = "mode";

// Anything that isn't an explicit deep link lands on the default Swipe deck —
// including the bare /home tab tap.
export function parseHomeMode(
  value: string | string[] | undefined,
): HomeMode {
  return value === "askAi" || value === "social" || value === "favorites"
    ? value
    : "swipe";
}
