export const ACTIVE_PLACE_COOKIE = "mesita_active_place";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function resolveActivePlaceId(options: {
  pathnamePlaceId?: string | null;
  cookieId?: string | null;
  projectIds: readonly string[];
}): string | null {
  const { pathnamePlaceId, cookieId, projectIds } = options;
  if (pathnamePlaceId && projectIds.includes(pathnamePlaceId)) {
    return pathnamePlaceId;
  }
  if (cookieId && projectIds.includes(cookieId)) {
    return cookieId;
  }
  return projectIds[0] ?? null;
}

export const activePlaceCookieOptions = {
  path: "/",
  maxAge: COOKIE_MAX_AGE,
  sameSite: "lax" as const,
  httpOnly: true,
};
