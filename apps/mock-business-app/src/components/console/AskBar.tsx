"use client";

// THE BAR YOU TALK TO. Pato, 2026-09-16: *"home, include bar to talk to
// chatbot for easier shit"*.
//
// ── WHY IT IS A DARK BAND (MESITA-1931) ────────────────────────────────────
//
// It shipped as a white card among white cards and Pato's whole review was
// *"MAKE A BETTER DESIGN WHAT THE FUCK IS THAT"*. He was right: four containers
// with the same radius, border, fill and gap, so nothing on Home was first —
// and the one thing the screen exists for was the quietest object on it, grey
// placeholder over a grey DISABLED arrow, indistinguishable from a switched-off
// search field.
//
// The band is now the only dark object on a pink page, so the eye lands here
// and nowhere else. It is the same move the Wallet needed (MESITA-1825, which
// ate "wtf is that" twice): the fix for two things that look identical is a
// CHROME RANK, never a third box.
//
// IT PAINTS WITH THE DOCK TOKENS, NOT `--sidebar-*`. The two resolve to the
// same ink today — `--sidebar` IS `var(--dock)` — and that is exactly why the
// distinction has to be kept: `--sidebar-*` is the RAIL's private vocabulary,
// and a page surface borrowing it would make "the rail paints only with
// sidebar tokens" unenforceable the day either one moves.
//
// THE ANSWERS LIVE INSIDE THE BAND. A reply rendered as a light card below it
// would be a fifth box, and the conversation would visibly detach from the
// thing that produced it. Inside, the band grows as you talk and stays one
// object. The chips and the disclosure moved in for the same reason — the
// disclosure used to float between the chips and the first card, belonging to
// neither.
//
// ── WHAT IT IS TODAY ───────────────────────────────────────────────────────
//
// A ROUTER MADE OF WORDS. You say what you want changed; it names the screen
// that holds it and opens the door. That is deliberately the whole behaviour:
// this package has no backend and may not grow one, so a bar that appeared to
// reach an agent would be the one lie the mock is not allowed to tell.
//
// It earns its place anyway. "change my hours" → Profile, one hop, no hunt
// down a rail of twelve rows.
//
// ── WHAT IT BECOMES ────────────────────────────────────────────────────────
//
// The same bar, answering from the agent instead of from `INTENTS`, and
// WRITING rather than pointing (MESITA-1911). That issue has real questions
// this one does not: which agent stack, and what the agent may write — talking
// crosses the same gate `PlaceTabGate` enforces for humans, so it needs the
// CALLER's identity, never service-role blanket rights. The shape here is
// chosen to survive the swap: one intent in, one sentence and one door out.
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
import { cn } from "@/lib/utils";

// THE BAND'S OWN FOCUS RING. `FOCUS_RING_CLASS` offsets against
// `--background`, the light page — drawn on this ink it would ring a control
// in a colour that is nowhere near it. Same two laws as the shared one:
// `outline-hidden` (NOT `outline-none`, which leaves forced-colors users with
// no indicator at all), and a real ring put back in the same string.
// Since MESITA-1934 the ring is WHITE, not `--primary`. The page ring is ink
// and so is this band, so ring-primary here would have been an ink ring in an
// ink gap on an ink ground — six controls with no focus indicator at all.
const BAND_FOCUS =
  "outline-hidden focus-visible:ring-2 focus-visible:ring-dock-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-dock";

