"use client";

// A POOL PLACE's Profile: identity, and the door that claims it
// (MESITA-1875, lifted out of `profile/page.tsx`).
//
// It reads EVERYTHING FROM CONTEXT and fetches nothing. The one fact it needs
// was already resolved one layout up: `PlaceScope.view` — the layout's own
// `getPlaceView`, the same read that produced the 404 verdict. That is three
// Edge Function calls and a cookie read deleted from a screen whose entire job
// is to show four fields and one button.
//
// AND IT NEEDS NOTHING ELSE NOW (MESITA-1892). It used to read the rail's
// organizations too, because claiming meant naming which organization the
// place was about to join — and because "held by" printed the holder's NAME.
// `claim_place(p_place_id, p_claimer)` mints the caller's own owner row, so
// the claim has one subject, and the holder has no name to print: either you
// hold this place or somebody does, and who that is has never been a
// stranger's business.

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Section } from "@/components/shared/Section";
import { DataRow } from "@/components/console/badges";
import { PlaceGallery } from "@/components/console/PlaceGallery";
import { PlaceHoldButton } from "@/components/console/PlaceHoldButton";
import { canRelease } from "@/lib/active-place";
import { placesHref } from "@/lib/console-routes";
import { usePlaceScope } from "../PlaceScope";

export function PoolProfile() {
  const { view } = usePlaceScope();

  // The layout publishes `view` for exactly this branch; a held place renders
  // ProfileTab instead and never reaches here.
  if (!view) return null;
  const { place, holder, claimable } = view;

  return (
    <>
      {/* ONE LIST since MESITA-1614, at ONE address since MESITA-1892 — so
          Back lands on the same catalogue whichever half of it you came from,
          and there is no portfolio to pick between any more. */}
      <Link
        href={placesHref()}
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-[13px]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Places
      </Link>

      <PlaceGallery
        photos={place.photos ?? []}
        totalPhotos={place.totalPhotos ?? (place.photos ?? []).length}
        name={place.name}
      />

      <Section title="Identity" description="What this address is.">
        <div>
          <DataRow label="Address">{place.address ?? "Not set"}</DataRow>
          <DataRow label="Zone">{place.zone ?? "Not set"}</DataRow>
          <DataRow label="City">{place.city ?? "Not set"}</DataRow>
          <DataRow label="Phone">{place.phone ?? "Not set"}</DataRow>
        </div>
      </Section>

      <Section
        title="Holding"
        description={
          holder
            ? "You hold this place. Releasing returns it to the public pool."
            : "Nobody holds this place. Claiming makes you its owner, which is what unlocks the staff PIN and the partnership."
        }
        right={
          holder ? (
            <PlaceHoldButton
              action="release"
              placeId={place.id}
              allowed={canRelease(holder.myRole)}
            />
          ) : claimable ? (
            // NO ROLE GATE. Claiming mints the claimer's own owner row, so
            // there is no membership to hold first — `allowed` is what hides
            // a button the EF would 403, and this one it will not.
            <PlaceHoldButton action="claim" placeId={place.id} allowed />
          ) : null
        }
      >
        <div>
          {/* The pool says so; a held place says nothing more than that it is
              held. WHO holds it was the organization's name, and naming a
              stranger's holder was never this screen's business — a place you
              hold renders ProfileTab and never reaches here at all. */}
          <DataRow label="Held by">
            {holder ? "You" : "The public pool"}
          </DataRow>
          {!holder && !claimable && (
            <DataRow label="Claim it">Not available right now</DataRow>
          )}
        </div>
      </Section>
    </>
  );
}
