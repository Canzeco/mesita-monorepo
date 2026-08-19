// Supabase Edge Function — consumer-web-get-discount-quote
//
// The guest's REAL reward breakdown for one place, straight from the live
// engine config. Exists because the consumer app used to compute its own
// numbers from a static v6 best-of table (`reward-segments.ts`), which stopped
// matching the bill the moment v10 additive shipped (MESITA-992): the sheet
// quoted a single best-of rung while the bill pays base + welcome + every
// earned bonus. Standard guests were quoted 5pt–15pt low and Influencers up to
// 40pt low, because `bonuses.story_influencer` had no consumer-side concept at
// all.
//
// Returns COMPONENTS, not one number, so the picker can show the guest what
// each action adds and keep a running total that matches the till. Every value
// is resolved with the same helpers the bill EFs use (loadRewardsGrid,
// placeStrategy, isConsumerFirstVisit) so a quote can never drift from the
// bill it is promising.
//
// Blended-rate privacy is preserved: this is the CALLER's own rate, returned
// to the caller. Nothing here is reachable by a business.
//
// Caller: consumer. Verb: get. Noun: discount-quote.
//
// Body:     { placeId: string }
// Response: { ok: true, quote: RewardQuote } | { ok: false, error, code? }

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
import { isConsumerFirstVisit } from "../_shared/membership.ts";
import {
  CLASS_SEGMENTS,
  identityForClassKey,
  isClassSegment,
  loadRewardsGrid,
  offersAction,
  placeStrategy,
  type ClassSegment,
} from "../_shared/rewards-config.ts";

type Body = { placeId?: string; projectId?: string };

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

  const placeId = readPlaceIdAlias(bodyRes.body);
  if (!placeId) return json({ ok: false, error: "placeId is required" }, 400);

  const admin = adminClient(envRes.env);

  // The v4 rate columns live on `projects`, never on `places` (places.id ==
  // projects.id). They carry strategy IDENTITY, not price — the price comes
  // from the v10 config below.
  const placeRes = await admin
    .from("projects")
    .select(
      "id, free_rate, premium_rate, welcome_free_rate, welcome_premium_rate, monthly_promo_cap",
    )
    .eq("id", placeId)
    .maybeSingle();
  if (placeRes.error) {
    return json({ ok: false, error: placeRes.error.message }, 500);
  }
  if (!placeRes.data) return json({ ok: false, error: "Place not found" }, 404);

  const consumerRes = await admin
    .from("consumers")
    .select("id, class_key, instagram_handle")
    .eq("id", consumerId)
    .maybeSingle();
  if (consumerRes.error || !consumerRes.data) {
    return json({ ok: false, error: "Consumer not found" }, 404);
  }

  const place = placeRes.data as Record<string, unknown>;
  const strategy = placeStrategy(place);
  const [grid, isFirstVisit] = await Promise.all([
    loadRewardsGrid(admin),
    isConsumerFirstVisit(admin, consumerId, placeId),
  ]);

  // The CAP the till will actually honour (MESITA-1087): the place's own
  // monthly_promo_cap when set, else the platform fallback — the same
  // resolveBillCapPesos the bill EFs use. Quoting grid.cap alone printed the
  // fallback at places with their own knob, and a quoted cap the till
  // disagrees with is the MESITA-1017 failure class.
  const capPesos = resolveBillCapPesos(place, grid.cap);

  const rawClass = consumerRes.data.class_key;
  // Same generic resolution the engine uses: an unknown/legacy class key
  // prices as standard rather than erroring or leaking that it was unknown.
  const classKey = isClassSegment(rawClass) ? rawClass : "standard";
  const igConnected = Boolean(
    (consumerRes.data.instagram_handle ?? "").toString().trim(),
  );

  const promos = grid.promos;

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
  const ladder = Object.fromEntries(
    CLASS_SEGMENTS.map((segment) => {
      if (strategy === "zero") return [segment, 0];
      if (!promos) return [segment, grid.grid[segment][strategy]];
      const id = identityForClassKey(segment);
      return [segment, promos.visits.base[strategy][id.cls][id.plan]];
    }),
  ) as Record<ClassSegment, number>;

  // A zero-strategy place runs no program at all — every component is 0 and
  // the client shows the no-discount path rather than a 0% ladder.
  if (strategy === "zero") {
    return json({
      ok: true,
      quote: {
        strategy,
        classKey,
        additive: Boolean(grid.promos),
        isFirstVisit,
        base: 0,
        bonuses: { welcome: 0, story: 0, google: 0, mesita: 0 },
        ladder,
        storyEligible: false,
        cap: capPesos,
      },
    });
  }

  // Legacy best-of fallback (no additive config saved yet). `additive: false`
  // tells the client to keep the pick-one presentation — showing stacked
  // bonuses over a best-of engine would over-promise, which is the one
  // direction of error a discount quote must never make.
  if (!promos) {
    const cls = classKey;
    return json({
      ok: true,
      quote: {
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
        storyEligible:
          igConnected && offersAction(strategy, grid, "story"),
        cap: capPesos,
      },
    });
  }

  // v11 additive — mirrors resolveAdditiveRate component for component. Only
  // the VISITS ladder is quoted: orders is parked, and every ticket today is
  // a visit. The per-class story override is gone with the `influencer`
  // class; class is paid for once, in the base.
  const { cls, plan } = identityForClassKey(classKey);
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
    plan,
    planUplift: visitsBase[cls].premium - visitsBase[cls].free,
  };

  return json({
    ok: true,
    quote: {
      strategy,
      classKey,
      additive: true,
      isFirstVisit,
      breakdown,
      base: promos.visits.base[strategy][cls][plan],
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
    },
  });
});
