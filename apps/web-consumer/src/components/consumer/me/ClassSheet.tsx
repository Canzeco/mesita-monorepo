"use client";

// Class — Regular or VIP (Pato, MESITA-2553). One body, two frames: this
// sheet, opened by the Class chip on the guest's own card (Me's header), and
// the /me/class page behind Me's Class tile (MESITA-2562, ClassModal). On
// Social the chip is a plain fact and opens nothing.
//
// CLASS IS NOT PLAN. VIP is never bought and never an upgrade. This sheet
// never names a plan, and the Plan page never names Class or VIP. The words
// live in class-words.ts.
//
// CLASS IS AUTOMATIC (MESITA-3850, MESITA-3864): VIP is a verified Instagram
// with 5,000 followers or more, computed by the database
// (consumers.guest_class is a generated column). No button joins or leaves.
//
// THE GUEST'S OWN CLASS ON TOP (MESITA-3873, Pato: "display you current class
// … and a shortcut to connect instagram"): a status card (class, one line, a
// bar to 5,000 while Regular and connected) with the Instagram door under it,
// then the two classes with a You pill on the guest's own. A failed profile
// read never guesses a class.
//
// PLAN'S LAYOUT (MESITA-3905, /plan-design-review): the status card is left-
// aligned with a small crown beside the class (the big centred disc went), and
// Regular and VIP are two cards with check lists, VIP in a 2px ink border, as
// Plan's Free and Pro are (MESITA-3899). No "The two classes" heading.

import { Check, Crown } from "lucide-react";

import { Instagram } from "@/components/shared/instagram-icon";

import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import {
  CLASS_MINE,
  CLASS_ROWS,
  CLASS_STATUS,
  VIP_FOLLOWERS,
  type ClassRowWords,
} from "@/components/consumer/me/class-words";
import { followersLabel } from "@/lib/consumer-identity";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { toGuestClass, type GuestClass } from "@/lib/guest-standing";
import { SHEET_BODY_CLASS, SHEET_TITLE_CLASS } from "@/lib/ui-classes";
import { useConsumerProfile } from "@/lib/use-consumer-profile";
import { cn } from "@/lib/utils";
import { RowDivider, SettingsLinkRow } from "./settings-rows";

const count = (n: number) => n.toLocaleString("en-US");

/** What the status card knows about the guest. */
export type ClassStatus =
  | { kind: "loading" }
  | { kind: "unknown" }
  | {
      kind: "known";
      guestClass: GuestClass;
      handle: string | null;
      followers: number | null;
    };

/** The small crown beside the class: ink for Regular, white in gold for VIP
 *  (the identity card's ClassBadge, MESITA-2695). */
function StatusCrown({ vip }: { vip: boolean }) {
  return (
    <span
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
        vip ? "bg-amber-500 text-white" : "bg-muted text-foreground",
      )}
      aria-hidden
    >
      <Crown className="h-4 w-4" strokeWidth={2.2} />
    </span>
  );
}

/** "1,240 followers … 5,000" over a thin bar (the MESITA-3054 bar, back). */
function FollowerProgress({ followers }: { followers: number }) {
  const share = Math.min(followers / VIP_FOLLOWERS, 1);
  return (
    <div className="mt-4 w-full" data-class-progress="">
      <div className="text-muted-foreground type-meta mb-1.5 flex justify-between">
        <span>{count(followers)} followers</span>
        <span>{count(VIP_FOLLOWERS)}</span>
      </div>
      <div
        role="progressbar"
        aria-label={CLASS_STATUS.progressLabel}
        aria-valuemin={0}
        aria-valuemax={VIP_FOLLOWERS}
        aria-valuenow={Math.min(followers, VIP_FOLLOWERS)}
        className="bg-muted h-1.5 overflow-hidden rounded-full"
      >
        <div
          className="bg-foreground h-full rounded-full"
          style={{ width: `${share * 100}%` }}
        />
      </div>
    </div>
  );
}

