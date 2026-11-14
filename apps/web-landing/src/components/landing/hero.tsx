import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  MapPin,
  Star,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BUSINESS_URL, CONSUMER_URL } from "@/components/landing/urls";

const FAMILIES = ["Tacos", "Mexican", "Night"];

// The hero sells both sides in one viewport: the guest's promise on the left,
// one place profile on the right with a chip from each side of Mesita on it
// (a guest's confirmed booking, the place's Premier mark). The card is drawn
// in code, never a screenshot, so it cannot go stale inside an image.
function Hero() {
  return (
    <section className="bg-hero relative overflow-hidden">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-14 px-5 pt-14 pb-20 md:grid-cols-[1.1fr_1fr] md:pt-24 md:pb-28">
        <div className="flex flex-col items-start gap-6">
          <Badge
            variant="outline"
            className="bg-background/70 text-muted-foreground rounded-full px-3 py-1 text-xs font-medium backdrop-blur"
          >
            <span
              className="bg-primary inline-block h-1.5 w-1.5 rounded-full"
              aria-hidden
            />
            Launching in Monterrey
          </Badge>

          <h1 className="font-display text-5xl leading-[1.02] font-semibold tracking-tight md:text-7xl">
            Where are we going?
            <br />
            <span className="text-primary">Mesita knows.</span>
          </h1>

          <p className="text-muted-foreground max-w-xl text-lg leading-relaxed md:text-xl">
            Every restaurant, café, bar and club in the city, found your way and
            booked by an agent that makes the call. For the place, a profile
            that already exists, ready to claim.
          </p>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Button asChild size="lg" className="min-h-11 rounded-full">
              <a href={CONSUMER_URL}>
                Open Mesita
                <ArrowRight />
              </a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="bg-background/60 min-h-11 rounded-full"
            >
              <a href={BUSINESS_URL}>Claim your place</a>
            </Button>
          </div>

          <p className="text-muted-foreground text-sm">
            <span className="text-foreground font-medium">Six products</span>{" "}
            for guests ·{" "}
            <span className="text-foreground font-medium">thirteen</span> for
            restaurants · one catalog under both
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-sm" aria-hidden>
          <div className="border-border bg-card shadow-elev overflow-hidden rounded-[2rem] border">
            <div className="bg-pink-gradient flex aspect-[4/3] items-center justify-center text-7xl">
              🌮
            </div>
            <div className="flex flex-col gap-3 p-5">
              <div className="flex items-center gap-1.5">
                <p className="font-display text-xl font-semibold tracking-tight">
                  Cantina La Mesita
                </p>
                <BadgeCheck className="text-primary h-5 w-5" />
              </div>
              <div className="text-muted-foreground flex items-center gap-3 text-[13px]">
                <span className="inline-flex items-center gap-1">
                  <Star className="fill-primary text-primary h-3.5 w-3.5" />
                  4.7
                </span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  1.2 km
                </span>
                <span>Open until 2 am</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {FAMILIES.map((f) => (
                  <span
                    key={f}
                    className="bg-primary/10 text-secondary rounded-full px-2.5 py-1 text-xs font-medium"
                  >
                    {f}
                  </span>
                ))}
              </div>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <span className="bg-primary text-primary-foreground rounded-full py-2.5 text-center text-sm font-semibold">
                  Reserve
                </span>
                <span className="border-border text-muted-foreground rounded-full border py-2.5 text-center text-sm font-medium">
                  Pay · Soon
                </span>
              </div>
            </div>
          </div>

          <span className="border-border/60 bg-background/90 absolute -top-4 -left-4 flex items-center gap-2 rounded-2xl border px-3.5 py-2 shadow-lg backdrop-blur-md md:-left-10">
            <CalendarCheck className="text-whatsapp h-4 w-4" />
            <span className="text-[13px] leading-tight font-semibold">
              Table for 4 · Fri 9:00 pm
              <span className="text-whatsapp block text-[11px] font-medium">
                Confirmed by phone ✓
              </span>
            </span>
          </span>
          <span className="border-border/60 bg-background/90 absolute -right-3 bottom-24 flex items-center gap-2 rounded-2xl border px-3.5 py-2 shadow-lg backdrop-blur-md md:-right-10">
            <span className="bg-pink-gradient flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white">
              5X
            </span>
            <span className="text-[13px] leading-tight font-semibold">
              Premier
              <span className="text-muted-foreground block text-[11px] font-medium">
                marked Ad
              </span>
            </span>
          </span>
        </div>
      </div>
    </section>
  );
}

export { Hero };
