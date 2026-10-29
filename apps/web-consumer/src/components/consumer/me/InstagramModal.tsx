"use client";

import { useConsumerProfile } from "@/lib/use-consumer-profile";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowLeftRight,
  BadgeCheck,
  Copy,
  ImageIcon,
  RefreshCw,
  Send,
  Unlink,
} from "lucide-react";
import { Instagram } from "@/components/shared/instagram-icon";
import { cn, errMsg } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { MeScreen } from "@/components/consumer/me/MeScreen";
import { Spinner } from "@/components/shared";
import { Button } from "@/components/ui/button";
import {
  IconChip,
  ME_BUTTON_CLASS,
  MeLead,
  RowDivider,
  SettingsActionRow,
  SettingsGroup,
  Switch,
} from "@/components/consumer/me/settings-rows";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  apiDisconnectInstagram,
  apiInstagramChannel,
  apiInstagramDmStatus,
  apiLookupInstagram,
  apiStartInstagramDm,
  apiSyncInstagram,
  apiUpdateConsumerProfile,
  dmVerified,
  type InstagramChannel,
  type InstagramDmClaim,
  type InstagramLookup,
} from "@/lib/api/profile";
import { followersLabel, updatedAgo } from "@/lib/consumer-identity";
import { EFError } from "@/lib/api/_invoke";
import { normalizeInstagramHandle } from "@/lib/instagram-handle";
import {
  INPUT_CLASS,
  SHEET_BODY_CLASS,
  SHEET_CANCEL_BUTTON_CLASS,
  SHEET_TITLE_CLASS,
} from "@/lib/ui-classes";
import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { useConsumerIdentity, useServerProfile } from "@/lib/identity-context";
import { INSTAGRAM_PHOTO_SWITCH } from "@/components/consumer/me/switch-words";

// Instagram connect page (MESITA-936): one lead line → Connect. The Why
// connect pitch was cut (Pato, 2026-10-28, MESITA-2983).
//
// IT GRANTS NOTHING (Pato, MESITA-2040: "instagram is just 1000 followers").
// A connected handle is an identity fact; crossing the bar makes the account
// VERIFIED. The bar lives in `INSTAGRAM_REACH_FOLLOWERS`; this page no
// longer names it (MESITA-2983).
//
// CONNECTING IS PROOF (MESITA-2461). The guest gets a one-time code, puts it
// in their Instagram bio, and the server reads it there before it stores the
// handle — with the follower count IT scraped. This page used to send a
// fixed 5,000 and an 8-digit "code" nobody checked, so anyone could show up
// in Social as @someone_famous.
//
// BY MESSAGE, ALWAYS SHOWN (MESITA-2575, MESITA-2602; Pato: "not yet the
// actual backend functionality but keep that UI already designed"). The page
// always draws the message flow: one tap sends your code to Mesita's
// Instagram, and the page waits while Meta tells the server who sent it. The
// server says whether that channel is live; until it is (the Meta secrets,
// MESITA-2579) no code is asked for, and the card connects a typed username
// through an Apify scrape (MESITA-3039, ConnectLookup), trusted for testing.
// The bio-code screen is gone from the page; the server still answers its
// actions.
//
// NO STEPS FOR A DEAD BUTTON (Pato, MESITA-3001: "this is confusing"). The
// off card used to number three instructions over a greyed "Soon" button,
// telling the guest to do what they could not. The steps show only when the
// button works.

/** How often the page asks whether the message landed, and for how long. */
const DM_POLL_MS = 3_000;
const DM_POLL_FOR_MS = 10 * 60_000;

/** The page's success landing: a full reload re-seeds the identity. */
function landConnected() {
  window.location.assign(
    new URL(`${CONSUMER_ROUTES.me}?instagram=success`, window.location.origin),
  );
}

/** Where a Sync or Change account lands (MESITA-3060): back on this page,
 *  reloaded so the header, the card and the photo show the saved values. The
 *  query only labels the guest's own toast, then is stripped. */
function landHere(r: InstagramLookup) {
  const url = new URL(window.location.pathname, window.location.origin);
  if (r.result === "synced") {
    url.searchParams.set("instagram", "synced");
    url.searchParams.set("to", String(r.profile.followerCount));
    if (r.previousFollowers != null) {
      url.searchParams.set("from", String(r.previousFollowers));
    }
  } else {
    url.searchParams.set("instagram", "connected");
    url.searchParams.set("handle", r.profile.username);
  }
  url.searchParams.set("photo", r.photo);
  window.location.assign(url);
}

