/**
 * Shape ticket_reviews (+ consumer join) into the mesita_visitors payload
 * place detail renders. Applies guest-to-guest privacy (MESITA-913).
 */

import { publicGuestIdentity } from "./consumer-privacy.ts";

const CLASS_KEYS = new Set(["standard", "premium", "influencer", "aura"]);

export type MesitaVisitorCard = {
  name: string;
  handle: string;
  class_key: "standard" | "premium" | "influencer" | "aura";
  community: string;
  followers: number;
  quote: string;
  food: number;
  service: number;
  ambiance: number;
  value: number;
};

type ConsumerJoin = {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  instagram_handle?: string | null;
  profile_public?: boolean | null;
  class_key?: string | null;
  consumer_instagram_followers_count?: number | null;
};

type ReviewRow = {
  food: number;
  service: number;
  ambiance: number;
  value: number | null;
  comments: string | null;
  consumer: ConsumerJoin | ConsumerJoin[] | null;
};

function asConsumer(c: ReviewRow["consumer"]): ConsumerJoin {
  if (!c) return {};
  return Array.isArray(c) ? (c[0] ?? {}) : c;
}

function classKey(
  raw: string | null | undefined,
): MesitaVisitorCard["class_key"] {
  const k = (raw ?? "standard").toLowerCase();
  return CLASS_KEYS.has(k)
    ? (k as MesitaVisitorCard["class_key"])
    : "standard";
}

export function mapTicketReviewsToVisitors(
  rows: ReviewRow[],
): MesitaVisitorCard[] {
  return rows.map((row) => {
    const consumer = asConsumer(row.consumer);
    const identity = publicGuestIdentity(consumer);
    const followers = consumer.consumer_instagram_followers_count;
    const value = row.value ??
      Math.round((row.food + row.service + row.ambiance) / 3);
    return {
      name: identity.name,
      handle: identity.handle,
      class_key: classKey(consumer.class_key),
      community: "",
      followers: typeof followers === "number" ? followers : 0,
      quote: (row.comments ?? "").trim(),
      food: row.food,
      service: row.service,
      ambiance: row.ambiance,
      value,
    };
  });
}
