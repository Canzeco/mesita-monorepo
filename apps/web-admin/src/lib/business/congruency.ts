// Congruency test — is the console CONGRUENT with the agreed spec?
// (Notion 🥇 Scoring, 2026-07-16 + the design conversation that locked it.)
//
// Two kinds of check, deliberately different in severity:
//
//   STRUCTURAL  the code's actual behavior — formulas, clamps, ladders, the
//               merge rules. These can only fail if the model code broke:
//               a failure is a BUG (red).
//   LOCKED      the agreed numbers — encoder dims 1536 (text-embedding-3-
//               small's native size), GP ceiling 10, the RP ladder, SM's
//               argued defaults. These compare the CURRENT form values
//               against the spec: a mismatch is DRIFT (amber) — legal to
//               save, but no longer the model we agreed on.
//
// The card on the Subscores page runs this against the live provider state,
// so dragging a knob shows its drift instantly, before any save.

import {
  APPLICABLE_SOURCES,
  coerceScoringSettings,
  composeFinalDeck,
  DEFAULT_DATA_ACCESS,
  DEFAULT_SCORING_SETTINGS,
  EM_ENCODER,
  emScore,
  fitScore,
  gpScore,
  LANES,
  laneScore,
  MERGE_ROTATION,
  rpScore,
  SUBSCORES,
  TOGGLEABLE_CONTEXT_KEYS,
  CONTEXT_FIELDS,
  whatScore,
  waitScore,
  whereScore,
  xxScore,
  type DeckCandidate,
  type ScoringSettings,
  type SubscoreId,
} from "./scores";

export type CongruencyStatus = "pass" | "drift" | "fail";

export type CongruencyResult = {
  group: "structural" | "locked";
  id: string;
  label: string;
  expected: string;
  actual: string;
  status: CongruencyStatus;
};

const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps;

function structural(
  id: string,
  label: string,
  expected: string,
  actual: string,
  ok: boolean,
): CongruencyResult {
  return { group: "structural", id, label, expected, actual, status: ok ? "pass" : "fail" };
}

function locked(
  id: string,
  label: string,
  expected: string,
  actual: string,
  ok: boolean,
): CongruencyResult {
  return { group: "locked", id, label, expected, actual, status: ok ? "pass" : "drift" };
}

