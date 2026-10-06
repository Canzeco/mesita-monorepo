"use client";

// Express Website — pick a template, read the draft, publish.
//
// The site is this place's own address (`<slug>.mesita.co`, or a domain they
// type). Its buttons book and order through Mesita, and the menu it prints is
// the one Digital Menu published. `/w/<slug>` is that site, in this console.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ExternalLink } from "lucide-react";
import { useHeldPlace } from "@/components/console/PlaceScope";
import { useMock } from "@/mock/MockStore";
import { Group } from "@/components/shared/Group";
import { Half } from "@/components/shared/Half";
import { Rule } from "@/components/shared/Rule";
import { Notice } from "@/components/shared/Notice";
import { Badge } from "@/components/shared/Badges";
import { profileComplete } from "@/lib/partner";
import { productKeyHref } from "@/lib/product-routes";
import {
  generateWebsite,
  pickWebsiteTemplate,
  publishedSectionsOf,
  publishWebsite,
  setWebsiteDomain,
  toggleWebsiteAds,
} from "@/mock/desk";
import {
  WEBSITE_TEMPLATES,
  WEBSITE_TEMPLATE_LABEL,
  type WebsiteState,
  type WebsiteTemplate,
} from "@/mock/types";
import { cn } from "@/lib/utils";
import { money } from "@/lib/format";

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

const TEMPLATE_CLASS: Record<WebsiteTemplate, string> = {
  elegant: "bg-[#f7f4ef] text-[#1c1915] font-serif",
  casual: "bg-[#fff8ef] text-[#3a2414]",
  night: "bg-[#141418] text-[#f4f1ea]",
  cafe: "bg-[#f3e6d4] text-[#3b2416]",
};

export function WebsiteView() {
  const place = useHeldPlace();
  const { world, desk } = useMock();
  const router = useRouter();
  const state = WEBSITE_STATES[place.websiteState];
  const complete = profileComplete(world.profiles[place.id]);
  const slug = place.id.replace(/^plc_/, "");
  const url = place.websiteDomain ?? `${slug}.mesita.co`;
  const generateDisabled = place.websiteState === "picked" && !complete;
  const adsPaused = desk.places[place.id]?.websiteAdsPaused ?? false;
  const sections = publishedSectionsOf(place.id, place.menuPublishedAt, desk);
  const publishedMenu = place.menuPublishedAt !== null;

  function onPrimary() {
    if (place.websiteState === "picked") generateWebsite(place.id);
    else if (place.websiteState === "preview") {
      if (!publishedMenu) return;
      publishWebsite(place.id);
    } else if (place.websiteState === "published") {
      router.push(`/w/${slug}`);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Half label="Manage">
        <Notice
          show={place.menuPublishedAt === null}
          icon={<Check className="h-4 w-4" aria-hidden />}
          title="Publish your menu first"
          note="The site reads the published menu, and nothing is published yet. It keeps working from the moment you press Publish on Digital Menu."
          action={{ label: "Open Digital Menu", onClick: () => router.push(productKeyHref(place.id, "products", "menu")) }}
        />

        <Group title="Site">
          <Rule
            label={state.headline}
            note={
              generateDisabled ? (
                <>
                  Generate is off until the profile is complete — a name, an
                  address, hours and at least one photo. The draft is written
                  from them.{" "}
                  <Link href={productKeyHref(place.id, "products", "profile")} className="underline underline-offset-4">
                    Open Mesita Profile
                  </Link>
                </>
              ) : (
                state.lede
              )
            }
            badge={<Badge tone={state.tone}>{place.websiteState === "published" ? "On" : place.websiteState === "none" ? "Off" : "Draft"}</Badge>}
            control={
              state.verb
                ? {
                    kind: "button",
                    label: state.verb,
                    emphasis: "primary",
                    disabled: generateDisabled || (place.websiteState === "preview" && !publishedMenu),
                    onClick: onPrimary,
                  }
                : undefined
            }
          />
          {place.websiteState === "published" && (
            <Rule
              label="Address"
              control={{
                kind: "value",
                text: (
                  <Link href={`/w/${slug}`} className="inline-flex items-center gap-1.5 underline-offset-4 hover:underline">
                    {url}
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                ),
              }}
            />
          )}
        </Group>

        {(place.websiteState === "preview" || place.websiteState === "published") && (
          <Group title={place.websiteState === "published" ? "Live site" : "Draft"} description="Built from the listing and the published menu." allowOneRow>
            <SitePreview
              template={place.websiteTemplate ?? "elegant"}
              name={place.name}
              city={place.city}
              url={url}
              sections={publishedMenu ? sections : []}
              emptyMenu={!publishedMenu}
            />
          </Group>
        )}

        <Group
          title="Template"
          description="Four, on purpose. A template fixes the structure and the buttons that book and order; asking changes everything else."
          allowOneRow
        >
          <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
            {WEBSITE_TEMPLATES.map((t) => {
              const picked = place.websiteTemplate === t;
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={picked}
                  onClick={() => pickWebsiteTemplate(place.id, t, place.websiteState)}
                  className={cn(
                    "border-border flex h-24 flex-col items-start justify-end rounded-xl border p-3 text-left text-[13px] font-semibold transition",
                    picked ? "border-foreground" : "hover:border-foreground/30",
                    TEMPLATE_CLASS[t],
                  )}
                >
                  {WEBSITE_TEMPLATE_LABEL[t]}
                  {picked && <Check className="mt-1 h-3.5 w-3.5" aria-hidden />}
                </button>
              );
            })}
          </div>
        </Group>

        <Group
          title="Address and promotion"
          description="Included: a Mesita subdomain and organic search. Optional: your own domain, and a small Google budget with its own line on the bill."
        >
          <Rule
            label="Address"
            note={place.websiteDomain ? "Your own domain, connected." : "Included. Type a domain you own. Blank keeps the Mesita subdomain."}
            control={{
              kind: "input",
              value: place.websiteDomain ?? "",
              placeholder: `${slug}.mesita.co`,
              "aria-label": "Website domain",
              onChange: (v) => setWebsiteDomain(place.id, v),
            }}
          />
          <Rule
            label="Google promotion"
            note={
              adsPaused
                ? "Paused. Nothing from this month's budget is being spent."
                : "Shown as its own line: MX$200 of MX$1,000 a month goes to ads that bring people to this site."
            }
            badge={<Badge tone={adsPaused ? "off" : "live"}>{adsPaused ? "Paused" : "On"}</Badge>}
            control={{
              kind: "button",
              label: adsPaused ? "Resume" : "Pause",
              onClick: () => toggleWebsiteAds(place.id, !adsPaused),
            }}
          />
          <Rule
            label="Books and orders through"
            note="Online Reservations and Online Orders. The site never holds a booking of its own."
            control={{ kind: "value", text: <Badge tone="on">Mesita</Badge> }}
          />
        </Group>
      </Half>
    </div>
  );
}

