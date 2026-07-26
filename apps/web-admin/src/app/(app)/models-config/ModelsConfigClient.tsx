"use client";

import { useEffect, useState, useTransition } from "react";
import { ErrorNote, SaveRow, SectionCard } from "../enricher-config/atlas-ui";
import { getModelsConfig, updateModelsConfig } from "./actions";
import {
  DEFAULT_MODELS_CONFIG,
  modelsFor,
  PROVIDER_LABEL,
  SUBSYSTEMS,
  type ModelProvider,
  type ModelsConfig,
  type SubsystemMeta,
} from "./types";

// Models Config surface — one card per subsystem, each a provider + model
// picker. DEFAULTS are the pre-load placeholder; on mount the page loads the
// persisted blob from admin-web-get-models-config (app_settings.models_config).
// STAGED: saving persists the blob but the subsystems don't read it yet.

function Select<T extends string>({
  value,
  options,
  disabled,
  onChange,
  labelFor,
}: {
  value: T;
  options: readonly T[];
  disabled?: boolean;
  onChange: (v: T) => void;
  labelFor?: (v: T) => string;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as T)}
      className="border-border bg-card focus:border-foreground h-9 w-full rounded-lg border px-2 text-sm font-medium outline-none disabled:opacity-50"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {labelFor ? labelFor(o) : o}
        </option>
      ))}
    </select>
  );
}

function Field({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="border-border bg-background flex flex-col gap-2 rounded-xl border p-4">
      <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}

export function ModelsConfigClient() {
  const [cfg, setCfg] = useState<ModelsConfig>(DEFAULT_MODELS_CONFIG);
  const [saved, setSaved] = useState<ModelsConfig>(DEFAULT_MODELS_CONFIG);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load the persisted blob on mount so the page shows the live values, not
  // just DEFAULTS. On failure we keep DEFAULTS and let a Save surface the real
  // error — the page stays usable either way (mirrors Memo Config).
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
  const dirty = JSON.stringify(cfg) !== JSON.stringify(saved);

  const setProvider = (meta: SubsystemMeta, provider: ModelProvider) => {
    setOk(false);
    setCfg((c) => {
      const opts = modelsFor(provider, meta.kind);
      const cur = c[meta.key].model;
      const model = opts.includes(cur) ? cur : opts[0];
      return { ...c, [meta.key]: { provider, model } } as ModelsConfig;
    });
  };

  const setModel = (meta: SubsystemMeta, model: string) => {
    setOk(false);
    setCfg((c) =>
      ({
        ...c,
        [meta.key]: { provider: c[meta.key].provider, model },
      }) as ModelsConfig,
    );
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
      {SUBSYSTEMS.map((meta) => {
        const entry = cfg[meta.key];
        const modelOptions = modelsFor(entry.provider, meta.kind);
        const singleProvider = meta.providers.length < 2;
        return (
          <SectionCard
            key={meta.key}
            icon={<meta.Icon className="text-secondary h-4 w-4" />}
            title={meta.label}
            subtitle={meta.subtitle}
          >
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Provider">
                <Select
                  value={entry.provider}
                  options={meta.providers}
                  disabled={busy || singleProvider}
                  onChange={(v) => setProvider(meta, v)}
                  labelFor={(v) => PROVIDER_LABEL[v]}
                />
              </Field>
              <Field
                label={meta.kind === "embedding" ? "Embedding model" : "Model"}
              >
                <Select
                  value={entry.model}
                  options={modelOptions}
                  disabled={busy}
                  onChange={(v) => setModel(meta, v)}
                />
              </Field>
            </div>
          </SectionCard>
        );
      })}

      <SaveRow pending={pending} dirty={dirty} ok={ok} onClick={save} />
      {error && <ErrorNote message={error} />}
    </div>
  );
}
