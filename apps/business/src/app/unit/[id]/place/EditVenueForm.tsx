"use client";

import { useEffect, useState, useTransition } from "react";
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
  Facebook,
  Music2,
  ShoppingBag,
  UtensilsCrossed,
  DollarSign,
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
  Section,
} from "@/components/shared";
import { cn, errMsg } from "@/lib/utils";
import {
  INPUT_CLASS as INPUT,
  TEXTAREA_CLASS as TEXTAREA,
  TINY_LABEL_CLASS,
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

// Tier names only — the `$` count now renders as a row of DollarSign
// icons in the BasicsSection so the price reads visually instead of
// stringly. `PRICE_LEVEL_MAX` is the full count (4 icons total).
const PRICE_LEVEL_MAX = 4;
const PRICE_TIER_LABEL: Record<number, string> = {
  1: "Budget",
  2: "Casual",
  3: "Upscale",
  4: "Fine dining",
};

const SAVED_TOAST_MS = 2200;
const VENUE_NAME_MAX = 120;
const DESCRIPTION_MAX = 600;
const TAG_MAX = 40;
const MAX_PHOTOS = 30;

const NOT_FOUND_NOTE = "Not found yet — pipeline still searching.";

// Example copy in the Description textarea so the manager has something
// to react to instead of an empty field. Will be swapped for the AI
// Hidden Description once the enrichment pipeline lands that field on
// the venue (Notion: AI Hidden Description, M-Place-V=NO right now).
const DESCRIPTION_PLACEHOLDER =
  "e.g. Casual Oaxacan kitchen with a wood-fired tlayuda program, " +
  "a tight mezcal list, and a back patio that fills up on Fridays. " +
  "Brunch on weekends, late-night menu Thu–Sat.";


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
      {/* 2-column grid:
            Row 1: Basics      | Preview
            Row 2: Location    | Time
            Row 3: Product     | Signals
            Row 4: Media (full width — photo grid wants the whole row)

          Description + Tags now live inside Basics (no separate
          Details section). ChannelsSection (primary/PR/secondary)
          is still scoped out — its `_` prefix keeps the helper
          defined for an easy re-enable. Mobile collapses every row
          to single column. */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <BasicsSection venue={venue} v={v} set={set} />
        <PreviewSection venue={venue} v={v} />
        <LocationSection venue={venue} />
        <TimeSection venue={venue} v={v} set={set} />
        <ProductSection v={v} set={set} />
        <SignalsSection venue={venue} />
      </div>

      <MediaSection
        photos={v.photos}
        onChange={(photos) => set("photos", photos)}
        venueName={v.name}
        onError={setError}
      />

      {error && (
        <p className="bg-destructive/10 text-destructive rounded-xl px-4 py-3 text-sm">
          {error}
        </p>
      )}

      {/* Compact save chip — only takes the width it needs and lives in
          the bottom-right corner of the scroll viewport rather than
          spanning the whole form. Keeps the manager surface uncluttered
          when nothing's been edited. */}
      <div className="pointer-events-none sticky bottom-3 z-10 mt-1 flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className={cn(
            "pointer-events-auto inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[12px] font-semibold shadow-md transition disabled:opacity-60",
            saved
              ? "bg-secondary text-white"
              : "bg-foreground text-background hover:opacity-90",
          )}
        >
          {pending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Saving…
            </>
          ) : saved ? (
            <>
              <Check className="h-3.5 w-3.5" />
              Saved
            </>
          ) : (
            <>
              <Save className="h-3.5 w-3.5" />
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
  // Five-field identity block: Name, Category, Price level, Tags,
  // Description. Description + Tags used to live in their own Details
  // section but the grid layout looks tighter when they're folded into
  // Basics, which leaves Preview free to sit next to it in the first
  // row of the 2-col grid.
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

      <Field label="Category">
        <input
          value={v.category}
          onChange={(e) => set("category", e.target.value)}
          placeholder="e.g. cafe, mexican, sushi"
          className={INPUT}
        />
      </Field>

      <PriceLevelDisplay level={venue.price_level} />

      <Field label="Tags">
        <TagsEditor tags={v.tags} onChange={(tags) => set("tags", tags)} />
      </Field>

      <Field label="Description">
        <textarea
          value={v.description}
          onChange={(e) => set("description", e.target.value)}
          maxLength={DESCRIPTION_MAX}
          placeholder={DESCRIPTION_PLACEHOLDER}
          className={TEXTAREA}
        />
      </Field>
    </Section>
  );
}