/** The toast a landing asked for, or null. */
function landingToast(params: URLSearchParams): string | null {
  const kind = params.get("instagram");
  const photo = params.get("photo");
  let text: string;
  if (kind === "synced") {
    const to = followersLabel(Number(params.get("to")));
    const fromRaw = params.get("from");
    const from = fromRaw == null ? null : followersLabel(Number(fromRaw));
    text =
      from == null || from === to
        ? `Synced · ${to}`
        : `Synced · ${from.replace(/ followers$/, "")} → ${to}`;
  } else if (kind === "connected") {
    text = `Connected @${params.get("handle") ?? ""}`;
  } else {
    return null;
  }
  if (photo === "updated") text += " · photo updated";
  if (photo === "off") text += ". Turn on Use my Instagram photo to use it.";
  return text;
}

/** One line per refusal, for the card and for Change account (MESITA-3060). */
function syncErrorCopy(err: unknown, handle: string | null): string {
  if (!(err instanceof EFError) || (err.code == null && err.status == null)) {
    return "We couldn’t confirm the sync. Reload to see the latest.";
  }
  const body = (err.body ?? {}) as Record<string, unknown>;
  switch (err.code) {
    case "slow_down":
      return "Give it a minute and try again.";
    case "daily_limit": {
      const limit = typeof body.limit === "number" ? `${body.limit} ` : "";
      const at =
        typeof body.resetsAt === "string"
          ? new Date(body.resetsAt).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            })
          : null;
      return `You’ve used today’s ${limit}Instagram lookups. Try again ${
        at ? `after ${at}` : "tomorrow"
      }.`;
    }
    case "profile_not_found":
      return `We couldn’t find @${handle ?? ""} on Instagram anymore. Change account to connect the new one.`;
    case "scrape":
      return "Instagram isn’t answering right now. Try again later.";
    case "unavailable":
      return "Syncing isn’t available right now. Try again later.";
    case "sync_write_failed":
      return "Couldn’t save the sync. Try again later.";
    default:
      return errMsg(err, "Couldn’t sync — try again.");
  }
}

/** A clock that ticks each minute, and nothing on the server: the card's
 *  "Updated …" renders client-only (no hydration mismatch). */
const minuteClock = {
  subscribe(cb: () => void) {
    const id = window.setInterval(cb, 60_000);
    return () => window.clearInterval(id);
  },
  now: () => Math.floor(Date.now() / 60_000) * 60_000,
  server: () => null,
};

