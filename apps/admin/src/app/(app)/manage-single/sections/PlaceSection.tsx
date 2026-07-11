"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  Check,
  Clock,
  Copy,
  ExternalLink,
  Fingerprint,
  Globe,
  ImagePlus,
  Images,
  Info,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Percent,
  ShieldCheck,
  Store,
  X,
  type LucideIcon,
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
  type ReservationChannel,
  type ReservationTarget,
} from "../actions";
import { PlaceTagsPicker } from "../PlaceTagsPicker";
import { GroupLabel, PhoneField, SaveBar, SectionCard, TextArea, TextField } from "../ui";
import { unitSectionHref } from "../nav";
import {
  REWARD_ROWS,
  SUBSCRIPTIONS,
  subscriptionForPlan,
  visibilityScore,
} from "@/lib/business/plans";
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

const str = (v: unknown) => (typeof v === "string" ? v : "");

// Brand marks live in /public/channels (Simple Icons SVGs, same set as
// consumer). Generic contact fields keep lucide fallbacks.
const CHANNELS: {
  key: keyof AdminPlace;
  label: string;
  logo?: string;
  Icon?: LucideIcon;
}[] = [
  { key: "website_url", label: "Website", Icon: Globe },
  { key: "instagram_url", label: "Instagram", logo: "/channels/instagram.svg" },
  { key: "facebook_url", label: "Facebook", logo: "/channels/facebook.svg" },
  { key: "whatsapp_url", label: "WhatsApp", logo: "/channels/whatsapp.svg" },
  {
    key: "google_maps_url",
    label: "Google Maps",
    logo: "/channels/googlemaps.svg",
  },
  {
    key: "uber_eats_url",
    label: "Uber Eats",
    logo: "/channels/ubereats-mark.svg",
  },
  { key: "opentable_url", label: "OpenTable", logo: "/channels/opentable.svg" },
];

const RESERVATION_CHANNELS: {
  key: ReservationChannel;
  label: string;
  /** Primary-channel profile field the reservationist contacts. */
  profileKey: keyof AdminPlace;
}[] = [
  { key: "instagram", label: "Instagram", profileKey: "instagram_url" },
  { key: "whatsapp", label: "WhatsApp", profileKey: "whatsapp_url" },
  { key: "phone", label: "Phone", profileKey: "phone" },
];

/** Ordered channel priority — index 0 is the 1st choice. 0–3 entries, no dupes. */
type ReservationOrder = ReservationChannel[];

const isReservationChannel = (c: unknown): c is ReservationChannel =>
  c === "instagram" || c === "whatsapp" || c === "phone";

function profileValueFor(place: AdminPlace, channel: ReservationChannel): string {
  const meta = RESERVATION_CHANNELS.find((c) => c.key === channel);
  return meta ? str(place[meta.profileKey]) : "";
}

/** Read the ordered channel priority; tolerate the older single-channel and
 *  per-channel-routes shapes. Only CHANNELS matter — the stored values are
 *  snapshots resolved at save time, never hand-entered. */
function readReservationTarget(v: AdminPlace): ReservationOrder {
  const raw = v.products?.reservations as unknown;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    const order: ReservationOrder = [];
    const push = (c: unknown) => {
      if (isReservationChannel(c) && !order.includes(c)) order.push(c);
    };
    push(obj.channel);
    if (Array.isArray(obj.fallbacks)) {
      for (const f of obj.fallbacks) {
        if (f && typeof f === "object") push((f as Record<string, unknown>).channel);
      }
    }
    if (order.length > 0) return order;
    // Legacy MESITA-378 routes: first channel that had a route or a profile value.
    for (const key of ["phone", "whatsapp", "instagram"] as const) {
      const c = obj[key];
      const route = c && typeof c === "object" ? (c as Record<string, unknown>) : null;
      if (route && (route.mode === "different" || profileValueFor(v, key))) return [key];
    }
  }
  return [];
}

function serializeReservationTarget(order: ReservationOrder, f: Form): ReservationTarget | null {
  const [first, ...rest] = order;
  if (!first) return null;
  // Same convention as the Enricher's Selected Reservation Endpoint: values
  // are snapshots of the profile contacts at save time. The 1st choice keeps
  // the flat { channel, value } shape the Enricher's override check reads.
  const snapshot = (c: ReservationChannel) => formContactFor(f, c).trim() || null;
  const target: ReservationTarget = { channel: first, value: snapshot(first) };
  if (rest.length > 0) {
    target.fallbacks = rest.map((c) => ({ channel: c, value: snapshot(c) }));
  }
  return target;
}

