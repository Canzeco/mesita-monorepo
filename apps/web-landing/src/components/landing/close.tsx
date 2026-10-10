import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NOTIFY_URL, OVERVIEW_URL } from "@/components/landing/urls";

// The three First Stage products, restated as the three names the nav uses.
const PRODUCTS = ["Catalog", "Discovery", "Reservations"];

// State plus the three names in the same viewport — a pre-launch badge next
// to nothing reads as vaporware.
function Close() {
  return (
    <section className="bg-hero border-border border-b">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-5 py-20 text-center md:py-24">
        <div className="grid w-full max-w-2xl grid-cols-3 gap-3">
          {PRODUCTS.map((b) => (
            <span
              key={b}
              className="border-border bg-background/70 text-muted-foreground rounded-2xl border px-3 py-3 text-[12px] leading-snug font-medium backdrop-blur"
            >
              {b}
            </span>
          ))}
        </div>
        <h2 className="font-display mt-4 max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">
          One app. Every place. Every table.
        </h2>
        <p className="text-muted-foreground max-w-xl text-base">
          Mesita is in development, launching January 2027.
        </p>
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="min-h-11 rounded-full">
            <a href={OVERVIEW_URL}>
              Learn more
              <ArrowRight />
            </a>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="min-h-11 rounded-full"
          >
            <a href={NOTIFY_URL}>Get notified at launch</a>
          </Button>
        </div>
      </div>
    </section>
  );
}

export { Close };