export function InstagramModal() {
  const supabase = useBrowserSupabase();
  const identity = useConsumerIdentity();
  const connected = identity.igConnected;
  // ONE ACTION AT A TIME (MESITA-3060). Sync, Change account and Disconnect
  // all derive `disabled` from this; it replaced the `switching` boolean.
  // A connected guest sees the account card, not the connect form, until
  // they choose Change account (decision: Pato, 2026-08-22).
  const [action, setAction] = useState<
    "idle" | "syncing" | "changing" | "disconnecting"
  >("idle");
  const [changeBusy, setChangeBusy] = useState(false);
  const showForm = !connected || action === "changing";
  // Which way connecting works today; null while it is being read.
  const [channel, setChannel] = useState<InstagramChannel | null>(null);
  useEffect(() => {
    let cancelled = false;
    apiInstagramChannel(supabase)
      .then((c) => {
        if (!cancelled) setChannel(c);
      })
      .catch(() => {
        if (!cancelled) setChannel({ channel: "bio" });
      });
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // The landing's toast, once (a ref guards StrictMode's second run), then
  // the query is stripped so a reload does not repeat it.
  const toasted = useRef(false);
  useEffect(() => {
    if (toasted.current) return;
    toasted.current = true;
    const text = landingToast(new URLSearchParams(window.location.search));
    if (!text) return;
    toast.success(text);
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  return (
    <MeScreen title="Instagram">
      <InstagramIntro />

      <div className="flex flex-col gap-6">
        {connected && (
          <ConnectedAccount
            busy={action !== "idle" || changeBusy}
            syncing={action === "syncing"}
            onSyncing={(on) => setAction(on ? "syncing" : "idle")}
            onChange={() => setAction("changing")}
          />
        )}

        {/* While it is read, the card's own silhouette, not a spinner:
              the card that lands is ~330px tall to the spinner's 64px, so
              Photo's row below jumped (Pato, MESITA-2701). */}
        {showForm && channel === null && <ConnectCardSkeleton />}

        {showForm &&
          channel !== null &&
          (channel.channel === "dm" ? (
            <ConnectByMessage />
          ) : (
            <ConnectLookup
              changing={connected}
              oldHandle={identity.igHandle}
              onBusyChange={setChangeBusy}
              onCancel={connected ? () => setAction("idle") : undefined}
            />
          ))}

        {/* Asked on the same screen as the connect (Pato, MESITA-2585:
              "keep that as default but ask the user"). */}
        <InstagramPhotoSwitch />

        {connected && action !== "changing" && (
          <DisconnectLink
            disabled={action !== "idle" || changeBusy}
            open={action === "disconnecting"}
            onOpen={() => setAction("disconnecting")}
            onClose={() => setAction("idle")}
          />
        )}
      </div>
    </MeScreen>
  );
}

/** The page's opening line (Pato, 2026-10-28: "mention connect your
 *  instagram to see other people's instagram"; the Why connect pitch is
 *  gone). Shared with the route's fallback (InstagramSkeleton). */
export function InstagramIntro() {
  return (
    <MeLead>
      Connect your Instagram to see other members&apos; Instagram on their
      profiles.
    </MeLead>
  );
}

/** A connected guest's account card under its eyebrow (MESITA-3060): the
 *  account row, then Sync | Change account and one live line. It reads the
 *  identity context and the layout's row, both seeded server-side, so the
 *  route's fallback draws it too (`pending`: inert, same heights). */
export function ConnectedAccount({
  pending = false,
  busy = false,
  syncing = false,
  onSyncing,
  onChange,
}: {
  pending?: boolean;
  busy?: boolean;
  syncing?: boolean;
  onSyncing?: (on: boolean) => void;
  onChange?: () => void;
}) {
  const supabase = useBrowserSupabase();
  const { igHandle: handle } = useConsumerIdentity();
  const [message, setMessage] = useState<{
    text: string;
    reload: boolean;
  } | null>(null);
  // After a refused or failed sync, Sync rests for the server's
  // retryAfterSeconds (else 60 s): set in the handler, cleared by a timer.
  const [resting, setResting] = useState(false);

  async function sync() {
    if (pending || busy || resting) return;
    setMessage(null);
    onSyncing?.(true);
    try {
      landHere(await apiSyncInstagram(supabase));
    } catch (err) {
      if (
        err instanceof EFError &&
        (err.code === "changed" || err.code === "not_connected")
      ) {
        window.location.reload();
        return;
      }
      const unknown =
        !(err instanceof EFError) || (err.code == null && err.status == null);
      setMessage({ text: syncErrorCopy(err, handle), reload: unknown });
      const body =
        err instanceof EFError
          ? ((err.body ?? {}) as Record<string, unknown>)
          : {};
      const retry =
        typeof body.retryAfterSeconds === "number"
          ? body.retryAfterSeconds
          : 60;
      setResting(true);
      window.setTimeout(() => setResting(false), Math.min(retry, 3600) * 1000);
      onSyncing?.(false);
    }
  }

  // THREE ROWS, THE ME PAGES' OWN (Pato, MESITA-3062: "more standarized
  // buttons … cleaner"): the account, then Sync and Change account as the
  // same action rows Settings uses; the outlined buttons are gone.
  return (
    <SettingsGroup title="Connected">
      <CurrentConnectionRow pending={pending} />
      <RowDivider />
      <SettingsActionRow
        Icon={RefreshCw}
        label={syncing ? "Syncing…" : "Sync"}
        sub={
          syncing
            ? "Reading your Instagram. This can take up to a minute."
            : "Update your followers and photo"
        }
        disabled={pending || busy || resting}
        onClick={sync}
      />
      <RowDivider />
      <SettingsActionRow
        Icon={ArrowLeftRight}
        label="Change account"
        sub="Connect a different Instagram"
        disabled={pending || busy}
        onClick={() => onChange?.()}
      />
      <div aria-live="polite">
        {!syncing && message && (
          <p
            className="text-destructive type-label border-border/60 border-t px-4 py-3"
            data-instagram-sync-error
          >
            {message.text}{" "}
            {message.reload && (
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="underline underline-offset-2"
              >
                Reload
              </button>
            )}
          </p>
        )}
      </div>
    </SettingsGroup>
  );
}

/** "Disconnect Instagram", the last group on the page (MESITA-3060 moved it
 *  off the account row; MESITA-3062 made it the destructive action row, like
 *  Settings › Delete account), opening MESITA-3052's confirm. */
export function DisconnectLink({
  disabled = false,
  open = false,
  onOpen,
  onClose,
}: {
  disabled?: boolean;
  open?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
}) {
  const { igHandle: handle } = useConsumerIdentity();
  return (
    <>
      <SettingsGroup title="Account">
        <SettingsActionRow
          Icon={Unlink}
          label="Disconnect Instagram"
          sub={handle ? `Take @${handle} off Mesita` : undefined}
          destructive
          disabled={disabled}
          onClick={() => onOpen?.()}
        />
      </SettingsGroup>
      <DisconnectDialog
        open={open}
        handle={handle}
        onClose={() => onClose?.()}
      />
    </>
  );
}

// ONE TAP, NO HANDLE (Pato, MESITA-2992: "i don't even think you need to
// type your instagram … have an already built button in the app to just send
// a message directly … in one click and avoid the step 1"; it reverses
// MESITA-2599's handle-first field). The code is one-time, expires and is
// bound to this account on the server, and the bot reads who sent it from
// Meta, so nothing is typed. It is fetched when the card opens, so the button
// is a plain link: the tap copies the code and opens the DM in one gesture
// (an await before opening would get the new tab blocked on iOS). Drawn only
// while the channel is live: the code is asked for on open.
function ConnectByMessage() {
  const supabase = useBrowserSupabase();
  const [claim, setClaim] = useState<InstagramDmClaim | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // Polling starts on the tap, stops after DM_POLL_FOR_MS; "Check again"
  // restarts it.
  const [waitingSince, setWaitingSince] = useState<number | null>(null);
  const [gaveUp, setGaveUp] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiStartInstagramDm(supabase)
      .then((c) => {
        if (!cancelled) setClaim(c);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, attempt]);

  useEffect(() => {
    if (!claim || waitingSince === null) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const status = await apiInstagramDmStatus(supabase);
        if (cancelled) return;
        if (dmVerified(status, claim.issuedAt)) {
          landConnected();
          return;
        }
      } catch {
        /* a failed poll is retried on the next tick */
      }
      if (cancelled) return;
      if (Date.now() - waitingSince > DM_POLL_FOR_MS) {
        setGaveUp(true);
        return;
      }
      timer.current = setTimeout(tick, DM_POLL_MS);
    };
    timer.current = setTimeout(tick, DM_POLL_MS);
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [claim, waitingSince, supabase]);

  async function copyCode() {
    if (!claim) return;
    try {
      await navigator.clipboard.writeText(claim.code);
      toast("Code copied");
    } catch {
      toast("Couldn’t copy — type it in instead.");
    }
  }

  function retry() {
    setLoadFailed(false);
    setClaim(null);
    setAttempt((n) => n + 1);
  }

  return (
    <ConnectCard account={claim?.account}>
      {claim && (
        <button
          type="button"
          onClick={copyCode}
          aria-label={`Your code ${claim.code}, tap to copy`}
          className="border-border bg-muted/30 flex h-11 w-full items-center justify-center gap-2 rounded-xl border px-5 font-mono text-sm font-semibold tracking-wide"
          data-instagram-dm-code
        >
          {claim.code}
          <Copy className="text-muted-foreground h-4 w-4" />
        </button>
      )}
      {claim ? (
        <a
          href={claim.link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            void navigator.clipboard?.writeText(claim.code).catch(() => {});
            setGaveUp(false);
            setWaitingSince(Date.now());
          }}
          className={cn(
            ME_BUTTON_CLASS,
            "bg-foreground text-paper mt-2 flex w-full items-center justify-center gap-2",
          )}
          data-instagram-dm-start
        >
          <Send className="h-4 w-4" />
          Send my code on Instagram
        </a>
      ) : loadFailed ? (
        <Button
          type="button"
          size="sm"
          onClick={retry}
          className={cn(ME_BUTTON_CLASS, "w-full")}
        >
          Couldn’t get a code — try again
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          disabled
          className={cn(ME_BUTTON_CLASS, "w-full")}
          data-instagram-dm-start
        >
          <Spinner size="sm" className="border-white/40 border-t-white" />
          Send my code on Instagram
        </Button>
      )}
      {claim &&
        waitingSince !== null &&
        (gaveUp ? (
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setGaveUp(false);
              setWaitingSince(Date.now());
            }}
            className={cn(ME_BUTTON_CLASS, "mt-2 w-full")}
          >
            <BadgeCheck className="h-4 w-4" />
            Check again
          </Button>
        ) : (
          <p
            className="text-muted-foreground type-label mt-2 flex items-center justify-center gap-2"
            aria-live="polite"
          >
            <Spinner size="sm" />
            Waiting for your message…
          </p>
        ))}
    </ConnectCard>
  );
}

