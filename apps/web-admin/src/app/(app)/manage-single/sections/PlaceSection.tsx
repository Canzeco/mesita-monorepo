"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  ExternalLink,
  Globe,
  ImagePlus,
  Images,
  Info,
  Loader2,
  MapPin,
  Store,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  getPlaceEnrichment,
  listPlaceTagCatalog,
  type AdminPlace,
  type PlaceFieldLimits,
  type PlaceMediaMeta,
} from "../actions";
import { PlaceTagsPicker } from "../PlaceTagsPicker";
import { PlaceCategorySelect } from "../PlaceCategorySelect";
import { PlaceSuperCategoryField } from "../PlaceSuperCategoryField";
import { ReviewsSummary } from "./ReviewsSummary";
import {
  OpenLink,
  PhoneField,
  ReadField,
  SectionCard,
  TextArea,
  TextField,
} from "@/components/admin-ui/manage";
import { usePlaceContext } from "../PlaceContext";
import { useSectionSaver } from "../useSectionDirty";
import { ErrorNote } from "@/components/ErrorNote";
import { formatAbsoluteUtc } from "@/lib/format";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import {
  formatPlacePriceRange,
  MAX_PRICE_LEVEL,
  priceLevelName,
} from "../place-price";
import {
  ALLOWED_IMAGE_ACCEPT,
  PLACE_IMAGES_BUCKET,
  placeImageObjectPath,
  validateUploadFile,
} from "@/lib/place-upload-utils";

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;
type Day = (typeof DAYS)[number];

const str = (v: unknown) => (typeof v === "string" ? v : "");

// Brand marks live in /public/channels (Simple Icons SVGs, same set as
// consumer). Generic contact fields keep lucide fallbacks.
const CHANNELS: {
  key: keyof AdminPlace;
  label: string;
  logo?: string;
  Icon?: LucideIcon;
  /** Native-locked — shown read-only, never patched (MESITA-468). */
  readOnly?: boolean;
}[] = [
  { key: "website_url", label: "Website", Icon: Globe },
  { key: "instagram_url", label: "Instagram", logo: "/channels/instagram.svg" },
  { key: "facebook_url", label: "Facebook", logo: "/channels/facebook.svg" },
  { key: "whatsapp_url", label: "WhatsApp", logo: "/channels/whatsapp.svg" },
  {
    key: "google_maps_url",
    label: "Google Maps",
    logo: "/channels/googlemaps.svg",
    readOnly: true,
  },
  {
    key: "uber_eats_url",
    label: "Uber Eats",
    logo: "/channels/ubereats-mark.svg",
  },
  { key: "opentable_url", label: "OpenTable", logo: "/channels/opentable.svg" },
];

const EDITABLE_CHANNELS = CHANNELS.filter((c) => !c.readOnly);

function ChannelLabelIcon({
  logo,
  Icon,
}: {
  logo?: string;
  Icon?: LucideIcon;
}) {
  if (logo) {
    // Static 14px brand SVG — next/image adds nothing here.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logo} alt="" aria-hidden className="h-3.5 w-3.5 shrink-0" />
    );
  }
  if (Icon) {
    return <Icon className="text-muted-foreground h-3.5 w-3.5 shrink-0" />;
  }
  return null;
}

// Price is Google-Places inferred — read-only. Filled $ + dimmed remainder
// plus the numeric band already implied by price_level + currency.
function PriceDisplay({
  level,
  currency,
}: {
  level: number | null | undefined;
  currency: string | null | undefined;
}) {
  const name = priceLevelName(level);
  if (name == null || level == null) {
    return <span className="text-muted-foreground">—</span>;
  }
  const n = Math.min(MAX_PRICE_LEVEL, Math.round(level));
  const range = formatPlacePriceRange(level, currency);
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <span className="font-semibold tracking-wide">
        <span className="text-foreground">{"$".repeat(n)}</span>
        <span className="text-muted-foreground/40">
          {"$".repeat(MAX_PRICE_LEVEL - n)}
        </span>
      </span>
      <span className="text-muted-foreground">{name}</span>
      {range ? <span className="text-muted-foreground">{range}</span> : null}
    </span>
  );
}

type DayHours = { closed: boolean; open: string; close: string };
// Address is deliberately absent: it is native (Google/Intaker-sourced) and
// business-web-update-project rejects manual writes — Location renders read-only.
type Form = {
  /** Operator override → places.mesita_name. Blank ⇒ the place follows Google. */
  mesitaName: string;
  category: string;
  /** Canonical Presentation — English (Mesita core). The column stays
   * `description`; the FIELD is Presentation (Pato, 2026-08-23). */
  description: string;
  phone: string;
  tags: string[];
  photos: string[];
  channels: Record<string, string>;
  hours: Record<Day, DayHours>;
};

