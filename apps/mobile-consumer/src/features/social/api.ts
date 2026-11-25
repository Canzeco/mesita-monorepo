import { z } from "zod";

import { callEdge } from "@/lib/edge";

const text = z.string().nullish().catch(null);

export type FeedItem = {
  placeId: string;
  kind: "saved" | "viewed";
  at: string;
  name: string;
  avatarUrl: string | null;
  age: number | null;
  sex: "female" | "male" | "other" | null;
  vip: boolean;
  placeName: string;
  photo: string | null;
  distanceKm: number | null;
};

const sex = z.enum(["female", "male", "other"]).nullish().catch(null);

const itemSchema = z
  .object({
    placeId: z.string(),
    kind: z.enum(["saved", "viewed"]).catch("viewed"),
    at: z.string(),
    distanceKm: z.number().nullish().catch(null),
    person: z
      .object({
        name: text,
        avatarUrl: text,
        age: z.number().nullish().catch(null),
        sex,
        guestClass: z.enum(["regular", "vip"]).nullish().catch(null),
      })
      .nullish()
      .catch(null),
    place: z
      .object({
        name: text,
        photos: z.array(z.string()).catch([]),
        googleOnly: z.boolean().nullish().catch(null),
        from_google: z.boolean().nullish().catch(null),
      })
      .nullish()
      .catch(null),
  })
  .transform((row): FeedItem => {
    const google = row.place?.googleOnly === true || row.place?.from_google === true;
    return {
      placeId: row.placeId,
      kind: row.kind,
      at: row.at,
      name: row.person?.name ?? "Guest",
      avatarUrl: row.person?.avatarUrl ?? null,
      age: row.person?.age ?? null,
      sex: row.person?.sex ?? null,
      vip: row.person?.guestClass === "vip",
      placeName: row.place?.name ?? "A place",
      photo: google ? null : (row.place?.photos[0] ?? null),
      distanceKm: row.distanceKm ?? null,
    };
  });

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

export type Person = {
  name: string;
  avatarUrl: string | null;
  age: number | null;
  sex: "female" | "male" | "other" | null;
  vip: boolean;
  handle: string | null;
  history: { placeId: string; kind: string; at: string; placeName: string; photo: string | null }[];
};

export function getPerson(event: { placeId: string; kind: string; at: string }, signal?: AbortSignal): Promise<Person | null> {
  return callEdge(
    "consumer-web-get-person",
    { place_id: event.placeId, kind: event.kind, at: event.at, first: 12 },
    z.object({
      person: z
        .object({
          name: text,
          avatarUrl: text,
          age: z.number().nullish().catch(null),
          sex,
          guestClass: z.enum(["regular", "vip"]).nullish().catch(null),
          handle: text,
        })
        .nullish()
        .catch(null),
      items: z
        .array(
          z.object({
            placeId: z.string(),
            kind: text,
            at: text,
            place: z
              .object({
                name: text,
                photos: z.array(z.string()).catch([]),
                googleOnly: z.boolean().nullish().catch(null),
                from_google: z.boolean().nullish().catch(null),
              })
              .nullish()
              .catch(null),
          }),
        )
        .catch([]),
    }),
    { signal },
  ).then((answer) =>
    answer.person
      ? {
          name: answer.person.name ?? "Guest",
          avatarUrl: answer.person.avatarUrl ?? null,
          age: answer.person.age ?? null,
          sex: answer.person.sex ?? null,
          vip: answer.person.guestClass === "vip",
          handle: answer.person.handle ?? null,
          history: answer.items.map((item) => {
            const google = item.place?.googleOnly === true || item.place?.from_google === true;
            return {
              placeId: item.placeId,
              kind: item.kind ?? "",
              at: item.at ?? "",
              placeName: item.place?.name ?? "A place",
              photo: google ? null : (item.place?.photos[0] ?? null),
            };
          }),
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
