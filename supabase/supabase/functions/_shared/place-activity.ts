/**
 * Shape a place's guest activity — Instagram stories, visits, reservations —
 * into the cards the place profile's Reviews tab renders (MESITA-1147).
 *
 * Every mapper here applies guest-to-guest privacy (MESITA-913) before
 * anything leaves the service-role query:
 *
 *   • `privacy_public = false`  → name/handle collapse to "Anonymous guest"
 *   • `privacy_show_visits = false`  → the guest's visits are DROPPED
 *   • `privacy_show_stories = false` → the guest's stories are DROPPED
 *
 * A private account's stories are dropped too, on top of the stories flag: a
 * story screenshot is a picture of that guest's own Instagram, so it carries
 * their handle and often their face. Unlike a name string, it cannot be
 * anonymized — the only safe shaping is not to publish it.
 *
 * Deliberately NOT exposed: bill totals (`total_cents`, `tip_cents`),
 * `consumer_phone` / `place_phone`, and reservation `notes`. Those are
 * operational or financial, and no privacy flag is a licence to publish
 * another guest's spend on a public place page.
 */

import {
  isPrivateAccount,
  publicGuestIdentity,
  storiesVisibleOnMesita,
  visitsVisibleOnMesita,
} from "./consumer-privacy.ts";
import { identityForClassKey } from "./rewards-config.ts";

export type MetalClassKey = "bronze" | "silver" | "gold" | "diamond";

/** Story proof states that count as a verified, publishable story. */
const VERIFIED_STORY = new Set([
  "ai_verified",
  "staff_verified",
  "self_verified",
]);

/** Visit ticket states that mean the guest actually showed up and paid. */
export const COMPLETED_VISIT_STATUSES = ["paid", "approved", "revealed"];

/** Reservation states worth showing as social proof. */
export const FEATURED_RESERVATION_STATUSES = ["confirmed"];

type ConsumerJoin = {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  instagram_handle?: string | null;
  privacy_public?: boolean | null;
  privacy_show_visits?: boolean | null;
  privacy_show_stories?: boolean | null;
  class_key?: string | null;
  instagram_followers_count?: number | null;
};

type GuestFields = {
  name: string;
  handle: string;
  class_key: MetalClassKey;
  followers: number;
};

export type PlaceStoryCard = GuestFields & {
  id: string;
  screenshot_url: string;
  posted_at: string;
  verified: boolean;
};

export type PlaceVisitCard = GuestFields & {
  id: string;
  visited_at: string;
  /** Reward the guest earned, in percent. 0 when the place had no rate. */
  discount_percent: number;
  /** Whether this visit also produced a Mesita review. */
  reviewed: boolean;
};

export type PlaceReservationCard = GuestFields & {
  id: string;
  reserved_at: string;
  party_size: number;
};

function asConsumer(c: unknown): ConsumerJoin {
  if (!c) return {};
  return (Array.isArray(c) ? (c[0] ?? {}) : c) as ConsumerJoin;
}

function classKey(raw: string | null | undefined): MetalClassKey {
  return identityForClassKey(raw).cls;
}

function guestFields(consumer: ConsumerJoin): GuestFields {
  const identity = publicGuestIdentity(consumer);
  const followers = consumer.instagram_followers_count;
  return {
    name: identity.name,
    handle: identity.handle,
    class_key: classKey(consumer.class_key),
    followers: typeof followers === "number" ? followers : 0,
  };
}

type StoryRow = {
  id: string;
  story_status?: string | null;
  story_screenshot_url?: string | null;
  story_submitted_at?: string | null;
  story_verified_at?: string | null;
  created_at?: string | null;
  consumer?: unknown;
};

export function mapStoryTickets(rows: StoryRow[]): PlaceStoryCard[] {
  const cards: PlaceStoryCard[] = [];
  for (const row of rows) {
    const url = (row.story_screenshot_url ?? "").trim();
    if (!url) continue;
    if (!VERIFIED_STORY.has((row.story_status ?? "").toLowerCase())) continue;

    const consumer = asConsumer(row.consumer);
    // Both gates, and the private-account gate is the stricter one: a
    // screenshot cannot be anonymized (see the file header).
    if (!storiesVisibleOnMesita(consumer.privacy_show_stories)) continue;
    if (isPrivateAccount(consumer.privacy_public)) continue;

    cards.push({
      id: row.id,
      ...guestFields(consumer),
      screenshot_url: url,
      posted_at: row.story_submitted_at ?? row.story_verified_at ??
        row.created_at ?? "",
      verified: true,
    });
  }
  return cards;
}

type VisitRow = {
  id: string;
  status?: string | null;
  discount_percent?: number | null;
  paid_at?: string | null;
  validated_at?: string | null;
  created_at?: string | null;
  consumer?: unknown;
};

export function mapVisitTickets(
  rows: VisitRow[],
  reviewedTicketIds: Set<string> = new Set(),
): PlaceVisitCard[] {
  const cards: PlaceVisitCard[] = [];
  for (const row of rows) {
    const consumer = asConsumer(row.consumer);
    if (!visitsVisibleOnMesita(consumer.privacy_show_visits)) continue;

    const pct = row.discount_percent;
    cards.push({
      id: row.id,
      ...guestFields(consumer),
      visited_at: row.paid_at ?? row.validated_at ?? row.created_at ?? "",
      discount_percent: typeof pct === "number" ? pct : 0,
      reviewed: reviewedTicketIds.has(row.id),
    });
  }
  return cards;
}

type ReservationRow = {
  id: string;
  status?: string | null;
  reserved_at?: string | null;
  party_size?: number | null;
  created_at?: string | null;
  consumer?: unknown;
};

export function mapReservationTickets(
  rows: ReservationRow[],
): PlaceReservationCard[] {
  const cards: PlaceReservationCard[] = [];
  for (const row of rows) {
    const consumer = asConsumer(row.consumer);
    // Reservations ride the visits flag: both answer "may other guests see
    // that I go here?". There is no separate reservations toggle, and
    // inventing one silently would be a privacy default nobody chose.
    if (!visitsVisibleOnMesita(consumer.privacy_show_visits)) continue;

    const size = row.party_size;
    cards.push({
      id: row.id,
      ...guestFields(consumer),
      reserved_at: row.reserved_at ?? row.created_at ?? "",
      party_size: typeof size === "number" && size > 0 ? size : 0,
    });
  }
  return cards;
}
