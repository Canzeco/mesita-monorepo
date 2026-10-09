// Two guest surfaces on one host (MESITA-2066).
//
//   /mob  phone emulator — the narrow visualizer. It says so on screen.
//   /web  the large consumer site. Responsive, full width, not a second phone.
//
// The route tree stays unprefixed. The proxy rewrites /mob and /web onto it
// and stamps x-surface. Links and history stay on the surface the guest opened.

export const SURFACES = ["mob", "web"] as const;
export type Surface = (typeof SURFACES)[number];

export const SURFACE_COOKIE = "mesita-surface";
export const DEFAULT_SURFACE: Surface = "web";

const SURFACE_RE = /^\/(mob|web)(?=\/|$)/;

export function isSurface(value: string | null | undefined): value is Surface {
  return value === "mob" || value === "web";
}

/** Drop a leading /mob or /web. Everything else is already bare. */
export function barePath(pathname: string): string {
  const rest = pathname.replace(SURFACE_RE, "");
  return rest === "" ? "/" : rest;
}

export function surfaceOf(pathname: string): Surface | null {
  const match = pathname.match(SURFACE_RE);
  return match && isSurface(match[1]) ? match[1] : null;
}

/** Prefix an in-app path. Leaves external, hash-only, api, and already-prefixed paths alone. */
export function prefixPath(surface: Surface, path: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) return path;
  if (surfaceOf(path)) return path;
  if (path.startsWith("/_next") || path.startsWith("/api")) return path;
  if (path === "/") return `/${surface}`;
  return `/${surface}${path}`;
}

export function readSurfaceCookie(
  header: string | null | undefined,
): Surface | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    const value = rest.join("=");
    if (name === SURFACE_COOKIE && isSurface(value)) return value;
  }
  return null;
}

/**
 * What the proxy should do with this pathname.
 * Skip leaves /api alone. Redirect sends a bare app path onto a surface.
 * Rewrite serves the bare route while the browser keeps /mob or /web.
 */
export function resolveSurface(
  pathname: string,
  cookie: Surface | null,
):
  | { kind: "skip" }
  | { kind: "redirect"; pathname: string; surface: Surface }
  | { kind: "rewrite"; bare: string; surface: Surface } {
  if (pathname === "/api" || pathname.startsWith("/api/")) {
    return { kind: "skip" };
  }
  const surface = surfaceOf(pathname);
  if (surface) {
    return { kind: "rewrite", bare: barePath(pathname), surface };
  }
  const next = cookie ?? DEFAULT_SURFACE;
  return {
    kind: "redirect",
    pathname: prefixPath(next, pathname),
    surface: next,
  };
}
