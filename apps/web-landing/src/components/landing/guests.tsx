import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SolutionList } from "@/components/landing/solution-list";
import { GUEST_SOLUTIONS } from "@/components/landing/solutions";
import { CONSUMER_URL } from "@/components/landing/urls";

// The guest side: four solutions, one app (🦚 Main § 3, MESITA-4991).
function Guests() {
  return (
    <section id="guests" className="border-border scroll-mt-16 border-b">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-5 py-20 md:grid-cols-[2fr_3fr] md:gap-14 md:py-24">
        <div className="flex flex-col gap-5 md:sticky md:top-24 md:self-start">
          <p className="text-secondary text-xs font-semibold tracking-[0.18em] uppercase">
            For guests
          </p>
          <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
            Find it, book it, pay less, share it.
          </h2>
          <p className="text-muted-foreground text-base leading-relaxed">
            Find any place, get a table without making the call, pay ahead to
            get more, and give credit to a friend. All in one app.
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
