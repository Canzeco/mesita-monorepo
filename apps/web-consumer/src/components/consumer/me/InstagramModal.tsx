"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Copy, Crown, Send } from "lucide-react";
import { Instagram } from "@/components/shared/instagram-icon";
import { cn, errMsg } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { MeScreen } from "@/components/consumer/me/MeScreen";
import { Spinner } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { PushLink } from "@/components/consumer/nav/PushLink";
import { InstagramHandleField } from "@/components/consumer/me/InstagramHandleField";
import { IconChip, ME_BUTTON_CLASS, SettingsGroup } from "@/components/consumer/me/settings-rows";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  apiDisconnectInstagram,
  apiFetchConsumerProfile,
  apiInstagramChannel,
  apiInstagramDmStatus,
  apiSetInstagram,
  apiStartInstagramDm,
  dmVerified,
  type ConsumerProfile,
  type InstagramChannel,
  type InstagramDmClaim,
} from "@/lib/api/profile";
import { normalizeInstagramHandle } from "@/lib/instagram-handle";
import { SHEET_BODY_CLASS, SHEET_CANCEL_BUTTON_CLASS, SHEET_TITLE_CLASS } from "@/lib/ui-classes";
import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { goBack } from "@/lib/navigate";
import { PROFILE_KEY, writeCached } from "@/lib/screen-cache";
import { instagramVipLine } from "@/lib/vip";
import { useConsumerProfile } from "@/lib/use-consumer-profile";

// ME › INSTAGRAM IS FOR VIP ONLY (Pato, 2026-11-24, MESITA-4863: "With VIP →
// connect Instagram only at the VIP unlock, nowhere else"). A guest adds a
// handle, then one DM from that account proves it and, with their yes, reads
// the follower count. No guest ever sees it. Opened from a place's locked VIP
// offer (`from=vip`), a finished check returns there. The server decides.

/** The guest came from a VIP offer: a finished task pops back to it. */
function cameFromVip(): boolean {
  return new URLSearchParams(window.location.search).get("from") === "vip";
}

const DM_POLL_MS = 3_000;

const QUIET_BUTTON_CLASS =
  "bg-muted text-foreground hover:bg-muted/70 flex items-center justify-center gap-2 transition disabled:pointer-events-none disabled:opacity-60";

/** Reads the saved row, so every screen sees it, and the shell's identity. */
function useReload() {
  const supabase = useBrowserSupabase();
  const router = useRouter();
  return async () => {
    const { consumer } = await apiFetchConsumerProfile(supabase);
    writeCached(PROFILE_KEY, consumer);
    router.refresh();
  };
}

export function InstagramModal() {
  const { data: profile, error } = useConsumerProfile();
  const [editing, setEditing] = useState(false);

  if (!profile) {
    return error ? (
      <MeScreen title="Instagram">
        <p className="text-muted-foreground py-10 text-center text-sm">Couldn&apos;t load your Instagram. Try again later.</p>
      </MeScreen>
    ) : (
      <InstagramPlaceholder />
    );
  }
  const handle = profile.instagram_handle;
  return (
    <MeScreen title="Instagram">
      <div className="flex flex-col gap-4">
        <p className="text-muted-foreground text-sm">Connect your Instagram to unlock VIP offers.</p>
        {handle && !editing ? (
          <>
            <AccountCard profile={profile} handle={handle} onEdit={() => setEditing(true)} />
            <VerifyCard key={`${handle}:${profile.instagram_proved_at ?? ""}`} profile={profile} handle={handle} />
          </>
        ) : (
          <HandleForm current={handle} onDone={() => setEditing(false)} />
        )}
      </div>
    </MeScreen>
  );
}

export function InstagramPlaceholder() {
  return (
    <MeScreen title="Instagram">
      <div className="bg-muted h-56 animate-pulse rounded-2xl" aria-hidden />
      <p role="status" className="sr-only">
        Loading Instagram
      </p>
    </MeScreen>
  );
}

