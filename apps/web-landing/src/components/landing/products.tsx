import {
  LayoutDashboard,
  type LucideIcon,
  Plug,
  Smartphone,
} from "lucide-react";
import { SectionHeader } from "@/components/landing/section-header";

// Three shipped surfaces. The MCP server is spelled out rather than
// abbreviated — an evaluator should not have to know the acronym to see
// why a catalog that answers to an assistant is worth something.
const PRODUCTS: {
  label: string;
  kicker: string;
  body: string;
  bullets: string[];
  Icon: LucideIcon;
}[] = [
  {
    label: "Consumer app",
    kicker: "Where the guest lives",
    body: "The whole plan in one place: eight discovery engines, both agents, the Passport, and the bill at the end of it.",
    bullets: ["Discover and book", "Order pickup", "Scan and pay less"],
    Icon: Smartphone,
  },
  {
    label: "Consumer MCP",
    kicker: "Mesita inside the assistant",
    body: "A Model Context Protocol server — the standard that lets an AI assistant use an outside tool. Ask Claude or ChatGPT where to eat and it answers from the Mesita catalog, then books through the same agent.",
    bullets: [
      "Same catalog, no app to open",
      "The assistant becomes a ninth engine",
    ],
    Icon: Plug,
  },
  {
    label: "Business app",
    kicker: "Where the place decides",
    body: "The console a partner gets on day one: claim the profile the catalog already built, set the rewards, and watch the funnel it moves.",
    bullets: [
      "Claim and control the profile",
      "Price the rewards",
      "See the funnel",
    ],
    Icon: LayoutDashboard,
  },
];

function Products() {
  return (
    <section id="products" className="border-border bg-muted/30 border-b">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 md:py-24">
        <SectionHeader
          eyebrow="The software"
          title="Three products, one platform."
          aside="Everything on this page runs on software that exists today — two guest surfaces and the console a place logs into."
        />

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {PRODUCTS.map(({ label, kicker, body, bullets, Icon }) => (
            <article
              key={label}
              className="border-border bg-card flex flex-col gap-4 rounded-3xl border p-7"
            >
              <span className="bg-pink-gradient flex h-11 w-11 items-center justify-center rounded-2xl text-white">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h3 className="font-display text-xl font-semibold tracking-tight">
                  {label}
                </h3>
                <p className="text-primary text-[11px] font-semibold tracking-[0.1em] uppercase">
                  {kicker}
                </p>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {body}
              </p>
              <ul className="border-border mt-auto flex flex-col gap-1.5 border-t pt-4">
                {bullets.map((b) => (
                  <li
                    key={b}
                    className="text-muted-foreground flex items-center gap-2 text-[13px]"
                  >
                    <span
                      className="bg-primary h-1 w-1 shrink-0 rounded-full"
                      aria-hidden
                    />
                    {b}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export { Products };
