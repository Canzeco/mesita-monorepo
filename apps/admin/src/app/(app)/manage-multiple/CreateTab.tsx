"use client";

import { useMemo, useRef, useState } from "react";
import { CheckCircle2, Loader2, Play, Upload, XCircle } from "lucide-react";
import { createUnitFromPlaceId } from "./actions";

// Google Place IDs are base64url-ish tokens (commonly 27 chars, but length
// varies). Be lenient: accept any [A-Za-z0-9_-] run of 18+ chars. This also
// lets us pull IDs straight out of CSV cells (split on commas/whitespace too).
const PLACE_ID_RE = /^[A-Za-z0-9_-]{18,}$/;
const MAX_IDS = 250;
const CONCURRENCY = 4;

type RowStatus =
  | { status: "pending" }
  | { status: "running" }
  | {
      status: "ok";
      projectId: string;
      name: string;
      slug: string | null;
      photoCount: number;
      enrichmentTriggered: boolean;
    }
  | { status: "error"; error: string };

export function CreateTab() {
  const [text, setText] = useState("");
  const [results, setResults] = useState<Record<string, RowStatus>>({});
  const [running, setRunning] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const placeIds = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const tok of text.split(/[\s,]+/)) {
      const t = tok.trim();
      if (PLACE_ID_RE.test(t) && !seen.has(t)) {
        seen.add(t);
        out.push(t);
        if (out.length >= MAX_IDS) break;
      }
    }
    return out;
  }, [text]);

  const done = placeIds.filter((id) => {
    const s = results[id]?.status;
    return s === "ok" || s === "error";
  }).length;
  const created = placeIds.filter((id) => results[id]?.status === "ok").length;
  const failed = placeIds.filter((id) => results[id]?.status === "error").length;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    setText((prev) => (prev ? `${prev}\n${content}` : content));
    if (fileRef.current) fileRef.current.value = "";
  }

  async function runAll() {
    if (running || placeIds.length === 0) return;
    setRunning(true);
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
          const r = await createUnitFromPlaceId(id);
          setResults((prev) => ({
            ...prev,
            [id]: r.ok
              ? {
                  status: "ok",
                  projectId: r.projectId,
                  name: r.name,
                  slug: r.slug,
                  photoCount: r.photoCount,
                  enrichmentTriggered: r.enrichmentTriggered,
                }
              : { status: "error", error: r.error },
          }));
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
    setRunning(false);
  }

  function copyFailed() {
    const ids = placeIds.filter((id) => results[id]?.status === "error");
    void navigator.clipboard.writeText(ids.join("\n"));
  }

  return (
    <div>
      <p className="text-muted-foreground max-w-xl text-sm leading-relaxed">
        Paste Google Place IDs (one per line) or upload a CSV. Each create does
        the Google lookup and catalog listing, then hands off to the Enricher —
        deep ADEA research runs in the background.
        Caps, levels, and photo analysis are configured in{" "}
        <a
          href="/adea-config/configuration"
          className="text-foreground font-medium underline underline-offset-2"
        >
          Enricher Config
        </a>
        .
      </p>

      {/* Input */}
      <div className="border-border bg-card mt-8 rounded-2xl border p-6">
        <label className="text-sm font-medium" htmlFor="place-ids">
          Google Place IDs
        </label>
        <textarea
          id="place-ids"
          value={text}
          disabled={running}
          rows={8}
          placeholder={"ChIJ...\nChIJ...\nChIJ..."}
          onChange={(e) => setText(e.target.value)}
          className="border-border bg-background focus:border-foreground mt-2 w-full rounded-xl border px-3 py-2 font-mono text-xs leading-relaxed outline-none disabled:opacity-50"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={running}
            className="border-border hover:border-foreground/40 inline-flex h-9 items-center gap-2 rounded-full border px-4 text-sm font-medium transition disabled:opacity-50"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload CSV / TXT
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            onChange={onFile}
            className="hidden"
          />
          <span className="text-muted-foreground text-xs">
            {placeIds.length} valid ID{placeIds.length === 1 ? "" : "s"} detected
            {placeIds.length >= MAX_IDS ? ` (capped at ${MAX_IDS})` : ""}
          </span>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={runAll}
            disabled={running || placeIds.length === 0}
            className="bg-foreground text-background inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
          >
            {running ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Creating… {done}/{placeIds.length}
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" />
                Create {placeIds.length} unit{placeIds.length === 1 ? "" : "s"}
              </>
            )}
          </button>
          {done > 0 && (
            <span className="text-muted-foreground text-xs">
              {created} created · {failed} failed
            </span>
          )}
          {failed > 0 && !running && (
            <button
              type="button"
              onClick={copyFailed}
              className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-2"
            >
              Copy failed IDs
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {Object.keys(results).length > 0 && (
        <div className="border-border bg-card mt-6 overflow-hidden rounded-2xl border">
          <ul className="divide-border/60 divide-y">
            {placeIds.map((id) => {
              const r = results[id];
              if (!r) return null;
              return (
                <li key={id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <StatusIcon status={r.status} />
                  <div className="min-w-0 flex-1">
                    {r.status === "ok" ? (
                      <span className="truncate font-medium">{r.name}</span>
                    ) : (
                      <span className="text-muted-foreground font-mono text-xs">
                        {id}
                      </span>
                    )}
                    {r.status === "ok" && (
                      <p className="text-muted-foreground text-[11px]">
                        {r.slug ? `${r.slug} · ` : ""}
                        {r.photoCount} photo{r.photoCount === 1 ? "" : "s"} ·{" "}
                        {r.enrichmentTriggered ? (
                          "enriching…"
                        ) : (
                          <span className="text-destructive font-medium">
                            enrich trigger failed
                          </span>
                        )}
                      </p>
                    )}
                    {r.status === "error" && (
                      <p className="text-destructive text-[11px]">{r.error}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: RowStatus["status"] }) {
  if (status === "ok")
    return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />;
  if (status === "error")
    return <XCircle className="text-destructive h-4 w-4 shrink-0" />;
  if (status === "running")
    return <Loader2 className="text-muted-foreground h-4 w-4 shrink-0 animate-spin" />;
  return (
    <span className="border-border bg-background h-4 w-4 shrink-0 rounded-full border" />
  );
}
