// memo-knowledge.ts — Mesita's OWN words, the one source the concierge has for
// questions about Mesita itself.
//
// Ask Memo "¿qué significa Gold?" or "¿cómo funciona el descuento?" and there
// is nothing on the open web to retrieve: Diamond, plans and tickets
// are house vocabulary, not published facts. Before this file every
// such ask fell through to the web tool (agent engine) or straight to Perplexity
// (legacy engine), which had to decline or invent. Routing an internal question
// outward was the bug; this is the inward answer.
//
// WHY A CURATED TABLE, NOT EMBEDDINGS OVER THE NOTION DOCS. The Docs carry
// PARKED and unshipped state — orders "PARKED", Credits "STAGED", Ojo "engine not
// built". Embedding them wholesale means a guest asking "¿puedo pedir a
// domicilio?" is told about a feature that does not exist. A curated set is
// auditable row by row and matches the airlock's philosophy: a closed set you
// can enumerate, not a surface you hope behaves.
//
// WHY CODE AND NOT A TABLE. Memo holds no database client (memo-data.ts), so a
// DB-backed knowledge set would need a fifth read endpoint on its data surface
// AND a migration. The rows below are law-shaped, not operator-tuned — they
// change when the product changes, in the same commit as the product — so code
// is where they belong until an operator needs to edit one without a deploy.
//
// AUDIENCE IS THE SECURITY BOUNDARY. Every row declares who may ever read it.
// `lookupMesitaKnowledge` takes the audience explicitly and filters BEFORE
// ranking, so an `internal` row cannot place in a guest result even when the
// guest's words match it exactly. No caller passes "internal" today — both live
// paths ask as "guest" — the door is built with the lock already on, and
// memo-knowledge.test.ts pins that a guest query can never reach an internal
// row. That failure would be silent and unauditable, so it is tested, not
// trusted.
//
// Facts here mirror Notion Docs (🔤 Vocabulary · 🎁 Rewards · 🪑 Visits). Docs
// are the knowledge; when one changes, this file changes with it in the same
// session.
//
// DIAMOND (MESITA-2044, MESITA-2046). Pato, 2026-09-22: "there are no
// classes, either you are diamond or you are not." Guest rows speak of
// Diamond only — Diamond or not — and never of a class, a
// metal, a tier or a ladder; memo-knowledge.test.ts fails the build if one
// does. The old words stay as MATCH TERMS so a guest who still asks "¿qué
// significa Gold?" lands on the row that tells the model those are gone. The
// Passport was deleted in MESITA-2043; its row now says so and points at
// Profile, where the member number lives.

export type KnowledgeAudience = "guest" | "internal";

export type KnowledgeEntry = {
  /** Stable row id — what an audit names when a fact goes wrong. */
  id: string;
  /** Who may ever read this row. Filtered before ranking, never after. */
  audience: KnowledgeAudience;
  /** The house term this row defines; the model reads it as the heading. */
  topic: string;
  /** Match terms, Spanish and English. Compared accent- and case-insensitively. */
  terms: string[];
  /**
   * The fact, stated plainly. NOT the reply: Memo answers in the guest's own
   * language and voice, so these are written as grounding the model rephrases,
   * never as copy to recite.
   */
  fact: string;
};

// ── The curated set ────────────────────────────────────────────────────
//
// Guest rows are things a guest may be told, in the guest's own vocabulary
// (guest/reward/discount, never consumer/promo/project). Internal rows are
// facts that are true but not the guest's business — machinery, legacy bridges,
// and anything whose disclosure would undercut the product.

