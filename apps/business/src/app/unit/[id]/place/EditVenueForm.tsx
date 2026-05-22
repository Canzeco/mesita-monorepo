"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  X,
  Globe,
  Instagram,
  MessageCircle,
  MapPin,
  Star,
  Mail,
  Phone as PhoneIcon,
  FileText,
  Building2,
  Save,
  Check,
  Loader2,
  Clock,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  ImagePlus,
} from "lucide-react";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  apiUpdateVenue,
  type MyVenue,
  type UpdateVenueInput,
  type VenueHours,
} from "@/lib/api/venues";
import {
  Field,
  GoogleLogo,
  InstagramLogo,
  MesitaLogo,
} from "@/components/shared";
import { cn, errMsg } from "@/lib/utils";
import {
  INPUT_CLASS as INPUT,
  TEXTAREA_CLASS as TEXTAREA,
} from "@/lib/ui-classes";

// Place page driven by the Notion Components spec:
//   - M-Place-V=YES → component renders here
//   - Manager-E=YES → component is editable; otherwise read-only
// Read-only signal & metadata fields fall back to a "not found yet" note
// when the value is null so the manager understands the enrichment pipeline
// is still working on it — except Name + Category, which are always
// manager-authored and therefore never get the note.

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
type HoursRange = { open: string; close: string };
type DayShifts = { ranges: HoursRange[]; closed: boolean };

const DAYS: { key: DayKey; label: string; long: keyof VenueHours }[] = [
  { key: "mon", label: "Mon", long: "monday" },
  { key: "tue", label: "Tue", long: "tuesday" },
  { key: "wed", label: "Wed", long: "wednesday" },
  { key: "thu", label: "Thu", long: "thursday" },
  { key: "fri", label: "Fri", long: "friday" },
  { key: "sat", label: "Sat", long: "saturday" },
  { key: "sun", label: "Sun", long: "sunday" },
];

const MAX_SHIFTS_PER_DAY = 2;

type FormState = {
  name: string;
  category: string;
  description: string;
  hours: Record<DayKey, DayShifts>;
  menu_pdf_url: string;
  photos: string[];
  tags: string[];
  phone: string;
  whatsapp_url: string;
  whatsapp_pr_urls: string[];
  email: string;
  website_url: string;
  instagram_url: string;
  instagram_pr_urls: string[];
  facebook_url: string;
  tiktok_url: string;
  opentable_url: string;
  tripadvisor_url: string;
  rappi_url: string;
  uber_eats_url: string;
};

const PRICE_LABEL: Record<number, string> = {
  1: "$ · Budget",
  2: "$$ · Casual",
  3: "$$$ · Upscale",
  4: "$$$$ · Fine dining",
};

const SAVED_TOAST_MS = 2200;
const VENUE_NAME_MAX = 120;
const DESCRIPTION_MAX = 600;
const TAG_MAX = 40;
const MAX_PHOTOS = 30;

const NOT_FOUND_NOTE = "Not found yet — pipeline still searching.";

