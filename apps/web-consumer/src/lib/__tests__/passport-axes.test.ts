import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// THE PASSPORT PRINTS WHAT IS EARNED AND PUBLIC (MESITA-1619 · MESITA-2040).
//
// The two FACTS are earned and public; the plan is bought and private. So the
// header — and the document behind it — carry Instagram and Diamond, and the
// plan keeps its own surfaces (Me › Plan, Help, the place-detail matrix).
//
// WHAT MESITA-2040 CHANGED HERE, so the next reader does not mistake a rewrite
// for a weakening. Every assertion below used to be written about ONE AXIS
// (the class) and ONE DOOR ONTO IT (Instagram). Two independent facts need the
// same guards pointed at two independent things — the counts do not drop, and
// one gets stricter: the ORDER Instagram-then-Diamond is now pinned on THREE
// surfaces (the bar, the Me grid, the Passport doors) instead of two, because
// three surfaces printing the same pair is exactly how one of them silently
// reflows.
//
// Consumer web is OTP-gated and has no visual QA path, so this is a SOURCE
// contract, the shape ticket-state-drift and route-structure already use.
//
// WHY PARSED LISTS AND NOT SUBSTRINGS. `expect(SRC).not.toContain("PLAN")`
// looks like the right guard and is not: `PLAN_ORDER`, `PREMIUM_PLAN_ICON`
// and `PREMIUM_PLAN_PRICE_MXN` all contain it, and the comment stating this
// very decision says NO PLAN CELL — so the naive guard fails on the sentence
// it exists to protect, and the cheapest way to green it would be deleting
// that sentence. The precedent is business-web-list-places/payload.test.ts,
// where `!SRC.includes("functions:")` sailed straight past `crenupSteps:`.
// Every assertion below reads a PARSED list — import specifiers, destructured
// bindings, JSX attributes, field labels — so a rename cannot slip through and
// prose about the decision cannot trip it.

const SRC = join(__dirname, "..", "..");

function read(rel: string): string {
  return readFileSync(join(SRC, rel), "utf8");
}

const BAR = "app/(shell)/me/PassportBar.tsx";
const SHEET = "components/consumer/me/PassportModal.tsx";
const CLIENT = "app/(shell)/me/ProfileClient.tsx";
const DATA = "lib/consumer-data.ts";

/** Named specifiers of `import { … } from "<module>"`. `[^}]*` on purpose: a
 *  lazy `[\s\S]*?` starts at the file's FIRST `import {` and runs to the
 *  module string, swallowing every statement in between. */
