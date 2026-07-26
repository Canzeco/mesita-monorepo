"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { ArrowUpRight } from "lucide-react";
import { ErrorNote, SaveRow, SectionCard } from "../enricher-config/atlas-ui";
import { getModelsConfig, updateModelsConfig } from "./actions";
import {
  DEFAULT_MODELS_CONFIG,
  OPENAI_CHAT_MODELS,
  SUBSYSTEMS,
  type ModelsConfig,
  type ModelStatus,
} from "./types";

// Models Config — a MAP of which model each subsystem uses, not a parallel
// control panel. Only the Supabase Edge Functions general default is edited
// here; every other row is read-only and links to the page that actually owns
// the model (Enricher Config, Memo Config), because those knobs already exist,
// are richer, and — for the Enricher — run live. STAGED: the one editable knob
// persists to app_settings.models_config but no EF reads it yet.

const STATUS_STYLE: Record<ModelStatus, { label: string; className: string }> = {
  live: {
    label: "Live",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  staged: {
    label: "Staged",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  locked: {
    label: "Locked",
    className: "border-border bg-muted text-muted-foreground",
  },
};

function StatusBadge({ status }: { status: ModelStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className={
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium " +
        s.className
      }
    >
      {s.label}
    </span>
  );
}

function Select({
  value,
  options,
  disabled,
  onChange,
}: {
  value: string;
  options: readonly string[];
  disabled?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="border-border bg-card focus:border-foreground h-9 w-full rounded-lg border px-2 text-sm font-medium outline-none disabled:opacity-50"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function OwnerLink({ label, href }: { label: string; href: string }) {
  return (
    <Link
      href={href}
      className="text-secondary hover:text-secondary/80 mt-3 inline-flex items-center gap-1 text-sm font-medium hover:underline"
    >
      Configured on {label}
      <ArrowUpRight className="h-3.5 w-3.5" />
    </Link>
  );
}

export function ModelsConfigClient() {
  const [cfg, setCfg] = useState<ModelsConfig>(DEFAULT_MODELS_CONFIG);
  const [saved, setSaved] = useState<ModelsConfig>(DEFAULT_MODELS_CONFIG);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load the persisted blob on mount so the editable default reflects the saved
  // value. On failure we keep DEFAULTS and a Save surfaces the real error.
  useEffect(() => {
    let active = true;
    (async () => {
      const r = await getModelsConfig();
      if (!active) return;
      if (r.ok) {
        setCfg(r.data);
        setSaved(r.data);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const busy = pending || loading;
  // Only the Supabase general default is editable here.
  const dirty = cfg.supabase.model !== saved.supabase.model;

  const setSupabaseModel = (model: string) => {
    setOk(false);
    setCfg((c) => ({ ...c, supabase: { model } }));
  };

  const save = () => {
    setError(null);
    startTransition(async () => {
      const r = await updateModelsConfig(cfg);
      if (r.ok) {
        setSaved(r.data);
        setCfg(r.data);
        setOk(true);
      } else {
        setError(r.error);
      }
    });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Ownership note — why most rows are read-only. */}
      <div className="border-border bg-muted/40 rounded-2xl border p-4 sm:p-5">
        <p className="text-sm leading-relaxed">
          <span className="text-foreground font-medium">
            This is a map, not a second control panel.
          </span>{" "}
          <span className="text-muted-foreground">
            Most subsystems already pick their model on their own page, and those
            knobs are richer and (for the Enricher) live. Only the Supabase
            general default is editable here; editing it never overrides a live
            per-page setting.
          </span>
        </p>
        <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
          <span className="inline-flex items-center gap-1.5">
            <StatusBadge status="live" /> read at runtime
          </span>
          <span className="inline-flex items-center gap-1.5">
            <StatusBadge status="staged" /> saved, not read yet
          </span>
          <span className="inline-flex items-center gap-1.5">
            <StatusBadge status="locked" /> fixed by design
          </span>
        </div>
      </div>

      {SUBSYSTEMS.map((meta) => (
        <SectionCard
          key={meta.key}
          icon={<meta.Icon className="text-secondary h-4 w-4" />}
          title={meta.label}
          subtitle={meta.detail}
          status={<StatusBadge status={meta.status} />}
        >
          {meta.editableHere ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="border-border bg-background flex flex-col gap-2 rounded-xl border p-4">
                <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  OpenAI model (general default)
                </span>
                <Select
                  value={cfg.supabase.model}
                  options={OPENAI_CHAT_MODELS}
                  disabled={busy}
                  onChange={setSupabaseModel}
                />
              </label>
            </div>
          ) : meta.owner ? (
            <OwnerLink label={meta.owner.label} href={meta.owner.href} />
          ) : null}
        </SectionCard>
      ))}

      <SaveRow pending={pending} dirty={dirty} ok={ok} onClick={save} />
      {error && <ErrorNote message={error} />}
    </div>
  );
}
