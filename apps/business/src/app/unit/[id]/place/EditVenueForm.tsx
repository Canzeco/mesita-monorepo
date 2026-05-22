"use client";

import { useState } from "react";
import {
  Plus,
  X,
  Globe,
  Instagram,
  Facebook,
  MessageCircle,
  Music2,
  CalendarCheck,
  Bike,
  MapPin,
  Star,
  Mail,
  Phone as PhoneIcon,
  FileText,
  Building2,
  Save,
  Check,
  Loader2,
} from "lucide-react";
import type { MyVenue } from "@/lib/api/venues";
import { Field } from "@/components/shared";
import { cn } from "@/lib/utils";
import {
  INPUT_CLASS as INPUT,
  TEXTAREA_CLASS as TEXTAREA,
} from "@/lib/ui-classes";

// Frontend mock pass for the Place redesign. Every field is driven by the
// Components Notion database (M-Place-V + Manager-E columns):
//   - M-Place-V=YES  → component renders on this page
//   - Manager-E=YES  → component is editable; otherwise read-only
// Backend wiring (real Edge Function + schema migration) lands in a follow-up.

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
type DayHours = { open: string; close: string; closed?: boolean };

const DAYS: { key: DayKey; label: string }[] = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];

type MockVenue = {
  name: string;
  category: string;
  description: string;
  hours: Record<DayKey, DayHours>;
  menu_pdf_url: string;
  price_level: number;
  tags: string[];
  address: string;
  phone: string;
  whatsapp_url: string;
  whatsapp_pr_urls: string[];
  email: string;
  website_url: string;
  instagram_url: string;
  instagram_pr_urls: string[];
  google_business_url: string;
  google_maps_url: string;
  facebook_url: string;
  tiktok_url: string;
  opentable_url: string;
  tripadvisor_url: string;
  rappi_url: string;
  uber_eats_url: string;
  google_stars_overall: number;
  google_review_count: number;
  google_visitor_count: number;
  mesita_stars_overall: number;
  mesita_stars_food: number;
  mesita_stars_service: number;
  mesita_stars_ambience: number;
  mesita_review_count: number;
  mesita_visitor_count: number;
  instagram_followers_count: number;
};

const MOCK_VENUE: MockVenue = {
  name: "Mochomos San Luis Potosí",
  category: "mexican",
  description:
    "Refined Mexican steakhouse on the Carranza promenade. Carved chandeliers, deep velvets, mezcal flights, and dry-aged cuts on the parrilla.",
  hours: {
    mon: { open: "13:00", close: "00:00" },
    tue: { open: "13:00", close: "00:00" },
    wed: { open: "13:00", close: "00:00" },
    thu: { open: "13:00", close: "00:00" },
    fri: { open: "13:00", close: "02:00" },
    sat: { open: "13:00", close: "02:00" },
    sun: { open: "13:00", close: "22:00" },
  },
  menu_pdf_url: "https://example.com/mochomos-menu.pdf",
  price_level: 3,
  tags: ["elegant", "steakhouse", "tequila", "rooftop"],
  address:
    "Av. Venustiano Carranza 100, Tequisquiapan, 78250 San Luis Potosí, SLP",
  phone: "+52 444 833 5050",
  whatsapp_url: "https://wa.me/524448335050",
  whatsapp_pr_urls: [
    "https://wa.me/524441234567",
    "https://wa.me/524449876543",
  ],
  email: "reservaciones@mochomos.mx",
  website_url: "https://www.mochomos.com",
  instagram_url: "https://instagram.com/mochomosslp",
  instagram_pr_urls: [
    "https://instagram.com/mochomos.pr1",
    "https://instagram.com/mochomos.pr2",
  ],
  google_business_url: "https://business.google.com/g/mochomos-slp",
  google_maps_url: "https://maps.app.goo.gl/mochomos-slp",
  facebook_url: "https://facebook.com/mochomos.slp",
  tiktok_url: "https://tiktok.com/@mochomos",
  opentable_url: "https://opentable.com/r/mochomos-slp",
  tripadvisor_url: "https://tripadvisor.com/Restaurant_Review-mochomos",
  rappi_url: "https://rappi.com.mx/restaurantes/mochomos",
  uber_eats_url: "https://ubereats.com/store/mochomos",
  google_stars_overall: 4.6,
  google_review_count: 1840,
  google_visitor_count: 2310,
  mesita_stars_overall: 4.7,
  mesita_stars_food: 4.8,
  mesita_stars_service: 4.5,
  mesita_stars_ambience: 4.7,
  mesita_review_count: 64,
  mesita_visitor_count: 412,
  instagram_followers_count: 18400,
};

