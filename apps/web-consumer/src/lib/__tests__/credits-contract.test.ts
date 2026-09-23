import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The Wallet's real-balances contract (MESITA-1674). This file carries three
// separate guards, all formerly split across credits-mock.test.ts (deleted
// with the emulator it tested) and CreditsClient's own naming/order tests:
//
//   1. THE SOURCE-TEXT CONTRACT THE ISSUE ASKS FOR — no file under src/
//      imports the deleted emulator modules. Two sources of truth for a
//      balance was the bug; this is what keeps it from coming back by way of
//      a stray import nobody noticed.
//   2. THE NAMING RULE (moved from credits-mock.test.ts) — money files must
//      never name a balance after its container.
//   3. THE WALLET'S BLOCK ORDER (moved from credits-mock.test.ts) — Cards
//      above Credits is the most contested decision on this screen and
//      Pato overruled two design passes to get it; anyone reversing it
//      should have to delete this test to do it.

const SRC_ROOT = join(__dirname, "..", "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe("the deleted Credits emulator has no surviving import", () => {
  const files = walk(SRC_ROOT);

  it("scanned more than a handful of files (guards the walker itself)", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  // The import-ALIAS form specifically (`@/lib/...`, no `.ts`) — this
  // codebase imports exclusively through that alias (never a relative
  // `../mock/...`), so a real import always contains this exact substring.
  // Prose that merely NAMES a deleted file for history (this file's own
  // banned list included, plus a handful of "was `src/lib/mock/x.ts`" notes
  // left on its real replacements) uses the `src/lib/...ts` reading form
  // instead, which does not collide with this needle.
  const BANNED = [
    "@/lib/mock/credits-emulator",
    "@/lib/mock/credits-mock",
    "@/lib/mock/use-credits",
    "@/lib/credits-demo",
  ];

  it.each(BANNED)("no file imports %s", (needle) => {
    const offenders = files
      // This file's own BANNED list literally contains every needle above —
      // exclude it or every run would flag itself.
      .filter((f) => f !== __filename)
      .filter((f) => readFileSync(f, "utf8").includes(needle));
    expect(offenders).toEqual([]);
  });
});

// ── The naming rule (moved from credits-mock.test.ts) ──────────────────────
//
// The MONEY files must never name a balance after the container — an
// instrument called WalletBalance is the drift this catches, and the
// instrument is Credits. CreditsClient is exempt from that half alone,
// because it renders the container and legitimately names a row type after
// it. Prepay* stays banned everywhere: a prepay is how you acquire Credits,
// never what you hold.
describe("naming", () => {
  const MONEY_SRC = [
    "src/components/consumer/credits/BalanceCard.tsx",
    "src/components/consumer/credits/BalanceList.tsx",
    "src/components/consumer/credits/PickCredits.tsx",
    "src/app/(shell)/wallet/buy/BuyClient.tsx",
    "src/app/(shell)/wallet/gift/GiftClient.tsx",
    "src/app/(shell)/wallet/redeem/RedeemClient.tsx",
    "src/app/(shell)/wallet/balance/[id]/BalanceClient.tsx",
    "src/lib/credits.ts",
    "src/lib/api/credits.ts",
    "src/lib/use-credit-balances.ts",
  ];
  const CONTAINER_SRC = ["src/app/(shell)/wallet/CreditsClient.tsx"];

  // The FRAME may be named after the container, because it IS the container.
  const FRAME = /^(WalletScreen|WalletParkedNote)$/;

  function read(rel: string): string {
    return readFileSync(join(__dirname, "..", "..", "..", rel), "utf8");
  }

  it.each(MONEY_SRC)("%s declares no Wallet* identifier", (rel) => {
    const hits = (read(rel).match(/\bWallet[A-Z]\w*/g) ?? []).filter(
      (name) => !FRAME.test(name),
    );
    expect(hits).toEqual([]);
  });

  it.each([...MONEY_SRC, ...CONTAINER_SRC])(
    "%s declares no Prepay* identifier",
    (rel) => {
      expect(read(rel).match(/\bPrepay[A-Z]\w*/g) ?? []).toEqual([]);
    },
  );
});

