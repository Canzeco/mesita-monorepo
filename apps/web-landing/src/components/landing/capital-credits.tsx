import { Coins, Gift, Landmark } from "lucide-react";

const SPREAD = [
  { amount: "$50", label: "place, today" },
  { amount: "$80", label: "guest pays" },
  { amount: "$100", label: "of food" },
];

// The one dark act on the page: the money system gets the dark treatment,
// matching the product's own arc from the table to the balance sheet.
function CapitalCredits() {
  return (
    <section
      id="money"
      className="bg-foreground text-background border-border border-b"
    >
      <div className="mx-auto w-full max-w-6xl px-5 py-20 md:py-24">
        <p className="text-primary text-xs font-semibold tracking-[0.18em] uppercase">
          Prepayment is the whole game
        </p>
        <h2 className="font-display mt-2 max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">
          The money system.
        </h2>

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
          <article className="border-background/15 bg-background/5 flex flex-col gap-4 rounded-2xl border p-7">
            <span className="bg-pink-gradient flex h-11 w-11 items-center justify-center rounded-2xl text-white">
              <Coins className="h-5 w-5" aria-hidden />
            </span>
            <h3 className="font-display text-xl font-semibold tracking-tight">
              Mesita Credits
            </h3>
            <p className="text-background/70 text-sm leading-relaxed">
              A prepaid balance: put money in, get more out (100 → 110), gift it
              to a friend who opens Mesita with a balance already loaded, and
              spend it at any accepting place — with a little coming back after
              every visit.
            </p>
            <p className="text-background/60 inline-flex items-center gap-2 text-[13px]">
              <Gift className="h-4 w-4 shrink-0" aria-hidden />
              Gifts mint fresh — they never transfer.
            </p>
            <p className="font-display text-background/90 mt-auto text-base italic">
              “A guest who has already paid comes back.”
            </p>
          </article>

          <article className="border-background/15 bg-background/5 flex flex-col gap-4 rounded-2xl border p-7">
            <span className="bg-gold text-foreground flex h-11 w-11 items-center justify-center rounded-2xl">
              <Landmark className="h-5 w-5" aria-hidden />
            </span>
            <h3 className="font-display text-xl font-semibold tracking-tight">
              Mesita Capital
            </h3>
            <p className="text-background/70 text-sm leading-relaxed">
              Mesita pre-buys a restaurant’s future meals at a deep discount and
              resells that inventory to guests. The place gets cash now, the
              guest gets 20% off, and Mesita keeps the spread.
            </p>
            <div className="flex items-center gap-2">
              {SPREAD.map((s, i) => (
                <div key={s.amount} className="flex flex-1 items-center gap-2">
                  <div
                    className={`flex-1 rounded-xl px-2 py-3 text-center ${
                      i === 1
                        ? "bg-gold text-foreground"
                        : "border-background/20 bg-background/5 border"
                    }`}
                  >
                    <span className="font-display block text-xl font-semibold tracking-tight">
                      {s.amount}
                    </span>
                    <span
                      className={`block text-[10px] tracking-[0.08em] uppercase ${
                        i === 1 ? "text-foreground/70" : "text-background/60"
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                  {i < SPREAD.length - 1 && (
                    <span className="text-primary text-lg" aria-hidden>
                      →
                    </span>
                  )}
                </div>
              ))}
            </div>
            <p className="font-display text-background/90 mt-auto text-base italic">
              “An advance sale of food, never a loan.”
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}

export { CapitalCredits };
