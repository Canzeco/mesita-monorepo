"use client";

import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Copy, ImageIcon, Send } from "lucide-react";
import { Instagram } from "@/components/shared/instagram-icon";
import { cn, errMsg } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { MeScreen } from "@/components/consumer/me/MeScreen";
import { Spinner } from "@/components/shared";
import { Button } from "@/components/ui/button";
import {
  IconCircle,
  SectionEyebrow,
  SettingsGroup,
  Switch,
} from "@/components/consumer/me/settings-rows";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  apiFetchConsumerProfile,
  apiInstagramChannel,
  apiInstagramDmStatus,
  apiStartInstagramDm,
  apiUpdateConsumerProfile,
  dmVerified,
  type InstagramChannel,
  type InstagramDmClaim,
} from "@/lib/api/profile";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { useConsumerIdentity } from "@/lib/identity-context";
import { SocialNameRow } from "@/components/consumer/me/SocialNameRow";
import { INSTAGRAM_REACH_FOLLOWERS } from "@/lib/consumer-identity";
import { INSTAGRAM_ICON_GRADIENT_CLASS } from "@/lib/ui-classes";

// Instagram connect page (MESITA-936): one Why box → Connect.
//
// IT GRANTS NOTHING (Pato, MESITA-2040: "instagram is just 1000 followers").
// A connected handle is an identity fact; crossing the bar makes the account
// VERIFIED. The bar lives in `INSTAGRAM_REACH_FOLLOWERS` and this file names
// it once.
//
// CONNECTING IS PROOF (MESITA-2461). The guest gets a one-time code, puts it
// in their Instagram bio, and the server reads it there before it stores the
// handle — with the follower count IT scraped. This page used to send a
// fixed 5,000 and an 8-digit "code" nobody checked, so anyone could show up
// in Social as @someone_famous.
//
// BY MESSAGE, ALWAYS SHOWN (MESITA-2575, MESITA-2602; Pato: "not yet the
// actual backend functionality but keep that UI already designed"). The page
// always draws the message flow: type your @handle, get a code, send it to
// Mesita's Instagram, and the page waits while Meta tells the server who sent
// it. The server says whether that channel is live; until it is (the Meta
// secrets, MESITA-2579) the flow is a preview — "Get my code" is tagged Soon
// and nothing is called. The bio-code screen is gone from the page; the
// server still answers its actions.

const HANDLE_RE = /^@?[A-Za-z0-9._]{1,30}$/;

/** How often the page asks whether the message landed, and for how long. */
const DM_POLL_MS = 3_000;
const DM_POLL_FOR_MS = 10 * 60_000;

/** The page's success landing: a full reload re-seeds the identity. */
function landConnected() {
  window.location.assign(
    new URL(`${CONSUMER_ROUTES.me}?instagram=success`, window.location.origin),
  );
}

const WHY_LINES = [
  `${INSTAGRAM_REACH_FOLLOWERS.toLocaleString("en-US")}+ followers and you're verified on Mesita — free, automatic, and nothing to apply for.`,
  // Pato, MESITA-2598: "mention that your mesita profile picture is your
  // instagram profile picture" (the switch below can turn it off).
  "Your Mesita profile picture becomes your Instagram profile picture.",
] as const;

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
      <div className="mb-4 flex items-center gap-3">
        <span
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white",
            INSTAGRAM_ICON_GRADIENT_CLASS,
          )}
        >
          <Instagram className="h-5 w-5" />
        </span>
        <p className="text-muted-foreground text-xs">
          {INSTAGRAM_REACH_FOLLOWERS.toLocaleString("en-US")}+ followers
          verifies you.
        </p>
      </div>

        <div className="flex flex-col gap-3">
          {connected && (
            <section className="flex flex-col gap-2">
              <SectionEyebrow>Connected</SectionEyebrow>
              <CurrentConnectionCard />
            </section>
          )}

          {/* The pitch is for people who haven't connected. Once they have,
              it is the app arguing with a decision the guest already made. */}
          {!connected && <WhyConnectModule />}

          {showForm && channel === null && (
            <div className="flex justify-center py-6" aria-busy>
              <Spinner size="sm" />
            </div>
          )}

          {showForm && channel !== null && (
            <ConnectByMessage live={channel.channel === "dm"} />
          )}

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

