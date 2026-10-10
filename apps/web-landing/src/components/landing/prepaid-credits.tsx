import { Coins, Gift, Wallet, type LucideIcon } from "lucide-react";

// Prepaid Credits, from the guest's side: pay 100, spend 110. The place sets
// the bonus and Mesita never subsidizes it — the same rule the rewards
// section states for the discount.
const FACTS: { label: string; body: string; Icon: LucideIcon }[] = [
  {
    label: "A bonus for paying early.",
    body: "The place sets it. You keep it.",
    Icon: Coins,
  },
  {
    label: "One balance per place.",
    body: "You always know where it spends.",
    Icon: Wallet,
  },
  {
    label: "Give it away.",
    body: "A favorite place, sent to a friend in a tap.",
    Icon: Gift,
  },
];

function PrepaidCredits() {
  return (
    <section id="prepay" className="border-border border-b">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 md:py-24">
        <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2">
          {/* The wallet card first on desktop: the number is the pitch. */}
          <div className="border-border bg-hero shadow-elev order-2 flex flex-col gap-5 rounded-3xl border p-8 md:order-1">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-muted-foreground text-xs font-semibold tracking-[0.1em] uppercase">
                  Your wallet
                </p>
                <p className="font-display mt-1 text-xl font-semibold tracking-tight">
                  Mission Taqueria
                </p>
              </div>
              <span className="border-secondary/40 text-secondary rounded-full border px-3 py-1 text-[11px] font-bold">
                +10% bonus
              </span>
            </div>
            <div className="border-border bg-background/70 flex items-end justify-between rounded-2xl border p-5">
              <div>
                <p className="text-muted-foreground text-[11px] font-medium">
                  You paid
                </p>
                <p className="font-display text-2xl font-semibold tracking-tight">
                  $100
                </p>
              </div>
              <div className="text-right">
                <p className="text-muted-foreground text-[11px] font-medium">
                  You spend
                </p>
                <p className="font-display text-secondary text-2xl font-semibold tracking-tight">
                  $110
                </p>
              </div>
            </div>
            <p className="text-muted-foreground text-[11px] leading-snug">
              Spends only here. Your rewards still apply on top at the table.
            </p>
          </div>

          <div className="order-1 flex flex-col gap-5 md:order-2">
            <p className="text-primary text-xs font-semibold tracking-[0.18em] uppercase">
              Prepaid Credits · pay before you go, get more than you paid
            </p>
            <h2 className="font-display max-w-xl text-3xl font-semibold tracking-tight md:text-4xl">
              Buy the meal ahead. Get a bonus for it.
            </h2>
            <p className="text-muted-foreground max-w-xl text-base leading-relaxed">
              Buy credit at a place you love before you visit, with the bonus
              the place offers: pay 100, spend 110. It sits in your wallet, one
              balance per place, and you spend it at the table with your rewards
              on top. Get credit as a gift, or send it to a friend for a place
              they need to try.
            </p>
            <p className="text-muted-foreground max-w-xl text-sm leading-relaxed">
              Card, Apple Pay, and Google Pay, straight from your phone into the
              restaurant’s own account.
            </p>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {FACTS.map(({ label, body, Icon }) => (
            <div
              key={label}
              className="border-border bg-card flex items-start gap-3 rounded-2xl border px-5 py-4"
            >
              <span className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
                <Icon className="h-4.5 w-4.5" aria-hidden />
              </span>
              <span>
                <span className="block text-sm font-semibold">{label}</span>
                <span className="text-muted-foreground block text-[13px] leading-relaxed">
                  {body}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export { PrepaidCredits };
