// Supabase Edge Function — consumer-web-get-discount-quote
//
// The guest's REAL reward breakdown for one place — or for a whole surface of
// them — straight from the live engine config. Exists because the consumer app
// used to compute its own numbers from a static v6 best-of table
// (`reward-segments.ts`), which stopped matching the bill the moment v10
// additive shipped (MESITA-992): the sheet quoted a single best-of rung while
// the bill pays base + welcome + every earned bonus. Standard guests were
// quoted 5pt–15pt low and Influencers up to 40pt low, because
// `bonuses.story_influencer` had no consumer-side concept at all.
//
// Returns COMPONENTS, not one number, so the picker can show the guest what
// each action adds and keep a running total that matches the till. Every value
// is resolved with the same helpers the bill EFs use (loadRewardsGrid,
// placeStrategy, isConsumerFirstVisit) so a quote can never drift from the
// bill it is promising.
//
// BATCH (MESITA-1019): `placeIds` quotes many places in one round trip. The
// promo chip renders on four surfaces — swipe card, favorites tile, catalog
// tile, place-detail header — and every one of them was reading the four v4
// rate columns as PRICES instead. Those columns carry strategy IDENTITY; the
// price lives in the config below. Routing the chip through the engine is the
// fix, and a per-card call would have made a deck of places a deck of
// requests. The batch changes nothing about how a quote is computed: it loads
// the grid and the consumer once (it already did), reads the place rows with
// one `in`, and resolves first-visit for the whole set with one query.
//
// Blended-rate privacy is preserved: this is the CALLER's own rate, returned
// to the caller. Nothing here is reachable by a business.
//
// Caller: consumer. Verb: get. Noun: discount-quote.
//
// Body:     { placeId: string } | { placeIds: string[] }
// Response: { ok: true, quote: RewardQuote }                    (placeId)
//           { ok: true, quotes: Record<placeId, RewardQuote> }  (placeIds)
//           { ok: false, error, code? }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsPreflight,
  json,
  readJson,
  readPlaceIdAlias,
  rejectUnlessMethods,
} from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { resolveBillCapPesos } from "../_shared/discount-cap.ts";
import { consumerVisitedPlaceIds } from "../_shared/membership.ts";
import {
  CLASS_SEGMENTS,
  identityForClassKey,
  isClassSegment,
  loadRewardsGrid,
  offersAction,
  placeStrategy,
  type ClassSegment,
} from "../_shared/rewards-config.ts";

type Body = { placeId?: string; projectId?: string; placeIds?: unknown };

// A deck is the widest caller (the swipe deck ships a random sample); this is
// comfortably above it and bounds the `in` list. Over the cap is an explicit
// 400 rather than a silent truncation — a chip missing from a half-served
// batch renders as "no reward", which is a wrong answer wearing a right one.
const MAX_BATCH = 100;

