import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BUSINESS_URL, CONSUMER_URL } from "@/components/landing/urls";

// 🦚 Main § 8, what Mesita costs (MESITA-4994). Rows of numbers are a table:
// restaurants first, then guests. Premier orders, it never hides or shows a
// place, and it is always marked Ad. Guest Pro is US$1 a month (Pato,
// 2026-11-26): every reservation is a phone call Mesita pays for.
type Plan = { name: string; price: string; what: string };

const GROUPS: { who: string; plans: Plan[] }[] = [
  {
    who: "For restaurants",
    plans: [
      {
        name: "Free",
        price: "US$0",
        what: "Your profile, claimed and edited by you.",
      },
      {
        name: "Pro",
        price: "US$99 a year",
        what: "Premier 2X: doubles your place’s score, marked Ad.",
      },
      {
        name: "Max",
        price: "US$999 a year",
        what: "Premier 5X: multiplies your place’s score by five, marked Ad.",
      },
      {
        name: "Payments fee",
        price: "5%",
        what: "Of every voucher bought in the app. Bills and spending credit carry no fee.",
      },
    ],
  },
  {
    who: "For guests",
    plans: [
      {
        name: "Free",
        price: "US$0",
        what: "10 reservation requests a month.",
      },
      {
        name: "Pro",
        price: "US$1 a month",
        what: "30 reservation requests a month.",
      },
    ],
  },
];

function Pricing() {
  return (
    <section
      id="pricing"
      className="bg-hero border-border scroll-mt-16 border-b"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-5 py-20 md:py-24">
        <div className="flex max-w-3xl flex-col gap-4">
          <p className="text-secondary text-xs font-semibold tracking-[0.18em] uppercase">
            Pricing
          </p>
          <h2 className="font-display text-3xl font-semibold tracking-tight md:text-5xl">
            Free to claim. Free to use.
          </h2>
          <p className="text-muted-foreground text-base leading-relaxed md:text-lg">
            A restaurant pays only to rank higher, and a 5% fee when guests pay
            it through Mesita.
          </p>
        </div>

        <div className="border-border bg-card shadow-elev overflow-hidden rounded-3xl border">
          <table className="w-full text-left text-[15px]">
            {GROUPS.map(({ who, plans }) => (
              <tbody key={who} className="divide-border divide-y">
                <tr className="bg-muted/40">
                  <th
                    scope="colgroup"
                    colSpan={3}
                    className="text-muted-foreground px-5 py-3 text-xs font-semibold tracking-wide uppercase md:px-7"
                  >
                    {who}
                  </th>
                </tr>
                {plans.map(({ name, price, what }) => (
                  <tr key={name} className="align-top">
                    <th
                      scope="row"
                      className="px-5 py-4 font-semibold md:px-7 md:whitespace-nowrap"
                    >
                      {name}
                      {/* On a phone the description sits under the name: a
                          third column would hide behind a sideways scroll
                          (MESITA-4992). */}
                      <span className="text-muted-foreground mt-1 block text-sm leading-relaxed font-normal md:hidden">
                        {what}
                      </span>
                    </th>
                    <td className="px-5 py-4 text-right font-semibold whitespace-nowrap tabular-nums md:px-7 md:text-left">
                      {price}
                    </td>
                    <td className="text-muted-foreground hidden px-5 py-4 leading-relaxed md:table-cell md:px-7">
                      {what}
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="min-h-11 rounded-full">
            <a href={BUSINESS_URL}>
              Claim your place
              <ArrowRight />
            </a>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="bg-background/60 min-h-11 rounded-full"
          >
            <a href={CONSUMER_URL}>Open Mesita</a>
          </Button>
        </div>
      </div>
    </section>
  );
}

export { Pricing };