/** The profile contact for one channel as currently held in the editor form. */
function formContactFor(f: Form, channel: ReservationChannel | ""): string {
  if (channel === "phone") return f.phone;
  if (channel === "whatsapp") return f.channels.whatsapp_url ?? "";
  if (channel === "instagram") return f.channels.instagram_url ?? "";
  return "";
}

function ChannelLabelIcon({
  logo,
  Icon,
}: {
  logo?: string;
  Icon?: LucideIcon;
}) {
  if (logo) {
    // Static 14px brand SVG — next/image adds nothing here.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} alt="" aria-hidden className="h-3.5 w-3.5 shrink-0" />;
  }
  if (Icon) {
    return <Icon className="text-muted-foreground h-3.5 w-3.5 shrink-0" />;
  }
  return null;
}

const PRICE_NAMES = ["", "Budget", "Casual", "Upscale", "Fine dining"] as const;

// Price is Google-Places inferred — read-only. Filled $ + dimmed remainder.
function PriceDisplay({ level }: { level: number | null | undefined }) {
  if (level == null || level < 1) return <span className="text-muted-foreground">—</span>;
  const n = Math.max(1, Math.min(4, level));
  return (
    <span className="flex items-center gap-2">
      <span className="font-semibold tracking-wide">
        <span className="text-foreground">{"$".repeat(n)}</span>
        <span className="text-muted-foreground/40">{"$".repeat(4 - n)}</span>
      </span>
      <span className="text-muted-foreground">{PRICE_NAMES[n]}</span>
    </span>
  );
}

type DayHours = { closed: boolean; open: string; close: string };
// Address is deliberately absent: it is native (Google/Enricher-sourced) and
// business-web-update-project rejects manual writes — Location renders read-only.
type Form = {
  name: string;
  category: string;
  description: string;
  phone: string;
  email: string;
  tags: string[];
  photos: string[];
  channels: Record<string, string>;
  reservation: ReservationOrder;
  hours: Record<Day, DayHours>;
};

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
    photos: (v.photos ?? []).slice(0, limits.photosMax),
    channels,
    reservation: readReservationTarget(v),
    hours,
  };
}

// Build a partial business-update-project patch for one Place box.
// Empty strings become null so a cleared field actually clears.
type PlaceBox = "basics" | "time" | "channels" | "reservations" | "photos";

function boxToPatch(
  box: PlaceBox,
  f: Form,
  id: string,
  limits: PlaceFieldLimits,
  existingProducts?: AdminPlace["products"],
): Record<string, unknown> {
  const nz = (s: string) => (s.trim() ? s.trim() : null);
  if (box === "basics") {
    return {
      id,
      name: f.name.trim().slice(0, limits.placeNameMax),
      description: nz(f.description.slice(0, limits.descriptionMax)),
      tags: f.tags.slice(0, limits.tagsPerPlaceMax),
    };
  }
  if (box === "time") {
    const hours: Record<string, { open: string; close: string }[]> = {};
    for (const d of DAYS) {
      const h = f.hours[d];
      if (!h.closed && h.open && h.close) hours[d] = [{ open: h.open, close: h.close }];
    }
    return { id, hours };
  }
  if (box === "channels") {
    const patch: Record<string, unknown> = {
      id,
      phone: nz(f.phone),
      email: nz(f.email),
    };
    for (const c of CHANNELS) patch[c.key as string] = nz(f.channels[c.key as string]);
    return patch;
  }
  if (box === "reservations") {
    return {
      id,
      // Clear the overbuilt MESITA-377 fields — selector is the only source now.
      reservation_endpoint: null,
      reservation_contacts: [],
      products: {
        ...(existingProducts ?? {}),
        reservations: serializeReservationTarget(f.reservation, f),
      },
    };
  }
  return { id, photos: f.photos.slice(0, limits.photosMax) };
}

function sliceEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Copy one box's fields from `from` onto `base` — keeps other boxes intact. */
function mergeBoxSlice(base: Form, from: Form, box: PlaceBox): Form {
  if (box === "basics") {
    return {
      ...base,
      name: from.name,
      description: from.description,
      tags: from.tags,
      category: from.category,
    };
  }
  if (box === "time") return { ...base, hours: from.hours };
  if (box === "channels") {
    return {
      ...base,
      channels: from.channels,
      phone: from.phone,
      email: from.email,
    };
  }
  if (box === "reservations") {
    return {
      ...base,
      reservation: from.reservation,
    };
  }
  return { ...base, photos: from.photos };
}

