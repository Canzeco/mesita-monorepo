import { Phone, ShoppingBag } from "lucide-react";

function OrderAgents() {
  return (
    <section id="orders" className="border-border bg-muted/30 border-b">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 px-5 py-20 md:grid-cols-2 md:py-24">
        <div className="border-border bg-card shadow-elev order-2 flex flex-col gap-5 rounded-3xl border p-8 md:order-1">
          <span className="bg-pink-gradient flex h-12 w-12 items-center justify-center rounded-2xl text-white">
            <ShoppingBag className="h-6 w-6" aria-hidden />
          </span>
          <p className="font-display text-lg font-semibold tracking-tight">
            “Two al pastor and a quesadilla, pickup at 8.”
          </p>
          <div className="border-border bg-background/70 flex items-start gap-2.5 rounded-2xl border p-4">
            <Phone
              className="text-secondary mt-0.5 h-4 w-4 shrink-0"
              aria-hidden
            />
            <p className="text-muted-foreground text-sm leading-relaxed italic">
              “Hi! I’d like to place a pickup order for eight o’clock…”
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground w-28 shrink-0 text-xs">
                Delivery apps
              </span>
              <span className="bg-muted-foreground/25 h-7 w-full rounded-lg">
                <span className="bg-muted-foreground/60 flex h-7 w-[88%] items-center justify-end rounded-lg pr-2 text-[11px] font-bold text-white">
                  25–30%
                </span>
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-xs font-semibold">
                Mesita
              </span>
              <span className="bg-muted-foreground/15 h-7 w-full rounded-lg">
                <span className="bg-pink-gradient flex h-7 w-[7%] min-w-[52px] items-center justify-center rounded-lg text-[11px] font-bold text-white">
                  0%
                </span>
              </span>
            </div>
          </div>
        </div>
        <div className="order-1 flex flex-col gap-5 md:order-2">
          <p className="text-primary text-xs font-semibold tracking-[0.18em] uppercase">
            Ordering still means a 25–30% commission app.
          </p>
          <h2 className="font-display max-w-xl text-3xl font-semibold tracking-tight md:text-4xl">
            Same phone line.{" "}
            <span className="text-primary">0% commission.</span>
          </h2>
          <p className="text-muted-foreground max-w-xl text-base leading-relaxed">
            Say what you want, and the twin agent calls the place and orders it
            for pickup. No marketplace in the middle, no menu upload, no tablet
            on the counter — and Mesita takes nothing. Places keep the full
            ticket.
          </p>
        </div>
      </div>
    </section>
  );
}

export { OrderAgents };
