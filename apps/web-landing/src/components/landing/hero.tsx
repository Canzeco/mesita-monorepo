import Image from "next/image";
import { ArrowRight, Star, Utensils } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NOTIFY_URL, OVERVIEW_URL } from "@/components/landing/urls";

// Pre-launch hero. The status badge does the honesty work for the whole
// page — every section below speaks in product voice without claiming
// liveness. The UI chips are code overlays, never baked into the photo,
// so page copy can never go stale inside a JPG.
function Hero() {
  return (
    <section className="bg-hero relative overflow-hidden">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-5 pt-16 pb-12 text-center md:pt-24 md:pb-20">
        <Badge
          variant="outline"
          className="bg-background/70 text-muted-foreground rounded-full px-3 py-1 text-xs font-medium backdrop-blur"
        >
          <span
            className="bg-primary inline-block h-1.5 w-1.5 rounded-full"
            aria-hidden
          />
          In development · Launching in San Francisco — January 2027
        </Badge>

        <h1 className="font-display max-w-3xl text-4xl leading-[1.05] font-semibold tracking-tight md:text-6xl">
          Where are we going tonight?
          <br />
          <span className="text-primary">Mesita knows.</span>
        </h1>

        <p className="text-muted-foreground max-w-2xl text-lg leading-relaxed md:text-xl">
          Every restaurant, café, bar and club in your city — tailored to you,
          booked by AI, and cheaper every time you go. One app for both sides of
          the table.
        </p>

        <div className="mt-2 flex flex-col items-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="min-h-11 rounded-full">
            <a href={OVERVIEW_URL}>
              Read the project overview
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

        <p className="text-muted-foreground text-xs">
          Already running:{" "}
          <span className="text-foreground font-medium">
            the self-building catalog
          </span>{" "}
          ·{" "}
          <span className="text-foreground font-medium">
            the reservation agent
          </span>{" "}
          ·{" "}
          <span className="text-foreground font-medium">
            seven app surfaces
          </span>
        </p>

        <figure className="border-border shadow-elev relative mt-8 w-full overflow-hidden rounded-3xl border md:mt-12">
          <Image
            src="/hero-goldengate.jpg"
            alt="Street tacos and a Mesita agua fresca on a table overlooking the Golden Gate Bridge at dusk"
            width={2048}
            height={1143}
            priority
            sizes="(max-width: 1024px) 100vw, 1100px"
            className="h-auto w-full"
          />
          <span className="border-border/60 bg-background/85 absolute top-4 left-4 flex items-center gap-2 rounded-2xl border px-3.5 py-2 text-left shadow-lg backdrop-blur-md">
            <Utensils className="text-primary h-4 w-4" aria-hidden />
            <span className="text-[13px] leading-tight font-semibold">
              Table for 4 · Fri 9:00 pm
              <span className="text-whatsapp block text-[11px] font-medium">
                Confirmed ✓
              </span>
            </span>
          </span>
          <span className="border-border/60 bg-background/85 absolute bottom-4 left-4 hidden items-center gap-2 rounded-2xl border px-3.5 py-2 text-left shadow-lg backdrop-blur-md sm:flex">
            <span className="text-[13px] leading-tight font-semibold">
              −30%
              <span className="text-muted-foreground block text-[11px] font-medium">
                applied at the table
              </span>
            </span>
          </span>
          <span className="bg-gold text-foreground absolute top-4 right-4 hidden items-center gap-1.5 rounded-2xl px-3.5 py-2 shadow-lg md:flex">
            <Star className="h-4 w-4" aria-hidden />
            <span className="text-[13px] font-semibold">Gold Passport</span>
          </span>
        </figure>
      </div>
    </section>
  );
}

export { Hero };
