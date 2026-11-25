import { z } from "zod";

import { callEdge } from "@/lib/edge";

const text = z.string().nullish().catch(null);

export type FeedItem = {
  placeId: string;
  kind: "saved" | "viewed";
  at: string;
  name: string;
  placeName: string;
};

const itemSchema = z
  .object({
    placeId: z.string(),
    kind: z.enum(["saved", "viewed"]).catch("viewed"),
    at: z.string(),
    person: z.object({ name: text }).nullish().catch(null),
    place: z.object({ name: text }).nullish().catch(null),
  })
  .transform(
    (row): FeedItem => ({
      placeId: row.placeId,
      kind: row.kind,
      at: row.at,
      name: row.person?.name ?? "Guest",
      placeName: row.place?.name ?? "A place",
    }),
  );

export type FeedPage = { items: FeedItem[]; next: string | null; blocked: string | null };

export function listFeed(point: { lat: number; lng: number } | null, before?: string, signal?: AbortSignal): Promise<FeedPage> {
  return callEdge(
    "consumer-web-list-activity",
    { ...(point ? { lat: point.lat, lng: point.lng } : {}), ...(before ? { before } : {}) },
    z.object({
      items: z.array(itemSchema).catch([]),
      next: text,
      blocked: text,
    }),
    { signal },
  ).then((answer) => ({ items: answer.items, next: answer.next ?? null, blocked: answer.blocked ?? null }));
}

export type Person = { name: string; history: { placeId: string; kind: string; at: string; placeName: string }[] };

export function getPerson(event: { placeId: string; kind: string; at: string }, signal?: AbortSignal): Promise<Person | null> {
  return callEdge(
    "consumer-web-get-person",
    { place_id: event.placeId, kind: event.kind, at: event.at, first: 12 },
    z.object({
      person: z.object({ name: text }).nullish().catch(null),
      items: z
        .array(
          z.object({
            placeId: z.string(),
            kind: text,
            at: text,
            place: z.object({ name: text }).nullish().catch(null),
          }),
        )
        .catch([]),
    }),
    { signal },
  ).then((answer) =>
    answer.person
      ? {
          name: answer.person.name ?? "Guest",
          history: answer.items.map((item) => ({
            placeId: item.placeId,
            kind: item.kind ?? "",
            at: item.at ?? "",
            placeName: item.place?.name ?? "A place",
          })),
        }
      : null,
  );
}

export const REPORT_REASONS = [
  { key: "harassment", label: "Harassment" },
  { key: "spam", label: "Spam" },
  { key: "inappropriate", label: "Inappropriate" },
  { key: "other", label: "Something else" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["key"];

export async function reportPerson(event: { placeId: string; kind: string; at: string }, reason: ReportReason, note: string): Promise<void> {
  const trimmed = note.trim();
  await callEdge(
    "consumer-web-report-person",
    { place_id: event.placeId, kind: event.kind, at: event.at, reason, ...(trimmed ? { note: trimmed } : {}) },
    z.object({}),
    { mutation: true },
  );
}

export async function blockPerson(event: { placeId: string; kind: string; at: string }): Promise<void> {
  await callEdge(
    "consumer-web-block-person",
    { place_id: event.placeId, kind: event.kind, at: event.at },
    z.object({}),
    { mutation: true },
  );
}
