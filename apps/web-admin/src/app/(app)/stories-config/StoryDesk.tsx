"use client";

import { useState } from "react";
import { Button, Notice, SectionCard, TextField } from "@/components/admin-ui";
import { listStoryDesk, overrideStory, type MentionRow, type StoryDeskRow } from "./actions";

/** Settle a Story and see the recent mentions (MESITA-4267). */
export function StoryDesk() {
  const [purchaseId, setPurchaseId] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stories, setStories] = useState<StoryDeskRow[] | null>(null);
  const [mentions, setMentions] = useState<MentionRow[] | null>(null);

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

  return (
    <SectionCard title="Settle a Story" subtitle="Release the bonus, void it, or run the re-check now. Recent mentions are below.">
      <div className="mt-4 flex flex-col gap-3">
        <TextField label="Purchase id" value={purchaseId} onChange={setPurchaseId} />
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy || purchaseId.trim() === ""} onClick={() => void act("release")}>Release bonus</Button>
          <Button tone="danger" disabled={busy || purchaseId.trim() === ""} onClick={() => void act("void")}>Void bonus</Button>
          <Button tone="secondary" disabled={busy || purchaseId.trim() === ""} onClick={() => void act("recheck_now")}>Recheck now</Button>
          <Button tone="ghost" disabled={busy} onClick={() => void load()}>Load recent</Button>
        </div>
        {error ? <Notice tone="error">{error}</Notice> : null}
        {note ? <Notice tone="success">{note}</Notice> : null}
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
        {mentions ? (
          <ul className="type-meta text-muted-foreground flex flex-col gap-1">
            {mentions.map((m) => (
              <li key={m.id}>{m.source ?? "mention"} · {m.mentioned_at ?? m.id}{m.deleted_at ? " · deleted" : ""}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </SectionCard>
  );
}
