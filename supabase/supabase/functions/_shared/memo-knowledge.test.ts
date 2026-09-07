import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  knowledgeBlock,
  lookupMesitaKnowledge,
  MESITA_KNOWLEDGE,
} from "./memo-knowledge.ts";

// The curated knowledge set is the only thing standing between a guest asking
// "¿qué significa Gold?" and the concierge inventing an answer. Its failure
// modes are all quiet — a missed match falls back to "I don't know", and an
// audience leak looks exactly like a good answer — so each one is pinned here.

// ── The security test the issue demands BEFORE the first row is seeded ──
//
// An internal row reaching a guest is silent and unauditable: nothing logs it,
// nothing looks wrong, the guest simply learns something they should not.
// Prove it directly, using each internal row's OWN match terms as the query —
// the strongest possible pull toward it.

Deno.test("knowledge: a guest query can never return an internal row", () => {
  const internal = MESITA_KNOWLEDGE.filter((e) => e.audience === "internal");
  assert(internal.length > 0, "seed at least one internal row or this proves nothing");

  for (const row of internal) {
    for (const term of row.terms) {
      const hits = lookupMesitaKnowledge(term, "guest");
      assertEquals(
        hits.some((h) => h.audience === "internal"),
        false,
        `internal row "${row.id}" leaked to a guest asking "${term}"`,
      );
    }
    // And the whole row's fact as a query, not just its terms.
    const hits = lookupMesitaKnowledge(row.fact, "guest");
    assertEquals(hits.some((h) => h.audience === "internal"), false, row.id);
  }
});

Deno.test("knowledge: the guest grounding block never carries an internal fact", () => {
  for (const row of MESITA_KNOWLEDGE.filter((e) => e.audience === "internal")) {
    for (const term of row.terms) {
      const block = knowledgeBlock(term, "guest");
      assertEquals(block.includes(row.fact), false, `${row.id} via "${term}"`);
    }
  }
});

Deno.test("knowledge: an internal reader does reach internal rows", () => {
  // The filter must be an audience gate, not a blanket exclusion — otherwise
  // the guest test above passes for the wrong reason.
  const row = MESITA_KNOWLEDGE.find((e) => e.audience === "internal")!;
  const hits = lookupMesitaKnowledge(row.terms[0], "internal");
  assertEquals(hits.some((h) => h.id === row.id), true);
});

// ── The questions the issue names, answered from our own words ──────────

Deno.test("knowledge: the four asks from MESITA-1201 all match a guest row", () => {
  const asks: [string, string][] = [
    ["¿Qué significa Gold Passport?", "class"],
    ["¿cómo funciona el descuento?", "discount"],
    ["¿qué es un ticket?", "ticket"],
    ["¿qué gano siendo Premium?", "plan"],
  ];
  for (const [ask, expectedId] of asks) {
    const hits = lookupMesitaKnowledge(ask, "guest");
    assert(hits.length > 0, `no knowledge for "${ask}"`);
    // Membership, not first place: "Gold Passport" legitimately pulls both the
    // class row and the Passport row, and the model is better off with both.
    assertEquals(
      hits.some((h) => h.id === expectedId),
      true,
      `"${ask}" returned ${hits.map((h) => h.id).join(", ")} — no ${expectedId}`,
    );
  }
});

Deno.test("knowledge: matching ignores case and accents", () => {
  const accented = lookupMesitaKnowledge("¿Cómo funciona el DESCUENTO?", "guest");
  const plain = lookupMesitaKnowledge("como funciona el descuento", "guest");
  assertEquals(accented.map((h) => h.id), plain.map((h) => h.id));
  assertEquals(accented[0].id, "discount");
});

Deno.test("knowledge: a place-seeking ask matches nothing, so cards still lead", () => {
  // The knowledge set must not hijack "where should I eat" — that is the
  // catalog's job, and a grounding block there would only add noise.
  assertEquals(lookupMesitaKnowledge("rooftop cocktails in Polanco", "guest"), []);
  assertEquals(knowledgeBlock("un café tranquilo para trabajar", "guest"), "");
});

