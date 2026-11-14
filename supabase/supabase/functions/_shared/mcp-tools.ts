// The Mesita MCP connector's tools (MESITA-3971). Reads only: a booking
// phones a real restaurant, so it stays in the app until its own issue.
//
//   search_places         Mesita's places by name, kind, city or area
//   get_place             one place: hours, address, phone, links
//   list_my_reservations  the token owner's tables, upcoming or past
//
// Places come through the anon client, so the same RLS that decides the
// app's catalog decides what an assistant sees. Reservations come through
// the service role, filtered to the token's guest.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { ToolResult, ToolSpec } from "./mcp-rpc.ts";
import { attachPlaces } from "./reservation-places.ts";
import { PASSED_GRACE_MS } from "./reservation-doc.ts";
import { zoneDay, zoneTime } from "./local-time.ts";
import { isReservable, RESERVABLE_COLUMNS } from "./place-reservable.ts";
import { isUuid } from "./place-id.ts";

const APP = "https://mesita.ai";

export const MCP_TOOLS: ToolSpec[] = [
  {
    name: "search_places",
    title: "Search Mesita places",
    description:
      "Find restaurants, bars and cafés on Mesita by name, kind of food, city or neighbourhood. Returns up to 10 places with their id, category, area, rating and Mesita link.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Words to look for, e.g. 'sushi', 'Pujol', 'Polanco'.",
        },
        city: {
          type: "string",
          description: "Optional city, e.g. 'Monterrey'.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_place",
    title: "Open a Mesita place",
    description:
      "One place's details: address, opening hours, phone, price level, rating, description, whether it takes reservations through Mesita, and its links.",
    inputSchema: {
      type: "object",
      properties: {
        place_id: { type: "string", description: "The id from search_places." },
      },
      required: ["place_id"],
    },
  },
  {
    name: "list_my_reservations",
    title: "My Mesita reservations",
    description:
      "The user's own Mesita reservations: place, local date and time, party size, status and reference code.",
    inputSchema: {
      type: "object",
      properties: {
        scope: {
          type: "string",
          enum: ["upcoming", "past"],
          description: "Defaults to upcoming.",
        },
      },
    },
  },
];

const SEARCH_COLUMNS =
  "id, name, category_label, city, zone, address, price_level, google_stars_overall, google_review_count";