const PRICE_LABEL: Record<number, string> = {
  1: "$ · Budget",
  2: "$$ · Casual",
  3: "$$$ · Upscale",
  4: "$$$$ · Fine dining",
};

const SAVED_TOAST_MS = 1800;

export function EditVenueForm({ venue: _venue }: { venue: MyVenue }) {
  void _venue;
  const [v, setV] = useState<MockVenue>(MOCK_VENUE);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const set = <K extends keyof MockVenue>(key: K, value: MockVenue[K]) =>
    setV((prev) => ({ ...prev, [key]: value }));

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    window.setTimeout(() => {
      setSaving(false);
      setSaved(true);
      window.setTimeout(() => setSaved(false), SAVED_TOAST_MS);
    }, 500);
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <BasicsSection v={v} set={set} />
      <PrimaryChannelsSection v={v} set={set} />
      <SecondaryChannelsSection v={v} set={set} />
      <SignalsSection v={v} />

      <div className="border-border bg-background/95 shadow-elev sticky bottom-3 z-10 mt-2 flex items-center gap-3 rounded-2xl border p-3 backdrop-blur">
        <p className="text-muted-foreground hidden flex-1 text-xs sm:block">
          {saved ? "Saved (mock)." : "Mock data — Save is a stub for now."}
        </p>
        <button
          type="submit"
          disabled={saving}
          className={cn(
            "flex h-11 flex-1 items-center justify-center gap-2 rounded-full text-sm font-semibold transition disabled:opacity-50 sm:flex-none sm:px-6",
            saved
              ? "bg-secondary text-white"
              : "bg-pink-gradient shadow-glow text-white",
          )}
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : saved ? (
            <>
              <Check className="h-4 w-4" />
              Saved
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save changes
            </>
          )}
        </button>
      </div>
    </form>
  );
}

// ── Sections ────────────────────────────────────────────────────────────

function BasicsSection({
  v,
  set,
}: {
  v: MockVenue;
  set: <K extends keyof MockVenue>(key: K, value: MockVenue[K]) => void;
}) {
  return (
    <Section title="Basics">
      <Field label="Name" required>
        <input
          value={v.name}
          onChange={(e) => set("name", e.target.value)}
          className={INPUT}
        />
      </Field>

      <Field label="Category" hint="One word, e.g. mexican, cafe, sushi.">
        <input
          value={v.category}
          onChange={(e) => set("category", e.target.value)}
          className={INPUT}
        />
      </Field>

      <Field label="Description" hint="What makes this place itself.">
        <textarea
          value={v.description}
          onChange={(e) => set("description", e.target.value)}
          className={TEXTAREA}
        />
      </Field>

      <Field label="Days & hours">
        <HoursEditor
          hours={v.hours}
          onChange={(hours) => set("hours", hours)}
        />
      </Field>

      <Field label="Menu PDF" hint="Public link to the latest menu PDF.">
        <UrlInput
          icon={<FileText className="h-4 w-4" />}
          value={v.menu_pdf_url}
          onChange={(val) => set("menu_pdf_url", val)}
          placeholder="https://yourplace.com/menu.pdf"
        />
      </Field>

      <Field label="Tags" hint="Quick descriptors guests search for.">
        <TagsEditor tags={v.tags} onChange={(tags) => set("tags", tags)} />
      </Field>

      <ReadOnly label="Price level" value={PRICE_LABEL[v.price_level] ?? "—"} />

      <ReadOnly label="Address" value={v.address} icon={<MapPin className="h-4 w-4" />} />
    </Section>
  );
}