/** The guest's own class on top, with the Instagram door under it. */
export function ClassStatusCard({ status }: { status: ClassStatus }) {
  if (status.kind === "loading") {
    return (
      <div
        className="border-border bg-card h-[180px] animate-pulse rounded-2xl border"
        aria-hidden
        data-class-status="loading"
      />
    );
  }
  if (status.kind === "unknown") {
    return (
      <div
        className="border-border bg-card text-muted-foreground type-label rounded-2xl border px-4 py-5 text-center"
        data-class-status="unknown"
      >
        {CLASS_STATUS.unknown}
      </div>
    );
  }
  const { guestClass, handle, followers } = status;
  const vip = guestClass === "vip";
  const line = vip
    ? CLASS_STATUS.vip
    : !handle
      ? CLASS_STATUS.noInstagram
      : followers === null
        ? CLASS_STATUS.countUnknown
        : CLASS_STATUS.toGo(count(Math.max(VIP_FOLLOWERS - followers, 0)));
  return (
    <section
      className="border-border bg-card overflow-hidden rounded-2xl border"
      data-class-status={guestClass}
    >
      <div className="px-4 pt-4 pb-4">
        <div className="flex items-center gap-2">
          <StatusCrown vip={vip} />
          <h2 className="text-lg leading-6 font-semibold">
            {CLASS_STATUS.title[guestClass]}
          </h2>
        </div>
        <p className="text-muted-foreground type-label mt-1.5">{line}</p>
        {!vip && handle && followers !== null && (
          <FollowerProgress followers={followers} />
        )}
      </div>
      <RowDivider />
      {handle ? (
        <SettingsLinkRow
          Icon={Instagram}
          tint="instagram"
          href={CONSUMER_ROUTES.mePages.instagram}
          label={`@${handle}`}
          sub={
            vip && followers !== null
              ? `${followersLabel(followers)} · Sync`
              : CLASS_STATUS.sync
          }
        />
      ) : (
        <SettingsLinkRow
          Icon={Instagram}
          tint="instagram"
          href={CONSUMER_ROUTES.mePages.instagram}
          label={CLASS_STATUS.connect.label}
          sub={CLASS_STATUS.connect.sub}
        />
      )}
    </section>
  );
}

/** A class as a card (MESITA-3905): its name with the You pill, its perks
 *  as checks; VIP in a 2px ink border, as Plan's Pro. */
function ClassCard({
  title,
  perks,
  mine,
  featured = false,
}: ClassRowWords & { mine: boolean; featured?: boolean }) {
  return (
    <section
      className={cn(
        "bg-card rounded-2xl p-4",
        featured ? "border-foreground border-2" : "border-border border",
      )}
      aria-label={title}
      data-class-row={title}
    >
      <h3 className="text-base font-semibold">
        {title}
        {mine && (
          <span
            className="bg-foreground text-paper type-meta ml-1.5 rounded-full px-1.5 py-0.5 align-middle font-semibold"
            data-class-mine=""
          >
            {CLASS_MINE}
          </span>
        )}
      </h3>
      <ul className="mt-3 flex flex-col gap-2 text-sm">
        {perks.map((perk) => (
          <li key={perk} className="flex items-center gap-2">
            <Check className="h-4 w-4 shrink-0" aria-hidden />
            {perk}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The kept profile row as the status card's input. */
export function useClassStatus(): ClassStatus {
  const { data, error } = useConsumerProfile();
  if (data) {
    const handle = data.instagram_handle?.trim() || null;
    const raw = data.instagram_followers_count;
    return {
      kind: "known",
      guestClass: toGuestClass(data.guest_class),
      handle,
      followers: typeof raw === "number" && raw >= 0 ? raw : null,
    };
  }
  return error ? { kind: "unknown" } : { kind: "loading" };
}

/** The guest's class on top, then both classes. */
export function ClassBody({ status }: { status: ClassStatus }) {
  const mine = status.kind === "known" ? status.guestClass : null;
  return (
    <div className="flex flex-col gap-3">
      <ClassStatusCard status={status} />
      <ClassCard {...CLASS_ROWS.regular} mine={mine === "regular"} />
      <ClassCard {...CLASS_ROWS.vip} mine={mine === "vip"} featured />
    </div>
  );
}

/** The body with the guest's own profile. */
export function ClassList() {
  return <ClassBody status={useClassStatus()} />;
}

export function ClassSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <LocalSheet open={open} onClose={onClose} ariaLabel="Class">
      <div className={SHEET_BODY_CLASS}>
        <h2 className={SHEET_TITLE_CLASS}>Class</h2>
        <div className="mt-3">
          <ClassList />
        </div>
      </div>
    </LocalSheet>
  );
}
