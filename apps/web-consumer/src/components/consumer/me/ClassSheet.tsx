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

import {
  LocalDialog,
  LocalSheet,
} from "@/components/consumer/overlay/LocalOverlay";
import {
  CLASS_ROWS,
  JOIN_WORDS,
  joinErrorWords,
  LEAVE_WORDS,
  type ClassRowWords,
} from "@/components/consumer/me/class-words";
import { PerkList } from "@/components/consumer/me/perk-list";
import { Spinner } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { EFError } from "@/lib/api/_invoke";
import {
  apiJoinClass,
  apiLeaveClass,
  apiRefreshConsumerProfile,
} from "@/lib/api/profile";
import { INSTAGRAM_REACH_FOLLOWERS } from "@/lib/consumer-identity";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import {
  formatVipUntil,
  type GuestClass,
  type VipDetails,
} from "@/lib/guest-standing";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import {
  SHEET_BODY_CLASS,
  SHEET_CANCEL_BUTTON_CLASS,
  SHEET_TITLE_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import {
  CurrentPill,
  IconChip,
  ME_BUTTON_CLASS,
  RowDivider,
  SectionEyebrow,
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
// One of the two ways in: a card like SettingsGroup's, its words on top
// (JOIN_BODY_CLASS takes the spare height) and its button at the bottom, so
// the two buttons line up whatever each card says.
const JOIN_CARD_CLASS =
  "border-border bg-card flex min-w-0 flex-col rounded-2xl border p-4";
const JOIN_BODY_CLASS = "flex-1 pb-4";
const LINK_CLASS = "text-foreground font-semibold underline underline-offset-2";

/** Where the Instagram card stands, from what the page last knew. The server
 *  checks again on the tap (MESITA-3069's states). */
type InstagramState =
  | { kind: "unknown" }
  | { kind: "not_connected" }
  | { kind: "count_unknown" }
  | { kind: "below"; followers: number }
  | { kind: "ready"; followers: number };

function instagramState(ig: ClassInstagram): InstagramState {
  if (!ig) return { kind: "unknown" };
  if (!ig.handle) return { kind: "not_connected" };
  if (ig.followers === null) return { kind: "count_unknown" };
  return ig.followers < INSTAGRAM_REACH_FOLLOWERS
    ? { kind: "below", followers: ig.followers }
    : { kind: "ready", followers: ig.followers };
}

const fmtCount = (n: number) => n.toLocaleString("en-US");

/** The follower count toward the bar (Pato, MESITA-3069: lead with the
 *  number). A thin bar on the muted track, full at the bar or above. */
function FollowerProgress({ followers }: { followers: number }) {
  const needed = INSTAGRAM_REACH_FOLLOWERS;
  const share = Math.min(followers / needed, 1);
  const ready = followers >= needed;
  return (
    <div className="mt-2" data-class-join-progress="">
      <span className="block text-xl font-semibold tabular-nums">
        {fmtCount(followers)}
        {!ready && (
          <span className="text-muted-foreground font-medium">
            {" "}
            / {fmtCount(needed)}
          </span>
        )}
      </span>
      <div
        role="progressbar"
        aria-label={JOIN_WORDS.progressLabel}
        aria-valuemin={0}
        aria-valuemax={needed}
        aria-valuenow={Math.min(followers, needed)}
        className="bg-muted mt-2 h-1.5 w-full overflow-hidden rounded-full"
      >
        <div
          className="bg-foreground h-full rounded-full"
          style={{ width: `${share * 100}%` }}
        />
      </div>
      <span className="text-muted-foreground type-label mt-2 block">
        {ready ? JOIN_WORDS.qualify : JOIN_WORDS.toJoin}
      </span>
    </div>
  );
}

/** "1234 5678 9012" as the guest types; the server drops the spaces. */
function groupCode(raw: string): string {
  return (
    raw
      .replace(/\D/g, "")
      .slice(0, 12)
      .match(/\d{1,4}/g) ?? []
  ).join(" ");
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
  const ig = instagramState(instagram);

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
      const words =
        e instanceof EFError ? joinErrorWords(e.code, e.body) : null;
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

  // SIDE BY SIDE (Pato, MESITA-3056), stacked under 360px like the identity
  // card's Class · Plan pair (MESITA-3069). Each card: words on top, at most
  // one LIVE button at the bottom — never a greyed-out one (MESITA-3069:
  // two dead buttons read as a broken page).
  return (
    <section className="mt-6 flex flex-col gap-2" data-class-join="">
      <SectionEyebrow>{JOIN_WORDS.group}</SectionEyebrow>
      <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
        <div className={JOIN_CARD_CLASS} data-class-join-instagram="">
          <div className={JOIN_BODY_CLASS}>
            <span className="type-label block font-semibold">
              {JOIN_WORDS.instagramTitle}
            </span>
            {(ig.kind === "below" || ig.kind === "ready") && (
              <FollowerProgress followers={ig.followers} />
            )}
            {ig.kind === "not_connected" && (
              <span className={REASON_CLASS}>{JOIN_WORDS.toJoinFull}</span>
            )}
            {ig.kind === "count_unknown" && (
              <span className={REASON_CLASS}>
                {JOIN_WORDS.countUnavailable}
              </span>
            )}
            {igError && (
              <span role="alert" className={REASON_CLASS}>
                {igError}
              </span>
            )}
            {(ig.kind === "below" || ig.kind === "count_unknown" || igError) &&
              ig.kind !== "not_connected" && (
                <Link
                  href={CONSUMER_ROUTES.mePages.instagram}
                  className={cn(REASON_CLASS, LINK_CLASS)}
                >
                  {JOIN_WORDS.update}
                </Link>
              )}
          </div>
          {ig.kind === "not_connected" && (
            <Button asChild size="sm" className={cn(ME_BUTTON_CLASS, "w-full")}>
              <Link href={CONSUMER_ROUTES.mePages.instagram}>
                {JOIN_WORDS.connectButton}
              </Link>
            </Button>
          )}
          {ig.kind === "ready" && (
            <Button
              type="button"
              size="sm"
              aria-label={JOIN_WORDS.instagramButton}
              disabled={busy !== null}
              onClick={() => void join("instagram")}
              className={cn(ME_BUTTON_CLASS, "w-full")}
            >
              {busy === "instagram" && (
                <Spinner size="sm" className="border-white/40 border-t-white" />
              )}
              {JOIN_WORDS.codeButton}
            </Button>
          )}
        </div>
        <form
          className={JOIN_CARD_CLASS}
          data-class-join-code=""
          onSubmit={(e) => {
            e.preventDefault();
            // Live from the start (MESITA-3069): a short code is told so.
            if (digits.length === 12) void join("code");
            else setCodeError(JOIN_WORDS.shortCode);
          }}
        >
          <div className={JOIN_BODY_CLASS}>
            <span className="type-label block font-semibold">
              {JOIN_WORDS.codeTitle}
            </span>
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
              className="border-border bg-muted/30 placeholder:text-muted-foreground/70 mt-2 h-11 w-full min-w-0 rounded-xl border px-2 text-center font-mono text-sm outline-none"
            />
            {codeError && (
              <span
                id="class-join-code-error"
                role="alert"
                className={REASON_CLASS}
              >
                {codeError}
              </span>
            )}
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={busy !== null}
            className={cn(ME_BUTTON_CLASS, "w-full")}
          >
            {busy === "code" && (
              <Spinner size="sm" className="border-white/40 border-t-white" />
            )}
            {JOIN_WORDS.codeButton}
          </Button>
        </form>
      </div>
    </section>
  );
}

/** Leaving VIP, in the rare case a guest wants to (Pato, MESITA-3054): a
 *  quiet text button under the card, then a confirm. */
function LeaveVip({ onLeft }: { onLeft: () => void }) {
  const getSupabase = useLazyBrowserSupabase();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function leave() {
    if (busy) return;
    setBusy(true);
    try {
      await apiLeaveClass(getSupabase());
      setOpen(false);
      onLeft();
      router.refresh();
    } catch {
      // A failure is a toast already (reportEFFailure).
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-muted-foreground type-label mt-3 font-semibold underline underline-offset-2"
        data-class-leave=""
      >
        {LEAVE_WORDS.button}
      </button>
      <LocalDialog
        open={open}
        onClose={() => setOpen(false)}
        ariaLabel={LEAVE_WORDS.title}
      >
        <div className={SHEET_BODY_CLASS}>
          <h2 className={SHEET_TITLE_CLASS}>{LEAVE_WORDS.title}</h2>
          <p className="text-muted-foreground type-body mt-2 leading-snug">
            {LEAVE_WORDS.body}
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={SHEET_CANCEL_BUTTON_CLASS}
            >
              {LEAVE_WORDS.cancel}
            </button>
            <button
              type="button"
              onClick={() => void leave()}
              disabled={busy}
              className="bg-destructive flex flex-1 items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-white transition disabled:opacity-60"
              data-class-leave-confirm=""
            >
              {busy && (
                <Spinner size="sm" className="border-white/40 border-t-white" />
              )}
              {LEAVE_WORDS.confirm}
            </button>
          </div>
        </div>
      </LocalDialog>
    </>
  );
}

/** Both classes, the guest's marked. Null (the read failed) marks neither and
 *  offers no change: never a guessed Regular. A Regular guest gets the two
 *  ways in (MESITA-3054); after a join, one line says so. A VIP gets Leave
 *  VIP. */
export function ClassList({
  guestClass,
  vip = null,
  instagram = null,
}: {
  guestClass: GuestClass | null;
  vip?: VipDetails | null;
  instagram?: ClassInstagram;
}) {
  // What this page just did, ahead of the cached profile catching up.
  const [changed, setChanged] = useState<GuestClass | null>(null);
  const shown = guestClass ? (changed ?? guestClass) : null;
  return (
    <>
      <SettingsGroup>
        <ClassRow
          {...CLASS_ROWS.regular}
          icon={<UsersRound className="h-[18px] w-[18px]" />}
          mine={shown === "regular"}
        />
        <RowDivider />
        <ClassRow
          {...CLASS_ROWS.vip}
          icon={<Crown className="h-[18px] w-[18px]" />}
          mine={shown === "vip"}
          vip={changed ? null : vip}
        />
      </SettingsGroup>
      {changed === "vip" && (
        <p
          role="status"
          className="text-foreground type-label mt-3 font-semibold"
          data-class-joined=""
        >
          {JOIN_WORDS.joined}
        </p>
      )}
      {shown === "regular" && (
        <BecomeVip instagram={instagram} onJoined={() => setChanged("vip")} />
      )}
      {shown === "vip" && <LeaveVip onLeft={() => setChanged("regular")} />}
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
