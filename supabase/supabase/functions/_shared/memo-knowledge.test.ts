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