const BAND_CHIP = cn(
  "border-dock-border bg-dock-surface text-dock-foreground hover:bg-dock-surface-hover inline-flex items-center rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition",
  BAND_FOCUS,
);

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
      reply:
        "Menus sit on the profile now — a PDF or a link, and guests open whichever is newest.",
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
        "Rewards is the dial on Visits — what a guest earns for closing a bill here, set in one place so two screens can never disagree about it.",
      door: { label: "Open Visits", href: (id: string) => placeTabHref(id, "visits") },
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
    match: /\b(visit|visits|bill|check|cuenta|ticket|tender)\b/,
    answer: {
      reply:
        "A visit is a bill closed at the table, and it can be settled by more than one tender at once. The reward applies before the total is shown, which is the only moment a guest believes it.",
      door: { label: "Open Visits", href: (id: string) => placeTabHref(id, "visits") },
    },
  },
  {
    match: /\b(review|reviews|rating|stars|rese(ñ|n)a)\b/,
    answer: {
      reply:
        "Reviews sit on the profile, in guests' own words, and a reply is public. I'd draft one and let you send it.",
      door: PROFILE("Open Profile › Reviews"),
    },
  },
  {
    match: /\b(customer|customers|guest|guests|whatsapp|cliente)\b/,
    answer: {
      reply:
        "Customers is who came, how often, and the one fact you buy one guest at a time — their phone number.",
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
    // NEWEST FIRST, directly under the composer. A transcript that grew
    // downward would put the answer you are reading furthest from the box you
    // typed in, and Home has a page below this that would keep being pushed
    // away.
    setTurns((prev) => [{ id: nextId.current++, said: text, answer: answerFor(text) }, ...prev]);
    setDraft("");
    inputRef.current?.focus();
  }

  return (
    // THE BAND IS FULL WIDTH. No max-width here and none coming: the console is
    // fluid, and a 640px box centred in a 1700px page is the shape that has
    // been deleted from this codebase twice.
    <section
      aria-labelledby="ask-heading"
      className="bg-dock text-dock-foreground flex w-full flex-col gap-3 rounded-2xl p-3.5 sm:p-4"
    >
      <h2 id="ask-heading" className="sr-only">
        Ask Mesita
      </h2>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(draft);
        }}
        // THE COMPOSER IS THE BRIGHTEST SURFACE IN THE BAND after the button.
        // It sat at `dock-surface` — the same value as the chips and the
        // answers — and a flat band is the same mistake as a flat page: the
        // field you type in has to be the thing that looks typed-in-able, and
        // on a dark ground that is a step in luminance, not a border alone.
        className="border-dock-foreground/20 bg-dock-surface-hover focus-within:border-dock-foreground/40 flex w-full items-center gap-3 rounded-xl border py-2 pr-2 pl-3.5 transition"
      >
        <Sparkles className="text-dock-foreground/70 h-4 w-4 shrink-0" />
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
          // The ring lives on the FORM, not the field: it belongs around the
          // whole control an operator sees, and a second one inside would draw
          // a box within a box.
          className="placeholder:text-dock-muted min-h-11 min-w-0 flex-1 bg-transparent text-[15px] outline-hidden"
        />
        <button
          type="submit"
          disabled={draft.trim().length === 0}
          aria-label="Ask"
          className={cn(
            // ALIVE AT REST, never grey — the law survives MESITA-1934, the
            // colour does not. A control that turns grey when empty is what
            // made this read as a switched-off search field.
            //
            // It INVERTS rather than going ink: `bg-primary` is now #171717 and
            // this button sits on the ink band, which measures 1.17:1 — the
            // circle would simply not be there, and disabled:opacity-55 would
            // then fade an already-invisible fill, collapsing rest, disabled and
            // the band into one object. On a dark ground the brightest thing is
            // white, so white is what "alive" looks like here. Disabled keeps a
            // real 3:1 step down instead of an invisible one.
            "bg-dock-foreground text-dock flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition hover:bg-white disabled:bg-dock-foreground/55",
            BAND_FOCUS,
          )}
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        {OPENERS.map((o) => (
          <button key={o} type="button" onClick={() => ask(o)} className={BAND_CHIP}>
            {o}
          </button>
        ))}
        {turns.length > 0 && (
          <button
            type="button"
            onClick={() => setTurns([])}
            className={cn(
              "text-dock-muted hover:text-dock-foreground ml-auto inline-flex items-center gap-1 rounded-full text-[12px] font-semibold transition",
              BAND_FOCUS,
            )}
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>

      {turns.length > 0 && (
        <ol aria-live="polite" className="flex flex-col gap-2">
          {turns.map((t) => (
            <li
              key={t.id}
              className="border-dock-border bg-dock-surface flex flex-col items-start gap-2 rounded-xl border p-3.5"
            >
              <p className="text-[13px] font-semibold">{t.said}</p>
              <p className="text-dock-muted text-[13px] leading-relaxed">{t.answer.reply}</p>
              <Link href={t.answer.door.href(placeId)} className={BAND_CHIP}>
                {t.answer.door.label}
              </Link>
            </li>
          ))}
        </ol>
      )}

      {/* THE DISCLOSURE, ALWAYS ON, NEVER A TOOLTIP, and now INSIDE the band it
          is about. It is the same law the MOCK strip keeps at the top of the
          window: this app is publicly reachable, and a bar that let a stranger
          believe it had just edited a real venue would be the worst thing on
          the page. */}
      <p className="text-dock-muted text-[11px] leading-snug">
        Scripted — it opens the screen that holds the answer; it does not write.
      </p>
    </section>
  );
}
