import {
  Gem,
  Instagram,
  type LucideIcon,
  QrCode,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { SectionHeader } from "@/components/landing/section-header";

// Visit Rewards, as ACTION rewards: four of them, each carrying its REASON,
// not just its trigger — a reward nobody can explain reads as a coupon.
// The Base discount comes off the page on Pato's cut (2026-09-28): the
// section sells the actions a guest takes, and Base is not one.
const REWARDS: {
  label: string;
  when: string;
  why: string;
  Icon: LucideIcon;
}[] = [
  {
    label: "Welcome Visit",
    when: "Your first visit",
    why: "The hardest visit to buy is the first one.",
    Icon: UserPlus,
  },
  {
    label: "Instagram Story",
    when: "A verified public story, every visit",
    why: "The reward the place earns back in reach.",
    Icon: Instagram,
  },
  {
    label: "Google Review",
    when: "Posted at the table, once per place",
    why: "Any rating counts, never sentiment-gated.",
    Icon: Sparkles,
  },
  // Diamond (MESITA-2044, MESITA-2046) is binary: a guest is Diamond or
  // not, nothing in between. Invitation only, never bought, never reached
  // through Instagram, and anyone can ask to join. The page says "Diamond",
  // one word, the way the app does — `__tests__/diamond.test.tsx` pins it.
  {
    label: "Diamond",
    when: "Invitation only",
    why: "The guests who make the room.",
    Icon: Gem,
  },
];

function RewardsProgram() {
  return (
    <section id="rewards" className="border-border bg-muted/30 border-b">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 md:py-24">
        <SectionHeader
          eyebrow="Visit Rewards · action rewards, cheaper every time you go"
          title="Do something for the place, and the place pays you back."
          aside="Show your QR at the table. Staff scan it with any phone, the reward lands on the bill, and the quote is on screen before you close. Every reward is an action, and every action has a reason."
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

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_1fr]">
          {/* Diamond gets the width: it is the one reward with a story
              behind it, and the story is who Mesita puts in the room. */}
          <div className="border-primary/30 bg-hero shadow-elev flex flex-col gap-5 rounded-3xl border p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-primary text-xs font-semibold tracking-[0.18em] uppercase">
                  Diamond
                </p>
                <h3 className="font-display mt-2 max-w-md text-2xl font-semibold tracking-tight md:text-3xl">
                  The room is the product.
                </h3>
              </div>
              <span className="bg-tier-diamond text-foreground inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold">
                <Gem className="h-3.5 w-3.5" aria-hidden />
                Diamond
              </span>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Mesita partners with modeling agencies, creators, and the people
              who set the scene in the city, and makes them Diamond. A place
              pays a bigger reward to fill its tables with the guests everyone
              else came to sit next to.{" "}
              <span className="text-foreground font-medium">
                Invitation only.
              </span>{" "}
              Never bought, never reached by followers, and anyone can ask.
            </p>
            <div className="border-border bg-background/70 flex items-center gap-3 rounded-2xl border p-4">
              <QrCode
                className="text-foreground h-9 w-9 shrink-0"
                aria-hidden
              />
              <p className="text-muted-foreground text-[11px] leading-snug">
                Scanned at the table — the reward lands on the bill before you
                pay.
              </p>
            </div>
          </div>

          <div className="border-border bg-card flex flex-col justify-center gap-4 rounded-3xl border p-8">
            <span className="border-secondary/40 text-secondary w-fit rounded-full border px-3 py-1 text-[11px] font-bold">
              Capped per table
            </span>
            <p className="text-muted-foreground text-sm leading-relaxed">
              The place funds every reward and caps it per table.{" "}
              <span className="text-foreground font-medium">
                Never subsidized by Mesita.
              </span>{" "}
              A percentage sounds generous, but the cap is what actually prices
              the offer: the worst case per table is known and bounded, so a
              bold reward never becomes an open liability.
            </p>
            <p className="text-muted-foreground inline-flex items-start gap-2 text-[13px] leading-relaxed">
              <ShieldCheck
                className="text-secondary mt-0.5 h-4 w-4 shrink-0"
                aria-hidden
              />
              Cash, card, or your phone — the reward applies the same way.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export { RewardsProgram };