function WhyConnectModule() {
  return (
    <article className="border-border bg-card rounded-2xl border p-4">
      <h3 className="text-sm leading-tight font-bold tracking-tight">
        Why connect
      </h3>
      <ul className="mt-2 flex flex-col gap-2">
        {WHY_LINES.map((line) => (
          <li
            key={line}
            className="type-body flex items-start gap-2.5 leading-snug font-medium"
          >
            <span className="bg-secondary mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full" />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

// BY DM, HANDLE FIRST (Pato, MESITA-2599: "just input your instagram name,
// send that message to the instagram bot, then that's it … technically you
// don't need to input instagram name because when the bot receives the
// message it can see who sent it, but still ask … it's a clearer UX"). The
// typed handle only shapes the flow ("Send it from @handle"); the server
// still verifies whoever actually sent the code.
function ConnectByMessage({ live }: { live: boolean }) {
  const supabase = useBrowserSupabase();
  const [handle, setHandle] = useState("");
  const typed = handle.trim().replace(/^@/, "").toLowerCase();
  const handleOk = HANDLE_RE.test(handle.trim());
  const [claim, setClaim] = useState<InstagramDmClaim | null>(null);
  const [busy, setBusy] = useState(false);
  // Polling stops after DM_POLL_FOR_MS; "Check again" restarts it.
  const [waitingSince, setWaitingSince] = useState<number | null>(null);
  const [gaveUp, setGaveUp] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  async function start() {
    if (busy || !handleOk || !live) return;
    setBusy(true);
    try {
      setClaim(await apiStartInstagramDm(supabase));
      setGaveUp(false);
      setWaitingSince(Date.now());
    } catch (e) {
      toast(errMsg(e, "Couldn’t get a code — try again."));
    } finally {
      setBusy(false);
    }
  }

  async function copyCode() {
    if (!claim) return;
    try {
      await navigator.clipboard.writeText(claim.code);
      toast("Code copied");
    } catch {
      toast("Couldn’t copy — type it in instead.");
    }
  }

  return (
    <section
      className="border-border bg-card rounded-2xl border p-4"
      data-instagram-connect="dm"
    >
      <h3 className="mb-3 text-sm leading-tight font-bold tracking-tight">
        Connect Instagram
      </h3>
      <ol className="flex flex-col gap-3">
        {[
          <>Type your Instagram @handle</>,
          <>
            Send your code to <b>@{claim?.account ?? "mesita"}</b> on Instagram
          </>,
          <>That&apos;s it: you&apos;re verified in a few seconds</>,
        ].map((line, i) => (
          <li key={i} className="type-body flex items-start gap-3 leading-snug">
            <span className="bg-secondary/15 text-secondary type-label flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-bold">
              {i + 1}
            </span>
            <span>{line}</span>
          </li>
        ))}
      </ol>
      <input
        value={handle}
        onChange={(e) => {
          setHandle(e.target.value);
          // A different handle starts over with a new code.
          if (claim) {
            setClaim(null);
            setWaitingSince(null);
            setGaveUp(false);
          }
        }}
        placeholder="yourhandle"
        aria-label="Your Instagram @handle"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        maxLength={31}
        className="border-border bg-muted/30 placeholder:text-muted-foreground/70 mt-3 h-12 w-full rounded-xl border px-5 text-center text-sm outline-none"
        data-instagram-dm-handle
      />
      {claim ? (
        <>
          <p className="text-muted-foreground type-body mt-3 text-center">
            Send this code from <b className="text-foreground">@{typed}</b>
          </p>
          <button
            type="button"
            onClick={copyCode}
            className="border-border bg-muted/30 mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl border px-5 font-mono text-sm font-semibold tracking-wide"
          >
            {claim.code}
            <Copy className="text-muted-foreground h-4 w-4" />
          </button>
          <a
            href={claim.link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => void navigator.clipboard?.writeText(claim.code).catch(() => {})}
            className="bg-foreground text-background mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold"
          >
            <Send className="h-4 w-4" />
            Send it on Instagram
          </a>
          {gaveUp ? (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setGaveUp(false);
                setWaitingSince(Date.now());
              }}
              className="mt-2 w-full rounded-xl text-sm font-semibold"
            >
              <BadgeCheck className="h-4 w-4" />
              Check again
            </Button>
          ) : (
            <p
              className="text-muted-foreground type-body mt-2 flex items-center justify-center gap-2"
              aria-live="polite"
            >
              <Spinner size="sm" />
              Waiting for your message…
            </p>
          )}
        </>
      ) : (
        <>
          <Button
            type="button"
            size="sm"
            onClick={start}
            disabled={busy || !handleOk || !live}
            className="mt-2 w-full rounded-xl text-sm font-semibold"
            data-instagram-dm-start
          >
            {busy && <Spinner size="sm" className="border-white/40 border-t-white" />}
            Get my code
            {/* The Meta channel is not on yet (MESITA-2579): a preview. */}
            {!live && (
              <span className="bg-background/20 type-meta rounded-full px-1.5 py-0.5 font-semibold">
                Soon
              </span>
            )}
          </Button>
          {!live && (
            <p className="text-muted-foreground type-body mt-2 text-center" data-instagram-dm-soon>
              Connecting by Instagram message opens soon.
            </p>
          )}
        </>
      )}
      <p className="text-muted-foreground type-body mt-2 text-center">
        We never ask for your password.
      </p>
    </section>
  );
}

function CurrentConnectionCard() {
  const { igHandle: handle, igReach: verified } = useConsumerIdentity();

  return (
    <div className="border-border bg-card flex items-center gap-3 rounded-2xl border p-4">
      <span
        className={cn(
          "shadow-rest flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white",
          INSTAGRAM_ICON_GRADIENT_CLASS,
        )}
      >
        <Instagram className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold tracking-tight">
          {handle ? `@${handle}` : "Instagram connected"}
        </p>
        <p className="text-muted-foreground text-xs">
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
  const [on, setOn] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetchConsumerProfile(supabase)
      .then(({ consumer }) => {
        if (!cancelled) setOn(consumer.use_instagram_photo !== false);
      })
      .catch(() => {
        if (!cancelled) setOn(true);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const flip = () => {
    if (on == null || pending) return;
    const next = !on;
    setOn(next);
    setPending(true);
    apiUpdateConsumerProfile(supabase, { use_instagram_photo: next })
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
        <IconCircle tint="muted">
          <ImageIcon className="h-[18px] w-[18px]" />
        </IconCircle>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Use my Instagram photo</span>
          <span className="text-muted-foreground type-label block">
            {shown
              ? "Your Mesita profile picture is your Instagram one"
              : "Only your username and followers"}
          </span>
        </span>
        <Switch on={shown} />
      </button>
    </SettingsGroup>
  );
}
