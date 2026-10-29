"use client";

// Class — partnership status, Regular or VIP (Pato, MESITA-2553). One body,
// two frames: this sheet, opened by the Class chip on the guest's own card
// (Me's header), and the /me/class page behind Me's Class tile (MESITA-2562,
// ClassModal). On Social the chip is a plain fact and opens nothing.
//
// CLASS IS NOT PLAN. VIP comes through Mesita's partners (agencies, creator
// partnerships); it is never bought and never an upgrade to Pro. This sheet
// never names a plan, and the Plan page never names Class or VIP. What the
// partner rates are is not decided, so the one VIP perk is tagged Soon. The
// rows' words live in class-words.ts, which /me/class' fallback reads too
// (MESITA-2701).
//
// TWO WAYS IN (Pato, MESITA-3054; it reverses MESITA-3027's Soon): a Regular
// guest gets a "Become VIP" group under the classes — Join with Instagram,
// unlocked at INSTAGRAM_REACH_FOLLOWERS by the follower count stored when
// they connected (never automatic: the guest taps), then a 12-digit
// invitation code. The server decides (consumer-web-join-class); the button's
// lock is only what the page last knew. The button says Join, never Upgrade:
// VIP is never sold (class-plan.test.tsx).

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Crown, UsersRound } from "lucide-react";

