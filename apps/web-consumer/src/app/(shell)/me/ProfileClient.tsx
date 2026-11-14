"use client";

import { useEffect } from "react";
import { toast } from "@/lib/toast";
import { useConsumerProfile } from "@/lib/use-consumer-profile";
import { useConsumerIdentity } from "@/lib/identity-context";
import {
  instagramSummary,
  instagramWithFollowers,
  type ConsumerFacts,
} from "@/lib/consumer-identity";
import { DestTile, type TileState } from "./profile-sections";
import { MeHubFrame } from "./hub-tiles";
import { IdentityBar } from "./IdentityBar";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { useUnseenNotificationCount } from "@/components/consumer/use-unseen-notifications";
import {
  isOpenVisit,
  useReservations,
  useVisits,
} from "@/components/consumer/activity/MeLists";

// The Me surface — the identity header, then nine cells in Pato's order
// (MESITA-3855):
//
//   header         identity + Instagram; the bar IS a door (MESITA-1652)
//   2              Profile · Instagram
//   2              Class · Plan (Soon)
//   2              Notifications · Reservations
//   2              Tickets · Gift (MESITA-3885)
//   1              Settings
//
// THE CELLS LIVE IN hub-tiles.tsx, rows and words, with the scroller they sit
// in: (hub)/loading.tsx draws the same rows while this page loads (Pato,
// MESITA-2701: "the placeholders must be similar to the page you are
// loading, like the sizes"). NINE CELLS, AND THAT IS THE WHOLE PAGE.
// route-structure T8 pins them.
//
// EVERY CELL IS A ROUTE (Pato, MESITA-1789), or Soon and opens nothing
// (Plan, MESITA-3855). Sheets over this hub stacked history as overlays.
// DestTiles Link to /me/<box>.
//
// THERE IS NO PASSPORT (Pato, MESITA-2043: "we don't have passports");
// /me/passport 308s to /me/profile. Its member number moved to Profile, then
// left the guest app (MESITA-3874).
//
// NO TILE PRINTS A GUEST FACT (Pato, MESITA-2607: "in the boxes below don't
// display anything of info of the user ... don't display info
// preliminarily"). The header card holds the four facts; every tile's
// subtitle is a static description of what its page holds. Until MESITA-2607
// Profile printed the member number, Instagram the handle, Class and Plan the
// guest's values, each behind a loading skeleton.
//
// BUT THE BOXES SHOW THEIR STATE (MESITA-3885, Pato: "mention in the boxes the
// states too ... the number of reservations or red bubbles"). Not facts, and
// never a skeleton: a red dot where something waits for the guest, a number
// for how many, on the box's right edge, fading in when its read lands.
//   Notifications  red count of unseen
//   Reservations   ink count of upcoming; a red dot too while a place's
//                  other times wait for the guest's pick
//   Tickets        red dot while a bill is open
//   Profile        red dot while Last name is empty (reservations need it)
// The reads are the ones Me's own pages make, by the same keys, so a box and
// its page share one read.

export function ProfileClient() {
  const identity = useConsumerIdentity();
  // The row the shell already read (MESITA-3014): Me paints the guest's name
  // and photo on its first frame, and revalidates in the background.
  const { data: profile, loading } = useConsumerProfile();
  const unseen = useUnseenNotificationCount();
  const reservations = useReservations();
  const visits = useVisits();

  // THE CONTEXT IS SEEDED SERVER-SIDE AND THE PROFILE IS FETCHED HERE, so the
  // handle can land in either place first. The context wins when it has one —
  // a fresh connect updates it before the profile refetches — and the profile
  // row covers the cold load.
  const igFacts: ConsumerFacts = identity.igHandle
    ? identity
    : {
        ...identity,
        igHandle: profile?.instagram_handle ?? null,
        igConnected: identity.igConnected || Boolean(profile?.instagram_handle),
      };
  // ONE STRING FOR THE CHIP AND THE TILE (MESITA-2606): "@pato (~25K
  // followers". The fresh profile count wins; the seeded one covers a fetch
  // that has not landed.
  const igLabel = instagramWithFollowers(
    instagramSummary(igFacts),
    profile?.instagram_followers_count ?? igFacts.igFollowers,
    igFacts.igConnected && !igFacts.unknown,
  );

  // The Instagram page reloads onto /me?instagram=success after a claim, so
  // the server-seeded identity is fresh when the toast lands.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("instagram") === "success") {
      toast.success("Instagram connected.");
    }
  }, []);

  // THE BOXES' STATES (MESITA-3885). A read not landed yet, or failed,
  // leaves its box plain.
  const upcoming = reservations.rows?.filter((r) => r.upcoming).length ?? 0;
  const mustPick = (reservations.data?.rows ?? []).some(
    (r) =>
      r.state === "pending" &&
      Array.isArray(r.alternatives) &&
      r.alternatives.length > 0 &&
      Date.parse(r.reserved_at) >= reservations.nowMs,
  );
  const billOpen = (visits.data?.visits ?? []).some(isOpenVisit);
  const noLastName = !!profile && !profile.last_name?.trim();
  const states: Record<string, TileState> = {
    [CONSUMER_ROUTES.mePages.notifications]: {
      count: unseen,
      countTone: "red",
      label: unseen ? `${unseen} new` : undefined,
    },
    [CONSUMER_ROUTES.mePages.reservations]: {
      count: upcoming,
      countTone: "ink",
      dot: mustPick,
      label:
        [
          upcoming ? `${upcoming} upcoming` : null,
          mustPick ? "a place offered other times" : null,
        ]
          .filter(Boolean)
          .join(", ") || undefined,
    },
    [CONSUMER_ROUTES.mePages.tickets]: {
      dot: billOpen,
      label: billOpen ? "a bill is open" : undefined,
    },
    [CONSUMER_ROUTES.mePages.profile]: {
      dot: noLastName,
      label: noLastName ? "add your last name" : undefined,
    },
  };

  return (
    <MeHubFrame
      bar={
        <IdentityBar
          profile={profile}
          loading={loading}
          instagramLabel={igLabel}
          // Couldn't load keeps the colour: it is not a "no".
          instagramConnected={igFacts.igConnected || igFacts.unknown}
        />
      }
      tile={(cell, shape) => (
        <DestTile
          shape={shape}
          Icon={cell.Icon}
          title={cell.title}
          summary={cell.summary}
          href={cell.href}
          soon={cell.soon}
          state={states[cell.href]}
        />
      )}
    />
  );
}
