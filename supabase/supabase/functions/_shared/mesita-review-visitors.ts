/**
 * Shape ticket_reviews (+ consumer join) into the mesita_visitors payload
 * place detail renders. Applies guest-to-guest privacy (MESITA-913) through
 * place-activity.ts's guestFields, so the rule lives in one place.
 */

import {
  asConsumer,
  type ConsumerJoin,
  guestFields,
  type MetalClassKey,
} from "./place-activity.ts";

export type MesitaVisitorCard = {
  name: string;
  handle: string;
  class_key: MetalClassKey;
  community: string;
  followers: number;
  quote: string;
  food: number;
  service: number;
  ambience: number;
  value: number;
};

type ReviewRow = {
  food: number;
  service: number;
  ambience: number;
  value: number | null;
  comments: string | null;
  consumer: ConsumerJoin | ConsumerJoin[] | null;
};

export function mapTicketReviewsToVisitors(
  rows: ReviewRow[],
): MesitaVisitorCard[] {
  return rows.map((row) => {
    const guest = guestFields(asConsumer(row.consumer));
    const value = row.value ??
      Math.round((row.food + row.service + row.ambience) / 3);
    // Field by field, not a spread: this key order is the wire order.
    return {
      name: guest.name,
      handle: guest.handle,
      class_key: guest.class_key,
      community: "",
      followers: guest.followers,
      quote: (row.comments ?? "").trim(),
      food: row.food,
      service: row.service,
      ambience: row.ambience,
      value,
    };
  });
}