import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import {
  CLASS_ROWS,
  JOIN_WORDS,
  joinErrorWords,
  type ClassRowWords,
} from "@/components/consumer/me/class-words";
import { PerkList } from "@/components/consumer/me/perk-list";
import { Spinner } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { EFError } from "@/lib/api/_invoke";
import { apiJoinClass, apiRefreshConsumerProfile } from "@/lib/api/profile";
import { INSTAGRAM_REACH_FOLLOWERS } from "@/lib/consumer-identity";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import {
  formatVipUntil,
  type GuestClass,
  type VipDetails,
} from "@/lib/guest-standing";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { SHEET_BODY_CLASS, SHEET_TITLE_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import {
  CurrentPill,
  IconChip,
  ME_BUTTON_CLASS,
  RowDivider,
  SettingsGroup,
} from "./settings-rows";

/** The guest's Instagram as their profile row holds it: the RAW count (null
 *  stays null — not 0) from useConsumerProfile, never identity-context's
 *  igFollowers, which is built from layout props and misses the refresh.
 *  `null` = the profile is not known yet. */
export type ClassInstagram = {
  handle: string | null;
  followers: number | null;
} | null;

function ClassRow({
  title,
  icon,
  mine,
  subtitle,
  soon,
  perks,
  vip,
}: ClassRowWords & {
  icon: React.ReactNode;
  mine: boolean;
  /** MESITA-2556: the guest's own partner and last day, on their VIP row only. */
  vip?: VipDetails | null;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3" data-class-row={title}>
      <IconChip>{icon}</IconChip>
      <div className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">
          {title}
          {mine && <CurrentPill data-class-mine="" />}
          {soon && <SoonPill />}
        </span>
        <span className="text-muted-foreground type-label block">
          {subtitle}
        </span>
        {mine && vip?.partner && (
          <span
            className="text-foreground type-label block"
            data-class-vip-partner=""
          >
            Through {vip.partner}.
          </span>
        )}
        {mine && vip?.until && (
          <span
            className="text-foreground type-label block"
            data-class-vip-until=""
          >
            Until {formatVipUntil(vip.until)}.
          </span>
        )}
        {perks && <PerkList label={perks.label} items={perks.items} />}
      </div>
    </div>
  );
}

/** Beside a class nobody can be in yet (MESITA-3027): PerkList's Soon. */
function SoonPill() {
  return (
    <span
      className="bg-muted text-muted-foreground type-meta ml-1.5 rounded-full px-1.5 py-0.5 align-middle font-semibold"
      data-class-soon=""
    >
      Soon
    </span>
  );
}

const REASON_CLASS = "text-muted-foreground type-label mt-2 block";
const LINK_CLASS = "text-foreground font-semibold underline underline-offset-2";

/** Where the Instagram row stands, from what the page last knew. The server
 *  checks again on the tap. */
function instagramLock(ig: ClassInstagram):
  | { open: true; followers: number }
  | { open: false; reason: string | null; link: string | null } {
  if (!ig) return { open: false, reason: null, link: null };
  if (!ig.handle) return { open: false, reason: JOIN_WORDS.connect, link: null };
  if (ig.followers === null) {
    return { open: false, reason: JOIN_WORDS.unknownCount, link: JOIN_WORDS.update };
  }
  if (ig.followers < INSTAGRAM_REACH_FOLLOWERS) {
    return { open: false, reason: JOIN_WORDS.needs(ig.followers), link: JOIN_WORDS.update };
  }
  return { open: true, followers: ig.followers };
}

/** "1234 5678 9012" as the guest types; the server drops the spaces. */
function groupCode(raw: string): string {
  return (raw.replace(/\D/g, "").slice(0, 12).match(/\d{1,4}/g) ?? []).join(" ");
}

/** The two ways in for a Regular guest (MESITA-3054). */
function BecomeVip({
  instagram,
  onJoined,
}: {
  instagram: ClassInstagram;
  onJoined: () => void;
}) {
  const getSupabase = useLazyBrowserSupabase();
  const router = useRouter();
  const [busy, setBusy] = useState<"instagram" | "code" | null>(null);
  const [code, setCode] = useState("");
  const [igError, setIgError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const digits = code.replace(/\D/g, "");
  const lock = instagramLock(instagram);

  async function join(via: "instagram" | "code") {
    if (busy) return;
    setBusy(via);
    setIgError(null);
    setCodeError(null);
    try {
      await apiJoinClass(
        getSupabase(),
        via === "code" ? { via, code: digits } : { via },
      );
      onJoined();
      // Surfaces read from the layout's props (the identity context) too.
      router.refresh();
    } catch (e) {
      // A 5xx, a 401 or no network is already a toast (reportEFFailure);
      // only the refusals the EF names get a line here.
      const words = e instanceof EFError ? joinErrorWords(e.code, e.body) : null;
      if (via === "code") setCodeError(words);
      else setIgError(words);
      if (via === "instagram" && e instanceof EFError && e.status === 403) {
        // The page's count was stale: re-lock the row with the server's.
        void apiRefreshConsumerProfile(getSupabase());
      }
    } finally {
      setBusy(null);
    }
  }

  const igReason = igError ?? (lock.open ? JOIN_WORDS.ready(lock.followers) : lock.reason);
  const igLink = igError ? JOIN_WORDS.update : lock.open ? null : lock.link;

  return (
    <div className="mt-6" data-class-join="">
      <SettingsGroup title={JOIN_WORDS.group}>
        <div className="px-4 py-3" data-class-join-instagram="">
          <Button
            type="button"
            size="sm"
            aria-disabled={!lock.open || busy !== null || undefined}
            aria-describedby={igReason ? "class-join-instagram-reason" : undefined}
            onClick={() => {
              if (lock.open) void join("instagram");
            }}
            className={cn(
              ME_BUTTON_CLASS,
              "w-full",
              (!lock.open || busy !== null) && "pointer-events-none opacity-50",
            )}
          >
            {busy === "instagram" && (
              <Spinner size="sm" className="border-white/40 border-t-white" />
            )}
            {JOIN_WORDS.instagramButton}
          </Button>
          {igReason && (
            <span id="class-join-instagram-reason" className={REASON_CLASS}>
              {igReason}
            </span>
          )}
          {instagram && !instagram.handle && (
            <Link
              href={CONSUMER_ROUTES.mePages.instagram}
              className={cn(REASON_CLASS, LINK_CLASS)}
            >
              Go to Instagram
            </Link>
          )}
          {igLink && instagram?.handle && (
            <Link
              href={CONSUMER_ROUTES.mePages.instagram}
              className={cn(REASON_CLASS, LINK_CLASS)}
            >
              {igLink}
            </Link>
          )}
        </div>
        <RowDivider />
        <form
          className="px-4 py-3"
          data-class-join-code=""
          onSubmit={(e) => {
            e.preventDefault();
            if (digits.length === 12) void join("code");
          }}
        >
          <span className="type-label block font-semibold">{JOIN_WORDS.codeLabel}</span>
          <input
            value={code}
            onChange={(e) => {
              setCode(groupCode(e.target.value));
              setCodeError(null);
            }}
            disabled={busy !== null}
            inputMode="numeric"
            autoComplete="off"
            placeholder="0000 0000 0000"
            aria-label={JOIN_WORDS.codeField}
            aria-describedby={codeError ? "class-join-code-error" : undefined}
            maxLength={14}
            className="border-border bg-muted/30 placeholder:text-muted-foreground/70 mt-2 h-11 w-full rounded-xl border px-5 text-center font-mono text-sm tracking-widest outline-none"
          />
          <Button
            type="submit"
            size="sm"
            disabled={digits.length !== 12 || busy !== null}
            className={cn(ME_BUTTON_CLASS, "mt-2 w-full")}
          >
            {busy === "code" && (
              <Spinner size="sm" className="border-white/40 border-t-white" />
            )}
            {JOIN_WORDS.codeButton}
          </Button>
          {codeError && (
            <span id="class-join-code-error" role="alert" className={REASON_CLASS}>
              {codeError}
            </span>
          )}
        </form>
      </SettingsGroup>
    </div>
  );
}

/** Both classes, the guest's marked. Null (the read failed) marks neither and
 *  offers no join: never a guessed Regular. A Regular guest gets the two ways
 *  in (MESITA-3054); after a join, one line says so. */
export function ClassList({
  guestClass,
  vip = null,
  instagram = null,
}: {
  guestClass: GuestClass | null;
  vip?: VipDetails | null;
  instagram?: ClassInstagram;
}) {
  const [joined, setJoined] = useState(false);
  return (
    <>
      <SettingsGroup>
        <ClassRow
          {...CLASS_ROWS.regular}
          icon={<UsersRound className="h-[18px] w-[18px]" />}
          mine={guestClass === "regular" && !joined}
        />
        <RowDivider />
        <ClassRow
          {...CLASS_ROWS.vip}
          icon={<Crown className="h-[18px] w-[18px]" />}
          mine={guestClass === "vip" || joined}
          vip={vip}
        />
      </SettingsGroup>
      {joined ? (
        <p
          role="status"
          className="text-foreground type-label mt-3 font-semibold"
          data-class-joined=""
        >
          {JOIN_WORDS.joined}
        </p>
      ) : (
        guestClass === "regular" && (
          <BecomeVip instagram={instagram} onJoined={() => setJoined(true)} />
        )
      )}
    </>
  );
}

export function ClassSheet({
  open,
  onClose,
  guestClass,
  vip = null,
  instagram = null,
}: {
  open: boolean;
  onClose: () => void;
  guestClass: GuestClass;
  vip?: VipDetails | null;
  instagram?: ClassInstagram;
}) {
  return (
    <LocalSheet open={open} onClose={onClose} ariaLabel="Class">
      <div className={SHEET_BODY_CLASS}>
        <h2 className={SHEET_TITLE_CLASS}>Class</h2>
        <div className="mt-3">
          <ClassList guestClass={guestClass} vip={vip} instagram={instagram} />
        </div>
      </div>
    </LocalSheet>
  );
}