function nullableUrl(v: string): string | null {
  const t = v.trim();
  if (t === "") return null;
  if (/^https:\/\//i.test(t)) return t;
  if (/^http:\/\//i.test(t)) return t.replace(/^http:/i, "https:");
  if (/^[a-z0-9.-]+\.[a-z]{2,}/i.test(t)) return `https://${t}`;
  return t;
}

function nullable(v: string): string | null {
  const t = v.trim();
  return t === "" ? null : t;
}

function venueHoursToForm(h: VenueHours | null): Record<DayKey, DayShifts> {
  const out = {} as Record<DayKey, DayShifts>;
  for (const d of DAYS) {
    const ranges = h?.[d.long] ?? null;
    if (ranges === null) {
      // No key for the day → treat as unknown (default to a single empty
      // input rather than "Closed" so the manager isn't surprised).
      out[d.key] = { ranges: [{ open: "", close: "" }], closed: false };
    } else if (ranges.length === 0) {
      out[d.key] = { ranges: [], closed: true };
    } else {
      out[d.key] = {
        ranges: ranges.slice(0, MAX_SHIFTS_PER_DAY).map((r) => ({
          open: r.open,
          close: r.close,
        })),
        closed: false,
      };
    }
  }
  return out;
}

function formHoursToVenue(form: Record<DayKey, DayShifts>): VenueHours {
  const out: VenueHours = {};
  for (const d of DAYS) {
    const v = form[d.key];
    if (v.closed) continue;
    const clean = v.ranges
      .map((r) => ({ open: r.open.trim(), close: r.close.trim() }))
      .filter((r) => r.open && r.close);
    if (clean.length > 0) out[d.long] = clean;
  }
  return out;
}

export function EditVenueForm({ venue }: { venue: MyVenue }) {
  const router = useRouter();
  const supabase = useBrowserSupabase();

  const [v, setV] = useState<FormState>(() => ({
    name: venue.name ?? "",
    category: venue.category ?? "",
    description: venue.description ?? "",
    hours: venueHoursToForm(venue.hours),
    menu_pdf_url: venue.menu_pdf_url ?? "",
    photos: venue.photos ?? [],
    tags: venue.tags ?? [],
    phone: venue.phone ?? "",
    whatsapp_url: venue.whatsapp_url ?? "",
    whatsapp_pr_urls: venue.whatsapp_pr_urls ?? [],
    email: venue.email ?? "",
    website_url: venue.website_url ?? "",
    instagram_url: venue.instagram_url ?? "",
    instagram_pr_urls: venue.instagram_pr_urls ?? [],
    facebook_url: venue.facebook_url ?? "",
    tiktok_url: venue.tiktok_url ?? "",
    opentable_url: venue.opentable_url ?? "",
    tripadvisor_url: venue.tripadvisor_url ?? "",
    rappi_url: venue.rappi_url ?? "",
    uber_eats_url: venue.uber_eats_url ?? "",
  }));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setV((prev) => ({ ...prev, [key]: value }));

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const trimmedName = v.name.trim();
    if (!trimmedName) {
      setError("Name cannot be empty.");
      return;
    }

    const payload: UpdateVenueInput = {
      id: venue.id,
      name: trimmedName.slice(0, VENUE_NAME_MAX),
      category: nullable(v.category),
      description:
        v.description.trim() === ""
          ? null
          : v.description.trim().slice(0, DESCRIPTION_MAX),
      hours: formHoursToVenue(v.hours),
      menu_pdf_url: nullableUrl(v.menu_pdf_url),
      photos: v.photos.slice(0, MAX_PHOTOS),
      tags: v.tags
        .map((t) => t.trim().toLowerCase().slice(0, TAG_MAX))
        .filter(Boolean),
      phone: nullable(v.phone),
      whatsapp_url: nullableUrl(v.whatsapp_url),
      whatsapp_pr_urls: v.whatsapp_pr_urls
        .map(nullableUrl)
        .filter((u): u is string => u !== null),
      email: v.email.trim() === "" ? null : v.email.trim(),
      website_url: nullableUrl(v.website_url),
      instagram_url: nullableUrl(v.instagram_url),
      instagram_pr_urls: v.instagram_pr_urls
        .map(nullableUrl)
        .filter((u): u is string => u !== null),
      facebook_url: nullableUrl(v.facebook_url),
      tiktok_url: nullableUrl(v.tiktok_url),
      opentable_url: nullableUrl(v.opentable_url),
      tripadvisor_url: nullableUrl(v.tripadvisor_url),
      rappi_url: nullableUrl(v.rappi_url),
      uber_eats_url: nullableUrl(v.uber_eats_url),
    };

    startTransition(async () => {
      try {
        await apiUpdateVenue(supabase, payload);
        setSaved(true);
        router.refresh();
        window.setTimeout(() => setSaved(false), SAVED_TOAST_MS);
      } catch (err) {
        setError(errMsg(err, "Could not save."));
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <BasicsSection venue={venue} v={v} set={set} />
      <TimeSection venue={venue} v={v} set={set} />
      <MediaSection
        photos={v.photos}
        onChange={(photos) => set("photos", photos)}
        venueName={v.name}
        onError={setError}
      />
      <ProductSection v={v} set={set} />
      <ChannelsSection venue={venue} v={v} set={set} />
      <SignalsSection venue={venue} />

      {error && (
        <p className="bg-destructive/10 text-destructive rounded-xl px-4 py-3 text-sm">
          {error}
        </p>
      )}

      <div className="border-border bg-background/95 shadow-elev sticky bottom-3 z-10 mt-2 flex items-center justify-end gap-3 rounded-2xl border p-3 backdrop-blur">
        <button
          type="submit"
          disabled={pending}
          className={cn(
            "flex h-11 flex-1 items-center justify-center gap-2 rounded-full text-sm font-semibold transition disabled:opacity-50 sm:flex-none sm:px-6",
            saved
              ? "bg-secondary text-white"
              : "bg-pink-gradient shadow-glow text-white",
          )}
        >
          {pending ? (
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
              Save
            </>
          )}
        </button>
      </div>
    </form>
  );
}

// ── Sections ────────────────────────────────────────────────────────────

function BasicsSection({
  venue,
  v,
  set,
}: {
  venue: MyVenue;
  v: FormState;
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <Section title="Basics">
      <Field label="Name" required>
        <input
          value={v.name}
          onChange={(e) => set("name", e.target.value)}
          maxLength={VENUE_NAME_MAX}
          className={INPUT}
        />
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Category">
          <input
            value={v.category}
            onChange={(e) => set("category", e.target.value)}
            placeholder="e.g. cafe, mexican, sushi"
            className={INPUT}
          />
        </Field>

        <Field label="Tags">
          <TagsEditor tags={v.tags} onChange={(tags) => set("tags", tags)} />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ReadOnly
          label="Price level"
          value={
            venue.price_level != null ? PRICE_LABEL[venue.price_level] : null
          }
          empty="Not listed on Google."
        />
        <ReadOnly
          label="Address"
          value={venue.address}
          icon={<MapPin className="h-4 w-4" />}
        />
      </div>

      <Field label="Description">
        <textarea
          value={v.description}
          onChange={(e) => set("description", e.target.value)}
          maxLength={DESCRIPTION_MAX}
          className={TEXTAREA}
        />
      </Field>
    </Section>
  );
}

function TimeSection({
  venue,
  v,
  set,
}: {
  venue: MyVenue;
  v: FormState;
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <Section title="Hours">
      <ReadOnly
        label="Timezone"
        value={venue.timezone}
        icon={<Clock className="h-4 w-4" />}
      />

      <HoursEditor
        hours={v.hours}
        onChange={(hours) => set("hours", hours)}
      />
    </Section>
  );
}

function MediaSection({
  photos,
  onChange,
  venueName,
  onError,
}: {
  photos: string[];
  onChange: (next: string[]) => void;
  venueName: string;
  onError: (msg: string | null) => void;
}) {
  const [draft, setDraft] = useState("");

  const move = (from: number, dir: -1 | 1) => {
    const to = from + dir;
    if (to < 0 || to >= photos.length) return;
    const next = photos.slice();
    [next[from], next[to]] = [next[to], next[from]];
    onChange(next);
  };
  const remove = (idx: number) => onChange(photos.filter((_, i) => i !== idx));
  const add = () => {
    const url = draft.trim();
    if (!url) return;
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      onError("Photo URL must be a valid https:// link.");
      return;
    }
    if (parsed.protocol !== "https:") {
      onError("Photo URL must use https:// (Next.js Image refuses http://).");
      return;
    }
    if (photos.includes(url)) {
      onError("That photo is already in the list.");
      return;
    }
    if (photos.length >= MAX_PHOTOS) {
      onError(`At most ${MAX_PHOTOS} photos.`);
      return;
    }
    onError(null);
    onChange([...photos, url]);
    setDraft("");
  };

  return (
    <Section
      title="Photos"
      badge={
        <span className="text-muted-foreground text-[10px] font-bold tracking-[0.14em] uppercase">
          {photos.length} / {MAX_PHOTOS}
        </span>
      }
    >
      {photos.length === 0 ? (
        <p className="bg-muted text-muted-foreground rounded-xl px-3 py-3 text-xs">
          No photos yet.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((src, idx) => (
            <li
              key={`${src}-${idx}`}
              className="group border-border bg-muted relative overflow-hidden rounded-xl border"
            >
              <div className="aspect-square w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={`${venueName || "Venue"} photo ${idx + 1}`}
                  className="h-full w-full object-cover"
                />
              </div>
              {idx === 0 && (
                <span className="bg-foreground text-background absolute top-2 left-2 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase">
                  Cover
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/80 to-transparent p-1.5 opacity-0 transition group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => move(idx, -1)}
                  aria-label="Move earlier"
                  disabled={idx === 0}
                  className="text-foreground flex h-7 w-7 items-center justify-center rounded-full bg-white/95 transition hover:bg-white disabled:opacity-40"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => move(idx, 1)}
                  aria-label="Move later"
                  disabled={idx === photos.length - 1}
                  className="text-foreground flex h-7 w-7 items-center justify-center rounded-full bg-white/95 transition hover:bg-white disabled:opacity-40"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  aria-label="Remove photo"
                  className="bg-destructive ml-auto flex h-7 w-7 items-center justify-center rounded-full text-white transition hover:opacity-90"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <UrlInput
            icon={<ImagePlus className="h-4 w-4" />}
            value={draft}
            onChange={setDraft}
            placeholder="https://…"
          />
        </div>
        <button
          type="button"
          onClick={add}
          className="border-border bg-card hover:bg-muted inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>
    </Section>
  );
}

function ProductSection({
  v,
  set,
}: {
  v: FormState;
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  // Lives in its own section so it can grow: today it's just the menu PDF,
  // tomorrow it's product photos, signature dishes, drink list, etc.
  return (
    <Section title="Menu">
      <Field label="PDF link">
        <UrlInput
          icon={<FileText className="h-4 w-4" />}
          value={v.menu_pdf_url}
          onChange={(val) => set("menu_pdf_url", val)}
          placeholder="https://yourplace.com/menu.pdf"
        />
      </Field>
    </Section>
  );
}

function ChannelsSection({
  venue,
  v,
  set,
}: {
  venue: MyVenue;
  v: FormState;
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  const fields = [
    v.phone,
    v.whatsapp_url,
    v.email,
    v.website_url,
    v.instagram_url,
  ];
  const filled = fields.filter((f) => f.trim() !== "").length;
  return (
    <Section
      title="Channels"
      badge={
        <span className="text-muted-foreground text-[10px] font-bold tracking-[0.14em] uppercase">
          {filled} / {fields.length}
        </span>
      }
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ReadOnly
          label="Google Business"
          value={venue.google_business_url}
          icon={<Building2 className="h-4 w-4" />}
        />
        <ReadOnly
          label="Google Maps"
          value={venue.google_maps_url}
          icon={<MapPin className="h-4 w-4" />}
        />
      </div>
    </Section>
  );
}

function SignalsSection({ venue }: { venue: MyVenue }) {
  const stars: {
    label: string;
    value: number | null;
    logo: React.ReactNode;
  }[] = [
    { label: "Google", value: venue.google_stars_overall, logo: <GoogleLogo size={12} /> },
    { label: "Overall", value: venue.mesita_stars_overall, logo: <MesitaLogo size={12} /> },
    { label: "Food", value: venue.mesita_stars_food, logo: <MesitaLogo size={12} /> },
    { label: "Service", value: venue.mesita_stars_service, logo: <MesitaLogo size={12} /> },
    { label: "Ambience", value: venue.mesita_stars_ambience, logo: <MesitaLogo size={12} /> },
  ];
  const counts: {
    label: string;
    value: string;
    logo: React.ReactNode;
  }[] = [
    {
      label: "Google",
      value: visitorReview(venue.google_visitor_count, venue.google_review_count),
      logo: <GoogleLogo size={12} />,
    },
    {
      label: "Mesita",
      value: visitorReview(venue.mesita_visitor_count, venue.mesita_review_count),
      logo: <MesitaLogo size={12} />,
    },
    {
      label: "Instagram",
      value:
        venue.instagram_followers_count == null
          ? "—"
          : formatCount(venue.instagram_followers_count),
      logo: <InstagramLogo size={12} />,
    },
  ];

  return (
    <Section
      title="Signals"
      badge={
        <span className="text-muted-foreground text-[10px] font-bold tracking-[0.14em] uppercase">
          Read-only
        </span>
      }
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {stars.map((s) => (
          <div
            key={s.label}
            className="border-border bg-muted/40 flex flex-col rounded-xl border p-2.5"
          >
            <p className="text-muted-foreground flex items-center gap-1 text-[10px] font-semibold tracking-[0.12em] uppercase">
              {s.logo}
              {s.label}
            </p>
            <p className="font-display mt-1 flex items-baseline gap-1 text-lg font-semibold tabular-nums">
              <Star className="text-secondary h-3 w-3" />
              {s.value == null ? "—" : s.value.toFixed(1)}
            </p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {counts.map((c) => (
          <div
            key={c.label}
            className="border-border bg-muted/40 rounded-xl border p-2.5"
          >
            <p className="text-muted-foreground flex items-center gap-1 text-[10px] font-semibold tracking-[0.12em] uppercase">
              {c.logo}
              {c.label}
            </p>
            <p className="font-display mt-1 text-sm font-semibold tabular-nums">
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
  badge,
  children,
}: {
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border bg-card flex flex-col gap-3 rounded-2xl border p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-sm font-semibold tracking-tight">
          {title}
        </h3>
        {badge}
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

function HoursEditor({
  hours,
  onChange,
}: {
  hours: Record<DayKey, DayShifts>;
  onChange: (h: Record<DayKey, DayShifts>) => void;
}) {
  const setDay = (key: DayKey, next: DayShifts) =>
    onChange({ ...hours, [key]: next });

  const setRange = (
    key: DayKey,
    idx: number,
    patch: Partial<HoursRange>,
  ) => {
    const day = hours[key];
    const ranges = day.ranges.map((r, i) =>
      i === idx ? { ...r, ...patch } : r,
    );
    setDay(key, { ...day, ranges });
  };

  const addShift = (key: DayKey) => {
    const day = hours[key];
    if (day.ranges.length >= MAX_SHIFTS_PER_DAY) return;
    setDay(key, {
      closed: false,
      ranges: [...day.ranges, { open: "", close: "" }],
    });
  };

  const removeShift = (key: DayKey, idx: number) => {
    const day = hours[key];
    const ranges = day.ranges.filter((_, i) => i !== idx);
    setDay(key, { ...day, ranges: ranges.length > 0 ? ranges : [{ open: "", close: "" }] });
  };

  const markClosed = (key: DayKey) =>
    setDay(key, { closed: true, ranges: [] });

  const reopen = (key: DayKey) =>
    setDay(key, { closed: false, ranges: [{ open: "", close: "" }] });

  // Single column of horizontal day rows wrapped in one bordered card with
  // hairline separators between days. Each row is a single line:
  //   [DAY]  [shift 1]  [· shift 2 ×]?  [+ shift]?            [Close/Reopen]
  // Closed days collapse to italic "Closed" text, dim the row background,
  // and swap the right-edge button to the filled "Reopen" action.
  return (
    <div className="border-border bg-card divide-border divide-y overflow-hidden rounded-xl border">
      {DAYS.map(({ key, label }) => {
        const d = hours[key];
        const isClosed = d.closed;
        return (
          <div
            key={key}
            className={cn(
              "flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2 transition",
              isClosed && "bg-muted/30",
            )}
          >
            <span className="text-muted-foreground w-9 shrink-0 text-[11px] font-bold tracking-[0.14em] uppercase">
              {label}
            </span>

            {isClosed ? (
              <span className="text-muted-foreground/80 flex-1 text-xs italic">
                Closed all day
              </span>
            ) : (
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1.5">
                {d.ranges.map((r, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    {idx > 0 && (
                      <span className="text-muted-foreground/50 mr-0.5 text-xs select-none">
                        ·
                      </span>
                    )}
                    <input
                      value={r.open}
                      onChange={(e) =>
                        setRange(key, idx, { open: e.target.value })
                      }
                      placeholder="13:00"
                      aria-label={`${label} shift ${idx + 1} opens at`}
                      className="bg-background border-border focus:border-foreground/40 h-8 w-[64px] rounded-md border px-1.5 text-center text-xs tabular-nums outline-none"
                    />
                    <span className="text-muted-foreground/70 text-[10px]">
                      →
                    </span>
                    <input
                      value={r.close}
                      onChange={(e) =>
                        setRange(key, idx, { close: e.target.value })
                      }
                      placeholder="00:00"
                      aria-label={`${label} shift ${idx + 1} closes at`}
                      className="bg-background border-border focus:border-foreground/40 h-8 w-[64px] rounded-md border px-1.5 text-center text-xs tabular-nums outline-none"
                    />
                    {d.ranges.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeShift(key, idx)}
                        aria-label="Remove this shift"
                        className="text-muted-foreground/70 hover:text-destructive ml-0.5 flex h-5 w-5 items-center justify-center rounded-full transition"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
                {d.ranges.length < MAX_SHIFTS_PER_DAY && (
                  <button
                    type="button"
                    onClick={() => addShift(key)}
                    className="text-muted-foreground/70 hover:text-foreground inline-flex items-center gap-0.5 text-[11px] font-medium"
                  >
                    <Plus className="h-3 w-3" />
                    shift
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => (isClosed ? reopen(key) : markClosed(key))}
              aria-label={isClosed ? "Reopen this day" : "Mark this day closed"}
              className={cn(
                "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wider uppercase transition",
                isClosed
                  ? "bg-foreground text-background hover:opacity-90"
                  : "text-muted-foreground/70 hover:text-foreground",
              )}
            >
              {isClosed ? "Reopen" : "Close"}
            </button>
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
  empty,
}: {
  label: string;
  value: string | null;
  icon?: React.ReactNode;
  // Override the default "couldn't pull this" note for cases where the
  // canonical source can legitimately not have the field (e.g. Google
  // doesn't always assign a price tier).
  empty?: string;
}) {
  const isEmpty = !value || value.trim() === "";
  return (
    <div>
      <span className="text-muted-foreground mb-1.5 flex items-center gap-1.5 text-xs font-medium">
        {icon && <span className="text-foreground/60">{icon}</span>}
        {label}
      </span>
      <div
        className={cn(
          "border-border rounded-xl border px-3 py-2.5 text-sm break-words",
          isEmpty
            ? "bg-muted/20 text-muted-foreground/80 italic"
            : "bg-muted/40 text-muted-foreground",
        )}
      >
        {isEmpty ? (
          <span className="flex items-start gap-2">
            <Sparkles className="text-muted-foreground/60 mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{empty ?? NOT_FOUND_NOTE}</span>
          </span>
        ) : (
          value
        )}
      </div>
    </div>
  );
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function visitorReview(visitors: number | null, reviews: number | null): string {
  if (visitors == null && reviews == null) return "—";
  const v = visitors == null ? "—" : formatCount(visitors);
  const r = reviews == null ? "—" : formatCount(reviews);
  return `${v} · ${r} reviews`;
}