export const MESITA_KNOWLEDGE: KnowledgeEntry[] = [
  {
    id: "mesita",
    audience: "guest",
    topic: "What Mesita is",
    terms: ["que es mesita", "what is mesita", "como funciona mesita", "sobre mesita", "about mesita"],
    fact:
      "Mesita is where going out pays you back: at every place that is promoting, just by being you, you pay less — applied straight to tonight's bill. The place funds that discount as its own marketing spend; Mesita never charges the guest for a ticket. Using Mesita is free.",
  },
  {
    id: "member-number",
    audience: "guest",
    topic: "Your member number (there is no Passport)",
    terms: [
      "passport",
      "pasaporte",
      "member number",
      "numero de miembro",
      "numero de socio",
      "mi numero",
      "my number",
    ],
    fact:
      "There is no Passport on Mesita any more. Every guest has an 8-digit member number, shown under Me › Profile. It is what to give when you ask to join Diamond, and what staff or support can use to find you.",
  },
  {
    id: "diamond",
    audience: "guest",
    topic: "Diamond",
    terms: [
      "diamond list",
      "lista diamante",
      "diamond",
      "diamante",
      "class",
      "clase",
      "bronze",
      "bronce",
      "silver",
      "plata",
      "gold",
      "oro",
      "vip",
      "nivel",
      "level",
    ],
    fact:
      "Diamond is the one guest status on Mesita, and it is binary: a guest is Diamond or not, with nothing in between and nothing to work up to. It is invitation-only and can never be bought. Every guest gets the base discount at a place that is promoting; Diamond guests get more on top. Older metal names a guest may have seen no longer exist — there is only the base and Diamond.",
  },
  {
    id: "diamond-join",
    audience: "guest",
    topic: "How to join Diamond",
    terms: [
      "join",
      "unirme",
      "como entro",
      "how do i get",
      "subir de clase",
      "como subo",
      "climb",
      "level up",
      "invitation",
      "invitacion",
      "invite code",
      "codigo de invitacion",
      "invite pin",
      "aura",
    ],
    fact:
      "Diamond is invitation-only. Ask Mesita to join, or enter a PIN if someone gave you one — both live under Me › Diamond. Neither is a checkout, and Instagram is not a way on: connecting a handle unlocks the Story action and grants nothing toward Diamond. Diamond is recomputed from the live facts; if an invitation is withdrawn, the guest is simply back on the base.",
  },
  {
    id: "plan",
    audience: "guest",
    topic: "Plan (Free · Premium)",
    terms: ["plan", "premium", "free", "gratis", "suscripcion", "subscription", "membresia"],
    fact:
      "Plan is what you pay, and it is private. Free gives the whole product — catalog, discovery, reservations, rewards. Premium is MX$50/month and buys perks, such as more reservations a month; it never changes the discount and never makes anyone Diamond. You subscribe and manage it under Me › Plan. It never reaches the floor.",
  },
  {
    id: "discount",
    audience: "guest",
    topic: "How the discount is computed",
    terms: ["descuento", "discount", "cuanto ahorro", "how much off", "porcentaje", "percent", "reward", "recompensa"],
    fact:
      "A bill resolves to exactly one percent, server-side. It stacks: your standing rate (the base every guest gets, plus more for Diamond guests) plus a one-time welcome bonus on your first verified ticket at that place plus every sharing action you actually completed — then it is capped and applied to the first pesos of the bill, up to the cap that place sets. Only the final percent ever leaves the server.",
  },
  {
    id: "actions",
    audience: "guest",
    topic: "The three sharing actions",
    terms: [
      "accion",
      "acciones",
      "action",
      "story",
      "historia",
      "resena",
      "review",
      "google review",
      "instagram story",
    ],
    fact:
      "Exactly three actions beat the standing rate. An Instagram Story that tags the place and @mesita (repeatable, needs a connected handle). A Mesita review — Food, Service, Ambience, Value, Overall on 1 to 5 — one per place, updatable. And a Google review, claimable once per place; any rating qualifies, it is never gated on being positive. You do them yourself, before the restaurant is involved at all; the floor never judges your proof.",
  },
  {
    id: "ticket",
    audience: "guest",
    topic: "The ticket (a visit)",
    terms: ["ticket", "visita", "visit", "cuenta", "bill"],
    fact:
      "A visit ticket is the whole table visit: you create it at the place with one tap, and it runs seven steps — Bill, Reward, Task, QR, Pay, Validate, Results. You type the bill and the tip, pick your reward, do the action if it needs one, show the QR for the staff to scan and approve, then settle in cash or card. It validates and closes itself the moment payment confirms. The reward rides the visit ticket.",
  },
  {
    id: "tip",
    audience: "guest",
    topic: "The tip",
    terms: ["propina", "tip"],
    fact:
      "The tip is always calculated on the bill BEFORE the discount, so the waiter never loses money because you saved. That is deliberate and not adjustable.",
  },
  {
    id: "reservation",
    audience: "guest",
    topic: "Reservations",
    terms: ["reservacion", "reserva", "reservation", "booking", "mesa"],
    fact:
      "A reservation ticket holds you a table, and it deliberately carries no reward. A reward comes from showing up, never from booking and never from saving. Guests get 2 reservations a month; Diamond guests or on Premium get 10.",
  },
  {
    id: "check",
    audience: "guest",
    topic: "What the staff see",
    terms: ["staff", "mesero", "waiter", "escanear", "scan", "check", "qr"],
    fact:
      "Staff open your ticket by scanning its QR with any phone camera — no app, no account. They see the bill, the tip, the reward and your proof, plus ONE resolved percent. They never see whether you're Diamond, your plan, or how the percent was reached.",
  },
  {
    id: "partner",
    audience: "guest",
    topic: "Mesita Partner",
    terms: ["partner", "socio", "badge", "insignia"],
    fact:
      "Mesita Partner is the badge a place carries when it holds a live partnership AND is running a discount. A Mesita Partner never serves 0%. The badge is called Mesita Partner, never Verified Partner.",
  },
  {
    id: "no-cashback",
    audience: "guest",
    topic: "Nothing accumulates yet",
    terms: ["cashback", "credits", "creditos", "puntos", "points", "acumular", "saldo"],
    fact:
      "Nothing accumulates on Mesita today. A reward pays as a discount on tonight's bill, right then — there is no balance to build up first. Credits are the name of the balance the money program will carry; they appear on the ticket so the shape is visible, but they cannot be selected and never pay yet.",
  },
  {
    id: "no-orders",
    audience: "guest",
    topic: "No delivery or pickup yet",
    terms: ["domicilio", "delivery", "pedido", "order", "pickup", "para llevar", "envio"],
    fact:
      "Mesita does not do delivery, pickup or ordering today. It covers visits and reservations. Do not promise a remote order — the surface does not exist.",
  },
  {
    id: "privacy",
    audience: "guest",
    topic: "What a place learns about you",
    terms: ["privacidad", "privacy", "datos", "my data", "saben", "sabe el lugar"],
    fact:
      "A place learns what it is giving, never who it is giving it to. Your plan never reaches the floor and your rate breakdown never leaves the server — the restaurant sees one integer percent.",
  },

  // ── Internal rows ────────────────────────────────────────────────────
  // True, and not the guest's business. They exist so the audience filter is
  // load-bearing rather than decorative, and so the test below has something
  // real to prove unreachable.
  {
    id: "legacy-class-keys",
    audience: "internal",
    topic: "The legacy class_key bridge",
    terms: ["class_key", "standard", "influencer", "identityforclasskey", "legacy class"],
    fact:
      "consumers.class_key stores Diamond as a key: diamond = Diamond, bronze = the base (not Diamond). The silver and gold rows survive in storage since MESITA-2044 but nothing can grant them, and a stray one reads as not Diamond. What the guest pays is consumers.plan (free, premium). identityForClassKey still maps leftover legacy keys: standard→bronze, influencer→silver, premium→bronze, aura→diamond. Never treat premium as a class.",
  },
  {
    id: "reach-self-declared",
    audience: "internal",
    topic: "Instagram reach is self-declared",
    terms: ["self declared", "autodeclarado", "follower count", "seguidores verificados", "demo count"],
    fact:
      "Nothing about a connected Instagram is verified. The claim EF writes whatever follower count the client sends, and the shipped flow submits a fixed demo count. Since MESITA-2044 that count opens no class door at all — the reach door is closed and follower_threshold is null — so a self-declared number can no longer make anyone Diamond.",
  },
];

