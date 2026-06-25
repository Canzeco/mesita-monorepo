"use client";

import { useMemo, useState, useTransition } from "react";
import { Clock, Globe, ImageOff, MapPin } from "lucide-react";
import { updateVenue, type AdminVenue } from "../actions";
import { ErrorNote, SaveBar, SectionCard, TextArea, TextField } from "../ui";

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

const CHANNELS: { key: keyof AdminVenue; label: string }[] = [
  { key: "website_url", label: "Website" },
  { key: "instagram_url", label: "Instagram" },
  { key: "facebook_url", label: "Facebook" },
  { key: "tiktok_url", label: "TikTok" },
  { key: "youtube_url", label: "YouTube" },
  { key: "whatsapp_url", label: "WhatsApp" },
  { key: "google_maps_url", label: "Google Maps" },
  { key: "opentable_url", label: "OpenTable" },
  { key: "uber_eats_url", label: "Uber Eats" },
  { key: "rappi_url", label: "Rappi" },
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
  photos: string;
  channels: Record<string, string>;
  hours: Record<Day, DayHours>;
};

const str = (v: unknown) => (typeof v === "string" ? v : "");

const VENUE_NAME_MAX = 80;
const TAGS_PER_VENUE_MAX = 20;
const PHOTOS_MAX = 10;

function venueToForm(v: AdminVenue): Form {
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
    name: (v.name ?? "").slice(0, VENUE_NAME_MAX),
    category: v.category ?? "",
    description: v.description ?? "",
    phone: v.phone ?? "",
    email: v.email ?? "",
    tags: (v.tags ?? []).join(", "),
    photos: (v.photos ?? []).join("\n"),
    channels,
    hours,
  };
}

// Build the business-update-unit patch. Empty strings become null so a cleared
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
    name: f.name.trim().slice(0, VENUE_NAME_MAX),
    category: nz(f.category),
    description: nz(f.description),
    phone: nz(f.phone),
    email: nz(f.email),
    tags: f.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, TAGS_PER_VENUE_MAX),
    photos: f.photos
      .split("\n")
      .map((p) => p.trim())
      .filter(Boolean)
      .slice(0, PHOTOS_MAX),
    hours,
  };
  for (const c of CHANNELS) patch[c.key as string] = nz(f.channels[c.key as string]);
  return patch;
}

export function PlaceSection({
  venue,
  onSaved,
}: {
  venue: AdminVenue;
  onSaved: (v: AdminVenue) => void;
}) {
  const [form, setForm] = useState<Form>(() => venueToForm(venue));
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

  const photoUrls = form.photos.split("\n").map((p) => p.trim()).filter(Boolean);

  const save = () => {
    if (!dirty || !form.name.trim()) {
      if (!form.name.trim()) setError("Name is required.");
      return;
    }
    setError(null);
    setOk(false);
    start(async () => {
      const r = await updateVenue(formToPatch(form, venue.id) as { id: string });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      const fresh = venueToForm(r.data);
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
        subtitle={`Profile for ${venue.name}. Name, category, description and contact.`}
      >
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <TextField
            label="Name"
            value={form.name}
            onChange={(x) => set("name", x.slice(0, VENUE_NAME_MAX))}
            maxLength={VENUE_NAME_MAX}
            disabled={pending}
          />
          <TextField label="Category (slug)" value={form.category} onChange={(x) => set("category", x)} placeholder="e.g. cafe" disabled={pending} />
        </div>
        <div className="mt-4">
          <TextArea label="Description / About" value={form.description} onChange={(x) => set("description", x)} rows={5} maxLength={2000} disabled={pending} />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <TextField label="Phone" value={form.phone} onChange={(x) => set("phone", x)} disabled={pending} />
          <TextField label="Email" type="email" value={form.email} onChange={(x) => set("email", x)} disabled={pending} />
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
            {TAGS_PER_VENUE_MAX} tags
          </p>
        </div>
      </SectionCard>

      <SectionCard
        icon={<Globe className="text-muted-foreground h-4 w-4" />}
        title="Channels"
        subtitle="Official links. Leave blank to clear."
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
        </div>
      </SectionCard>

      <SectionCard
        icon={<Clock className="text-muted-foreground h-4 w-4" />}
        title="Hours"
        subtitle="One range per day. Toggle Closed for days the venue isn't open."
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
        subtitle="One image URL per line. These are the venue's saved photos (first = hero)."
      >
        {photoUrls.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {photoUrls.slice(0, 12).map((u, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={`${u}-${i}`} src={u} alt={`photo ${i + 1}`} className="border-border h-16 w-16 rounded-lg border object-cover" />
            ))}
          </div>
        )}
        <div className="mt-4">
          <TextArea label="Photo URLs" value={form.photos} onChange={(x) => set("photos", x)} rows={5} placeholder={"https://…\nhttps://…"} disabled={pending} />
          <p className="text-muted-foreground mt-1 text-xs tabular-nums">
            {photoUrls.length}/{PHOTOS_MAX} photos
          </p>
        </div>
      </SectionCard>

      <div>
        <SaveBar pending={pending} dirty={dirty} ok={ok} onSave={save} />
        {error && <ErrorNote message={error} />}
      </div>
    </div>
  );
}
