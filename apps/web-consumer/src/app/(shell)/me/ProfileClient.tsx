"use client";

import { useEffect, useState } from "react";
import {
  Bell,
  CalendarCheck,
  CircleHelp,
  Bot,
  Footprints,
  Gem,
  Gift,
  Instagram,
  Settings as SettingsIcon,
  Share2,
  ShoppingBag,
  UserRound,
  Users,
  Wallet as WalletIcon,
} from "lucide-react";
import { errMsg } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  apiFetchConsumerProfile,
  type ConsumerProfile,
} from "@/lib/api/profile";
import {
  PREMIUM_PLAN_ICON,
  PREMIUM_PLAN_PRICE_MXN,
} from "@/lib/consumer-data";
import { useConsumerClass } from "@/lib/class-context";
import {
  DIAMOND_PIN_SUCCESS,
  diamondChipLabel,
  diamondSummary,
  instagramSummary,
} from "@/lib/consumer-identity";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { DestGrid, DestTile } from "./profile-sections";
import { IdentityBar } from "./IdentityBar";

// The Me surface — the identity header, then one full row and seven pairs:
//
//   header         identity + the two facts; the bar IS a door (MESITA-1652)
//   full           Profile (carries the member number)
//   2              Instagram · Diamond
//   2              Wallet · Plan
//   2              Notifications · Visits
//   2              Orders · Reservations
//   2              Share · Gift
//   2              Settings · Help
//   2              Integrations · Friends
//
// EVERY LIVE CELL IS A ROUTE (Pato, MESITA-1789). Sheets over this hub
// stacked history as overlays. DestTiles now Link to /me/<box>. Parked cells
// stay Soon and inert. SearchResultsPanel is a different product rule and is
// not this surface.
//
// THERE IS NO PASSPORT (Pato, MESITA-2043: "we don't have passports. its only
// instagram and diamond"). Two independent facts — Instagram is connected
// reach, Diamond is invitation-only and anyone can ask for one — and neither
// leads to the other. The Passport cell, its /me/passport page and its data
// page are deleted; /me/passport 308s to /me/profile, because the one thing
// the Passport printed that nothing else did was the member number, and that
// lives on Profile now.
//
// PROFILE TAKES THE FULL ROW. Deleting one cell leaves fifteen, which cannot
// pair; spanning Profile keeps the seven pairs below untouched instead of
// reshuffling every row.
//
// THE TWO FACTS ARE CELLS (Pato, MESITA-2040: "so add instagram and then
// diamond. those are independent"). This pair was added and removed twice
// before (MESITA-1682, MESITA-1787) when both were one ladder; they are two
// unrelated destinations now, and a grid of destinations is where those go.
//
// NO CARDS CELL. Wallet already lists cards inline. `/me?cards=` 308s onto
// /wallet so Stripe's return still lands on the list.