function importedFrom(source: string, module: string): string[] {
  const escaped = module.replace(/[/\\^$*+?.()|[\]{}]/g, "\\$&");
  const m = source.match(
    new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*["']${escaped}["']`),
  );
  if (!m) return [];
  return m[1]
    .replace(/\/\/[^\n]*/g, "")
    .split(",")
    .map((s) => s.split(/\s+as\s+/)[0].trim())
    .filter(Boolean);
}

/** Bindings of `const { … } = hook()`, renames resolved to the SOURCE key —
 *  `handle: classHandle` is a read of `handle`. */
function destructuredFrom(source: string, hook: string): string[] {
  const m = source.match(
    new RegExp(`const\\s*\\{([^}]*)\\}\\s*=\\s*${hook}\\(\\)`),
  );
  if (!m) throw new Error(`no \`const { … } = ${hook}()\` found`);
  return m[1]
    .replace(/\/\/[^\n]*/g, "")
    .split(",")
    .map((s) => s.split(":")[0].trim())
    .filter(Boolean);
}

/** The attribute text of a self-closing `<Component … />`. */
function selfClosingTag(source: string, component: string): string {
  const start = source.indexOf(`<${component}`);
  if (start === -1) throw new Error(`no <${component}> found`);
  const end = source.indexOf("/>", start);
  if (end === -1) throw new Error(`<${component}> is not self-closing`);
  return source.slice(start, end);
}

const planShaped = (names: string[]) =>
  names.filter((n) => /plan/i.test(n)).sort();

/** Source with comments stripped. A ban on a rendered string has to read the
 *  CODE: the comment explaining why a string is gone necessarily quotes it,
 *  and a guard that fires on its own rationale gets greened by deleting the
 *  rationale — which is the failure mode this whole file exists to prevent. */
const codeOnly = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

describe("the Passport is the page HEADER, and it is the door", () => {
  const bar = read(BAR);

  it("carries BOTH doors, as real links", () => {
    // MESITA-1652 REVERSES MESITA-1646's "no tap target of any kind". The
    // gate asked this question directly, because Instagram is the only reach
    // door in the app and the Class ladder carries "Join with Invitation" —
    // Docs › Passport §C calls it the ONLY entrance for a 10-digit invite
    // PIN. A display-only header plus deleted cells would have stranded both
    // silently. The bar is fixed, so these are 1 tap from anywhere on the
    // page; the cells they replace had to be scrolled to.
    // MESITA-1789: the chips navigate, they do not open stacked sheets.
    // MESITA-2040: to /me/instagram and /me/diamond.
    expect([...bar.matchAll(/<Link\b/g)]).toHaveLength(2);
    expect(bar).toContain("CONSUMER_ROUTES.mePages.instagram");
    expect(bar).toContain("CONSUMER_ROUTES.mePages.diamond");
    // ...and still no plan door. NO PLAN is the older law and it survives.
    for (const prop of ["onOpenPassport", "onOpenProfile", "onOpenPlan"]) {
      expect(bar).not.toContain(prop);
    }
  });

  it("NO chip is parked — the budget is back to zero", () => {
    // MESITA-1652: a dead chip in permanent chrome never scrolls away. That
    // held at zero, went to a budget of one when MESITA-1655 parked WhatsApp,
    // and is back to zero now that the slot carries the login phone
    // (MESITA-1657). The assertion inverts rather than being deleted — a
    // parked chip reappearing up here is still the regression it was written
    // for, whatever it is called.
    expect(bar).not.toMatch(/coming soon/i);
    expect(codeOnly(bar)).not.toMatch(/\bsoon\b/i);
    // Two live doors, and only two: the phone and the name are display.
    // MESITA-1789: doors are Links, not onClick handlers that opened sheets.
    expect([...bar.matchAll(/<Link\b/g)]).toHaveLength(2);
    expect(codeOnly(bar)).not.toMatch(/onClick=\{onOpen/);
  });

  it("the phone is DISPLAY, and formatted by the shared helper", () => {
    // api/profile.ts: the phone is "not editable from the profile sheet" —
    // it is the auth identity. A chip that opened an editor would promise a
    // surface that does not exist.
    //
    // And it is formatted by `formatPhoneDisplay`, whose own doc says it
    // exists so a number never renders as a raw digit run on the passport.
    // A second formatter here is how two surfaces start printing the same
    // number differently.
    expect(importedFrom(bar, "@/lib/utils")).toContain("formatPhoneDisplay");
    expect(bar).toContain("formatPhoneDisplay(profile?.phone)");
    const grid = bar.slice(bar.indexOf('className="grid w-full grid-cols-2'));
    const phoneChip = grid.slice(
      grid.indexOf("{phoneDisplay}") - 400,
      grid.indexOf("{phoneDisplay}"),
    );
    expect(phoneChip).not.toContain("<button");
  });

  it("is fixed by FLEX, not by sticky, and outside the scroller", () => {
    // Me wraps a `flex-1 overflow-y-auto px-4` scroller. A `sticky top-0`
    // inside it would inherit that gutter and fight its z-index; a shrink-0
    // sibling above it is fixed for free and spans the full width.
    expect(bar).toContain("shrink-0");
    // codeOnly, because the header comment must be free to NAME the approach
    // it rejects — DiscoverModeNav's `sticky top-0` — and a guard that fires
    // on its own rationale gets greened by deleting the rationale.
    expect(codeOnly(bar)).not.toContain("sticky");
    const client = read(CLIENT);
    const barMount = client.indexOf("<PassportBar");
    const scroller = client.indexOf("overflow-y-auto");
    expect(barMount).toBeGreaterThan(-1);
    expect(barMount).toBeLessThan(scroller);
  });

  it("drops the three things that did not fit, and none is lost", () => {
    // PASSPORT eyebrow: the bar IS the passport. Public/Private: the Passport
    // CELL still opens the sheet, where privacy belongs. age·sex·country:
    // Profile owns name, photo, birthday. All three stop printing twice.
    const code = codeOnly(bar);
    expect(code).not.toMatch(/>\s*Passport\s*</);
    expect(code).not.toContain('isPublic ? "Public" : "Private"');
    expect(code).not.toContain("detailLine");
    // MESITA-1688 (Pato: "all are public by default"): profile_public
    // defaults true for every account (20260705080000_consumer_profile_
    // visibility.sql) and Settings › Privacy already owns the toggle
    // exclusively, so the sheet dropped the restatement too — it's gone
    // from the passport entirely now, not just moved off the card.
    expect(read(SHEET)).not.toContain("privacy_public");
  });

  it("prints BOTH facts on the bar, AND they are grid cells", () => {
    // THE CELLS ARE BACK, AND THE CHIPS STAY (Pato, MESITA-2040). This
    // inverts MESITA-1787's assertion rather than deleting it, which is the
    // point: that issue banned the cells because the header already stated
    // the same rung, and the ban has to be lifted explicitly now that there
    // is no rung and these are two unrelated destinations. A change that
    // silently drops either chip, or either cell, still has to come here.
    expect(bar).toContain("diamondSummary");
    expect(bar).toContain("instagramSummary");
    const client = codeOnly(read(CLIENT));
    expect(client).toContain('title="Instagram"');
    expect(client).toContain('title="Diamond"');
    // No cell anywhere on Me may name the retired axis.
    expect(client).not.toContain('title="Class"');
    // The chips read the same two values the cells do — one computation, so
    // a chip and its cell cannot disagree about the same account.
    expect(client).toContain("instagramSummary={igSummary}");
    expect(client).toContain("diamondSummary={diamondLabel}");
  });

  it("no longer shares a height with the tab bar, and says so", () => {
    // MESITA-1654 made both bars import SHELL_BAR_MIN_H so they matched by
    // CONSTANT rather than by coincidence. MESITA-1656 made the header a hero
    // block — 254px as drawn, 41% of an 812px viewport once the tab bar is
    // counted. Pato raised it, was answered, and reaffirmed; so the constant
    // has no job and is gone from all three files rather than left orphaned
    // on the nav, where a shared constant with one user is a literal in a
    // costume.
    //
    // The budget assertion it carried (floor under 100px, no open-ended
    // vertical padding) is deliberately NOT reinstated here: it would assert
    // a law the product has abandoned, and a test that lies is worse than no
    // test. The height decision lives in MESITA-1656 and the header comment.
    const nav = readFileSync(
      join(SRC, "components", "consumer", "BottomNav.tsx"),
      "utf8",
    );
    const ui = readFileSync(join(SRC, "lib", "ui-classes.ts"), "utf8");
    expect(ui).not.toContain("SHELL_BAR_MIN_H");
    expect(nav).not.toContain("SHELL_BAR_MIN_H");
    expect(codeOnly(bar)).not.toContain("SHELL_BAR_MIN_H");
    // What DOES stay pinned: the header is a column, so the composition can
    // stack. A row here means someone quietly rebuilt the bar.
    expect(bar).toContain("flex flex-col items-center");
  });

  it("reads Name · Instagram / Phone · Diamond", () => {
    // MESITA-2040 restores MESITA-1653's "insta first" — which MESITA-1656
    // had flipped on the grounds that a left-right call on a single ROW does
    // not survive a 2x2. It survives now for a different reason: Pato named
    // the two facts in this order, and the same order runs down the Me grid
    // and the Passport doors. Order stays pinned because it has been called
    // four times on this header and nothing else would catch a silent
    // reflow.
    const hrefs = [
      ...bar.matchAll(/href=\{CONSUMER_ROUTES\.mePages\.(\w+)\}/g),
    ].map((m) => m[1]);
    expect(hrefs).toEqual(["instagram", "diamond"]);
    const grid = bar.slice(bar.indexOf('className="grid w-full grid-cols-2'));
    expect(grid.indexOf("{name}")).toBeLessThan(
      grid.indexOf("mePages.instagram"),
    );
  });

  it("the three surfaces that print the pair print it in ONE order", () => {
    // The bar's chips, Me's grid cells and the Passport's door tiles. Three
    // copies of the same pair is three chances for one of them to reflow with
    // every gate green, which is why the order is compared ACROSS files
    // rather than pinned three times independently.
    const order = (source: string) =>
      [...source.matchAll(/mePages\.(instagram|diamond)\b/g)].map((m) => m[1]);
    expect(order(bar)).toEqual(["instagram", "diamond"]);
    expect(order(read(SHEET))).toEqual(["instagram", "diamond"]);
    // The client also carries mePages.diamondInvite nowhere and mePages.
    // instagram/diamond exactly once each, in that order.
    expect(order(read(CLIENT))).toEqual(["instagram", "diamond"]);
  });

  it("imports nothing plan-shaped from consumer-data", () => {
    expect(planShaped(importedFrom(bar, "@/lib/consumer-data"))).toEqual([]);
  });

  it("does not read the plan axis off the class context", () => {
    const bound = destructuredFrom(bar, "useConsumerClass");
    // MESITA-2040: the bar reads `facts`, never the storage key. Naming `key`
    // here would put a rung back in the header with nothing to stop it.
    expect(bound).toContain("facts");
    expect(bound).not.toContain("key");
    expect(bound).not.toContain("plan");
    expect(bound).not.toContain("renewsAt");
  });

  it("states the fact in words, so the band and ring may stay aria-hidden", () => {
    // The band and ring are colour-only and aria-hidden on the stated ground
    // that something says the fact in words. That something is the Diamond
    // CHIP's own label, inside this subtree. Losing it makes both
    // undescribed, silently.
    expect(bar).toContain("aria-hidden");
    expect(bar).toContain("Your Mesita passport, Diamond");
    expect(bar).toContain("`Diamond: ${diamondSummary}`");
    expect(bar).toContain("`Instagram: ${instagramSummary}`");
    expect(codeOnly(bar)).not.toContain("Earned, not bought");
  });

  it("wears ONE metal, on exactly two fill surfaces, and it means Diamond", () => {
    // Colour means the fact and lives on the passport (MESITA-1132) — and the
    // passport is the chrome. Exactly two metal FILL surfaces, still: the
    // full-width band and the avatar ring, both off the SAME expression, so
    // they cannot disagree about whether this account is Diamond.
    const code = codeOnly(bar);
    expect([...code.matchAll(/metalFill/g)].length).toBeGreaterThanOrEqual(3);
    expect(code).toContain('diamond ? "bg-tier-diamond" : "bg-border"');
    // NO FOUR-RUNG PALETTE. The helpers took a ClassKey and switched on four
    // metals; importing one back here is how a rung returns to the header.
    for (const helper of [
      "classFillClass",
      "classBadgeClass",
      "classWashClass",
      "classInkClass",
      "CLASS_TEXT",
    ]) {
      expect(code, helper).not.toContain(helper);
    }
    // The wash and the ink survive as Diamond's own, neither a third fill.
    expect(code).toContain("wash-diamond");
    expect(code).toContain("text-diamond");
    // The Instagram chip's brand gradient is platform branding, a different
    // axis than the metal, and was never gated by this rule.
    expect(bar).toContain("INSTAGRAM_ICON_GRADIENT_CLASS");
  });

  it("the skeleton mirrors the DESTINATION — same 2×2, same avatar maths", () => {
    const loading = bar.indexOf("{loading ? (");
    expect(loading).toBeGreaterThan(-1);
    // 80 core + the 2px ring and 1.5px inset on both sides is 87.
    expect(bar).toContain("h-[87px] w-[87px]");
    expect(bar).toContain("h-20 w-20");

    const skeleton = bar.slice(loading, bar.indexOf(") : ("));
    const live = bar.slice(bar.indexOf(") : ("));
    // FOUR chips on both sides, and the same grid. A skeleton resolving to a
    // different shape reflows the bar the moment the profile lands, which
    // reads as a broken render (MESITA-1158).
    const len = skeleton.match(/Array\.from\(\{\s*length:\s*(\d+)\s*\}\)/);
    expect(
      len,
      "the skeleton no longer maps a fixed-length array",
    ).not.toBeNull();
    expect(Number(len![1])).toBe([...live.matchAll(/CHIP_CLASS/g)].length);
    expect(skeleton).toContain("grid-cols-2");
    expect(live).toContain("grid-cols-2");
    // Chip height agrees too — back to 36px now that the header is a hero
    // block (MESITA-1656); a skeleton at any other height is a different bar.
    expect(skeleton).toContain("h-9 animate-pulse");
    expect(bar).toContain("h-9 min-w-0");
  });
});

describe("the Passport sheet is the same document as the bar", () => {
  const sheet = read(SHEET);

  it("imports NOTHING from consumer-data — the ladder's module", () => {
    // It used to import eleven symbols from there: the CLASSES array, the
    // floor, the ceiling, the reach rung, four palette helpers and the
    // caption builder. The document reads `consumer-identity` now, and an
    // import list that is empty is the cheapest possible guard against a rung
    // coming back onto the passport (MESITA-2040).
    expect(importedFrom(sheet, "@/lib/consumer-data")).toEqual([]);
    expect(importedFrom(sheet, "@/lib/consumer-identity")).toContain(
      "diamondSummary",
    );
  });

  it("does not read the plan axis, or the storage key, off the context", () => {
    const bound = destructuredFrom(sheet, "useConsumerClass");
    expect(bound).toContain("facts");
    expect(bound).not.toContain("key");
    expect(bound).not.toContain("plan");
    expect(bound).not.toContain("renewsAt");
  });

  it("each door says its OWN fact, and the caption helper is gone", () => {
    // MESITA-1819: Diamond used to read "Highest discount · Instagram or an
    // invite". A perk glued to a door, so a ceiling guest was told how to
    // reach the class they already held. `passportDoorCaptions` existed to
    // hold those four states apart — and the four states were (floor | mid |
    // ceiling) x (connected | not), which only exist on a ladder.
    //
    // MESITA-2040 deletes the helper rather than porting it, and the ban has
    // to be on the SHAPE, not the name: any caption function that takes both
    // facts at once can glue one to the other again. So the sheet's captions
    // come from the two single-fact helpers and nothing else.
    expect(codeOnly(sheet)).not.toContain("passportDoorCaptions");
    expect(read(DATA)).not.toContain("export function passportDoorCaptions");
    const named = importedFrom(sheet, "@/lib/consumer-identity");
    expect(named.sort()).toEqual([
      "diamondNote",
      "diamondSummary",
      "instagramNote",
      "instagramSummary",
    ]);
    // Each note reads ONE fact. `diamondNote(facts)` is the whole account,
    // deliberately — the helper itself is what cannot mention Instagram, and
    // diamond-and-instagram.test.tsx pins that across every state.
    expect(codeOnly(sheet)).toContain("diamondNote(facts)");
    expect(codeOnly(sheet)).toContain("instagramNote(");
  });

  it("is identity plus two doors — Instagram then Diamond, not a field list", () => {
    // MESITA-1801: the page used to be a settings list (Number · Profile ·
    // Class · Instagram). Identity is a document now; the only buttons are
    // the two doors. Pin via the route hrefs and the absence of Field /
    // Profile / happy talk — not `label="Diamond"`, which also hits the bar.
    const hrefs = [
      ...sheet.matchAll(/href=\{CONSUMER_ROUTES\.mePages\.(\w+)\}/g),
    ].map((m) => m[1]);
    expect(hrefs).toEqual(["instagram", "diamond"]);
    expect(codeOnly(sheet)).not.toContain("function Field");
    expect(codeOnly(sheet)).not.toContain("IdCard");
    expect(codeOnly(sheet)).not.toMatch(/Who you are at Mesita/);
    expect(codeOnly(sheet)).not.toContain("Name, phone, birthday, photo");
    expect(codeOnly(sheet)).not.toMatch(/climb a class/i);
    // A FAILED READ IS STILL NEVER STATED AS A FACT. The sentence moved from
    // "Couldn't load your class" to the invitation, but the guard is the same
    // one and it is the reason the branch exists at all.
    expect(sheet).toContain("Couldn't read your invitation");
  });

  it("carries the two doors the card gave up, and only those two", () => {
    // The bar carries these two as chips (MESITA-1652) and Me carries them as
    // cells (MESITA-2040), so the page is the THIRD path. Keeping it matters:
    // Instagram is the only connect door and Diamond holds the only entrance
    // for a 10-digit PIN (Docs › Passport §C).
    expect(sheet).toContain("CONSUMER_ROUTES.mePages.instagram");
    expect(sheet).toContain("CONSUMER_ROUTES.mePages.diamond");
    // Profile is NOT a door here — it is a cell on Me, one tap away, and a
    // second door to a promoted surface is MESITA-1609's removed-not-demoted.
    expect(sheet).not.toContain("onOpenProfile");
    expect(sheet).not.toContain("CONSUMER_ROUTES.mePages.profile");
    // Destinations are routes, never stacked sheets (MESITA-1789).
    expect(sheet).not.toContain("function handOff");
    expect(codeOnly(sheet)).not.toContain("LocalSheet");
  });

  it("the MRZ is the card's ONLY machine-readable strip — a real code replaces it, never joins it", () => {
    // MESITA-1821, decision 2. The MRZ MESITA-1820 shipped is honest but
    // decorative: real ICAO 7-3-1 check digits, `aria-hidden`, and nothing on
    // earth scans it. The day the Passport carries a genuinely scannable code,
    // the MRZ GOES — it does not sit beside it. Two machine-readable-looking
    // strips on one document, one of them fake, teaches the staff member who
    // tries the wrong one first that the card lies.
    //
    // This is also the only place in apps/web-consumer where decision 1 — AGE,
    // never a full date of birth, once staff read this object — is pinnable at
    // all. The grid's DATE OF BIRTH row is guest-facing and legitimate; the MRZ
    // is the one print on this card that a machine could hand to a stranger,
    // and `buildMrz` puts `YYMMDD` in it. So the guard on "no DOB reaches
    // staff from here" IS the guard on "nothing here scans". The staff payload
    // itself is shaped in supabase `_shared/ticket-check.ts`, another package.
    //
    // PARSED LISTS, per this file's own law: the comment you are reading names
    // `QRCodeSVG` and `qrcode.react`, so a bare `not.toContain("QRCode")`
    // would fire on its own rationale and get greened by deleting it.
    const named = importedFrom(sheet, "@/lib/passport-document");
    expect(named).toContain("buildMrz");
    // The real thing, as `TicketScreen.tsx` renders it today.
    expect(importedFrom(sheet, "qrcode.react")).toEqual([]);
    const rendered = [...codeOnly(sheet).matchAll(/<([A-Z][A-Za-z0-9]*)/g)].map(
      (m) => m[1],
    );
    expect(rendered).toContain("Row");
    expect(rendered.filter((n) => /qr|barcode|scan/i.test(n))).toEqual([]);
    // And the strip stays hidden from the screen reader, which is the other
    // half of "no human reads this": 44 characters of `<` read aloud is
    // hostile, and the grid above already announces every fact it encodes.
    const mrzMount = sheet.indexOf("{mrzLine1}");
    expect(mrzMount).toBeGreaterThan(-1);
    expect(sheet.slice(mrzMount - 400, mrzMount)).toContain("aria-hidden");
  });
});

describe("the plan keeps one door, and only one", () => {
  const client = read(CLIENT);

  it("the Passport bar is handed no plan door", () => {
    expect(selfClosingTag(client, "PassportBar")).not.toContain("onOpenPlan");
  });

  it("Me carries the Plan box itself", () => {
    expect(client).toContain('title="Plan"');
    expect(client).toContain("CONSUMER_ROUTES.mePages.plan");
    expect(client).not.toMatch(/<PlanModal\b/);
  });

  it("nothing carries a second door to the plan or the passport", () => {
    expect(client).not.toContain("MoreModal");
    expect([...client.matchAll(/mePages\.plan/g)]).toHaveLength(1);
    expect(client).not.toContain("onOpenPassport");
    expect([...client.matchAll(/mePages\.passport/g)]).toHaveLength(1);
  });
});

describe("no comment still teaches the rule the code dropped", () => {
  // Comment rot is how this bug was born: MESITA-1464 corrected the docs in
  // 2026-09 and ten comment blocks kept asserting the old law, including
  // globals.css's entire justification for --tier-premium being black.
  //
  // Only AFFIRMATIVE PRESENT-TENSE spellings are banned. A guard on the bare
  // words "plan cell" would fire on the NO PLAN CELL sentinel below and on
  // globals.css's honest account of the history — the decision record, not
  // the drift.
  it.each([BAR, SHEET, DATA, "app/globals.css"])(
    "%s does not claim a three-tile passport",
    (rel) => {
      const source = read(rel);
      expect(source).not.toMatch(/\bthree\s+(passport\s+)?tiles\b/i);
      expect(source).not.toMatch(/in (a|its own) Plan tile/i);
    },
  );

  it("the bar carries the negative-space notes that stop the next agent", () => {
    // A deleted comment leaves no trace of the decision. This is the idiom
    // consumer-data.ts already uses for the `perk` field that must not come
    // back — the only item on the rot list that stops a re-add.
    const bar = read(BAR);
    // The negative space that has to survive a refactor: no plan on the
    // passport, and the fact that the two chips are the ONLY entrance to the
    // connect flow and to the invite PIN — the note that stops the next agent
    // from making one inert, which nearly shipped that way once.
    expect(bar).toContain("NO PLAN");
    expect(bar).toContain("THE BAR IS THE DOOR");
  });
});