/** The live Connect card: three steps that match the screen, then
 *  `children` (the code and the send button) and the password line.
 *  `account` is the Instagram the code goes to, Mesita's until the server
 *  names one. "Connected", never "verified": Verified is the follower bar. */
function ConnectCard({
  account = "mesita",
  children,
}: {
  account?: string;
  children: ReactNode;
}) {
  return (
    <div data-instagram-connect="dm">
      <SettingsGroup title="Connect">
        <ol className="divide-border/60 divide-y">
          {[
            <>
              Tap Send my code: it copies a one-time code and opens Instagram
            </>,
            <>
              Paste it in a message to <b>@{account}</b> and send
            </>,
            <>Come back here: you&apos;re connected in a few seconds</>,
          ].map((line, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-3">
              <IconChip>
                <span className="text-sm font-semibold tabular-nums">
                  {i + 1}
                </span>
              </IconChip>
              <span className="min-w-0 flex-1 text-sm">{line}</span>
            </li>
          ))}
        </ol>
        <div className="border-border/60 border-t px-4 py-3">
          {children}
          <PasswordLine />
        </div>
      </SettingsGroup>
    </div>
  );
}

function PasswordLine() {
  return (
    <p className="text-muted-foreground type-label mt-2 text-center">
      We never ask for your password.
    </p>
  );
}

