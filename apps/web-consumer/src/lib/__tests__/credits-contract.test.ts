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
    "src/app/(shell)/new-visit/wallet/buy/BuyClient.tsx",
    "src/app/(shell)/new-visit/wallet/gift/GiftClient.tsx",
    "src/app/(shell)/new-visit/wallet/redeem/RedeemClient.tsx",
    "src/app/(shell)/new-visit/wallet/balance/[id]/BalanceClient.tsx",
    "src/lib/credits.ts",
    "src/lib/api/credits.ts",
    "src/lib/use-credit-balances.ts",
  ];
  const CONTAINER_SRC = ["src/app/(shell)/new-visit/wallet/CreditsClient.tsx"];

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
describe("wallet block order", () => {
  const CLIENT = readFileSync(
    join(__dirname, "..", "..", "app", "(shell)", "new-visit", "wallet", "CreditsClient.tsx"),
    "utf8",
  );

  it("puts Cards above Credits", () => {
    const cards = CLIENT.indexOf('aria-label="Cards"');
    const credits = CLIENT.indexOf('aria-label="Credits"');
    expect(cards).toBeGreaterThan(-1);
    expect(credits).toBeGreaterThan(-1);
    expect(cards).toBeLessThan(credits);
  });

  it("renders Ways to pay only while the guest holds nothing", () => {
    expect(CLIENT).toMatch(/balances\.length === 0 \? <WaysToPay \/> : null/);
  });

  it("mounts the shared card list, never a second one", () => {
    expect(CLIENT).toContain("useConsumerCards");
    expect(CLIENT).toContain("<CardList");
    expect(CLIENT).not.toContain("apiListCards");
  });
});
