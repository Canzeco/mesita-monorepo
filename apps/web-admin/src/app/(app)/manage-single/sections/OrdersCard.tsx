"use client";

import { ShoppingBag } from "lucide-react";
import { type AdminPlace } from "../actions";
import { CrossTabLink, SectionCard } from "../ui";

// Orders — the REMOTE context, parked (MESITA-1148).
//
// Mesita prices exactly two contexts: a VISIT (the guest is at the place) and
// an ORDER (the guest is not). Visits shipped; orders have no table, no EF and
// no consumer type — `orders_config.enabled` is false and every knob on the
// Orders Config page is labeled STAGED. So this box holds NO switch: a control
// that saves nothing is worse than an honest Soon (house rule — unenforced
// config is a bug).
//
// What it does show is the one thing that is already real per place: the
// place's own ordering links, which are plain place fields today and become
// the `externalLink` channel the moment the rail ships.
export function OrdersCard({ place }: { place: AdminPlace }) {
  const links = [
    { label: "Uber Eats", value: place.uber_eats_url },
    { label: "Website", value: place.website_url },
  ].filter((l) => typeof l.value === "string" && l.value.trim() !== "");

  return (
    <SectionCard
      icon={<ShoppingBag className="h-4 w-4" />}
      tint="violet"
      title="Orders"
      subtitle="Rewarding a guest who orders without coming in — the remote half of what Mesita prices."
      action={
        <span className="bg-muted text-muted-foreground inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase">
          Soon
        </span>
      }
    >
      <p className="text-muted-foreground mt-5 text-xs leading-relaxed">
        Order tickets don&apos;t exist yet — no rail, no ticket, nothing to
        configure per place. When they ship, the first channel is the
        place&apos;s own ordering link (no new checkout to build), the receipt
        is the proof, and the quota is a Premium perk. Quotas, minimums and
        fulfilment are Mesita-wide, under Configurations → Orders.
      </p>
      <div className="border-border/60 mt-4 border-t pt-4">
        <span className="text-foreground/90 text-[13px] font-medium">
          Ordering links on file
        </span>
        {links.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-1">
            {links.map((l) => (
              <li key={l.label} className="text-muted-foreground truncate text-xs">
                <span className="text-foreground/80 font-medium">{l.label}:</span>{" "}
                {l.value}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground mt-2 text-xs">
            None yet — a place with no ordering link can&apos;t be in the first
            wave.
          </p>
        )}
        <div className="mt-3">
          <CrossTabLink href={`/manage-single/${place.id}/place`}>
            Edit under Place → Channels
          </CrossTabLink>
        </div>
      </div>
    </SectionCard>
  );
}
