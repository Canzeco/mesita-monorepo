// Who may open which root screen. Both layouts render from this table, and
// routes.test.ts walks src/app against it: a screen left out would be open to
// everyone.

export const ROUTE_GROUPS = {
  update: ["update"],
  suspended: ["suspended"],
  onboarding: ["onboarding"],
  everyone: ["(tabs)", "categories", "location", "open"],
  anonymousOnly: ["sign-in", "welcome"],
  membersOnly: [],
} as const satisfies Record<string, readonly string[]>;

export type RootRoute = (typeof ROUTE_GROUPS)[keyof typeof ROUTE_GROUPS][number];

/** Me's pages behind its own guard: every one but index. */
export const ME_PAGES: readonly string[] = [];

/** The addresses a link may open, as patterns. */
const PATHS = [/^\/$/, /^\/search$/, /^\/me$/, /^\/location$/, /^\/open$/, /^\/sign-in$/];

export function isAppPath(path: string): boolean {
  const bare = path.split(/[?#]/)[0].replace(/(.)\/$/, "$1");
  return PATHS.some((p) => p.test(bare));
}
