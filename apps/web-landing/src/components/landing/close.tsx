import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NOTIFY_URL, OVERVIEW_URL } from "@/components/landing/urls";

const BUILT = [
  "Seven app surfaces built",
  "Reservation agent live",
  "Self-building catalog running",
  "One founder + an AI fleet",
];

// Status plus evidence in the same viewport — a pre-launch badge next to
// nothing reads as vaporware.
function Close() {
  return (
    <section className="bg-hero border-border border-b">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-5 py-20 text-center md:py-24">
        <div className="grid w-full max-w-4xl grid-cols-2 gap-3 md:grid-cols-4">
          {BUILT.map((b) => (
            <span
              key={b}
              className="border-border bg-background/70 text-muted-foreground rounded-2xl border px-3 py-3 text-[12px] leading-snug font-medium backdrop-blur"
            >
              {b}
            </span>
          ))}
        </div>
        <h2 className="font-display mt-4 max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">
          Built in Monterrey. Launching in California.
        </h2>
        <p className="text-muted-foreground max-w-xl text-base">
          Mesita is in development, launching January 2027.
        </p>
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="min-h-11 rounded-full">
            <a href={OVERVIEW_URL}>
              Read the full project overview
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
