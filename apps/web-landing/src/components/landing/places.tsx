import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SolutionList } from "@/components/landing/solution-list";
import { PLACE_SOLUTIONS } from "@/components/landing/solutions";
import { BUSINESS_URL } from "@/components/landing/urls";

// Solutions for Restaurants: every product on Business › All, four live and
// ten Soon, one console (MESITA-3845). The profile is the door; nobody from
// Mesita has to be in the room.
function Places() {
  return (
    <section id="places" className="border-border scroll-mt-16 border-b">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-5 py-20 md:grid-cols-[2fr_3fr] md:gap-14 md:py-24">
        <div className="flex flex-col gap-5 md:sticky md:top-24 md:self-start">
          <p className="text-secondary text-xs font-semibold tracking-[0.18em] uppercase">
            Solutions for Restaurants
          </p>
          <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
            Your profile is already built. Claim it.
          </h2>
          <p className="text-muted-foreground text-base leading-relaxed">
            Find your place, claim it, and turn on what you want. No call, no
            demo, no contract, no onboarding. Four solutions are live today;
            ten more are on the way.
          </p>
          <Button
            asChild
            size="lg"
            className="min-h-11 self-start rounded-full"
          >
            <a href={BUSINESS_URL}>
              Claim your place
              <ArrowRight />
            </a>
          </Button>
        </div>
        <SolutionList items={PLACE_SOLUTIONS} />
      </div>
    </section>
  );
}

export { Places };