/** Words safe inside a PostgREST or() ilike: no separators, no wildcards. */
export function searchWords(raw: unknown): string {
  return typeof raw === "string"
    ? raw.replace(/[,()%_*\\:."']/g, " ").replace(/\s+/g, " ").trim().slice(
      0,
      80,
    )
    : "";
}

const placeUrl = (id: string) => `${APP}/place/${id}`;

function lines(...xs: Array<string | null | undefined | false>): string {
  return xs.filter(Boolean).join("\n");
}

async function searchPlaces(
  anon: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const q = searchWords(args.query);
  if (!q) return { text: "Give me something to look for.", isError: true };
  const city = searchWords(args.city);
  const fields = ["name", "category_label", "zone", "city", "address"];
  let req = anon
    .from("profiles")
    .select(SEARCH_COLUMNS)
    .or(fields.map((f) => `${f}.ilike.*${q}*`).join(","))
    .order("google_review_count", { ascending: false, nullsFirst: false })
    .limit(10);
  if (city) req = req.ilike("city", `%${city}%`);
  const { data, error } = await req;
  if (error) throw new Error(error.message);
  const places = (data ?? []).map((p) => ({
    id: p.id as string,
    name: p.name as string | null,
    category: p.category_label as string | null,
    area: [p.zone, p.city].filter(Boolean).join(", ") || null,
    rating: p.google_stars_overall as number | null,
    reviews: p.google_review_count as number | null,
    price_level: p.price_level as number | null,
    url: placeUrl(p.id as string),
  }));
  if (!places.length) {
    return { text: `No Mesita places match "${q}".`, data: { places } };
  }
  const text = places
    .map((p) =>
      `• ${p.name ?? "Unnamed"} — ${
        [p.category, p.area].filter(Boolean).join(" · ")
      }` +
      (p.rating ? ` · ★${p.rating} (${p.reviews ?? 0})` : "") +
      `\n  id: ${p.id} · ${p.url}`
    )
    .join("\n");
  return { text, data: { places } };
}

async function getPlace(
  anon: SupabaseClient,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const id = args.place_id;
  if (!isUuid(id)) {
    return {
      text: "place_id must be an id from search_places.",
      isError: true,
    };
  }
  const { data: p, error } = await anon
    .from("profiles")
    .select(
      `${SEARCH_COLUMNS}, phone, hours, timezone, website_url, instagram_url, google_maps_url, description, pitch, ${RESERVABLE_COLUMNS}`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!p) return { text: "Mesita has no place with that id.", isError: true };
  const place = {
    id: p.id,
    name: p.name,
    category: p.category_label,
    address: p.address,
    area: [p.zone, p.city].filter(Boolean).join(", ") || null,
    phone: p.phone,
    hours: p.hours,
    timezone: p.timezone,
    price_level: p.price_level,
    rating: p.google_stars_overall,
    reviews: p.google_review_count,
    description: p.description ?? p.pitch ?? null,
    reservations_through_mesita: isReservable(p),
    website: p.website_url,
    instagram: p.instagram_url,
    google_maps: p.google_maps_url,
    url: placeUrl(p.id as string),
  };
  const text = lines(
    `${place.name ?? "Unnamed"} — ${place.category ?? ""}`,
    place.address && `Address: ${place.address}`,
    place.phone && `Phone: ${place.phone}`,
    place.rating && `Rating: ★${place.rating} (${place.reviews ?? 0} reviews)`,
    place.price_level && `Price: ${"$".repeat(Number(place.price_level))}`,
    place.description && `About: ${place.description}`,
    place.hours &&
      `Hours (${place.timezone ?? "local"}): ${JSON.stringify(place.hours)}`,
    `Reservations through Mesita: ${
      place.reservations_through_mesita ? "yes, book in the Mesita app" : "no"
    }`,
    `Mesita: ${place.url}`,
  );
  return { text, data: { place } };
}

const STATE_WORDS: Record<string, string> = {
  pending: "waiting for the place",
  confirmed: "confirmed",
  declined: "declined by the place",
  cancelled: "cancelled",
  unreachable: "couldn't book (no answer)",
  unresolved: "couldn't book",
};

async function listMyReservations(
  admin: SupabaseClient,
  consumerId: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const past = args.scope === "past";
  const cutoff = new Date(Date.now() - PASSED_GRACE_MS).toISOString();
  let q = admin
    .from("reservation_tickets")
    .select("id, reserved_at, party_size, state, reference_code, place_id")
    .eq("consumer_id", consumerId)
    .eq("is_test", false)
    .order("reserved_at", { ascending: !past })
    .limit(25);
  q = past
    ? q.or(
      `state.in.(declined,cancelled,unreachable,unresolved),and(state.in.(pending,confirmed),reserved_at.lt.${cutoff})`,
    )
    : q.in("state", ["pending", "confirmed"]).gte("reserved_at", cutoff);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = await attachPlaces(admin, data ?? []);
  const reservations = rows.map((r) => {
    const at = new Date(r.reserved_at as string);
    const zone = r.place?.timezone ?? "America/Mexico_City";
    const passed = r.state === "confirmed" && past;
    return {
      id: r.id,
      place: r.place?.name ?? null,
      address: r.place?.address ?? null,
      date: zoneDay(at, zone),
      time: zoneTime(at, zone),
      party_size: r.party_size,
      status: passed ? "passed" : (STATE_WORDS[r.state as string] ?? r.state),
      reference_code: r.reference_code,
      url: `${APP}/reservation/${r.id}`,
    };
  });
  if (!reservations.length) {
    return {
      text: past
        ? "No past Mesita reservations."
        : "No upcoming Mesita reservations.",
      data: { reservations },
    };
  }
  const text = reservations
    .map((r) =>
      `• ${r.date} ${r.time} — ${r.place ?? "a place"}, ${
        r.party_size ?? "?"
      } people · ${r.status}` +
      (r.reference_code ? ` · ref ${r.reference_code}` : "")
    )
    .join("\n");
  return { text, data: { reservations } };
}

export function mcpToolRunner(
  anon: SupabaseClient,
  admin: SupabaseClient,
  consumerId: string,
) {
  return (name: string, args: Record<string, unknown>): Promise<ToolResult> => {
    switch (name) {
      case "search_places":
        return searchPlaces(anon, args);
      case "get_place":
        return getPlace(anon, args);
      case "list_my_reservations":
        return listMyReservations(admin, consumerId, args);
      default:
        return Promise.resolve({ text: `Unknown tool ${name}`, isError: true });
    }
  };
}