function PriceLevelDisplay({ level }: { level: number | null }) {
  // Renders the Google price tier as a row of `$` icons (1-PRICE_LEVEL_MAX
  // filled, the rest dimmed) plus the tier name. Visually parses faster
  // than the old "$$ · Casual" string and gives the field a real shape
  // among the rest of the readonly cards.
  const isEmpty = level == null;
  return (
    <div>
      <span className="text-muted-foreground mb-1.5 flex items-center gap-1.5 text-xs font-medium">
        <DollarSign className="text-foreground/60 h-4 w-4" />
        Price level
      </span>
      <div
        className={cn(
          "border-border flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm break-words",
          isEmpty
            ? "bg-muted/20 text-muted-foreground/80 italic"
            : "bg-muted/40 text-muted-foreground",
        )}
      >
        {isEmpty ? (
          <span className="flex items-start gap-2">
            <Sparkles className="text-muted-foreground/60 mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Not listed on Google.</span>
          </span>
        ) : (
          <>
            <div
              className="flex items-center gap-0.5"
              aria-label={`Price level ${level} of ${PRICE_LEVEL_MAX}`}
            >
              {Array.from({ length: PRICE_LEVEL_MAX }, (_, i) => i + 1).map(
                (i) => (
                  <DollarSign
                    key={i}
                    className={cn(
                      "h-4 w-4",
                      i <= level
                        ? "text-foreground"
                        : "text-muted-foreground/25",
                    )}
                  />
                ),
              )}
            </div>
            <span className="text-muted-foreground/80 text-[12px]">
              {PRICE_TIER_LABEL[level] ?? "—"}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function LocationSection({ venue }: { venue: MyVenue }) {
  // Notion: Address (Basics) + Google Maps Link (Location) both inform
  // where the venue physically is. Grouping them in a dedicated section
  // keeps Basics about identity (name / category / price) and gives the
  // map link its own row instead of fighting for attention next to a
  // long street address. When we have coordinates from the enrichment
  // pipeline, render a live Google Maps embed below so the manager can
  // eyeball the pin without leaving the page.
  const hasCoords = venue.lat != null && venue.lng != null;
  return (
    <Section title="Location">
      <ReadOnly
        label="Address"
        value={venue.address}
        icon={<MapPin className="h-4 w-4" />}
      />
      <ReadOnly
        label="Google Maps"
        value={venue.google_maps_url}
        icon={<Globe className="h-4 w-4" />}
      />
      {hasCoords && (
        <VenueMapEmbed
          lat={venue.lat as number}
          lng={venue.lng as number}
          name={venue.name}
        />
      )}
    </Section>
  );
}

function VenueMapEmbed({
  lat,
  lng,
  name,
}: {
  lat: number;
  lng: number;
  name: string | null;
}) {
  // The `output=embed` form on maps.google.com renders a full Google
  // Maps iframe without an API key. It's not on the official Embed API
  // surface (which would require NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY +
  // billing setup), but it's been stable for years and is the standard
  // approach for "show a map preview, no auth." Swap to the keyed
  // /maps/embed/v1/place endpoint once we wire up the env var.
  const src = `https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`;
  return (
    <div className="border-border bg-card overflow-hidden rounded-xl border">
      <iframe
        src={src}
        title={`Map of ${name ?? "this venue"}`}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="block h-[280px] w-full border-0"
      />
    </div>
  );
}

function PreviewSection({
  venue,
  v,
}: {
  venue: MyVenue;
  v: FormState;
}) {
  // Static guest-side preview of the venue card. Mirrors the dark
  // theme the guest app uses (per the theme-strategy memory) so the
  // manager sees what their place will actually look like on the
  // other side. Pulls the working form state for name/category/
  // description so the preview reacts as the manager types.
  const cover = v.photos[0] ?? null;
  const description = (v.description || venue.description || "").trim();
  const stars = venue.mesita_stars_overall ?? venue.google_stars_overall;
  return (
    <Section title="Preview" right={<span className={TINY_LABEL_CLASS}>Guest view</span>}>
      <div className="bg-foreground text-background flex flex-col overflow-hidden rounded-2xl">
        <div className="bg-muted/40 relative aspect-[4/3] w-full">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover}
              alt={v.name || venue.name || "Cover"}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="text-muted-foreground/60 flex h-full w-full items-center justify-center text-[11px] italic">
              Add a photo in Media — the cover renders here.
            </div>
          )}
          {venue.price_level != null && (
            <span className="absolute right-3 bottom-3 inline-flex items-center rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-white backdrop-blur-sm">
              {"$".repeat(venue.price_level)}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-2 p-4">
          <div className="flex items-start justify-between gap-3">
            <h4 className="font-display truncate text-base font-semibold">
              {v.name || venue.name || "Venue name"}
            </h4>
            {stars != null && (
              <span className="text-secondary inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold tabular-nums">
                <Star className="h-3 w-3 fill-current" />
                {stars.toFixed(1)}
              </span>
            )}
          </div>
          <p className="text-background/70 text-[11px] tracking-wider uppercase">
            {v.category || venue.category || "Category"}
          </p>
          {description && (
            <p className="text-background/80 line-clamp-3 text-[12px] leading-snug">
              {description}
            </p>
          )}
          {v.tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {v.tags.slice(0, 6).map((t) => (
                <span
                  key={t}
                  className="bg-background/15 rounded-full px-2 py-0.5 text-[10px] font-medium"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
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
  // Compact density: previously the section stacked a full ReadOnly card
  // for Timezone, a fully bordered HoursEditor card, and another full
  // ReadOnly card for Popular times — three nested cards inside the
  // section card. Now: timezone collapses to a one-line muted caption,
  // HoursEditor drops its own card chrome (just hairlines between days),
  // Popular times collapses to a one-line italic caption.
  return (
    <Section title="Time">
      <p className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
        <Clock className="h-3.5 w-3.5" />
        <span>{venue.timezone ?? "Timezone — not found yet."}</span>
      </p>

      <HoursEditor hours={v.hours} onChange={(hours) => set("hours", hours)} />

      {/* Popular Times is M-Place-V=NO in Notion right now — Google's
          Places API doesn't expose it, so we'd need a third-party
          scraper before this turns into real data. */}
      <p className="text-muted-foreground/80 flex items-center gap-1.5 text-[11px] italic">
        <Sparkles className="h-3.5 w-3.5 shrink-0" />
        <span>Popular times — coming soon from your Google profile.</span>
      </p>
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
  // Index of the photo currently shown in the lightbox, or null if
  // closed. Tiny thumbnails get the user a dense overview; clicking
  // pops the full-resolution image in a modal so they can actually
  // see the thing.
  const [zoomIdx, setZoomIdx] = useState<number | null>(null);

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
      title="Media"
      right={
        <span className={TINY_LABEL_CLASS}>
          {photos.length} / {MAX_PHOTOS}
        </span>
      }
    >
      {photos.length === 0 ? (
        <p className="bg-muted text-muted-foreground rounded-xl px-3 py-3 text-xs">
          No photos yet.
        </p>
      ) : (
        <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
          {photos.map((src, idx) => (
            <li
              key={`${src}-${idx}`}
              className="group border-border bg-muted relative overflow-hidden rounded-lg border"
            >
              <button
                type="button"
                onClick={() => setZoomIdx(idx)}
                aria-label={`Open ${venueName || "venue"} photo ${idx + 1}`}
                className="block aspect-square w-full"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={`${venueName || "Venue"} photo ${idx + 1}`}
                  className="h-full w-full object-cover transition group-hover:scale-105"
                />
              </button>
              {idx === 0 && (
                <span className="bg-foreground text-background pointer-events-none absolute top-1 left-1 rounded-full px-1.5 py-0.5 text-[8px] font-bold tracking-wider uppercase">
                  Cover
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-0.5 bg-gradient-to-t from-black/80 to-transparent p-1 opacity-0 transition group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => move(idx, -1)}
                  aria-label="Move earlier"
                  disabled={idx === 0}
                  className="text-foreground flex h-5 w-5 items-center justify-center rounded-full bg-white/95 transition hover:bg-white disabled:opacity-40"
                >
                  <ArrowLeft className="h-2.5 w-2.5" />
                </button>
                <button
                  type="button"
                  onClick={() => move(idx, 1)}
                  aria-label="Move later"
                  disabled={idx === photos.length - 1}
                  className="text-foreground flex h-5 w-5 items-center justify-center rounded-full bg-white/95 transition hover:bg-white disabled:opacity-40"
                >
                  <ArrowRight className="h-2.5 w-2.5" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  aria-label="Remove photo"
                  className="bg-destructive ml-auto flex h-5 w-5 items-center justify-center rounded-full text-white transition hover:opacity-90"
                >
                  <X className="h-2.5 w-2.5" />
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

      {zoomIdx != null && photos[zoomIdx] && (
        <PhotoLightbox
          src={photos[zoomIdx]}
          alt={`${venueName || "Venue"} photo ${zoomIdx + 1}`}
          onClose={() => setZoomIdx(null)}
        />
      )}
    </Section>
  );
}

function PhotoLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  // Minimal full-screen image preview. Click backdrop or hit Escape to
  // close. Doesn't pull in a heavy modal library — for read-only image
  // zoom this is all the affordance the manager needs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Photo preview"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6 backdrop-blur"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
      />
      <button
        type="button"
        onClick={onClose}
        aria-label="Close preview"
        className="text-foreground absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 transition hover:bg-white"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
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
    <Section title="Product">
      <Field label="Menu PDF link">
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

// Prefixed with `_` to satisfy the project's `no-unused-vars` rule while
// the section is intentionally not rendered. Bring it back in the form
// JSX without renaming when Channels returns to scope.
function _ChannelsSection({
  v,
  set,
}: {
  v: FormState;
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  // Header counter tracks just the Primary fields — that's the row of
  // canonical contact channels we care about for "completeness." PR and
  // Secondary are optional add-ons, not gating signals.
  const primaryFields = [
    v.phone,
    v.whatsapp_url,
    v.email,
    v.website_url,
    v.instagram_url,
  ];
  const filled = primaryFields.filter((f) => f.trim() !== "").length;
  return (
    <Section
      title="Channels"
      right={
        <span className={TINY_LABEL_CLASS}>
          {filled} / {primaryFields.length}
        </span>
      }
    >
      {/* Primary — direct contact endpoints. Notion category: Primary
          Channels. */}
      <div className="flex flex-col gap-2">
        <p className={TINY_LABEL_CLASS}>Primary</p>
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
      </div>

      {/* PR — promoter / influencer endpoints. Each field accepts a list
          because a venue often has several PR contacts. Notion category:
          PR Channels. */}
      <div className="flex flex-col gap-2">
        <p className={TINY_LABEL_CLASS}>PR</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <UrlListField
            label="WhatsApp PR numbers"
            icon={<MessageCircle className="h-4 w-4" />}
            values={v.whatsapp_pr_urls}
            onChange={(next) => set("whatsapp_pr_urls", next)}
            placeholder="https://wa.me/52…"
          />
          <UrlListField
            label="Instagram PR usernames"
            icon={<Instagram className="h-4 w-4" />}
            values={v.instagram_pr_urls}
            onChange={(next) => set("instagram_pr_urls", next)}
            placeholder="https://instagram.com/…"
          />
        </div>
      </div>

      {/* Secondary — discovery / cross-platform presence. Notion category:
          Secundary Channels. */}
      <div className="flex flex-col gap-2">
        <p className={TINY_LABEL_CLASS}>Secondary</p>
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
            label="Rappi"
            icon={<ShoppingBag className="h-4 w-4" />}
            placeholder="https://www.rappi.com/restaurants/…"
            value={v.rappi_url}
            onChange={(val) => set("rappi_url", val)}
          />
          <UrlField
            label="Uber Eats"
            icon={<UtensilsCrossed className="h-4 w-4" />}
            placeholder="https://www.ubereats.com/store/…"
            value={v.uber_eats_url}
            onChange={(val) => set("uber_eats_url", val)}
          />
        </div>
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
    {
      label: "Google",
      value: venue.google_stars_overall,
      logo: <GoogleLogo size={12} />,
    },
    {
      label: "Overall",
      value: venue.mesita_stars_overall,
      logo: <MesitaLogo size={12} />,
    },
    {
      label: "Food",
      value: venue.mesita_stars_food,
      logo: <MesitaLogo size={12} />,
    },
    {
      label: "Service",
      value: venue.mesita_stars_service,
      logo: <MesitaLogo size={12} />,
    },
    {
      label: "Ambience",
      value: venue.mesita_stars_ambience,
      logo: <MesitaLogo size={12} />,
    },
  ];
  const counts: {
    label: string;
    value: string;
    logo: React.ReactNode;
  }[] = [
    {
      label: "Google",
      value: visitorReview(
        venue.google_visitor_count,
        venue.google_review_count,
      ),
      logo: <GoogleLogo size={12} />,
    },
    {
      label: "Mesita",
      value: visitorReview(
        venue.mesita_visitor_count,
        venue.mesita_review_count,
      ),
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
      right={<span className={TINY_LABEL_CLASS}>Read-only</span>}
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {stars.map((s) => (
          <div
            key={s.label}
            className="border-border bg-muted/40 flex flex-col rounded-xl border p-2.5"
          >
            <p className={cn(TINY_LABEL_CLASS, "flex items-center gap-1")}>
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
            <p className={cn(TINY_LABEL_CLASS, "flex items-center gap-1")}>
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

  const setRange = (key: DayKey, idx: number, patch: Partial<HoursRange>) => {
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
    setDay(key, {
      ...day,
      ranges: ranges.length > 0 ? ranges : [{ open: "", close: "" }],
    });
  };

  const markClosed = (key: DayKey) => setDay(key, { closed: true, ranges: [] });

  const reopen = (key: DayKey) =>
    setDay(key, { closed: false, ranges: [{ open: "", close: "" }] });

  // Compact density: no outer card chrome (the parent Section already
  // provides it). Hairline `divide-y` separates days. Each row is a
  // single line:
  //   [DAY]  [shift 1]  [· shift 2 ×]?  [+ shift]?            [Close/Reopen]
  // Closed days collapse to italic "Closed" text, dim the row background,
  // and swap the right-edge button to the filled "Reopen" action.
  return (
    <div className="divide-border/60 -mx-1 divide-y">
      {DAYS.map(({ key, label }) => {
        const d = hours[key];
        const isClosed = d.closed;
        return (
          <div
            key={key}
            className={cn(
              "flex flex-wrap items-center gap-x-2 gap-y-1 px-1 py-1.5 transition",
              isClosed && "bg-muted/30 rounded-md",
            )}
          >
            <span className="text-muted-foreground w-7 shrink-0 text-[10px] font-bold tracking-[0.14em] uppercase">
              {label}
            </span>

            {isClosed ? (
              <span className="text-muted-foreground/80 flex-1 text-[11px] italic">
                Closed all day
              </span>
            ) : (
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-1">
                {d.ranges.map((r, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    {idx > 0 && (
                      <span className="text-muted-foreground/50 mr-0.5 text-[10px] select-none">
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
                      className="bg-background border-border focus:border-foreground/40 h-6 w-[50px] rounded-md border px-1 text-center text-[11px] tabular-nums outline-none"
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
                      className="bg-background border-border focus:border-foreground/40 h-6 w-[50px] rounded-md border px-1 text-center text-[11px] tabular-nums outline-none"
                    />
                    {d.ranges.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeShift(key, idx)}
                        aria-label="Remove this shift"
                        className="text-muted-foreground/70 hover:text-destructive ml-0.5 flex h-4 w-4 items-center justify-center rounded-full transition"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </div>
                ))}
                {d.ranges.length < MAX_SHIFTS_PER_DAY && (
                  <button
                    type="button"
                    onClick={() => addShift(key)}
                    className="text-muted-foreground/70 hover:text-foreground inline-flex items-center gap-0.5 text-[10px] font-medium"
                  >
                    <Plus className="h-2.5 w-2.5" />
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
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase transition",
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

function UrlListField({
  label,
  icon,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  icon: React.ReactNode;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  // Chip-list editor for the PR Channels fields (whatsapp_pr_urls,
  // instagram_pr_urls). Reads the same flow as TagsEditor: draft input
  // appends on Enter / Add click, each committed value renders as a
  // removable row above the input.
  const [draft, setDraft] = useState("");
  const add = () => {
    const next = draft.trim();
    if (!next) return;
    if (values.includes(next)) {
      setDraft("");
      return;
    }
    onChange([...values, next]);
    setDraft("");
  };
  const remove = (idx: number) =>
    onChange(values.filter((_, i) => i !== idx));
  return (
    <label className="block">
      <span className="text-muted-foreground mb-1.5 flex items-center gap-1.5 text-xs font-medium">
        <span className="text-foreground/70">{icon}</span>
        {label}
      </span>
      <div className="border-border bg-card flex flex-col gap-2 rounded-xl border p-2">
        {values.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {values.map((val, idx) => (
              <li
                key={`${val}-${idx}`}
                className="bg-muted flex items-center gap-2 rounded-lg px-2.5 py-1.5"
              >
                <span className="flex-1 truncate font-mono text-[12px]">
                  {val}
                </span>
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  aria-label={`Remove ${val}`}
                  className="text-muted-foreground hover:text-destructive shrink-0"
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            onBlur={add}
            placeholder={placeholder ?? "https://…"}
            spellCheck={false}
            autoCapitalize="none"
            className="placeholder:text-muted-foreground min-w-[100px] flex-1 bg-transparent px-1 text-sm outline-none"
          />
          <button
            type="button"
            onClick={add}
            disabled={!draft.trim()}
            className="bg-foreground text-background flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold disabled:opacity-50"
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        </div>
      </div>
    </label>
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
        placeholder={
          tags.length === 0 ? "Add tag and press enter" : "Add another"
        }
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

function visitorReview(
  visitors: number | null,
  reviews: number | null,
): string {
  if (visitors == null && reviews == null) return "—";
  const v = visitors == null ? "—" : formatCount(visitors);
  const r = reviews == null ? "—" : formatCount(reviews);
  return `${v} · ${r} reviews`;
}
