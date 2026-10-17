"use client";

import { createContext, useContext, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { Activity } from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { Button, KnobState, SectionCard } from "@/components/admin-ui/config";
import {
  getDiscoveryConfig,
  previewDiscoverySignal,
  updateDiscoveryConfig,
  type SignalPreviewCurvePoint,
  type SignalPreviewRow,
} from "./actions";
import { DEFAULT_CONFIG, type DiscoveryConfig } from "./catalog";
import type { DiscoveryModeKey } from "./discovery-matrix";
import { modeSignalViews } from "./mode-signals";
import { MembershipList, ProximityCurve, ScoreBars, SignalCard, type SignalCardStatus } from "./SignalCard";

const NAME_DEFAULTS = ["Contramar", "Café Nin", "El Vilsito"];

type Draft = {
  maxKm: number;
  closedFloor: number;
};

type PreviewState = {
  rows: SignalPreviewRow[];
  curve?: SignalPreviewCurvePoint[];
  error: string | null;
  pending: boolean;
};

type SignalContextValue = {
  config: DiscoveryConfig;
  draft: Draft;
  setDraft: (next: Draft) => void;
  dirty: boolean;
  pending: boolean;
  savedOk: boolean;
  loadBlocked: boolean;
  error: string | null;
  save: () => void;
  validation: string | null;
};

const SignalContext = createContext<SignalContextValue | null>(null);

function useSignals(): SignalContextValue {
  const value = useContext(SignalContext);
  if (!value) throw new Error("Mode signals render inside ModeSignalProvider");
  return value;
}

function draftFrom(config: DiscoveryConfig): Draft {
  return {
    maxKm: config.params.proximity.maxKm,
    closedFloor: config.params.timing.closedFloor,
  };
}

function sameDraft(a: Draft, b: Draft): boolean {
  return a.maxKm === b.maxKm && a.closedFloor === b.closedFloor;
}

export function ModeSignalProvider({
  initialConfig,
  loadError,
  children,
}: {
  initialConfig: DiscoveryConfig;
  initialUpdatedAt: string | null;
  loadError: string | null;
  children: ReactNode;
}) {
  const [config, setConfig] = useState(initialConfig);
  const [saved, setSaved] = useState(initialConfig);
  const [draft, setDraft] = useState<Draft>(draftFrom(initialConfig));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(loadError);
  const [loadBlocked, setLoadBlocked] = useState(!!loadError);
  const [savedOk, setSavedOk] = useState(false);
  const dirty = !sameDraft(draft, draftFrom(saved));
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  });

  useEffect(() => {
    let active = true;
    (async () => {
      const r = await getDiscoveryConfig();
      if (!active) return;
      if (!r.ok) {
        setError(r.error);
        setLoadBlocked(true);
        return;
      }
      if (!dirtyRef.current) {
        setConfig(r.config);
        setSaved(r.config);
        setDraft(draftFrom(r.config));
      }
      setError(null);
      setLoadBlocked(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const validation = validate(draft);

  const save = () => {
    if (loadBlocked || validation) return;
    setError(null);
    const next: DiscoveryConfig = {
      ...config,
      params: {
        ...config.params,
        proximity: { ...config.params.proximity, maxKm: draft.maxKm },
        timing: { ...config.params.timing, closedFloor: draft.closedFloor },
      },
    };
    startTransition(async () => {
      const r = await updateDiscoveryConfig(next, ["signals"]);
      if (r.ok) {
        setConfig(r.config);
        setSaved(r.config);
        setDraft(draftFrom(r.config));
        setSavedOk(true);
      } else {
        setError(r.error);
      }
    });
  };

  const value: SignalContextValue = {
    config,
    draft,
    setDraft: (next) => {
      setSavedOk(false);
      setDraft(next);
    },
    dirty,
    pending,
    savedOk,
    loadBlocked,
    error,
    save,
    validation,
  };

  return (
    <SignalContext.Provider value={value}>
      {error ? <ErrorNote message={error} /> : null}
      {children}
    </SignalContext.Provider>
  );
}

function validate(draft: Draft): string | null {
  if (!(draft.maxKm >= 1 && draft.maxKm <= 200)) return "Max km must be between 1 and 200.";
  if (!(draft.closedFloor >= 0 && draft.closedFloor <= 1)) return "Closed floor must be between 0 and 1.";
  return null;
}

export function ModeSignals({ modeKey }: { modeKey: DiscoveryModeKey }) {
  const ctx = useSignals();
  const views = modeSignalViews(modeKey, ctx.config).filter((view) => !view.hidden);
  const inactive = views.filter((view) => !view.active).map((view) => view.label);
  return (
    <SectionCard
      icon={<Activity className="text-primary h-4 w-4" />}
      title="Signals"
      subtitle="Each signal this mode uses. A weight appears only when the mode combines more than one continuous score."
      state={<KnobState kind="enforced" reason="Scored by the live signal functions." />}
    >
      <div className="mt-4 grid gap-3">
        {views.filter((view) => view.active).map((view) => (
          <ActiveSignal key={view.key} view={view} />
        ))}
      </div>
      {inactive.length > 0 ? (
        <p className="text-muted-foreground mt-4 text-sm">Inactive: {inactive.join(", ")}</p>
      ) : null}
    </SectionCard>
  );
}

function ActiveSignal({
  view,
}: {
  view: ReturnType<typeof modeSignalViews>[number];
}) {
  const ctx = useSignals();
  const [preview, setPreview] = useState<PreviewState>({ rows: [], pending: false, error: null });
  const [query, setQuery] = useState("");
  const [names, setNames] = useState(NAME_DEFAULTS);
  const shapeStatus = shapeCardStatus(view.key, ctx);

  useEffect(() => {
    if (view.key !== "name") return;
    void loadPreview(setPreview, { signal: "name", query: "", names: NAME_DEFAULTS });
  }, [view.key]);

  useEffect(() => {
    if (view.key !== "proximity") return;
    const maxKm = ctx.draft.maxKm;
    void loadPreview(setPreview, {
      signal: "proximity",
      maxKm,
      samplesKm: [0, 1, maxKm / 2, maxKm, maxKm + 10],
    });
  }, [view.key, ctx.draft.maxKm]);

  useEffect(() => {
    if (view.key !== "timing") return;
    void loadPreview(setPreview, { signal: "timing", closedFloor: ctx.draft.closedFloor });
  }, [view.key, ctx.draft.closedFloor]);

  useEffect(() => {
    if (view.key === "category") void loadPreview(setPreview, { signal: "family" });
    if (view.key === "enriched") void loadPreview(setPreview, { signal: "enrichment" });
    if (view.key === "popularity") void loadPreview(setPreview, { signal: "popularity" });
    if (view.key === "randomness") void loadPreview(setPreview, { signal: "randomness" });
  }, [view.key]);

  const backend = preview.error;
  const status: SignalCardStatus = shapeStatus ?? (backend ? "backend-error" : preview.pending ? null : null);

  return (
    <SignalCard
      name={view.label}
      typeLabel={view.typeLabel}
      explanation={view.explanation}
      active
      parameters={
        <div className="flex flex-col gap-1">
          {view.contribution ? <p>{view.contribution}</p> : null}
          {view.weightLabel ? <p>{view.weightLabel}</p> : null}
          {view.key === "proximity" ? <p>Max km {ctx.draft.maxKm}</p> : null}
          {view.key === "timing" ? <p>Closed floor {ctx.draft.closedFloor}</p> : null}
        </div>
      }
      controls={
        view.key === "name" ? (
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
        ) : view.key === "proximity" || view.key === "timing" ? (
          <ShapeControl signal={view.key} />
        ) : null
      }
      status={status}
      statusDetail={shapeStatus === "validation-error" ? ctx.validation : backend}
      onReset={
        view.key === "proximity"
          ? () => ctx.setDraft({ ...ctx.draft, maxKm: DEFAULT_CONFIG.params.proximity.maxKm })
          : view.key === "timing"
          ? () => ctx.setDraft({ ...ctx.draft, closedFloor: DEFAULT_CONFIG.params.timing.closedFloor })
          : undefined
      }
    >
      {view.key === "proximity" && preview.curve ? <ProximityCurve points={preview.curve} /> : null}
      {preview.rows.length > 0 && (view.visual === "relevance" || view.visual === "score" || view.visual === "explore")
        ? <ScoreBars rows={preview.rows} ordered={view.visual !== "explore"} />
        : null}
      {preview.rows.length > 0 && (view.visual === "filter" || view.visual === "gate")
        ? <MembershipList rows={preview.rows} />
        : null}
    </SignalCard>
  );
}

function shapeCardStatus(key: string, ctx: SignalContextValue): SignalCardStatus {
  if (key !== "proximity" && key !== "timing") return null;
  if (ctx.validation) return "validation-error";
  if (ctx.pending) return "saving";
  if (ctx.error) return "backend-error";
  const fieldDirty = key === "proximity"
    ? ctx.draft.maxKm !== ctx.config.params.proximity.maxKm
    : ctx.draft.closedFloor !== ctx.config.params.timing.closedFloor;
  if (fieldDirty) return "unsaved";
  if (ctx.savedOk) return "saved";
  return null;
}

function ShapeControl({ signal }: { signal: "proximity" | "timing" }) {
  const ctx = useSignals();
  const value = signal === "proximity" ? ctx.draft.maxKm : ctx.draft.closedFloor;
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{signal === "proximity" ? "Max km" : "Closed floor"}</span>
        <input
          type="number"
          min={signal === "proximity" ? 1 : 0}
          max={signal === "proximity" ? 200 : 1}
          step={signal === "proximity" ? 0.5 : 0.05}
          value={value}
          disabled={ctx.loadBlocked || ctx.pending}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (!Number.isFinite(next)) return;
            ctx.setDraft(
              signal === "proximity"
                ? { ...ctx.draft, maxKm: next }
                : { ...ctx.draft, closedFloor: next },
            );
          }}
          className="border-border bg-card h-9 w-28 rounded-lg border px-3 text-right text-sm tabular-nums outline-none"
        />
      </label>
      <Button onClick={ctx.save} pending={ctx.pending} disabled={!ctx.dirty || !!ctx.validation || ctx.loadBlocked}>
        {ctx.pending ? "Saving…" : "Save"}
      </Button>
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
    <div className="flex flex-col gap-3">
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
