import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SolutionList } from "@/components/landing/solution-list";
import { PLACE_LATER, PLACE_SOLUTIONS } from "@/components/landing/solutions";
import { BUSINESS_URL } from "@/components/landing/urls";

// The restaurant side: four solutions (🦚 Main § 4, MESITA-4991), then what
// comes later as one line of names. The profile is the door; nobody from
// Mesita has to be in the room.
function Places() {
  return (
    <section id="restaurants" className="border-border scroll-mt-16 border-b">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-5 py-20 md:grid-cols-[2fr_3fr] md:gap-14 md:py-24">
        <div className="flex flex-col gap-5 md:sticky md:top-24 md:self-start">
          <p className="text-secondary text-xs font-semibold tracking-[0.18em] uppercase">
            For restaurants
          </p>
          <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
            Your profile is already built. Claim it.
          </h2>
          {/* The restaurant pitch in one line, Pato's (MESITA-4604). */}
          <p className="text-foreground text-base leading-relaxed font-medium">
            Mesita is a growth partner for restaurants, bringing capital from
            diners who pay up front and tools that bring them back.
          </p>
          <p className="text-muted-foreground text-base leading-relaxed">
            Find your place, claim it, and turn on what you want. No call, no
            demo, no contract, no onboarding.
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
        <div className="flex flex-col gap-5">
          <SolutionList items={PLACE_SOLUTIONS} />
          <p className="text-muted-foreground px-1 text-sm leading-relaxed">
            <span className="text-foreground font-medium">Later:</span>{" "}
            {PLACE_LATER.join(" · ")}
          </p>
        </div>
      </div>
    </section>
  );
}

export { Places };
