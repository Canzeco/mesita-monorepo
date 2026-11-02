import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BUSINESS_URL, CONSUMER_URL } from "@/components/landing/urls";

// The last screen gives each side its own door, side by side.
const DOORS = [
  {
    who: "Going out?",
    line: "Every place in the city, and a table without the phone call.",
    cta: "Open Mesita",
    href: CONSUMER_URL,
    primary: true,
  },
  {
    who: "Run a place?",
    line: "Your profile is already on Mesita. Claim it, free forever.",
    cta: "Claim your place",
    href: BUSINESS_URL,
    primary: false,
  },
];

function Close() {
  return (
    <section className="border-border border-b">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-5 py-20 md:py-24">
        <h2 className="font-display max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">
          One app for going out. One console for the place.
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {DOORS.map(({ who, line, cta, href, primary }) => (
            <div
              key={who}
              className={`flex flex-col items-start gap-4 rounded-3xl border p-7 md:p-9 ${
                primary ? "bg-hero border-primary/30" : "bg-card border-border"
              }`}
            >
              <p className="font-display text-2xl font-semibold tracking-tight">
                {who}
              </p>
              <p className="text-muted-foreground text-base leading-relaxed">
                {line}
              </p>
              <Button
                asChild
                size="lg"
                variant={primary ? "default" : "outline"}
                className="mt-2 min-h-11 rounded-full"
              >
                <a href={href}>
                  {cta}
                  <ArrowRight />
                </a>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export { Close };
