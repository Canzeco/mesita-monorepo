"use client";

// Express Website — a template, a draft, a site (MESITA-2017).
//
// Pato, 2026-09-20: *"que se sienta casi como un Lovable… y que haya
// plantillas."* Pick one of four, Mesita researches the place and writes the
// site from the profile and the published menu, you change it by asking,
// and you press Publish. It is not a brochure: its buttons book and order
// through the same backend, so it never drifts from the menu.
//
// ── THREE STATES, AS FIXTURES ──────────────────────────────────────────────
//
// `websiteState` walks none → picked → preview → published. That is the whole
// reason this card may read On on the catalogue: `products.ts` forbids knobs
// on an unbuilt engine, and a state you can click through is not a knob. The
// generator, the registrar and the Ads spend are follow-ups; this screen is
// their shape.
//
// TWO SURFACES, ON PURPOSE (gate UC3). Mesita Profile lives at mesita.ai and
// is the marketplace's page; this is the place's OWN site, on
// `<slug>.mesita.co` by default, on their domain if they connect or buy one.
import Link from "next/link";
import { Check, ExternalLink } from "lucide-react";
import { useHeldPlace } from "@/components/console/PlaceScope";
import { useMock } from "@/mock/MockStore";
import { Section } from "@/components/shared/Section";
import { Half } from "@/components/shared/Half";
import { Badge } from "@/components/shared/Badges";
import { MenuDoor } from "@/components/shared/MenuDoor";
import { Rule, RULES_CARD } from "@/components/shared/Rule";
import { profileComplete } from "@/lib/partner";
import { productKeyHref } from "@/lib/product-routes";
import {
  PLAN_LABEL,
  WEBSITE_TEMPLATES,
  WEBSITE_TEMPLATE_LABEL,
  planAtLeast,
  type WebsiteState,
} from "@/mock/types";
import { CTA_BUTTON_CLASS, GHOST_PILL_BUTTON_CLASS, INFO_BOX_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

export const WEBSITE_STATES: Record<
  WebsiteState,
  { headline: string; tone: "off" | "soon" | "live"; lede: string; verb: string | null }
> = {
  none: {
    headline: "No site yet",
    tone: "off",
    lede: "Pick a template and Mesita drafts the whole site from your listing and your menu. You approve it before anyone sees it.",
    verb: null,
  },
  picked: {
    headline: "Template picked",
    tone: "soon",
    lede: "Mesita is researching the place — photos, tone, what you are known for — and writing the first draft.",
    verb: "Generate the draft",
  },
  preview: {
    headline: "Draft ready",
    tone: "soon",
    lede: "Read it, change it by asking, and publish when it is right. Nothing is public until you press Publish.",
    verb: "Publish",
  },
  published: {
    headline: "Live",
    tone: "live",
    lede: "The site updates itself when the menu or the hours do. Every earlier version is kept; you can go back to any of them.",
    verb: "Open the site",
  },
};

export function WebsiteView() {
  const place = useHeldPlace();
  const { world } = useMock();
  const locked = !planAtLeast(place.plan, "pro");
  const state = WEBSITE_STATES[place.websiteState];
  const complete = profileComplete(world.profiles[place.id]);
  const slug = place.id.replace(/^plc_/, "");
  const url = place.websiteDomain ?? `${slug}.mesita.co`;

  return (
    <div className="flex flex-col gap-4">
      <Half label="Manage">
        {locked ? (
          <p className={INFO_BOX_CLASS}>
            Needs {PLAN_LABEL.pro}. The site books and takes orders, which is
            what the rung carries.
          </p>
        ) : (
          <>
            <MenuDoor place={place} reads="The site" />
            <Section
              title={
                <span className="flex items-center gap-2">
                  {state.headline}
                  <Badge tone={state.tone}>{place.websiteState === "published" ? "On" : place.websiteState === "none" ? "Off" : "Draft"}</Badge>
                </span>
              }
              description={state.lede}
              lane
              right={
                state.verb ? (
                  <button
                    type="button"
                    disabled={place.websiteState === "picked" && !complete}
                    className={`${CTA_BUTTON_CLASS} self-start`}
                  >
                    {state.verb}
                    {place.websiteState === "published" && <ExternalLink className="h-4 w-4" aria-hidden />}
                  </button>
                ) : undefined
              }
            >
              {place.websiteState === "picked" && !complete && (
                <p className={INFO_BOX_CLASS}>
                  Generate is off until the profile is complete — a name, an
                  address, hours and at least one photo. The draft is written
                  from them.{" "}
                  <Link href={productKeyHref(place.id, "products", "profile")} className="underline underline-offset-4">
                    Open Mesita Profile
                  </Link>
                </p>
              )}
              {place.websiteState === "published" && (
                <div className="bg-muted text-muted-foreground rounded-xl px-3 py-2.5 text-[12.5px] break-all">
                  https://{url}
                </div>
              )}
            </Section>

            <Section
              title="Template"
              description="Four, on purpose. A template fixes the structure and the buttons that book and order; asking changes everything else."
            >
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {WEBSITE_TEMPLATES.map((t) => {
                  const picked = place.websiteTemplate === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={picked}
                      className={cn(
                        "border-border flex h-24 flex-col items-start justify-end rounded-xl border p-3 text-left text-[13px] font-semibold transition",
                        picked ? "border-foreground" : "hover:border-foreground/30",
                      )}
                    >
                      {WEBSITE_TEMPLATE_LABEL[t]}
                      {picked && <Check className="mt-1 h-3.5 w-3.5" aria-hidden />}
                    </button>
                  );
                })}
              </div>
            </Section>

            <Section
              title="Address and promotion"
              description="Included: a Mesita subdomain and organic search. Optional: your own domain, and a small Google budget with its own line on the bill."
            >
              <div className={RULES_CARD}>
                <Rule
                  label="Address"
                  note={place.websiteDomain ? "Your own domain, connected." : "Included. Connect a domain you own, or buy one here — Mesita renews it for you."}
                  value={<span className="font-normal">{url}</span>}
                />
                <Rule
                  label="Google promotion"
                  note="Shown as its own line: MX$200 of MX$1,000 a month goes to ads that bring people to this site. Pause it here any time."
                  value={<button type="button" className={GHOST_PILL_BUTTON_CLASS}>Pause</button>}
                />
                <Rule
                  label="Books and orders through"
                  note="Online Reservations and Online Orders. The site never holds a booking of its own."
                  value={<Badge tone="on">Mesita</Badge>}
                />
              </div>
            </Section>
          </>
        )}
      </Half>
    </div>
  );
}
