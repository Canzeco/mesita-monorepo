import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SolutionList } from "@/components/landing/solution-list";
import { GUEST_SOLUTIONS } from "@/components/landing/solutions";
import { CONSUMER_URL } from "@/components/landing/urls";

// The guest side: six products, one app. Three get the guest to the door,
// three close the visit (🦚 Main § 3).
function Guests() {
  return (
    <section id="guests" className="border-border scroll-mt-16 border-b">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-5 py-20 md:grid-cols-[2fr_3fr] md:gap-14 md:py-24">
        <div className="flex flex-col gap-5 md:sticky md:top-24 md:self-start">
          <p className="text-secondary text-xs font-semibold tracking-[0.18em] uppercase">
            For guests · six products
          </p>
          <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
            Find it, book it, pay for it.
          </h2>
          <p className="text-muted-foreground text-base leading-relaxed">
            Three products get you to the door and three close the visit. All
            six live in one app: Home, Search, Pay, Me.
          </p>
          <Button
            asChild
            size="lg"
            className="min-h-11 self-start rounded-full"
          >
            <a href={CONSUMER_URL}>
              Open Mesita
              <ArrowRight />
            </a>
          </Button>
        </div>
        <SolutionList items={GUEST_SOLUTIONS} />
      </div>
    </section>
  );
}

export { Guests };
