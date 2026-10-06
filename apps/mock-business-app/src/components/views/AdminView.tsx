"use client";

// Admin — SUPER-ADMINS ONLY, and the gate is not cosmetic.
//
// Every box on this view calls an admin-only endpoint. Rendered for a venue,
// each one would 403 and the page would paint those failures as confident
// falsehoods: "never been embedded", a row of blank pipeline pills, and buttons
// offering to approve the venue's own ownership proof. So the row is hidden AND
// the address is refused — hidden is not protected.
import { useHeldPlace } from "@/components/console/PlaceScope";
import { Section } from "@/components/shared/Section";
import { Badge } from "@/components/shared/Badges";
import { TINY_LABEL_CLASS, GHOST_PILL_BUTTON_CLASS } from "@/lib/ui-classes";

export function AdminView() {
  const place = useHeldPlace();

  return (
    <div className="flex flex-col gap-4">
      <Section
        title="Record"
        description="The row behind this place. What an operator sees is derived from these."
        lane
      >
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[
            ["Place id", place.id],
            ["Category", place.category],
            ["City", place.city],
            ["Role you hold", place.myRole],
            ["Reviews", String(place.reviewCount)],
            ["Photos", String(place.photoCount)],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className={TINY_LABEL_CLASS}>{k}</dt>
              <dd className="font-mono text-[12px] break-all">{v}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section
        title="The three facts"
        description="Independent, and each set by a different thing. Never collapse them into one badge."
      >
        <ul className="flex flex-col gap-2">
          {[
            ["Verified", place.verified, "Mesita checked the place is real."],
            ["Partner", place.partnered, "The badge, granted by Mesita Ultra alone. NOT \u201Cthe place pays\u201D \u2014 Mesita Pro pays and wears none."],
            ["Promoting", place.promoting, "The place is buying reach in Discovery."],
          ].map(([label, on, why]) => (
            <li key={String(label)} className="border-border flex items-start gap-3 rounded-xl border px-3 py-2.5">
              <Badge tone={on ? "on" : "neutral"}>{on ? "yes" : "no"}</Badge>
              <div className="min-w-0">
                <p className="text-sm font-medium">{String(label)}</p>
                <p className="text-muted-foreground text-[12px] leading-snug">{String(why)}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="Enrichment"
        description="What the pipeline has done to this place, and when."
        right={<button type="button" className={GHOST_PILL_BUTTON_CLASS}>Re-run</button>}
      >
        <ul className="flex flex-col gap-1.5">
          {["Embedded", "Photos fetched", "Hours parsed", "Tags assigned", "Geocoded"].map((step, i) => (
            <li key={step} className="flex items-center gap-2 text-[13px]">
              <Badge tone={i < 4 ? "on" : "soon"}>{i < 4 ? "done" : "queued"}</Badge>
              <span>{step}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
