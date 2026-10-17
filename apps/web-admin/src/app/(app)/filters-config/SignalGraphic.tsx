"use client";

// The curve and the graphic for one signal. This is the Signals subpage.
// A mode never draws it. The score comes from admin-web-preview-signals.

import { useEffect, useState } from "react";
import { Button } from "@/components/admin-ui/config";
import {
  previewDiscoverySignal,
  type SignalPreviewCurvePoint,
  type SignalPreviewRow,
} from "./actions";
import type { SignalKey } from "./catalog";
import { MembershipList, ProximityCurve, ScoreBars } from "./SignalCard";

const NAME_DEFAULTS = ["Contramar", "Café Nin", "El Vilsito"];

type PreviewState = {
  rows: SignalPreviewRow[];
  curve?: SignalPreviewCurvePoint[];
  error: string | null;
  pending: boolean;
};

const PREVIEW_SIGNAL = {
  name: "name",
  proximity: "proximity",
  timing: "timing",
  category: "family",
  popularity: "popularity",
  enriched: "enrichment",
  randomness: "randomness",
} as const;

export function SignalGraphic({
  signal,
  maxKm,
  closedFloor,
}: {
  signal: SignalKey;
  maxKm: number;
  closedFloor: number;
}) {
  const [preview, setPreview] = useState<PreviewState>({ rows: [], pending: false, error: null });
  const [query, setQuery] = useState("");
  const [names, setNames] = useState(NAME_DEFAULTS);

  useEffect(() => {
    if (signal !== "name") return;
    void loadPreview(setPreview, { signal: "name", query: "", names: NAME_DEFAULTS });
  }, [signal]);

  useEffect(() => {
    if (signal !== "proximity") return;
    void loadPreview(setPreview, {
      signal: "proximity",
      maxKm,
      samplesKm: [0, 1, maxKm / 2, maxKm, maxKm + 10],
    });
  }, [signal, maxKm]);

  useEffect(() => {
    if (signal !== "timing") return;
    void loadPreview(setPreview, { signal: "timing", closedFloor });
  }, [signal, closedFloor]);

  useEffect(() => {
    if (signal === "name" || signal === "proximity" || signal === "timing") return;
    void loadPreview(setPreview, { signal: PREVIEW_SIGNAL[signal] });
  }, [signal]);

  return (
    <div>
      {signal === "name" ? (
        <NameControls
          query={query}
          names={names}
          pending={preview.pending}
          onQuery={setQuery}
          onName={(index, value) => {
            setNames((current) => current.map((item, i) => (i === index ? value : item)));
          }}
          onPreview={() => {
            void loadPreview(setPreview, { signal: "name", query, names });
          }}
          onReset={() => {
            setQuery("");
            setNames(NAME_DEFAULTS);
            void loadPreview(setPreview, { signal: "name", query: "", names: NAME_DEFAULTS });
          }}
        />
      ) : null}
      {signal === "proximity" && preview.curve ? <ProximityCurve points={preview.curve} /> : null}
      {preview.rows.length > 0 && (signal === "name" || signal === "proximity" || signal === "popularity" || signal === "randomness")
        ? <ScoreBars rows={preview.rows} ordered={signal !== "randomness"} />
        : null}
      {preview.rows.length > 0 && (signal === "timing" || signal === "category" || signal === "enriched")
        ? <MembershipList rows={preview.rows} />
        : null}
      {preview.error ? (
        <p className="text-destructive mt-3 text-sm" role="alert">{preview.error}</p>
      ) : null}
    </div>
  );
}

function NameControls({
  query,
  names,
  pending,
  onQuery,
  onName,
  onPreview,
  onReset,
}: {
  query: string;
  names: string[];
  pending: boolean;
  onQuery: (value: string) => void;
  onName: (index: number, value: string) => void;
  onPreview: () => void;
  onReset: () => void;
}) {
  return (
    <div className="mt-3 flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Search query</span>
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          className="border-border bg-card h-9 rounded-lg border px-3 text-sm outline-none"
        />
      </label>
      <div className="grid gap-2">
        {names.map((name, index) => (
          <label key={index} className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Place name {index + 1}</span>
            <input
              value={name}
              onChange={(event) => onName(index, event.target.value)}
              className="border-border bg-card h-9 rounded-lg border px-3 text-sm outline-none"
            />
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={onPreview} pending={pending}>
          {pending ? "Scoring…" : "Preview"}
        </Button>
        <Button tone="secondary" onClick={onReset}>
          Reset to defaults
        </Button>
      </div>
    </div>
  );
}

async function loadPreview(
  setPreview: (next: PreviewState) => void,
  body: Parameters<typeof previewDiscoverySignal>[0],
) {
  setPreview({ rows: [], pending: true, error: null });
  const result = await previewDiscoverySignal(body);
  if (!result.ok) {
    setPreview({ rows: [], pending: false, error: result.error });
    return;
  }
  setPreview({ rows: result.rows, curve: result.curve, pending: false, error: null });
}