/** The Connect card while the Meta channel is off (MESITA-2579, MESITA-3001):
 *  CONNECT BY USERNAME, FOR TESTING (MESITA-3039, Pato: "you just assume is
 *  true and use apify … it's a testing bot"). The guest types a username and
 *  says it is theirs; consumer-web-lookup-instagram scrapes it (Apify) and
 *  stores the handle, followers and photo, then the page lands connected
 *  like the DM flow. Nothing proves ownership until the Meta DM bot.
 *  `pending` marks it as the silhouette drawn while the page asks which way
 *  connecting works today: the same card, nothing interactive. */
function ConnectLookup({
  pending = false,
  changing = false,
  oldHandle = null,
  onBusyChange,
  onCancel,
}: {
  pending?: boolean;
  /** Change account (MESITA-3060): the old handle stays until this lands. */
  changing?: boolean;
  oldHandle?: string | null;
  onBusyChange?: (busy: boolean) => void;
  onCancel?: () => void;
}) {
  const supabase = useBrowserSupabase();
  const [raw, setRaw] = useState("");
  const [mine, setMine] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<
    | { kind: "not_found"; username: string }
    | { kind: "error"; message: string }
    | null
  >(null);

  const username = normalizeInstagramHandle(raw);
  const typed = raw.trim().replace(/^@/, "");
  const invalid = typed !== "" && !username;
  const canSubmit = !pending && !busy && username !== null && mine;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || !username) return;
    setBusy(true);
    onBusyChange?.(true);
    setResult(null);
    try {
      const r = await apiLookupInstagram(supabase, username);
      // First connect lands on Me; a change or a same-handle sync lands here.
      if (changing || r.result === "synced") landHere(r);
      else landConnected();
    } catch (err) {
      setResult(
        err instanceof EFError && err.code === "profile_not_found"
          ? { kind: "not_found", username }
          : {
              kind: "error",
              message:
                err instanceof EFError && err.code
                  ? syncErrorCopy(err, username)
                  : errMsg(err, "Couldn’t connect — try again."),
            },
      );
      setBusy(false);
      onBusyChange?.(false);
    }
  }

  return (
    <div
      data-instagram-connect={pending ? undefined : "lookup"}
      aria-busy={pending || undefined}
    >
      <SettingsGroup title="Connect">
        <div className="flex items-start gap-3 px-4 py-3">
          <IconChip tint="instagram">
            <Instagram className="h-[18px] w-[18px]" />
          </IconChip>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">
              {changing ? "Change account" : "Connect your Instagram"}
            </p>
            <p className="text-muted-foreground type-label">
              {changing && oldHandle
                ? `@${oldHandle} stays connected until the new one is found.`
                : "Type your username. We add your followers and photo from your Instagram."}
            </p>
          </div>
        </div>
        <form
          onSubmit={submit}
          className="border-border/60 flex flex-col gap-3 border-t px-4 py-3"
          noValidate
        >
          <label className="flex flex-col gap-1">
            <span className="type-label font-semibold">Instagram username</span>
            {/* The @ is drawn, never typed (Pato, MESITA-3045: "automatically
                write the @ here"); a typed or pasted one is dropped. */}
            <span className="relative block">
              <span
                aria-hidden
                className="text-muted-foreground pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm"
              >
                @
              </span>
              <input
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                placeholder="username"
                maxLength={30}
                value={raw}
                disabled={pending}
                onChange={(e) => {
                  setRaw(e.target.value.trimStart().replace(/^@+/, ""));
                  setResult(null);
                }}
                aria-invalid={invalid || undefined}
                aria-describedby={invalid ? "ig-lookup-invalid" : undefined}
                className={cn(INPUT_CLASS, "pl-7")}
                data-instagram-lookup-username
              />
            </span>
          </label>
          {invalid && (
            <p id="ig-lookup-invalid" className="text-destructive type-label">
              Use letters, numbers, periods and underscores, up to 30.
            </p>
          )}
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={mine}
              disabled={pending}
              onChange={(e) => setMine(e.target.checked)}
              className="accent-foreground h-5 w-5 shrink-0"
              data-instagram-lookup-mine
            />
            This is my Instagram account
          </label>
          <Button
            type="submit"
            size="sm"
            disabled={!canSubmit}
            className={cn(ME_BUTTON_CLASS, "w-full")}
            data-instagram-lookup-submit
          >
            {busy && (
              <Spinner size="sm" className="border-white/40 border-t-white" />
            )}
            {busy ? "Connecting…" : "Connect"}
          </Button>
          <div aria-live="polite">
            {busy && (
              <p className="text-muted-foreground type-label text-center">
                Reading your Instagram. This can take up to a minute.
              </p>
            )}
            {result?.kind === "not_found" && (
              <p
                className="text-muted-foreground type-label text-center"
                data-instagram-lookup-empty
              >
                We couldn&apos;t find @{result.username} on Instagram. Check the
                username and try again.
              </p>
            )}
            {result?.kind === "error" && (
              <p
                className="text-destructive type-label text-center"
                data-instagram-lookup-error
              >
                {result.message}
              </p>
            )}
          </div>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="text-muted-foreground hover:text-foreground type-label min-h-11 font-medium underline underline-offset-4 transition disabled:opacity-60"
            >
              Cancel
            </button>
          )}
          <PasswordLine />
        </form>
      </SettingsGroup>
    </div>
  );
}

