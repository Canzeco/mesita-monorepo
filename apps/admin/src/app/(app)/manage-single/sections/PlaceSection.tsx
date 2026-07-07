"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  ExternalLink,
  Globe,
  ImageOff,
  Info,
  MapPin,
  Plus,
  X,
} from "lucide-react";
import {
  getPlaceEnrichment,
  updatePlace,
  type AdminPlace,
  type PlaceEnrichmentStatus,
  type PlaceMediaMeta,
} from "../actions";
import { ErrorNote, SaveBar, SectionCard, TextArea, TextField } from "../ui";
import { formatAbsoluteUtc } from "@/lib/format";

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
  { key: "tripadvisor_url", label: "TripAdvisor" },
  { key: "menu_pdf_url", label: "Menu URL" },
];

type DayHours = { closed: boolean; open: string; close: string };
type Form = {
  name: string;
  category: string;
  description: string;
  phone: string;
  email: string;
  tags: string;
  photos: string[];
  channels: Record<string, string>;
  hours: Record<Day, DayHours>;
};

const str = (v: unknown) => (typeof v === "string" ? v : "");

const PLACE_NAME_MAX = 80;
const TAGS_PER_PLACE_MAX = 20;
const PHOTOS_MAX = 10;

function placeToForm(v: AdminPlace): Form {
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
    name: (v.name ?? "").slice(0, PLACE_NAME_MAX),
    category: v.category ?? "",
    description: v.description ?? "",
    phone: v.phone ?? "",
    email: v.email ?? "",
    tags: (v.tags ?? []).join(", "),
    photos: (v.photos ?? []).slice(0, PHOTOS_MAX),
    channels,
    hours,
  };
}

