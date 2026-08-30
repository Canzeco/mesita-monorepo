import { BadgeCheck, Coins, Store, type LucideIcon } from "lucide-react";
import { SectionHeader } from "@/components/landing/section-header";

const STREAMS: {
  title: string;
  body: string;
  never: string;
  Icon: LucideIcon;
}[] = [
  {
    title: "Consumer Subscription",
    body: "Premium, monthly, recurring. Free is complete — discovery, agents and rewards; Premium raises the rewards everywhere.",
    never: "Your plan is private — a place never learns who pays.",
    Icon: BadgeCheck,
  },
  {
    title: "Partnership Subscription",
    body: "A flat yearly Partnership subscription turns Listed into Verified: profile control, exclusive rewards, priority placement, the dashboard.",
    never:
      "No commission on anything, and rank is never for sale — visibility is earned, not bought.",
    Icon: Store,
  },
  {
    title: "Mesita Capital & Spread",
    body: "Inventory pre-bought at ~2:1, Credits redeemed against it: spread on redemption, margin on cashout, breakage on gifts.",
    never:
      "Not a loan — an advance sale of food. Credits are minted by payment, never by points.",
    Icon: Coins,
  },
];

function Revenue() {
  return (
    <section id="revenue" className="border-border bg-muted/30 border-b">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 md:py-24">
        <SectionHeader
          eyebrow="Three streams, three refusals"
          title="How Mesita makes money."
          aside="What each stream earns — and what it refuses to earn."
        />
        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {STREAMS.map(({ title, body, never, Icon }) => (
            <article
              key={title}
              className="border-border bg-card flex flex-col gap-3 rounded-2xl border p-6"
            >
              <span className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-2xl">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="font-display text-lg font-semibold tracking-tight">
                {title}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {body}
              </p>
              <p className="border-border text-muted-foreground mt-auto border-t pt-3 text-[13px] leading-relaxed">
                <span className="text-secondary font-semibold">Never:</span>{" "}
                {never}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export { Revenue };
