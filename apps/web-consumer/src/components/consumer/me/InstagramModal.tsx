"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AtSign, BadgeCheck, Copy, Crown, Send } from "lucide-react";
import { Instagram } from "@/components/shared/instagram-icon";
import { cn, errMsg } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { MeScreen } from "@/components/consumer/me/MeScreen";
import { Spinner } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { PushLink } from "@/components/consumer/nav/PushLink";
import { InstagramHandleField } from "@/components/consumer/me/InstagramHandleField";
import { IconChip, ME_BUTTON_CLASS, SettingsGroup, Switch } from "@/components/consumer/me/settings-rows";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  apiDisconnectInstagram,
  apiFetchConsumerProfile,
  apiInstagramChannel,
  apiInstagramDmStatus,
  apiSetInstagram,
  apiStartInstagramDm,
  apiUpdateConsumerProfile,
  dmVerified,
  type ConsumerProfile,
  type InstagramChannel,
  type InstagramDmClaim,
} from "@/lib/api/profile";
import { normalizeInstagramHandle } from "@/lib/instagram-handle";
import { SHEET_BODY_CLASS, SHEET_CANCEL_BUTTON_CLASS, SHEET_TITLE_CLASS } from "@/lib/ui-classes";
import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { PROFILE_KEY, writeCached } from "@/lib/screen-cache";
import { useConsumerProfile } from "@/lib/use-consumer-profile";

// ME › INSTAGRAM (Pato, 2026-11-24, MESITA-4858): add a handle now, verify it
// later. A typed handle is Unverified and may be shown; the badge comes only
// from a one-time code sent by DM from that account. Nothing is looked up: no
// scrape, no photo, no followers. VIP is a separate yes, asked before the same
// DM. The server decides every fact here; this draws them.

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
            A new handle starts hidden and Unverified. @{current} comes off your profile.
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
      <ShareRow profile={profile} />
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

// SHOW MY INSTAGRAM: the Public + Instagram level (MESITA-4850), verified or
// not. Off never opens a Private profile; under 18 there is no choice.
function ShareRow({ profile }: { profile: ConsumerProfile }) {
  const supabase = useBrowserSupabase();
  const [flipped, setFlipped] = useState<boolean | null>(null);
  const shown = flipped ?? profile.social_level === "instagram";

  if (profile.social_lock) {
    return (
      <p className="text-muted-foreground type-label border-border/60 mx-4 mb-3 rounded-xl border p-3" data-instagram-share="locked">
        {profile.social_lock === "minor"
          ? "Profiles of guests under 18 are always private, so your Instagram never shows."
          : "Add your year of birth in Profile to show your Instagram."}
      </p>
    );
  }
  const flip = () => {
    if (flipped !== null) return;
    const next = !shown;
    setFlipped(next);
    apiUpdateConsumerProfile(supabase, next ? { social_level: "instagram" } : { instagram_handle_shown: false })
      .catch((e) => toast.error(errMsg(e, "Couldn't change that.")))
      .finally(() => setFlipped(null));
  };
  return (
    <button
      type="button"
      role="switch"
      aria-checked={shown}
      disabled={flipped !== null}
      onClick={flip}
      className="border-border/60 hover:bg-muted/60 mx-4 mb-3 flex w-[calc(100%-2rem)] items-center gap-3 rounded-xl border p-3 text-left transition disabled:opacity-60"
      data-instagram-share={shown ? "on" : "off"}
    >
      <IconChip>
        <AtSign className="h-[18px] w-[18px]" />
      </IconChip>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">Show my Instagram on my profile</span>
        <span className="text-muted-foreground type-label block">
          {shown
            ? "Guests see your photo and a link to your Instagram."
            : profile.social_level === "private"
              ? "Your profile is Private. Turning this on makes it Public, with your photo and Instagram."
              : "Off. On, guests see your photo and a link to your Instagram."}
        </span>
      </span>
      <Switch on={shown} />
    </button>
  );
}

const VIP_LINE: Record<NonNullable<ConsumerProfile["instagram_vip_status"]>, string> = {
  eligible: "Your Instagram made you VIP.",
  not_enough: "VIP by Instagram needs more than 5,000 followers.",
  not_public: "VIP by Instagram needs a public account.",
  unconfirmed: "We couldn't confirm VIP automatically: Instagram didn't share everything we need. Your verified badge stays.",
};

// VERIFY BY ONE DM, with the VIP question first. The choice fetches the code,
// so the send button is a plain link: the tap copies the code and opens
// Instagram in one gesture (an await would get the tab blocked on iOS).
function VerifyCard({ profile, handle }: { profile: ConsumerProfile; handle: string }) {
  const supabase = useBrowserSupabase();
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
  }, [claim, sent, supabase]);

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
    <SettingsGroup title={verified ? "Verified" : "Verify account"}>
      <div className="flex flex-col gap-3 px-4 pt-1 pb-4" data-instagram-verify>
        <p className="text-muted-foreground text-sm">
          {verified
            ? `Mesita verified that you own @${handle}.`
            : `Optional. Send a one-time code from @${handle} to Mesita's Instagram bot and get the verified badge.`}
        </p>
        {status && (
          <div className="flex items-start gap-3" data-instagram-vip={status}>
            <IconChip>
              <Crown className="h-[18px] w-[18px]" />
            </IconChip>
            <p className="min-w-0 flex-1 text-sm">
              {VIP_LINE[status]}{" "}
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
              VIP needs a public account with more than 5,000 followers. Your badge doesn&apos;t depend on it.
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
                onClick={() => (verified ? setAsking(false) : void start(false))}
                className={cn(ME_BUTTON_CLASS, QUIET_BUTTON_CLASS)}
              >
                {verified ? "Not now" : "No, just verify"}
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
              {verified ? "Check VIP eligibility" : "Verify account"}
            </Button>
          ) : channel ? (
            !verified && (
              <p className="text-muted-foreground type-label" data-instagram-verify-off>
                Verification isn&apos;t open yet. You can show your Instagram without it.
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
          Its link and verified badge come off your profile, and so does VIP if your Instagram gave it. A picture that came from
          Instagram goes too.
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
