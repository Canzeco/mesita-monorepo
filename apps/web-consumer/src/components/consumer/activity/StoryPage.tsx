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
//   Post your story · tag @mesita and the restaurant · no deadline
//   Steps        Pay · Credits · Post Story · Wait 3 hours · Check Story ·
//                Bonus (MESITA-4627), the current one lit
//   Now          waiting_post: the tags to copy and Open Instagram
//                found: buy the voucher at the place and this story counts
//                approved: "Checking · bonus at HH:MM", keep it up
//   Details      Paid · Posted · Bonus if it stays up
//   Test         Connect a public Instagram / Publish a story / Delete it
//
// While the voucher is waiting for a post, the screen reloads the voucher.
// An approved story asks consumer-web-check-story every 5 s (storyPollDelay).
// A bought Story whose credit is still landing reads 404 for a moment: the
// page says so and asks again.

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CircleCheck, Clock3, Copy, Gift, Wallet as WalletIcon } from "lucide-react";
import { storyVoucherStage } from "@/lib/story-voucher";
import { type VoucherStep, type VoucherStepState, VoucherSteps } from "./VoucherSteps";
import { MeScreen } from "@/components/consumer/me/MeScreen";
import { EmptyState } from "@/components/shared/EmptyState";
import { Panel } from "@/components/shared/Panel";
import { Instagram } from "@/components/shared/instagram-icon";
import { EFError } from "@/lib/api/_invoke";
import { apiEmulateStory, apiGetStory, apiPollStory, money, STORY_EMULATOR_REFUSAL, type StoryCheck, type StoryTicket } from "@/lib/api/wallet";
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

/** The Story's own bonus wait, from the server (MESITA-4426): "30 s" for an
 *  emulator test, "3 hours" for a real one or an older read. */
function waitText(sec: number | null | undefined): string {
  if (sec == null || sec >= 3600) {
    const h = sec == null ? 3 : Math.round(sec / 3600);
    return `${h} hour${h === 1 ? "" : "s"}`;
  }
  return sec >= 120 ? `${Math.round(sec / 60)} min` : `${sec} s`;
}

/** THE STORY VOUCHER'S SIX STEPS (Pato, 2026-11-21, MESITA-4627: "1. Pay
 *  2. Credits 3. Post Story 4. Wait 3 hours 5. Check Story 6. Bonus"; four
 *  steps before). The stage comes from lib/story-voucher.ts. */