function PrimaryChannelsSection({
  v,
  set,
}: {
  v: MockVenue;
  set: <K extends keyof MockVenue>(key: K, value: MockVenue[K]) => void;
}) {
  return (
    <Section
      title="Primary channels"
      subtitle="The channels guests use to reach you directly."
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <UrlField
          label="Phone"
          icon={<PhoneIcon className="h-4 w-4" />}
          placeholder="+52 444 833 5050"
          value={v.phone}
          onChange={(val) => set("phone", val)}
        />
        <UrlField
          label="WhatsApp"
          icon={<MessageCircle className="h-4 w-4" />}
          placeholder="https://wa.me/52…"
          value={v.whatsapp_url}
          onChange={(val) => set("whatsapp_url", val)}
        />
        <UrlField
          label="Email"
          icon={<Mail className="h-4 w-4" />}
          placeholder="hola@yourplace.com"
          value={v.email}
          onChange={(val) => set("email", val)}
        />
        <UrlField
          label="Website"
          icon={<Globe className="h-4 w-4" />}
          placeholder="https://yourplace.com"
          value={v.website_url}
          onChange={(val) => set("website_url", val)}
        />
        <UrlField
          label="Instagram"
          icon={<Instagram className="h-4 w-4" />}
          placeholder="https://instagram.com/yourplace"
          value={v.instagram_url}
          onChange={(val) => set("instagram_url", val)}
        />
      </div>

      <Field
        label="WhatsApp PR number(s)"
        hint="Extra concierge / PR lines guests can reach when they're VIPs."
      >
        <UrlList
          icon={<MessageCircle className="h-4 w-4" />}
          values={v.whatsapp_pr_urls}
          onChange={(urls) => set("whatsapp_pr_urls", urls)}
          placeholder="https://wa.me/52…"
        />
      </Field>

      <Field
        label="Instagram PR username(s)"
        hint="Additional Instagram handles for PR / events."
      >
        <UrlList
          icon={<Instagram className="h-4 w-4" />}
          values={v.instagram_pr_urls}
          onChange={(urls) => set("instagram_pr_urls", urls)}
          placeholder="https://instagram.com/…"
        />
      </Field>

      <ReadOnly
        label="Google Business listing"
        value={v.google_business_url}
        icon={<Building2 className="h-4 w-4" />}
      />
      <ReadOnly
        label="Google Maps link"
        value={v.google_maps_url}
        icon={<MapPin className="h-4 w-4" />}
      />
    </Section>
  );
}

function SecondaryChannelsSection({
  v,
  set,
}: {
  v: MockVenue;
  set: <K extends keyof MockVenue>(key: K, value: MockVenue[K]) => void;
}) {
  return (
    <Section
      title="Secondary channels"
      subtitle="Where guests can deep-link out to reviews, reservations, and delivery."
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <UrlField
          label="Facebook"
          icon={<Facebook className="h-4 w-4" />}
          placeholder="https://facebook.com/yourplace"
          value={v.facebook_url}
          onChange={(val) => set("facebook_url", val)}
        />
        <UrlField
          label="TikTok"
          icon={<Music2 className="h-4 w-4" />}
          placeholder="https://tiktok.com/@yourplace"
          value={v.tiktok_url}
          onChange={(val) => set("tiktok_url", val)}
        />
        <UrlField
          label="OpenTable"
          icon={<CalendarCheck className="h-4 w-4" />}
          placeholder="https://opentable.com/r/yourplace"
          value={v.opentable_url}
          onChange={(val) => set("opentable_url", val)}
        />
        <UrlField
          label="TripAdvisor"
          icon={<Star className="h-4 w-4" />}
          placeholder="https://tripadvisor.com/…"
          value={v.tripadvisor_url}
          onChange={(val) => set("tripadvisor_url", val)}
        />
        <UrlField
          label="Rappi"
          icon={<Bike className="h-4 w-4" />}
          placeholder="https://rappi.com.mx/…"
          value={v.rappi_url}
          onChange={(val) => set("rappi_url", val)}
        />
        <UrlField
          label="Uber Eats"
          icon={<Bike className="h-4 w-4" />}
          placeholder="https://ubereats.com/store/…"
          value={v.uber_eats_url}
          onChange={(val) => set("uber_eats_url", val)}
        />
      </div>
    </Section>
  );
}

