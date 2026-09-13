import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// PROSE DOES NOT WEAR A LABEL ROLE (MESITA-1827).
//
// The four type roles are SIZES, and `type-meta` (10px) / `type-label` (11px)
// are the sizes for LABELS and METADATA. A sentence the guest has to read to
// understand what is happening is neither, and 61 `<p>` elements were wearing
// one anyway — the notification body at 10px, a review's text at 10px, and
// Help, Plan, Settings, Instagram, InvitePin, EditProfile, ReservationSheet
// and the OTP form all explaining themselves at 11px.
//
// WHY THIS IS THE FIX AND NOT A BIGGER SCALE. web-consumer's answer to small
// text is that the roles are REM, so they scale with the guest's own browser
// font-size setting — `ViewportLock`'s header says so in as many words, and
// that is the carve-out the zoom lock deliberately leaves open. Raising the
// role VALUES would instead break geometry Docs › Design records as measured
// (the 4:3+4:3 tile, the 94px Passport sub-cell, the section-nav pill budget).
// The roles are right; what wore them was wrong.
//
// THE RULE, and it is mechanical so it can be a test rather than a taste:
// a `<p>` is PROSE unless its classes say otherwise. Three things say
// otherwise, and each is a real reason the small role is correct:
//
//   uppercase + tracking-[…]  the eyebrow idiom — a legend, not a sentence
//   truncate                  cell text whose truncation point IS the layout
//   tabular-nums              a figure
//
// Anything else at `type-label` or `type-meta` is a sentence rendered at label
// size, and this test fails on it.
//
// SPANS ARE NOT COVERED. A `<span>` is as often half a row as it is a
// paragraph, and a rule that cannot tell them apart would either miss most
// prose or flag every chip. `<p>` is the element that already means "this is a
// block of text", so the codebase's own markup is doing the classifying.
// Prose that lives in a span is caught in review, not here.

const SRC = join(__dirname, "..", "..");

/** Classes that make a small role CORRECT rather than a regression. */
const EXEMPT = [
  "uppercase",
  "tracking-[",
  "tracking-wide",
  "tracking-wider",
  "truncate",
  "tabular-nums",
];

const SMALL_ROLES = ["type-label", "type-meta"];

/** LABEL BY CONTENT, not by class — the four the rule above cannot see.
 *
 *  Each of these is metadata written inside a `<p>` with no `truncate`, no
 *  eyebrow tracking and no `tabular-nums` to say so, so the mechanical rule
 *  reads it as prose. The reason lives here rather than in a widened exemption
 *  because widening it (`h-4`? a glyph sibling?) would quietly excuse real
 *  prose too. A named list of four with a stated reason each is the honest
 *  shape, and the test below refuses to let it rot.
 *
 *  Keyed by `file:line`, which MOVES — that is deliberate. An entry that stops
 *  matching fails loudly and gets re-judged rather than silently covering
 *  whatever now sits on that line. */
const LABEL_BY_CONTENT: Record<string, string> = {
  "components/consumer/ConsumerActivityList.tsx:49":
    "{a.when} — a timestamp beside the activity it stamps, not a sentence",
  "components/consumer/home/FavoriteTile.tsx:131":
    "the rating row inside the MEASURED 4:3+4:3 tile (Docs › Design §D); its sibling category line is type-label too, and 13px here would outrank it",
  "components/consumer/search/SearchRailCard.tsx:88":
    "the rail card's meta row sits in a fixed h-4/leading-4 line box — 13px does not fit a 16px box, and this is a figure row anyway",
  "components/consumer/wallet/WalletPanel.tsx:154":
    "WalletMoney's caption LABELS the 36px figure above it (MESITA-1825) and has to stay subordinate to it",
};

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

/** Every `<p …>` opening tag with a literal `className="…"`, as [file:line, classes].
 *  A `className={cn(…)}` is out of reach of a regex and out of scope here —
 *  the `<p>` rule is a floor, not a fence. */
function proseTags(file: string): { where: string; classes: string }[] {
  const src = readFileSync(file, "utf8");
  const found: { where: string; classes: string }[] = [];
  // No `s` flag — the tsconfig target predates it, and nothing here needs it:
  // `[^>]*?` and `[^"]*` already cross newlines, which is the whole point (a
  // long className is routinely wrapped across three lines by Prettier).
  const re = /<p\b[^>]*?className="([^"]*)"/g;
  for (const m of src.matchAll(re)) {
    const line = src.slice(0, m.index).split("\n").length;
    found.push({
      where: `${file.slice(SRC.length + 1)}:${line}`,
      classes: m[1],
    });
  }
  return found;
}

describe("prose does not wear a label role", () => {
  const files = walk(SRC);

  it("scanned the app (guards the walker itself)", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it("finds paragraphs to check at all (guards the regex itself)", () => {
    // A regex that silently stops matching would make this suite pass by
    // finding nothing — the exact failure `vacuous-route-tests` is named for.
    const all = files.flatMap(proseTags);
    expect(all.length).toBeGreaterThan(200);
    expect(all.some((p) => p.classes.includes("type-body"))).toBe(true);
  });

  const smallProse = () =>
    files
      .flatMap(proseTags)
      .filter((p) => SMALL_ROLES.some((r) => p.classes.includes(r)))
      .filter((p) => !EXEMPT.some((e) => p.classes.includes(e)));

  it("has no <p> at type-label or type-meta that is not a label", () => {
    const offenders = smallProse()
      .filter((p) => !(p.where in LABEL_BY_CONTENT))
      .map((p) => `${p.where} — ${p.classes.replace(/\s+/g, " ").trim()}`);

    // The message is the fix: promote to `type-body`, say why the small role
    // is right by carrying one of the exempt classes, or — if it really is
    // metadata that looks like prose — add it to LABEL_BY_CONTENT with the
    // reason, which is a decision someone has to write down.
    expect(offenders).toEqual([]);
  });

  it("carries no stale LABEL_BY_CONTENT entry", () => {
    // The allowlist is a ratchet, and a ratchet that can drift is a licence.
    // Every entry must still name a `<p>` the rule would otherwise flag; when
    // one moves or gets fixed, this fails and the line is re-judged instead of
    // quietly excusing whatever took its place.
    const live = new Set(smallProse().map((p) => p.where));
    const stale = Object.keys(LABEL_BY_CONTENT).filter((k) => !live.has(k));
    expect(stale).toEqual([]);
  });
});

// OPACITY IS NOT RANK (Docs › Design §D, verbatim: "Opacity is for
// disabled/pending, never for rank"). `text-muted-foreground/80` on a
// paragraph is the same defect in the other axis — it thins copy that is
// already at the small end, and it does it to the muted token that is ALREADY
// the app's way of saying secondary. The Stripe disclosure, a field hint and a
// ticket sub-line were all doing it.
describe("prose is not dimmed for rank", () => {
  const files = walk(SRC);

  it("has no <p> carrying a rank opacity on the muted token", () => {
    const offenders = files
      .flatMap(proseTags)
      .filter(
        (p) =>
          p.classes.includes("text-muted-foreground/") ||
          p.classes.includes("text-foreground/"),
      )
      // The uppercase eyebrows still carry one. They are labels, not prose,
      // and cleaning them is a separate judgement about the eyebrow idiom
      // rather than about readability — left deliberately, not missed.
      .filter((p) => !p.classes.includes("uppercase"))
      .map((p) => `${p.where} — ${p.classes.replace(/\s+/g, " ").trim()}`);

    expect(offenders).toEqual([]);
  });
});