// Fallback only until admin-web-get-atlas-fields returns; never the source of truth.
const FALLBACK_LIMITS: PlaceFieldLimits = {
  placeNameMax: 80,
  descriptionMax: 2000,
  tagsPerPlaceMax: 20,
  photosMax: 10,
};

function placeToForm(
  v: AdminPlace,
  limits: PlaceFieldLimits = FALLBACK_LIMITS,
): Form {
  const hours = {} as Record<Day, DayHours>;
  for (const d of DAYS) {
    const ranges = v.hours?.[d];
    const first = Array.isArray(ranges) ? ranges[0] : undefined;
    hours[d] = first
      ? { closed: false, open: first.open ?? "", close: first.close ?? "" }
      : { closed: true, open: "", close: "" };
  }
  const channels: Record<string, string> = {};
  for (const c of CHANNELS) channels[c.key as string] = str(v[c.key]);
  return {
    mesitaName: (v.mesita_name ?? "").slice(0, limits.placeNameMax),
    category: v.category ?? "",
    description: (v.description ?? "").slice(0, limits.descriptionMax),
    phone: v.phone ?? "",
    tags: (v.tags ?? []).slice(0, limits.tagsPerPlaceMax),
    // NOT sliced to photosMax — see the over-cap note on the Photos box.
    photos: v.photos ?? [],
    channels,
    hours,
  };
}

// Build a partial business-update-project patch for one Place box.
// Empty strings become null so a cleared field actually clears.
type PlaceBox = "basics" | "time" | "channels" | "photos";

function boxToPatch(
  box: PlaceBox,
  f: Form,
  id: string,
  limits: PlaceFieldLimits,
): Record<string, unknown> & { id: string } {
  const nz = (s: string) => (s.trim() ? s.trim() : null);
  if (box === "basics") {
    // Empty Mesita name clears the override → UI falls back to google_name.
    const mesitaName = f.mesitaName.trim().slice(0, limits.placeNameMax);
    return {
      id,
      mesita_name: mesitaName.length > 0 ? mesitaName : null,
      description: nz(f.description.slice(0, limits.descriptionMax)),
      tags: f.tags.slice(0, limits.tagsPerPlaceMax),
      // decision: Pato (MESITA-469) — admin may set category (Intaker + Admin + Business).
      category: nz(f.category) || "undefined",
    };
  }
  if (box === "time") {
    const hours: Record<string, { open: string; close: string }[]> = {};
    for (const d of DAYS) {
      const h = f.hours[d];
      if (!h.closed && h.open && h.close)
        hours[d] = [{ open: h.open, close: h.close }];
    }
    return { id, hours };
  }
  if (box === "channels") {
    const patch: Record<string, unknown> & { id: string } = {
      id,
      phone: nz(f.phone),
    };
    for (const c of EDITABLE_CHANNELS)
      patch[c.key as string] = nz(f.channels[c.key as string]);
    return patch;
  }
  return { id, photos: f.photos };
}

function sliceEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function PlaceSection({
  place,
  children,
}: {
  place: AdminPlace;
  /** Extra Place-page boxes (Menus) — flow in the same masonry columns. */
  children?: React.ReactNode;
}) {
  const [limits, setLimits] = useState<PlaceFieldLimits>(FALLBACK_LIMITS);
  const [form, setForm] = useState<Form>(() => placeToForm(place));
  const [saved, setSaved] = useState<Form>(form);
  const [errors, setErrors] = useState<Partial<Record<PlaceBox, string>>>({});

  const dirtyBasics = useMemo(
    () =>
      !sliceEqual(
        {
          mesitaName: form.mesitaName,
          description: form.description,
          tags: form.tags,
          category: form.category,
        },
        {
          mesitaName: saved.mesitaName,
          description: saved.description,
          tags: saved.tags,
          category: saved.category,
        },
      ),
    [
      form.mesitaName,
      form.description,
      form.tags,
      form.category,
      saved.mesitaName,
      saved.description,
      saved.tags,
      saved.category,
    ],
  );
  const dirtyTime = useMemo(
    () => !sliceEqual(form.hours, saved.hours),
    [form.hours, saved.hours],
  );
  const dirtyChannels = useMemo(
    () =>
      !sliceEqual(
        { channels: form.channels, phone: form.phone },
        { channels: saved.channels, phone: saved.phone },
      ),
    [form.channels, form.phone, saved.channels, saved.phone],
  );
  const dirtyPhotos = useMemo(
    () => !sliceEqual(form.photos, saved.photos),
    [form.photos, saved.photos],
  );

  const placeDirty = dirtyBasics || dirtyTime || dirtyChannels || dirtyPhotos;

  const { savePending } = usePlaceContext();

  // Four boxes, ONE patch. Only the dirty ones contribute, so a save never
  // rewrites columns nobody touched — which matters for Basics in particular,
  // where re-sending an untouched `description` would count as an operator
  // overwrite of Intaker output.
  useSectionSaver(
    "place",
    placeDirty,
    () => {
      const parts: Record<string, unknown>[] = [];
      if (dirtyBasics) parts.push(boxToPatch("basics", form, place.id, limits));
      if (dirtyTime) parts.push(boxToPatch("time", form, place.id, limits));
      if (dirtyChannels)
        parts.push(boxToPatch("channels", form, place.id, limits));
      if (dirtyPhotos) parts.push(boxToPatch("photos", form, place.id, limits));
      if (form.photos.length > limits.photosMax) {
        const over = form.photos.length - limits.photosMax;
        return {
          kind: "invalid" as const,
          error: `This place has ${form.photos.length} photos and the ceiling is ${limits.photosMax}. Remove ${over} to save.`,
        };
      }
      if (parts.length === 0) return { kind: "clean" as const };
      return {
        kind: "patch" as const,
        patch: Object.assign({}, ...parts) as Record<string, unknown>,
      };
    },
    (fresh) => {
      const next = placeToForm(fresh, limits);
      setForm(next);
      setSaved(next);
      setErrors({});
    },
    () => {
      const next = placeToForm(place, limits);
      setForm(next);
      setSaved(next);
      setErrors({});
    },
  );

  const anyPending = savePending;

  const set = <K extends keyof Form>(k: K, val: Form[K]) =>
    setForm((f) => ({ ...f, [k]: val }));
  const setChannel = (key: string, val: string) =>
    setForm((f) => ({ ...f, channels: { ...f.channels, [key]: val } }));
  const setDay = (d: Day, patch: Partial<DayHours>) =>
    setForm((f) => ({
      ...f,
      hours: { ...f.hours, [d]: { ...f.hours[d], ...patch } },
    }));

  const [uploading, setUploading] = useState(false);

  // Never truncates: removing is the operator's call, and an over-cap place
  // must be able to reorder and delete its way down rather than lose the tail
  // silently. The cap is enforced on ADD (uploadPhoto) and at save.
  const setPhotos = (photos: string[]) => set("photos", photos);

  const uploadPhoto = async (file: File) => {
    if (uploading || anyPending) return;
    if (form.photos.length >= limits.photosMax) {
      setErrors((e) => ({
        ...e,
        photos: `At most ${limits.photosMax} photos.`,
      }));
      return;
    }
    const fileError = validateUploadFile(file);
    if (fileError) {
      setErrors((e) => ({ ...e, photos: fileError }));
      return;
    }
    setUploading(true);
    setErrors((e) => ({ ...e, photos: undefined }));
    try {
      const supabase = createBrowserSupabase();
      const path = placeImageObjectPath(place.id, file);
      const { error: uploadError } = await supabase.storage
        .from(PLACE_IMAGES_BUCKET)
        .upload(path, file, {
          upsert: false,
          contentType: file.type,
          cacheControl: "31536000",
        });
      if (uploadError) {
        throw new Error(uploadError.message);
      }
      const { data } = supabase.storage
        .from(PLACE_IMAGES_BUCKET)
        .getPublicUrl(path);
      if (!data?.publicUrl) {
        throw new Error("Upload succeeded but no public URL was returned.");
      }
      setPhotos([...form.photos, data.publicUrl]);
    } catch (err) {
      setErrors((e) => ({
        ...e,
        photos:
          err instanceof Error ? err.message : "Couldn't upload that photo.",
      }));
    } finally {
      setUploading(false);
    }
  };

  const movePhoto = (from: number, dir: -1 | 1) => {
    const to = from + dir;
    if (to < 0 || to >= form.photos.length) return;
    const next = form.photos.slice();
    [next[from], next[to]] = [next[to], next[from]];
    setPhotos(next);
  };

  const removePhoto = (idx: number) =>
    setPhotos(form.photos.filter((_, i) => i !== idx));

  // Per-place Intaker inspector data — per-photo metadata (source + vision
  // analysis) for the ⓘ dialog, keyed by image URL. Loads once; the live
  // enriching status (and its poll) lives on the Admin tab's Metadata card.
  const [media, setMedia] = useState<Record<string, PlaceMediaMeta>>({});
  const [metaFor, setMetaFor] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    // Field limits come from the same EF Atlas Config uses — never hardcode.
    listPlaceTagCatalog().then((r) => {
      if (!alive || !r.ok) return;
      setLimits(r.data.fieldLimits);
      setForm((f) => ({
        ...f,
        mesitaName: f.mesitaName.slice(0, r.data.fieldLimits.placeNameMax),
        description: f.description.slice(0, r.data.fieldLimits.descriptionMax),
        tags: f.tags.slice(0, r.data.fieldLimits.tagsPerPlaceMax),
      }));
    });
    getPlaceEnrichment(place.id).then((r) => {
      if (!alive) return;
      setMedia(r.ok ? r.data.media : {});
    });
    return () => {
      alive = false;
    };
  }, [place.id]);

  return (
    // Masonry, not a grid: CSS columns pack the cards top-down, so a short
    // card never strands empty space beside a tall neighbour — columns don't
    // row-align by design (MESITA-399). Every card roots as a <section>
    // (SectionCard) and gets the gutter margin + break-inside-avoid via
    // [&>section]; the fixed photo dialog is a <div>, exempt and out of flow.
    // lg (not xl): admin content + sidebar rarely reaches 1280px of free width.
    <div className="columns-1 gap-4 pb-8 [&>section]:mb-4 [&>section]:break-inside-avoid [&>details]:mb-4 [&>details]:break-inside-avoid lg:columns-2 lg:gap-5 lg:pb-10 lg:[&>section]:mb-5 lg:[&>details]:mb-5">
      {/* Box order (MESITA-547 / MESITA-720 / MESITA-834 / MESITA-900;
          Basics, Location and Hours are separate cards — Pato, 2026-08-29):
          Basics → Location → Hours → Channels → Photos → Menus (children) →
          Reviews. Mesita-internal cards live on Admin; Team on Controls; the
          reputation rail on Activity. */}
      <SectionCard
        icon={<Store className="h-4 w-4" />}
        tint="rose"
        title="Basics"
        subtitle="What this place is."
      >
        <div className="mt-5 grid gap-4">
          <TextField
            label="Mesita name"
            value={form.mesitaName}
            onChange={(x) => set("mesitaName", x.slice(0, limits.placeNameMax))}
            maxLength={limits.placeNameMax}
            disabled={anyPending}
            placeholder={(place.google_name ?? "").trim() || undefined}
          />
          <ReadField label="Google name" auto boxed>
            {(place.google_name ?? "").trim() || "—"}
          </ReadField>
        </div>
        {/* One field per row — the whole card is a single column. */}
        <div className="mt-4 grid gap-4">
          <ReadField label="Google price" auto boxed>
            <PriceDisplay level={place.price_level} currency={place.currency} />
          </ReadField>
          <PlaceSuperCategoryField
            category={form.category ?? ""}
            familyKeys={place.family_keys ?? null}
          />
          <PlaceCategorySelect
            value={form.category ?? ""}
            onChange={(slug) => set("category", slug)}
            disabled={anyPending}
            googleLabel={place.category_label}
          />
        </div>
        <div className="mt-4 grid gap-4">
          <TextArea
            label="Presentation"
            labelRight={
              <span className="text-muted-foreground type-label tabular-nums">
                {form.description.length} / {limits.descriptionMax}
              </span>
            }
            value={form.description}
            onChange={(x) =>
              set("description", x.slice(0, limits.descriptionMax))
            }
            rows={7}
            maxLength={limits.descriptionMax}
            disabled={anyPending}
          />
        </div>
        <div className="mt-4">
          <PlaceTagsPicker
            value={form.tags}
            onChange={(tags) =>
              set("tags", tags.slice(0, limits.tagsPerPlaceMax))
            }
            disabled={anyPending}
          />
        </div>
        {errors.basics ? <ErrorNote message={errors.basics} /> : null}
      </SectionCard>

      {/* Location is native — Google Places seed + Intaker synthesis.
          The EF rejects manual address writes, so this card is read-only. */}
      <SectionCard
        icon={<MapPin className="h-4 w-4" />}
        tint="sky"
        title="Location"
        subtitle="Where it sits."
      >
        {/* One boxed field per row — same filled-input language as every
            other card. Lat/Lng share one box (a coordinate pair is one
            fact); everything else stacks. */}
        <div className="mt-5 grid gap-4">
          <ReadField label="Address" auto boxed>
            {place.address?.trim() ? place.address : "—"}
          </ReadField>
          <ReadField label="Zone" auto boxed>
            {place.zone ?? "—"}
          </ReadField>
          <ReadField label="City" auto boxed>
            {place.city ?? "—"}
          </ReadField>
          <ReadField label="Lat / Lng" auto boxed>
            <span className="font-mono type-body tabular-nums">
              {place.lat == null || place.lng == null
                ? "—"
                : `${place.lat}, ${place.lng}`}
            </span>
          </ReadField>
          <ReadField label="Timezone" auto boxed>
            {place.timezone?.trim() ? place.timezone : "—"}
          </ReadField>
        </div>
        {place.lat != null && place.lng != null ? (
          <div className="border-border/60 mt-4 overflow-hidden rounded-xl border">
            <iframe
              src={`https://maps.google.com/maps?q=${place.lat},${place.lng}&z=15&output=embed`}
              title={`Map of ${place.name}`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="block h-[160px] w-full border-0"
            />
          </div>
        ) : null}
      </SectionCard>

      <SectionCard
        icon={<Clock className="h-4 w-4" />}
        tint="amber"
        title="Hours"
        subtitle="When it opens."
      >
        <div className="border-border/60 divide-border/60 mt-5 divide-y overflow-hidden rounded-xl border">
          {DAYS.map((d) => {
            const h = form.hours[d];
            return (
              <div
                key={d}
                className={
                  "flex items-center gap-3 px-3.5 py-2.5 transition " +
                  (h.closed ? "bg-muted/30" : "")
                }
              >
                <span
                  className={
                    "w-20 shrink-0 text-sm font-medium capitalize " +
                    (h.closed ? "text-muted-foreground/70" : "")
                  }
                >
                  {d}
                </span>
                {h.closed ? (
                  <span className="text-muted-foreground/70 flex-1 text-xs italic">
                    Closed
                  </span>
                ) : (
                  <div className="flex flex-1 flex-wrap items-center gap-2">
                    <input
                      type="time"
                      value={h.open}
                      disabled={anyPending}
                      onChange={(e) => setDay(d, { open: e.target.value })}
                      className="bg-muted/60 border-border/60 focus:border-ring/60 focus:bg-card focus:ring-ring/10 h-8 rounded-lg border px-2 text-sm tabular-nums outline-none transition focus:ring-4"
                    />
                    <span className="text-muted-foreground text-xs">–</span>
                    <input
                      type="time"
                      value={h.close}
                      disabled={anyPending}
                      onChange={(e) => setDay(d, { close: e.target.value })}
                      className="bg-muted/60 border-border/60 focus:border-ring/60 focus:bg-card focus:ring-ring/10 h-8 rounded-lg border px-2 text-sm tabular-nums outline-none transition focus:ring-4"
                    />
                  </div>
                )}
                <button
                  type="button"
                  role="switch"
                  aria-checked={!h.closed}
                  aria-label={`${d} ${h.closed ? "closed" : "open"}`}
                  disabled={anyPending}
                  // Re-enabling a day must never surface empty --:-- inputs:
                  // seed the 9-to-9 default when no range was kept around.
                  onClick={() =>
                    setDay(
                      d,
                      h.closed
                        ? {
                            closed: false,
                            open: h.open || "09:00",
                            close: h.close || "21:00",
                          }
                        : { closed: true },
                    )
                  }
                  className={
                    "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition disabled:opacity-50 " +
                    (h.closed ? "bg-border" : "bg-pink-gradient")
                  }
                >
                  <span
                    className={
                      "absolute h-4 w-4 rounded-full bg-white shadow transition " +
                      (h.closed ? "translate-x-0.5" : "translate-x-4")
                    }
                  />
                </button>
              </div>
            );
          })}
        </div>
        {errors.time ? <ErrorNote message={errors.time} /> : null}
      </SectionCard>

      <SectionCard
        icon={<Globe className="h-4 w-4" />}
        tint="indigo"
        title="Channels"
      >
        {/* One column, one list — links and contacts are all just channels;
            no sub-grouping. grid-cols-1 (minmax(0,1fr)) bounds the column so a
            long unbreakable URL truncates instead of blowing the card wider
            than its masonry column. */}
        <div className="mt-5 grid grid-cols-1 gap-3.5">
          {CHANNELS.map((c) => {
            const val = form.channels[c.key as string] ?? "";
            if (c.readOnly) {
              return (
                <ReadField
                  key={c.key as string}
                  label={c.label}
                  boxed
                  auto
                  labelRight={val.trim() ? <OpenLink href={val} /> : undefined}
                >
                  {val.trim() ? (
                    <span className="min-w-0 truncate">{val}</span>
                  ) : (
                    "—"
                  )}
                </ReadField>
              );
            }
            if (c.key === "whatsapp_url") {
              // WhatsApp is a PHONE, not a link — same flag + dial-code picker
              // as Phone. Storage stays a wa.me URL (the update EF validates it
              // as a URL and consumers open it), so we convert on the edge:
              // PhoneField parses the digits out of the stored wa.me URL and we
              // re-wrap its E.164 output. Empty number clears the channel.
              return (
                <PhoneField
                  key={c.key as string}
                  label={c.label}
                  value={val}
                  onChange={(full) =>
                    setChannel(
                      c.key as string,
                      full ? `https://wa.me/${full.replace(/\D/g, "")}` : "",
                    )
                  }
                  placeholder="81 8378 2164"
                  disabled={anyPending}
                />
              );
            }
            return (
              <TextField
                key={c.key as string}
                label={c.label}
                leading={<ChannelLabelIcon logo={c.logo} Icon={c.Icon} />}
                labelRight={val.trim() ? <OpenLink href={val} /> : undefined}
                value={val}
                onChange={(x) => setChannel(c.key as string, x)}
                placeholder="https://…"
                disabled={anyPending}
              />
            );
          })}
          {/* Country code is mandatory (the update EF rejects phones without
              +CC) — the flag picker bakes it in, so the field only asks for
              the local number. */}
          <PhoneField
            label="Phone"
            value={form.phone}
            onChange={(x) => set("phone", x)}
            placeholder="81 8378 2164"
            disabled={anyPending}
          />
        </div>
        {errors.channels ? <ErrorNote message={errors.channels} /> : null}
      </SectionCard>

      <SectionCard
        icon={<Images className="h-4 w-4" />}
        tint="orange"
        title="Photos"
        action={
          <span
            className={
              "type-label tabular-nums " +
              (form.photos.length > limits.photosMax
                ? "text-destructive font-semibold"
                : "text-muted-foreground")
            }
          >
            {form.photos.length} / {limits.photosMax}
          </span>
        }
      >
        {form.photos.length > limits.photosMax ? (
          // The ceiling dropped to ten (MESITA-1237) and places enriched under
          // the old one still hold more. Say so, rather than quietly dropping
          // the tail on load and persisting that deletion at the next save.
          <p className="border-destructive/30 bg-destructive/5 text-destructive mt-4 rounded-xl border px-3.5 py-2.5 text-xs leading-relaxed">
            Over the ceiling by {form.photos.length - limits.photosMax}. Every
            photo below is still on the place — nothing has been dropped — but
            the page will not save until you remove{" "}
            {form.photos.length - limits.photosMax}.
          </p>
        ) : null}
        <PhotosEditor
          placeId={place.id}
          photos={form.photos}
          photosMax={limits.photosMax}
          pending={anyPending}
          uploading={uploading}
          onUpload={uploadPhoto}
          onMove={movePhoto}
          onRemove={removePhoto}
          onInfo={setMetaFor}
        />
        {errors.photos ? <ErrorNote message={errors.photos} /> : null}
      </SectionCard>

      {children}

      {/* Reviews closes the masonry (Pato live 2026-09-01): every card above
          is something an operator sets, this one is the only thing the world
          says back. Read-only, so it sits after the editable set. */}
      <ReviewsSummary place={place} />

      {metaFor !== null && (
        <MediaMetaDialog
          url={metaFor}
          meta={media[metaFor] ?? null}
          position={form.photos.indexOf(metaFor) + 1}
          total={form.photos.length}
          onClose={() => setMetaFor(null)}
        />
      )}
    </div>
  );
}

