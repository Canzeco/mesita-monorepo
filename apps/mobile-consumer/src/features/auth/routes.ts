// Who may open which root screen. Both layouts render from this table, and
// routes.test.ts walks src/app against it: a screen left out would be open to
// everyone.

export const ROUTE_GROUPS = {
  update: ["update"],
  suspended: ["suspended"],
  onboarding: ["onboarding"],
  everyone: ["(tabs)", "categories", "location", "open", "place", "reserve", "reservations", "social"],
  anonymousOnly: ["sign-in", "welcome"],
  membersOnly: [],
} as const satisfies Record<string, readonly string[]>;

export type RootRoute = (typeof ROUTE_GROUPS)[keyof typeof ROUTE_GROUPS][number];

/** Me's pages behind its own guard: every one but index. */
export const ME_PAGES: readonly string[] = [
  "profile",
  "class",
  "reservations",
  "notifications",
  "tickets",
  "card",
  "plan",
  "share",
  "settings",
  "contact",
  "feedback",
  "refunds",
  "integrations",
  "calendar",
  "vip-code",
  "vip-instagram",
  "vip-agency",
  "delete",
];

/** The addresses a link may open, as patterns. */
const PATHS = [/^\/$/, /^\/search$/, /^\/me$/, /^\/me\/(profile|class|reservations|notifications|tickets|card|plan|share|settings|contact|feedback|refunds|integrations|calendar|vip-code|vip-instagram|vip-agency|delete)$/, /^\/location$/, /^\/open$/, /^\/sign-in$/, /^\/place\/add$/, /^\/place\/[^/]+$/, /^\/place\/[^/]+\/(menu|contact|report|offers)$/, /^\/reserve\/[^/]+$/, /^\/reservations$/, /^\/reservations\/[^/]+$/, /^\/reservations\/[^/]+\/reschedule$/, /^\/social\/person$/, /^\/social\/report$/];

export function isAppPath(path: string): boolean {
  const bare = path.split(/[?#]/)[0].replace(/(.)\/$/, "$1");
  return PATHS.some((p) => p.test(bare));
}
