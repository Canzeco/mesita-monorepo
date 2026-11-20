"use client";

// ONE STORY, ONE PAGE: /me/tickets/stories/<storyId> (MESITA-4405, Pato
// 2026-11-18: "The Story artifact is where all the story process is done.
// 1. Pay $X. 2. Get principal immediately. 3. Solve the Story artifact
// (substeps). 4. Receive bonus."; "it must be checked by a human"). The
// guest lands here right after a Story buy (?by=purchase), and from
// Tickets › Stories and the Wallet's Story row. The ticket standard
// (TicketParts, MESITA-4118), top to bottom:
//
//   [IG][place]  +$50.00MX Story bonus      the hero, the state in its tone
//   Post your story · Post by 21:40 · 3 h left
//   Steps        Paid ✓ · Post · Waiter · Bonus, the current one lit
//   Now          waiting_post: the tags to copy and Open Instagram
//                found: the story and the waiter's QR
//                approved: "Checking · bonus at HH:MM", keep it up
//   Details      Paid · Bonus · Deadline
//   Test         Tag the place / Simulate the waiter (approve, reject) /
//                Simulate deleting it (test mode, Meta off)
//
// While the Story waits for a post or the waiter it asks
// consumer-web-check-story every 5 s, every 15 s after 2 minutes (the
// server's hint), one call at a time, stopping at approved, void or the
// deadline (storyPollDelay). A bought Story whose credit is still landing
// reads 404 for a moment: the page says so and asks again.

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, CircleCheck, Copy, Gift, QrCode, Wallet as WalletIcon } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { MeScreen } from "@/components/consumer/me/MeScreen";
import { EmptyState } from "@/components/shared/EmptyState";
import { Panel } from "@/components/shared/Panel";
import { Instagram } from "@/components/shared/instagram-icon";
import { EFError } from "@/lib/api/_invoke";
import { apiEmulateStory, apiGetStory, apiPollStory, money, STORY_EMULATOR_REFUSAL, type StoryTicket } from "@/lib/api/wallet";
import { walletPlacePath } from "@/lib/consumer-route-contract";
import { storyClock } from "@/lib/story-lines";
import { storyBonus, storyLine, storyPollDelay, storyStatus } from "@/lib/story-ticket";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { ticketsHref } from "@/lib/ticket-kinds";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { TestModeNote, TicketHero, TicketLine, TicketPage, TicketPanel, TicketSkeleton } from "./TicketParts";

const FILLED =
  "bg-foreground text-background flex h-12 w-full items-center justify-center gap-2 rounded-full text-base font-semibold transition hover:opacity-90 disabled:opacity-60";
const QUIET = "text-muted-foreground min-h-11 px-3 text-sm font-semibold underline underline-offset-2 disabled:opacity-60";

/** OPEN INSTAGRAM (MESITA-4296): the story camera by deep link; when the page
 *  is still showing 1.5 s later the app did not open, so instagram.com opens
 *  instead. A failed deep link is silent. */
function openInstagram(): void {
  let left = false;
  const onHide = () => {
    if (document.visibilityState === "hidden") left = true;
  };
  document.addEventListener("visibilitychange", onHide);
  window.setTimeout(() => {
    document.removeEventListener("visibilitychange", onHide);
    if (!left && document.visibilityState !== "hidden") window.open("https://instagram.com", "_blank", "noopener,noreferrer");
  }, 1_500);
  try {
    window.location.href = "instagram://story-camera";
  } catch {
    // silent: the fallback above opens the web
  }
}

/** The names to type in the story, copied on a tap. */
function CopyChip({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard
          ?.writeText(text)
          .then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1_500);
          })
          .catch(() => {});
      }}
      className="bg-muted text-foreground inline-flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold"
      aria-label={`Copy ${text}`}
      data-story-copy
    >
      {copied ? "Copied" : text}
      <Copy className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
    </button>
  );
}

type StepState = "done" | "current" | undefined;

/** The Story's own bonus wait, from the server (MESITA-4426): "30 s" for an
 *  emulator test, "3 hours" for a real one or an older read. */
function waitText(sec: number | null | undefined): string {
  if (sec == null || sec >= 3600) {
    const h = sec == null ? 3 : Math.round(sec / 3600);
    return `${h} hour${h === 1 ? "" : "s"}`;
  }
  return sec >= 120 ? `${Math.round(sec / 60)} min` : `${sec} s`;
}