Deno.test("knowledge: the delivery ask is answered NO, not with a parked feature", () => {
  // The reason this is a curated set and not embeddings over the Docs: the Docs
  // describe orders in detail and mark them PARKED. A guest must get the no.
  const hits = lookupMesitaKnowledge("¿puedo pedir a domicilio?", "guest");
  assertEquals(hits[0].id, "no-orders");
  assert(hits[0].fact.includes("does not do delivery"));
});

// ── Set hygiene ────────────────────────────────────────────────────────

Deno.test("knowledge: row ids are unique and every row is reachable by its terms", () => {
  const seen = new Set<string>();
  for (const row of MESITA_KNOWLEDGE) {
    assertEquals(seen.has(row.id), false, `duplicate id ${row.id}`);
    seen.add(row.id);
    assert(row.terms.length > 0, `${row.id} has no match terms`);
    const hits = lookupMesitaKnowledge(row.terms[0], "internal");
    assertEquals(hits.some((h) => h.id === row.id), true, `${row.id} unreachable`);
  }
});

Deno.test("knowledge: a lookup returns at most three rows", () => {
  // "class" and "plan" and "premium" in one breath must not dump the table.
  const hits = lookupMesitaKnowledge(
    "clase plan premium descuento ticket reservacion propina partner",
    "guest",
  );
  assert(hits.length <= 3, `returned ${hits.length}`);
});

// ── Coherence between rows that CO-RETURN (MESITA-1619) ──────────────────
//
// Every test above stays green no matter how wrong the prose gets: the
// MESITA-1201 test asserts membership BY ID, and the audience gate reads the
// `audience` field, never the fact. That is how the `passport` row spent
// weeks telling the model "three tiles: Instagram, class and plan" two
// entries away from `plan`'s "never prints on the Passport", with a full
// suite green over it.
//
// It is not a latent contradiction either. MAX_HITS is 3, so the single most
// natural question about this pulls both rows into ONE grounding block:
//   lookupMesitaKnowledge("does my plan show on my passport?") -> [passport, plan]
//
// These are narrow claim assertions, never full-string pins — the delivery
// row above sets that precedent. A full pin fails on every wording pass and
// tells you nothing about truth; these fail exactly when the claim changes,
// which is exactly when a human should look.

Deno.test("knowledge: the passport row lists no plan among what it shows", () => {
  const passport = MESITA_KNOWLEDGE.find((e) => e.id === "passport")!;
  // Scoped to a SHOWS-claim on purpose. A bare `/plan/i` ban would fire on
  // the sentence that carries the decision — "The plan is deliberately absent
  // from it" — and the cheapest way to green it would be deleting the words
  // that make the row correct.
  assert(
    !/\b(shows?|carries|prints?|tiles?)\b[^.]*\bplan\b/i.test(passport.fact),
    `the passport row still lists the plan among what it shows: ${passport.fact}`,
  );
});

Deno.test("knowledge: passport and plan cannot contradict inside one block", () => {
  const block = knowledgeBlock("does my plan show on my passport?", "guest");
  const passport = MESITA_KNOWLEDGE.find((e) => e.id === "passport")!;
  const plan = MESITA_KNOWLEDGE.find((e) => e.id === "plan")!;
  // Both really are grounded together. If that ever stops being true this
  // test proves nothing, so it is asserted rather than assumed.
  assert(block.includes(passport.fact), "the passport row no longer co-returns");
  assert(block.includes(plan.fact), "the plan row no longer co-returns");
  assert(plan.fact.includes("never prints on the Passport"));
});

Deno.test("knowledge: the plan row names where Premium is bought", () => {
  // With the Passport tile gone, the concierge is the last surface that can
  // route a guest to checkout, and until MESITA-1619 no row in this file
  // named a location for it. `class-doors` already set the idiom for the FREE
  // door ("Me › Class › Join with Invitation").
  const plan = MESITA_KNOWLEDGE.find((e) => e.id === "plan")!;
  assert(/Me\s*›\s*Plan/.test(plan.fact), plan.fact);
});