function HandleForm({ current, onDone }: { current: string | null; onDone: () => void }) {
  const supabase = useBrowserSupabase();
  const reload = useReload();
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const handle = normalizeInstagramHandle(raw);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!handle || busy) return;
    setBusy(true);
    setFailed(null);
    try {
      await apiSetInstagram(supabase, handle);
      await reload();
      onDone();
    } catch (err) {
      setFailed(errMsg(err, "Couldn't save. Try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsGroup title={current ? "Change your Instagram" : "Add your Instagram"}>
      <form onSubmit={(e) => void save(e)} className="flex flex-col gap-3 px-4 pt-1 pb-4" noValidate data-instagram-form>
        <InstagramHandleField
          id="me-instagram"
          value={raw}
          onChange={(v) => {
            setRaw(v);
            setFailed(null);
          }}
        />
        {current && (
          <p className="text-muted-foreground type-label">
            A new handle starts Unverified. @{current} is removed.
          </p>
        )}
        {failed && (
          <p role="alert" className="text-destructive type-label">
            {failed}
          </p>
        )}
        <Button type="submit" disabled={!handle || busy} className={cn(ME_BUTTON_CLASS, "w-full")}>
          {busy ? "Saving…" : "Save"}
        </Button>
        {current && (
          <button type="button" onClick={onDone} disabled={busy} className={cn(ME_BUTTON_CLASS, QUIET_BUTTON_CLASS, "w-full")}>
            Cancel
          </button>
        )}
        <p className="text-muted-foreground type-label text-center">We never ask for your Instagram password.</p>
      </form>
    </SettingsGroup>
  );
}

function AccountCard({ profile, handle, onEdit }: { profile: ConsumerProfile; handle: string; onEdit: () => void }) {
  const [removing, setRemoving] = useState(false);
  const verified = Boolean(profile.instagram_proved_at);
  return (
    <SettingsGroup>
      <div className="flex items-center gap-3 px-4 py-3">
        <IconChip tint="instagram">
          <Instagram className="h-[18px] w-[18px]" />
        </IconChip>
        <a
          href={`https://www.instagram.com/${handle}/`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`View @${handle} on Instagram`}
          className="min-w-0 flex-1 truncate text-sm font-semibold hover:underline"
        >
          @{handle}
        </a>
        <span
          className="bg-muted text-foreground flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
          data-instagram-status={verified ? "verified" : "unverified"}
        >
          {verified && <BadgeCheck className="h-4 w-4" aria-hidden />}
          {verified ? "Verified" : "Unverified"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 px-4 pb-4">
        <button type="button" onClick={onEdit} className={cn(ME_BUTTON_CLASS, QUIET_BUTTON_CLASS)} data-instagram-change>
          Edit
        </button>
        <button
          type="button"
          onClick={() => setRemoving(true)}
          className={cn(ME_BUTTON_CLASS, QUIET_BUTTON_CLASS, "text-destructive")}
          data-instagram-disconnect
        >
          Remove
        </button>
      </div>
      <RemoveDialog open={removing} handle={handle} onClose={() => setRemoving(false)} />
    </SettingsGroup>
  );
}

// VERIFY BY ONE DM, with the VIP question first. The choice fetches the code,
// so the send button is a plain link: the tap copies the code and opens
// Instagram in one gesture (an await would get the tab blocked on iOS).
function VerifyCard({ profile, handle }: { profile: ConsumerProfile; handle: string }) {
  const supabase = useBrowserSupabase();
  const router = useRouter();
  const reload = useReload();
  const [channel, setChannel] = useState<InstagramChannel | null>(null);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [claim, setClaim] = useState<InstagramDmClaim | null>(null);
  const [sent, setSent] = useState(false);
  const [problem, setProblem] = useState<"wrong_account" | "expired" | "failed" | null>(null);
  const verified = Boolean(profile.instagram_proved_at);
  const vip = profile.guest_class === "vip";

  useEffect(() => {
    let cancelled = false;
    apiInstagramChannel(supabase)
      .then((c) => {
        if (!cancelled) setChannel(c);
      })
      .catch(() => {
        if (!cancelled) setChannel({ channel: "off" });
      });
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  useEffect(() => {
    if (!claim || !sent) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const status = await apiInstagramDmStatus(supabase);
        if (cancelled) return;
        if (dmVerified(status, claim.handle)) {
          toast.success(`@${claim.handle} is verified`);
          setClaim(null);
          await reload();
          if (cameFromVip()) goBack(router, CONSUMER_ROUTES.mePages.vip);
          return;
        }
        if (status.status === "expired" || status.status === "none") {
          setClaim(null);
          setSent(false);
          setProblem("expired");
          return;
        }
        setProblem(status.status === "wrong_account" ? "wrong_account" : null);
      } catch {
        // A failed read is retried on the next tick.
      }
      if (!cancelled) timer = setTimeout(tick, DM_POLL_MS);
    };
    timer = setTimeout(tick, DM_POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // `reload` is rebuilt each render; the poll belongs to the claim.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claim, sent, supabase, router]);

  async function start(vipCheck: boolean) {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    try {
      setClaim(await apiStartInstagramDm(supabase, vipCheck));
      setSent(false);
      setAsking(false);
    } catch {
      setProblem("failed");
    } finally {
      setBusy(false);
    }
  }

  const status = verified ? profile.instagram_vip_status : null;
  const live = channel?.channel === "dm";
  // Verified and VIP, or told its count is not enough: nothing left to start.
  const canStart = !verified || !vip;

  return (
    <SettingsGroup title="VIP">
      <div className="flex flex-col gap-3 px-4 pt-1 pb-4" data-instagram-verify>
        <p className="text-muted-foreground text-sm">
          {verified
            ? `Mesita verified that you own @${handle}.`
            : `Send a one-time code from @${handle} to Mesita's Instagram bot. VIP needs a public account with more than 5,000 followers.`}
        </p>
        {status && (
          <div className="flex items-start gap-3" data-instagram-vip={status}>
            <IconChip>
              <Crown className="h-[18px] w-[18px]" />
            </IconChip>
            <p className="min-w-0 flex-1 text-sm">
              {instagramVipLine(profile)}{" "}
              {!vip && (
                <PushLink href={CONSUMER_ROUTES.mePages.vip} className="font-semibold underline underline-offset-2">
                  Use an invitation code
                </PushLink>
              )}
            </p>
          </div>
        )}

        {claim ? (
          <>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(claim.code).then(
                  () => toast("Code copied"),
                  () => toast("Couldn't copy. Type it in instead."),
                );
              }}
              aria-label={`Your code ${claim.code}, tap to copy`}
              className={cn(QUIET_BUTTON_CLASS, "h-12 w-full rounded-xl text-base font-semibold tabular-nums")}
              data-instagram-dm-code
            >
              {claim.code}
              <Copy className="h-4 w-4" aria-hidden />
            </button>
            <p className="text-muted-foreground type-label">
              Paste it in a message to @{claim.account}, from @{claim.handle}. It works once and lasts 15 minutes.
            </p>
            <a
              href={claim.link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                void navigator.clipboard?.writeText(claim.code).catch(() => {});
                setSent(true);
              }}
              className={cn(ME_BUTTON_CLASS, "bg-foreground text-paper flex w-full items-center justify-center gap-2")}
              data-instagram-dm-start
            >
              <Send className="h-4 w-4" aria-hidden />
              Send my code on Instagram
            </a>
            {sent && problem !== "wrong_account" && (
              <p className="text-muted-foreground type-label flex items-center justify-center gap-2" aria-live="polite">
                <Spinner size="sm" />
                Waiting for your message…
              </p>
            )}
          </>
        ) : asking ? (
          <div className="flex flex-col gap-2" data-instagram-vip-question>
            <p className="text-sm font-semibold">Allow Mesita to check your Instagram follower count for VIP?</p>
            <p className="text-muted-foreground type-label">
              VIP needs a public account with more than 5,000 followers.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void start(true)}
                className={cn(ME_BUTTON_CLASS, "bg-foreground text-paper disabled:opacity-60")}
              >
                Allow
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setAsking(false)}
                className={cn(ME_BUTTON_CLASS, QUIET_BUTTON_CLASS)}
              >
                Not now
              </button>
            </div>
          </div>
        ) : canStart ? (
          live ? (
            <Button
              type="button"
              // Already VIP: no follower count is needed, so none is asked for.
              onClick={() => (vip ? void start(false) : setAsking(true))}
              disabled={busy}
              className={cn(ME_BUTTON_CLASS, "w-full")}
              data-instagram-verify-start
            >
              {verified ? "Check VIP again" : "Connect"}
            </Button>
          ) : channel ? (
            !verified && (
              <p className="text-muted-foreground type-label" data-instagram-verify-off>
                Connecting isn&apos;t open yet. An invitation code also makes you VIP.
              </p>
            )
          ) : (
            <Spinner size="sm" />
          )
        ) : null}

        <div aria-live="polite">
          {problem && (
            <p className="text-destructive type-label" data-instagram-verify-problem={problem}>
              {problem === "wrong_account"
                ? `That message came from a different account. Send the code from @${handle}, or edit your handle.`
                : problem === "expired"
                  ? "That code expired. Get a new one to try again."
                  : "Couldn't get a code. Try again."}
            </p>
          )}
        </div>
      </div>
    </SettingsGroup>
  );
}

