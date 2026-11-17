"use client";

// Re-pick families (MESITA-4238): re-runs the careful family prompt on every
// place, five at a time, through admin-web-repick-families. A dry run first
// says what a run would touch; the run then walks the catalog by cursor,
// retries a failed batch once, and can resume after a reload. Writes go
// through the RPC that keeps an undo row per place.

import { useState, useSyncExternalStore } from "react";
import { Button, ConfirmDialog, Notice, SectionCard } from "@/components/admin-ui";
import { repickFamilies, type RepickReply, type RepickRow } from "./actions";

const RESUME_KEY = "mesita.repickFamilies.resume";

type Resume = { runId: string; cursor: string; done: number };

function readResume(): Resume | null {
  try {
    const raw = window.localStorage.getItem(RESUME_KEY);
    const v = raw ? (JSON.parse(raw) as Resume) : null;
    return v && typeof v.runId === "string" && typeof v.cursor === "string" ? v : null;
  } catch {
    return null;
  }
}

function writeResume(v: Resume | null) {
  try {
    if (v) window.localStorage.setItem(RESUME_KEY, JSON.stringify(v));
    else window.localStorage.removeItem(RESUME_KEY);
    window.dispatchEvent(new StorageEvent("storage", { key: RESUME_KEY }));
  } catch {
    // Storage blocked: resume is a convenience, the run itself is unaffected.
  }
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

let lastRaw: string | null = null;
let lastValue: Resume | null = null;
function snapshotResume(): Resume | null {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(RESUME_KEY);
  } catch {
    raw = null;
  }
  if (raw !== lastRaw) {
    lastRaw = raw;
    lastValue = readResume();
  }
  return lastValue;
}

const LABEL: Record<string, string> = {
  to_process: "To re-pick",
  owned: "Skipped: edited by a person",
  generating: "Skipped: Enrich running",
  category_disabled: "Skipped: category not on Mesita",
  written: "Written",
  "kept:unchanged": "Kept: same families",
  "kept:no_usable_reply": "Kept (model gave no usable families)",
  "kept:unknown_slug": "Kept: model named unknown families",
};

function label(key: string): string {
  if (LABEL[key]) return LABEL[key];
  const [outcome, reason] = key.split(":");
  return reason ? `${outcome[0].toUpperCase()}${outcome.slice(1)}: ${reason.replaceAll("_", " ")}` : key;
}

function addCounts(into: Record<string, number>, from: Record<string, number>) {
  for (const [k, n] of Object.entries(from)) into[k] = (into[k] ?? 0) + n;
}

/** Per-family before → after over the written rows. */
function familyDeltas(rows: RepickRow[]): [string, number, number][] {
  const before = new Map<string, number>();
  const after = new Map<string, number>();
  for (const r of rows) {
    if (r.outcome !== "written") continue;
    for (const f of r.before ?? []) before.set(f, (before.get(f) ?? 0) + 1);
    for (const f of r.after ?? []) after.set(f, (after.get(f) ?? 0) + 1);
  }
  const keys = [...new Set([...before.keys(), ...after.keys()])];
  return keys
    .map((k): [string, number, number] => [k, before.get(k) ?? 0, after.get(k) ?? 0])
    .sort((a, b) => (b[1] - b[2]) - (a[1] - a[2]) || a[0].localeCompare(b[0]));
}

