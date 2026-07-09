"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Clock,
  ExternalLink,
  Globe,
  ImageOff,
  ImagePlus,
  Info,
  Loader2,
  MapPin,
  X,
} from "lucide-react";
import {
  getPlaceEnrichment,
  listPlaceTagCatalog,
  listTeam,
  updatePlace,
  type AdminPlace,
  type PlaceEnrichmentStatus,
  type PlaceFieldLimits,
  type PlaceMediaMeta,
} from "../actions";
import { PlaceTagsPicker } from "../PlaceTagsPicker";
import { ErrorNote, SaveBar, SectionCard, TextArea, TextField } from "../ui";
import { formatAbsoluteUtc } from "@/lib/format";
import { createBrowserSupabase } from "@/lib/supabase/browser";
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

const CHANNELS: { key: keyof AdminPlace; label: string }[] = [
  { key: "website_url", label: "Website" },
  { key: "instagram_url", label: "Instagram" },
  { key: "facebook_url", label: "Facebook" },
  { key: "tiktok_url", label: "TikTok" },
  { key: "whatsapp_url", label: "WhatsApp" },
  { key: "google_maps_url", label: "Google Maps" },
  { key: "opentable_url", label: "OpenTable" },
  { key: "uber_eats_url", label: "Uber Eats" },
];

function priceLabel(level: number | null | undefined): string {
  if (level == null || level < 1) return "—";
  const n = Math.max(1, Math.min(4, level));
  const names = ["", "Budget", "Casual", "Upscale", "Fine dining"] as const;
  return `${names[n]} · ${"$".repeat(n)}`;
}

type DayHours = { closed: boolean; open: string; close: string };
type Form = {
  name: string;
  category: string;
  description: string;
  phone: string;
  email: string;
  tags: string[];
  address: string;
  photos: string[];
  channels: Record<string, string>;
  hours: Record<Day, DayHours>;
};

const str = (v: unknown) => (typeof v === "string" ? v : "");

// Fallback only until admin-web-get-atlas-fields returns; never the source of truth.
const FALLBACK_LIMITS: PlaceFieldLimits = {
  placeNameMax: 80,
  descriptionMax: 2000,
  tagsPerPlaceMax: 20,
  photosMax: 10,
};

function planLabel(plan: string | null): string {
  if (!plan) return "—";
  if (plan === "free") return "Free";
  if (plan === "informal_pro" || plan === "formal_pro" || plan === "pro") return "Pro";
  if (plan === "informal_ultra" || plan === "formal_ultra" || plan === "ultra") return "Ultra";
  return plan.replace(/_/g, " ");
}

function listingLabel(listingType: string | null): string {
  if (listingType === "partner") return "Verified partner";
  if (listingType === "web") return "Listed";
  return listingType?.trim() || "—";
}

function placeToForm(v: AdminPlace, limits: PlaceFieldLimits = FALLBACK_LIMITS): Form {
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
    name: (v.name ?? "").slice(0, limits.placeNameMax),
    category: v.category ?? "",
    description: (v.description ?? "").slice(0, limits.descriptionMax),
    phone: v.phone ?? "",
    email: v.email ?? "",
    tags: (v.tags ?? []).slice(0, limits.tagsPerPlaceMax),
    address: v.address ?? "",
    photos: (v.photos ?? []).slice(0, limits.photosMax),
    channels,
    hours,
  };
}

// Build the business-update-project patch. Empty strings become null so a cleared
// field actually clears; closed days are omitted from the hours object.
function formToPatch(
  f: Form,
  id: string,
  limits: PlaceFieldLimits,
): Record<string, unknown> {
  const nz = (s: string) => (s.trim() ? s.trim() : null);
  const hours: Record<string, { open: string; close: string }[]> = {};
  for (const d of DAYS) {
    const h = f.hours[d];
    if (!h.closed && h.open && h.close) hours[d] = [{ open: h.open, close: h.close }];
  }
  const patch: Record<string, unknown> = {
    id,
    name: f.name.trim().slice(0, limits.placeNameMax),
    description: nz(f.description.slice(0, limits.descriptionMax)),
    phone: nz(f.phone),
    email: nz(f.email),
    address: nz(f.address),
    tags: f.tags.slice(0, limits.tagsPerPlaceMax),
    photos: f.photos.slice(0, limits.photosMax),
    hours,
  };
  for (const c of CHANNELS) patch[c.key as string] = nz(f.channels[c.key as string]);
  return patch;
}