function PhotosEditor({
  placeId,
  photos,
  photosMax,
  pending,
  uploading,
  onUpload,
  onMove,
  onRemove,
  onInfo,
}: {
  placeId: string;
  photos: string[];
  photosMax: number;
  pending: boolean;
  uploading: boolean;
  onUpload: (file: File) => void | Promise<void>;
  onMove: (from: number, dir: -1 | 1) => void;
  onRemove: (idx: number) => void;
  onInfo: (url: string) => void;
}) {
  const inputId = `place-photo-upload-${placeId}`;
  const atCap = photos.length >= photosMax;
  const busy = pending || uploading;

  return (
    <div className="mt-5">
      <input
        id={inputId}
        type="file"
        accept={ALLOWED_IMAGE_ACCEPT}
        disabled={busy || atCap}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void onUpload(file);
        }}
      />

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {photos.map((src, idx) => (
          <div
            key={`${src}-${idx}`}
            className="group relative overflow-hidden rounded-xl ring-1 ring-black/5"
          >
            {/* The whole tile opens the metadata modal; the move/remove
                controls below sit above this button and stop propagation. */}
            <button
              type="button"
              onClick={() => onInfo(src)}
              className="block w-full cursor-pointer"
              aria-label={`Photo ${idx + 1} details`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`Photo ${idx + 1}`}
                className="aspect-square w-full object-cover transition duration-300 group-hover:scale-[1.03]"
              />
            </button>
            {idx === 0 && (
              <span className="bg-pink-gradient absolute top-2 left-2 rounded-full px-2 py-0.5 type-meta font-semibold tracking-wide text-white uppercase shadow-card">
                Hero
              </span>
            )}
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/70 via-black/25 to-transparent p-2 opacity-0 transition group-hover:opacity-100">
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={busy || idx === 0}
                  onClick={() => onMove(idx, -1)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 text-white backdrop-blur-sm transition hover:bg-white/30 disabled:opacity-40"
                  aria-label="Move earlier"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={busy || idx === photos.length - 1}
                  onClick={() => onMove(idx, 1)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 text-white backdrop-blur-sm transition hover:bg-white/30 disabled:opacity-40"
                  aria-label="Move later"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onRemove(idx)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 text-white backdrop-blur-sm transition hover:bg-red-500/70"
                  aria-label="Remove photo"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {!atCap && (
          <label
            htmlFor={inputId}
            className={
              "border-border text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/[0.03] flex aspect-square w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed text-center transition " +
              (busy ? "pointer-events-none opacity-50" : "")
            }
          >
            {uploading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="type-label font-medium">Uploading…</span>
              </>
            ) : (
              <>
                <ImagePlus className="h-5 w-5" />
                <span className="type-label font-medium">Add photo</span>
              </>
            )}
          </label>
        )}
      </div>

      {photos.length === 0 ? (
        <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
          No photos yet.
        </p>
      ) : (
        <p className="text-muted-foreground mt-3 type-label tabular-nums">
          {photos.length}/{photosMax} photos · JPG, PNG, WEBP, AVIF · max 8 MB
        </p>
      )}
    </div>
  );
}

const SOURCE_LABEL: Record<string, string> = {
  google: "Google",
  website: "Website",
  instagram: "Instagram",
};

const SOURCE_CHIP: Record<string, string> = {
  google: "bg-blue-500/10 text-blue-600",
  website: "bg-muted text-muted-foreground",
  instagram: "bg-pink-500/10 text-pink-600",
};

// Light markdown-ish renderer: preserves newlines and bolds **…** segments.
// The enricher analysis_text looks like "**Category:** … \n\n**Description:** …".
function AnalysisText({ text }: { text: string }) {
  return (
    <div className="text-foreground/90 text-sm leading-relaxed whitespace-pre-wrap">
      {text
        .split(/\*\*/)
        .map((seg, i) =>
          i % 2 === 1 ? (
            <strong key={i}>{seg}</strong>
          ) : (
            <span key={i}>{seg}</span>
          ),
        )}
    </div>
  );
}

const STATUS_CHIP: Record<string, string> = {
  saved: "bg-green-500/10 text-green-600",
  pending: "bg-amber-500/10 text-amber-600",
  failed: "bg-red-500/10 text-red-600",
};

// Turn the raw per-source `source_metadata` blob into labelled rows for display.
// Shapes: Instagram → { comments_count, timestamp, is_video, shortcode };
// website → { alt, page, width, height }. Everything is defensive — the blob is
// gathered upstream and may be partial.
function sourceMetaRows(
  source: string | null,
  meta: Record<string, unknown> | null,
): { label: string; value: string }[] {
  if (!meta) return [];
  const rows: { label: string; value: string }[] = [];
  const num = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  const strVal = (v: unknown) =>
    typeof v === "string" && v.trim() ? v.trim() : null;

  if (source === "instagram") {
    const comments = num(meta.comments_count);
    if (comments != null)
      rows.push({ label: "Comments", value: comments.toLocaleString() });
    if (meta.is_video === true)
      rows.push({ label: "Media type", value: "Video" });
    else if (meta.is_video === false)
      rows.push({ label: "Media type", value: "Photo" });
    const ts = meta.timestamp;
    let posted: string | null = null;
    if (typeof ts === "number" && Number.isFinite(ts)) {
      posted = formatAbsoluteUtc(new Date(ts * 1000).toISOString());
    } else if (typeof ts === "string" && ts.trim()) {
      const d = new Date(ts);
      posted = Number.isNaN(d.getTime())
        ? ts
        : formatAbsoluteUtc(d.toISOString());
    }
    if (posted) rows.push({ label: "Posted", value: posted });
    const shortcode = strVal(meta.shortcode);
    if (shortcode) rows.push({ label: "Shortcode", value: shortcode });
  } else if (source === "website") {
    const w = num(meta.width);
    const h = num(meta.height);
    if (w != null && h != null)
      rows.push({ label: "Dimensions", value: `${w}×${h}` });
    const page = strVal(meta.page);
    if (page) rows.push({ label: "Found on page", value: page });
    const alt = strVal(meta.alt);
    if (alt) rows.push({ label: "Alt text", value: alt });
  }
  return rows;
}

// Intaker inspector: shows one image's metadata — source, gallery order, save
// status, the pre-analysis source signals (likes/comments/dims/…), and the
// vision analysis text — in a small modal.
//
// This is Mesita-internal data but it deliberately stays on Place rather than
// moving to the Admin tab: it is a read-only lens on the tile you are curating,
// reachable only by clicking that tile, and hosting it on Admin would mean
// duplicating the whole gallery there to have something to click.
function MediaMetaDialog({
  url,
  meta,
  position,
  total,
  onClose,
}: {
  url: string;
  meta: PlaceMediaMeta | null;
  position: number;
  total: number;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const source = meta?.source ?? null;
  const sourceLabel = source
    ? (SOURCE_LABEL[source] ?? source)
    : "Unknown source";
  const chip =
    (source && SOURCE_CHIP[source]) || "bg-muted text-muted-foreground";
  const analysis = meta?.analysis_text?.trim() || null;
  const status = meta?.status ?? null;
  const statusChip =
    (status && STATUS_CHIP[status]) || "bg-muted text-muted-foreground";
  const metaRows = sourceMetaRows(source, meta?.source_metadata ?? null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="border-border/70 bg-card shadow-elev flex max-h-[80dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-border flex items-center justify-between gap-3 border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Info className="text-muted-foreground h-4 w-4" />
            <h3 className="text-sm font-semibold">Image metadata</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground hover:bg-muted/60 inline-flex h-7 w-7 items-center justify-center rounded-md transition"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="Photo"
            className="border-border aspect-square w-full rounded-lg border object-cover"
          />

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground text-xs font-medium">
              Order
            </span>
            {position > 0 ? (
              <span className="bg-muted text-foreground inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums">
                #{position} of {total}
                {position === 1 ? " · Hero" : ""}
              </span>
            ) : (
              <span className="text-muted-foreground text-xs italic">
                not in gallery
              </span>
            )}
            {status && (
              <span
                className={
                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold " +
                  statusChip
                }
              >
                {status}
              </span>
            )}
          </div>

          {!meta ? (
            <p className="text-muted-foreground text-sm italic">
              No information for this image yet — it hasn’t been analyzed by the
              Intaker.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground text-xs font-medium">
                  Source
                </span>
                <span
                  className={
                    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold " +
                    chip
                  }
                >
                  {sourceLabel}
                </span>
                {typeof meta?.likes_count === "number" && (
                  <span className="text-muted-foreground text-xs tabular-nums">
                    ♥ {meta.likes_count.toLocaleString()}
                  </span>
                )}
              </div>

              {meta?.caption && (
                <div>
                  <p className="text-muted-foreground mb-1 text-xs font-medium">
                    Caption
                  </p>
                  <p className="text-foreground/90 text-sm italic">
                    “{meta.caption}”
                  </p>
                </div>
              )}

              {metaRows.length > 0 && (
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                  {metaRows.map((row) => (
                    <div
                      key={row.label}
                      className="col-span-2 grid grid-cols-subgrid"
                    >
                      <dt className="text-muted-foreground text-xs font-medium">
                        {row.label}
                      </dt>
                      <dd className="text-foreground/90 min-w-0 break-words">
                        {row.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}

              <div>
                <p className="text-muted-foreground mb-1 text-xs font-medium">
                  Analysis
                </p>
                {analysis ? (
                  <AnalysisText text={analysis} />
                ) : (
                  <p className="text-muted-foreground text-sm italic">
                    Not analyzed — this image was saved but not
                    vision-described.
                  </p>
                )}
              </div>
            </>
          )}

          {meta?.source_url && (
            <a
              href={meta.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs font-medium"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View original source
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
