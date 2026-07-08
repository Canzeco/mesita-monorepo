"use client";

import { useState, useTransition } from "react";
import { Bot, Hash, MapPin, MessageSquare, Ruler, Thermometer } from "lucide-react";
import {
  ErrorNote,
  NumberField,
  SaveRow,
  SectionCard,
  Switch,
  TextAreaField,
} from "../atlas-config/atlas-ui";
import { updateMemoConfig, type MemoConfig } from "./actions";

// Memo's config surface. Values default to what Memo runs with today (see
// consumer-web-ask-memo). Editing is live-local; Save calls the future
// admin-web-update-memo-config EF — until that ships with the OpenAI rebuild,
// Save reports the service isn't deployed yet and nothing is lost.
const DEFAULTS: MemoConfig = {
  greeting:
    "Hola ✨ I'm Memo, your Mesita concierge. Tell me what you're craving — try “rooftop date tonight under $$$” or just “tacos al pastor”.",
  instructions:
    "You are Memo, Mesita's warm, sharp local concierge for dining, nightlife, cafés, and experiences — deep taste for Monterrey, able to help anywhere. Reply in the user's language, plain text, 2–4 sentences, opinionated and specific. Be time-aware: prefer spots open and appropriate for the local hour. When the user is place-seeking, name the real places on the shortlist; for general questions just answer conversationally.",
  provider: "openai",
  modelTier: "mini",
  temperature: 0.3,
  maxTokens: 700,
  maxCards: 3,
  radiusM: 8000,
  preferMesita: true,
  demoteClosed: true,
};

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex w-full gap-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`h-8 flex-1 rounded-lg border px-2 text-xs font-semibold transition ${
            value === o.value
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-card hover:border-foreground/40"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
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
      <div className="border-border bg-muted/40 text-muted-foreground rounded-xl border p-3 text-xs leading-relaxed">
        Preview of Memo&apos;s config surface. Fields default to what Memo runs
        with today. Persistence + live effect activate when the OpenAI rebuild of{" "}
        <code className="text-foreground">consumer-web-ask-memo</code> lands.
      </div>

      {/* Persona */}
      <SectionCard
        icon={<MessageSquare className="text-secondary h-4 w-4" />}
        title="Persona &amp; voice"
        subtitle="How Memo greets and how it talks. These two fields are the biggest levers on how the concierge feels."
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

      {/* Model */}
      <SectionCard
        icon={<Bot className="text-secondary h-4 w-4" />}
        title="Model"
        subtitle="OpenAI is Memo's brain. Google Places + the Mesita catalog do the place grounding, so no web-search vendor is needed."
      >
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label={<>Provider</>}>
            <div className="border-border bg-card text-muted-foreground flex h-8 items-center rounded-lg border px-3 text-xs font-semibold">
              OpenAI
            </div>
          </Field>
          <Field label={<>Model tier</>}>
            <Segmented
              value={cfg.modelTier}
              onChange={(v) => set("modelTier", v)}
              options={[
                { value: "mini", label: "Fast (mini)" },
                { value: "standard", label: "Smart (standard)" },
              ]}
            />
          </Field>
          <NumberField
            icon={<Thermometer className="text-muted-foreground h-4 w-4" />}
            label="Temperature"
            value={cfg.temperature}
            min={0}
            max={1}
            decimals
            disabled={pending}
            onChange={(v) => set("temperature", v)}
          />
          <NumberField
            icon={<Hash className="text-muted-foreground h-4 w-4" />}
            label="Max reply tokens"
            value={cfg.maxTokens}
            min={200}
            max={1500}
            disabled={pending}
            onChange={(v) => set("maxTokens", v)}
          />
        </div>
      </SectionCard>

      {/* Retrieval */}
      <SectionCard
        icon={<MapPin className="text-secondary h-4 w-4" />}
        title="Retrieval"
        subtitle="How Memo pulls and ranks candidate places for a place-seeking turn."
      >
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <NumberField
            icon={<Hash className="text-muted-foreground h-4 w-4" />}
            label="Max place links per reply"
            value={cfg.maxCards}
            min={1}
            max={6}
            disabled={pending}
            onChange={(v) => set("maxCards", v)}
          />
          <NumberField
            icon={<Ruler className="text-muted-foreground h-4 w-4" />}
            label="Search radius (metres)"
            value={cfg.radiusM}
            min={1000}
            max={20000}
            disabled={pending}
            onChange={(v) => set("radiusM", v)}
          />
          <Field label={<>Prefer Mesita partners</>}>
            <Switch
              on={cfg.preferMesita}
              pending={pending}
              label="Prefer Mesita partners"
              onClick={() => set("preferMesita", !cfg.preferMesita)}
            />
          </Field>
          <Field label={<>Demote closed spots</>}>
            <Switch
              on={cfg.demoteClosed}
              pending={pending}
              label="Demote closed spots"
              onClick={() => set("demoteClosed", !cfg.demoteClosed)}
            />
          </Field>
        </div>
      </SectionCard>

      <SaveRow pending={pending} dirty={dirty} ok={ok} onClick={save} />
      {error && <ErrorNote message={error} />}
    </div>
  );
}
