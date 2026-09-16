"use client";

// THE BAR YOU TALK TO. Pato, 2026-09-16: *"home, include bar to talk to
// chatbot for easier shit"*.
//
// ── WHAT IT IS TODAY ───────────────────────────────────────────────────────
//
// A ROUTER MADE OF WORDS. You say what you want changed; it names the screen
// that holds it and opens the door. That is the whole behaviour, and it is
// deliberately the whole behaviour: this package has no backend and may not
// grow one, so a bar that appeared to reach an agent would be the one lie the
// mock is not allowed to tell (see the package CLAUDE.md — every name, number
// and photo here is invented and must stay invented).
//
// It earns its place anyway. "change my hours" → Profile, one hop, no hunt
// through a rail of twelve rows. An operator who never learns where Hours
// lives still gets there.
//
// ── WHAT IT BECOMES ────────────────────────────────────────────────────────
//
// The same bar, answering from the agent instead of from `INTENTS`, and
// WRITING rather than pointing. That is a separate issue because it has real
// questions this one does not: which agent stack, and what the agent may write
// — editing a profile by talking crosses the same gate `PlaceTabGate` enforces
// for humans, so the agent needs the CALLER's identity, never service-role
// blanket rights. The shape here is chosen to survive that swap: one intent in,
// one sentence and one door out.
//
// ── WHY THE TRANSCRIPT DIES ON NAVIGATION ──────────────────────────────────
//
// It is `useState`, not the store. The store persists, and a conversation
// surviving a reload would be a memory of an exchange that never reached
// anything — the mock may render invented DATA, but it may not remember an
// invented CONVERSATION as though it happened.
import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, Sparkles, X } from "lucide-react";
import { placePageHref, placePayHref } from "@/lib/console-routes";
import { placeTabHref } from "@/lib/place-tabs";
import { FOCUS_RING_CLASS, GHOST_PILL_BUTTON_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

type Answer = {
  /** What a real agent would DO, said in the operator's own words. Never a
   *  promise that something happened: nothing here happens. */
  reply: string;
  door: { label: string; href: (placeId: string) => string };
};

type Intent = {
  /** Lowercased, matched against the whole utterance. Broad on purpose — an
   *  operator types "fotos" and "add pic" for the same thing. */
  match: RegExp;
  answer: Answer;
};

const PROFILE = (label: string) => ({
  label,
  href: (id: string) => placeTabHref(id, "profile"),
});

// THE SCRIPT. Ordered: the FIRST match wins, so the specific patterns sit
// above the general ones — "payout" must not be eaten by "pay".
const INTENTS: Intent[] = [
  {
    match: /\b(hour|hours|horario|open|close|closing|opening|schedule)\b/,
    answer: {
      reply:
        "Hours live on the place's profile, one row per day. I'd set the day you name and leave the other six alone.",
      door: PROFILE("Open Profile › Hours"),
    },
  },
  {
    match: /\b(name|rename|called|llama|nombre)\b/,
    answer: {
      // The one real constraint worth carrying into the mock: the public name
      // is a GENERATED column (`coalesce(mesita_name, google_name)`), so the
      // write is the override, never the name itself. An agent that tried the
      // obvious thing would be refused by Postgres.
      reply:
        "I'd write your own name over the one Google gave the place — the public name follows yours the moment it is set, and falls back to Google's if you clear it.",
      door: PROFILE("Open Profile › Name"),
    },
  },
  {
    match: /\b(photo|photos|foto|fotos|pic|picture|image|gallery)\b/,
    answer: {
      reply:
        "Photos are the gallery on your public page, in the order you leave them. The first one is the card guests see everywhere else.",
      door: PROFILE("Open Profile › Photos"),
    },
  },
  {
    match: /\b(menu|menus|carta|dish|dishes|plato)\b/,
    answer: {
      reply: "Menus are a card on the profile — a PDF or a Drive link, and guests open whichever is newest.",
      door: PROFILE("Open Profile › Menus"),
    },
  },
  {
    match: /\b(description|presentation|about|bio|tagline|describe)\b/,
    answer: {
      reply:
        "The Presentation is the paragraph under your name. I'd rewrite it and leave your tags and category where they are.",
      door: PROFILE("Open Profile › Presentation"),
    },
  },
  {
    match: /\b(tag|tags|category|categories|cuisine|type)\b/,
    answer: {
      reply:
        "Tags and category are what Discovery matches guests against, so they are the two fields that change who finds you.",
      door: PROFILE("Open Profile › Category"),
    },
  },
  {
    match: /\b(payout|payouts|bank|deposit|stripe|onboard)\b/,
    answer: {
      reply:
        "Payouts are Stripe's, not ours — the account, the documents and the bank details all live on their side, and this console only opens the door to it.",
      door: { label: "Open Payments setup", href: placePayHref },
    },
  },
  {
    match: /\b(pay|payment|payments|charge|card|cobrar)\b/,
    answer: {
      reply:
        "Mesita Payments is the switch that lets a guest close their bill in the app. Whether it is on here is the first line on its own screen.",
      door: { label: "Open Payments", href: (id: string) => placeTabHref(id, "pay") },
    },
  },
  {
    match: /\b(reward|rewards|cashback|loyalty|points|premio)\b/,
    answer: {
      reply:
        "Rewards is one strategy at a time, set on its own screen — the dial is there and nowhere else, so two screens can never disagree about what a guest earns.",
      door: { label: "Open Rewards", href: (id: string) => placeTabHref(id, "rewards") },
    },
  },
  {
    match: /\b(credit|credits|gift|saldo|balance)\b/,
    answer: {
      reply:
        "Credits are money a guest already holds at this place. The list is per guest and it is paginated — there is no grand total to read, by design.",
      door: { label: "Open Credits", href: (id: string) => placeTabHref(id, "credits") },
    },
  },
  {
    match: /\b(reserv|booking|book|table|mesa)\b/,
    answer: {
      reply: "Reservations shows what is requested, confirmed and seated, soonest first.",
      door: {
        label: "Open Reservations",
        href: (id: string) => placeTabHref(id, "reservations"),
      },
    },
  },
  {
    match: /\b(order|orders|pickup|delivery|pedido)\b/,
    answer: {
      reply:
        "Orders is pickup and delivery in one list. Which of the two you take is a switch per place, not per order.",
      door: { label: "Open Orders", href: (id: string) => placeTabHref(id, "orders") },
    },
  },
  {
    match: /\b(visit|visits|bill|check|cuenta|ticket)\b/,
    answer: {
      reply:
        "A visit is a bill closed at the table. The reward applies before the total is shown, which is the only moment a guest believes it.",
      door: { label: "Open Visits", href: (id: string) => placeTabHref(id, "visits") },
    },
  },
  {
    match: /\b(review|reviews|rating|stars|reseña)\b/,
    answer: {
      reply: "Scores and reach are a card on the profile — Google and Mesita, Instagram and Facebook.",
      door: PROFILE("Open Profile › Reviews"),
    },
  },
  {
    match: /\b(customer|customers|guest|guests|whatsapp|cliente)\b/,
    answer: {
      reply:
        "Customers is who came, how often, and the one fact you buy one guest at a time — their WhatsApp number.",
      door: {
        label: "Open Customers",
        href: (id: string) => placePageHref(id, "customers"),
      },
    },
  },
  {
    match: /\b(team|teammate|staff|invite|member|user|permission|role)\b/,
    answer: {
      reply:
        "Teammates are on Settings, each with one role. A viewer reads three screens; an editor gets the other six.",
      door: { label: "Open Settings", href: (id: string) => placePageHref(id, "settings") },
    },
  },
  {
    match: /\b(today|yesterday|week|sales|revenue|happened|how.*doing|report)\b/,
    answer: {
      reply:
        "Everything that happened here is one list, newest first — visits, orders, payouts and profile edits in the order they landed.",
      door: { label: "Open Activity", href: (id: string) => placePageHref(id, "activity") },
    },
  },
];

const FALLBACK: Answer = {
  reply:
    "I don't know that one yet. Everything this place can switch on is in the catalogue — each card says whether it is on here and what turns it on.",
  door: { label: "Open Products", href: (id: string) => placePageHref(id, "products") },
};

/** The one place a question becomes an answer. Exported so a future agent can
 *  be dropped in beside it and diffed against the script rather than replacing
 *  it silently. */
export function answerFor(utterance: string): Answer {
  const said = utterance.toLowerCase();
  return INTENTS.find((i) => i.match.test(said))?.answer ?? FALLBACK;
}

// The four openers. They are VERBS, not topics: a chip that says "Hours" only
// tells you the bar knows a word, while "Change my hours" tells you what the
// bar is for.
const OPENERS = [
  "Change my hours",
  "Add a photo",
  "Why is Payments off?",
  "How did today go?",
];

type Turn = { id: number; said: string; answer: Answer };

export function AskBar({ placeId }: { placeId: string }) {
  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);

  function ask(said: string) {
    const text = said.trim();
    if (!text) return;
    // NEWEST FIRST, directly under the bar. A transcript that grew downward
    // would put the answer you are reading furthest from the box you typed in,
    // and Home has a page below this that would keep being pushed away.
    setTurns((prev) => [{ id: nextId.current++, said: text, answer: answerFor(text) }, ...prev]);
    setDraft("");
    inputRef.current?.focus();
  }

  return (
    <section aria-labelledby="ask-heading" className="flex flex-col gap-2">
      <h2 id="ask-heading" className="sr-only">
        Ask Mesita
      </h2>

      {/* THE BAR IS FULL WIDTH. No max-width here and none coming: the console
          is fluid, and a 640px box centred in a 1700px page is the shape that
          has been deleted from this codebase twice. */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(draft);
        }}
        className={cn(
          "border-border bg-card shadow-card flex w-full items-center gap-2.5 rounded-2xl border py-2 pr-2 pl-3.5",
          "focus-within:border-foreground/30 transition",
        )}
      >
        <Sparkles className="text-muted-foreground h-4 w-4 shrink-0" />
        <label htmlFor="ask" className="sr-only">
          Tell Mesita what to change
        </label>
        <input
          id="ask"
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoComplete="off"
          placeholder="Tell Mesita what to change…"
          // The bar carries the focus ring on the FORM, not the field: the ring
          // belongs around the whole control an operator sees, and a second one
          // inside it would draw a box within a box.
          className="min-h-11 min-w-0 flex-1 bg-transparent text-sm outline-hidden placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={draft.trim().length === 0}
          aria-label="Ask"
          className={cn(
            "bg-foreground text-background flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition hover:opacity-90 disabled:opacity-30",
            FOCUS_RING_CLASS,
          )}
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-1.5">
        {OPENERS.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => ask(o)}
            className={GHOST_PILL_BUTTON_CLASS}
          >
            {o}
          </button>
        ))}
        {turns.length > 0 && (
          <button
            type="button"
            onClick={() => setTurns([])}
            className="text-muted-foreground hover:text-foreground ml-auto inline-flex items-center gap-1 text-[12px] font-semibold transition"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>

      {/* THE DISCLOSURE, ALWAYS ON, NEVER A TOOLTIP. It is the same law the
          MOCK strip keeps at the top of the window: this app is publicly
          reachable, and a bar that let a stranger believe it had just edited a
          real venue would be the worst thing on the page.
          It is a FOOTNOTE and dressed as one. `TINY_LABEL_CLASS` — uppercase,
          tracked — is the console's SECTION label, and wearing it here made a
          caveat shout over the answers it was a caveat about. */}
      <p className="text-muted-foreground px-0.5 text-[11px] leading-snug">
        Scripted — it opens the screen that holds the answer; it does not write.
      </p>

      {turns.length > 0 && (
        <ol aria-live="polite" className="mt-1 flex flex-col gap-2">
          {turns.map((t) => (
            <li
              key={t.id}
              className="border-border bg-card shadow-card flex flex-col gap-2 rounded-2xl border p-3.5"
            >
              <p className="text-[13px] font-semibold">{t.said}</p>
              <p className="text-muted-foreground text-[13px] leading-relaxed">
                {t.answer.reply}
              </p>
              <Link
                href={t.answer.door.href(placeId)}
                className={cn(GHOST_PILL_BUTTON_CLASS, "self-start")}
              >
                {t.answer.door.label}
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