// Build the business-update-project patch. Empty strings become null so a cleared
// field actually clears; closed days are omitted from the hours object.
function formToPatch(f: Form, id: string): Record<string, unknown> {
  const nz = (s: string) => (s.trim() ? s.trim() : null);
  const hours: Record<string, { open: string; close: string }[]> = {};
  for (const d of DAYS) {
    const h = f.hours[d];
    if (!h.closed && h.open && h.close) hours[d] = [{ open: h.open, close: h.close }];
  }
  const patch: Record<string, unknown> = {
    id,
    name: f.name.trim().slice(0, PLACE_NAME_MAX),
    category: nz(f.category),
    description: nz(f.description),
    phone: nz(f.phone),
    email: nz(f.email),
    tags: f.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, TAGS_PER_PLACE_MAX),
    photos: f.photos.slice(0, PHOTOS_MAX),
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

  const [photoDraft, setPhotoDraft] = useState("");

  const setPhotos = (photos: string[]) => set("photos", photos.slice(0, PHOTOS_MAX));

  const addPhotoUrl = () => {
    const url = photoDraft.trim();
    if (!url) return;
    if (form.photos.length >= PHOTOS_MAX) {
      setError(`At most ${PHOTOS_MAX} photos.`);
      return;
    }
    if (form.photos.includes(url)) {
      setPhotoDraft("");
      return;
    }
    setPhotos([...form.photos, url]);
    setPhotoDraft("");
    setError(null);
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
  useEffect(() => {
    let alive = true;
    getPlaceEnrichment(place.id).then((r) => {
      if (!alive) return;
      setMedia(r.ok ? r.data.media : {});
      setEnrichStatus(r.ok ? r.data.status : null);
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
      const r = await updatePlace(formToPatch(form, place.id) as { id: string });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      const fresh = placeToForm(r.data);
      setForm(fresh);
      setSaved(fresh);
      onSaved(r.data);
      setOk(true);
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <SectionCard
        icon={<MapPin className="text-muted-foreground h-4 w-4" />}
        title="Place"
        subtitle={`Profile for ${place.name}. Name, category, description and contact.`}
      >
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <TextField
            label="Name"
            value={form.name}
            onChange={(x) => set("name", x.slice(0, PLACE_NAME_MAX))}
            maxLength={PLACE_NAME_MAX}
            disabled={pending}
          />
          {/* Category is enrichment-derived (ADEA inferPlaceCategory). Show the
              friendly label (e.g. "🪩 Nightclub"), never the snakecase slug;
              read-only here — the slug isn't hand-edited. */}
          <TextField label="Category" value={place.category_label ?? form.category} placeholder="e.g. 🪩 Nightclub" disabled />
        </div>
        <div className="mt-4">
          <EnrichmentStatusField status={enrichStatus} />
        </div>
        <div className="mt-4">
          <TextArea label="Description / About" value={form.description} onChange={(x) => set("description", x)} rows={5} maxLength={2000} disabled={pending} />
        </div>
        <div className="mt-4">
          <TextField
            label="Tags (comma-separated)"
            value={form.tags}
            onChange={(x) => set("tags", x)}
            placeholder="brunch, terrace, pet-friendly"
            disabled={pending}
          />
          <p className="text-muted-foreground mt-1 text-xs tabular-nums">
            {form.tags.split(",").map((t) => t.trim()).filter(Boolean).length}/
            {TAGS_PER_PLACE_MAX} tags
          </p>
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
          {/* Phone + Email are contact channels (non-URL) — grouped here too. */}
          <TextField label="Phone" value={form.phone} onChange={(x) => set("phone", x)} disabled={pending} />
          <TextField label="Email" type="email" value={form.email} onChange={(x) => set("email", x)} disabled={pending} />
        </div>
      </SectionCard>

      <SectionCard
        icon={<Clock className="text-muted-foreground h-4 w-4" />}
        title="Hours"
        subtitle="One range per day. Toggle Closed for days the place isn't open."
      >
        <div className="mt-5 flex flex-col gap-2">
          {DAYS.map((d) => {
            const h = form.hours[d];
            return (
              <div key={d} className="border-border bg-background flex flex-wrap items-center gap-3 rounded-xl border p-3">
                <span className="w-24 text-sm font-medium capitalize">{d}</span>
                <label className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <input type="checkbox" checked={h.closed} disabled={pending} onChange={(e) => setDay(d, { closed: e.target.checked })} />
                  Closed
                </label>
                {!h.closed && (
                  <div className="flex items-center gap-2">
                    <input type="time" value={h.open} disabled={pending} onChange={(e) => setDay(d, { open: e.target.value })} className="border-border bg-card focus:border-foreground h-8 rounded-lg border px-2 text-sm outline-none" />
                    <span className="text-muted-foreground text-xs">to</span>
                    <input type="time" value={h.close} disabled={pending} onChange={(e) => setDay(d, { close: e.target.value })} className="border-border bg-card focus:border-foreground h-8 rounded-lg border px-2 text-sm outline-none" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard
        icon={<ImageOff className="text-muted-foreground h-4 w-4" />}
        title="Photos"
        subtitle="Place gallery — first photo is the hero. Reorder or remove; add by URL if needed."
      >
        <PhotosEditor
          photos={form.photos}
          pending={pending}
          photoDraft={photoDraft}
          onPhotoDraftChange={setPhotoDraft}
          onAdd={addPhotoUrl}
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

function PhotosEditor({
  photos,
  pending,
  photoDraft,
  onPhotoDraftChange,
  onAdd,
  onMove,
  onRemove,
  onInfo,
}: {
  photos: string[];
  pending: boolean;
  photoDraft: string;
  onPhotoDraftChange: (value: string) => void;
  onAdd: () => void;
  onMove: (from: number, dir: -1 | 1) => void;
  onRemove: (idx: number) => void;
  onInfo: (url: string) => void;
}) {
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
                className="aspect-[4/3] w-full object-cover"
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
                    disabled={pending || idx === 0}
                    onClick={() => onMove(idx, -1)}
                    className="text-background hover:bg-white/20 inline-flex h-7 w-7 items-center justify-center rounded-md transition disabled:opacity-40"
                    aria-label="Move earlier"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={pending || idx === photos.length - 1}
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
                    disabled={pending}
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

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="text-sm font-medium">Add photo</span>
          <input
            type="url"
            value={photoDraft}
            onChange={(e) => onPhotoDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAdd();
              }
            }}
            placeholder="Paste image URL…"
            disabled={pending || photos.length >= PHOTOS_MAX}
            className="border-border bg-background focus:border-foreground h-9 rounded-lg border px-3 text-sm outline-none disabled:opacity-50"
          />
        </label>
        <button
          type="button"
          onClick={onAdd}
          disabled={pending || !photoDraft.trim() || photos.length >= PHOTOS_MAX}
          className="border-border hover:border-foreground/40 inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-4 text-sm font-medium transition disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>
      <p className="text-muted-foreground mt-2 text-xs tabular-nums">
        {photos.length}/{PHOTOS_MAX} photos
      </p>
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
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

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
    const shortcode = str(meta.shortcode);
    if (shortcode) rows.push({ label: "Shortcode", value: shortcode });
  } else if (source === "website") {
    const w = num(meta.width);
    const h = num(meta.height);
    if (w != null && h != null) rows.push({ label: "Dimensions", value: `${w}×${h}` });
    const page = str(meta.page);
    if (page) rows.push({ label: "Found on page", value: page });
    const alt = str(meta.alt);
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

          {/* Gallery order is meaningful even before analysis — the array
              position IS the sorted rank; #1 is the hero. */}
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
