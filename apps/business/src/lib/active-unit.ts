export const ACTIVE_UNIT_COOKIE = "mesita_active_unit";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function resolveActiveUnitId(options: {
  pathnameUnitId?: string | null;
  cookieId?: string | null;
  venueIds: readonly string[];
}): string | null {
  const { pathnameUnitId, cookieId, venueIds } = options;
  if (pathnameUnitId && venueIds.includes(pathnameUnitId)) {
    return pathnameUnitId;
  }
  if (cookieId && venueIds.includes(cookieId)) {
    return cookieId;
  }
  return venueIds[0] ?? null;
}

export const activeUnitCookieOptions = {
  path: "/",
  maxAge: COOKIE_MAX_AGE,
  sameSite: "lax" as const,
  httpOnly: true,
};
