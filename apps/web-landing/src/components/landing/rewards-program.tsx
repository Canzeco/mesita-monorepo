import {
  Instagram,
  Lock,
  type LucideIcon,
  QrCode,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  UserPlus,
} from "lucide-react";
import { SectionHeader } from "@/components/landing/section-header";

const CLASSES = ["Bronze", "Silver", "Gold", "Diamond"] as const;

// Four of the five rewards. Each carries its REASON, not just its trigger —
// a reward nobody can explain reads as a coupon. Sharing is deliberately
// not in this grid: it gets the dominant block below, because it is the
// only reward the place earns back.
const REWARDS: {
  label: string;
  when: string;
  why: string;
  Icon: LucideIcon;
}[] = [
  {
    label: "Base",
    when: "Every guest, every visit",
    why: "The floor. It is what makes the place worth opening the app for on an ordinary Tuesday.",
    Icon: Store,
  },
  {
    label: "Welcome",
    when: "First visit only",
    why: "The hardest visit to buy is the first one. This is the reward that turns discovery into a guest.",
    Icon: UserPlus,
  },
  {
    label: "Class",
    when: "Bronze → Diamond",
    why: "Presence. The guests who create the atmosphere everyone else came for, priced accordingly.",
    Icon: Star,
  },
  {
    label: "Plan",
    when: "Free / Premium",
    why: "Commitment. Private by design — the floor never learns who pays, so it never feels unfair.",
    Icon: Lock,
  },
];

// The two shared actions. Verified in the app BEFORE the discount releases —
// that ordering is the whole product, so the copy has to lead with it.
const SHARING = [
  {
    label: "Instagram Story",
    body: "A story tagging the place and @mesita, verified in the app before the discount releases. Repeatable every single visit.",
    proof: "Guaranteed, authentic, measurable reach",
    Icon: Instagram,
  },
  {
    label: "Google Review",
    body: "Posted at the table and verified, once per guest per place. Any rating qualifies — never sentiment-gated, so the signal stays honest.",
    proof: "The rung that compounds after the guest leaves",
    Icon: Sparkles,
  },
];

function RewardsProgram() {
  return (
    <section id="rewards" className="border-border border-b">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 md:py-24">
        <SectionHeader
          eyebrow="Rewards Program"
          title="Every reward has a reason."
          aside="Five rewards on one table. A place funds them itself and picks which ones it runs — so the discount table behaves like a market."
        />

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {REWARDS.map(({ label, when, why, Icon }) => (
            <article
              key={label}
              className="border-border bg-card flex flex-col gap-3 rounded-2xl border p-6"
            >
              <span className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-2xl">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h3 className="font-display text-lg font-semibold tracking-tight">
                  {label}
                </h3>
                <p className="text-primary text-[11px] font-semibold tracking-[0.1em] uppercase">
                  {when}
                </p>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {why}
              </p>
            </article>
          ))}
        </div>

        {/* Sharing dominates the section on purpose: it is the only reward
            the place gets paid back for, so it earns the width. */}
        <div className="border-primary/30 bg-hero shadow-elev mt-4 rounded-3xl border p-8 md:p-10">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-primary text-xs font-semibold tracking-[0.18em] uppercase">
                Sharing · the reward that pays the place back
              </p>
              <h3 className="font-display mt-2 max-w-2xl text-2xl font-semibold tracking-tight md:text-3xl">
                Every discounted visit doubles as promotion.
              </h3>
            </div>
            <p className="text-muted-foreground max-w-xs text-sm leading-relaxed">
              The other four rewards buy a visit. This one buys a visit{" "}
              <span className="text-foreground font-medium">and</span> the reach
              that brings the next guest.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
            {SHARING.map(({ label, body, proof, Icon }) => (
              <article
                key={label}
                className="border-border bg-card/85 flex flex-col gap-3 rounded-2xl border p-6 backdrop-blur"
              >
                <div className="flex items-center gap-3">
                  <span className="bg-pink-gradient flex h-10 w-10 items-center justify-center rounded-2xl text-white">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <h4 className="font-display text-lg font-semibold tracking-tight">
                    {label}
                  </h4>
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {body}
                </p>
                <p className="text-secondary inline-flex items-start gap-2 text-[13px] font-medium">
                  <ShieldCheck
                    className="mt-0.5 h-4 w-4 shrink-0"
                    aria-hidden
                  />
                  {proof}
                </p>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_1fr]">
          <div className="border-border bg-card flex flex-col gap-5 rounded-3xl border p-8">
            <div className="border-border bg-hero rounded-2xl border p-5">
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
              Class and Plan are read off one card. The{" "}
              <span className="text-foreground font-medium">class</span> is
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

          <div className="border-border bg-card flex flex-col justify-center gap-4 rounded-3xl border p-8">
            <span className="border-secondary/40 text-secondary w-fit rounded-full border px-3 py-1 text-[11px] font-bold">
              $25 cap
            </span>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Every reward is funded by the place itself — never subsidized by
              Mesita. A percentage sounds generous, but{" "}
              <span className="text-foreground font-medium">
                the cap is what actually prices the promo
              </span>
              : the worst case per table is known and bounded, so a bold offer
              never becomes an open liability.
            </p>
            <p className="text-muted-foreground inline-flex items-start gap-2 text-[13px] leading-relaxed">
              <ShieldCheck
                className="text-secondary mt-0.5 h-4 w-4 shrink-0"
                aria-hidden
              />
              Rewards price the visit. Pickup orders sell on 0% commission
              instead.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export { RewardsProgram };