function SitePreview({
  template,
  name,
  city,
  url,
  sections,
  emptyMenu,
}: {
  template: WebsiteTemplate;
  name: string;
  city: string;
  url: string;
  sections: { id: string; name: string; dishes: { id: string; name: string; blurb: string; table: number | null }[] }[];
  emptyMenu: boolean;
}) {
  return (
    <div className={cn("m-3 overflow-hidden rounded-xl border border-black/10", TEMPLATE_CLASS[template])}>
      <div className="flex items-center gap-2 border-b border-black/10 px-3 py-2 text-[11px] opacity-70">
        <span className="h-2.5 w-2.5 rounded-full bg-current opacity-30" />
        <span className="truncate">{url}</span>
      </div>
      <div className="px-4 py-5">
        <p className="text-[11px] tracking-[0.16em] uppercase opacity-60">{city}</p>
        <h3 className="mt-1 text-2xl font-semibold tracking-tight">{name}</h3>
        <div className="mt-3 flex gap-2 text-[12px] font-semibold">
          <span className="rounded-full border border-current/30 px-3 py-1">Book a table</span>
          <span className="rounded-full border border-current/30 px-3 py-1">Order</span>
        </div>
        {emptyMenu ? (
          <p className="mt-4 text-[13px] opacity-70">Nothing published yet on Digital Menu, so this section stays empty.</p>
        ) : (
          <div className="mt-5 flex flex-col gap-4">
            {sections.map((s) => (
              <div key={s.id}>
                <p className="text-[11px] font-semibold tracking-[0.14em] uppercase opacity-60">{s.name}</p>
                <ul className="mt-1">
                  {s.dishes.map((d) => (
                    <li key={d.id} className="flex items-baseline justify-between gap-3 border-b border-current/10 py-1.5 text-[13px]">
                      <span>
                        <span className="font-semibold">{d.name}</span>
                        {d.blurb && <span className="mt-0.5 block text-[11.5px] opacity-70">{d.blurb}</span>}
                      </span>
                      <span className="shrink-0 tabular-nums">{d.table === null ? "—" : money(d.table)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