function readPlaceIds(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const seen = new Set<string>();
  for (const v of raw) {
    if (typeof v === "string" && v.trim() !== "") seen.add(v.trim());
  }
  return [...seen];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;
  const consumerId = authRes.user.id;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;

  const batchIds = readPlaceIds(bodyRes.body.placeIds);
  const singleId = readPlaceIdAlias(bodyRes.body);
  if (batchIds === null && !singleId) {
    return json({ ok: false, error: "placeId or placeIds is required" }, 400);
  }
  if (batchIds !== null && batchIds.length > MAX_BATCH) {
    return json(
      { ok: false, error: `placeIds accepts at most ${MAX_BATCH} ids` },
      400,
    );
  }
  const ids = batchIds ?? [singleId];

  const admin = adminClient(envRes.env);

  // The v4 rate columns live on `projects`, never on `places` (places.id ==
  // projects.id). They carry strategy IDENTITY, not price — the price comes
  // from the v11 config below.
  const placeRes = await admin
    .from("projects")
    .select(
      "id, free_rate, premium_rate, welcome_free_rate, welcome_premium_rate, monthly_promo_cap",
    )
    .in("id", ids);
  if (placeRes.error) {
    return json({ ok: false, error: placeRes.error.message }, 500);
  }
  const places = (placeRes.data ?? []) as Record<string, unknown>[];

  // A single-place caller still gets its 404: it asked about one place and an
  // empty map would read as "no reward here". A batch drops unknown ids
  // instead — a deck outliving a deleted place is ordinary.
  if (batchIds === null && places.length === 0) {
    return json({ ok: false, error: "Place not found" }, 404);
  }

  const consumerRes = await admin
    .from("consumers")
    .select("id, class_key, plan, instagram_handle")
    .eq("id", consumerId)
    .maybeSingle();
  if (consumerRes.error || !consumerRes.data) {
    return json({ ok: false, error: "Consumer not found" }, 404);
  }

  const [grid, visited] = await Promise.all([
    loadRewardsGrid(admin),
    consumerVisitedPlaceIds(
      admin,
      consumerId,
      places.map((p) => String(p.id)),
    ),
  ]);

  const { cls: classKey, plan } = identityForClassKey(
    consumerRes.data.class_key,
    consumerRes.data.plan as "free" | "premium" | null,
  );
  const igConnected = Boolean(
    (consumerRes.data.instagram_handle ?? "").toString().trim(),
  );

  const promos = grid.promos;

  function quoteFor(place: Record<string, unknown>) {
    const strategy = placeStrategy(place);
    const isFirstVisit = !visited.has(String(place.id));

    // The CAP the till will actually honour (MESITA-1087): the place's own
    // monthly_promo_cap when set, else the platform fallback — the same
    // resolveBillCapPesos the bill EFs use. Quoting grid.cap alone printed the
    // fallback at places with their own knob, and a quoted cap the till
    // disagrees with is the MESITA-1017 failure class.
    const capPesos = resolveBillCapPesos(place, grid.cap);

    // EVERY class's standing rate at this place, not just the caller's
    // (MESITA-1068). The place-detail Rewards tab shows the whole ladder so a
    // guest can see what the classes above them are worth here — and it has to
    // come from the SAME live config that prices the bill. The consumer app
    // owns a static `CLASS_STEP` ladder (+5/+10/+15) that could reproduce these
    // numbers arithmetically, and that is precisely the drift MESITA-1017 was:
    // a client table quoting rates the till doesn't honor. Reading them here
    // costs nothing — the grid is already loaded for the caller's own quote.
    //
    // Blended-rate privacy is untouched: this is the program's public shape
    // (the same ladder the pricing page states), not any other guest's data,
    // and nothing here is reachable by a business.
    //
    // The rung is still keyed by the LEGACY class segment, because that is what
    // `consumers.class_key` stores and what the client renders. Under v11 each
    // one resolves through identityForClassKey to its (class, plan) cell of the
    // visits grid — so the legacy `premium` rung correctly prices the PLAN.
    // Metals are the live keys. Legacy aliases stay on the wire so frozen
    // clients that still read ladder.standard / ladder.premium keep working.
    // `premium` is the PLAN cell (bronze·premium), not Gold.
    const metalLadder = Object.fromEntries(
      CLASS_SEGMENTS.map((segment) => {
        if (strategy === "zero") return [segment, 0];
        if (!promos) return [segment, grid.grid[segment][strategy]];
        const id = identityForClassKey(segment);
        return [segment, promos.visits.base[strategy][id.cls][id.plan]];
      }),
    ) as Record<ClassSegment, number>;
    const ladder = {
      ...metalLadder,
      standard: metalLadder.bronze,
      influencer: metalLadder.silver,
      premium: strategy === "zero"
        ? 0
        : promos
        ? promos.visits.base[strategy].bronze.premium
        : metalLadder.gold,
      aura: metalLadder.diamond,
    };

    // A zero-strategy place runs no program at all — every component is 0 and
    // the client shows the no-discount path rather than a 0% ladder.
    if (strategy === "zero") {
      return {
        strategy,
        classKey,
        additive: Boolean(grid.promos),
        isFirstVisit,
        base: 0,
        bonuses: { welcome: 0, story: 0, google: 0, mesita: 0 },
        ladder,
        storyEligible: false,
        cap: capPesos,
      };
    }

    // Legacy best-of fallback (no additive config saved yet). `additive: false`
    // tells the client to keep the pick-one presentation — showing stacked
    // bonuses over a best-of engine would over-promise, which is the one
    // direction of error a discount quote must never make.
    if (!promos) {
      const cls = isClassSegment(classKey) ? classKey : "bronze";
      return {
        strategy,
        classKey,
        additive: false,
        isFirstVisit,
        base: grid.grid[cls][strategy],
        bonuses: {
          welcome: grid.actions.welcome[cls][strategy],
          story: grid.actions.story[cls][strategy],
          google: grid.actions.review[cls][strategy],
          mesita: grid.actions.mesita_review[cls][strategy],
        },
        ladder,
        storyEligible: igConnected && offersAction(strategy, grid, "story"),
        cap: capPesos,
      };
    }

    // v11 additive — mirrors resolveAdditiveRate component for component. Only
    // the VISITS ladder is quoted: orders is parked, and every ticket today is
    // a visit. The per-class story override is gone with the `influencer`
    // class; class is paid for once, in the base.
    const { cls, plan: resolvedPlan } = identityForClassKey(classKey, plan);
    const b = promos.visits.bonuses[strategy];

    // THE TICKET v4's Reward step (MESITA-1089) renders the base as LANES —
    // automatic floor · class · plan — so the guest sees what each axis of
    // their identity adds. The decomposition is derived from the SAME grid the
    // bill pays: automatic = the bronze·free floor everyone gets; a class chip
    // = that class's free-plan rate over the floor; the plan uplift = the
    // caller's own premium delta. Sums reproduce base exactly by construction.
    // Consumer-side only — the classes ladder is the program's public shape,
    // and blended-rate privacy (business never learns class) is untouched.
    const visitsBase = promos.visits.base[strategy];
    const automatic = visitsBase.bronze.free;
    const breakdown = {
      automatic,
      classes: {
        bronze: visitsBase.bronze.free - automatic,
        silver: visitsBase.silver.free - automatic,
        gold: visitsBase.gold.free - automatic,
        diamond: visitsBase.diamond.free - automatic,
      },
      cls,
      plan: resolvedPlan,
      planUplift: visitsBase[cls].premium - visitsBase[cls].free,
    };

    return {
      strategy,
      classKey,
      additive: true,
      isFirstVisit,
      breakdown,
      base: promos.visits.base[strategy][cls][resolvedPlan],
      bonuses: {
        // Welcome is a state of the visit, not an action the guest picks, so
        // it reports 0 once they've been here before — the client renders it
        // as an automatic row, never as a choice.
        welcome: isFirstVisit ? b.welcome : 0,
        story: b.story,
        google: b.google,
        mesita: b.mesita,
      },
      ladder,
      storyEligible: igConnected && offersAction(strategy, grid, "story"),
      cap: capPesos,
    };
  }

  if (batchIds === null) {
    return json({ ok: true, quote: quoteFor(places[0]) });
  }

  const quotes: Record<string, ReturnType<typeof quoteFor>> = {};
  for (const place of places) quotes[String(place.id)] = quoteFor(place);
  return json({ ok: true, quotes });
});
