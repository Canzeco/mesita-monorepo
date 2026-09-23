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
    // "Gold" and "Passport" are both gone (MESITA-2044, MESITA-2043); the ask
    // must still land on the rows that SAY so, not fall through to the web.
    ["¿Qué significa Gold Passport?", "diamond-list"],
    ["¿Qué significa Gold Passport?", "member-number"],
    ["¿cómo funciona el descuento?", "discount"],
    ["¿qué es un ticket?", "ticket"],
    ["¿qué gano siendo Premium?", "plan"],
  ];
  for (const [ask, expectedId] of asks) {
    const hits = lookupMesitaKnowledge(ask, "guest");
    assert(hits.length > 0, `no knowledge for "${ask}"`);
    // Membership, not first place: "Gold Passport" legitimately pulls both the
    // Diamond List row and the member-number row, and the model needs both.
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

Deno.test("knowledge: no guest row describes a Passport as a live surface", () => {
  // MESITA-2043 deleted the Passport. Only the member-number row may name it,
  // and only to say it is gone — anything else tells the model to send a
  // guest to a screen that does not exist.
  for (const row of MESITA_KNOWLEDGE.filter((e) => e.audience === "guest")) {
    if (!/passport/i.test(row.fact)) continue;
    assertEquals(row.id, "member-number", `${row.id} still mentions the Passport`);
    assert(/no Passport/.test(row.fact), row.fact);
  }
  const member = MESITA_KNOWLEDGE.find((e) => e.id === "member-number")!;
  assert(/Me\s*›\s*Profile/.test(member.fact), member.fact);
});

Deno.test("knowledge: passport and plan still co-return without contradiction", () => {
  const block = knowledgeBlock("does my plan show on my passport?", "guest");
  const member = MESITA_KNOWLEDGE.find((e) => e.id === "member-number")!;
  const plan = MESITA_KNOWLEDGE.find((e) => e.id === "plan")!;
  assert(block.includes(member.fact), "the member-number row no longer co-returns");
  assert(block.includes(plan.fact), "the plan row no longer co-returns");
  assertEquals(/passport/i.test(plan.fact), false, plan.fact);
});

// ── The Diamond List is binary (MESITA-2044) ────────────────────────────
//
// Pato: "there are no classes, either you are diamond or you are not." These
// FAIL if a guest row ever again grounds the model in a class, a metal, a
// ladder, VIP, or "Diamond" as a bare status noun ("You're Diamond").

const BANNED_IN_GUEST_FACTS: [RegExp, string][] = [
  [/\bVIP\b/i, "VIP"],
  [/\bclass(es)?\b/i, "class"],
  [/\btiers?\b/i, "tier"],
  [/\branks?\b/i, "rank"],
  [/\brungs?\b/i, "rung"],
  [/\blevels?\b/i, "level"],
  [/\bBronze\b/i, "Bronze"],
  [/\bSilver\b/i, "Silver"],
  [/\bGold\b/i, "Gold"],
  [/\bclimb/i, "climb"],
  [/unlock a higher/i, "unlock a higher"],
  [/\bDiamond\b(?! List)/, "Diamond without List"],
];

Deno.test("knowledge: guest rows never speak of classes, metals or a ladder", () => {
  for (const row of MESITA_KNOWLEDGE.filter((e) => e.audience === "guest")) {
    for (const [re, name] of BANNED_IN_GUEST_FACTS) {
      assertEquals(re.test(row.fact), false, `${row.id} fact says ${name}: ${row.fact}`);
      assertEquals(re.test(row.topic), false, `${row.id} topic says ${name}: ${row.topic}`);
    }
  }
});

Deno.test("knowledge: the Diamond List row is binary and invitation-only", () => {
  const row = MESITA_KNOWLEDGE.find((e) => e.id === "diamond-list")!;
  assert(/on it or not/.test(row.fact), row.fact);
  assert(/invitation-only/.test(row.fact), row.fact);
  const join = MESITA_KNOWLEDGE.find((e) => e.id === "diamond-list-join")!;
  assert(/invitation-only/.test(join.fact), join.fact);
  // Instagram must never read as a way on.
  assert(/grants nothing toward the list/.test(join.fact), join.fact);
});

Deno.test("knowledge: old ladder words still route to the Diamond List row", () => {
  for (const ask of ["¿qué significa Gold?", "what is silver", "soy bronce?", "am I VIP"]) {
    const hits = lookupMesitaKnowledge(ask, "guest");
    assertEquals(hits.some((h) => h.id === "diamond-list"), true, ask);
  }
  const join = lookupMesitaKnowledge("¿cómo uso mi código de invitación?", "guest");
  assertEquals(join[0].id, "diamond-list-join");
});

Deno.test("knowledge: the plan row names where Premium is bought", () => {
  // With the Passport tile gone, the concierge is the last surface that can
  // route a guest to checkout, and until MESITA-1619 no row in this file
  // named a location for it. `diamond-list-join` sets the same idiom for the
  // invitation ("Me › Diamond List").
  const plan = MESITA_KNOWLEDGE.find((e) => e.id === "plan")!;
  assert(/Me\s*›\s*Plan/.test(plan.fact), plan.fact);
});
