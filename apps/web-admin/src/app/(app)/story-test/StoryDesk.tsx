"use client";

import { useState } from "react";
import { Button, Chip, Notice, SectionCard, TextField } from "@/components/admin-ui";
import { aiDeskAction, type DeskCounters, listStoryDesk, overrideStory, type MentionRow, type StoryDeskRow } from "./actions";

/** Settle a Story and see the recent mentions (MESITA-4267). Lives on Extra › Story.
 *  MESITA-4549: the AI bot's desk. Each story shows what the bot decided; the
 *  ones it could not decide list first, with Attach / Reject per place the
 *  guest holds a voucher at, Re-check, and a countdown to the desk limit. */
const DESK_HOURS = 48;

const OUTCOME_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  matched: "success",
  rejected: "danger",
  ambiguous: "warning",
  unreadable: "warning",
};

/** When the desk limit decides an unread or unclear story by itself. */
function decidesAt(checkedAt: string | null | undefined): string | null {
  if (!checkedAt) return null;
  return new Date(Date.parse(checkedAt) + DESK_HOURS * 3600_000).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

export function StoryDesk() {
  const [purchaseId, setPurchaseId] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stories, setStories] = useState<StoryDeskRow[] | null>(null);
  const [mentions, setMentions] = useState<MentionRow[] | null>(null);
  const [counters, setCounters] = useState<DeskCounters | null>(null);
  const [shadowOnly, setShadowOnly] = useState(false);

  const load = async () => {
    setBusy(true);
    setError(null);
    const r = await listStoryDesk();
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setStories(r.stories);
    setMentions(r.mentions);
    setCounters(r.counters);
  };
  const act = async (action: "release" | "void" | "recheck_now") => {
    setBusy(true);
    setError(null);
    setNote(null);
    const r = await overrideStory(purchaseId.trim(), action);
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setNote(r.outcome);
    await load();
  };
  const ai = async (m: MentionRow, action: "ai_attach" | "ai_reject" | "ai_recheck" | "ai_reviewed", placeId?: string) => {
    setBusy(true);
    setError(null);
    setNote(null);
    const r = await aiDeskAction(m.id, action, placeId);
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setNote(r.outcome);
    await load();
  };

  const shown = (mentions ?? []).filter((m) => !shadowOnly || (m.livemode && m.ai_outcome && !m.ai_reviewed_at));

  return (
    <SectionCard title="Settle a Story" subtitle="What the AI bot decided, the stories it could not decide, and the manual settle.">
      <div className="mt-4 flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <Button tone="ghost" disabled={busy} onClick={() => void load()}>Load recent</Button>
          {mentions ? (
            <Button tone="ghost" disabled={busy} onClick={() => setShadowOnly((v) => !v)}>
              {shadowOnly ? "Show all" : "Live, not yet reviewed"}
            </Button>
          ) : null}
        </div>
        {counters ? (
          <div className="flex flex-wrap gap-2" aria-label="Last 24 hours">
            <Chip tone="success">{`Verified ${counters.verified}`}</Chip>
            <Chip tone="danger">{`Rejected ${counters.rejected}`}</Chip>
            <Chip tone="warning">{`Unread ${counters.unreadable}`}</Chip>
            <Chip tone="warning">{`Unclear ${counters.ambiguous}`}</Chip>
            <Chip tone="neutral">{`Waiting for the bonus check ${counters.held}`}</Chip>
          </div>
        ) : null}
        {error ? <Notice tone="error">{error}</Notice> : null}
        {note ? <Notice tone="success">{note}</Notice> : null}

        {mentions ? (
          <ul className="divide-border flex flex-col divide-y">
            {shown.map((m) => {
              const desk = m.ai_outcome === "unreadable" || m.ai_outcome === "ambiguous";
              const at = desk ? decidesAt(m.ai_checked_at) : null;
              return (
                <li key={m.id} className="flex gap-3 py-3">
                  <span className="bg-muted text-muted-foreground flex h-20 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg type-meta">
                    {m.thumb_url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- a 10-minute signed URL
                      <img src={m.thumb_url} alt="" className="h-full w-full object-cover" />
                    ) : m.media === "video" ? "Video" : m.media === "purged" ? "Deleted" : "—"}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Chip tone={OUTCOME_TONE[m.ai_outcome ?? ""] ?? "neutral"}>{m.ai_outcome ?? (m.source === "meta" ? "in queue" : (m.source ?? "mention"))}</Chip>
                      <span className="type-meta">{m.ig_handle ? `@${m.ig_handle}` : "no handle yet"}</span>
                      <span className="type-meta text-muted-foreground">{m.mentioned_at ?? ""}{m.livemode ? "" : " · test"}{m.deleted_at ? " · deleted" : ""}</span>
                    </div>
                    {m.ai_reason || m.ai_last_error ? (
                      <span className="type-meta text-muted-foreground">
                        {[m.ai_reason, m.ai_last_error ? `last error: ${m.ai_last_error}` : null, m.ai_model, m.ai_tries ? `${m.ai_tries} tries` : null].filter(Boolean).join(" · ")}
                      </span>
                    ) : null}
                    {at ? <span className="type-meta">{`Decides itself ${at}`}</span> : null}
                    <div className="flex flex-wrap gap-2">
                      {desk
                        ? (m.candidates ?? []).map((c) => (
                          <Button key={c.place_id} disabled={busy} onClick={() => void ai(m, "ai_attach", c.place_id)}>
                            {`Attach to ${c.name ?? (c.handle ? `@${c.handle}` : "place")}`}
                          </Button>
                        ))
                        : null}
                      {desk ? <Button tone="danger" disabled={busy} onClick={() => void ai(m, "ai_reject")}>Reject</Button> : null}
                      {m.ai_outcome && m.ai_outcome !== "matched" ? (
                        <Button tone="secondary" disabled={busy} onClick={() => void ai(m, "ai_recheck")}>Re-check</Button>
                      ) : null}
                      {m.livemode && m.ai_outcome && !m.ai_reviewed_at ? (
                        <Button tone="ghost" disabled={busy} onClick={() => void ai(m, "ai_reviewed")}>Mark reviewed</Button>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
            {shown.length === 0 ? <li className="type-meta text-muted-foreground py-3">No stories.</li> : null}
          </ul>
        ) : null}

        <TextField label="Purchase id" value={purchaseId} onChange={setPurchaseId} />
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy || purchaseId.trim() === ""} onClick={() => void act("release")}>Release bonus</Button>
          <Button tone="danger" disabled={busy || purchaseId.trim() === ""} onClick={() => void act("void")}>Void bonus</Button>
          <Button tone="secondary" disabled={busy || purchaseId.trim() === ""} onClick={() => void act("recheck_now")}>Recheck now</Button>
        </div>
        {stories ? (
          <ul className="type-meta flex flex-col gap-1">
            {stories.map((s) => (
              <li key={s.id} className="flex flex-wrap items-baseline gap-2">
                <Button tone="ghost" onClick={() => setPurchaseId(s.purchase_id)}>{s.state}</Button>
                <span>{s.purchase_id}{s.void_reason ? ` · ${s.void_reason}` : ""}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </SectionCard>
  );
}