function SignalsSection({ v }: { v: MockVenue }) {
  const stars: { label: string; value: number; sub?: string }[] = [
    { label: "Google · Overall", value: v.google_stars_overall },
    { label: "Mesita · Overall", value: v.mesita_stars_overall },
    { label: "Mesita · Food", value: v.mesita_stars_food },
    { label: "Mesita · Service", value: v.mesita_stars_service },
    { label: "Mesita · Ambience", value: v.mesita_stars_ambience },
  ];
  const counts: { label: string; value: string }[] = [
    {
      label: "Google visitors & reviews",
      value: `${formatCount(v.google_visitor_count)} · ${formatCount(v.google_review_count)} reviews`,
    },
    {
      label: "Mesita visitors & reviews",
      value: `${formatCount(v.mesita_visitor_count)} · ${formatCount(v.mesita_review_count)} reviews`,
    },
    {
      label: "Instagram followers",
      value: formatCount(v.instagram_followers_count),
    },
  ];

  return (
    <Section
      title="Signals"
      subtitle="Computed from third-party sources and Mesita guest behaviour. Read-only."
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stars.map((s) => (
          <div
            key={s.label}
            className="border-border bg-muted/40 flex flex-col rounded-xl border p-3"
          >
            <p className="text-muted-foreground text-[10px] font-medium tracking-[0.12em] uppercase">
              {s.label}
            </p>
            <p className="font-display mt-1 flex items-baseline gap-1 text-xl font-semibold tabular-nums">
              <Star className="text-secondary h-3.5 w-3.5" />
              {s.value.toFixed(1)}
            </p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {counts.map((c) => (
          <div
            key={c.label}
            className="border-border bg-muted/40 rounded-xl border p-3"
          >
            <p className="text-muted-foreground text-[10px] font-medium tracking-[0.12em] uppercase">
              {c.label}
            </p>
            <p className="font-display mt-1 text-base font-semibold tabular-nums">
              {c.value}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── Primitives ──────────────────────────────────────────────────────────

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border bg-card flex flex-col gap-3 rounded-2xl border p-5">
      <div>
        <h3 className="font-display text-lg font-semibold tracking-tight">
          {title}
        </h3>
        {subtitle && (
          <p className="text-muted-foreground mt-0.5 text-xs">{subtitle}</p>
        )}
      </div>
      {children}
    </section>
  );
}

function UrlField({
  label,
  icon,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  icon: React.ReactNode;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-muted-foreground mb-1.5 flex items-center gap-1.5 text-xs font-medium">
        <span className="text-foreground/70">{icon}</span>
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        autoCapitalize="none"
        className={INPUT}
      />
    </label>
  );
}

function UrlInput({
  icon,
  value,
  onChange,
  placeholder,
}: {
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="border-border bg-card flex items-center gap-2 rounded-xl border px-3">
      <span className="text-muted-foreground">{icon}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        autoCapitalize="none"
        className="placeholder:text-muted-foreground h-11 w-full bg-transparent text-sm outline-none"
      />
    </div>
  );
}

function UrlList({
  icon,
  values,
  onChange,
  placeholder,
}: {
  icon: React.ReactNode;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const update = (idx: number, val: string) => {
    const next = values.slice();
    next[idx] = val;
    onChange(next);
  };
  const remove = (idx: number) => onChange(values.filter((_, i) => i !== idx));
  const add = () => onChange([...values, ""]);
  return (
    <div className="flex flex-col gap-2">
      {values.map((val, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <div className="flex-1">
            <UrlInput
              icon={icon}
              value={val}
              onChange={(v) => update(idx, v)}
              placeholder={placeholder}
            />
          </div>
          <button
            type="button"
            onClick={() => remove(idx)}
            aria-label="Remove"
            className="text-muted-foreground hover:text-destructive flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="border-border bg-card hover:bg-muted text-muted-foreground inline-flex h-9 w-fit items-center gap-1.5 rounded-full border border-dashed px-3 text-xs font-semibold transition"
      >
        <Plus className="h-3.5 w-3.5" />
        Add another
      </button>
    </div>
  );
}

function HoursEditor({
  hours,
  onChange,
}: {
  hours: Record<DayKey, DayHours>;
  onChange: (h: Record<DayKey, DayHours>) => void;
}) {
  const setDay = (key: DayKey, patch: Partial<DayHours>) =>
    onChange({ ...hours, [key]: { ...hours[key], ...patch } });
  return (
    <div className="border-border bg-muted/20 flex flex-col divide-y rounded-xl border">
      {DAYS.map(({ key, label }) => {
        const d = hours[key];
        const closed = d.closed === true;
        return (
          <div
            key={key}
            className="grid grid-cols-[100px_1fr] items-center gap-3 px-3 py-2.5"
          >
            <span className="text-muted-foreground text-xs font-medium">
              {label}
            </span>
            {closed ? (
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground text-xs">Closed</span>
                <button
                  type="button"
                  onClick={() => setDay(key, { closed: false })}
                  className="text-muted-foreground hover:text-foreground text-[11px] font-semibold underline-offset-2 hover:underline"
                >
                  Set hours
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  value={d.open}
                  onChange={(e) => setDay(key, { open: e.target.value })}
                  placeholder="13:00"
                  className="border-border bg-card h-8 w-20 rounded-lg border px-2 text-xs tabular-nums outline-none"
                />
                <span className="text-muted-foreground text-[11px]">→</span>
                <input
                  value={d.close}
                  onChange={(e) => setDay(key, { close: e.target.value })}
                  placeholder="00:00"
                  className="border-border bg-card h-8 w-20 rounded-lg border px-2 text-xs tabular-nums outline-none"
                />
                <button
                  type="button"
                  onClick={() => setDay(key, { closed: true })}
                  className="text-muted-foreground hover:text-foreground ml-auto text-[11px] font-semibold underline-offset-2 hover:underline"
                >
                  Closed
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TagsEditor({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const t = draft.trim().toLowerCase();
    if (!t) return;
    if (tags.includes(t)) {
      setDraft("");
      return;
    }
    onChange([...tags, t]);
    setDraft("");
  };
  const remove = (t: string) => onChange(tags.filter((x) => x !== t));
  return (
    <div className="border-border bg-card flex flex-wrap items-center gap-2 rounded-xl border p-2">
      {tags.map((t) => (
        <span
          key={t}
          className="bg-muted inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium"
        >
          {t}
          <button
            type="button"
            onClick={() => remove(t)}
            aria-label={`Remove ${t}`}
            className="text-muted-foreground hover:text-destructive"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
        placeholder={tags.length === 0 ? "Add tag and press enter" : "Add another"}
        className="placeholder:text-muted-foreground min-w-[100px] flex-1 bg-transparent px-1 text-sm outline-none"
      />
    </div>
  );
}

function ReadOnly({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <span className="text-muted-foreground mb-1.5 flex items-center gap-1.5 text-xs font-medium">
        {icon && <span className="text-foreground/60">{icon}</span>}
        {label}
      </span>
      <div className="border-border bg-muted/40 text-muted-foreground rounded-xl border px-3 py-2.5 text-sm break-words">
        {value || "—"}
      </div>
    </div>
  );
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}
