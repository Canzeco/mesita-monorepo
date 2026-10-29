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
import { Crown, Ticket, UsersRound } from "lucide-react";

import { Instagram } from "@/components/shared/instagram-icon";

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
import {
  CurrentPill,
  IconChip,
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

const REASON_CLASS = "text-muted-foreground type-label mt-1 block";
// A row's action on the right (Join, Connect): compact, black, 44px tall.
const ROW_ACTION_CLASS =
  "h-11 min-h-11 shrink-0 rounded-xl px-4 py-0 text-sm font-semibold";

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

/** The follower count toward the bar (MESITA-3069), as the Instagram row's
 *  line: "298 of 1,000 followers" over a thin bar, full at the bar. */
function FollowerProgress({ followers }: { followers: number }) {
  const needed = INSTAGRAM_REACH_FOLLOWERS;
  const share = Math.min(followers / needed, 1);
  const ready = followers >= needed;
  return (
    <div data-class-join-progress="">
      <span className="text-muted-foreground type-label mt-1 block tabular-nums">
        {ready
          ? JOIN_WORDS.qualify(fmtCount(followers))
          : JOIN_WORDS.progress(fmtCount(followers), fmtCount(needed))}
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

  // ONE CARD OF ROWS (Pato, MESITA-3073: "better make it vertical but better
  // cleaner design"; it replaced MESITA-3056's two side-by-side cards): the
  // Regular/VIP card's own pattern — icon chip, title, one grey line — so
  // the page reads as one system. Only LIVE buttons (MESITA-3069).
  return (
    <section className="mt-6 flex flex-col gap-2" data-class-join="">
      <SectionEyebrow>{JOIN_WORDS.group}</SectionEyebrow>
      <div className="border-border bg-card overflow-hidden rounded-2xl border">
        <div
          className="flex items-start gap-3 px-4 py-3"
          data-class-join-instagram=""
        >
          <IconChip>
            <Instagram className="h-[18px] w-[18px]" />
          </IconChip>
          <div className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">
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
          </div>
          {ig.kind === "not_connected" && (
            <Button asChild size="sm" className={ROW_ACTION_CLASS}>
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
              className={ROW_ACTION_CLASS}
            >
              {busy === "instagram" && (
                <Spinner size="sm" className="border-white/40 border-t-white" />
              )}
              {JOIN_WORDS.codeButton}
            </Button>
          )}
        </div>
        <RowDivider />
        <form
          className="flex items-start gap-3 px-4 py-3"
          data-class-join-code=""
          onSubmit={(e) => {
            e.preventDefault();
            // Live from the start (MESITA-3069): a short code is told so.
            if (digits.length === 12) void join("code");
            else setCodeError(JOIN_WORDS.shortCode);
          }}
        >
          <IconChip>
            <Ticket className="h-[18px] w-[18px]" />
          </IconChip>
          <div className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">
              {JOIN_WORDS.codeTitle}
            </span>
            <div className="mt-2 flex gap-2">
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
                aria-describedby={
                  codeError ? "class-join-code-error" : undefined
                }
                maxLength={14}
                className="border-border bg-muted/30 placeholder:text-muted-foreground/70 h-11 w-full min-w-0 flex-1 rounded-xl border px-3 font-mono text-sm tabular-nums outline-none"
              />
              <Button
                type="submit"
                size="sm"
                disabled={busy !== null}
                className={ROW_ACTION_CLASS}
              >
                {busy === "code" && (
                  <Spinner
                    size="sm"
                    className="border-white/40 border-t-white"
                  />
                )}
                {JOIN_WORDS.codeButton}
              </Button>
            </div>
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
