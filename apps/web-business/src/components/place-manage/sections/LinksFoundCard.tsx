"use client";

// Links Found (MESITA-4551, was Reviews States, MESITA-2190): one row per
// source, true when the place has it. Google, Instagram and Facebook read
// the resolved flags the payload carries; Foursquare is true once a place
// is linked (MESITA-4544); every other row is true when its link is stored.
// Stars, snippets and follower counts stay on the Reviews tab as display.

import { LinkIcon } from "@phosphor-icons/react/dist/ssr";
import type { AdminPlace } from "../actions";
import { SectionCard } from "@/components/ui/manage";
import { stateBoolChip } from "@/lib/state-vocabulary";
import { StateRow } from "./StateCard";

type Row = { name: string; found: boolean | undefined; what: string };

const has = (v: unknown) => typeof v === "string" && v.trim().length > 0;
/** A link column: absent from the payload is unknown, empty is not found. */
const link = (place: AdminPlace, key: string): boolean | undefined => {
  const v = (place as Record<string, unknown>)[key];
  return v === undefined ? undefined : has(v);
};

function rows(place: AdminPlace): Row[] {
  const p = place as Record<string, unknown>;
  const flag = (k: "google_found" | "instagram_found" | "facebook_found") =>
    typeof place[k] === "boolean" ? place[k] : undefined;
  const fsq = p.foursquare_place_id === undefined && p.foursquare_url === undefined
    ? undefined
    : has(p.foursquare_place_id) || has(p.foursquare_url);
  return [
    { name: "Google", found: flag("google_found"), what: "The Google listing" },
    { name: "Instagram", found: flag("instagram_found"), what: "The Instagram account" },
    { name: "Facebook", found: flag("facebook_found"), what: "The Facebook page" },
    { name: "Foursquare", found: fsq, what: "The Foursquare place" },
    { name: "Uber Eats", found: link(place, "uber_eats_url"), what: "The Uber Eats store" },
    { name: "DiDi Food", found: link(place, "didi_food_url"), what: "The DiDi Food store" },
    { name: "OpenTable", found: link(place, "opentable_url"), what: "The OpenTable page" },
    { name: "Resy", found: link(place, "resy_url"), what: "The Resy page" },
    { name: "Website", found: link(place, "website_url"), what: "The website" },
    { name: "WhatsApp", found: link(place, "whatsapp_url"), what: "The WhatsApp link" },
    { name: "X", found: link(place, "x_url"), what: "The X account" },
    { name: "Threads", found: link(place, "threads_url"), what: "The Threads account" },
    { name: "Reddit", found: link(place, "reddit_url"), what: "The Reddit page" },
  ];
}

export function LinksFoundCard({ place }: { place: AdminPlace }) {
  return (
    <SectionCard icon={<LinkIcon size={20} />} title="Links Found">
      <div className="mt-5 flex flex-col">
        {rows(place).map(({ name, found, what }) => (
          <StateRow
            key={name}
            name={`${name} Found`}
            on={found === true}
            chip={stateBoolChip(found === undefined ? "unknown" : found)}
            detail={found === undefined ? "This payload does not carry that link." : found ? `${what} resolved.` : `${what} is not linked.`}
          />
        ))}
      </div>
    </SectionCard>
  );
}