export function PlaceSection({
  place,
  onSaved,
  children,
}: {
  place: AdminPlace;
  onSaved: (v: AdminPlace) => void;
  /** Extra Place-page boxes (Products, Reviews) — flow in the same masonry columns. */
  children?: React.ReactNode;
}) {
  const [limits, setLimits] = useState<PlaceFieldLimits>(FALLBACK_LIMITS);
  const [form, setForm] = useState<Form>(() => placeToForm(place));
  const [saved, setSaved] = useState<Form>(form);
  const [pendingBox, setPendingBox] = useState<PlaceBox | null>(null);
  const [errors, setErrors] = useState<Partial<Record<PlaceBox, string>>>({});
  const [oks, setOks] = useState<Partial<Record<PlaceBox, boolean>>>({});
  const [, start] = useTransition();

  const dirtyBasics = useMemo(
    () =>
      !sliceEqual(
        { name: form.name, description: form.description, tags: form.tags },
        { name: saved.name, description: saved.description, tags: saved.tags },
      ),
    [form.name, form.description, form.tags, saved.name, saved.description, saved.tags],
  );
  const dirtyTime = useMemo(
    () => !sliceEqual(form.hours, saved.hours),
    [form.hours, saved.hours],
  );
  const dirtyChannels = useMemo(
    () =>
      !sliceEqual(
        { channels: form.channels, phone: form.phone, email: form.email },
        { channels: saved.channels, phone: saved.phone, email: saved.email },
      ),
    [form.channels, form.phone, form.email, saved.channels, saved.phone, saved.email],
  );
  const dirtyReservations = useMemo(
    () => !sliceEqual(form.reservation, saved.reservation),
    [form.reservation, saved.reservation],
  );
  const dirtyPhotos = useMemo(
    () => !sliceEqual(form.photos, saved.photos),
    [form.photos, saved.photos],
  );

  const anyPending = pendingBox !== null;

  const set = <K extends keyof Form>(k: K, val: Form[K]) =>
    setForm((f) => ({ ...f, [k]: val }));
  const setChannel = (key: string, val: string) =>
    setForm((f) => ({ ...f, channels: { ...f.channels, [key]: val } }));
  // Set one priority slot; empties compact away and a channel picked twice
  // keeps only its earliest slot, so the order never has holes or dupes.
  const setReservationSlot = (slot: number, channel: ReservationChannel | "") =>
    setForm((f) => {
      const slots: (ReservationChannel | "")[] = [0, 1, 2].map((i) =>
        i === slot ? channel : (f.reservation[i] ?? ""),
      );
      const next: ReservationOrder = [];
      for (const c of slots) if (c && !next.includes(c)) next.push(c);
      return { ...f, reservation: next };
    });
  const setDay = (d: Day, patch: Partial<DayHours>) =>
    setForm((f) => ({ ...f, hours: { ...f.hours, [d]: { ...f.hours[d], ...patch } } }));

  const [uploading, setUploading] = useState(false);

  const setPhotos = (photos: string[]) => set("photos", photos.slice(0, limits.photosMax));

  const uploadPhoto = async (file: File) => {
    if (uploading || anyPending) return;
    if (form.photos.length >= limits.photosMax) {
      setErrors((e) => ({ ...e, photos: `At most ${limits.photosMax} photos.` }));
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
      const { data } = supabase.storage.from(PLACE_IMAGES_BUCKET).getPublicUrl(path);
      if (!data?.publicUrl) {
        throw new Error("Upload succeeded but no public URL was returned.");
      }
      setPhotos([...form.photos, data.publicUrl]);
    } catch (err) {
      setErrors((e) => ({
        ...e,
        photos: err instanceof Error ? err.message : "Couldn't upload that photo.",
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

  const removePhoto = (idx: number) => setPhotos(form.photos.filter((_, i) => i !== idx));

  // Admin-only: per-place Enricher inspector data — per-photo metadata (source
  // + vision analysis) for the ⓘ dialog, keyed by image URL, plus the place's
  // enrichment status. Lazy-loaded once per place.
  const [media, setMedia] = useState<Record<string, PlaceMediaMeta>>({});
  const [enrichStatus, setEnrichStatus] = useState<PlaceEnrichmentStatus | null>(null);
  const [metaFor, setMetaFor] = useState<string | null>(null);
  // Owner emails (project_members role=owner) — null while loading.
  const [owners, setOwners] = useState<string[] | null>(null);

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
        setOwners([]);
        return;
      }
      setOwners(
        r.data.businesses
          .filter((m) => m.role === "owner")
          .map((m) => m.email ?? m.fullName ?? m.userId),
      );
    });
    return () => {
      alive = false;
    };
  }, [place.id]);

  const saveBox = (box: PlaceBox) => {
    if (box === "basics" && !form.name.trim()) {
      setErrors((e) => ({ ...e, basics: "Name is required." }));
      return;
    }
    setErrors((e) => ({ ...e, [box]: undefined }));
    setOks((o) => ({ ...o, [box]: false }));
    setPendingBox(box);
    start(async () => {
      const r = await updatePlace(
        boxToPatch(box, form, place.id, limits, place.products) as { id: string },
      );
      setPendingBox(null);
      if (!r.ok) {
        setErrors((e) => ({ ...e, [box]: r.error }));
        return;
      }
      const fresh = placeToForm(r.data, limits);
      // Merge only this box's slice so unsaved edits in other boxes survive.
      setForm((prev) => mergeBoxSlice(prev, fresh, box));
      setSaved((prev) => mergeBoxSlice(prev, fresh, box));
      onSaved(r.data);
      setOks((o) => ({ ...o, [box]: true }));
    });
  };

  return (
    // Masonry, not a grid: CSS columns pack the cards top-down, so a short
    // card never strands empty space beside a tall neighbour — columns don't
    // row-align by design (MESITA-399). Every card roots as a <section>
    // (SectionCard) and gets the gutter margin + break-inside-avoid via
    // [&>section]; the fixed photo dialog is a <div>, exempt and out of flow.
    // lg (not xl): admin content + sidebar rarely reaches 1280px of free width.
    <div className="columns-1 gap-4 [&>section]:mb-4 [&>section]:break-inside-avoid lg:columns-2 lg:gap-5 lg:[&>section]:mb-5">
      {/* Box order (MESITA-399): Meta · Ownership · Promos · Basics, then
          the editing boxes. Status stays in the sticky chrome up top. */}
      <MetaCard place={place} enrichStatus={enrichStatus} />

      <OwnershipCard place={place} owners={owners} />

      <PromosCard place={place} />

      {/* Basics — editable identity. Price + category are Enricher/Google-
          derived and stay read-only inside the same box. */}
      <SectionCard
        icon={<Store className="h-4 w-4" />}
        tint="rose"
        title="Basics"
        subtitle="Name, about & tags are editable — price & category come from the Enricher / Google Places."
      >
        <div className="mt-5">
          <TextField
            label="Name"
            value={form.name}
            onChange={(x) => set("name", x.slice(0, limits.placeNameMax))}
            maxLength={limits.placeNameMax}
            disabled={anyPending}
          />
        </div>
        {/* One field per row — the whole card is a single column. */}
        <div className="mt-4 grid gap-4">
          <ReadField label="Price level" auto boxed>
            <PriceDisplay level={place.price_level} />
          </ReadField>
          {/* Friendly label (e.g. "🪩 Nightclub"), never the snakecase slug. */}
          <ReadField label="Category" auto boxed>
            {place.category_label ?? place.category ?? "—"}
          </ReadField>
        </div>
        <div className="mt-4">
          <TextArea
            label="About"
            labelRight={
              <span className="text-muted-foreground text-[11px] tabular-nums">
                {form.description.length} / {limits.descriptionMax}
              </span>
            }
            value={form.description}
            onChange={(x) => set("description", x.slice(0, limits.descriptionMax))}
            rows={9}
            maxLength={limits.descriptionMax}
            disabled={anyPending}
          />
        </div>
        <div className="mt-4">
          <PlaceTagsPicker
            value={form.tags}
            onChange={(tags) => set("tags", tags.slice(0, limits.tagsPerPlaceMax))}
            disabled={anyPending}
          />
        </div>
        <SaveBar
          pending={pendingBox === "basics"}
          dirty={dirtyBasics}
          ok={!!oks.basics}
          error={errors.basics}
          onSave={() => saveBox("basics")}
        />
      </SectionCard>

      {/* Location is native — Google Places seed + Enricher synthesis. The EF
          rejects manual address writes, so this whole box is read-only. */}
      <SectionCard
        icon={<MapPin className="h-4 w-4" />}
        tint="sky"
        title="Location"
        subtitle="Native — address & coordinates come from Google / the Enricher."
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
            <span className="font-mono text-[13px] tabular-nums">
              {place.lat == null || place.lng == null
                ? "—"
                : `${place.lat}, ${place.lng}`}
            </span>
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
        tint="violet"
        title="Hours"
        subtitle={
          place.timezone
            ? `One range per day · timezone ${place.timezone}`
            : "One range per day. Toggle off for days the place isn't open."
        }
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
        <SaveBar
          pending={pendingBox === "time"}
          dirty={dirtyTime}
          ok={!!oks.time}
          error={errors.time}
          onSave={() => saveBox("time")}
        />
      </SectionCard>

      <SectionCard
        icon={<Globe className="h-4 w-4" />}
        tint="indigo"
        title="Channels"
        subtitle="Official links + contact. Leave blank to clear."
      >
        {/* One column, one list — links and contacts are all just channels;
            no sub-grouping. */}
        <div className="mt-5 grid gap-3.5">
          {CHANNELS.map((c) => {
            const val = form.channels[c.key as string] ?? "";
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
          <TextField
            label="Email"
            leading={<Mail className="text-muted-foreground h-3.5 w-3.5 shrink-0" />}
            type="email"
            value={form.email}
            onChange={(x) => set("email", x)}
            disabled={anyPending}
          />
        </div>
        <SaveBar
          pending={pendingBox === "channels"}
          dirty={dirtyChannels}
          ok={!!oks.channels}
          error={errors.channels}
          onSave={() => saveBox("channels")}
        />
      </SectionCard>

      {/* Reservations — ordered contact channels for the Reservationist. */}
      <SectionCard
        icon={<CalendarCheck className="h-4 w-4" />}
        tint="teal"
        title="Reservations"
        subtitle="Mesita's AI agent makes the reservation by contacting the place — via phone, WhatsApp, or Instagram."
      >
        <p className="text-muted-foreground mt-5 text-xs">
          Order the channels the agent should try: it starts with the 1st choice and
          falls back down the list. Enable one, two, or all three.
        </p>
        <div className="mt-3.5 grid gap-3.5">
          {(["1st choice", "2nd choice", "3rd choice"] as const).map((slotLabel, slot) => {
            // Show the next empty slot only once the previous one is set —
            // the list grows as channels are enabled.
            if (slot > form.reservation.length) return null;
            const value = form.reservation[slot] ?? "";
            const resolved = formContactFor(form, value);
            const meta = RESERVATION_CHANNELS.find((c) => c.key === value);
            return (
              <label key={slotLabel} className="flex flex-col gap-1.5">
                <span className="text-foreground/90 flex min-h-4 items-center text-[13px] font-medium">
                  {slotLabel}
                </span>
                <select
                  value={value}
                  disabled={anyPending}
                  onChange={(e) =>
                    setReservationSlot(slot, e.target.value as ReservationChannel | "")
                  }
                  aria-label={`Reservation channel — ${slotLabel}`}
                  className="bg-muted/60 border-border/60 focus:border-ring/60 focus:bg-card focus:ring-ring/10 h-10 w-full rounded-xl border px-3 text-sm outline-none transition focus:ring-4 disabled:opacity-50"
                >
                  <option value="">{slot === 0 ? "Select…" : "None"}</option>
                  {RESERVATION_CHANNELS.filter(
                    (c) => c.key === value || !form.reservation.includes(c.key),
                  ).map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
                {/* No free-text input — the agent always contacts the PROFILE
                    value for the channel; the contact itself lives in Channels. */}
                {value ? (
                  resolved.trim() ? (
                    <span className="text-muted-foreground text-xs">
                      Uses the profile&apos;s {meta?.label ?? value}:{" "}
                      <span className="text-foreground/90 font-medium break-all">
                        {resolved}
                      </span>
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-amber-700">
                      No {meta?.label ?? value} on the profile yet — add it in Channels
                      first.
                    </span>
                  )
                ) : null}
              </label>
            );
          })}
        </div>
        <SaveBar
          pending={pendingBox === "reservations"}
          dirty={dirtyReservations}
          ok={!!oks.reservations}
          error={errors.reservations}
          onSave={() => saveBox("reservations")}
        />
      </SectionCard>

      <SectionCard
        icon={<Images className="h-4 w-4" />}
        tint="orange"
        title="Photos"
        subtitle="First photo is the hero. Reorder or remove; upload one at a time."
        action={
          <span className="text-muted-foreground text-[11px] tabular-nums">
            {form.photos.length} / {limits.photosMax}
          </span>
        }
      >
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
        <SaveBar
          pending={pendingBox === "photos"}
          dirty={dirtyPhotos}
          ok={!!oks.photos}
          error={errors.photos}
          onSave={() => saveBox("photos")}
        />
      </SectionCard>

      {children}

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

// ── Read-only display helpers ────────────────────────────────────────────

// Labelled read-only value used inside editable cards (Price, Category). The
// `auto` pill signals the value is Enricher-owned and not hand-edited.
function ReadField({
  label,
  auto,
  boxed,
  children,
}: {
  label: string;
  auto?: boolean;
  /** Render label + value like a (disabled) filled input, so the field sits
   *  flush with the editable TextFields around it instead of as bare text. */
  boxed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span
        className={
          boxed
            ? "text-foreground/90 flex min-h-4 items-center gap-1.5 text-[13px] font-medium"
            : "text-muted-foreground flex min-h-4 items-center gap-1.5 text-[11px] font-semibold tracking-[0.05em] uppercase"
        }
      >
        {label}
        {auto ? (
          <span className="text-muted-foreground/70 inline-flex items-center gap-0.5 text-[10px] font-normal tracking-normal normal-case">
            <Lock className="h-3 w-3" />
            auto
          </span>
        ) : null}
      </span>
      <div
        className={
          boxed
            ? "bg-muted/60 border-border/60 flex min-h-10 items-center rounded-xl border px-3.5 text-sm"
            : "flex min-h-9 items-center text-sm"
        }
      >
        {children}
      </div>
    </div>
  );
}

// Small "Open ↗" affordance shown in a link field's label when it has a value.
function OpenLink({ href }: { href: string }) {
  const trimmed = href.trim();
  const url = /^(https?|tel|mailto|sms):/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  const external = /^https?:/i.test(url);
  return (
    <a
      href={url}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      onClick={(e) => e.stopPropagation()}
      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5 text-[11px] font-medium transition"
    >
      Open
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}

function CopyIdButton({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(id);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1200);
        } catch {
          /* clipboard unavailable — ignore */
        }
      }}
      className="hover:text-foreground inline-flex items-center gap-1 transition"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-green-600" /> Copied
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" /> Copy
        </>
      )}
    </button>
  );
}

// ── The four spec boxes (MESITA-398) ─────────────────────────────────────

// No updated_by column exists, so attribute the last write by proximity: the
// Enricher's final write stamps enriched_at and bumps updated_at in the same
// statement — a tiny gap means the AI wrote last; anything later is a human
// edit (admin / business save).
function lastUpdatedBy(place: AdminPlace): "ai" | "human" | null {
  if (!place.updated_at) return null;
  if (!place.enriched_at) return "human";
  const updated = new Date(place.updated_at).getTime();
  const enriched = new Date(place.enriched_at).getTime();
  if (Number.isNaN(updated) || Number.isNaN(enriched)) return null;
  return updated - enriched <= 90_000 ? "ai" : "human";
}

// Meta — row identity + audit trail: UID, created, updated (and by whom),
// plus a live callout while an AI (the Enricher) is rewriting the place.
function MetaCard({
  place,
  enrichStatus,
}: {
  place: AdminPlace;
  enrichStatus: PlaceEnrichmentStatus | null;
}) {
  const badge = enrichmentBadge(enrichStatus);
  const by = lastUpdatedBy(place);
  return (
    <SectionCard
      icon={<Fingerprint className="h-4 w-4" />}
      tint="slate"
      title="Meta"
      subtitle="Row identity & audit trail."
    >
      {/* One boxed field per row — same filled-input language as every other
          card on this page. */}
      <div className="mt-5 flex flex-col gap-4">
        <ReadField label="Status" boxed>
          {place.status?.trim() ? (
            <span className="flex items-center gap-1.5 font-medium capitalize">
              <span
                className={
                  "h-1.5 w-1.5 shrink-0 rounded-full " +
                  (["active", "published", "live", "ready"].includes(
                    place.status.trim().toLowerCase(),
                  )
                    ? "bg-green-500"
                    : "bg-amber-500")
                }
                aria-hidden
              />
              {place.status}
            </span>
          ) : (
            "—"
          )}
        </ReadField>
        <ReadField label="UID" boxed>
          <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
            <code className="min-w-0 truncate font-mono text-[11px]">
              {place.id}
            </code>
            <span className="text-muted-foreground shrink-0 text-xs">
              <CopyIdButton id={place.id} />
            </span>
          </span>
        </ReadField>
        <ReadField label="Created at" boxed>
          {place.created_at ? formatAbsoluteUtc(place.created_at) : "—"}
        </ReadField>
        <ReadField label="Updated at" boxed>
          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
            {place.updated_at ? formatAbsoluteUtc(place.updated_at) : "—"}
            {by != null && (
              <span
                className={
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold " +
                  (by === "ai"
                    ? "bg-sky-500/10 text-sky-700"
                    : "bg-card text-muted-foreground border-border/70 border")
                }
              >
                by {by === "ai" ? "Enricher (AI)" : "human"}
              </span>
            )}
          </span>
        </ReadField>
        <ReadField label="Enriching status" boxed>
          <span
            className={
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold " +
              badge.cls
            }
          >
            {badge.spinning && (
              <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden />
            )}
            {badge.text}
          </span>
        </ReadField>
        {enrichStatus?.stage === "failed" && enrichStatus?.error ? (
          <p className="text-xs leading-snug text-red-600">
            Last enrichment failed: {enrichStatus.error}
          </p>
        ) : null}
      </div>
    </SectionCard>
  );
}

// Promos — read-only summary of the money levers; editing lives on the
// Promos tab. Plan · the four rewards (low → high) · visibility as 1–10.
function PromosCard({ place }: { place: AdminPlace }) {
  const sub = SUBSCRIPTIONS.find((s) => s.id === subscriptionForPlan(place.plan));
  const score = visibilityScore({
    plan: place.plan,
    welcome_free_rate: place.welcome_free_rate,
    welcome_premium_rate: place.welcome_premium_rate,
    free_rate: place.free_rate,
    premium_rate: place.premium_rate,
    monthly_promo_cap: place.monthly_promo_cap,
  });
  return (
    <SectionCard
      icon={<Percent className="h-4 w-4" />}
      tint="pink"
      title="Promos"
      subtitle="Plan, rewards & visibility — edit on the Promos tab."
      action={
        <Link
          href={unitSectionHref(place.id, "promos")}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-medium transition"
        >
          Edit
          <ArrowRight className="h-3 w-3" />
        </Link>
      }
    >
      {/* One boxed field per row — same filled-input language as the
          editable cards. */}
      <div className="mt-5 grid gap-4">
        <ReadField label="Plan" boxed>
          <span className="flex flex-wrap items-baseline gap-1.5">
            <span className="font-semibold">{planLabel(place.plan)}</span>
            {sub != null && (
              <span className="text-muted-foreground text-xs">
                {sub.price} {sub.cadence}
              </span>
            )}
            {place.fiscal_type ? (
              <span className="text-muted-foreground text-xs capitalize">
                · {place.fiscal_type}
              </span>
            ) : null}
          </span>
        </ReadField>
        <ReadField label="Visibility on Mesita" boxed>
          <span className="w-full py-2.5">
            <span className="flex items-baseline gap-1">
              <span className="font-display text-base leading-none font-bold tabular-nums">
                {score}
              </span>
              <span className="text-muted-foreground text-xs">/ 10</span>
            </span>
            <span className="mt-1.5 flex gap-0.5">
              {Array.from({ length: 10 }, (_, i) => (
                <span
                  key={i}
                  className={
                    "h-1.5 flex-1 rounded-full " +
                    (i < score ? "bg-pink-gradient" : "bg-muted/80")
                  }
                />
              ))}
            </span>
          </span>
        </ReadField>
      </div>
      <div className="mt-5 mb-2">
        <GroupLabel>Rewards</GroupLabel>
      </div>
      <div className="border-border/60 divide-border/60 divide-y overflow-hidden rounded-xl border">
        {REWARD_ROWS.map((row) => {
          const rate = place[row.col];
          return (
            <div
              key={row.col}
              className="flex items-center justify-between gap-3 px-3.5 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{row.label}</p>
                <p className="text-muted-foreground truncate text-xs">{row.hint}</p>
              </div>
              {typeof rate === "number" ? (
                <span className="text-foreground shrink-0 text-sm font-semibold tabular-nums">
                  {rate}%
                </span>
              ) : (
                <span className="text-muted-foreground shrink-0 text-xs italic">Off</span>
              )}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

// Ownership — partner verification + the accounts that own the place.
function OwnershipCard({
  place,
  owners,
}: {
  place: AdminPlace;
  owners: string[] | null;
}) {
  const verified = place.listing_type === "partner";
  return (
    <SectionCard
      icon={<ShieldCheck className="h-4 w-4" />}
      tint="emerald"
      title="Ownership"
      subtitle="Partner verification & owner accounts — manage on the Team tab."
      action={
        <Link
          href={unitSectionHref(place.id, "team")}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-medium transition"
        >
          Edit
          <ArrowRight className="h-3 w-3" />
        </Link>
      }
    >
      {/* One boxed field per row — same filled-input language as the
          editable cards. Verification is a single binary field; request
          history lives on the Team tab. */}
      <div className="mt-5 grid gap-4">
        <ReadField label="Verification status" boxed>
          {verified ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50/80 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
              <BadgeCheck className="h-3.5 w-3.5" />
              Verified
            </span>
          ) : (
            <span className="border-border/70 bg-card text-foreground/80 inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold">
              Not verified
            </span>
          )}
        </ReadField>
        <ReadField label="Owners" boxed>
          {owners === null ? (
            <span className="text-muted-foreground text-xs">Checking…</span>
          ) : owners.length === 0 ? (
            <span className="text-muted-foreground text-xs italic">
              No owners — nobody has claimed this place yet.
            </span>
          ) : (
            <ul className="flex w-full flex-col gap-1.5 py-2.5">
              {owners.map((email) => (
                <li key={email} className="flex min-w-0 items-center gap-2 text-sm">
                  <Mail className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{email}</span>
                </li>
              ))}
            </ul>
          )}
        </ReadField>
      </div>
    </SectionCard>
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={`Photo ${idx + 1}`}
              className="aspect-square w-full object-cover transition duration-300 group-hover:scale-[1.03]"
            />
            {idx === 0 && (
              <span className="bg-pink-gradient absolute top-2 left-2 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase shadow-sm">
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
                  onClick={() => onInfo(src)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 text-white backdrop-blur-sm transition hover:bg-white/30"
                  aria-label="Photo metadata"
                  title="Image metadata"
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
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
                <span className="text-[11px] font-medium">Uploading…</span>
              </>
            ) : (
              <>
                <ImagePlus className="h-5 w-5" />
                <span className="text-[11px] font-medium">Add photo</span>
              </>
            )}
          </label>
        )}
      </div>

      <p className="text-muted-foreground mt-3 text-[11px] tabular-nums">
        {photos.length}/{photosMax} photos · JPG, PNG, WEBP, AVIF · max 8 MB
      </p>
    </div>
  );
}

// Derives a display badge from the raw enrichment status. Prefers the live
// place_research stage; falls back to the project's content_status when the
// place has no research row yet (created but never enriched).
function enrichmentBadge(
  s: PlaceEnrichmentStatus | null,
): { text: string; cls: string; spinning: boolean } {
  const stage = s?.stage ?? null;
  if (stage === "done")
    return { text: "Enriched", cls: "bg-green-500/10 text-green-600", spinning: false };
  if (stage === "failed")
    return { text: "Failed", cls: "bg-red-500/10 text-red-600", spinning: false };
  if (stage === "research" || stage === "analysis" || stage === "contents") {
    return {
      text: `Enriching… (${stage})`,
      cls: "bg-blue-500/10 text-blue-600",
      spinning: true,
    };
  }
  switch (s?.content_status) {
    case "ready":
      return { text: "Enriched", cls: "bg-green-500/10 text-green-600", spinning: false };
    case "generating":
      return { text: "Enriching…", cls: "bg-blue-500/10 text-blue-600", spinning: true };
    case "failed":
      return { text: "Failed", cls: "bg-red-500/10 text-red-600", spinning: false };
    default:
      return { text: "Not enriched", cls: "bg-muted text-muted-foreground", spinning: false };
  }
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="border-border/70 bg-card shadow-elev flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border"
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
