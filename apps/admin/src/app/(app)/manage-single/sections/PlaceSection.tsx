"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  Check,
  Clock,
  Copy,
  ExternalLink,
  Globe,
  ImagePlus,
  Images,
  Info,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Phone,
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
import { GroupLabel, SaveBar, SectionCard, TextArea, TextField, TINT_CHIP } from "../ui";
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
  { key: "tiktok_url", label: "TikTok", logo: "/channels/tiktok.svg" },
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
  profileKey: keyof AdminPlace;
  kind: "url" | "phone";
  logo?: string;
  Icon?: LucideIcon;
  placeholder: string;
}[] = [
  {
    key: "instagram",
    label: "Instagram",
    profileKey: "instagram_url",
    kind: "url",
    logo: "/channels/instagram.svg",
    placeholder: "https://instagram.com/…",
  },
  {
    key: "whatsapp",
    label: "WhatsApp",
    profileKey: "whatsapp_url",
    kind: "url",
    logo: "/channels/whatsapp.svg",
    placeholder: "https://wa.me/52…",
  },
  {
    key: "phone",
    label: "Phone",
    profileKey: "phone",
    kind: "phone",
    Icon: Phone,
    placeholder: "+52 55 0000 0000",
  },
];

type ReservationForm = {
  channel: ReservationChannel | "";
  value: string;
};

function profileValueFor(place: AdminPlace, channel: ReservationChannel): string {
  const meta = RESERVATION_CHANNELS.find((c) => c.key === channel);
  return meta ? str(place[meta.profileKey]) : "";
}

/** Read the single contact target; tolerate the old per-channel routes shape. */
function readReservationTarget(v: AdminPlace): ReservationForm {
  const raw = v.products?.reservations as unknown;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    if (
      (obj.channel === "instagram" || obj.channel === "whatsapp" || obj.channel === "phone") &&
      typeof obj.channel === "string"
    ) {
      return {
        channel: obj.channel,
        value: typeof obj.value === "string" ? obj.value : "",
      };
    }
    // Legacy MESITA-378 routes: prefer an explicit "different" value, else a
    // profile channel that already has a value (phone → whatsapp → instagram).
    for (const key of ["phone", "whatsapp", "instagram"] as const) {
      const c = obj[key];
      const route = c && typeof c === "object" ? (c as Record<string, unknown>) : null;
      if (route?.mode === "different" && typeof route.value === "string" && route.value.trim()) {
        return { channel: key, value: route.value };
      }
    }
    for (const key of ["phone", "whatsapp", "instagram"] as const) {
      const c = obj[key];
      const route = c && typeof c === "object" ? (c as Record<string, unknown>) : null;
      if (!route || route.mode === "different") continue;
      const profile = profileValueFor(v, key);
      if (profile) return { channel: key, value: profile };
    }
  }
  return { channel: "", value: "" };
}

