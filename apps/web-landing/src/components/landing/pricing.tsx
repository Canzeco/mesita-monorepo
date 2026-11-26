import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BUSINESS_URL, CONSUMER_URL } from "@/components/landing/urls";

// What Mesita costs (🦚 Main § 8, MESITA-4991). Rows of numbers are a table.
// Premier orders, it never hides or shows a place, and it is always marked
// Ad. The 5% is on what guests pay ahead, which is not live yet: Soon.
const PLANS = [
  {
    name: "Free",
    price: "US$0",
    what: "Your profile, claimed and edited by you. Reservation requests by phone.",
  },
  {
    name: "Pro",
    price: "US$99 a year",
    what: "Ranks your place 2X on Home and the Map, marked Ad.",
  },
  {
    name: "Max",
    price: "US$999 a year",
    what: "Ranks your place 5X on Home and the Map, marked Ad.",
  },
  {
    name: "Paying ahead",
    price: "5%",
    what: "Of what guests pay you ahead. The rest goes straight to your own Stripe account when the guest pays.",
    soon: true,
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
            Free for guests. Free to claim.
          </h2>
          <p className="text-muted-foreground text-base leading-relaxed md:text-lg">
            A restaurant pays only to rank higher, or when a guest pays it
            ahead.
          </p>
        </div>

        <div className="border-border bg-card shadow-elev overflow-x-auto rounded-3xl border">
          <table className="w-full text-left text-[15px]">
            <thead>
              <tr className="text-muted-foreground border-border border-b text-xs font-semibold tracking-wide uppercase">
                <th className="px-5 py-4 md:px-7">For restaurants</th>
                <th className="px-5 py-4 md:px-7">Price</th>
                <th className="px-5 py-4 md:px-7">What you get</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {PLANS.map(({ name, price, what, soon }) => (
                <tr key={name} className="align-top">
                  <th
                    scope="row"
                    className="px-5 py-4 font-semibold whitespace-nowrap md:px-7"
                  >
                    {name}
                    {soon ? (
                      <span className="text-muted-foreground font-medium">
                        {" "}
                        · Soon
                      </span>
                    ) : null}
                  </th>
                  <td className="px-5 py-4 font-semibold whitespace-nowrap tabular-nums md:px-7">
                    {price}
                  </td>
                  <td className="text-muted-foreground min-w-56 px-5 py-4 leading-relaxed md:px-7">
                    {what}
                  </td>
                </tr>
              ))}
            </tbody>
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