export function PlaceSection({
  place,
  onSaved,
}: {
  place: AdminPlace;
  onSaved: (v: AdminPlace) => void;
}) {
  const [limits, setLimits] = useState<PlaceFieldLimits>(FALLBACK_LIMITS);
  const [form, setForm] = useState<Form>(() => placeToForm(place));
  const [saved, setSaved] = useState<Form>(form);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(saved),
    [form, saved],
  );

  const set = <K extends keyof Form>(k: K, val: Form[K]) =>
    setForm((f) => ({ ...f, [k]: val }));
  const setChannel = (key: string, val: string) =>
    setForm((f) => ({ ...f, channels: { ...f.channels, [key]: val } }));
  const setDay = (d: Day, patch: Partial<DayHours>) =>
    setForm((f) => ({ ...f, hours: { ...f.hours, [d]: { ...f.hours[d], ...patch } } }));

  const [uploading, setUploading] = useState(false);

  const setPhotos = (photos: string[]) => set("photos", photos.slice(0, limits.photosMax));

  const uploadPhoto = async (file: File) => {
    if (uploading || pending) return;
    if (form.photos.length >= limits.photosMax) {
      setError(`At most ${limits.photosMax} photos.`);
      return;
    }
    const fileError = validateUploadFile(file);
    if (fileError) {
      setError(fileError);
      return;
    }
    setUploading(true);
    setError(null);
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
      const { data } = supabase.storage.from(PLACE_IMAGES_BUCKET).getPublicUrl(path);
      if (!data?.publicUrl) {
        throw new Error("Upload succeeded but no public URL was returned.");
      }
      setPhotos([...form.photos, data.publicUrl]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload that photo.");
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

  const removePhoto = (idx: number) => setPhotos(form.photos.filter((_, i) => i !== idx));

  // Admin-only: per-place Enricher inspector data — per-photo metadata (source
  // + vision analysis) for the ⓘ dialog, keyed by image URL, plus the place's
  // enrichment status. Lazy-loaded once per place.
  const [media, setMedia] = useState<Record<string, PlaceMediaMeta>>({});
  const [enrichStatus, setEnrichStatus] = useState<PlaceEnrichmentStatus | null>(null);
  const [metaFor, setMetaFor] = useState<string | null>(null);
  const [ownership, setOwnership] = useState<"loading" | "owned" | "unowned">("loading");

  useEffect(() => {
    let alive = true;
    // Field limits come from the same EF Atlas Config uses — never hardcode.
    listPlaceTagCatalog().then((r) => {
      if (!alive || !r.ok) return;
      setLimits(r.data.fieldLimits);
      setForm((f) => ({
        ...f,
        name: f.name.slice(0, r.data.fieldLimits.placeNameMax),
        description: f.description.slice(0, r.data.fieldLimits.descriptionMax),
        tags: f.tags.slice(0, r.data.fieldLimits.tagsPerPlaceMax),
        photos: f.photos.slice(0, r.data.fieldLimits.photosMax),
      }));
    });
    getPlaceEnrichment(place.id).then((r) => {
      if (!alive) return;
      setMedia(r.ok ? r.data.media : {});
      setEnrichStatus(r.ok ? r.data.status : null);
    });
    listTeam(place.id).then((r) => {
      if (!alive) return;
      if (!r.ok) {
        setOwnership("unowned");
        return;
      }
      const hasOwner = r.data.businesses.some((m) => m.role === "owner");
      setOwnership(hasOwner ? "owned" : "unowned");
    });
    return () => {
      alive = false;
    };
  }, [place.id]);

  const save = () => {
    if (!dirty || !form.name.trim()) {
      if (!form.name.trim()) setError("Name is required.");
      return;
    }
    setError(null);
    setOk(false);
    start(async () => {
      const r = await updatePlace(formToPatch(form, place.id, limits) as { id: string });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      const fresh = placeToForm(r.data, limits);
      setForm(fresh);
      setSaved(fresh);
      onSaved(r.data);
      setOk(true);
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <SectionCard
        icon={<BadgeCheck className="text-muted-foreground h-4 w-4" />}
        title="Meta"
        subtitle="Identity, enrichment, verification, and plan. Read-only here — edit plan on Promos."
      >
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetaField label="ID">
            <code className="text-foreground break-all font-mono text-xs">{place.id}</code>
          </MetaField>
          <MetaField label="Slug">
            <span className="text-sm">{place.slug ?? "—"}</span>
          </MetaField>
          <MetaField label="Status">
            <span className="text-sm capitalize">{place.status ?? "—"}</span>
          </MetaField>
          <div className="sm:col-span-2 lg:col-span-3">
            <EnrichmentStatusField status={enrichStatus} />
          </div>
          <MetaField label="Verification">
            <span
              className={
                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold " +
                (place.listing_type === "partner"
                  ? "bg-green-500/10 text-green-600"
                  : "bg-muted text-muted-foreground")
              }
            >
              {listingLabel(place.listing_type)}
            </span>
          </MetaField>
          <MetaField label="Ownership">
            <span
              className={
                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold " +
                (ownership === "owned"
                  ? "bg-green-500/10 text-green-600"
                  : ownership === "loading"
                    ? "bg-muted text-muted-foreground"
                    : "bg-amber-500/10 text-amber-700")
              }
            >
              {ownership === "loading"
                ? "Checking…"
                : ownership === "owned"
                  ? "Owned"
                  : "Unowned"}
            </span>
          </MetaField>
          <MetaField label="Plan">
            <span className="text-sm font-medium">{planLabel(place.plan)}</span>
            {place.fiscal_type ? (
              <span className="text-muted-foreground ml-1.5 text-xs capitalize">
                · {place.fiscal_type}
              </span>
            ) : null}
          </MetaField>
        </div>
      </SectionCard>

      <SectionCard
        icon={<MapPin className="text-muted-foreground h-4 w-4" />}
        title="Basics"
        subtitle="Name, price tier, category, about, and tags."
      >
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <TextField
            label="Name"
            value={form.name}
            onChange={(x) => set("name", x.slice(0, limits.placeNameMax))}
            maxLength={limits.placeNameMax}
            disabled={pending}
          />
          {/* Price is Google Places–inferred in Enrich-Research — never editable. */}
          <MetaField label="Price">
            <span className="text-sm">{priceLabel(place.price_level)}</span>
          </MetaField>
          {/* Category is enrichment-derived (ADEA inferPlaceCategory). Show the
              friendly label (e.g. "🪩 Nightclub"), never the snakecase slug;
              read-only here — the slug isn't hand-edited. */}
          <TextField
            label="Category"
            value={place.category_label ?? form.category}
            placeholder="e.g. 🪩 Nightclub"
            disabled
          />
        </div>
        <div className="mt-4">
          <TextArea
            label="About"
            value={form.description}
            onChange={(x) => set("description", x.slice(0, limits.descriptionMax))}
            rows={5}
            maxLength={limits.descriptionMax}
            disabled={pending}
          />
        </div>
        <div className="mt-4">
          <PlaceTagsPicker
            value={form.tags}
            onChange={(tags) => set("tags", tags.slice(0, limits.tagsPerPlaceMax))}
            disabled={pending}
          />
        </div>
      </SectionCard>

      <SectionCard
        icon={<MapPin className="text-muted-foreground h-4 w-4" />}
        title="Location"
        subtitle="Address and coordinates. Lat/lng are Enricher/Google-sourced (read-only)."
      >
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <TextField
              label="Address"
              value={form.address}
              onChange={(x) => set("address", x)}
              placeholder="Street, colonia, city"
              disabled={pending}
            />
          </div>
          <MetaField label="Zone">
            <span className="text-sm">{place.zone ?? "—"}</span>
          </MetaField>
          <MetaField label="City">
            <span className="text-sm">{place.city ?? "—"}</span>
          </MetaField>
          <MetaField label="Lat">
            <span className="font-mono text-sm tabular-nums">
              {place.lat == null ? "—" : place.lat}
            </span>
          </MetaField>
          <MetaField label="Lng">
            <span className="font-mono text-sm tabular-nums">
              {place.lng == null ? "—" : place.lng}
            </span>
          </MetaField>
        </div>
        {place.lat != null && place.lng != null ? (
          <div className="border-border mt-4 overflow-hidden rounded-xl border">
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
        icon={<Clock className="text-muted-foreground h-4 w-4" />}
        title="Time"
        subtitle={
          place.timezone
            ? `One range per day · timezone ${place.timezone}`
            : "One range per day. Toggle Closed for days the place isn't open."
        }
      >
        <div className="mt-5 flex flex-col gap-2">
          {DAYS.map((d) => {
            const h = form.hours[d];
            return (
              <div
                key={d}
                className="border-border bg-background flex flex-wrap items-center gap-3 rounded-xl border p-3"
              >
                <span className="w-24 text-sm font-medium capitalize">{d}</span>
                <label className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={h.closed}
                    disabled={pending}
                    onChange={(e) => setDay(d, { closed: e.target.checked })}
                  />
                  Closed
                </label>
                {!h.closed && (
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={h.open}
                      disabled={pending}
                      onChange={(e) => setDay(d, { open: e.target.value })}
                      className="border-border bg-card focus:border-foreground h-8 rounded-lg border px-2 text-sm outline-none"
                    />
                    <span className="text-muted-foreground text-xs">to</span>
                    <input
                      type="time"
                      value={h.close}
                      disabled={pending}
                      onChange={(e) => setDay(d, { close: e.target.value })}
                      className="border-border bg-card focus:border-foreground h-8 rounded-lg border px-2 text-sm outline-none"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard
        icon={<Globe className="text-muted-foreground h-4 w-4" />}
        title="Channels"
        subtitle="Official links + contact. Leave blank to clear."
      >
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {CHANNELS.map((c) => (
            <TextField
              key={c.key as string}
              label={c.label}
              value={form.channels[c.key as string] ?? ""}
              onChange={(x) => setChannel(c.key as string, x)}
              placeholder="https://…"
              disabled={pending}
            />
          ))}
          <TextField
            label="Phone"
            value={form.phone}
            onChange={(x) => set("phone", x)}
            disabled={pending}
          />
          <TextField
            label="Email"
            type="email"
            value={form.email}
            onChange={(x) => set("email", x)}
            disabled={pending}
          />
        </div>
      </SectionCard>

      <SectionCard
        icon={<ImageOff className="text-muted-foreground h-4 w-4" />}
        title="Photos"
        subtitle="Place gallery — first photo is the hero. Reorder or remove; upload one new photo at a time."
      >
        <PhotosEditor
          placeId={place.id}
          photos={form.photos}
          photosMax={limits.photosMax}
          pending={pending}
          uploading={uploading}
          onUpload={uploadPhoto}
          onMove={movePhoto}
          onRemove={removePhoto}
          onInfo={setMetaFor}
        />
      </SectionCard>

      <div>
        <SaveBar pending={pending} dirty={dirty} ok={ok} onSave={save} />
        {error && <ErrorNote message={error} />}
      </div>

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

function MetaField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <div className="border-border bg-background flex min-h-9 items-center rounded-lg border px-3 py-2">
        {children}
      </div>
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
      {photos.length === 0 ? (
        <p className="text-muted-foreground text-sm">No photos yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((src, idx) => (
            <div
              key={`${src}-${idx}`}
              className="border-border bg-background group relative overflow-hidden rounded-xl border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`Photo ${idx + 1}`}
                className="aspect-square w-full object-cover"
              />
              {idx === 0 && (
                <span className="bg-foreground/80 text-background absolute top-2 left-2 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                  Hero
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 transition group-hover:opacity-100">
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={busy || idx === 0}
                    onClick={() => onMove(idx, -1)}
                    className="text-background hover:bg-white/20 inline-flex h-7 w-7 items-center justify-center rounded-md transition disabled:opacity-40"
                    aria-label="Move earlier"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={busy || idx === photos.length - 1}
                    onClick={() => onMove(idx, 1)}
                    className="text-background hover:bg-white/20 inline-flex h-7 w-7 items-center justify-center rounded-md transition disabled:opacity-40"
                    aria-label="Move later"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => onInfo(src)}
                    className="text-background hover:bg-white/20 inline-flex h-7 w-7 items-center justify-center rounded-md transition"
                    aria-label="Photo metadata"
                    title="Image metadata"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onRemove(idx)}
                    className="text-background hover:bg-white/20 inline-flex h-7 w-7 items-center justify-center rounded-md transition"
                    aria-label="Remove photo"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
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
        <label
          htmlFor={inputId}
          className={`border-border hover:border-foreground/40 inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-4 text-sm font-medium transition ${
            busy || atCap ? "pointer-events-none opacity-50" : ""
          }`}
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading…
            </>
          ) : (
            <>
              <ImagePlus className="h-4 w-4" />
              Upload photo
            </>
          )}
        </label>
        <p className="text-muted-foreground text-xs tabular-nums">
          {photos.length}/{photosMax} photos · JPG, PNG, WEBP, AVIF · max 8 MB
        </p>
      </div>
    </div>
  );
}

// Derives a display badge from the raw enrichment status. Prefers the live
// place_research stage; falls back to the project's content_status when the
// place has no research row yet (created but never enriched).
function enrichmentBadge(s: PlaceEnrichmentStatus | null): { text: string; cls: string } {
  const stage = s?.stage ?? null;
  if (stage === "done") return { text: "Enriched", cls: "bg-green-500/10 text-green-600" };
  if (stage === "failed") return { text: "Failed", cls: "bg-red-500/10 text-red-600" };
  if (stage === "research" || stage === "analysis" || stage === "contents") {
    return { text: `Enriching… (${stage})`, cls: "bg-blue-500/10 text-blue-600" };
  }
  switch (s?.content_status) {
    case "ready":
      return { text: "Enriched", cls: "bg-green-500/10 text-green-600" };
    case "generating":
      return { text: "Enriching…", cls: "bg-blue-500/10 text-blue-600" };
    case "failed":
      return { text: "Failed", cls: "bg-red-500/10 text-red-600" };
    default:
      return { text: "Not enriched", cls: "bg-muted text-muted-foreground" };
  }
}

function EnrichmentStatusField({ status }: { status: PlaceEnrichmentStatus | null }) {
  const badge = enrichmentBadge(status);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">Enrichment status</span>
      <div className="border-border bg-background flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2.5">
        <span
          className={
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold " +
            badge.cls
          }
        >
          {badge.text}
        </span>
        {status?.last_enriched_at && (
          <span className="text-muted-foreground text-xs">
            Last enriched {formatAbsoluteUtc(status.last_enriched_at)}
          </span>
        )}
        {status?.stage === "failed" && status?.error && (
          <span className="text-xs text-red-600">· {status.error}</span>
        )}
      </div>
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
      {text.split(/\*\*/).map((seg, i) =>
        i % 2 === 1 ? <strong key={i}>{seg}</strong> : <span key={i}>{seg}</span>,
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
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const strVal = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

  if (source === "instagram") {
    const comments = num(meta.comments_count);
    if (comments != null) rows.push({ label: "Comments", value: comments.toLocaleString() });
    if (meta.is_video === true) rows.push({ label: "Media type", value: "Video" });
    else if (meta.is_video === false) rows.push({ label: "Media type", value: "Photo" });
    const ts = meta.timestamp;
    let posted: string | null = null;
    if (typeof ts === "number" && Number.isFinite(ts)) {
      posted = formatAbsoluteUtc(new Date(ts * 1000).toISOString());
    } else if (typeof ts === "string" && ts.trim()) {
      const d = new Date(ts);
      posted = Number.isNaN(d.getTime()) ? ts : formatAbsoluteUtc(d.toISOString());
    }
    if (posted) rows.push({ label: "Posted", value: posted });
    const shortcode = strVal(meta.shortcode);
    if (shortcode) rows.push({ label: "Shortcode", value: shortcode });
  } else if (source === "website") {
    const w = num(meta.width);
    const h = num(meta.height);
    if (w != null && h != null) rows.push({ label: "Dimensions", value: `${w}×${h}` });
    const page = strVal(meta.page);
    if (page) rows.push({ label: "Found on page", value: page });
    const alt = strVal(meta.alt);
    if (alt) rows.push({ label: "Alt text", value: alt });
  }
  return rows;
}

// Admin-only inspector: shows one image's Enricher metadata — source, gallery
// order, save status, the pre-analysis source signals (likes/comments/dims/…),
// and the vision analysis text — in a small modal.
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
  const sourceLabel = source ? (SOURCE_LABEL[source] ?? source) : "Unknown source";
  const chip = (source && SOURCE_CHIP[source]) || "bg-muted text-muted-foreground";
  const analysis = meta?.analysis_text?.trim() || null;
  const status = meta?.status ?? null;
  const statusChip = (status && STATUS_CHIP[status]) || "bg-muted text-muted-foreground";
  const metaRows = sourceMetaRows(source, meta?.source_metadata ?? null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="border-border bg-card flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border shadow-xl"
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
            className="border-border aspect-[16/9] w-full rounded-lg border object-cover"
          />

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground text-xs font-medium">Order</span>
            {position > 0 ? (
              <span className="bg-muted text-foreground inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums">
                #{position} of {total}
                {position === 1 ? " · Hero" : ""}
              </span>
            ) : (
              <span className="text-muted-foreground text-xs italic">not in gallery</span>
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
              Enricher.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground text-xs font-medium">Source</span>
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
                  <p className="text-muted-foreground mb-1 text-xs font-medium">Caption</p>
                  <p className="text-foreground/90 text-sm italic">“{meta.caption}”</p>
                </div>
              )}

              {metaRows.length > 0 && (
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                  {metaRows.map((row) => (
                    <div key={row.label} className="col-span-2 grid grid-cols-subgrid">
                      <dt className="text-muted-foreground text-xs font-medium">{row.label}</dt>
                      <dd className="text-foreground/90 min-w-0 break-words">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              )}

              <div>
                <p className="text-muted-foreground mb-1 text-xs font-medium">Analysis</p>
                {analysis ? (
                  <AnalysisText text={analysis} />
                ) : (
                  <p className="text-muted-foreground text-sm italic">
                    Not analyzed — this image was saved but not vision-described.
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
