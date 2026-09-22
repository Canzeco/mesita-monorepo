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
  IdCard,
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
import { diamondSummary, instagramSummary } from "@/lib/consumer-identity";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { DestGrid, DestTile } from "./profile-sections";
import { PassportBar } from "./PassportBar";

// The Me surface — the passport header, then eight pairs:
//
//   passport       identity + the two facts; the bar IS a door (MESITA-1652)
//   2              Profile · Passport
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
// stay Soon and inert. Number copy stays in-place on the passport page.
// SearchResultsPanel is a different product rule and is not this surface.
//
// THE TWO FACTS ARE CELLS AGAIN, AND THIS TIME THEY ARE THE PRODUCT (Pato,
// MESITA-2040: "so add instagram and then diamond. those are independent").
//
// This pair has been added and removed twice — MESITA-1682 put Instagram and
// Class in the grid, MESITA-1787 pulled them back into Passport ("Move
// instagram and class into Passport. Yes. but keep them in the header."). Read
// that history before assuming this is the same move a third time: it is not.
// Both earlier rounds were about WHERE ONE AXIS lives, and the argument
// against a cell was that the header already stated the same rung. There is no
// rung. Instagram and Diamond are two unrelated facts with two unrelated
// doors, and a grid of destinations is exactly where two unrelated
// destinations belong.
//
// PASSPORT KEPT ITS CELL AND LOST ITS SUBTITLE'S JOB. It used to read "Class
// and Instagram" because it owned both axes once the grid gave them up. It
// owns the DOCUMENT — the member number, the printed fields, the MRZ — and
// that is what the cell says now.
//
// NO CARDS CELL. Wallet already lists cards inline. `/me?cards=` 308s onto
// /new-visit/wallet so Stripe's return still lands on the list.

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
      toast.success("You're Diamond.");
    }
  }, []);

  const planTile =
    plan === "premium" ? "Premium" : `Free · MX$${PREMIUM_PLAN_PRICE_MXN}/mo`;

  return (
    <div className="flex h-full flex-col">
      <PassportBar
        profile={profile}
        loading={loading}
        diamondSummary={diamondLabel}
        instagramSummary={igSummary}
      />
      <div className="scrollbar-hide flex-1 overflow-y-auto px-4 pt-5 pb-8">
        <div className="flex flex-col gap-3">
          {/* PROFILE LEADS (Pato, 2026-09-08), reversing MESITA-1648. That
              issue put Passport first because it "sits directly under the
              card, so naming it first continues what the card just said". The
              header now states the identity in full — photo, name, Instagram,
              Diamond, phone — so the first cell is the one that EDITS it, and
              Passport is the document you open to read it back.

              PASSPORT SAYS WHAT IS ON THE DOCUMENT. It read "Class and
              Instagram" while it owned both axes (MESITA-1787); those are
              their own cells now, so the subtitle names what only this page
              prints — the member number and the passport's own fields.
              MESITA-1688 dropped the privacy switch this comment used to also
              name: profile_public defaults true for every account and Settings
              owns the toggle exclusively. */}
          <DestGrid>
            <DestTile
              Icon={UserRound}
              title="Profile"
              summary="Name, photo, birthday"
              href={CONSUMER_ROUTES.mePages.profile}
            />
            <DestTile
              Icon={IdCard}
              title="Passport"
              summary="Member number and details"
              href={CONSUMER_ROUTES.mePages.passport}
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
              href={CONSUMER_ROUTES.newVisit.wallet}
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
