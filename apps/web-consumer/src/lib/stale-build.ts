// A NAVIGATION THAT CRASHES ON AN OLD BUILD HEALS ITSELF (MESITA-2993).
// Production ships many times a day. A tab still running yesterday's bundle
// asks for a chunk or a screen the live deployment no longer serves, and
// the route change throws. The cure for that is a full reload onto the new
// build, so the error boundaries ask here first: a chunk-load failure, or
// any error while /api/version reports a newer sha, reloads once.

const LOADED_SHA = process.env.NEXT_PUBLIC_BUILD_SHA ?? "dev";

// Chrome, Safari, Firefox and the bundler's own words for a script that
// failed to arrive or a module the running build does not have.
const STALE_PATTERNS = [
  /ChunkLoadError/i,
  /Loading (CSS )?chunk [\w-]+ failed/i,
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /error loading dynamically imported module/i,
  /module factory is not available/i,
  /Failed to load chunk/i,
];

export function looksLikeStaleBuild(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const text = `${error.name}: ${error.message}`;
  return STALE_PATTERNS.some((pattern) => pattern.test(text));
}

/** True when the live deployment runs a different build than this tab. */
export async function liveBuildDiffers(): Promise<boolean> {
  if (LOADED_SHA === "dev") return false;
  try {
    const res = await fetch("/api/version", { cache: "no-store" });
    if (!res.ok) return false;
    const { sha } = (await res.json()) as { sha?: string };
    return Boolean(sha && sha !== "dev" && sha !== LOADED_SHA);
  } catch {
    return false;
  }
}

// One automatic reload per window: if the fresh build throws the same way,
// the guest sees the error screen instead of a reload loop.
const RELOAD_KEY = "mesita:stale-build-reload-at";
const RELOAD_WINDOW_MS = 30_000;

/** Hard-reloads unless one already ran inside the window; true if it did. */
export function reloadOnce(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < RELOAD_WINDOW_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // No storage (private mode): reloading without the guard could loop.
    return false;
  }
  window.location.reload();
  return true;
}

/** The boundaries' first move: reload onto the live build when it helps. */
export async function recoverFromStaleBuild(error: unknown): Promise<boolean> {
  if (looksLikeStaleBuild(error) || (await liveBuildDiffers())) {
    return reloadOnce();
  }
  return false;
}