export function ProfileClient() {
  const supabase = useBrowserSupabase();
  const { plan, facts } = useConsumerClass();

  const [profile, setProfile] = useState<ConsumerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // THE CONTEXT IS SEEDED SERVER-SIDE AND THE PROFILE IS FETCHED HERE, so the
  // handle can land in either place first. The context wins when it has one —
  // a fresh connect updates it before the profile refetches — and the profile
  // row covers the cold load. Same precedence the old `classHandle ??
  // profile.instagram_handle` had; it just reads off `facts` now.
  const igFacts = facts.igHandle
    ? facts
    : {
        ...facts,
        igHandle: profile?.instagram_handle ?? null,
        igConnected: facts.igConnected || Boolean(profile?.instagram_handle),
      };
  const igSummary = instagramSummary(igFacts);
  const diamondLabel = diamondSummary(facts);
  const diamondChip = diamondChipLabel(facts);

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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const state = params.get("subscription");
    if (state === "success") {
      toast.success("You're Mesita Premium — welcome in.");
    } else if (state === "cancelled") {
      toast("Checkout cancelled — you can subscribe anytime.");
    }
    if (params.get("instagram") === "success") {
      toast.success("Instagram connected.");
    }
    // The PIN grants one thing now, so the toast names it rather than echoing
    // a class label back off the query string (MESITA-2040).
    if (params.get("invite")) {
      toast.success(DIAMOND_PIN_SUCCESS);
    }
  }, []);

  const planTile =
    plan === "premium" ? "Premium" : `Free · MX$${PREMIUM_PLAN_PRICE_MXN}/mo`;

  return (
    <div className="flex h-full flex-col">
      <IdentityBar
        profile={profile}
        loading={loading}
        diamondSummary={diamondLabel}
        diamondChip={diamondChip}
        instagramSummary={igSummary}
      />
      <div className="scrollbar-hide flex-1 overflow-y-auto px-4 pt-5 pb-8">
        <div className="flex flex-col gap-3">
          {/* PROFILE LEADS (Pato, 2026-09-08), and since MESITA-2043 it
              spans the row. Its summary is the MEMBER NUMBER — the string
              staff look a guest up by when granting a Diamond invitation —
              because the tile is a Link and cannot hold a copy button; the
              copy lives on /me/profile. A null code is a real state (assigned
              on first profile read), and a failed read claims nothing. */}
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
              full
            />
          </DestGrid>

          {/* INSTAGRAM, THEN DIAMOND — the order Pato named them
              (MESITA-2040), and the order the header chips run in. Each
              summary is the FACT, not an invitation to read about it: the
              tile is the door, so the line it carries is the one thing the
              guest would open it to check. */}
          <DestGrid>
            <DestTile
              Icon={Instagram}
              title="Instagram"
              summary={loading ? "…" : igSummary}
              href={CONSUMER_ROUTES.mePages.instagram}
            />
            <DestTile
              Icon={Gem}
              title="Diamond"
              summary={loading ? "…" : diamondLabel}
              href={CONSUMER_ROUTES.mePages.diamond}
            />
          </DestGrid>

          <DestGrid>
            <DestTile
              Icon={WalletIcon}
              title="Wallet"
              summary="Credits and cards"
              href={CONSUMER_ROUTES.wallet.root}
            />
            <DestTile
              Icon={PREMIUM_PLAN_ICON}
              title="Plan"
              summary={loading ? "…" : planTile}
              href={CONSUMER_ROUTES.mePages.plan}
            />
          </DestGrid>

          <DestGrid>
            <DestTile
              Icon={Bell}
              title="Notifications"
              summary="Visits and bookings"
              href={CONSUMER_ROUTES.mePages.notifications}
            />
            <DestTile
              Icon={Footprints}
              title="Visits"
              summary="Tickets and QRs"
              href={CONSUMER_ROUTES.mePages.visits}
            />
          </DestGrid>

          <DestGrid>
            <DestTile Icon={ShoppingBag} title="Orders" summary="" soon />
            <DestTile
              Icon={CalendarCheck}
              title="Reservations"
              summary="Upcoming and past"
              href={CONSUMER_ROUTES.mePages.reservations}
            />
          </DestGrid>

          <DestGrid>
            <DestTile Icon={Share2} title="Share" summary="" soon />
            <DestTile Icon={Gift} title="Gift" summary="" soon />
          </DestGrid>

          <DestGrid>
            <DestTile
              Icon={SettingsIcon}
              title="Settings"
              summary="Privacy, language"
              href={CONSUMER_ROUTES.mePages.settings}
            />
            <DestTile
              Icon={CircleHelp}
              title="Help"
              summary="How rewards work"
              href={CONSUMER_ROUTES.mePages.help}
            />
          </DestGrid>

          <DestGrid>
            <DestTile Icon={Bot} title="Integrations" summary="" soon />
            <DestTile Icon={Users} title="Friends" summary="" soon />
          </DestGrid>
        </div>
      </div>
    </div>
  );
}
