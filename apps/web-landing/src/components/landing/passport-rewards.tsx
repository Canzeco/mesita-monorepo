import { Lock, QrCode, ShieldCheck, Star } from "lucide-react";
import { SectionHeader } from "@/components/landing/section-header";

const CLASSES = ["Bronze", "Silver", "Gold", "Diamond"] as const;

const REWARD_ROWS = [
  { label: "Base", visit: "every guest", order: "remote tier" },
  { label: "Welcome", visit: "first visit", order: "first order" },
  { label: "Class", visit: "Bronze → Diamond", order: "same ladder" },
  { label: "Plan", visit: "Free / Premium", order: "Free / Premium" },
  { label: "Sharing", visit: "story · review", order: "—" },
];

// Two halves, one argument: identity (what a place buys) and the table it
// buys against. The plan row is rendered obscured on purpose — the privacy
// rule is a product invariant, so the design has to show it, not assert it.
function PassportRewards() {
  return (
    <section id="passport" className="border-border border-b">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 md:py-24">
        <SectionHeader
          eyebrow="A discount table that behaves like a market"
          title="Identity is what partners buy."
          aside="The best guests get the best offers, and places compete for the people who fill the room."
        />

        <div className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="border-border bg-hero shadow-elev flex flex-col gap-5 rounded-3xl border p-8">
            <div className="border-border bg-card/80 rounded-2xl border p-5 backdrop-blur">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.16em] uppercase">
                    Mesita Passport
                  </p>
                  <p className="font-display mt-1 text-xl font-semibold tracking-tight">
                    Ana R.
                  </p>
                </div>
                <span className="bg-gold text-foreground inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold">
                  <Star className="h-3.5 w-3.5" aria-hidden />
                  Gold
                </span>
              </div>
              <div className="border-border mt-4 flex items-center justify-between border-t pt-4">
                <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
                  <Lock className="h-3.5 w-3.5" aria-hidden />
                  Plan
                </span>
                <span
                  className="text-muted-foreground/70 rounded text-sm font-semibold blur-[5px] select-none"
                  aria-hidden
                >
                  Premium
                </span>
                <span className="sr-only">private</span>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <QrCode className="text-foreground h-9 w-9" aria-hidden />
                <p className="text-muted-foreground text-[11px] leading-snug">
                  Scanned at the table — the discount lands on the bill before
                  you pay.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {CLASSES.map((c) => (
                <span
                  key={c}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
                    c === "Gold"
                      ? "bg-gold text-foreground border-transparent font-bold"
                      : "border-border bg-background/70 text-muted-foreground"
                  }`}
                >
                  {c}
                </span>
              ))}
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">
              The <span className="text-foreground font-medium">class</span> is
              public, climbed through Instagram reach or an invitation, and{" "}
              <span className="text-foreground font-medium">
                never for sale
              </span>
              . The <span className="text-foreground font-medium">plan</span> is
              private: it raises your rewards everywhere, and{" "}
              <span className="text-foreground font-medium">
                no place ever learns who pays
              </span>
              .
            </p>
          </div>

          <div className="border-border bg-card flex flex-col gap-4 rounded-3xl border p-8">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold tracking-tight">
                One rewards table
              </h3>
              <span className="border-secondary/40 text-secondary rounded-full border px-3 py-1 text-[11px] font-bold">
                $25 cap
              </span>
            </div>
            <div className="border-border divide-border divide-y overflow-hidden rounded-2xl border">
              <div className="text-muted-foreground bg-muted/50 grid grid-cols-[1fr_1fr_1fr] gap-2 px-4 py-2 text-[10px] font-semibold tracking-[0.1em] uppercase">
                <span>Reward</span>
                <span>Visits</span>
                <span>Pickup</span>
              </div>
              {REWARD_ROWS.map((r) => (
                <div
                  key={r.label}
                  className="grid grid-cols-[1fr_1fr_1fr] items-center gap-2 px-4 py-2.5 text-[12px]"
                >
                  <span className="font-semibold">{r.label}</span>
                  <span className="text-muted-foreground">{r.visit}</span>
                  <span className="text-muted-foreground">{r.order}</span>
                </div>
              ))}
            </div>
            <p className="text-muted-foreground inline-flex items-start gap-2 text-[13px] leading-relaxed">
              <ShieldCheck
                className="text-secondary mt-0.5 h-4 w-4 shrink-0"
                aria-hidden
              />
              Every reward is funded by the place itself — never subsidized —
              and capped, so a bold offer never becomes an open liability.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export { PassportRewards };