function serializeReservationTarget(
  target: ReservationForm,
): ReservationTarget | null {
  if (!target.channel) return null;
  const value = target.value.trim();
  return { channel: target.channel, value: value || null };
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
  reservation: ReservationForm;
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
        reservations: serializeReservationTarget(f.reservation),
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
  /** Extra Place-page boxes (Products, Reviews) — same two-column grid. */
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
  const setReservationChannel = (channel: ReservationChannel | "") => {
    setForm((f) => {
      if (!channel) return { ...f, reservation: { channel: "", value: "" } };
      const profile = profileValueFor(place, channel);
      const keepValue =
        f.reservation.channel === channel && f.reservation.value.trim()
          ? f.reservation.value
          : profile;
      return { ...f, reservation: { channel, value: keepValue } };
    });
  };
  const setReservationValue = (value: string) =>
    setForm((f) => ({ ...f, reservation: { ...f.reservation, value } }));
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
    // Every Place box shares one two-column grid — no full-width mono heroes.
    // lg (not xl): admin content + sidebar rarely reaches 1280px of free width.
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 lg:gap-5">
      {/* Overview + Basics live in ONE card: read-only signals on top, the
          editable identity (name / about / tags) below a divider. */}
      <OverviewBand place={place} enrichStatus={enrichStatus} ownership={ownership}>
        <TextField
          label="Name"
          value={form.name}
          onChange={(x) => set("name", x.slice(0, limits.placeNameMax))}
          maxLength={limits.placeNameMax}
          disabled={anyPending}
        />
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
            rows={4}
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
      </OverviewBand>

      {/* Price + Category are Enricher/Google-derived — read-only, own box. */}
      <SectionCard
        icon={<BadgeCheck className="h-4 w-4" />}
        tint="amber"
        title="Price & category"
        subtitle="Inferred by Enricher / Google Places — not editable here."
      >
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <ReadField label="Price">
            <PriceDisplay level={place.price_level} />
          </ReadField>
          {/* Friendly label (e.g. "🪩 Nightclub"), never the snakecase slug. */}
          <ReadField label="Category">
            {place.category_label ?? place.category ?? "—"}
          </ReadField>
        </div>
      </SectionCard>

      {/* Location is native — Google Places seed + Enricher synthesis. The EF
          rejects manual address writes, so this whole box is read-only. */}
      <SectionCard
        icon={<MapPin className="h-4 w-4" />}
        tint="sky"
        title="Location"
        subtitle="Native — address & coordinates come from Google / the Enricher."
      >
        <div className="mt-5">
          <ReadField label="Address" auto>
            {place.address?.trim() ? place.address : "—"}
          </ReadField>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
          <Fact label="Zone">{place.zone ?? "—"}</Fact>
          <Fact label="City">{place.city ?? "—"}</Fact>
          <Fact label="Lat">
            <span className="font-mono tabular-nums">
              {place.lat == null ? "—" : place.lat}
            </span>
          </Fact>
          <Fact label="Lng">
            <span className="font-mono tabular-nums">
              {place.lng == null ? "—" : place.lng}
            </span>
          </Fact>
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
                      className="bg-muted/50 focus:border-ring/60 focus:bg-card focus:ring-ring/10 h-8 rounded-lg border border-transparent px-2 text-sm tabular-nums outline-none transition focus:ring-4"
                    />
                    <span className="text-muted-foreground text-xs">–</span>
                    <input
                      type="time"
                      value={h.close}
                      disabled={anyPending}
                      onChange={(e) => setDay(d, { close: e.target.value })}
                      className="bg-muted/50 focus:border-ring/60 focus:bg-card focus:ring-ring/10 h-8 rounded-lg border border-transparent px-2 text-sm tabular-nums outline-none transition focus:ring-4"
                    />
                  </div>
                )}
                <button
                  type="button"
                  role="switch"
                  aria-checked={!h.closed}
                  aria-label={`${d} ${h.closed ? "closed" : "open"}`}
                  disabled={anyPending}
                  onClick={() => setDay(d, { closed: !h.closed })}
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
        <div className="mt-5 grid gap-3.5 sm:grid-cols-2">
          {CHANNELS.map((c) => {
            const val = form.channels[c.key as string] ?? "";
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
        </div>
        <div className="mt-6 mb-2">
          <GroupLabel>Contact</GroupLabel>
        </div>
        <div className="grid gap-3.5 sm:grid-cols-2">
          {/* Country code is mandatory — the update EF rejects phones without +CC. */}
          <TextField
            label="Phone"
            leading={<Phone className="text-muted-foreground h-3.5 w-3.5 shrink-0" />}
            value={form.phone}
            onChange={(x) => set("phone", x)}
            placeholder="+52 81 8378 2164"
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

      <SectionCard
        icon={<Images className="h-4 w-4" />}
        tint="pink"
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

      {/* Reservations — one contact channel for the reservationist. */}
      <SectionCard
        icon={<CalendarCheck className="h-4 w-4" />}
        tint="teal"
        title="Reservations"
        subtitle="What should we contact for reservations — Instagram, WhatsApp, or phone."
      >
        {(() => {
          const selected = RESERVATION_CHANNELS.find((c) => c.key === form.reservation.channel);
          const value = form.reservation.value;
          const isUrl = selected?.kind === "url";
          return (
            <div className="mt-5 grid gap-3.5 sm:grid-cols-[minmax(0,11rem)_1fr]">
              <label className="flex flex-col gap-1.5">
                <span className="text-foreground/80 flex min-h-4 items-center text-[13px] font-medium">
                  Contact via
                </span>
                <select
                  value={form.reservation.channel}
                  disabled={anyPending}
                  onChange={(e) =>
                    setReservationChannel(e.target.value as ReservationChannel | "")
                  }
                  aria-label="Reservation contact channel"
                  className="bg-muted/50 focus:border-ring/60 focus:bg-card focus:ring-ring/10 h-10 w-full rounded-xl border border-transparent px-3 text-sm outline-none transition focus:ring-4 disabled:opacity-50"
                >
                  <option value="">Select…</option>
                  {RESERVATION_CHANNELS.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <TextField
                label={selected ? selected.label : "Value"}
                leading={
                  selected ? (
                    <ChannelLabelIcon logo={selected.logo} Icon={selected.Icon} />
                  ) : undefined
                }
                labelRight={
                  isUrl && value.trim() ? <OpenLink href={value} /> : undefined
                }
                value={value}
                onChange={setReservationValue}
                placeholder={selected?.placeholder ?? "Pick a channel first"}
                disabled={anyPending || !form.reservation.channel}
              />
            </div>
          );
        })()}
        <SaveBar
          pending={pendingBox === "reservations"}
          dirty={dirtyReservations}
          ok={!!oks.reservations}
          error={errors.reservations}
          onSave={() => saveBox("reservations")}
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
  children,
}: {
  label: string;
  auto?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-muted-foreground flex min-h-4 items-center gap-1.5 text-[11px] font-semibold tracking-[0.05em] uppercase">
        {label}
        {auto ? (
          <span className="text-muted-foreground/70 inline-flex items-center gap-0.5 text-[10px] font-normal tracking-normal normal-case">
            <Lock className="h-3 w-3" />
            auto
          </span>
        ) : null}
      </span>
      <div className="flex min-h-9 items-center text-sm">{children}</div>
    </div>
  );
}

// Compact label→value fact (Location coordinates, etc.).
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.06em] uppercase">
        {label}
      </p>
      <div className="mt-0.5 truncate text-sm">{children}</div>
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

const GOOD_STATUS = new Set(["published", "active", "live", "ready"]);

// The Overview card — read-only signals (enrichment/verification/ownership/
// plan facts as soft tiles under a faint brand wash) with the editable
// identity basics (name / about / tags) folded in below a divider. The one
// "hero" card on the page; everything else stays calm.
function OverviewBand({
  place,
  enrichStatus,
  ownership,
  children,
}: {
  place: AdminPlace;
  enrichStatus: PlaceEnrichmentStatus | null;
  ownership: "loading" | "owned" | "unowned";
  /** Editable basics (fields + SaveBar) rendered below the signals. */
  children?: React.ReactNode;
}) {
  const badge = enrichmentBadge(enrichStatus);
  const verified = place.listing_type === "partner";
  const status = place.status?.trim() ? place.status : null;
  const statusDot = status
    ? GOOD_STATUS.has(status.toLowerCase())
      ? "bg-green-500"
      : "bg-amber-500"
    : "bg-muted-foreground/40";

  return (
    <section className="border-border/70 bg-card shadow-card relative overflow-hidden rounded-2xl border">
      {/* Faint brand wash, top-right — identity card, read-only. */}
      <div
        aria-hidden
        className="bg-pink-gradient pointer-events-none absolute -top-24 -right-16 h-52 w-80 rounded-full opacity-[0.08] blur-2xl"
      />

      <div className="relative flex flex-wrap items-center justify-between gap-3 px-5 pt-5 sm:px-6">
        <div className="flex items-center gap-3">
          <span
            className={
              "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl " +
              TINT_CHIP.rose
            }
          >
            <Store className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-display text-base font-semibold tracking-tight">Overview</h2>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Enricher &amp; catalog signals · name, about, and tags.
            </p>
          </div>
        </div>
        {place.updated_at ? (
          <span className="border-border/70 bg-background/70 text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]">
            <Clock className="h-3 w-3" />
            Updated {formatAbsoluteUtc(place.updated_at)}
          </span>
        ) : null}
      </div>

      {/* Fact tiles — wrap 2→3 cols; each signal reads as its own soft chip. */}
      <div className="relative mx-5 mt-4 grid grid-cols-2 gap-2 sm:mx-6 sm:grid-cols-3">
        <FactTile label="Status">
          <span className="flex items-center gap-1.5">
            <span className={"h-1.5 w-1.5 rounded-full " + statusDot} aria-hidden />
            <span className="text-sm font-medium capitalize">{status ?? "—"}</span>
          </span>
        </FactTile>
        <FactTile label="Enrichment">
          <span
            className={
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold " +
              badge.cls
            }
          >
            {badge.spinning ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : null}
            {badge.text}
          </span>
        </FactTile>
        <FactTile label="Verification">
          <span
            className={
              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold " +
              (verified ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground")
            }
          >
            {listingLabel(place.listing_type)}
          </span>
        </FactTile>
        <FactTile label="Ownership">
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
            {ownership === "loading" ? "Checking…" : ownership === "owned" ? "Owned" : "Unowned"}
          </span>
        </FactTile>
        <FactTile label="Plan">
          <span className="flex items-baseline gap-1.5">
            <span className="font-display text-sm font-semibold">{planLabel(place.plan)}</span>
            {place.fiscal_type ? (
              <span className="text-muted-foreground text-xs capitalize">
                · {place.fiscal_type}
              </span>
            ) : null}
          </span>
        </FactTile>
      </div>

      {enrichStatus?.last_enriched_at ||
      (enrichStatus?.stage === "failed" && enrichStatus?.error) ? (
        <div className="text-muted-foreground relative mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 px-5 text-xs sm:px-6">
          {enrichStatus?.last_enriched_at ? (
            <span>Last enriched {formatAbsoluteUtc(enrichStatus.last_enriched_at)}</span>
          ) : null}
          {enrichStatus?.stage === "failed" && enrichStatus?.error ? (
            <span className="text-red-600">· {enrichStatus.error}</span>
          ) : null}
        </div>
      ) : null}

      <div className="text-muted-foreground relative mt-3 flex items-center gap-2 px-5 pb-4 text-xs sm:px-6">
        <span className="font-medium">ID</span>
        <code className="bg-muted min-w-0 truncate rounded-md px-1.5 py-0.5 font-mono text-[11px]">
          {place.id}
        </code>
        <CopyIdButton id={place.id} />
      </div>

      {/* Editable identity zone — divided from the read-only signals above. */}
      {children != null ? (
        <div className="border-border/60 relative border-t px-5 pt-4 pb-5 sm:px-6">
          {children}
        </div>
      ) : null}
    </section>
  );
}

function FactTile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-border/60 bg-background/60 rounded-xl border px-3.5 py-2.5">
      <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.09em] uppercase">
        {label}
      </p>
      <div className="mt-1.5">{children}</div>
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