function StorySteps({ s }: { s: StoryTicket }) {
  const stage = storyVoucherStage(s, s.refunded);
  const order = ["post", "wait", "check", "bonus"] as const;
  const reached = stage === "done" ? 4 : stage === "check" ? 2 : stage === "wait" ? 1 : stage === "post" ? 0 : -1;
  const at = (k: (typeof order)[number]): VoucherStepState => {
    const n = order.indexOf(k);
    if (reached < 0) return undefined;
    return n < reached ? "done" : n === reached ? "current" : undefined;
  };
  const paid = money(s.amount_cents, s.currency ?? "mxn");
  const steps: VoucherStep[] = [
    { key: "paid", Icon: WalletIcon, title: "Pay", amount: paid, state: "done" },
    { key: "credit", Icon: WalletIcon, title: "Credits", amount: paid, state: "done" },
    { key: "post", Icon: Camera, title: "Post Story", sub: "Tag @mesita and the restaurant", state: at("post") },
    { key: "wait", Icon: Clock3, title: `Wait ${waitText(s.wait_sec)}`, sub: "Keep your story up", state: at("wait") },
    { key: "check", Icon: Instagram, title: "Check Story", state: at("check") },
    { key: "bonus", Icon: Gift, title: stage === "lost" ? "Bonus not added" : "Bonus", amount: storyBonus(s), state: at("bonus") },
  ];
  return <VoucherSteps steps={steps} />;
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

/** The bot's word on the guest's newest story (MESITA-4549): the panel's
 *  title and one line; null while nothing was posted since paying. */
function storyCheckLines(
  c: StoryCheck | null,
  handle: string | null | undefined,
): { title: string; line: string; tone: "info" | "warn" } | null {
  if (!c) return null;
  const tag = handle ? `@${handle}` : "the restaurant";
  if (c.state === "checking") return { title: "Checking your story", line: "About 10 minutes. You can close the app.", tone: "info" };
  if (c.state === "checking_long") return { title: "Checking your story", line: "We decide within 2 days.", tone: "info" };
  if (c.reason === "video") {
    return { title: "We can't read video stories yet", line: `Post a photo story tagging @mesita and ${tag}. Your voucher is still open.`, tone: "warn" };
  }
  if (c.reason === "not_a_story") {
    return { title: "That doesn't look like a story", line: `Post a new story tagging @mesita and ${tag}. Your voucher is still open.`, tone: "warn" };
  }
  return { title: `We couldn't see ${tag}`, line: "Post a new story with the tag visible. Your voucher is still open.", tone: "warn" };
}

/** What the guest does now, by state. */
function NowPanel({ s, now }: { s: StoryTicket; now: number }) {
  const handle = s.place_handle;
  if (s.state === "waiting_post") {
    const check = storyCheckLines(s.ai_check ?? null, handle);
    return (
      <Panel title={check?.title ?? "Post your story"} data-story-now="post" data-story-check={s.ai_check?.state ?? "none"}>
        <div className="flex flex-col gap-3 px-4 pt-2 pb-4">
          {check?.line ? (
            <p
              className={cn("rounded-xl p-3 text-sm leading-snug font-semibold", check.tone === "warn" ? "bg-amber-50 text-amber-800" : "bg-muted text-foreground")}
              role="status"
            >
              {check.line}
            </p>
          ) : null}
          <p className="text-sm leading-snug">
            {handle
              ? `Tag @mesita and @${handle}, or add the restaurant's location. Keep the tags readable.`
              : "Tag @mesita and the restaurant, or add its location. Keep the tags readable."}
          </p>
          <span>
            <CopyChip text={handle ? `@mesita @${handle}` : "@mesita"} />
          </span>
          <button type="button" onClick={openInstagram} className={FILLED} data-story-instagram>
            <Instagram className="h-5 w-5" aria-hidden />
            Open Instagram
          </button>
          <p className="text-muted-foreground text-center text-sm" aria-live="polite">
            A bot checks the tags in the background. We keep the image 3 days.
          </p>
        </div>
      </Panel>
    );
  }
  if (s.state === "found") {
    return (
      <Panel title="Story found" data-story-now="found">
        <div className="flex flex-col gap-3 px-4 pt-2 pb-4">
          <StoryCard s={s} />
          <p className="text-sm leading-snug">Buy the Story voucher at {s.place_name ?? s.place?.name ?? "this restaurant"} and this story counts.</p>
        </div>
      </Panel>
    );
  }
  if (s.state === "approved") {
    return (
      <Panel title="Keep it up" data-story-now="approved">
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
 *  for the account and for publish and delete. Never the primary button. */
function TestBand({ s, onChanged }: { s: StoryTicket; onChanged: () => void }) {
  const getSupabase = useLazyBrowserSupabase();
  const [busy, setBusy] = useState<string | null>(null);
  if (!s.emulator) return null;
  const run = async (action: "connect" | "post" | "post_untagged" | "post_video" | "delete") => {
    setBusy(action);
    try {
      await apiEmulateStory(getSupabase(), action, action.startsWith("post") ? s.place_id : undefined);
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
        <>
          <button type="button" disabled={busy !== null} onClick={() => void run("connect")} className={QUIET} data-story-simulate="connect">
            {busy === "connect" ? "Connecting…" : "Connect a public test Instagram"}
          </button>
          <button type="button" disabled={busy !== null} onClick={() => void run("post")} className={QUIET} data-story-simulate="post">
            {busy === "post" ? "Publishing…" : handle ? `Publish a story tagging @mesita and @${handle}` : "Publish a test story"}
          </button>
          {/* MESITA-4549: the bot's rejections, so every state shows on a preview. */}
          <button type="button" disabled={busy !== null} onClick={() => void run("post_untagged")} className={QUIET} data-story-simulate="post_untagged">
            {busy === "post_untagged" ? "Publishing…" : "Publish a story without the restaurant tag"}
          </button>
          <button type="button" disabled={busy !== null} onClick={() => void run("post_video")} className={QUIET} data-story-simulate="post_video">
            {busy === "post_video" ? "Publishing…" : "Publish a video story"}
          </button>
        </>
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
        const stayOnVoucher = byPurchase && (!read.story?.story_id || read.story.state === "waiting_post" || read.story.state === "void");
        const story = poll && read.story?.story_id && !stayOnVoucher
          ? await apiPollStory(getSupabase(), read.story.story_id)
          : await apiGetStory(getSupabase(), byPurchase || stayOnVoucher ? { purchase_id: read.story?.purchase_id || id } : { story_id: id });
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
            action={read.error === "missing" ? { label: "Back to Vouchers", href: ticketsHref("vouchers") } : { label: "Try again", onClick: () => refresh(false) }}
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
          {s.mention?.mentioned_at ? <TicketLine label="Posted" value={storyClock(s.mention.mentioned_at, zone, now)} /> : null}
          {s.bonus_at ? <TicketLine label="Bonus if it stays up" value={storyClock(s.bonus_at, zone, now)} /> : null}
          {s.decided_at ? <TicketLine label={s.state === "released" ? "Bonus added" : "Ended"} value={storyClock(s.decided_at, zone, now)} /> : null}
        </TicketPanel>
      </TicketPage>
    );
  })();

  return <MeScreen title="Story">{body}</MeScreen>;
}