export function RepickFamiliesCard() {
  const resume = useSyncExternalStore(subscribe, snapshotResume, () => null);
  const [dry, setDry] = useState<RepickReply | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [rows, setRows] = useState<RepickRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function dryRun() {
    setBusy(true);
    setError(null);
    const r = await repickFamilies({ dryRun: true });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setDry(r.data);
    setConfirming(true);
  }

  async function run(start: Resume | null, total: number | undefined) {
    setConfirming(false);
    setBusy(true);
    setError(null);
    const all: RepickRow[] = [];
    const tally: Record<string, number> = {};
    let cursor = start?.cursor ?? null;
    let runId = start?.runId;
    let done = start?.done ?? 0;
    for (;;) {
      let r = await repickFamilies({ cursor, run_id: runId, batch: 5 });
      if (!r.ok) r = await repickFamilies({ cursor, run_id: runId, batch: 5 });
      if (!r.ok) {
        setError(`Batch at cursor ${cursor ?? "start"} failed twice: ${r.error}. Resume continues from here.`);
        break;
      }
      runId = r.data.run_id;
      all.push(...r.data.rows);
      addCounts(tally, r.data.counts);
      done += r.data.rows.length;
      setRows([...all]);
      setCounts({ ...tally });
      setProgress({ done, total: total ?? done });
      if (r.data.done || !r.data.next_cursor) {
        writeResume(null);
        break;
      }
      cursor = r.data.next_cursor;
      writeResume({ runId, cursor, done });
    }
    setBusy(false);
  }

  async function retryFailed() {
    const ids = rows.filter((r) => r.outcome === "failed").map((r) => r.place_id).slice(0, 50);
    if (!ids.length) return;
    setBusy(true);
    const r = await repickFamilies({ place_ids: ids });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    const retried = new Map(r.data.rows.map((x) => [x.place_id, x]));
    setRows((prev) => prev.map((x) => retried.get(x.place_id) ?? x));
  }

  const failed = rows.filter((r) => r.outcome === "failed");
  const deltas = familyDeltas(rows);
  const toProcess = dry?.counts.to_process ?? 0;

  return (
    <SectionCard
      title="Re-pick families"
      subtitle="Runs the careful family prompt on every place, five at a time. Lists a person edited are never touched; each change keeps an undo row."
    >
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={dryRun} pending={busy && !progress} disabled={busy}>
          Re-pick families
        </Button>
        {resume && !busy ? (
          <Button tone="secondary" onClick={() => run(resume, undefined)}>
            Resume run ({resume.done} done)
          </Button>
        ) : null}
        {failed.length > 0 && !busy ? (
          <Button tone="secondary" onClick={retryFailed}>
            Retry {failed.length} failed
          </Button>
        ) : null}
      </div>

      {error ? <Notice className="mt-3">{error}</Notice> : null}

      {progress ? (
        <p className="text-muted-foreground mt-3 text-sm tabular-nums">
          {progress.done} of {progress.total} places
        </p>
      ) : null}

      {Object.keys(counts).length > 0 ? (
        <ul className="mt-3 divide-y divide-border text-sm">
          {Object.entries(counts).sort().map(([k, n]) => (
            <li key={k} className="flex justify-between py-1.5">
              <span>{label(k)}</span>
              <span className="tabular-nums">{n}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {deltas.length > 0 ? (
        <ul className="mt-3 divide-y divide-border text-sm">
          {deltas.map(([f, b, a]) => (
            <li key={f} className="flex justify-between py-1.5">
              <span>{f}</span>
              <span className="tabular-nums">{b} → {a}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {rows.some((r) => r.reason === "category_disabled") ? (
        <ul className="text-muted-foreground mt-3 text-sm">
          {rows.filter((r) => r.reason === "category_disabled").map((r) => (
            <li key={r.place_id}>{r.name} — {r.main_category ?? "no category"}</li>
          ))}
        </ul>
      ) : null}

      <ConfirmDialog
        open={confirming}
        busy={busy}
        title="Re-pick families"
        body={
          dry ? (
            <div className="space-y-1 text-sm">
              <p>{toProcess} places get a fresh pick, about {toProcess} model calls.</p>
              {Object.entries(dry.counts).filter(([k]) => k !== "to_process").map(([k, n]) => (
                <p key={k} className="text-muted-foreground">{label(k)}: {n}</p>
              ))}
              {(dry.counts.generating ?? 0) > 0 ? (
                <p>Wait until no Enrich is running, then try again.</p>
              ) : null}
            </div>
          ) : null
        }
        confirmLabel="Re-pick"
        onConfirm={() => {
          if ((dry?.counts.generating ?? 0) > 0) return setConfirming(false);
          return run(null, dry?.total);
        }}
        onCancel={() => setConfirming(false)}
      />
    </SectionCard>
  );
}
