"use client";

import { useState, useTransition } from "react";
import { Bot, Globe, MessageSquare } from "lucide-react";
import {
  ErrorNote,
  SaveRow,
  SectionCard,
  Switch,
  TextAreaField,
} from "../enricher-config/atlas-ui";
import {
  OPENAI_MODELS,
  PERPLEXITY_MODELS,
  updateMemoConfig,
  type MemoConfig,
} from "./actions";

// Memo's config surface — kept deliberately small: the persona prose and the
// models. Values default to what Memo runs with today (see consumer-web-ask-
// memo). Save calls the future admin-web-update-memo-config EF; until that ships
// with the OpenAI rebuild it reports cleanly and nothing is lost.
const DEFAULTS: MemoConfig = {
  greeting:
    "Hola ✨ I'm Memo, your Mesita concierge. Tell me what you're craving — try “rooftop date tonight under $$$” or just “tacos al pastor”.",
  instructions:
    "You are Memo, Mesita's warm, sharp local concierge for dining, nightlife, cafés, and experiences — deep taste for Monterrey, able to help anywhere. Reply in the user's language, plain text, 2–4 sentences, opinionated and specific. Be time-aware: prefer spots open and appropriate for the local hour. When the user is place-seeking, name the real places on the shortlist; for general questions just answer conversationally.",
  provider: "openai",
  openaiModel: "gpt-4o-mini",
  webGrounding: false,
  perplexityModel: "sonar-pro",
};

function Select<T extends string>({
  value,
  options,
  disabled,
  onChange,
}: {
  value: T;
  options: readonly T[];
  disabled?: boolean;
  onChange: (v: T) => void;
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
          {o}
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
      <span className="flex items-center gap-2 text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

export function MemoConfigClient() {
  const [cfg, setCfg] = useState<MemoConfig>(DEFAULTS);
  const [saved, setSaved] = useState<MemoConfig>(DEFAULTS);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const dirty = JSON.stringify(cfg) !== JSON.stringify(saved);
  const set = <K extends keyof MemoConfig>(key: K, value: MemoConfig[K]) => {
    setCfg((c) => ({ ...c, [key]: value }));
    setOk(false);
  };

  const save = () => {
    setError(null);
    startTransition(async () => {
      const r = await updateMemoConfig(cfg);
      if (r.ok) {
        setSaved(r.data);
        setCfg(r.data);
        setOk(true);
      } else {
        setError(
          `${r.error} — the Memo config service ships with the OpenAI rebuild; values here are a preview of the tunable surface.`,
        );
      }
    });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Persona */}
      <SectionCard
        icon={<MessageSquare className="text-secondary h-4 w-4" />}
        title="Persona"
        subtitle="How Memo greets and how it talks — the biggest levers on how the concierge feels."
      >
        <div className="mt-4 grid gap-3">
          <TextAreaField
            label="Greeting"
            value={cfg.greeting}
            disabled={pending}
            onChange={(v) => set("greeting", v)}
          />
          <TextAreaField
            label="Instructions (system prompt)"
            value={cfg.instructions}
            disabled={pending}
            onChange={(v) => set("instructions", v)}
          />
        </div>
      </SectionCard>

      {/* Models */}
      <SectionCard
        icon={<Bot className="text-secondary h-4 w-4" />}
        title="Models"
        subtitle="OpenAI is Memo's brain. Perplexity is an optional web-grounding leg for live color + citations — off by default."
      >
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label={<>OpenAI model (brain)</>}>
            <Select
              value={cfg.openaiModel}
              options={OPENAI_MODELS}
              disabled={pending}
              onChange={(v) => set("openaiModel", v)}
            />
          </Field>
          <Field label={<>Web grounding (Perplexity)</>}>
            <Switch
              on={cfg.webGrounding}
              pending={pending}
              label="Web grounding (Perplexity)"
              onClick={() => set("webGrounding", !cfg.webGrounding)}
            />
          </Field>
          <Field
            label={
              <>
                <Globe className="text-muted-foreground h-4 w-4" />
                Perplexity model
              </>
            }
          >
            <Select
              value={cfg.perplexityModel}
              options={PERPLEXITY_MODELS}
              disabled={pending || !cfg.webGrounding}
              onChange={(v) => set("perplexityModel", v)}
            />
          </Field>
        </div>
      </SectionCard>

      <SaveRow pending={pending} dirty={dirty} ok={ok} onClick={save} />
      {error && <ErrorNote message={error} />}
    </div>
  );
}
