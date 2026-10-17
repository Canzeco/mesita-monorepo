"use client";

// One signal's graphic, computed (Pato, 2026-10-17: "in signals i want the
// graphic computed"). Fixed example places go through the live signal
// function in admin-web-preview-signals with the numbers on this form, so
// Max km and Closed floor redraw as they change. There are no example
// inputs to type: this is the function's shape, not a simulator.

import { useEffect, useState } from "react";
import {
  previewDiscoverySignal,
  type SignalPreviewCurvePoint,
  type SignalPreviewRequest,
  type SignalPreviewRow,
} from "./actions";
import type { SignalKey } from "./catalog";
import { MembershipList, ProximityCurve, ScoreBars } from "./SignalMarks";

type Preview = {
  rows: SignalPreviewRow[];
  curve?: SignalPreviewCurvePoint[];
  error: string | null;
  pending: boolean;
};

// A shared input changes on every keystroke; wait for the operator to stop.
const REDRAW_MS = 300;
const CURVE_STEPS = 16;

export function proximitySamples(maxKm: number): number[] {
  const end = maxKm + 10;
  return Array.from({ length: CURVE_STEPS + 1 }, (_, i) =>
    Math.round((end * i * 10) / CURVE_STEPS) / 10,
  );
}

export function previewRequest(
  signal: SignalKey,
  maxKm: number,
  closedFloor: number,
): SignalPreviewRequest {
  switch (signal) {
    case "proximity":
      return { signal: "proximity", maxKm, samplesKm: proximitySamples(maxKm) };
    case "timing":
      return { signal: "timing", closedFloor };
    case "name":
      return { signal: "name", query: "Contramar", names: ["Contramar", "Café Nin", "El Vilsito"] };
    case "category":
      return { signal: "family" };
    case "enriched":
      return { signal: "enrichment" };
    case "popularity":
      return { signal: "popularity" };
    case "randomness":
      return { signal: "randomness" };
  }
}

export function SignalGraphic({
  signal,
  maxKm,
  closedFloor,
}: {
  signal: SignalKey;
  maxKm: number;
  closedFloor: number;
}) {
  const [preview, setPreview] = useState<Preview>({ rows: [], pending: true, error: null });
  const body = JSON.stringify(previewRequest(signal, maxKm, closedFloor));

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setPreview((p) => ({ ...p, pending: true, error: null }));
      const r = await previewDiscoverySignal(JSON.parse(body) as SignalPreviewRequest);
      if (!active) return;
      setPreview(
        r.ok
          ? { rows: r.rows, curve: r.curve, pending: false, error: null }
          : { rows: [], pending: false, error: r.error },
      );
    }, REDRAW_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [body]);

  if (preview.error) {
    return (
      <p className="text-destructive text-sm" role="alert">
        {preview.error}
      </p>
    );
  }
  if (preview.rows.length === 0) {
    return <div className="bg-muted h-16 animate-pulse rounded-lg" aria-hidden />;
  }
  return (
    <div className={preview.pending ? "flex flex-col gap-3 opacity-60" : "flex flex-col gap-3"}>
      {signal === "proximity" && preview.curve ? (
        <ProximityCurve points={preview.curve} maxKm={maxKm} />
      ) : null}
      {signal === "name" || signal === "popularity" || signal === "randomness" ? (
        <ScoreBars rows={preview.rows} ordered={signal !== "randomness"} />
      ) : (
        <MembershipList rows={preview.rows} />
      )}
    </div>
  );
}
