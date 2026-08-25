"use client";

import { useMemo, useState } from "react";
import { Loader2, Play } from "lucide-react";
import { createPlaceFromGooglePlaceId } from "@/lib/create-place-from-google-place";
import {
  enrichPlace,
  searchPlacesByGoogleIds,
} from "../manage-single/actions";
import { parseGooglePlaceIds } from "./google-place-ids";
import { IdListField } from "./IdListField";
import { StatusIcon, type BatchRowStatus } from "./StatusIcon";

const CONCURRENCY = 4;

type IntakeAction = "create" | "enrich" | "create_enrich";

type Row = {
  status: BatchRowStatus;
  name?: string;
  detail?: string;
  error?: string;
};

async function resolveMesitaId(googleId: string): Promise<
  { ok: true; projectId: string; name: string } | { ok: false; error: string }
> {
  const r = await searchPlacesByGoogleIds([googleId]);
  if (!r.ok) return { ok: false, error: r.error };
  const hit = r.data.find((p) => p.google_place_id === googleId) ?? r.data[0];
  if (!hit) return { ok: false, error: "Not on Mesita" };
  return { ok: true, projectId: hit.id, name: hit.google_name || hit.name };
}

export function IntakeTab({
  text,
  onTextChange,
}: {
  text: string;
  onTextChange: (next: string) => void;
}) {
  const placeIds = useMemo(() => parseGooglePlaceIds(text), [text]);
  const [results, setResults] = useState<Record<string, Row>>({});
  const [running, setRunning] = useState<IntakeAction | null>(null);

  const done = placeIds.filter((id) => {
    const s = results[id]?.status;
    return s === "ok" || s === "existed" || s === "enriching" || s === "error";
  }).length;
  const created = placeIds.filter((id) => results[id]?.status === "ok").length;
  const existed = placeIds.filter((id) => results[id]?.status === "existed").length;
  const enriching = placeIds.filter((id) => results[id]?.status === "enriching").length;
  const failed = placeIds.filter((id) => results[id]?.status === "error").length;

  async function run(action: IntakeAction) {
    if (running || placeIds.length === 0) return;
    setRunning(action);
    setResults(
      Object.fromEntries(placeIds.map((id) => [id, { status: "pending" as const }])),
    );
    const ids = [...placeIds];
    let cursor = 0;
    const worker = async () => {
      while (cursor < ids.length) {
        const id = ids[cursor++];
        setResults((prev) => ({ ...prev, [id]: { status: "running" } }));
        try {
          const row = await runOne(id, action);
          setResults((prev) => ({ ...prev, [id]: row }));
        } catch (err) {
          setResults((prev) => ({
            ...prev,
            [id]: {
              status: "error",
              error: err instanceof Error ? err.message : "Unexpected error",
            },
          }));
        }
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, ids.length) }, worker),
    );
    setRunning(null);
  }

  function copyFailed() {
    const ids = placeIds.filter((id) => results[id]?.status === "error");
    void navigator.clipboard.writeText(ids.join("\n"));
  }

  return (
    <div>
      <p className="text-muted-foreground max-w-xl text-sm leading-relaxed">
        Google Place IDs only. Create, Enrich, or both — one shared Intake
        config (caps, levels, photo analysis stay on Intake; spend stays
        there). First time is Enrich. Again is Re-enrich from zero — the
        full Intaker 1–10, never a resume. Existing places skip create and
        continue; Create + Enrich still enriches them.
      </p>

      <div className="border-border bg-card mt-6 rounded-2xl border p-6">
        <IdListField
          id="intake-place-ids"
          label="Google Place IDs"
          text={text}
          onTextChange={onTextChange}
          placeIds={placeIds}
          running={running !== null}
        />
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <ActionButton
            label="Create"
            busy={running === "create"}
            disabled={running !== null || placeIds.length === 0}
            onClick={() => void run("create")}
          />
          <ActionButton
            label="Enrich"
            busy={running === "enrich"}
            disabled={running !== null || placeIds.length === 0}
            onClick={() => void run("enrich")}
          />
          <ActionButton
            label="Create + Enrich"
            busy={running === "create_enrich"}
            disabled={running !== null || placeIds.length === 0}
            onClick={() => void run("create_enrich")}
          />
          {done > 0 ? (
            <span className="text-muted-foreground text-xs">
              {created} created · {existed} already on Mesita · {enriching}{" "}
              enriching · {failed} failed
            </span>
          ) : null}
          {failed > 0 && !running ? (
            <button
              type="button"
              onClick={copyFailed}
              className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-2"
            >
              Copy failed IDs
            </button>
          ) : null}
        </div>
      </div>

      {Object.keys(results).length > 0 ? (
        <div className="border-border bg-card mt-6 overflow-hidden rounded-2xl border">
          <ul className="divide-border/60 divide-y">
            {placeIds.map((id) => {
              const r = results[id];
              if (!r) return null;
              return (
                <li key={id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <StatusIcon status={r.status} />
                  <div className="min-w-0 flex-1">
                    {r.name ? (
                      <span className="truncate font-medium">{r.name}</span>
                    ) : (
                      <span className="text-muted-foreground font-mono text-xs">
                        {id}
                      </span>
                    )}
                    {r.detail ? (
                      <p className="text-muted-foreground type-label">{r.detail}</p>
                    ) : null}
                    {r.error ? (
                      <p className="text-destructive type-label">{r.error}</p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function ActionButton({
  label,
  busy,
  disabled,
  onClick,
}: {
  label: string;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="bg-foreground text-background inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold disabled:opacity-50"
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Play className="h-3.5 w-3.5" />
      )}
      {label}
    </button>
  );
}

async function runOne(googleId: string, action: IntakeAction): Promise<Row> {
  if (action === "create") {
    const r = await createPlaceFromGooglePlaceId(googleId);
    if (!r.ok) return { status: "error", error: r.error };
    if (r.alreadyExisted) {
      return {
        status: "existed",
        name: r.name,
        detail: "Already on Mesita — skipped create",
      };
    }
    return {
      status: "ok",
      name: r.name,
      detail: r.enrichmentTriggered ? "Created" : "Created · enrich not queued",
    };
  }

  if (action === "enrich") {
    const found = await resolveMesitaId(googleId);
    if (!found.ok) return { status: "error", error: found.error };
    const en = await enrichPlace(found.projectId, "full");
    if (!en.ok) return { status: "error", name: found.name, error: en.error };
    return {
      status: "enriching",
      name: found.name,
      detail: "Re-enrich from zero — Intaker 1–10 queued",
    };
  }

  const created = await createPlaceFromGooglePlaceId(googleId);
  if (!created.ok) return { status: "error", error: created.error };
  const en = await enrichPlace(created.projectId, "full");
  if (!en.ok) {
    return {
      status: "error",
      name: created.name,
      error: created.alreadyExisted
        ? `Already on Mesita · enrich failed: ${en.error}`
        : `Created · enrich failed: ${en.error}`,
    };
  }
  return {
    status: created.alreadyExisted ? "existed" : "enriching",
    name: created.name,
    detail: created.alreadyExisted
      ? "Already on Mesita — enriching from zero"
      : "Created · enriching from zero",
  };
}
