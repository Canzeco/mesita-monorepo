// The four acceptance INTENT BITS (Pato gates 2026-08-29), and the one write
// that sets them: place_profiles.mesita_pay_enabled · credits_enabled ·
// pickup_orders_enabled · delivery_orders_enabled.
//
// TWO DOORS, ONE BODY (MESITA-1736). The bits are the OPERATOR's answer to
// "does this place offer X", so the operator has to be able to write them —
// but `admin-web-set-place-rails` was the only writer and it is
// `requireSuperAdmin`. Live DB 2026-09-10: one super-admin, one org member,
// the same person — so the Capabilities tab worked for the only account that
// had ever opened it and 403'd every switch for customer #1, rendered as
// "Couldn't turn X on. Nothing changed — try again." — a retry that could
// never succeed.
//
// The EF NAME IS THE ACL (root CLAUDE.md), so the answer is a second door,
// not a widened one: `business-web-set-place-rails` (requireEditor) for the
// business console, `admin-web-set-place-rails` (requireSuperAdmin) for the
// admin console. Everything below the guard is this file, so the two can
// never disagree about what a rail is or what the response looks like.
//
// Each rail's ENGINE still gates the rail itself: Mesita Pay ANDs with
// visits_config.payCard + Stripe capability, Credits with
// visits_config.payCredits, orders with the (unbuilt) order rail — a toggle
// here never turns an engine on.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { json, readPlaceIdAlias } from "./http.ts";
import { type PlaceProfilePatch, writePlace } from "./place-doc.ts";

// Body key → place_profiles column. The closed set IS the contract: anything
// else in the body is ignored, and an empty intersection is a 400.
export const RAIL_COLUMNS = {
  mesita_pay: "mesita_pay_enabled",
  credits: "credits_enabled",
  pickup: "pickup_orders_enabled",
  delivery: "delivery_orders_enabled",
} as const;

export type RailKey = keyof typeof RAIL_COLUMNS;

export type RailBody = { placeId?: unknown; projectId?: unknown } & {
  [K in RailKey]?: unknown;
};

/** The place this body names, or a 400 saying it named none. Read before the
 *  guard, because both guards are place-scoped. */
export function readRailPlaceId(
  body: RailBody,
): { ok: true; placeId: string } | { ok: false; response: Response } {
  const placeId = readPlaceIdAlias(body);
  if (!placeId) {
    return { ok: false, response: json({ ok: false, error: "placeId is required" }, 400) };
  }
  return { ok: true, placeId };
}

/**
 * Writes whichever rails the body carries and answers with the POST-WRITE row,
 * so the client reconciles from truth rather than from what it sent.
 *
 * Writes `table: "place_profiles"` through the place-doc door, NEVER profiles:
 * the profiles_update trigger enumerates its SET list, predates these columns
 * and silently drops them (place-doc's PLACE_INTENT_BIT_KEYS refuses the
 * profiles route for exactly that reason).
 */
export async function setPlaceRails(
  admin: SupabaseClient,
  placeId: string,
  body: RailBody,
): Promise<Response> {
  const patch: Record<string, boolean> = {};
  for (const key of Object.keys(RAIL_COLUMNS) as RailKey[]) {
    if (!(key in body)) continue;
    const value = body[key];
    if (typeof value !== "boolean") {
      return json({ ok: false, error: `${key} must be a boolean` }, 400);
    }
    patch[RAIL_COLUMNS[key]] = value;
  }
  if (Object.keys(patch).length === 0) {
    return json(
      {
        ok: false,
        error: "Nothing to set — pass at least one of mesita_pay, credits, pickup, delivery.",
      },
      400,
    );
  }

  const write = await writePlace(admin, {
    table: "place_profiles",
    mode: "update",
    id: placeId,
    patch: patch as PlaceProfilePatch,
    select:
      "mesita_pay_enabled, credits_enabled, pickup_orders_enabled, delivery_orders_enabled",
    selectMode: "maybeSingle",
  });
  if (!write.ok) return json({ ok: false, error: write.error }, 500);
  if (!write.row) return json({ ok: false, error: "Place not found" }, 404);

  return json({
    ok: true,
    rails: {
      mesita_pay: write.row.mesita_pay_enabled === true,
      credits: write.row.credits_enabled === true,
      pickup: write.row.pickup_orders_enabled === true,
      delivery: write.row.delivery_orders_enabled === true,
    },
  });
}