/** The Connect card while the page asks which way connecting works today
 *  (Pato, MESITA-2701: "the placeholders must be similar to the page you are
 *  loading, like the sizes"): today's card, the off one. Shared with the
 *  route's fallback (InstagramSkeleton). */
export function ConnectCardSkeleton() {
  return <ConnectLookup pending />;
}

// THE ACCOUNT ROW (MESITA-3060). The handle links to the account on
// Instagram (built only from the stored handle); the line under it is the
// count, "Verified" at 1,000+, and "Updated …" from the later of connect and
// sync, rendered client-only. Disconnect left this row for a link at the
// page bottom.
function CurrentConnectionRow({ pending = false }: { pending?: boolean }) {
  const {
    igHandle: handle,
    igReach: verified,
    igFollowers,
  } = useConsumerIdentity();
  const profile = useServerProfile();
  const now = useSyncExternalStore(
    minuteClock.subscribe,
    minuteClock.now,
    minuteClock.server,
  );
  const stamps = [profile?.instagram_verified_at, profile?.instagram_synced_at]
    .filter((v): v is string => typeof v === "string")
    .sort();
  const updatedAt = stamps.length ? stamps[stamps.length - 1] : null;
  const ago = now != null && updatedAt ? updatedAgo(updatedAt, now) : "";

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <IconChip tint="instagram">
        <Instagram className="h-[18px] w-[18px]" />
      </IconChip>
      <div className="min-w-0 flex-1">
        {handle && !pending ? (
          <a
            href={`https://www.instagram.com/${handle}/`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`View @${handle} on Instagram`}
            className="block truncate text-sm font-semibold hover:underline"
          >
            @{handle}
          </a>
        ) : (
          <p className="truncate text-sm font-semibold">
            {handle ? `@${handle}` : "Instagram connected"}
          </p>
        )}
        <p className="text-muted-foreground type-label truncate">
          {followersLabel(igFollowers)}
          {verified ? " · Verified" : ""}
          {ago ? ` · Updated ${ago}` : ""}
        </p>
      </div>
    </div>
  );
}

