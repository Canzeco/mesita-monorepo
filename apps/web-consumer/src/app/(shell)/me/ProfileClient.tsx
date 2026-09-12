"use client";

import { useEffect, useState } from "react";
import {
  Bell,
  CalendarCheck,
  CircleHelp,
  Bot,
  Footprints,
  Gift,
  IdCard,
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
  CLASSES,
  PREMIUM_PLAN_ICON,
  PREMIUM_PLAN_PRICE_MXN,
} from "@/lib/consumer-data";
import { useConsumerClass } from "@/lib/class-context";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { DestGrid, DestTile } from "./profile-sections";
import { PassportBar } from "./PassportBar";

// The Me surface — the passport header, then seven pairs:
//
//   passport       identity + the two axes; the bar IS a door (MESITA-1652)
//   2              Profile · Passport
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
// INSTAGRAM AND CLASS HAVE TWO PATHS, AND BOTH MUST STAY. Each is a header
// chip (MESITA-1652) and a row inside `PassportModal`. The Me cells came back
// in MESITA-1682 as a third path and left again (MESITA-1787, Pato: "Move
// instagram and class into Passport. Yes. but keep them in the header.").
// Those remaining paths are routes now (`/me/class`, `/me/instagram`), not
// stacked sheets. Never make either inert without adding another first:
// Instagram is the only reach door, and the Class ladder carries the ONLY
// entrance for a 10-digit invite PIN (Docs › Passport §C).
//
// NO CARDS CELL. Wallet already lists cards inline. `/me?cards=` 308s onto
// /new-visit/wallet so Stripe's return still lands on the list.

export function ProfileClient() {
  const supabase = useBrowserSupabase();
  const {
    plan,
    key: classKey,
    origin,
    handle: classHandle,
  } = useConsumerClass();

  const [profile, setProfile] = useState<ConsumerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const classLabel = CLASSES.find((c) => c.id === classKey)?.label ?? "Bronze";
  const igHandle = classHandle ?? profile?.instagram_handle ?? null;
  const igSummary =
    origin === "instagram" || igHandle
      ? igHandle
        ? `@${igHandle}`
        : "Connected"
      : "Connect it";

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
      toast.success("Connected — Rewards unlocked. Your class updated.");
    }
    const invite = params.get("invite");
    if (invite) {
      toast.success(`You're ${invite} now.`);
    }
  }, []);

  const planTile =
    plan === "premium" ? "Premium" : `Free · MX$${PREMIUM_PLAN_PRICE_MXN}/mo`;

  return (
    <div className="flex h-full flex-col">
      <PassportBar
        profile={profile}
        loading={loading}
        classLabel={classLabel}
        instagramSummary={igSummary}
      />
      <div className="scrollbar-hide flex-1 overflow-y-auto px-4 pt-5 pb-8">
        <div className="flex flex-col gap-3">
          {/* PROFILE LEADS (Pato, 2026-09-08), reversing MESITA-1648. That
              issue put Passport first because it "sits directly under the
              card, so naming it first continues what the card just said". The
              header now states the identity in full — photo, name, class,
              Instagram, phone — so the first cell is the one that EDITS it,
              and Passport is the document you open to read it back.

              PASSPORT SAYS "Class and Instagram" because that is what the
              cell owns now that the axes left the grid (MESITA-1787). The
              member number is still the one fact nowhere else in the app
              prints, and it lives inside the page. MESITA-1688 dropped the
              privacy switch this comment used to also name — profile_public
              defaults true for every account and Settings owns the toggle
              exclusively, so restating it here or in the page was the same
              two-surfaces-disagree risk this page otherwise guards against. */}
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
              summary="Class and Instagram"
              href={CONSUMER_ROUTES.mePages.passport}
            />
          </DestGrid>

          {/* THE AXES ARE NOT CELLS (MESITA-1787). They were, then they
              weren't, then they were again (MESITA-1682). Pato moved them
              into Passport and kept the header chips, so the grid no longer
              restates the two facts already on the bar. Both remaining
              doors are routes (MESITA-1789): chips and Passport rows Link
              to /me/class and /me/instagram. */}
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
