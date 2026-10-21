"use client";

import { useEffect, useState } from "react";
import {
  Bell,
  Bookmark,
  CalendarCheck,
  CreditCard,
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
import { instagramSummary, type ConsumerFacts } from "@/lib/consumer-identity";
import { CONSUMER_ROUTES, SAVED_TAB_HREF } from "@/lib/consumer-route-contract";
import { PLAN_LABEL, toGuestPlan } from "@/lib/guest-standing";
import { DestGrid, DestTile } from "./profile-sections";
import { IdentityBar } from "./IdentityBar";

// The Me surface — the identity header, then seven cells. Support left the
// grid (Pato, MESITA-2169: "move support into settings") and lives on
// Settings; Saved came in from the bar (Pato, MESITA-2561: "move the bottom
// menu to me and reservations to me too") and sits beside Reservations, the
// two doors into the one Saved page:
//
//   header         identity + Instagram; the bar IS a door (MESITA-1652)
//   2              Profile (carries the member number) · Instagram
//   2              Saved (Favorites) · Reservations
//   2              Plan · Notifications
//   1              Settings
//
// SEVEN CELLS, AND THAT IS THE WHOLE PAGE. route-structure T8 pins them.
//
// EVERY CELL IS A ROUTE (Pato, MESITA-1789). Sheets over this hub stacked
// history as overlays. DestTiles Link to /me/<box>.
//
// THERE IS NO PASSPORT (Pato, MESITA-2043: "we don't have passports"). The
// one thing the Passport printed that nothing else did was the member number,
// and that lives on Profile now; /me/passport 308s to /me/profile.

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
  const igSummary = instagramSummary(igFacts);

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
        instagramSummary={igSummary}
      />
      <div className="scrollbar-hide flex-1 overflow-y-auto px-4 pt-5 pb-8">
        <div className="flex flex-col gap-3">
          {/* PROFILE LEADS (Pato, 2026-09-08), INSTAGRAM BESIDE IT
              (MESITA-2080). Profile's summary is the MEMBER NUMBER — the
              string staff look a guest up by — because the tile is a Link
              and cannot hold a copy button; the copy lives on /me/profile. A
              null code is a real state (assigned on first profile read), and
              a failed read claims nothing. Instagram's summary is the FACT,
              not an invitation to read about it. */}
          <DestGrid>
            <DestTile
              Icon={UserRound}
              title="Profile"
              summary={
                loading
                  ? "…"
                  : !profile
                    ? "Name, photo, birthday"
                    : profile.code
                      ? `Member ${profile.code}`
                      : "Member pending"
              }
              href={CONSUMER_ROUTES.mePages.profile}
            />
            <DestTile
              Icon={Instagram}
              title="Instagram"
              summary={loading ? "…" : igSummary}
              href={CONSUMER_ROUTES.mePages.instagram}
            />
          </DestGrid>

          {/* What the bar's Saved tab held (MESITA-2561): the hearted places
              and the reservations, each tile opening its own tab of
              /me/saved. The bookmark is the old tab's glyph (MESITA-2522). */}
          <DestGrid>
            <DestTile
              Icon={Bookmark}
              title="Saved"
              summary="Your favorite places"
              href={SAVED_TAB_HREF.favorites}
            />
            <DestTile
              Icon={CalendarCheck}
              title="Reservations"
              summary="Upcoming and past"
              href={SAVED_TAB_HREF.reservations}
            />
          </DestGrid>

          {/* PATO'S ORDER (MESITA-2134), minus Support (MESITA-2169):
              profile, instagram, plan, notifications, settings. */}
          <DestGrid>
            {/* Never the gem: that shape is the class chip on the card above
                (Pato, MESITA-2551: "DON'T USE THE … DIAMOND ICON. ITS
                CONFUSING"). Plan is the subscription. The summary is the
                guest's real plan, "…" until it is known (MESITA-2553). */}
            <DestTile
              Icon={CreditCard}
              title="Plan"
              summary={profile ? PLAN_LABEL[toGuestPlan(profile.plan)] : "…"}
              href={CONSUMER_ROUTES.mePages.plan}
            />
            <DestTile
              Icon={Bell}
              title="Notifications"
              summary="Bookings and updates"
              href={CONSUMER_ROUTES.mePages.notifications}
            />
          </DestGrid>

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
