"use client";

import { useConsumerProfile } from "@/lib/use-consumer-profile";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { BadgeCheck, Copy, ImageIcon, Send } from "lucide-react";
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
  SettingsGroup,
  Switch,
} from "@/components/consumer/me/settings-rows";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  apiInstagramChannel,
  apiInstagramDmStatus,
  apiLookupInstagram,
  apiStartInstagramDm,
  apiUpdateConsumerProfile,
  dmVerified,
  type InstagramChannel,
  type InstagramDmClaim,
} from "@/lib/api/profile";
import { EFError } from "@/lib/api/_invoke";
import { normalizeInstagramHandle } from "@/lib/instagram-handle";
import { INPUT_CLASS } from "@/lib/ui-classes";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { useConsumerIdentity } from "@/lib/identity-context";
import { SocialNameRow } from "@/components/consumer/me/SocialNameRow";
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

export function InstagramModal() {
  const supabase = useBrowserSupabase();
  const identity = useConsumerIdentity();
  const connected = identity.igConnected;
  // A CONNECTED GUEST IS NOT A PROSPECT (decision: Pato, 2026-08-22). The
  // page used to render the pitch AND the whole connect form under the card
  // that already said "connected". Connected collapses to the account card;
  // switching accounts is a real but rare need, so it gets one quiet link
  // that brings the form back rather than the form standing open forever.
  const [switching, setSwitching] = useState(false);
  const showForm = !connected || switching;
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

  return (
    <MeScreen title="Instagram">
      <InstagramIntro />

      <div className="flex flex-col gap-6">
        {connected && <ConnectedAccount />}

        {/* While it is read, the card's own silhouette, not a spinner:
              the card that lands is ~330px tall to the spinner's 64px, so
              Photo's row below jumped (Pato, MESITA-2701). */}
        {showForm && channel === null && <ConnectCardSkeleton />}

        {showForm &&
          channel !== null &&
          (channel.channel === "dm" ? <ConnectByMessage /> : <ConnectLookup />)}

        {/* Public or private, asked where the member connects (MESITA-2594):
              public is what lets them see other members' Instagram. */}
        {connected && (
          <SettingsGroup title="Social">
            <SocialNameRow />
          </SettingsGroup>
        )}

        {/* Asked on the same screen as the connect (Pato, MESITA-2585:
              "keep that as default but ask the user"). */}
        <InstagramPhotoSwitch />

        {connected && !switching && (
          <button
            type="button"
            onClick={() => setSwitching(true)}
            className="text-muted-foreground hover:text-foreground type-body min-h-11 font-medium underline underline-offset-4 transition"
          >
            Connect a different account
          </button>
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

/** A connected guest's account card under its eyebrow. It reads only the
 *  identity context, seeded server-side, so the fallback draws it too. */
export function ConnectedAccount() {
  return (
    <SettingsGroup title="Connected">
      <CurrentConnectionRow />
    </SettingsGroup>
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
function ConnectLookup({ pending = false }: { pending?: boolean }) {
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
    setResult(null);
    try {
      await apiLookupInstagram(supabase, username);
      landConnected();
    } catch (err) {
      setResult(
        err instanceof EFError && err.code === "profile_not_found"
          ? { kind: "not_found", username }
          : {
              kind: "error",
              message: errMsg(err, "Couldn’t connect — try again."),
            },
      );
      setBusy(false);
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
            <p className="text-sm font-semibold">Connect your Instagram</p>
            <p className="text-muted-foreground type-label">
              Type your username. We add your followers and photo from your
              Instagram.
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
            <input
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              placeholder="@username"
              maxLength={31}
              value={raw}
              disabled={pending}
              onChange={(e) => {
                setRaw(e.target.value);
                setResult(null);
              }}
              aria-invalid={invalid || undefined}
              aria-describedby={invalid ? "ig-lookup-invalid" : undefined}
              className={INPUT_CLASS}
              data-instagram-lookup-username
            />
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

function CurrentConnectionRow() {
  const { igHandle: handle, igReach: verified } = useConsumerIdentity();

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <IconChip tint="instagram">
        <Instagram className="h-[18px] w-[18px]" />
      </IconChip>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {handle ? `@${handle}` : "Instagram connected"}
        </p>
        <p className="text-muted-foreground type-label">
          {verified ? "Verified" : "Connected"}
        </p>
      </div>
    </div>
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