// ── The Wallet's block order (MESITA-1673) ──────────────────────────────────
//
// A SOURCE-TEXT CONTRACT, because this package runs Vitest with environment
// "node" and the ordering cannot be observed any other way. Both design
// passes on the Credits plan argued the guest's own money should lead the
// surface they opened to check it, and Pato overruled them: Credits must
// never read as REQUIRED, and putting the ordinary way to pay first is what
// says the prepaid balance under it is optional.
/** Source with comments removed. These files DOCUMENT the patterns they must
 *  not contain ("the first version drew a `border-b`…"), so a raw substring
 *  match fails on the explanation rather than on the code. */
function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("wallet block order", () => {
  const PANEL = readFileSync(
    join(__dirname, "..", "..", "components", "consumer", "wallet", "WalletPanel.tsx"),
    "utf8",
  );
  const CARD_LIST = readFileSync(
    join(__dirname, "..", "..", "components", "consumer", "me", "CardList.tsx"),
    "utf8",
  );
  const CLIENT = readFileSync(
    join(__dirname, "..", "..", "app", "(shell)", "wallet", "CreditsClient.tsx"),
    "utf8",
  );

  it("puts Ways to pay, then Cards, then Credits", () => {
    const ways = CLIENT.indexOf('title="Ways to pay"');
    const cards = CLIENT.indexOf('title="Cards"');
    const credits = CLIENT.indexOf('title="Credits"');
    expect(ways).toBeGreaterThan(-1);
    expect(cards).toBeGreaterThan(-1);
    expect(credits).toBeGreaterThan(-1);
    expect(ways).toBeLessThan(cards);
    expect(cards).toBeLessThan(credits);
  });

  it("renders Ways to pay unconditionally", () => {
    // REVERSED, MESITA-1696 (Pato, 2026-09-08 wireframe). The block used to
    // render only while `balances.length === 0`, on the theory that it is read
    // once and then becomes furniture above the number the guest opened the
    // app to see. Pato drew it above a wallet that HAS balances: a guest who
    // prepaid one place has more need, not less, of the line saying the other
    // three tenders still exist. Anyone re-adding a condition here is undoing
    // that and should have to delete this test to do it.
    expect(CLIENT).toContain("<WaysToPay />");
    expect(CLIENT).not.toMatch(/balances\.length === 0 \? <WaysToPay/);
  });

  it("wears one section chrome — every block is a WalletPanel", () => {
    // "Put in boxes, modularize" (Pato, 2026-09-08). Ways to pay was a
    // bordered card and the other two were bare headings; three blocks, two
    // chrome systems. A hand-rolled section header reappearing in this file is
    // the regression — including the one an un-boxed section invites, which is
    // why `chrome="none"` is a rung of the shared component and not a `<div>`
    // written here.
    // `code()`, not raw: this file's own header now explains that WalletPanel
    // renders the `<section>` at every rung, and a raw match would flag the
    // explanation instead of the code.
    expect(CLIENT).toContain("WalletPanel");
    expect(code(CLIENT)).not.toContain("<section");
    expect(code(CLIENT)).not.toContain("SectionHead");
  });

  it("ranks the three blocks — one object, three chrome values", () => {
    // MESITA-1825. ONE OBJECT IS NOT ONE LOOK. MESITA-1708 mounted all three
    // sections in WalletPanel and the component had exactly one appearance, so
    // the screen became three identical boxes with three identical legends —
    // "App UI made of stacked cards instead of layout", and the second "wtf is
    // that" in a row. Order is locked (Pato re-confirmed it 2026-09-13 with
    // the reversal on the table), so rank CANNOT come from position; it comes
    // from weight, and a second `raised` would flatten the ladder again.
    const bare = code(CLIENT);
    const at = (needle: string) => bare.indexOf(needle);
    expect(at('chrome="none"')).toBeGreaterThan(-1);
    expect(at('chrome="raised"')).toBeGreaterThan(-1);
    // The unboxed rung is Ways to pay, the raised rung is Credits.
    expect(at('chrome="none"')).toBeLessThan(at('title="Cards"'));
    expect(at('title="Cards"')).toBeLessThan(at('chrome="raised"'));
    // Exactly one of each: two raised panels is no hierarchy.
    expect(bare.match(/chrome="raised"/g)).toHaveLength(1);
    expect(bare.match(/chrome="none"/g)).toHaveLength(1);
  });

  it("keeps the landmark on the rung that lost its box", () => {
    // Un-boxing by hand would have dropped the <section> and its accessible
    // name with the border. WalletPanel renders both at every rung, so the
    // element is the constant and only the chrome varies.
    const panel = code(PANEL);
    expect(panel).toContain("<section");
    expect(panel).toContain("aria-label");
    // `none` must be a real rung of the ladder, not an alias for `flat`.
    expect(panel).toMatch(/none:\s*""/);
  });

  it("names money on the screen about money", () => {
    // MESITA-1825. The Wallet carried no amount anywhere — not even a zero.
    // "You have zero" is an answer; a bold sentence and no figure is not.
    expect(code(CLIENT)).toContain("WalletMoney");
    expect(code(CLIENT)).toContain("formatCurrency(0)");
  });

  it("computes no grand total across balances", () => {
    // D3, and this one is arithmetic rather than taste:
    // consumer-web-list-credit-balances returns no total and pages by keyset,
    // so any client-side sum is wrong the moment `hasMore` is true. Credits
    // are org-scoped besides, so a cross-org figure is money that cannot be
    // spent as one number anywhere. WalletMoney is empty-state only.
    const bare = code(CLIENT);
    expect(bare).not.toMatch(/\.reduce\(/);
    expect(bare).not.toMatch(/spendableCents\s*\+/);
    // The figure sits in the `balances.length === 0` branch, above the Buy
    // link that only that branch renders.
    // `<WalletMoney`, not `WalletMoney` — the bare name matches the import at
    // the top of the file, which is before every branch by definition.
    const empty = bare.indexOf("balances.length === 0");
    expect(empty).toBeGreaterThan(-1);
    expect(bare.indexOf("<WalletMoney")).toBeGreaterThan(empty);
  });

  it("gives the section actions a 44px hit box once they stop being pills", () => {
    // MESITA-1708 D5 measured that floor on these buttons; MESITA-1825 D4 took
    // the fill off them. A link that looks like text is the easiest place to
    // lose a touch target, so the padding that restores it is load-bearing and
    // not decoration — `py-3` around `text-sm` is 44px.
    const bare = code(CLIENT);
    for (const constant of ["ADD_BUTTON_CLASS", "HeadAction"]) {
      expect(bare, constant).toContain(constant);
    }
    expect(bare).toMatch(/const ADD_BUTTON_CLASS =[\s\S]*?py-3/);
    // No filled pink pills left beside the one solid button.
    expect(bare).not.toContain("bg-primary/10");
  });

  it("spans Buy across its panel", () => {
    // MESITA-1825. It sat left-aligned at the bottom of the third of three
    // equal boxes — the least-looked-at pixel on the screen.
    expect(code(CLIENT)).toMatch(/const BUY_BUTTON_CLASS =[\s\S]*?w-full/);
  });

  it("puts the error in the panel that failed", () => {
    // MESITA-1825 D5. A failed balance read used to announce itself as a red
    // line pinned under the tab bar, two panels away from the Credits section
    // that merely looked empty.
    const bare = code(CLIENT);
    const credits = bare.indexOf('title="Credits"');
    const alert = bare.indexOf('role="alert"');
    expect(alert).toBeGreaterThan(credits);
    expect(alert).toBeLessThan(bare.lastIndexOf("</WalletPanel>"));
  });

  it("never prints MX$0 over a read that failed", () => {
    // MESITA-2051. With nothing loaded, a failed read fell through to the
    // zero state, so a guest holding money was shown "MX$0 · No balances
    // yet" with the alert underneath. The failed branch must come BEFORE the
    // zero branch and offer a 44px Try again; the trailing alert only renders
    // once balances exist, so the error prints exactly once.
    const bare = code(CLIENT);
    const failed = bare.indexOf("credits.error && balances.length === 0 ?");
    const zero = bare.indexOf("<WalletMoney");
    expect(failed).toBeGreaterThan(-1);
    expect(failed).toBeLessThan(zero);
    const branch = bare.slice(failed, zero);
    expect(branch).toContain('role="alert"');
    expect(branch).toContain("credits.reload()");
    expect(branch).toContain("min-h-11");
    expect(bare).toContain("credits.error && balances.length > 0 ?");
    expect(bare.match(/role="alert"/g)).toHaveLength(2);
  });

  it("separates Gift and Redeem with a dot outside both links", () => {
    // MESITA-2051. Two bold words 8px apart read as one phrase, "Gift Redeem".
    // The dot is a sibling so neither 44px hit box grows.
    const bare = code(CLIENT);
    const between = bare.slice(
      bare.indexOf("CONSUMER_ROUTES.wallet.gift"),
      bare.indexOf("CONSUMER_ROUTES.wallet.redeem"),
    );
    expect(between).toContain("</HeadAction>");
    expect(between).toMatch(/<span aria-hidden[^>]*>\s*·\s*<\/span>/);
  });

  it("skeletons the money line, not only the card", () => {
    // MESITA-1825 T5. Skeletoning only the card height meant the figure above
    // it popped in from nothing on every load — the one element the eye is
    // already aimed at.
    // `height: CARD_PX`, not `CARD_PX` — the bare name matches the import line
    // at the top, which would make this slice run backwards and always pass
    // empty. The money skeleton is the one BEFORE the card-sized one.
    const bare = code(CLIENT);
    const loading = bare.indexOf("credits.loading ?");
    const card = bare.indexOf("height: CARD_PX");
    expect(loading).toBeGreaterThan(-1);
    expect(card).toBeGreaterThan(loading);
    expect(bare.slice(loading, card).match(/<Skeleton/g) ?? []).not.toHaveLength(
      0,
    );
  });

  it("keeps the display face off the panel titles", () => {
    // MESITA-1708. globals.css puts h1-h3 in Fraunces, and brand.json scopes
    // that face to "h1-h3, the wordmark, numerals in hero positions". A 14px
    // serif repeated as a section legend is none of those, and it is what made
    // this screen read as a settings form. `font-sans` is the override; losing
    // it silently returns the serif.
    expect(code(PANEL)).toContain("font-sans");
  });

  it("draws no divider under a panel header", () => {
    // MESITA-1708. The border-b was the strongest line on the screen and it
    // separated a title from its own content. Three panels meant six rules,
    // which is the stacked-cards pattern web-consumer/CLAUDE.md calls a
    // regression in its first line.
    // \b on BOTH sides: a bare /border-b/ is a substring of the panel's own
    // `border-border` outline, which is correct and stays.
    expect(code(PANEL)).not.toMatch(/\bborder-b\b/);
  });

  it("puts no container inside a panel", () => {
    // MESITA-1708. Both zero states used to be a box inside a box: Cards drew
    // a dashed outline, Credits mounted the screen-scale EmptyState (icon
    // tile, display headline, centred, pb-10) inside a 200px panel.
    expect(code(CARD_LIST)).not.toContain("border-dashed");
    expect(code(CLIENT)).not.toContain("<EmptyState");
    expect(code(CLIENT)).not.toContain("shared/EmptyState");
    expect(code(CLIENT)).toContain("WalletPanelEmpty");
  });

  it("gives Buy the only solid button, out of the header pill row", () => {
    // MESITA-1708 D4. Buy was the first of three identical pink pills beside
    // Gift and Redeem. Buying is the only act here that creates anything;
    // Redeem is the one most guests never use.
    expect(CLIENT).toContain("BUY_BUTTON_CLASS");
    const bare = code(CLIENT);
    const actions = bare.slice(bare.indexOf('title="Credits"'));
    const head = actions.slice(0, actions.indexOf("</WalletPanel>"));
    const headActions = head.slice(0, head.indexOf("{credits.loading"));
    expect(headActions).not.toContain("walletBuy");
  });

  it("leaves the Stripe disclosure left-aligned and undimmed", () => {
    // MESITA-1825 D6. Dimming legal copy with `/80` thinned the one sentence
    // that says who holds the card number below the contrast every other
    // secondary line on the screen holds; centring it made the longest string
    // in the panel the only one not on the gutter.
    const disclosure = code(CARD_LIST).slice(
      code(CARD_LIST).indexOf("export function CardsDisclosure"),
    );
    expect(disclosure).not.toContain("text-center");
    expect(disclosure).not.toContain("text-muted-foreground/80");
  });

  it("mounts the shared card list, never a second one", () => {
    expect(CLIENT).toContain("useConsumerCards");
    expect(CLIENT).toContain("<CardList");
    expect(CLIENT).not.toContain("apiListCards");
  });
});

// ── Ways to pay names FOUR tenders (MESITA-1696) ─────────────────────────────
//
// Pato, 2026-09-08: "btw in fact four ways to pay. 1. Cash 2. Card 3. Mesita
// Online Payments 4. Mesita Credits Payments."
//
// The list said Cash · Cards · Credits, and "Cards" was doing two jobs: the
// card a guest hands to the place, and the card MESITA charges on their
// behalf. Those are two rails with two different holders of the money, and
// consumer-web-select-ticket-payment has separated them since MESITA-1414
// (`at_place` vs `mesita_pay`) — the wallet was the last surface pretending
// they were one tender. Collapsing them back is the regression this guards.
describe("ways to pay", () => {
  const WAYS = readFileSync(
    join(__dirname, "..", "..", "components", "consumer", "credits", "WaysToPay.tsx"),
    "utf8",
  );

  it("names all four, in Pato's order", () => {
    const at = (needle: string) => {
      const i = WAYS.indexOf(needle);
      expect(i, needle).toBeGreaterThan(-1);
      return i;
    };
    const order = [
      at('title: "Cash"'),
      at('title: "Card"'),
      at('title: "Mesita Online Payments"'),
      at('title: "Mesita Credits Payments"'),
    ];
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("groups them by who ends up with the money", () => {
    // "Do I need cash on me" is answered by the first group and nothing else,
    // and it is the same split StepPay uses at the moment of payment.
    expect(WAYS).toContain("At the place");
    expect(WAYS).toContain("Through Mesita");
  });

  it("names Credits as a bill reduction, not a full settlement", () => {
    expect(WAYS).toMatch(/tag: "On your bill"/);
  });

  it("never calls Credits a way to settle the whole bill", () => {
    // 20260831121954_credits_rename.sql: Credits settle as a bill REDUCTION,
    // applying only to (subtotal - discount), never the tip. A guest told
    // otherwise expects MX$2,000 to cover a MX$1,800 bill plus tip.
    expect(WAYS).toContain("never the tip");
  });

  it("names all four without expanding by default", () => {
    // MESITA-1708. The block shipped fully expanded and CLIPPED MID-ROW at
    // 390x844 — first paint was a sentence cut in half. The NAMES are what
    // MESITA-1696 was for, so four chips always render; the paragraphs sit
    // behind aria-expanded.
    expect(WAYS).toContain("useState");
    expect(WAYS).toContain("aria-expanded");
    expect(WAYS).toMatch(/chip: "Cash"/);
    expect(WAYS).toMatch(/chip: "Credits"/);
  });

  it("promises no rail that does not exist", () => {
    // There is no Stripe wallet button anywhere in this app.
    expect(WAYS).not.toMatch(/Apple Pay|Google Pay/);
  });

  it("draws the names as words, not pills that look pressable", () => {
    // MESITA-2051. The four names shipped as filled pills, the exact shape of
    // a button, under a comment saying nothing here is pressable. Ink still
    // carries liveness: live tenders stay foreground, Credits stays muted.
    const bare = code(WAYS);
    const chips = bare.slice(
      bare.indexOf("function Chips"),
      bare.indexOf("function GroupLabel"),
    );
    expect(chips).not.toContain("rounded-full");
    expect(chips).not.toContain("bg-muted");
    expect(chips).toContain("aria-hidden");
    expect(chips).toContain('"text-foreground');
  });
});

describe("the balance page", () => {
  const BALANCE = readFileSync(
    join(__dirname, "..", "..", "app", "(shell)", "wallet", "balance", "[id]", "BalanceClient.tsx"),
    "utf8",
  );

  it("says spending is parked right under the summary, not at the bottom", () => {
    // MESITA-2051. "You cannot spend this yet" is the most useful fact on the
    // page while THE TICKET's Credits row is parked (MESITA-2052), and it was
    // the last line, under the purchase history.
    const bare = code(BALANCE);
    const note = bare.indexOf("<WalletParkedNote>");
    expect(note).toBeGreaterThan(-1);
    expect(note).toBeLessThan(bare.indexOf("<dl"));
    expect(note).toBeLessThan(bare.indexOf("Purchases"));
    expect(bare.match(/<WalletParkedNote>/g)).toHaveLength(1);
  });
});
