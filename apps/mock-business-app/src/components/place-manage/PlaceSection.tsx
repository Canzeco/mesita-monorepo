"use client";

// A SNAPSHOT of apps/web-business/src/components/place-manage/sections/
// PlaceSection.tsx — the five cards Profile is made of.
//
// Box order (MESITA-547 / 720 / 834 / 900; Basics, Location and Hours are
// separate cards — Pato, 2026-08-29): Basics → Location → Hours → Channels →
// Photos. Mesita-internal cards live on Admin; Team on Controls; the
// reputation rail on Activity; Menus left for its own address in MESITA-1848.
//
// FOUR THINGS ARE DIFFERENT, and every one of them is the missing backend:
//
//   1. The field limits are an import, not an Edge Function read. The real
//      file starts at a FALLBACK_LIMITS constant and narrows when
//      `business-web-get-atlas-fields` answers; here `FIELD_LIMITS` is simply
//      the answer.
//   2. An upload never leaves the tab. There it is a Supabase Storage PUT and
//      a public URL; here it is a FileReader and a data URI, which is the same
//      string in the same array as far as this screen is concerned.
//   3. The save builds the next PROFILE rather than a column patch. The real
//      `boxToPatch` exists so an untouched box never re-sends its columns —
//      re-sending `description` would count as an operator overwrite of
//      Intaker output — and there is no such hazard over a fixture. The
//      per-box dirty flags stay: they are what the save bar names.
//   4. The photo dialog is the "not analyzed" branch only. Profile passes
//      `meta={null}` in the real file too (per-photo Intaker analysis lives on
//      the Admin tab — a restaurant reading vision copy as if it were theirs is
//      the bug MESITA-1740 named), so everything under the other branch is
//      already unreachable there.

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Clock,
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
import { PlaceTagsPicker } from "./PlaceTagsPicker";
import { PlaceCategorySelect } from "./PlaceCategorySelect";
import { PlaceFamilyField } from "./PlaceFamilyField";
import {
  OpenLink,
  PhoneField,
  ReadField,
  SectionCard,
  TextArea,
  TextField,
} from "@/components/admin-ui/manage";
import { usePlaceContext, useSectionSaver } from "./PlaceContext";
import { ErrorNote } from "@/components/ErrorNote";
import {
  formatPlacePriceRange,
  MAX_PRICE_LEVEL,
  priceLevelName,
} from "./place-price";
import {
  ALLOWED_IMAGE_ACCEPT,
  validateUploadFile,
} from "@/lib/place-upload-utils";
import { ReviewsSummary } from "./ReviewsSummary";
import { FIELD_LIMITS } from "@/mock/atlas";
import type { MockDay, MockPlaceProfile } from "@/mock/types";

const DAYS: readonly MockDay[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const str = (v: unknown) => (typeof v === "string" ? v : "");

// Brand marks live in /public/channels (Simple Icons SVGs, same set as
// consumer). Generic contact fields keep lucide fallbacks.
//
// THE MOCK SHIPS THEM AND web-business DOES NOT. `apps/web-business/public`
// has no `channels/` folder at all, so in the real console every one of these
// paths 404s and each mark renders as an empty 14px box — `alt=""` and
// `aria-hidden`, so nothing says so and nothing fails. The six files are
// copied here from `apps/web-consumer/public/channels`, where they have always
// lived, because a mock exists to show what a screen IS, and a missing asset
// is a defect in the console rather than a thing about it worth mirroring.
const CHANNELS: {
  key: keyof MockPlaceProfile;
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
// business-web-update-place rejects manual writes — Location renders read-only.
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
  hours: Record<MockDay, DayHours>;
};

function placeToForm(v: MockPlaceProfile): Form {
  const hours = {} as Record<MockDay, DayHours>;
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
    mesitaName: (v.mesita_name ?? "").slice(0, FIELD_LIMITS.placeNameMax),
    category: v.category ?? "",
    description: (v.description ?? "").slice(0, FIELD_LIMITS.descriptionMax),
    phone: v.phone ?? "",
    tags: (v.tags ?? []).slice(0, FIELD_LIMITS.tagsPerPlaceMax),
    // NOT sliced to photosMax — see the over-cap note on the Photos box.
    photos: v.photos ?? [],
    channels,
    hours,
  };
}

/** The fields THIS card owns, built from the form. A partial, not a whole
 *  record: Menus is a second section on the same page and a full profile from
 *  each of them would mean whichever merged last reverted the other's work
 *  (PlaceContext's `SaveBuild`). `nz` is the real file's: an empty string
 *  becomes null so a cleared field actually clears. */