/** The four steps, the current one lit, the done ones ticked. */
function StorySteps({ s }: { s: StoryTicket }) {
  const at: Record<string, StepState> = (() => {
    switch (s.state) {
      case "waiting_post":
        return { paid: "done", post: "current" };
      case "found":
        return { paid: "done", post: "done", waiter: "current" };
      case "approved":
        return { paid: "done", post: "done", waiter: "done", bonus: "current" };
      case "released":
        return { paid: "done", post: "done", waiter: "done", bonus: "done" };
      default:
        return { paid: "done" };
    }
  })();
  const paid = money(s.amount_cents, s.currency ?? "mxn");
  const steps = [
    { key: "paid", Icon: WalletIcon, title: "Paid, your credit is ready", amount: paid },
    { key: "post", Icon: Camera, title: "Post a story", amount: null },
    { key: "waiter", Icon: QrCode, title: "The waiter approves it", amount: null },
    { key: "bonus", Icon: Gift, title: `Keep it up ${waitText(s.wait_sec)}`, amount: storyBonus(s) },
  ];
  return (
    <Panel className="px-4 py-3" data-story-steps="">
      <ol className="flex flex-col" aria-label="Steps">
        {steps.map((st, i) => {
          const state = at[st.key];
          return (
            <li key={st.key} className="flex gap-3" aria-current={state === "current" ? "step" : undefined} data-story-step={state}>
              <span className="flex flex-col items-center" aria-hidden>
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                    state === "current" ? "bg-foreground text-background" : state === "done" ? "bg-emerald-50 text-emerald-700" : "bg-muted text-foreground",
                  )}
                >
                  {state === "done" ? <Check className="h-4 w-4" strokeWidth={2.75} /> : <st.Icon className="h-4 w-4" strokeWidth={2.25} />}
                </span>
                {i < steps.length - 1 ? <span className="bg-border my-1 w-0.5 flex-1" /> : null}
              </span>
              <span className={cn("flex min-w-0 flex-1 items-baseline justify-between gap-3 pt-1.5 text-sm font-semibold tabular-nums", i < steps.length - 1 && "pb-3", state === undefined && "text-muted-foreground")}>
                <span className="min-w-0">{st.title}</span>
                {st.amount ? <span className="shrink-0">{st.amount}</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

/** The story the Story holds: its picture (or the Instagram mark) and when. */
function StoryCard({ s }: { s: StoryTicket }) {
  const [broken, setBroken] = useState(false);
  const m = s.mention;
  if (!m) return null;
  const thumb = m.media_url && m.media_kind === "image" && !broken ? m.media_url : null;
  return (
    <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-3 text-left" data-story-found>
      <span className="bg-muted flex h-20 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg" aria-hidden>
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element -- the story's own media URL
          <img src={thumb} alt="" className="h-full w-full object-cover" onError={() => setBroken(true)} />
        ) : (
          <Instagram className="h-6 w-6" />
        )}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="flex items-center gap-1.5 text-base font-bold text-emerald-700">
          <CircleCheck className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
          {m.source === "emulator" ? "Test story found" : "Story found"}
        </span>
        <span className="text-muted-foreground text-sm">Posted {storyClock(m.mentioned_at, s.time_zone ?? "America/Mexico_City")}</span>
      </span>
    </div>
  );
}

/** What the guest does now, by state. */
function NowPanel({ s, now }: { s: StoryTicket; now: number }) {
  const handle = s.place_handle;
  if (s.state === "waiting_post" && Date.parse(s.deadline_at) > now) {
    return (
      <Panel title="Post your story" data-story-now="post">
        <div className="flex flex-col gap-3 px-4 pt-2 pb-4">
          <p className="text-sm leading-snug">
            Post a story from your public account. Tag us both and turn on the paid-partnership label.
          </p>
          <span>
            <CopyChip text={handle ? `@mesita @${handle}` : "@mesita"} />
          </span>
          <button type="button" onClick={openInstagram} className={FILLED} data-story-instagram>
            <Instagram className="h-5 w-5" aria-hidden />
            Open Instagram
          </button>
          <p className="text-muted-foreground text-center text-sm" aria-live="polite">
            We look for it by itself. It shows up here in a minute.
          </p>
        </div>
      </Panel>
    );
  }
  if (s.state === "found" && s.review_url) {
    return (
      <Panel title="Show this to your waiter" data-story-now="waiter">
        <div className="flex flex-col items-center gap-3 px-4 pt-2 pb-4 text-center" aria-live="polite">
          <StoryCard s={s} />
          <div className="rounded-2xl bg-white p-3" data-story-qr>
            <QRCodeSVG value={s.review_url} size={224} marginSize={0} aria-label="Story QR for the waiter" />
          </div>
          <p className="text-sm leading-snug font-semibold">They scan it, check your story and tap Approve.</p>
          <a href={s.review_url} target="_blank" rel="noreferrer" className="text-muted-foreground min-h-9 text-sm underline underline-offset-2">
            Open the waiter&apos;s link
          </a>
        </div>
      </Panel>
    );
  }
  if (s.state === "approved") {
    return (
      <Panel title="Approved" data-story-now="approved">
        <div className="flex flex-col gap-3 px-4 pt-2 pb-4">
          <StoryCard s={s} />
          <p className="text-sm leading-snug">
            {s.bonus_at
              ? `Keep your story up until ${storyClock(s.bonus_at, s.time_zone ?? "America/Mexico_City", now)}. Then your ${storyBonus(s)} bonus lands by itself.`
              : "Keep your story up. Your bonus lands by itself."}
          </p>
        </div>
      </Panel>
    );
  }
  return null;
}

/** THE TEST BAND (test mode, Instagram not connected): the emulator stands in
 *  for Instagram and the waiter, never the primary button. */
function TestBand({ s, onChanged }: { s: StoryTicket; onChanged: () => void }) {
  const getSupabase = useLazyBrowserSupabase();
  const [busy, setBusy] = useState<string | null>(null);
  if (!s.emulator) return null;
  const run = async (action: "post" | "delete" | "approve" | "reject") => {
    setBusy(action);
    try {
      await apiEmulateStory(getSupabase(), action, action === "approve" || action === "reject" ? s.story_id : undefined);
      onChanged();
    } catch (err) {
      const code = err instanceof EFError ? err.code : null;
      toast((code && STORY_EMULATOR_REFUSAL[code]) || STORY_EMULATOR_REFUSAL.emulate_failed, { tone: "error" });
    } finally {
      setBusy(null);
    }
  };
  const handle = s.place_handle;
  return (
    <div className="border-border flex flex-col items-center gap-1 rounded-2xl border border-dashed p-3" data-story-emulator>
      <TestModeNote className="self-center" />
      {s.state === "waiting_post" ? (
        <button type="button" disabled={busy !== null} onClick={() => void run("post")} className={QUIET} data-story-simulate="post">
          {busy === "post" ? "Tagging…" : handle ? `Tag @${handle} (test story)` : "Tag the place (test story)"}
        </button>
      ) : null}
      {s.state === "found" ? (
        <span className="flex flex-wrap justify-center">
          <button type="button" disabled={busy !== null} onClick={() => void run("approve")} className={QUIET} data-story-simulate="approve">
            {busy === "approve" ? "Approving…" : "Simulate the waiter's approval"}
          </button>
          <button type="button" disabled={busy !== null} onClick={() => void run("reject")} className={QUIET} data-story-simulate="reject">
            {busy === "reject" ? "Rejecting…" : "Simulate a reject"}
          </button>
        </span>
      ) : null}
      {s.state === "approved" ? (
        <button type="button" disabled={busy !== null} onClick={() => void run("delete")} className={QUIET} data-story-simulate="delete">
          {busy === "delete" ? "Deleting…" : "Simulate deleting the story"}
        </button>
      ) : null}
    </div>
  );
}

type Read = { story: StoryTicket | null; error: "missing" | "failed" | null; misses: number };

/** Right after a buy: ask again 3 s apart, for a minute. */
const LANDING_TRIES = 20;

export function StoryPage({ id, byPurchase = false }: { id: string; byPurchase?: boolean }) {
  const getSupabase = useLazyBrowserSupabase();
  const [read, setRead] = useState<Read>({ story: null, error: null, misses: 0 });
  const [now, setNow] = useState(() => Date.now());
  // When the look began: set by the first read, read only in effects.
  const started = useRef(0);
  const seq = useRef(0);

  // One read: the first by id (or purchase), then the poll by the Story's id.
  const fetchOnce = useCallback(
    async (poll: boolean): Promise<Omit<Read, "misses">> => {
      try {
        const story = poll && read.story
          ? await apiPollStory(getSupabase(), read.story.story_id)
          : await apiGetStory(getSupabase(), byPurchase ? { purchase_id: id } : { story_id: id });
        return { story, error: null };
      } catch (err) {
        const missing = err instanceof EFError && err.status === 404;
        return { story: read.story, error: missing ? "missing" : "failed" };
      }
    },
    // getSupabase is a stable lazy getter (MESITA-3207).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, byPurchase, read.story],
  );

  const refresh = useCallback(
    (poll: boolean) => {
      const mine = ++seq.current;
      void fetchOnce(poll).then((r) => {
        if (mine === seq.current) setRead((prev) => ({ ...r, misses: r.error === "missing" ? prev.misses + 1 : 0 }));
      });
    },
    [fetchOnce],
  );

  // The first read.
  useEffect(() => {
    started.current = Date.now();
    const mine = ++seq.current;
    void fetchOnce(false).then((r) => {
      if (mine === seq.current) setRead({ ...r, misses: r.error === "missing" ? 1 : 0 });
    });
    // Only on a new address.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, byPurchase]);

  // The look: one timer at a time, after the last answer.
  useEffect(() => {
    const t0 = Date.now();
    // Right after a buy the Story may not exist yet: ask again, 3 s apart, for a minute.
    if (!read.story && read.error === "missing" && byPurchase && read.misses < LANDING_TRIES) {
      const t = window.setTimeout(() => refresh(false), 3_000);
      return () => window.clearTimeout(t);
    }
    const delay = storyPollDelay(read.story, started.current, t0);
    if (delay === null) return;
    const t = window.setTimeout(() => refresh(true), delay);
    return () => window.clearTimeout(t);
  }, [read, byPurchase, refresh]);

  // The countdown moves every 30 s; every second once the bonus or the
  // deadline is under 2 minutes away (MESITA-4426: a test Story's 30 s).
  const soonIso = read.story?.state === "approved" ? read.story.bonus_at : read.story?.deadline_at ?? null;
  const soon = soonIso != null && Date.parse(soonIso) - now < 120_000 && Date.parse(soonIso) > now - 5_000;
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), soon ? 1_000 : 30_000);
    return () => window.clearInterval(t);
  }, [soon]);

  const s = read.story;
  const body = (() => {
    if (!s) {
      if (read.error === "missing" && byPurchase && read.misses < LANDING_TRIES) {
        return (
          <EmptyState icon={Instagram} title="Your payment is landing" description="Your Story shows here in a moment." />
        );
      }
      if (read.error) {
        return (
          <EmptyState
            icon={Instagram}
            title={read.error === "missing" ? "This Story isn't here" : "Couldn't load this Story"}
            description={read.error === "missing" ? "It may belong to another account." : "Check your connection and try again."}
            action={read.error === "missing" ? { label: "Back to Stories", href: ticketsHref("stories") } : { label: "Try again", onClick: () => refresh(false) }}
          />
        );
      }
      return <TicketSkeleton />;
    }
    const status = storyStatus(s, now);
    const place = s.place_name ?? s.place?.name ?? "A Mesita place";
    const zone = s.time_zone ?? "America/Mexico_City";
    return (
      <TicketPage data-story-page={s.state}>
        <TicketHero
          data-story-state={s.state}
          marks={
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 via-pink-500 to-purple-600 text-white" aria-hidden>
              <Instagram className="h-8 w-8" />
            </span>
          }
          headline={`${storyBonus(s)} Story bonus`}
          state={status.label}
          tone={status.tone}
          place={place}
          placeHref={walletPlacePath(s.place_id)}
          note={storyLine(s, now)}
          test={s.test_mode}
          dim={s.state === "void"}
        />
        <StorySteps s={s} />
        <NowPanel s={s} now={now} />
        <TestBand s={s} onChanged={() => refresh(true)} />
        <TicketPanel title="Details">
          <TicketLine label="You paid" value={money(s.amount_cents, s.currency ?? "mxn")} />
          <TicketLine label="Bonus" value={storyBonus(s)} strong />
          {s.state === "waiting_post" || s.state === "found" ? (
            <TicketLine label="Post and approve by" value={storyClock(s.deadline_at, zone, now)} />
          ) : null}
          {s.approved_at ? <TicketLine label="Approved" value={storyClock(s.approved_at, zone, now)} /> : null}
          {s.decided_at ? <TicketLine label={s.state === "released" ? "Bonus added" : "Ended"} value={storyClock(s.decided_at, zone, now)} /> : null}
        </TicketPanel>
      </TicketPage>
    );
  })();

  return <MeScreen title="Story">{body}</MeScreen>;
}
