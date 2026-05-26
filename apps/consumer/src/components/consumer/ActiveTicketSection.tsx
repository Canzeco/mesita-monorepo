"use client";

import { useMemo, useState } from "react";
import {
  Check,
  Wallet,
  Instagram,
  AlertTriangle,
  Loader2,
  Upload,
  Calendar,
} from "lucide-react";
import { cn, errMsg } from "@/lib/utils";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  apiSubmitStory,
  formatCurrency,
  ticketHasReservation,
  ticketIsFormal,
  ticketRequiresStory,
  workflowSteps,
  type ConsumerTicket,
  type WorkflowStep,
} from "@/lib/api/tickets";

export function ActiveTicketSection({
  tickets,
}: {
  tickets: ConsumerTicket[];
}) {
  // The "active" ticket is the most recent non-terminal one. It surfaces
  // its step timeline at the top of the page so the consumer sees exactly
  // where the flow is. If everything is terminal, we don't pin one.
  const activeTicket = useMemo(() => {
    return (
      tickets.find(
        (t) =>
          t.status === "pending_pay" ||
          t.status === "awaiting_story" ||
          t.status === "revealed" ||
          (t.status === "paid" &&
            ticketRequiresStory(t.kind) &&
            (t.story_status === "pending" ||
              t.story_status === "submitted" ||
              t.story_status === "ai_rejected")),
      ) ?? null
    );
  }, [tickets]);

  if (!activeTicket) return null;
  return <ActiveTicketCard ticket={activeTicket} />;
}

function ActiveTicketCard({ ticket }: { ticket: ConsumerTicket }) {
  const steps = useMemo(() => workflowSteps(ticket), [ticket]);
  const isFormal = ticketIsFormal(ticket.kind);
  const requiresStory = ticketRequiresStory(ticket.kind);
  const hasReservation = ticketHasReservation(ticket.kind);
  const venue = ticket.venue;

  // The story upload affordance shows when:
  //   - the kind requires a story
  //   - the story isn't already verified
  //   - the story isn't terminally rejected
  const showStoryUpload =
    requiresStory &&
    ticket.story_status !== "ai_verified" &&
    ticket.story_status !== "waiter_verified" &&
    ticket.story_status !== "waiter_rejected";

  return (
    <section className="border-border bg-card rounded-2xl border">
      <header className="border-border flex items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <p className="text-secondary text-[10px] font-bold tracking-wider uppercase">
            Active ticket
          </p>
          <h3 className="font-display mt-0.5 truncate text-base font-semibold tracking-tight">
            {venue?.name ?? "Venue"}
          </h3>
          <p className="text-muted-foreground mt-0.5 text-[11px]">
            {isFormal ? "Cashback flow" : "Discount flow"}
            {hasReservation && " · Reservation"}
            {requiresStory && " · Story required"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {hasReservation && (
            <Calendar className="text-secondary h-3.5 w-3.5" />
          )}
          {requiresStory && (
            <Instagram className="text-secondary h-3.5 w-3.5" />
          )}
        </div>
      </header>

      <ol className="flex flex-col gap-0 px-4 py-3">
        {steps.map((s, i) => (
          <StepItem key={s.id} step={s} isLast={i === steps.length - 1} />
        ))}
      </ol>

      {(ticket.redeem_cents ?? 0) > 0 && (
        <div className="border-border bg-pink-gradient/5 border-t px-4 py-2.5">
          <p className="flex items-center justify-between text-[12px]">
            <span className="text-muted-foreground inline-flex items-center gap-1.5">
              <Wallet className="h-3 w-3" />
              Balance applied to this bill
            </span>
            <span className="font-display text-foreground font-bold tabular-nums">
              −{formatCurrency(ticket.redeem_cents ?? 0)}
            </span>
          </p>
        </div>
      )}

      {showStoryUpload && (
        <div className="border-border border-t px-4 py-3">
          <StoryUpload ticketId={ticket.id} status={ticket.story_status} />
        </div>
      )}

      {!isFormal && ticket.story_status === "waiter_rejected" && (
        <div className="border-border bg-destructive/5 border-t px-4 py-3">
          <p className="text-destructive inline-flex items-start gap-1.5 text-[11px]">
            <AlertTriangle className="mt-0.5 h-3 w-3" />
            Story rejected. The discount was already applied at the bill — this
            is informational only.
          </p>
        </div>
      )}
    </section>
  );
}

function StepItem({ step, isLast }: { step: WorkflowStep; isLast: boolean }) {
  return (
    <li className="relative flex gap-3 pb-4">
      {!isLast && (
        <span
          aria-hidden
          className={cn(
            "absolute top-7 bottom-0 left-3 w-px",
            step.done ? "bg-primary" : "bg-border",
          )}
        />
      )}
      <span
        className={cn(
          "relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
          step.done && "bg-primary text-white",
          step.current && "bg-primary ring-primary/15 text-white ring-4",
          !step.done && !step.current && "bg-muted text-muted-foreground",
        )}
      >
        {step.done ? <Check className="h-3 w-3" strokeWidth={3} /> : ""}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-[13px] leading-tight font-semibold",
            step.done && "text-muted-foreground line-through",
          )}
        >
          {step.title}
        </p>
        <p
          className={cn(
            "text-muted-foreground mt-0.5 text-[11px] leading-snug",
            step.done && "line-through",
          )}
        >
          {step.sub}
        </p>
      </div>
    </li>
  );
}

function StoryUpload({
  ticketId,
  status,
}: {
  ticketId: string;
  status: ConsumerTicket["story_status"];
}) {
  const supabase = useBrowserSupabase();
  const [url, setUrl] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      setError("Paste a public URL to your story screenshot.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      await apiSubmitStory(supabase, { ticketId, screenshotUrl: trimmed });
      setUrl("");
      // The page is a server component above us — refresh to pull the new
      // status. (window.location.reload keeps us in this surface without
      // needing useRouter.)
      window.location.reload();
    } catch (err) {
      setError(errMsg(err, "Couldn't submit story."));
    } finally {
      setPending(false);
    }
  };

  const banner =
    status === "submitted"
      ? "We're checking your story now. Re-upload if you got the wrong one."
      : status === "ai_rejected"
        ? "Our auto-check couldn't see the tag. Re-upload, or the waiter will confirm at the table."
        : "Post your story tagging the venue, then drop the screenshot URL here.";

  return (
    <div className="flex flex-col gap-2">
      <p className="text-secondary inline-flex items-center gap-1.5 text-[11px] font-semibold">
        <Instagram className="h-3 w-3" />
        Story screenshot
      </p>
      <p className="text-muted-foreground text-[11px]">{banner}</p>
      <div className="flex items-stretch gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          type="url"
          inputMode="url"
          autoCapitalize="none"
          spellCheck={false}
          disabled={pending}
          className="border-border bg-background focus:border-foreground/40 h-10 w-full rounded-xl border px-3 text-sm transition outline-none"
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={pending}
          className="bg-pink-gradient inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-3 text-[12px] font-semibold text-white disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          Submit
        </button>
      </div>
      {error && (
        <p className="bg-destructive/10 text-destructive rounded-lg px-2 py-1 text-[11px]">
          {error}
        </p>
      )}
    </div>
  );
}
