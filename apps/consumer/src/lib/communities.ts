import { useStoredSet } from "@/lib/local-store";

// Communities are the school / campus circles a consumer belongs to — the
// same motif the swipe deck already leans on (Tec, Ibero, Stanford, Harvard…
// in the mock catalog). There is no EF behind them yet, so membership lives
// client-side in localStorage via useStoredSet; the Me page surfaces the
// joined ones on the profile summary and lets the consumer add more from the
// Communities modal. Swap the store for a consumer-web-* EF when the social
// graph lands.

export type Community = {
  id: string;
  name: string;
  /** Short label for tight chips (falls back to `name`). */
  short?: string;
  emoji: string;
  /** One-line descriptor shown in the picker. */
  blurb: string;
};

export const COMMUNITIES: Community[] = [
  { id: "tec", name: "Tec de Monterrey", short: "Tec", emoji: "🎓", blurb: "Monterrey · Campus community" },
  { id: "unam", name: "UNAM", emoji: "🐆", blurb: "Ciudad de México · Campus community" },
  { id: "ibero", name: "Ibero", emoji: "📘", blurb: "Ciudad de México · Campus community" },
  { id: "itam", name: "ITAM", emoji: "📐", blurb: "Ciudad de México · Campus community" },
  { id: "anahuac", name: "Anáhuac", emoji: "🦅", blurb: "Campus community" },
  { id: "udg", name: "UDG", emoji: "🐺", blurb: "Guadalajara · Campus community" },
  { id: "udem", name: "UDEM", emoji: "🌿", blurb: "Monterrey · Campus community" },
  { id: "lasalle", name: "La Salle", emoji: "⭐", blurb: "Campus community" },
  { id: "stanford", name: "Stanford", emoji: "🌲", blurb: "California · Campus community" },
  { id: "harvard", name: "Harvard", emoji: "🎓", blurb: "Cambridge · Campus community" },
];

export const COMMUNITY_BY_ID: Record<string, Community> = Object.fromEntries(
  COMMUNITIES.map((c) => [c.id, c]),
);

const COMMUNITIES_KEY = "mesita:communities";

// Joined-community ids + a toggle, SSR-safe. Returns the resolved Community
// objects for the joined ids (order follows the canonical list) alongside the
// raw id set + toggle so callers can render chips or drive the picker.
export function useCommunities(): {
  joinedIds: string[];
  joined: Community[];
  toggle: (id: string) => void;
  isJoined: (id: string) => boolean;
} {
  const [joinedIds, toggle] = useStoredSet(COMMUNITIES_KEY);
  const joined = COMMUNITIES.filter((c) => joinedIds.includes(c.id));
  return {
    joinedIds,
    joined,
    toggle,
    isJoined: (id: string) => joinedIds.includes(id),
  };
}