function RemoveDialog({ open, handle, onClose }: { open: boolean; handle: string; onClose: () => void }) {
  const supabase = useBrowserSupabase();
  const reload = useReload();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (busy) return;
    setBusy(true);
    try {
      await apiDisconnectInstagram(supabase);
      await reload();
    } catch (err) {
      toast.error(errMsg(err, "Couldn't remove it. Try again."));
      setBusy(false);
    }
  }

  return (
    <LocalDialog open={open} onClose={onClose} ariaLabel="Remove Instagram">
      <div className={SHEET_BODY_CLASS}>
        <h2 className={SHEET_TITLE_CLASS}>Remove @{handle}?</h2>
        <p className="text-muted-foreground type-body mt-2 leading-snug">
          Its verification goes, and so does VIP if your Instagram gave it. A picture that came from Instagram goes too.
        </p>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onClose} className={SHEET_CANCEL_BUTTON_CLASS}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void remove()}
            disabled={busy}
            className="bg-destructive flex flex-1 items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-white transition disabled:opacity-60"
            data-instagram-disconnect-confirm
          >
            {busy && <Spinner size="sm" className="border-white/40 border-t-white" />}
            {busy ? "Removing…" : "Remove"}
          </button>
        </div>
      </div>
    </LocalDialog>
  );
}