function DisconnectDialog({
  open,
  handle,
  onClose,
}: {
  open: boolean;
  handle: string | null;
  onClose: () => void;
}) {
  const supabase = useBrowserSupabase();
  const [busy, setBusy] = useState(false);

  async function disconnect() {
    if (busy) return;
    setBusy(true);
    try {
      await apiDisconnectInstagram(supabase);
      window.location.reload();
    } catch (err) {
      toast.error(errMsg(err, "Couldn’t disconnect — try again."));
      setBusy(false);
    }
  }

  const who = handle ? `@${handle}` : "your Instagram";
  return (
    <LocalDialog open={open} onClose={onClose} ariaLabel="Disconnect Instagram">
      <div className={SHEET_BODY_CLASS}>
        <h2 className={SHEET_TITLE_CLASS}>Disconnect {who}?</h2>
        <p className="text-muted-foreground type-body mt-2 leading-snug">
          Your username and followers come off Mesita, and so does a picture
          that came from Instagram. You can connect again anytime.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className={SHEET_CANCEL_BUTTON_CLASS}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={disconnect}
            disabled={busy}
            className="bg-destructive flex flex-1 items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-white transition disabled:opacity-60"
            data-instagram-disconnect-confirm
          >
            {busy && (
              <Spinner size="sm" className="border-white/40 border-t-white" />
            )}
            {busy ? "Disconnecting…" : "Disconnect"}
          </button>
        </div>
      </div>
    </LocalDialog>
  );
}

// "USE MY INSTAGRAM PHOTO" (Pato, MESITA-2585: "lets keep that as default but
// ask the user, they can not activate that if they want. we only get the
// username and the [followers]"). A server fact (consumers.use_instagram_photo,
// on by default) that both verify paths read: on, verifying copies the
// Instagram photo as the picture unless the guest uploaded one (MESITA-2578);
// off, only the handle and followers are stored, and a picture that came
// from Instagram is taken down.
function InstagramPhotoSwitch() {
  const supabase = useBrowserSupabase();
  // The kept profile row (MESITA-3014); a flip shows at once, the saved row
  // then lands in the store.
  const { data, error } = useConsumerProfile();
  const [flipped, setOn] = useState<boolean | null>(null);
  const on =
    flipped ??
    (data ? data.use_instagram_photo !== false : error ? true : null);
  const [pending, setPending] = useState(false);

  const flip = () => {
    if (on == null || pending) return;
    const next = !on;
    setOn(next);
    setPending(true);
    apiUpdateConsumerProfile(supabase, { use_instagram_photo: next })
      .then(() => setOn(null))
      .catch((e) => {
        setOn(!next);
        toast.error(errMsg(e, "Couldn't change that."));
      })
      .finally(() => setPending(false));
  };

  const shown = on ?? true;
  return (
    <SettingsGroup title="Photo">
      <button
        type="button"
        role="switch"
        aria-checked={shown}
        disabled={on == null || pending}
        onClick={flip}
        className="hover:bg-muted flex w-full items-center gap-3 px-4 py-3 text-left transition disabled:opacity-60"
        data-instagram-photo-switch
      >
        <IconChip>
          <ImageIcon className="h-[18px] w-[18px]" />
        </IconChip>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">
            {INSTAGRAM_PHOTO_SWITCH.label}
          </span>
          <span className="text-muted-foreground type-label block">
            {shown ? INSTAGRAM_PHOTO_SWITCH.on : INSTAGRAM_PHOTO_SWITCH.off}
          </span>
        </span>
        <Switch on={shown} />
      </button>
    </SettingsGroup>
  );
}
