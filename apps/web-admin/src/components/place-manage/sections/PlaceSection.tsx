"use client";

import { ActionStatesCard } from "./ActionStatesCard";
import { useEffect, useMemo, useState } from "react";
import {
  Clock,
  Globe,
  MapPin,
  Store,
  type LucideIcon,
} from "lucide-react";
import {
  type AdminPlace,
  type PlaceFieldLimits,
} from "../actions";
import { PlaceFamilyField } from "../PlaceFamilyField";
import {
  PlaceGoogleCategoriesField,
  PlaceMesitaTagsField,
} from "../PlaceCategoryListFields";
import { googleFormattedAddress } from "../google-location";
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
import {
  formatPlacePriceRange,
  MAX_PRICE_LEVEL,
  priceLevelName,
} from "../place-price";

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

function verifiedAction(key: string, value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (key === "uber_eats_url" && url.hostname.includes("ubereats.com") && url.pathname.includes("/store/")) {
      return "Pedir";
    }
    if (key === "opentable_url" && url.hostname.includes("opentable.") && url.pathname.startsWith("/r/")) {
      return "Reservar";
    }
  } catch {
    return null;
  }
  return null;
}

function linkAction(key: string, value: string) {
  if (!value.trim()) return undefined;
  const action = verifiedAction(key, value);
  return (
    <span className="inline-flex items-center gap-2">
      {action ? <span>{action}</span> : null}
      <OpenLink href={value} />
    </span>
  );
}

function ChannelLabelIcon({
  logo,
  Icon,
}: {
  logo?: string;
  Icon?: LucideIcon;
}) {
  if (logo) {
    // Static brand SVG beside the provider name — next/image adds nothing here.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logo} alt="" aria-hidden className="h-4 w-4 shrink-0" />
    );
  }
  if (Icon) {
    return <Icon className="text-muted-foreground h-4 w-4 shrink-0" />;
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

function locationAddress(place: AdminPlace): string {
  return (
    googleFormattedAddress(place.google_address) ||
    place.address?.trim() ||
    "—"
  );
}

type DayHours = { closed: boolean; open: string; close: string };
// Address is deliberately absent: it is native (Google/Enricher-sourced) and
// admin-web-update-place does not accept it — Location renders read-only.
type Form = {
  /** Operator override → places.mesita_name. Blank ⇒ the place follows Google. */
  mesitaName: string;
  /** Canonical Presentation — English (Mesita core). The column stays
   * `description`; the FIELD is Presentation (Pato, 2026-08-23). */
  description: string;
  phone: string;
  channels: Record<string, string>;
  hours: Record<Day, DayHours>;
};

// Limits arrive on the profile read. These match ENRICH_FIELD_LIMITS and
// exist only so placeToForm can be called before the caller passes them.
const FALLBACK_LIMITS: PlaceFieldLimits = {
  placeNameMax: 80,
  descriptionMax: 500,
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
    description: (v.description ?? "").slice(0, limits.descriptionMax),
    phone: v.phone ?? "",
    channels,
    hours,
  };
}

// Build a partial business-update-place patch for one Place box.
// Empty strings become null so a cleared field actually clears.
type PlaceBox = "basics" | "time" | "channels";

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
  throw new Error(`unknown Place box: ${String(box)}`);
}

function sliceEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function PlaceSection({
  place,
  children,
}: {
  place: AdminPlace;
  /** Extra Place-page boxes (Reviews) — flow in the same masonry columns. */
  children?: React.ReactNode;
}) {
  const { savePending, profile, reportSocialDraft } = usePlaceContext();
  const limits = profile.fieldLimits;
  const [form, setForm] = useState<Form>(() => placeToForm(place, limits));
  const [saved, setSaved] = useState<Form>(form);

  const dirtyBasics = useMemo(
    () =>
      !sliceEqual(
        {
          mesitaName: form.mesitaName,
          description: form.description,
        },
        {
          mesitaName: saved.mesitaName,
          description: saved.description,
        },
      ),
    [form.mesitaName, form.description, saved.mesitaName, saved.description],
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
  const placeDirty = dirtyBasics || dirtyTime || dirtyChannels;

  // Four boxes, ONE patch. Only the dirty ones contribute, so a save never
  // rewrites columns nobody touched — which matters for Basics in particular,
  // where re-sending an untouched `description` would count as an operator
  // overwrite of Enricher output.
  useSectionSaver(
    "place",
    placeDirty,
    () => {
      const parts: Record<string, unknown>[] = [];
      if (dirtyBasics) parts.push(boxToPatch("basics", form, place.id, limits));
      if (dirtyTime) parts.push(boxToPatch("time", form, place.id, limits));
      if (dirtyChannels)
        parts.push(boxToPatch("channels", form, place.id, limits));
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
    },
    () => {
      const next = placeToForm(place, limits);
      setForm(next);
      setSaved(next);
    },
  );

  useEffect(() => {
    reportSocialDraft({
      instagram_url: form.channels.instagram_url ?? "",
      facebook_url: form.channels.facebook_url ?? "",
    });
  }, [
    form.channels.instagram_url,
    form.channels.facebook_url,
    reportSocialDraft,
  ]);

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

  return (
    // Masonry, not a grid: CSS columns pack the cards top-down, so a short
    // card never strands empty space beside a tall neighbour — columns don't
    // row-align by design (MESITA-399). Every card roots as a <section>
    // (SectionCard) and gets the gutter margin + break-inside-avoid via
    // [&>section]; the fixed photo dialog is a <div>, exempt and out of flow.
    // lg (not xl): admin content + sidebar rarely reaches 1280px of free width.
// xl:columns-3 is for the BUSINESS console (MESITA-1558), which has no
// sidebar and a fluid container, so at xl it genuinely has the ~1300px
// three ~440px columns need — the measure these cards were drawn at. In
// admin the xl breakpoint is simply never reached behind the w-60 rail,
// so this is the same reasoning applied to a wider box, not a new rule.
    <div className="columns-1 gap-4 pb-8 [&>section]:mb-4 [&>section]:break-inside-avoid [&>details]:mb-4 [&>details]:break-inside-avoid lg:columns-2 lg:gap-5 lg:pb-10 lg:[&>section]:mb-5 lg:[&>details]:mb-5 xl:columns-3">
      {/* Box order (MESITA-547 / MESITA-720 / MESITA-834 / MESITA-900;
          Basics, Location and Hours are separate cards — Pato, 2026-08-29):
          Basics → Location → Hours → Links. Mesita photos live on Admin.
          Reviews is its own tab (MESITA-2183).
          Menus is unwired (MESITA-2175). Mesita-internal cards live on Admin;
          Team on Controls; the reputation rail on Activity. */}
      <SectionCard
        icon={<Store className="h-4 w-4" />}
        tint="rose"
        title="Basics"
        subtitle="What this place is."
      >
        {/* Pato's fields, in his order (MESITA-2790; Mesita categories left
            with MESITA-2827): one list, so a reorder or a restored row is one
            edit. One field per row. */}
        <div className="mt-5 grid gap-4">
          {[
            <ReadField key="google-name" label="Google name" auto boxed>
              {(place.google_name ?? "").trim() || "—"}
            </ReadField>,
            <ReadField key="google-price" label="Google price" auto boxed>
              <PriceDisplay level={place.price_level} currency={place.currency} />
            </ReadField>,
            <PlaceGoogleCategoriesField key="google-categories" />,
            <TextField
              key="mesita-name"
              label="Mesita name"
              value={form.mesitaName}
              onChange={(x) => set("mesitaName", x.slice(0, limits.placeNameMax))}
              maxLength={limits.placeNameMax}
              disabled={anyPending}
              placeholder={(place.google_name ?? "").trim() || undefined}
            />,
            <TextArea
              key="mesita-presentation"
              label="Mesita presentation"
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
            />,
            <PlaceMesitaTagsField key="mesita-tags" />,
            <PlaceFamilyField key="families" />,
          ]}
        </div>
      </SectionCard>

      <SectionCard
        icon={<MapPin className="h-4 w-4" />}
        tint="sky"
        title="Location"
        subtitle="Where it is."
      >
        <div className="mt-5 grid gap-4">
          <ReadField label="Google Place ID" auto boxed>
            {place.google_place_id?.trim() ? place.google_place_id : "—"}
          </ReadField>
          <ReadField label="Google Address" auto boxed>
            {locationAddress(place)}
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
      </SectionCard>

      <SectionCard
        icon={<Globe className="h-4 w-4" />}
        tint="indigo"
        title="Links"
      >
        {/* One column, one list — links and contacts are all just channels;
            no sub-grouping. grid-cols-1 (minmax(0,1fr)) bounds the column so a
            long unbreakable URL truncates instead of blowing the card wider
            than its masonry column. */}
        <div className="mt-5 grid grid-cols-1 gap-3.5">
          {CHANNELS.map((c) => {
            const val = form.channels[c.key as string] ?? "";
            const mark = (
              <ChannelLabelIcon logo={c.logo} Icon={c.Icon} />
            );
            if (c.readOnly) {
              return (
                <ReadField
                  key={c.key as string}
                  label={c.label}
                  icon={mark}
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
                  icon={mark}
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
                icon={mark}
                labelRight={linkAction(c.key as string, val)}
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
            labelRight={
              form.phone.trim() ? (
                <OpenLink href={`tel:${form.phone.replace(/\s+/g, "")}`} />
              ) : undefined
            }
            value={form.phone}
            onChange={(x) => set("phone", x)}
            placeholder="81 8378 2164"
            disabled={anyPending}
          />
        </div>
      </SectionCard>

      <ActionStatesCard place={place} />

      {children}
    </div>
  );
}