// ── Lookup ─────────────────────────────────────────────────────────────

/** How many rows a single lookup may return — enough to answer, not a dump. */
const MAX_HITS = 3;

// Case- and accent-insensitive, so "¿qué significa Diamante?" matches "diamante"
// and "Cómo funciona el DESCUENTO" matches "descuento".
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * The curated rows this query is about, best match first.
 *
 * `audience` is filtered BEFORE ranking — a row the caller may not read cannot
 * place, cannot tie-break, and cannot leak through a scoring change later.
 * Returns [] when Mesita's own words carry no answer; callers must say so
 * rather than reaching for the web, which has never heard of any of this.
 */
export function lookupMesitaKnowledge(
  query: string,
  audience: KnowledgeAudience,
): KnowledgeEntry[] {
  const q = normalize(query);
  if (q.length < 2) return [];

  const scored: { entry: KnowledgeEntry; hits: number; longest: number }[] = [];
  for (const entry of MESITA_KNOWLEDGE) {
    // Guests read guest rows only. Internal readers read everything.
    if (audience === "guest" && entry.audience !== "guest") continue;
    let hits = 0;
    let longest = 0;
    for (const term of entry.terms) {
      const t = normalize(term);
      if (t.length > 0 && q.includes(t)) {
        hits++;
        if (t.length > longest) longest = t.length;
      }
    }
    if (hits > 0) scored.push({ entry, hits, longest });
  }

  // More matched terms wins; a longer matched phrase breaks the tie, so
  // "codigo de invitacion" outranks a bare "diamond" hit.
  scored.sort((a, b) => b.hits - a.hits || b.longest - a.longest);
  return scored.slice(0, MAX_HITS).map((s) => s.entry);
}

/**
 * The matched rows as a grounding block for a prompt, or "" when nothing
 * matched. Used by the legacy Perplexity engine, which has no tool loop —
 * the agent engine reaches the same rows through the mesita_knowledge tool.
 */
export function knowledgeBlock(query: string, audience: KnowledgeAudience): string {
  const hits = lookupMesitaKnowledge(query, audience);
  if (hits.length === 0) return "";
  const lines = hits.map((h) => `- ${h.topic}: ${h.fact}`);
  return (
    ` [Mesita's own facts for this ask — these are house knowledge, not on the` +
    ` open web, so answer from THEM and never search for or invent anything` +
    ` about how Mesita works. Rephrase in the guest's language; don't recite:\n` +
    `${lines.join("\n")}]`
  );
}
