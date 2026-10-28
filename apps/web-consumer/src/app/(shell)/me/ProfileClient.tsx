"use client";

import { useEffect, useState } from "react";
import { errMsg } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  apiFetchConsumerProfile,
  type ConsumerProfile,
} from "@/lib/api/profile";
import { useConsumerIdentity } from "@/lib/identity-context";
import {
  instagramSummary,
  instagramWithFollowers,
  type ConsumerFacts,
} from "@/lib/consumer-identity";
import { DestTile } from "./profile-sections";
import { MeHubFrame } from "./hub-tiles";
import { IdentityBar } from "./IdentityBar";

// The Me surface — the identity header, then ten cells in Pato's order
// (MESITA-2562; Support left for Settings, MESITA-2169):
//
//   header         identity + Instagram; the bar IS a door (MESITA-1652)
//   2              Profile · Instagram
//   2              Class · Plan
//   2              Notifications · Reservations
//   2              Favorites · Connector
//   2              Share · Settings (Share left the bar, MESITA-2871; back on Me, MESITA-2887)
//
// THE CELLS LIVE IN hub-tiles.tsx, rows and words, with the scroller they sit
// in: (hub)/loading.tsx draws the same rows while this page loads (Pato,
// MESITA-2701: "the placeholders must be similar to the page you are
// loading, like the sizes"). TEN CELLS, AND THAT IS THE WHOLE PAGE.
// route-structure T8 pins them.
//
// EVERY CELL IS A ROUTE (Pato, MESITA-1789). Sheets over this hub stacked
// history as overlays. DestTiles Link to /me/<box>.
//
// THERE IS NO PASSPORT (Pato, MESITA-2043: "we don't have passports"). The
// one thing the Passport printed that nothing else did was the member number,
// and that lives on Profile now; /me/passport 308s to /me/profile.
//
// NO TILE PRINTS A GUEST FACT (Pato, MESITA-2607: "in the boxes below don't
// display anything of info of the user ... don't display info
// preliminarily"). The header card holds the four facts; every tile's
// subtitle is a static description of what its page holds. Until MESITA-2607
// Profile printed the member number, Instagram the handle, Class and Plan the
// guest's values, each behind a loading skeleton.

export function ProfileClient() {
  const supabase = useBrowserSupabase();
  const identity = useConsumerIdentity();

  const [profile, setProfile] = useState<ConsumerProfile | null>(null);
  const [loading, setLoading] = useState(true);

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
  // ONE STRING FOR THE CHIP AND THE TILE (MESITA-2606): "Insta: @pato · 25K
  // followers". The fresh profile count wins; the seeded one covers a fetch
  // that has not landed.
  const igLabel = instagramWithFollowers(
    instagramSummary(igFacts),
    profile?.instagram_followers_count ?? igFacts.igFollowers,
    igFacts.igConnected && !igFacts.unknown,
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { consumer } = await apiFetchConsumerProfile(supabase);
        if (cancelled) return;
        setProfile(consumer);
      } catch (e) {
        if (!cancelled) toast(errMsg(e, "Couldn't load your profile."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // The Instagram page reloads onto /me?instagram=success after a claim, so
  // the server-seeded identity is fresh when the toast lands.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("instagram") === "success") {
      toast.success("Instagram connected.");
    }
  }, []);

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
      tile={(cell) => (
        <DestTile
          Icon={cell.Icon}
          title={cell.title}
          summary={cell.summary}
          href={cell.href}
        />
      )}
    />
  );
}