function formToProfile(f: Form): Partial<MockPlaceProfile> {
  const nz = (s: string) => (s.trim() ? s.trim() : null);
  const hours: Partial<Record<MockDay, { open: string; close: string }[]>> = {};
  for (const d of DAYS) {
    const h = f.hours[d];
    if (!h.closed && h.open && h.close) hours[d] = [{ open: h.open, close: h.close }];
  }
  const mesitaName = f.mesitaName.trim().slice(0, FIELD_LIMITS.placeNameMax);
  const channels = Object.fromEntries(
    EDITABLE_CHANNELS.map((c) => [c.key as string, nz(f.channels[c.key as string] ?? "")]),
  );
  return {
    // Empty Mesita name clears the override → the place falls back to google_name.
    mesita_name: mesitaName.length > 0 ? mesitaName : null,
    description: nz(f.description.slice(0, FIELD_LIMITS.descriptionMax)),
    tags: f.tags.slice(0, FIELD_LIMITS.tagsPerPlaceMax),
    // decision: Pato (MESITA-469) — admin may set category (Intaker + Admin + Business).
    category: nz(f.category) || "undefined",
    hours: Object.keys(hours).length > 0 ? hours : null,
    phone: nz(f.phone),
    photos: f.photos,
    ...channels,
  };
}

function sliceEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function PlaceSection({
  place,
  children,
}: {
  place: MockPlaceProfile;
  /** Extra Place-page boxes (Menus) — flow in the same masonry columns. */
  children?: React.ReactNode;
}) {
  const [form, setForm] = useState<Form>(() => placeToForm(place));
  const [saved, setSaved] = useState<Form>(form);
  const [errors, setErrors] = useState<{ photos?: string }>({});

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

  // FOUR BOXES, ONE SAVE. The label the bar prints names the dirty ones rather
  // than asserting that "something" is unsaved.
  const dirtyLabel = [
    dirtyBasics && "Basics",
    dirtyTime && "Hours",
    dirtyChannels && "Channels",
    dirtyPhotos && "Photos",
  ]
    .filter(Boolean)
    .join(" · ");

  useSectionSaver(
    "place",
    dirtyLabel || "Place",
    placeDirty,
    () => {
      if (form.photos.length > FIELD_LIMITS.photosMax) {
        const over = form.photos.length - FIELD_LIMITS.photosMax;
        return {
          kind: "invalid" as const,
          error: `This place has ${form.photos.length} photos and the ceiling is ${FIELD_LIMITS.photosMax}. Remove ${over} to save.`,
        };
      }
      if (!placeDirty) return { kind: "clean" as const };
      return { kind: "patch" as const, patch: formToProfile(form) };
    },
    (fresh) => {
      const next = placeToForm(fresh);
      setForm(next);
      setSaved(next);
      setErrors({});
    },
    () => {
      const next = placeToForm(place);
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
  const setDay = (d: MockDay, patch: Partial<DayHours>) =>
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
    if (form.photos.length >= FIELD_LIMITS.photosMax) {
      setErrors((e) => ({
        ...e,
        photos: `At most ${FIELD_LIMITS.photosMax} photos.`,
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
      // THE UPLOAD NEVER LEAVES THE TAB. A data URI rather than a Storage
      // public URL — an `<img src>` cannot tell the difference, and the one
      // rule this app has is that nothing it does reaches a network.
      const dataUrl = await readAsDataUrl(file);
      setPhotos([...form.photos, dataUrl]);
    } catch (err) {
      setErrors((e) => ({
        ...e,
        photos:
          err instanceof Error ? err.message : "Couldn't read that photo.",
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

  // Per-photo Intaker analysis lives on the Admin tab. The ⓘ dialog on
  // Profile only has gallery order — vision text and SERP are operator
  // internals (MESITA-1740).
  const [metaFor, setMetaFor] = useState<string | null>(null);

  return (
    // Masonry, not a grid: CSS columns pack the cards top-down, so a short
    // card never strands empty space beside a tall neighbour — columns don't
    // row-align by design (MESITA-399). Every card roots as a <section>
    // (SectionCard) and gets the gutter margin + break-inside-avoid via
    // [&>section]; the fixed photo dialog is a <div>, exempt and out of flow.
    // xl:columns-3 is for the BUSINESS console (MESITA-1558), which has no
    // sidebar and a fluid container, so at xl it genuinely has the ~1300px
    // three ~440px columns need — the measure these cards were drawn at.
    <div className="columns-1 gap-4 pb-8 [&>section]:mb-4 [&>section]:break-inside-avoid [&>details]:mb-4 [&>details]:break-inside-avoid lg:columns-2 lg:gap-5 lg:pb-10 lg:[&>section]:mb-5 lg:[&>details]:mb-5 xl:columns-3">
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
            onChange={(x) => set("mesitaName", x.slice(0, FIELD_LIMITS.placeNameMax))}
            maxLength={FIELD_LIMITS.placeNameMax}
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
          <PlaceFamilyField
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
                {form.description.length} / {FIELD_LIMITS.descriptionMax}
              </span>
            }
            value={form.description}
            onChange={(x) =>
              set("description", x.slice(0, FIELD_LIMITS.descriptionMax))
            }
            rows={7}
            maxLength={FIELD_LIMITS.descriptionMax}
            disabled={anyPending}
          />
        </div>
        <div className="mt-4">
          <PlaceTagsPicker
            value={form.tags}
            onChange={(tags) =>
              set("tags", tags.slice(0, FIELD_LIMITS.tagsPerPlaceMax))
            }
            disabled={anyPending}
          />
        </div>
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
            other card. */}
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
        {/* NO MAP IFRAME. The real card embeds maps.google.com here; this app
            makes no request to anything, and a mock that quietly called Google
            would be the one thing its banner promises it is not. The
            coordinates above are the fact the band was drawing. */}
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
      </SectionCard>

      <SectionCard
        icon={<Images className="h-4 w-4" />}
        tint="orange"
        title="Photos"
        action={
          <span
            className={
              "type-label tabular-nums " +
              (form.photos.length > FIELD_LIMITS.photosMax
                ? "text-destructive font-semibold"
                : "text-muted-foreground")
            }
          >
            {form.photos.length} / {FIELD_LIMITS.photosMax}
          </span>
        }
      >
        {form.photos.length > FIELD_LIMITS.photosMax ? (
          // The ceiling dropped to ten (MESITA-1237) and places enriched under
          // the old one still hold more. Say so, rather than quietly dropping
          // the tail on load and persisting that deletion at the next save.
          <p className="border-destructive/30 bg-destructive/5 text-destructive mt-4 rounded-xl border px-3.5 py-2.5 text-xs leading-relaxed">
            Over the ceiling by {form.photos.length - FIELD_LIMITS.photosMax}. Every
            photo below is still on the place — nothing has been dropped — but
            the page will not save until you remove{" "}
            {form.photos.length - FIELD_LIMITS.photosMax}.
          </p>
        ) : null}
        <PhotosEditor
          photos={form.photos}
          photosMax={FIELD_LIMITS.photosMax}
          pending={anyPending}
          uploading={uploading}
          onUpload={uploadPhoto}
          onMove={movePhoto}
          onRemove={removePhoto}
          onInfo={setMetaFor}
        />
        {errors.photos ? <ErrorNote message={errors.photos} /> : null}
      </SectionCard>

      {/* Menus, handed in by ProfileView — the `children` seam this card has
          always documented, filled again since MESITA-1917. */}
      {children}

      {/* Reviews closes the masonry (Pato live 2026-09-01): every card above
          is something an operator sets, this one is the only thing the world
          says back. Read-only, so it sits after the editable set. */}
      <ReviewsSummary place={place} />

      {metaFor !== null && (
        <MediaMetaDialog
          url={metaFor}
          position={form.photos.indexOf(metaFor) + 1}
          total={form.photos.length}
          onClose={() => setMetaFor(null)}
        />
      )}
    </div>
  );
}

/** A picked file as a data URI. The FileReader's error is surfaced rather than
 *  swallowed: an unreadable file is rare, and a silent no-op on the Add tile
 *  reads as a broken button. */
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Couldn't read that photo."));
    reader.readAsDataURL(file);
  });
}

function PhotosEditor({
  photos,
  photosMax,
  pending,
  uploading,
  onUpload,
  onMove,
  onRemove,
  onInfo,
}: {
  photos: string[];
  photosMax: number;
  pending: boolean;
  uploading: boolean;
  onUpload: (file: File) => void | Promise<void>;
  onMove: (from: number, dir: -1 | 1) => void;
  onRemove: (idx: number) => void;
  onInfo: (url: string) => void;
}) {
  const inputId = "place-photo-upload";
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

// Gallery order for the tile you are curating, and nothing else. The real
// dialog has a second half for an analyzed image — source chip, caption,
// likes, per-source metadata rows, the Intaker's vision text — which Profile
// never reaches, because it passes `meta={null}` on purpose (MESITA-1740).
function MediaMetaDialog({
  url,
  position,
  total,
  onClose,
}: {
  url: string;
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
          </div>

          <p className="text-muted-foreground text-sm italic">
            No information for this image yet — it hasn&rsquo;t been analyzed by
            the Intaker.
          </p>
        </div>
      </div>
    </div>
  );
}