/** Run every congruency check against the given (usually live) settings. */
export function runCongruency(s: ScoringSettings): CongruencyResult[] {
  const out: CongruencyResult[] = [];

  // ── STRUCTURAL — the model's behavior ─────────────────────────────────

  out.push(
    structural(
      "em-mapping",
      "EM = max(0, cos), clamped to [0,1]",
      "em(−0.4)=0 · em(0.7)=0.7 · em(1.2)=1",
      `${emScore(-0.4)} · ${emScore(0.7)} · ${emScore(1.2)}`,
      emScore(-0.4) === 0 && near(emScore(0.7), 0.7) && emScore(1.2) === 1,
    ),
  );

  const w = s.sm.where;
  out.push(
    structural(
      "where-midpoint",
      "where = 0.5 exactly at the tolerance (the slider IS the midpoint)",
      "where(tol, tol) = 0.5",
      whereScore(w.pointTolKm, w.pointTolKm, w.distExp).toFixed(3),
      near(whereScore(w.pointTolKm, w.pointTolKm, w.distExp), 0.5),
    ),
    structural(
      "where-scale-invariance",
      "where is scale-invariant — where(2 km, tol 2) = where(5 km, tol 5)",
      "equal",
      `${whereScore(2, 2, w.distExp).toFixed(3)} vs ${whereScore(5, 5, w.distExp).toFixed(3)}`,
      near(whereScore(2, 2, w.distExp), whereScore(5, 5, w.distExp)),
    ),
    structural(
      "where-missing-geo",
      "unknown distance → where = 1 (never punish missing data)",
      "where(null) = 1",
      String(whereScore(null, w.pointTolKm, w.distExp)),
      whereScore(null, w.pointTolKm, w.distExp) === 1,
    ),
  );

  const wh = s.sm.when;
  const waitFar = waitScore(1000, wh);
  out.push(
    structural(
      "wait-two-plateaus",
      "wait: open now → 1 · far future → the floor, never 0",
      `wait(0)=1 · wait(∞)≈${wh.waitFloor.toFixed(2)}`,
      `${waitScore(0, wh)} · ${waitFar.toFixed(3)}`,
      waitScore(0, wh) === 1 && near(waitFar, wh.waitFloor, 0.01) && waitFar > 0,
    ),
    structural(
      "fit-sufficiency",
      "fit caps at 1 (enough is enough) and halves at half the session",
      `fit(session)=1 · fit(session/2)=0.5`,
      `${fitScore(wh.sessionH, wh)} · ${fitScore(wh.sessionH / 2, wh).toFixed(2)}`,
      fitScore(wh.sessionH, wh) === 1 &&
        fitScore(wh.sessionH * 3, wh) === 1 &&
        near(fitScore(wh.sessionH / 2, wh), 0.5, 0.26), // 30-min grid can shift the half point
    ),
  );

  out.push(
    structural(
      "what-ladder",
      "what: exact 1 · sibling · mismatch · nothing asked 1",
      `1 · ${s.sm.what.sibling.toFixed(2)} · ${s.sm.what.mismatch.toFixed(2)} · 1`,
      `${whatScore("exact", s.sm.what)} · ${whatScore("sibling", s.sm.what).toFixed(2)} · ${whatScore("mismatch", s.sm.what).toFixed(2)} · ${whatScore("none", s.sm.what)}`,
      whatScore("exact", s.sm.what) === 1 &&
        near(whatScore("sibling", s.sm.what), s.sm.what.sibling) &&
        near(whatScore("mismatch", s.sm.what), s.sm.what.mismatch) &&
        whatScore("none", s.sm.what) === 1,
    ),
  );

  const gpCeilingRaw = Math.exp(s.gp.lnCeiling) - 1;
  out.push(
    structural(
      "gp-edges",
      "GP: no reviews → 0 · star mass at the ceiling → 1 · monotone",
      "gp(0)=0 · gp(e^ceiling)=1 · gp(100)<gp(1000)",
      `${gpScore(0, 5, s.gp)} · ${gpScore(gpCeilingRaw / 4.5, 4.5, s.gp).toFixed(2)} · ${gpScore(100, 4.5, s.gp).toFixed(2)}<${gpScore(1000, 4.5, s.gp).toFixed(2)}`,
      gpScore(0, 5, s.gp) === 0 &&
        near(gpScore(Math.ceil(gpCeilingRaw / 4.5), 4.5, s.gp), 1, 0.01) &&
        gpScore(100, 4.5, s.gp) < gpScore(1000, 4.5, s.gp),
    ),
  );

  out.push(
    structural(
      "rp-ladder",
      "RP: posture → its rung · custom/legacy (null) → the zero rung",
      `${s.rp.zero.toFixed(2)} / ${s.rp.conservative.toFixed(2)} / ${s.rp.aggressive.toFixed(2)} / ${s.rp.dominant.toFixed(2)} · null→${s.rp.zero.toFixed(2)}`,
      `${rpScore("zero", s.rp).toFixed(2)} / ${rpScore("conservative", s.rp).toFixed(2)} / ${rpScore("aggressive", s.rp).toFixed(2)} / ${rpScore("dominant", s.rp).toFixed(2)} · ${rpScore(null, s.rp).toFixed(2)}`,
      near(rpScore("zero", s.rp), s.rp.zero) &&
        near(rpScore("dominant", s.rp), s.rp.dominant) &&
        near(rpScore(null, s.rp), s.rp.zero),
    ),
  );

  out.push(
    structural(
      "xx-off-at-zero",
      "XX: control 0 → 1 for EVERY card (off — pure merit) · monotone in U",
      "xx(0.1, 0)=1 · xx(0.9, 0)=1 · xx(0.2,c)≤xx(0.8,c)",
      `${xxScore(0.1, 0)} · ${xxScore(0.9, 0)} · ${xxScore(0.2, s.xx.control).toFixed(3)}≤${xxScore(0.8, s.xx.control).toFixed(3)}`,
      xxScore(0.1, 0) === 1 &&
        xxScore(0.9, 0) === 1 &&
        xxScore(0.2, s.xx.control) <= xxScore(0.8, s.xx.control),
    ),
  );

  const organicParts = LANES.find((l) => l.id === "organic")?.parts.join("·");
  const inorganicParts = LANES.find((l) => l.id === "inorganic")?.parts.join("·");
  const hybridParts = LANES.find((l) => l.id === "hybrid")?.parts.join("·");
  out.push(
    structural(
      "lane-formulas",
      "the three locked lane formulas (EM and SM multiply in every lane)",
      "em·sm·gp·xx / em·sm·rp·xx / em·sm·gp·rp·xx",
      `${organicParts} / ${inorganicParts} / ${hybridParts}`,
      organicParts === "em·sm·gp·xx" &&
        inorganicParts === "em·sm·rp·xx" &&
        hybridParts === "em·sm·gp·rp·xx",
    ),
  );

  const extremes = { em: 1, sm: 1, gp: 1, rp: 1, xx: 1 } as Record<SubscoreId, number>;
  const wild = { em: 7, sm: -2, gp: 0.5, rp: 0.5, xx: 0.5 } as Record<SubscoreId, number>;
  const laneBounds = LANES.every(
    (l) =>
      laneScore(l, extremes) >= 0 &&
      laneScore(l, extremes) <= 1 &&
      laneScore(l, wild) >= 0 &&
      laneScore(l, wild) <= 1,
  );
  out.push(
    structural(
      "lane-bounds",
      "every lane score lands in [0,1], whatever the inputs (clamped)",
      "all lanes ∈ [0,1]",
      laneBounds ? "all lanes ∈ [0,1]" : "out of bounds",
      laneBounds,
    ),
  );

  // Merge: dupes across lanes → first occurrence (rotation order) wins, no
  // backfill, deck ≤ the per-lane counts' sum (MESITA-659).
  const N = 2;
  const cands: DeckCandidate[] = [
    { id: "dupe", scores: { organic: 0.9, inorganic: 0.9, hybrid: 0.9 } },
    { id: "org-only", scores: { organic: 0.8, inorganic: 0, hybrid: 0 } },
    { id: "ino-only", scores: { organic: 0, inorganic: 0.8, hybrid: 0 } },
    { id: "hyb-only", scores: { organic: 0, inorganic: 0, hybrid: 0.8 } },
  ];
  const deck = composeFinalDeck(cands, { organic: N, inorganic: N, hybrid: N });
  const dupeSlot = deck.slots.find((slot) => slot.id === "dupe");
  const mergedAwayTotal = LANES.reduce((sum, l) => sum + deck.fills[l.id].mergedAway, 0);
  out.push(
    structural(
      "merge-rules",
      "merge: rotation O→I→H · dedupe keeps the FIRST occurrence · no backfill · deck ≤ 3N",
      `rotation organic→inorganic→hybrid · dupe kept by organic · ≤ ${3 * N} slots · 2 merged away`,
      `rotation ${MERGE_ROTATION.join("→")} · dupe kept by ${dupeSlot?.laneId ?? "?"} · ${deck.slots.length} slots · ${mergedAwayTotal} merged away`,
      MERGE_ROTATION.join(",") === "organic,inorganic,hybrid" &&
        dupeSlot?.laneId === "organic" &&
        deck.slots.length <= 3 * N &&
        mergedAwayTotal === 2,
    ),
  );

  out.push(
    structural(
      "subscore-set",
      "exactly five subscores — EM · SM · GP · RP · XX",
      "em,sm,gp,rp,xx",
      SUBSCORES.map((x) => x.id).join(","),
      SUBSCORES.map((x) => x.id).join(",") === "em,sm,gp,rp,xx",
    ),
  );

  const ignoredKeys = CONTEXT_FIELDS.filter((f) => f.status === "ignored").map((f) => f.key);
  const ignoredLeak =
    ignoredKeys.some((k) => TOGGLEABLE_CONTEXT_KEYS.has(k)) ||
    s.context.em.some((k) => ignoredKeys.includes(k));
  out.push(
    structural(
      "ignored-fields",
      "'ignored for now' fields (taste · history · party · budget · day-of-week) can never enter EM",
      "not toggleable, not in context",
      ignoredLeak ? "LEAKED into context" : "not toggleable, not in context",
      !ignoredLeak,
    ),
  );

  const clamped = coerceScoringSettings({
    xx: { control: 99 },
    gp: { lnCeiling: 999 },
  });
  out.push(
    structural(
      "coerce-clamps",
      "the coercer clamps garbage to the range table (and NULL → pure defaults)",
      "control 5 · ceiling 15",
      `control ${clamped.xx.control} · ceiling ${clamped.gp.lnCeiling}`,
      clamped.xx.control === 5 && clamped.gp.lnCeiling === 15,
    ),
  );

  out.push(
    structural(
      "encoder-fixed",
      "the encoder is a FIXED constant — text-embedding-3-small at its native 1536 dims, not a param (not in the blob, no slider)",
      "text-embedding-3-small · 1536",
      `${EM_ENCODER.model} · ${EM_ENCODER.dims}`,
      EM_ENCODER.model === "text-embedding-3-small" && EM_ENCODER.dims === 1536,
    ),
  );

  // ── LOCKED VALUES — the agreed spec vs the current form ───────────────

  out.push(
    locked(
      "gp-ceiling",
      "GP ceiling: ln(1+raw)/10 — e¹⁰ ≈ 22,026 star mass reads fully popular (locked)",
      "10",
      String(s.gp.lnCeiling),
      s.gp.lnCeiling === 10,
    ),
    locked(
      "rp-rungs",
      "RP rungs: 0.10 · 0.40 · 0.70 · 1.00 (agreed ladder)",
      "0.10 / 0.40 / 0.70 / 1.00",
      `${s.rp.zero.toFixed(2)} / ${s.rp.conservative.toFixed(2)} / ${s.rp.aggressive.toFixed(2)} / ${s.rp.dominant.toFixed(2)}`,
      near(s.rp.zero, 0.1) &&
        near(s.rp.conservative, 0.4) &&
        near(s.rp.aggressive, 0.7) &&
        near(s.rp.dominant, 1.0),
    ),
    locked(
      "sm-where",
      "SM where: point tolerance 5 km · zone spillover 1.5 km · exponent 3 (eng-reviewed)",
      "5 / 1.5 / 3",
      `${s.sm.where.pointTolKm} / ${s.sm.where.zoneSpillKm} / ${s.sm.where.distExp}`,
      near(s.sm.where.pointTolKm, 5) &&
        near(s.sm.where.zoneSpillKm, 1.5) &&
        near(s.sm.where.distExp, 3),
    ),
    locked(
      "sm-when",
      "SM when: floor 0.3 · transition 2 h · steepness 4 · session 1.5 h · 30-min grid",
      "0.3 / 2 / 4 / 1.5 / 0.5",
      `${s.sm.when.waitFloor} / ${s.sm.when.waitTransitionH} / ${s.sm.when.waitSteep} / ${s.sm.when.sessionH} / ${s.sm.when.timeBlockH}`,
      near(s.sm.when.waitFloor, 0.3) &&
        near(s.sm.when.waitTransitionH, 2) &&
        near(s.sm.when.waitSteep, 4) &&
        near(s.sm.when.sessionH, 1.5) &&
        near(s.sm.when.timeBlockH, 0.5),
    ),
    locked(
      "sm-what",
      "SM what rungs: sibling 0.6 · mismatch 0.2 (agreed ladder)",
      "0.6 / 0.2",
      `${s.sm.what.sibling} / ${s.sm.what.mismatch}`,
      near(s.sm.what.sibling, 0.6) && near(s.sm.what.mismatch, 0.2),
    ),
    locked(
      "xx-range",
      "XX control inside the agreed 0–5 range (0 = off · 5 = chaos)",
      "0 ≤ control ≤ 5",
      String(s.xx.control),
      s.xx.control >= 0 && s.xx.control <= 5,
    ),
  );

  const daDefault = SUBSCORES.every((sub) =>
    APPLICABLE_SOURCES[sub.id].every((src) => s.dataAccess[sub.id].includes(src)),
  );
  out.push(
    locked(
      "data-access-default",
      "data access: every applicable source ON (the spec's default) — OFF cells are deliberate revocations",
      "all applicable ON",
      daDefault ? "all applicable ON" : "some sources revoked",
      daDefault,
    ),
  );

  const emDefaultContext =
    JSON.stringify([...s.context.em].sort()) ===
    JSON.stringify([...DEFAULT_SCORING_SETTINGS.context.em].sort());
  out.push(
    locked(
      "em-context-default",
      "EM context = the spec's live field list (name·sex·age·country·class · query·zone·time · place text fields)",
      `${DEFAULT_SCORING_SETTINGS.context.em.length} live fields`,
      `${s.context.em.length} enabled${emDefaultContext ? "" : " (differs from spec set)"}`,
      emDefaultContext,
    ),
  );

  // Sanity: the code defaults themselves must be congruent — if this fails,
  // scores.ts drifted from the spec at the source.
  const defaultsClean = runLockedOnDefaults();
  out.push(
    structural(
      "defaults-congruent",
      "the CODE DEFAULTS themselves match the spec (scores.ts hasn't drifted at the source)",
      "all locked checks pass on DEFAULT_SCORING_SETTINGS",
      defaultsClean ? "pass" : "scores.ts defaults drifted",
      defaultsClean,
    ),
  );

  return out;
}

// Locked checks evaluated on the code defaults — used by the sanity check
// above so a drifted DEFAULT_* constant can't hide behind a matching form.
function runLockedOnDefaults(): boolean {
  const d = DEFAULT_SCORING_SETTINGS;
  return (
    d.gp.lnCeiling === 10 &&
    near(d.rp.zero, 0.1) &&
    near(d.rp.conservative, 0.4) &&
    near(d.rp.aggressive, 0.7) &&
    near(d.rp.dominant, 1.0) &&
    near(d.sm.where.pointTolKm, 5) &&
    near(d.sm.where.zoneSpillKm, 1.5) &&
    near(d.sm.where.distExp, 3) &&
    near(d.sm.when.waitFloor, 0.3) &&
    near(d.sm.when.waitTransitionH, 2) &&
    near(d.sm.when.waitSteep, 4) &&
    near(d.sm.when.sessionH, 1.5) &&
    near(d.sm.when.timeBlockH, 0.5) &&
    near(d.sm.what.sibling, 0.6) &&
    near(d.sm.what.mismatch, 0.2) &&
    d.xx.control >= 0 &&
    d.xx.control <= 5 &&
    JSON.stringify(DEFAULT_DATA_ACCESS) === JSON.stringify(d.dataAccess)
  );
}
