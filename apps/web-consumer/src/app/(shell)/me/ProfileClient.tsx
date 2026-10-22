"use client";

import { useEffect, useState } from "react";
import {
  Bell,
  CalendarCheck,
  CreditCard,
  Crown,
  Heart,
  Plug,
  Settings as SettingsIcon,
  UserRound,
} from "lucide-react";
import { Instagram } from "@/components/shared/instagram-icon";
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
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { DestGrid, DestTile } from "./profile-sections";
import { IdentityBar } from "./IdentityBar";

// The Me surface — the identity header, then nine cells in Pato's order
// (MESITA-2562; Support left for Settings, MESITA-2169):
//
//   header         identity + Instagram; the bar IS a door (MESITA-1652)
//   2              Profile · Instagram
//   2              Class · Plan
//   2              Notifications · Reservations
//   2              Favorites · Connector
//   1              Settings, alone on the last row
//
// NINE CELLS, AND THAT IS THE WHOLE PAGE. route-structure T8 pins them.
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
    <div className="flex h-full flex-col">
      <IdentityBar
        profile={profile}
        loading={loading}
        instagramLabel={igLabel}
      />
      {/* pt-3: the header card sits one row-gap (12px) above the tiles. */}
      <div className="scrollbar-hide flex-1 overflow-y-auto px-4 pt-3 pb-8">
        <div className="flex flex-col gap-3">
          {/* PROFILE LEADS (Pato, 2026-09-08), INSTAGRAM BESIDE IT
              (MESITA-2080). The member number is on /me/profile, with its
              copy button; the tile only names the page (MESITA-2607). */}
          <DestGrid>
            <DestTile
              Icon={UserRound}
              title="Profile"
              summary="Name and photo"
              href={CONSUMER_ROUTES.mePages.profile}
            />
            <DestTile
              Icon={Instagram}
              title="Instagram"
              summary="Connect your account"
              href={CONSUMER_ROUTES.mePages.instagram}
            />
          </DestGrid>

          {/* CLASS BESIDE PLAN (Pato, MESITA-2562): two separate facts
              (MESITA-2553), each a page. Never the gem on Plan: that shape
              was the old class chip (MESITA-2551). The subtitle names the
              two values each page explains, never the guest's own
              (MESITA-2607). */}
          <DestGrid>
            <DestTile
              Icon={Crown}
              title="Class"
              summary="Regular or VIP"
              href={CONSUMER_ROUTES.mePages.class}
            />
            <DestTile
              Icon={CreditCard}
              title="Plan"
              summary="Free or Premium"
              href={CONSUMER_ROUTES.mePages.plan}
            />
          </DestGrid>

          <DestGrid>
            <DestTile
              Icon={Bell}
              title="Notifications"
              summary="Bookings and updates"
              href={CONSUMER_ROUTES.mePages.notifications}
            />
            <DestTile
              Icon={CalendarCheck}
              title="Reservations"
              summary="Upcoming and past"
              href={CONSUMER_ROUTES.mePages.reservations}
            />
          </DestGrid>

          {/* Favorites and Reservations are each their own page
              (MESITA-2565); they were the two tabs of Saved (MESITA-2561).
              Connector is Mesita in an AI assistant; it is not built, so its
              page says Soon (MESITA-2562). */}
          <DestGrid>
            <DestTile
              Icon={Heart}
              title="Favorites"
              summary="Places you saved"
              href={CONSUMER_ROUTES.mePages.favorites}
            />
            <DestTile
              Icon={Plug}
              title="Connector"
              summary="ChatGPT or Claude"
              href={CONSUMER_ROUTES.mePages.connector}
            />
          </DestGrid>

          {/* Settings closes the page, alone; the cell beside it is empty
              (Pato, MESITA-2562). */}
          <DestGrid>
            <DestTile
              Icon={SettingsIcon}
              title="Settings"
              summary="Language, account"
              href={CONSUMER_ROUTES.mePages.settings}
            />
          </DestGrid>
        </div>
      </div>
    </div>
  );
}
