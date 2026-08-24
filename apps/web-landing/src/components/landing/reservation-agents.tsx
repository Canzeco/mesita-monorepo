import { BadgeCheck, CalendarCheck, Phone } from "lucide-react";

function ReservationAgents() {
  return (
    <section id="agents" className="border-border border-b">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 px-5 py-20 md:grid-cols-2 md:py-24">
        <div className="flex flex-col gap-5">
          <p className="text-primary text-xs font-semibold tracking-[0.18em] uppercase">
            Booking still means calling. So Mesita calls.
          </p>
          <h2 className="font-display max-w-xl text-3xl font-semibold tracking-tight md:text-4xl">
            Never call a restaurant again.
          </h2>
          <p className="text-muted-foreground max-w-xl text-base leading-relaxed">
            Set the place, time and party size. Mesita’s agent phones the
            restaurant and negotiates the table in natural conversation, then
            confirms in minutes with the ticket in your app. It works at every
            place in the city — not just partners — because it books the way
            everyone already does: by phone.
          </p>
        </div>
        <div className="border-border bg-hero shadow-elev flex flex-col gap-4 rounded-3xl border p-8">
          <span className="bg-pink-gradient flex h-12 w-12 items-center justify-center rounded-2xl text-white">
            <CalendarCheck className="h-6 w-6" aria-hidden />
          </span>
          <p className="font-display text-lg font-semibold tracking-tight">
            “Table for 4, Friday 9 pm.”
          </p>
          <div className="border-border bg-background/70 flex items-start gap-2.5 rounded-2xl border p-4">
            <Phone
              className="text-secondary mt-0.5 h-4 w-4 shrink-0"
              aria-hidden
            />
            <p className="text-muted-foreground text-sm leading-relaxed italic">
              “Hi! I’m calling to book a table for four this Friday at nine…”
            </p>
          </div>
          <span className="text-whatsapp inline-flex items-center gap-2 text-sm font-medium">
            <BadgeCheck className="h-4 w-4" aria-hidden />
            Confirmed in 4 minutes
          </span>
        </div>
      </div>
    </section>
  );
}

export { ReservationAgents };
