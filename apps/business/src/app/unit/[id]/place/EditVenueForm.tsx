"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  X,
  Globe,
  Instagram,
  MessageCircle,
  MapPin,
  Navigation,
  Star,
  Mail,
  Phone as PhoneIcon,
  FileText,
  Facebook,
  Music2,
  ShoppingBag,
  UtensilsCrossed,
  ExternalLink,
  Save,
  Check,
  Loader2,
  Clock,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  ImagePlus,
  Users,
  BadgeCheck,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Cloud,
  Upload,
} from "lucide-react";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  apiUpdateVenue,
  type MyVenue,
  type UpdateVenueInput,
  type VenueHours,
} from "@/lib/api/venues";
import { SubTabs, type SubTabItem } from "@/components/business/SubTabs";
import { Field, GoogleLogo, InstagramLogo, Section } from "@/components/shared";
import { cn, errMsg } from "@/lib/utils";
import { resolveVenueCategoryName } from "@/lib/venue-category";
import {
  INPUT_CLASS as INPUT,
  TEXTAREA_CLASS as TEXTAREA,
  TINY_LABEL_CLASS,
} from "@/lib/ui-classes";

// Place page driven by the Notion Components spec:
//   - M-Place-V=YES → component renders here
//   - Business-E=YES → component is editable; otherwise read-only
// Read-only signal & metadata fields fall back to a "not found yet" note
// when the value is null so the business understands the enrichment pipeline
// is still working on it — except Name + Category, which are always
// business-authored and therefore never get the note.

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
type HoursRange = { open: string; close: string };
type DayShifts = { ranges: HoursRange[]; closed: boolean };
type MenuEntry = { name: string; url: string };

const DAYS: { key: DayKey; label: string; long: keyof VenueHours }[] = [
  { key: "mon", label: "Mon", long: "monday" },
  { key: "tue", label: "Tue", long: "tuesday" },
  { key: "wed", label: "Wed", long: "wednesday" },
  { key: "thu", label: "Thu", long: "thursday" },
  { key: "fri", label: "Fri", long: "friday" },
  { key: "sat", label: "Sat", long: "saturday" },
  { key: "sun", label: "Sun", long: "sunday" },
];

const MAX_SHIFTS_PER_DAY = 1;

type FormState = {
  name: string;
  category: string;
  description: string;
  hours: Record<DayKey, DayShifts>;
  menu_links: MenuEntry[];
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
  youtube_url: string;
  threads_url: string;
  reddit_url: string;
  opentable_url: string;
  resy_url: string;
  tripadvisor_url: string;
  google_maps_url: string;
  rappi_url: string;
  uber_eats_url: string;
  didi_food_url: string;
};

// Tier names for the price-level readout. `PRICE_LEVEL_MAX` is 4 ($–$$$$).
const PRICE_LEVEL_MAX = 4;

type PlaceTab = "basics" | "channels" | "media" | "reviews" | "preview";

const PLACE_TABS: readonly SubTabItem<PlaceTab>[] = [
  { id: "basics", label: "Basics" },
  { id: "channels", label: "Channels" },
  { id: "media", label: "Media" },
  { id: "reviews", label: "Reviews" },
  { id: "preview", label: "Preview" },
];
const PRICE_TIER_LABEL: Record<number, string> = {
  1: "Budget",
  2: "Casual",
  3: "Upscale",
  4: "Fine dining",
};

const SAVED_TOAST_MS = 2200;
const VENUE_NAME_MAX = 120;
const DESCRIPTION_MAX = 7000;
const TAG_MAX = 40;
const MAX_PHOTOS = 10;
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);
const ALLOWED_IMAGE_ACCEPT = Array.from(ALLOWED_IMAGE_MIME_TYPES).join(",");
const ALLOWED_MENU_MIME_TYPES = new Set([
  "application/pdf",
  ...ALLOWED_IMAGE_MIME_TYPES,
]);
const ALLOWED_MENU_ACCEPT = Array.from(ALLOWED_MENU_MIME_TYPES).join(",");

const NOT_FOUND_NOTE = "Not found yet — pipeline still searching.";

// Example copy in the Description textarea so the business has something
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

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extForFile(file: File): string {
  const fromMime = (() => {
    switch (file.type) {
      case "image/jpeg":
        return "jpg";
      case "image/png":
        return "png";
      case "image/webp":
        return "webp";
      case "image/avif":
        return "avif";
      default:
        return null;
    }
  })();
  if (fromMime) return fromMime;
  const raw = file.name.trim().toLowerCase();
  const fromName = raw.includes(".") ? raw.split(".").pop() : null;
  return fromName && /^[a-z0-9]+$/.test(fromName) ? fromName : "jpg";
}

function validateUploadFile(file: File): string | null {
  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
    return "Unsupported file type. Use JPG, PNG, WEBP, or AVIF.";
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `File is too large (${formatBytes(file.size)}). Max ${formatBytes(MAX_UPLOAD_BYTES)}.`;
  }
  return null;
}

function validateMenuUploadFile(file: File): string | null {
  if (!ALLOWED_MENU_MIME_TYPES.has(file.type)) {
    return "Use a PDF or image (JPG, PNG, WEBP, AVIF).";
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `File is too large (${formatBytes(file.size)}). Max ${formatBytes(MAX_UPLOAD_BYTES)}.`;
  }
  return null;
}

function extForMenuFile(file: File): string {
  if (file.type === "application/pdf") return "pdf";
  return extForFile(file);
}

function isDriveMenuUrl(url: string): boolean {
  return describeMenuUrl(url)?.kind === "drive";
}

function initialMenuSource(url: string): "drive" | "upload" {
  return isDriveMenuUrl(url) ? "drive" : "upload";
}

// Belt-and-suspenders for legacy data: any row that still carries the
// pre-migration split-at-midnight shape (day N ends 23:59 + day N+1
// starts 00:00) gets merged back into a single overnight range on day N
// before we hand it to the editor. Live data was migrated server-side in
// 0021_merge_overnight_hours.sql; this just keeps the business from ever
// seeing the two-row mess if a stray split slips through.
function mergeOvernightSplit(h: VenueHours): VenueHours {
  const longKeys = DAYS.map((d) => d.long);
  const out: VenueHours = {};
  for (const k of longKeys) {
    const arr = h[k];
    if (arr) out[k] = arr.map((r) => ({ open: r.open, close: r.close }));
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < longKeys.length; i += 1) {
      const a = longKeys[i];
      const b = longKeys[(i + 1) % longKeys.length];
      const aRanges = out[a];
      const bRanges = out[b];
      if (
        !aRanges ||
        !bRanges ||
        aRanges.length === 0 ||
        bRanges.length === 0
      ) {
        continue;
      }
      const tailIdx = aRanges.findIndex(
        (r) => r.close === "23:59" && r.open !== "00:00",
      );
      const headIdx = bRanges.findIndex(
        (r) => r.open === "00:00" && r.close !== "23:59",
      );
      if (tailIdx < 0 || headIdx < 0) continue;
      aRanges[tailIdx] = {
        open: aRanges[tailIdx].open,
        close: bRanges[headIdx].close,
      };
      bRanges.splice(headIdx, 1);
      if (bRanges.length === 0) delete out[b];
      changed = true;
    }
  }
  return out;
}

function venueHoursToForm(h: VenueHours | null): Record<DayKey, DayShifts> {
  const merged = h ? mergeOvernightSplit(h) : null;
  const out = {} as Record<DayKey, DayShifts>;
  for (const d of DAYS) {
    const ranges = merged?.[d.long] ?? null;
    if (ranges === null) {
      // No key for the day → treat as unknown (default to a single empty
      // input rather than "Closed" so the business isn't surprised).
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

// "Overnight" = the close time is on the next day. We encode that as
// `close <= open` once both fields are filled, so the business can type
// 22:00 → 02:00 and have it just work. Empty fields don't count as
// overnight — keep the badge off while they're being typed.
const HHMM_RE = /^\d{2}:\d{2}$/;
function isOvernight(open: string, close: string): boolean {
  if (!HHMM_RE.test(open) || !HHMM_RE.test(close)) return false;
  return close <= open;
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

function venueToFormState(venue: MyVenue): FormState {
  return {
    name: venue.name ?? "",
    category:
      resolveVenueCategoryName({
        categoryLabel: venue.category_label,
        category: venue.category,
      }) ?? "",
    description: venue.description ?? "",
    hours: venueHoursToForm(venue.hours),
    menu_links: venue.menu_pdf_url
      ? [{ name: venue.menu_pdf_name ?? "", url: venue.menu_pdf_url }]
      : [{ name: "", url: "" }],
    photos: (venue.photos ?? []).slice(0, MAX_PHOTOS),
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
    youtube_url: venue.youtube_url ?? "",
    threads_url: venue.threads_url ?? "",
    reddit_url: venue.reddit_url ?? "",
    opentable_url: venue.opentable_url ?? "",
    resy_url: venue.resy_url ?? "",
    tripadvisor_url: venue.tripadvisor_url ?? "",
    google_maps_url: venue.google_maps_url ?? "",
    rappi_url: venue.rappi_url ?? "",
    uber_eats_url: venue.uber_eats_url ?? "",
    didi_food_url: venue.didi_food_url ?? "",
  };
}

export function EditVenueForm({ venue }: { venue: MyVenue }) {
  const router = useRouter();
  const supabase = useBrowserSupabase();

  const [v, setV] = useState<FormState>(() => venueToFormState(venue));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [atlasMockRunning, setAtlasMockRunning] = useState(false);
  const [atlasMockNotice, setAtlasMockNotice] = useState<string | null>(null);
  // Dirty when the user has touched any field since the last save (or
  // since Discard reset). Drives whether the SaveBar shows at all —
  // when clean, the form has no save chrome cluttering the page.
  const [isDirty, setIsDirty] = useState(false);
  const [activeTab, setActiveTab] = useState<PlaceTab>("basics");

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setV((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const handleDiscard = () => {
    if (!isDirty) return;
    if (!window.confirm("Discard your unsaved changes?")) return;
    setV(venueToFormState(venue));
    setIsDirty(false);
    setError(null);
    setSaved(false);
  };

  const handleMockAtlasRefresh = () => {
    if (atlasMockRunning) return;
    setAtlasMockNotice(null);
    setAtlasMockRunning(true);
    window.setTimeout(() => {
      setAtlasMockRunning(false);
      setAtlasMockNotice(
        "Mock only: Atlas profile refresh queued. Real function wiring next.",
      );
    }, 950);
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const trimmedName = v.name.trim();
    if (!trimmedName) {
      setError("Name cannot be empty.");
      return;
    }

    const firstMenu = v.menu_links.find((m) => m.url.trim() !== "") ??
      v.menu_links[0] ?? { name: "", url: "" };

    const payload: UpdateVenueInput = {
      id: venue.id,
      name: trimmedName.slice(0, VENUE_NAME_MAX),
      category: nullable(v.category),
      description:
        v.description.trim() === ""
          ? null
          : v.description.trim().slice(0, DESCRIPTION_MAX),
      hours: formHoursToVenue(v.hours),
      menu_pdf_url: nullableUrl(firstMenu.url),
      menu_pdf_name: nullable(firstMenu.name),
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
      youtube_url: nullableUrl(v.youtube_url),
      threads_url: nullableUrl(v.threads_url),
      reddit_url: nullableUrl(v.reddit_url),
      opentable_url: nullableUrl(v.opentable_url),
      resy_url: nullableUrl(v.resy_url),
      tripadvisor_url: nullableUrl(v.tripadvisor_url),
      google_maps_url: nullableUrl(v.google_maps_url),
      rappi_url: nullableUrl(v.rappi_url),
      uber_eats_url: nullableUrl(v.uber_eats_url),
      didi_food_url: nullableUrl(v.didi_food_url),
    };

    startTransition(async () => {
      try {
        await apiUpdateVenue(supabase, payload);
        setSaved(true);
        setIsDirty(false);
        router.refresh();
        window.setTimeout(() => setSaved(false), SAVED_TOAST_MS);
      } catch (err) {
        setError(errMsg(err, "Could not save."));
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <SubTabs
        tabs={PLACE_TABS}
        active={activeTab}
        onChange={setActiveTab}
        equalWidth
      />
      <ProfileCompletionBar v={v} />

      {activeTab === "basics" && (
        <>
          <BasicsSection venue={venue} v={v} set={set} />
          <MenuSection venueId={venue.id} v={v} set={set} onError={setError} />
          <TimeSection venue={venue} v={v} set={set} />
          <LocationSection venue={venue} />
          <DetailsSection venue={venue} v={v} set={set} />
          <div className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4">
            <div>
              <p className="text-sm font-semibold">Need fresh profile data?</p>
              <p className="text-muted-foreground text-xs">
                Re-run Atlas profile enrichment to refresh channels, reviews,
                and metadata.
              </p>
              {atlasMockNotice && (
                <p className="text-secondary mt-1 text-[11px] font-medium">
                  {atlasMockNotice}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleMockAtlasRefresh}
              disabled={atlasMockRunning}
              className="bg-foreground text-background inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-[13px] font-semibold transition hover:opacity-90 disabled:opacity-60"
            >
              {atlasMockRunning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {atlasMockRunning ? "Calling Atlas…" : "Re-update profile"}
            </button>
          </div>
        </>
      )}

      {activeTab === "channels" && <ChannelsSection v={v} set={set} />}

      {activeTab === "media" && (
        <MediaSection
          photos={v.photos}
          onChange={(photos) => set("photos", photos)}
          venueId={venue.id}
          venueName={v.name}
          onError={setError}
        />
      )}

      {activeTab === "reviews" && (
        <>
          <ReviewsSummarySection venue={venue} />
          <RelevantReviewsSection venue={venue} />
        </>
      )}

      {activeTab === "preview" && <PreviewSection venue={venue} v={v} />}

      {error && (
        <p className="bg-destructive/10 text-destructive rounded-xl px-4 py-3 text-sm">
          {error}
        </p>
      )}

      {/* Dirty-state save bar — Vercel / GitHub settings pattern.
          Renders only when the form has unsaved changes (or is in the
          middle of saving / just-saved). Stays out of the way when the
          page is clean. Sticky to the bottom of the scroll viewport so
          it follows the business as they edit further down. */}
      {(isDirty || pending || saved) && (
        <div className="border-border bg-background/95 shadow-elev sticky bottom-3 z-10 mt-2 flex items-center justify-between gap-4 rounded-2xl border px-5 py-3.5 backdrop-blur">
          <p
            className={cn(
              "text-sm font-medium",
              pending
                ? "text-muted-foreground"
                : saved
                  ? "text-secondary"
                  : "text-foreground",
            )}
          >
            {pending
              ? "Saving your changes…"
              : saved
                ? "All changes saved."
                : "You have unsaved changes."}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDiscard}
              disabled={pending || !isDirty}
              className="text-muted-foreground hover:text-foreground inline-flex h-10 items-center rounded-full px-4 text-[13px] font-semibold transition disabled:opacity-40"
            >
              Discard
            </button>
            <button
              type="submit"
              disabled={pending || !isDirty}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-full px-5 text-[13px] font-semibold transition disabled:opacity-60",
                saved
                  ? "bg-secondary text-white"
                  : "bg-foreground text-background hover:opacity-90",
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
                  Save changes
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

// ── Sections ────────────────────────────────────────────────────────────

const PROFILE_INPUT_CLASS =
  "h-10 w-full rounded-xl bg-muted/35 px-3 text-[13px] outline-none transition placeholder:text-muted-foreground/45 focus:bg-muted/55";

const PROFILE_TEXTAREA_CLASS =
  "min-h-[11rem] w-full resize-y overflow-hidden rounded-xl bg-muted/35 px-3 py-3 text-[13px] leading-relaxed outline-none transition placeholder:text-muted-foreground/45 focus:bg-muted/55";

function BasicsSection({
  venue,
  v,
  set,
}: {
  venue: MyVenue;
  v: FormState;
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  const aboutRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = aboutRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.max(176, el.scrollHeight)}px`;
  }, [v.description]);

  return (
    <Section
      title="Profile"
      description="What guests see on your Place page."
      contentClassName="flex flex-col gap-4"
    >
      <ReadOnly
        label="Name"
        value={v.name.trim() || null}
        empty="Synced from your Google listing"
      />

      <ProfileVerificationStatus venue={venue} />

      <ProfileField label="Category">
        <input
          value={v.category}
          onChange={(e) => set("category", e.target.value)}
          placeholder="e.g. cafe, mexican, sushi"
          className={PROFILE_INPUT_CLASS}
        />
      </ProfileField>

      <PriceLevelDisplay level={venue.price_level} />

      <ProfileField
        label="About"
        meta={
          <span className="text-muted-foreground text-[10px] font-medium tabular-nums">
            {v.description.length.toLocaleString()} /{" "}
            {DESCRIPTION_MAX.toLocaleString()}
          </span>
        }
      >
        <textarea
          ref={aboutRef}
          value={v.description}
          onChange={(e) => set("description", e.target.value)}
          maxLength={DESCRIPTION_MAX}
          placeholder={DESCRIPTION_PLACEHOLDER}
          rows={6}
          className={PROFILE_TEXTAREA_CLASS}
        />
      </ProfileField>
    </Section>
  );
}

function ProfileVerificationStatus({ venue }: { venue: MyVenue }) {
  const status = resolveVerificationPresentation(venue);

  return (
    <div>
      <span className="text-[12px] font-medium text-foreground/85">
        Verification
      </span>
      <div
        className={cn(
          "mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5",
          status.surface,
        )}
      >
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
            status.iconTone,
          )}
        >
          {status.icon}
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold tracking-tight">
            {status.label}
          </p>
          <p className="text-muted-foreground text-[11px] leading-snug">
            {status.detail}
          </p>
        </div>
      </div>
    </div>
  );
}

function resolveVerificationPresentation(venue: MyVenue): {
  label: string;
  detail: string;
  icon: React.ReactNode;
  surface: string;
  iconTone: string;
} {
  if (venue.listing_type === "partner") {
    return {
      label: "Verified partner",
      detail: "Ownership confirmed — guests see you as a Mesita partner.",
      icon: <BadgeCheck className="h-4 w-4" />,
      surface: "bg-emerald-500/8 border border-emerald-500/15",
      iconTone: "bg-emerald-500/15 text-emerald-600",
    };
  }

  if (
    venue.status === "pending_verification" ||
    venue.status === "pending_review"
  ) {
    return {
      label: "Verification pending",
      detail: "Your ownership claim is in review.",
      icon: <Clock className="h-4 w-4" />,
      surface: "bg-amber-500/8 border border-amber-500/15",
      iconTone: "bg-amber-500/15 text-amber-700",
    };
  }

  if (venue.listing_type === "web") {
    return {
      label: "Not verified",
      detail: "Listed on Mesita from the web — verify ownership to unlock partner perks.",
      icon: <ShieldAlert className="h-4 w-4" />,
      surface: "bg-muted/35 border border-border/60",
      iconTone: "bg-foreground/8 text-muted-foreground",
    };
  }

  return {
    label: humanizeToken(venue.status) ?? "Unverified",
    detail: humanizeToken(venue.listing_type) ?? "Claim this place to verify.",
    icon: <ShieldAlert className="h-4 w-4" />,
    surface: "bg-muted/35 border border-border/60",
    iconTone: "bg-foreground/8 text-muted-foreground",
  };
}

function ProfileField({
  label,
  meta,
  children,
}: {
  label: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[12px] font-medium text-foreground/85">
          {label}
        </span>
        {meta}
      </div>
      {children}
    </div>
  );
}

function PriceLevelDisplay({ level }: { level: number | null }) {
  const normalizedLevel =
    level == null ? null : Math.max(1, Math.min(PRICE_LEVEL_MAX, level));
  const isEmpty = normalizedLevel == null;

  return (
    <ProfileField
      label="Price level"
      meta={
        !isEmpty ? (
          <span className="text-muted-foreground text-[10px] font-medium">
            {PRICE_TIER_LABEL[normalizedLevel]}
          </span>
        ) : null
      }
    >
      <div
        className="flex items-center gap-2"
        aria-label={
          isEmpty
            ? "Price level not available"
            : `Price level ${normalizedLevel} of ${PRICE_LEVEL_MAX}`
        }
      >
        {Array.from({ length: PRICE_LEVEL_MAX }, (_, idx) => {
          const segment = idx + 1;
          const active = normalizedLevel != null && segment <= normalizedLevel;
          return (
            <span
              key={segment}
              className={cn(
                "font-display flex h-9 flex-1 items-center justify-center rounded-lg text-[13px] font-semibold tabular-nums transition",
                active
                  ? "bg-pink-gradient text-white"
                  : "bg-muted/35 text-muted-foreground/45",
              )}
            >
              {"$".repeat(segment)}
            </span>
          );
        })}
      </div>
      {isEmpty ? (
        <p className="text-muted-foreground mt-2 text-[10px]">
          Not on Google yet
        </p>
      ) : null}
    </ProfileField>
  );
}

function LocationSection({ venue }: { venue: MyVenue }) {
  // Address + map preview + a real "Open in Google Maps" button
  // (overlay on the map when coordinates exist; standalone otherwise).
  // The raw Google Maps URL used to render as a readonly card with the
  // full cid=... query string visible — ugly on the page and unhelpful
  // to the business. The button replaces that affordance.
  const hasCoords = venue.lat != null && venue.lng != null;
  return (
    <Section title="Location">
      <ReadOnly
        label="Address"
        value={venue.address}
        icon={<MapPin className="h-4 w-4" />}
      />
      {hasCoords ? (
        <VenueMapEmbed
          lat={venue.lat as number}
          lng={venue.lng as number}
          name={venue.name}
          mapsUrl={venue.google_maps_url}
        />
      ) : venue.google_maps_url ? (
        <OpenInGoogleMaps href={venue.google_maps_url} variant="block" />
      ) : null}
    </Section>
  );
}

function VenueMapEmbed({
  lat,
  lng,
  name,
  mapsUrl,
}: {
  lat: number;
  lng: number;
  name: string | null;
  mapsUrl: string | null;
}) {
  // The `output=embed` form on maps.google.com renders a full Google
  // Maps iframe without an API key. It's not on the official Embed API
  // surface (which would require NEXT_PUBLIC_GMP_EMBED_KEY +
  // billing setup), but it's been stable for years and is the standard
  // approach for "show a map preview, no auth." Swap to the keyed
  // /maps/embed/v1/place endpoint once we wire up the env var.
  const src = `https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`;
  return (
    // Use a real height (not min-height) so the iframe can resolve `h-full`
    // and fully occupy the map box without leaving a blank area below.
    <div className="border-border bg-card relative h-[320px] overflow-hidden rounded-xl border">
      <iframe
        src={src}
        title={`Map of ${name ?? "this venue"}`}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="block h-full w-full border-0"
      />
      {mapsUrl && <OpenInGoogleMaps href={mapsUrl} variant="overlay" />}
    </div>
  );
}

function OpenInGoogleMaps({
  href,
  variant,
}: {
  href: string;
  /** `overlay` floats top-right on the embed; `block` is a standalone
   *  pill button used when no embed is rendered. */
  variant: "overlay" | "block";
}) {
  const base =
    "inline-flex items-center gap-1.5 rounded-full font-semibold transition";
  const skin =
    variant === "overlay"
      ? "bg-foreground/90 text-background hover:bg-foreground absolute top-3 right-3 z-10 h-9 px-3.5 text-[12px] shadow-md backdrop-blur"
      : "bg-foreground text-background hover:opacity-90 self-start h-10 px-4 text-[13px]";
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Open in Google Maps"
      className={cn(base, skin)}
    >
      <ExternalLink className="h-3.5 w-3.5" />
      Open in Google Maps
    </a>
  );
}

function PreviewSection({ venue, v }: { venue: MyVenue; v: FormState }) {
  return (
    <Section title="Preview" className="h-full">
      <div className="flex justify-center py-1">
        <PreviewSwipeCard venue={venue} v={v} />
      </div>
    </Section>
  );
}

function ProfileCompletionBar({ v }: { v: FormState }) {
  const checks = profileCompletionChecks(v);
  const completed = checks.filter((check) => check.done).length;
  const total = checks.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const pending = checks.filter((check) => !check.done);
  const isComplete = pending.length === 0;

  return (
    <div
      className="border-border/80 bg-card rounded-2xl border px-4 py-3.5"
      role="status"
      aria-label={`Profile ${pct}% complete, ${completed} of ${total} fields filled`}
    >
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold tracking-tight">
            Profile completeness
          </p>
          <p className="text-muted-foreground mt-0.5 text-[11px]">
            {completed} of {total} fields filled
          </p>
        </div>
        <p className="font-display shrink-0 text-[1.75rem] leading-none font-semibold tracking-tight tabular-nums">
          {pct}
          <span className="text-muted-foreground text-sm font-medium">%</span>
        </p>
      </div>

      <div className="bg-muted mt-3 h-1 overflow-hidden rounded-full">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500 ease-out",
            isComplete ? "bg-emerald-500" : "bg-pink-gradient",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      {isComplete ? (
        <p className="text-emerald-700 mt-3 inline-flex items-center gap-1.5 text-[11px] font-medium">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          Profile looks complete
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
            Still needed
          </span>
          {pending.slice(0, 4).map((item) => (
            <span
              key={item.label}
              className="border-border/70 text-foreground/80 bg-background rounded-full border px-2 py-0.5 text-[10px] font-medium"
            >
              {item.label}
            </span>
          ))}
          {pending.length > 4 ? (
            <span className="text-muted-foreground text-[10px] font-medium">
              +{pending.length - 4} more
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}

function PreviewSwipeCard({ venue, v }: { venue: MyVenue; v: FormState }) {
  // Consumer-like swipe fields overlay, but framed in a neutral white box.
  const photos = v.photos.slice(0, MAX_PHOTOS);
  const [photoIdx, setPhotoIdx] = useState(0);
  // Clamp during render rather than in an effect: when photos shrink below
  // the current index, fall back to the first photo without a cascading
  // setState-in-effect.
  const safeIdx = photoIdx > photos.length - 1 ? 0 : photoIdx;
  const cover = photos[safeIdx] ?? null;
  const meta = previewMeta(venue, v);
  const canSlide = photos.length > 1;

  const prevPhoto = () =>
    setPhotoIdx(safeIdx === 0 ? photos.length - 1 : safeIdx - 1);
  const nextPhoto = () =>
    setPhotoIdx(safeIdx === photos.length - 1 ? 0 : safeIdx + 1);
  return (
    <div className="bg-card mx-auto w-full max-w-[360px] overflow-hidden rounded-3xl border shadow-sm lg:max-w-[460px]">
      <div className="bg-muted relative aspect-[4/5] w-full">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={meta.name}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="bg-pink-gradient absolute inset-0 flex items-center justify-center text-white/70">
            <span className="font-display text-7xl font-bold tracking-tight">
              {meta.name.trim().slice(0, 1).toUpperCase() || "·"}
            </span>
          </div>
        )}

        {canSlide && (
          <div className="absolute inset-x-0 top-3 z-20 flex items-center justify-between px-3">
            <button
              type="button"
              onClick={prevPhoto}
              aria-label="Previous preview photo"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/65"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </button>
            <span className="rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
              {safeIdx + 1} / {photos.length}
            </span>
            <button
              type="button"
              onClick={nextPhoto}
              aria-label="Next preview photo"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/65"
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/86 via-black/58 to-transparent p-4 pt-20 text-white">
          <h2 className="font-display text-2xl leading-tight font-semibold tracking-tight">
            {meta.name}
          </h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {meta.category && (
              <PreviewMetaChip>{meta.category}</PreviewMetaChip>
            )}
            {meta.price && <PreviewMetaChip>{meta.price}</PreviewMetaChip>}
            {meta.googleRating && (
              <PreviewMetaChip>
                {meta.googleRating}
                <Star
                  className="h-3 w-3 fill-amber-400 text-amber-400"
                  strokeWidth={0}
                />
                {meta.googleCount && (
                  <span className="text-white/75">({meta.googleCount})</span>
                )}
              </PreviewMetaChip>
            )}
            {meta.instagramFollowers && (
              <PreviewMetaChip>
                <Instagram className="h-3 w-3 text-pink-200/80" />
                {meta.instagramFollowers}
              </PreviewMetaChip>
            )}
            <PreviewMetaChip>
              <MapPin className="h-3 w-3 text-white/75" />
              {meta.zone}
            </PreviewMetaChip>
            {meta.distance && (
              <PreviewMetaChip>
                <Navigation className="h-3 w-3 text-white/75" />
                {meta.distance}
              </PreviewMetaChip>
            )}
            {meta.status && (
              <PreviewMetaChip>
                <Clock className="h-3 w-3 text-emerald-300" />
                {meta.status}
              </PreviewMetaChip>
            )}
            <PreviewMetaChip>
              {meta.isPartner ? (
                <>
                  <BadgeCheck className="h-3.5 w-3.5 fill-sky-500 text-white" />
                  Verified Partner
                </>
              ) : (
                <>
                  <ShieldAlert className="h-3.5 w-3.5 text-amber-300" />
                  Not Verified
                </>
              )}
            </PreviewMetaChip>
            <PreviewMetaChip>{meta.promoLabel}</PreviewMetaChip>
          </div>
        </div>

        {canSlide && (
          <div className="absolute inset-x-0 top-12 z-20 flex justify-center gap-1">
            {photos.map((_, idx) => (
              <button
                key={`preview-dot-${idx}`}
                type="button"
                onClick={() => setPhotoIdx(idx)}
                aria-label={`Go to preview photo ${idx + 1}`}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  idx === safeIdx
                    ? "w-5 bg-white"
                    : "w-1.5 bg-white/55 hover:bg-white/75",
                )}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewMetaChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/35 bg-black/45 px-2.5 py-1 text-[11.5px] whitespace-nowrap text-white tabular-nums [font-variant-numeric:tabular-nums_lining-nums] backdrop-blur-md">
      {children}
    </span>
  );
}

function previewMeta(venue: MyVenue, v: FormState) {
  const name = v.name || venue.name || "Venue name";
  const category =
    v.category ||
    resolveVenueCategoryName({
      categoryLabel: venue.category_label,
      category: venue.category,
    }) ||
    null;
  const price =
    venue.price_level != null ? "$".repeat(venue.price_level) : null;
  const googleRating =
    venue.google_stars_overall != null
      ? venue.google_stars_overall.toFixed(1)
      : null;
  const googleCount =
    venue.google_review_count != null
      ? formatCount(venue.google_review_count)
      : null;
  const instagramFollowers =
    venue.instagram_followers_count != null
      ? formatCount(venue.instagram_followers_count)
      : null;
  const zone = venue.address
    ? shortLocationFromAddress(venue.address)
    : "Neighborhood";
  const distance = null; // business payload doesn't include distance yet.
  const status = venue.closes_at ? `Open · until ${venue.closes_at}` : null;
  // In business console previews, venues are always shown as verified.
  const isPartner = true;
  const rewardRate = resolvePreviewRewardRate(venue);
  const rewardMechanic =
    venue.fiscal_type === "informal" ? "Discount" : "Reward";
  const promoLabel =
    rewardRate != null
      ? `Reward · ${rewardRate}% ${rewardMechanic}`
      : "No reward yet";

  return {
    name,
    category,
    price,
    googleRating,
    googleCount,
    instagramFollowers,
    zone,
    distance,
    status,
    isPartner,
    promoLabel,
  };
}

function resolvePreviewRewardRate(venue: MyVenue): number | null {
  const rates = [
    venue.welcome_free_rate,
    venue.welcome_premium_rate,
    venue.free_rate,
    venue.premium_rate,
  ].filter((rate): rate is number => typeof rate === "number" && rate > 0);
  if (rates.length === 0) return null;
  return Math.max(...rates);
}

function profileCompletionChecks(
  v: FormState,
): Array<{ label: string; done: boolean }> {
  const hasAnyPhoto = v.photos.length > 0;
  const hasAnyTag = v.tags.length > 0;
  const hasHours = DAYS.some(({ key }) =>
    v.hours[key].ranges.some(
      (range) => range.open.trim() && range.close.trim(),
    ),
  );

  const checks: Array<{ label: string; done: boolean }> = [
    { label: "Name", done: v.name.trim() !== "" },
    { label: "Category", done: v.category.trim() !== "" },
    { label: "About", done: v.description.trim() !== "" },
    { label: "Tags", done: hasAnyTag },
    { label: "Photos", done: hasAnyPhoto },
    { label: "Hours", done: hasHours },
    {
      label: "Product link",
      done: v.menu_links.some((m) => m.url.trim() !== ""),
    },
    { label: "Website", done: v.website_url.trim() !== "" },
    { label: "Phone", done: v.phone.trim() !== "" },
    { label: "WhatsApp", done: v.whatsapp_url.trim() !== "" },
    { label: "Instagram", done: v.instagram_url.trim() !== "" },
    { label: "Email", done: v.email.trim() !== "" },
    { label: "Google Maps", done: v.google_maps_url.trim() !== "" },
  ];

  return checks;
}

function shortLocationFromAddress(address: string): string {
  const parts = address
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 2];
  return parts[0] ?? "Neighborhood";
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
    <Section
      title="Hours"
      description={
        venue.timezone
          ? `${venue.timezone} · one shift per day`
          : "One shift per day"
      }
    >
      <HoursEditor hours={v.hours} onChange={(hours) => set("hours", hours)} />
    </Section>
  );
}

function MediaSection({
  photos,
  onChange,
  venueId,
  venueName,
  onError,
}: {
  photos: string[];
  onChange: (next: string[]) => void;
  venueId: string;
  venueName: string;
  onError: (msg: string | null) => void;
}) {
  const supabase = useBrowserSupabase();
  const [uploading, setUploading] = useState(false);
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
  const onFilesPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0 || uploading) return;
    if (photos.length >= MAX_PHOTOS) {
      onError(`At most ${MAX_PHOTOS} photos.`);
      return;
    }
    const slots = Math.max(0, MAX_PHOTOS - photos.length);
    const nextBatch = files.slice(0, slots);
    if (nextBatch.length === 0) {
      onError(`At most ${MAX_PHOTOS} photos.`);
      return;
    }
    for (const file of nextBatch) {
      const fileError = validateUploadFile(file);
      if (fileError) {
        onError(`${file.name}: ${fileError}`);
        return;
      }
    }
    setUploading(true);
    onError(null);
    try {
      const uploadedUrls: string[] = [];
      for (const file of nextBatch) {
        const ext = extForFile(file);
        const path = `business/${venueId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("venue-images")
          .upload(path, file, {
            upsert: false,
            contentType: file.type,
            cacheControl: "31536000",
          });
        if (uploadError) {
          throw new Error(
            `Couldn't upload ${file.name}: ${uploadError.message}`,
          );
        }
        const { data } = supabase.storage
          .from("venue-images")
          .getPublicUrl(path);
        if (data?.publicUrl) uploadedUrls.push(data.publicUrl);
      }
      if (uploadedUrls.length > 0) {
        onChange([...photos, ...uploadedUrls].slice(0, MAX_PHOTOS));
      }
      if (files.length > slots) {
        onError(
          `Uploaded ${uploadedUrls.length} image(s). Max is ${MAX_PHOTOS} total.`,
        );
      } else {
        onError(null);
      }
    } catch (err) {
      onError(errMsg(err, "Couldn't upload images right now."));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Section
      title="Media"
      description={`Upload images directly. Accepted: JPG, PNG, WEBP, AVIF. Max ${formatBytes(MAX_UPLOAD_BYTES)} each.`}
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
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          id={`venue-image-upload-${venueId}`}
          type="file"
          accept={ALLOWED_IMAGE_ACCEPT}
          multiple
          onChange={onFilesPicked}
          disabled={uploading || photos.length >= MAX_PHOTOS}
          className="hidden"
        />
        <label
          htmlFor={`venue-image-upload-${venueId}`}
          className={cn(
            "border-border bg-card hover:bg-muted inline-flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition",
            (uploading || photos.length >= MAX_PHOTOS) &&
              "pointer-events-none cursor-not-allowed opacity-55",
          )}
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <ImagePlus className="h-4 w-4" />
              Upload images
            </>
          )}
        </label>
        <p className="text-muted-foreground text-xs">
          Post links removed. Upload files directly from your device.
        </p>
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
  // zoom this is all the affordance the business needs.
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

function MenuSection({
  venueId,
  v,
  set,
  onError,
}: {
  venueId: string;
  v: FormState;
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  onError: (msg: string | null) => void;
}) {
  const supabase = useBrowserSupabase();
  const link = v.menu_links[0] ?? { name: "", url: "" };
  const [source, setSource] = useState<"drive" | "upload">(() =>
    initialMenuSource(link.url),
  );
  const [uploading, setUploading] = useState(false);

  const setLink = (patch: Partial<MenuEntry>) => {
    set("menu_links", [{ ...link, ...patch }]);
  };

  const driveMeta =
    source === "drive" ? describeMenuUrl(link.url) : null;
  const hasUploadedFile =
    source === "upload" && link.url.trim() !== "" && !isDriveMenuUrl(link.url);

  const onFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || uploading) return;

    const fileError = validateMenuUploadFile(file);
    if (fileError) {
      onError(fileError);
      return;
    }

    setUploading(true);
    onError(null);
    try {
      const ext = extForMenuFile(file);
      const path = `business/${venueId}/catalog/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("venue-images")
        .upload(path, file, {
          upsert: false,
          contentType: file.type,
          cacheControl: "31536000",
        });
      if (uploadError) {
        throw new Error(uploadError.message);
      }
      const { data } = supabase.storage.from("venue-images").getPublicUrl(path);
      if (!data?.publicUrl) {
        throw new Error("Couldn't get a public URL for the upload.");
      }
      const baseName = file.name.replace(/\.[^.]+$/, "").trim();
      setLink({
        url: data.publicUrl,
        name: link.name.trim() || baseName.slice(0, 80),
      });
      onError(null);
    } catch (err) {
      onError(errMsg(err, "Couldn't upload catalog file."));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Section
      title="Products"
      description="One catalog for guests — link from Google Drive or upload a file."
    >
      <div className="flex flex-col gap-3">
        <div
          role="tablist"
          aria-label="Catalog source"
          className="bg-muted/40 flex gap-1 rounded-full p-1"
        >
          {(
            [
              { id: "drive" as const, label: "Google Drive", Icon: Cloud },
              { id: "upload" as const, label: "Direct upload", Icon: Upload },
            ] as const
          ).map(({ id, label, Icon }) => {
            const active = source === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSource(id)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-[12px] font-semibold transition",
                  active
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {label}
              </button>
            );
          })}
        </div>

        <Field label="Product name">
          <input
            type="text"
            value={link.name}
            onChange={(e) => setLink({ name: e.target.value.slice(0, 80) })}
            placeholder="Dinner menu"
            className={INPUT}
          />
        </Field>

        {source === "drive" ? (
          <Field label="Google Drive link">
            <UrlInput
              icon={<Cloud className="h-4 w-4" />}
              value={link.url}
              onChange={(val) => setLink({ url: val })}
              placeholder="https://drive.google.com/..."
            />
            <p className="text-muted-foreground mt-1.5 text-[11px]">
              Use a public share link so guests can open the catalog.
            </p>
          </Field>
        ) : (
          <div className="flex flex-col gap-2">
            {hasUploadedFile ? (
              <div className="border-border bg-muted/30 flex items-center gap-2 rounded-xl border px-3 py-2.5">
                <FileText className="text-muted-foreground h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">Catalog uploaded</p>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground truncate text-[11px] hover:underline"
                  >
                    {link.url}
                  </a>
                </div>
                <button
                  type="button"
                  onClick={() => setLink({ url: "" })}
                  className="text-muted-foreground hover:text-destructive shrink-0 text-[11px] font-semibold"
                >
                  Remove
                </button>
              </div>
            ) : (
              <p className="text-muted-foreground text-[11px]">
                PDF or image, up to {formatBytes(MAX_UPLOAD_BYTES)}.
              </p>
            )}
            <input
              id={`menu-upload-${venueId}`}
              type="file"
              accept={ALLOWED_MENU_ACCEPT}
              onChange={onFilePicked}
              disabled={uploading}
              className="hidden"
            />
            <label
              htmlFor={`menu-upload-${venueId}`}
              className={cn(
                "border-border bg-card hover:bg-muted inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-full border px-4 text-[12px] font-semibold transition",
                uploading && "pointer-events-none opacity-60",
              )}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  {hasUploadedFile ? "Replace file" : "Upload catalog"}
                </>
              )}
            </label>
          </div>
        )}

        {driveMeta ? (
          driveMeta.valid ? (
            <p className="text-secondary flex items-start gap-1.5 text-[11px] font-medium">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {driveMeta.note}
            </p>
          ) : (
            <p className="text-destructive flex items-start gap-1.5 text-[11px] font-medium">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Paste a full public Google Drive URL.
            </p>
          )
        ) : null}
      </div>
    </Section>
  );
}

function DetailsSection({
  venue,
  v,
  set,
}: {
  venue: MyVenue;
  v: FormState;
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  const details = [
    ["Listing type", humanizeToken(venue.listing_type)],
    ["Status", humanizeToken(venue.status)],
    ["Plan", humanizeToken(venue.plan)],
    ["Fiscal type", humanizeToken(venue.fiscal_type)],
    ["Currency", venue.currency],
    ["Updated at", venue.updated_at ? formatDateTime(venue.updated_at) : null],
  ] as const;

  return (
    <Section
      title="Details"
      right={<span className={TINY_LABEL_CLASS}>Read-only</span>}
    >
      <Field label="Tags">
        <TagsEditor tags={v.tags} onChange={(tags) => set("tags", tags)} />
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {details.map(([label, value]) => (
          <ReadOnly
            key={label}
            label={label}
            value={value}
            empty="Not available yet."
          />
        ))}
      </div>
    </Section>
  );
}

function ChannelsSection({
  v,
  set,
}: {
  v: FormState;
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  type SecondaryChannelKey =
    | "facebook_url"
    | "tiktok_url"
    | "youtube_url"
    | "opentable_url"
    | "rappi_url"
    | "uber_eats_url"
    | "didi_food_url";

  const [secondaryNotAvailable, setSecondaryNotAvailable] = useState<
    Record<SecondaryChannelKey, boolean>
  >({
    facebook_url: false,
    tiktok_url: false,
    youtube_url: false,
    opentable_url: false,
    rappi_url: false,
    uber_eats_url: false,
    didi_food_url: false,
  });

  const setSecondaryMissing = (key: SecondaryChannelKey, missing: boolean) =>
    setSecondaryNotAvailable((prev) => ({ ...prev, [key]: missing }));

  const primaryFields = [
    v.website_url,
    v.phone,
    v.whatsapp_url,
    v.instagram_url,
    v.google_maps_url,
    v.email,
  ];
  const secondaryFields = [
    v.facebook_url,
    v.tiktok_url,
    v.youtube_url,
    v.opentable_url,
    v.rappi_url,
    v.uber_eats_url,
    v.didi_food_url,
  ];
  const primaryCompleted = primaryFields.filter((f) => f.trim() !== "").length;
  const secondaryCompletionMap: Record<SecondaryChannelKey, boolean> = {
    facebook_url:
      v.facebook_url.trim() !== "" || secondaryNotAvailable.facebook_url,
    tiktok_url: v.tiktok_url.trim() !== "" || secondaryNotAvailable.tiktok_url,
    youtube_url:
      v.youtube_url.trim() !== "" || secondaryNotAvailable.youtube_url,
    opentable_url:
      v.opentable_url.trim() !== "" || secondaryNotAvailable.opentable_url,
    rappi_url: v.rappi_url.trim() !== "" || secondaryNotAvailable.rappi_url,
    uber_eats_url:
      v.uber_eats_url.trim() !== "" || secondaryNotAvailable.uber_eats_url,
    didi_food_url:
      v.didi_food_url.trim() !== "" || secondaryNotAvailable.didi_food_url,
  };
  const secondaryCompleted = Object.values(secondaryCompletionMap).filter(
    Boolean,
  ).length;
  const filled = primaryCompleted + secondaryCompleted;
  const totalFields = primaryFields.length + secondaryFields.length;
  const completed = (value: string) => value.trim() !== "";

  return (
    <Section
      title="Channels"
      description="Where guests find and reach you."
      right={
        <span className={TINY_LABEL_CLASS}>
          {filled} / {totalFields}
        </span>
      }
    >
      <div className="flex flex-col gap-5">
        <ChannelGroup title="Primary channels">
          <ChannelField
            label="Website"
            icon={<Globe className="h-4 w-4" />}
            placeholder="https://yourplace.com"
            value={v.website_url}
            onChange={(val) => set("website_url", val)}
            completed={completed(v.website_url)}
          />
          <ChannelField
            label="Phone"
            icon={<PhoneIcon className="h-4 w-4" />}
            placeholder="+52 444 833 5050"
            value={v.phone}
            onChange={(val) => set("phone", val)}
            completed={completed(v.phone)}
          />
          <ChannelField
            label="WhatsApp"
            icon={<MessageCircle className="h-4 w-4" />}
            placeholder="https://wa.me/52…"
            value={v.whatsapp_url}
            onChange={(val) => set("whatsapp_url", val)}
            completed={completed(v.whatsapp_url)}
          />
          <ChannelField
            label="Instagram"
            icon={<Instagram className="h-4 w-4" />}
            placeholder="https://instagram.com/yourplace"
            value={v.instagram_url}
            onChange={(val) => set("instagram_url", val)}
            completed={completed(v.instagram_url)}
          />
          <ChannelField
            label="Google Maps"
            icon={<MapPin className="h-4 w-4" />}
            placeholder="https://maps.google.com/..."
            value={v.google_maps_url}
            onChange={(val) => set("google_maps_url", val)}
            completed={completed(v.google_maps_url)}
          />
          <ChannelField
            label="Email"
            icon={<Mail className="h-4 w-4" />}
            placeholder="hola@yourplace.com"
            value={v.email}
            onChange={(val) => set("email", val)}
            completed={completed(v.email)}
          />
        </ChannelGroup>

        <ChannelGroup title="Secondary channels">
          <ChannelField
            label="Facebook"
            icon={<Facebook className="h-4 w-4" />}
            placeholder="https://facebook.com/yourplace"
            value={v.facebook_url}
            onChange={(val) => {
              set("facebook_url", val);
              if (val.trim()) setSecondaryMissing("facebook_url", false);
            }}
            completed={secondaryCompletionMap.facebook_url}
            missing={secondaryNotAvailable.facebook_url}
            onToggleMissing={(missing) =>
              setSecondaryMissing("facebook_url", missing)
            }
          />
          <ChannelField
            label="TikTok"
            icon={<Music2 className="h-4 w-4" />}
            placeholder="https://tiktok.com/@yourplace"
            value={v.tiktok_url}
            onChange={(val) => {
              set("tiktok_url", val);
              if (val.trim()) setSecondaryMissing("tiktok_url", false);
            }}
            completed={secondaryCompletionMap.tiktok_url}
            missing={secondaryNotAvailable.tiktok_url}
            onToggleMissing={(missing) =>
              setSecondaryMissing("tiktok_url", missing)
            }
          />
          <ChannelField
            label="YouTube"
            icon={<Globe className="h-4 w-4" />}
            placeholder="https://youtube.com/@yourplace"
            value={v.youtube_url}
            onChange={(val) => {
              set("youtube_url", val);
              if (val.trim()) setSecondaryMissing("youtube_url", false);
            }}
            completed={secondaryCompletionMap.youtube_url}
            missing={secondaryNotAvailable.youtube_url}
            onToggleMissing={(missing) =>
              setSecondaryMissing("youtube_url", missing)
            }
          />
          <ChannelField
            label="OpenTable"
            icon={<UtensilsCrossed className="h-4 w-4" />}
            placeholder="https://www.opentable.com/..."
            value={v.opentable_url}
            onChange={(val) => {
              set("opentable_url", val);
              if (val.trim()) setSecondaryMissing("opentable_url", false);
            }}
            completed={secondaryCompletionMap.opentable_url}
            missing={secondaryNotAvailable.opentable_url}
            onToggleMissing={(missing) =>
              setSecondaryMissing("opentable_url", missing)
            }
          />
          <ChannelField
            label="Rappi"
            icon={<ShoppingBag className="h-4 w-4" />}
            placeholder="https://www.rappi.com/restaurants/..."
            value={v.rappi_url}
            onChange={(val) => {
              set("rappi_url", val);
              if (val.trim()) setSecondaryMissing("rappi_url", false);
            }}
            completed={secondaryCompletionMap.rappi_url}
            missing={secondaryNotAvailable.rappi_url}
            onToggleMissing={(missing) =>
              setSecondaryMissing("rappi_url", missing)
            }
          />
          <ChannelField
            label="Uber Eats"
            icon={<UtensilsCrossed className="h-4 w-4" />}
            placeholder="https://www.ubereats.com/store/..."
            value={v.uber_eats_url}
            onChange={(val) => {
              set("uber_eats_url", val);
              if (val.trim()) setSecondaryMissing("uber_eats_url", false);
            }}
            completed={secondaryCompletionMap.uber_eats_url}
            missing={secondaryNotAvailable.uber_eats_url}
            onToggleMissing={(missing) =>
              setSecondaryMissing("uber_eats_url", missing)
            }
          />
          <ChannelField
            label="DiDi Food"
            icon={<ShoppingBag className="h-4 w-4" />}
            placeholder="https://www.didiglobal.com/..."
            value={v.didi_food_url}
            onChange={(val) => {
              set("didi_food_url", val);
              if (val.trim()) setSecondaryMissing("didi_food_url", false);
            }}
            completed={secondaryCompletionMap.didi_food_url}
            missing={secondaryNotAvailable.didi_food_url}
            onToggleMissing={(missing) =>
              setSecondaryMissing("didi_food_url", missing)
            }
          />
        </ChannelGroup>
      </div>
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

function ReviewsSummarySection({ venue }: { venue: MyVenue }) {
  const externalMetrics: {
    label: string;
    value: string | null;
    meta: string;
    icon: "star" | "users";
    logo: React.ReactNode;
  }[] = [
    {
      label: "Google",
      value:
        venue.google_stars_overall == null
          ? null
          : venue.google_stars_overall.toFixed(1),
      meta:
        venue.google_review_count == null
          ? "reviews"
          : `${formatCount(venue.google_review_count)} reviews`,
      icon: "star",
      logo: <GoogleLogo size={12} />,
    },
    {
      label: "Instagram",
      value:
        venue.instagram_followers_count == null
          ? null
          : formatCount(venue.instagram_followers_count),
      meta: "followers",
      icon: "users",
      logo: <InstagramLogo size={12} />,
    },
    {
      label: "Facebook",
      value: null,
      meta: "followers",
      icon: "users",
      logo: <Facebook className="h-3.5 w-3.5 text-[#1877F2]" />,
    },
  ];

  // Consumer behavior: Mesita defaults to 5.0 for unrated venues.
  const overallMesita = venue.mesita_stars_overall ?? 5;
  const overallCount = venue.mesita_review_count ?? 0;
  const bars = [
    ["Overall", overallMesita],
    ["Food", venue.mesita_stars_food ?? 5],
    ["Service", venue.mesita_stars_service ?? 5],
    ["Ambience", venue.mesita_stars_ambience ?? 5],
    ["Value", overallMesita],
  ] as const;

  return (
    <Section
      title="Reviews summary"
      right={<span className={TINY_LABEL_CLASS}>Read-only</span>}
    >
      <div className="bg-background border-border flex flex-col gap-4 rounded-xl border p-4">
        <div className="flex items-center gap-2">
          <BadgeCheck className="h-4 w-4 text-pink-500" />
          <p className="text-sm font-semibold">Mesita</p>
          <span className="text-muted-foreground ml-auto text-[11px]">
            {overallCount} reviews
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-2xl bg-pink-500/10 ring-1 ring-pink-500/30">
            <div className="flex items-baseline gap-1">
              <span className="font-display text-2xl leading-none font-semibold">
                {overallMesita.toFixed(1)}
              </span>
              <Star
                className="h-3 w-3 fill-amber-400 text-amber-400"
                strokeWidth={0}
              />
            </div>
            <span className="text-muted-foreground text-[9px] font-bold tracking-wider uppercase">
              Overall
            </span>
          </div>
          <div className="flex flex-1 flex-col gap-2">
            {bars.map(([label, value]) => (
              <RatingBar key={label} label={label} value={value} />
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {externalMetrics.map((m) => (
          <ExternalMetricCard
            key={m.label}
            logo={m.logo}
            icon={m.icon}
            value={m.value}
            meta={m.meta}
            label={m.label}
          />
        ))}
      </div>
    </Section>
  );
}

function RelevantReviewsSection({ venue }: { venue: MyVenue }) {
  const items = extractRelevantReviews(venue);
  return (
    <Section
      title="Relevant reviews"
      right={<span className={TINY_LABEL_CLASS}>{items.length} shown</span>}
    >
      {items.length === 0 ? (
        <p className="bg-muted text-muted-foreground rounded-xl px-3 py-3 text-xs">
          No review snippets available yet for this venue.
        </p>
      ) : (
        <div className="scrollbar-hide -mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1">
          {items.map((item) => (
            <article
              key={item.id}
              className="bg-background border-border w-[280px] shrink-0 snap-start rounded-xl border p-3 sm:w-[320px]"
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{item.author}</p>
                <ReviewSourceBadge source={item.source} />
              </div>
              <div className="mb-2 flex items-center gap-0.5">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      "h-3.5 w-3.5",
                      i < item.rating
                        ? "fill-amber-400 text-amber-400"
                        : "text-muted-foreground/35",
                    )}
                    strokeWidth={0}
                  />
                ))}
              </div>
              <div className="bg-muted/20 mt-2 max-h-44 min-h-36 scrollbar-thin overflow-y-auto rounded-lg p-2.5">
                <p className="text-muted-foreground text-[13px] leading-snug">
                  &ldquo;{item.text}&rdquo;
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    </Section>
  );
}

function ReviewSourceBadge({ source }: { source: "Mesita" | "Google" }) {
  const isGoogle = source === "Google";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
        isGoogle
          ? "bg-blue-500/10 text-blue-700"
          : "bg-pink-500/10 text-pink-700",
      )}
    >
      {isGoogle ? <GoogleLogo size={10} /> : <Sparkles className="h-3 w-3" />}
      {isGoogle ? "From Google" : "From Mesita"}
    </span>
  );
}

function RatingBar({ label, value }: { label: string; value: number }) {
  const pct = Math.min(100, (value / 5) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground w-14 shrink-0 truncate text-[11px]">
        {label}
      </span>
      <div className="bg-muted relative h-1.5 flex-1 overflow-hidden rounded-full">
        <div
          className="bg-pink-gradient absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-16 shrink-0 text-right text-[11px] font-semibold tabular-nums">
        {value.toFixed(1)}
      </span>
    </div>
  );
}

function ExternalMetricCard({
  logo,
  icon,
  value,
  meta,
  label,
}: {
  logo: React.ReactNode;
  icon: "star" | "users";
  value: string | null;
  meta: string;
  label: string;
}) {
  return (
    <div className="bg-background border-border flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3">
      <div className="mb-1">{logo}</div>
      <div className="flex items-center gap-1 text-sm font-semibold">
        {icon === "star" ? (
          <Star
            className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
            strokeWidth={0}
          />
        ) : (
          <Users className="text-muted-foreground h-3.5 w-3.5" />
        )}
        {value ?? "Not found"}
      </div>
      <p className="text-muted-foreground text-[10px] leading-tight">
        {value == null ? "Not found yet" : meta}
      </p>
      <p className="text-muted-foreground text-[10px] leading-tight">{label}</p>
    </div>
  );
}

function extractRelevantReviews(venue: MyVenue): Array<{
  id: string;
  source: "Mesita" | "Google";
  author: string;
  rating: number;
  text: string;
}> {
  const raw = venue as unknown as Record<string, unknown>;
  const out: Array<{
    id: string;
    source: "Mesita" | "Google";
    author: string;
    rating: number;
    text: string;
  }> = [];

  const mesita = toReviewItems(raw["mesita_visitors"], "Mesita");
  const google = toReviewItems(raw["google_reviews"], "Google");
  const max = Math.max(mesita.length, google.length);
  for (let i = 0; i < max; i += 1) {
    if (mesita[i]) out.push(mesita[i]);
    if (google[i]) out.push(google[i]);
  }
  // Show every review we have in the business console (no preview cap).
  return out;
}

function toReviewItems(
  input: unknown,
  source: "Mesita" | "Google",
): Array<{
  id: string;
  source: "Mesita" | "Google";
  author: string;
  rating: number;
  text: string;
}> {
  if (!Array.isArray(input)) return [];
  const items: Array<{
    id: string;
    source: "Mesita" | "Google";
    author: string;
    rating: number;
    text: string;
  }> = [];

  input.forEach((rawItem, idx) => {
    if (!rawItem || typeof rawItem !== "object") return;
    const row = rawItem as Record<string, unknown>;
    const author = firstNonEmptyString([
      row["author"],
      row["author_name"],
      row["name"],
      row["user_name"],
      row["username"],
    ]);
    const text = firstNonEmptyString([
      row["text"],
      row["review"],
      row["body"],
      row["comment"],
      row["quote"],
    ]);
    const rating = normalizeRating(row["rating"]);
    if (!text) return;
    items.push({
      id: `${source.toLowerCase()}-${idx}-${author ?? "guest"}`,
      source,
      author: author ?? "Guest",
      rating,
      text,
    });
  });

  return items;
}

function firstNonEmptyString(candidates: unknown[]): string | null {
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const trimmed = candidate.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function normalizeRating(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) {
    return Math.min(5, Math.max(1, Math.round(v)));
  }
  if (typeof v === "string") {
    const num = Number.parseFloat(v);
    if (Number.isFinite(num)) return Math.min(5, Math.max(1, Math.round(num)));
  }
  return 5;
}

function humanizeToken(v: string | null): string | null {
  if (!v) return null;
  return v
    .split("_")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function formatDateTime(v: string): string {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function describeMenuUrl(raw: string): {
  valid: boolean;
  href?: string;
  kind?: "drive" | "hosted" | "other";
  provider?: string;
  note?: string;
} | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const withProtocol = /^[a-z]+:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    return { valid: false };
  }

  const host = parsed.hostname.toLowerCase();
  if (host.includes("drive.google.com") || host.includes("docs.google.com")) {
    return {
      valid: true,
      kind: "drive",
      href: parsed.toString(),
      provider: "Google Drive",
      note: "Make sure sharing is public so guests can open it.",
    };
  }
  if (host.includes("dropbox.com")) {
    return {
      valid: true,
      kind: "other",
      href: parsed.toString(),
      provider: "Dropbox",
      note: "Use a public share link.",
    };
  }
  if (
    host.includes("s3.") ||
    host.includes("cloudfront.net") ||
    host.includes("supabase.co")
  ) {
    return {
      valid: true,
      kind: "hosted",
      href: parsed.toString(),
      provider: "Hosted storage",
      note: "Great for direct hosted files.",
    };
  }

  return {
    valid: true,
    kind: "other",
    href: parsed.toString(),
    provider: "Custom host",
    note: "Any public URL is supported.",
  };
}

// ── Primitives ──────────────────────────────────────────────────────────

const CHANNEL_ICON_TONE: Record<string, string> = {
  Website: "bg-sky-500/12 text-sky-600",
  Phone: "bg-violet-500/12 text-violet-600",
  WhatsApp: "bg-whatsapp/15 text-whatsapp-deep",
  Instagram: "bg-pink-500/12 text-pink-600",
  "Google Maps": "bg-emerald-500/12 text-emerald-600",
  Email: "bg-orange-500/12 text-orange-600",
  Facebook: "bg-blue-600/12 text-blue-600",
  TikTok: "bg-foreground/8 text-foreground",
  YouTube: "bg-red-500/12 text-red-600",
  OpenTable: "bg-amber-500/12 text-amber-700",
  Rappi: "bg-orange-500/12 text-orange-600",
  "Uber Eats": "bg-emerald-600/12 text-emerald-700",
  "DiDi Food": "bg-lime-600/12 text-lime-700",
};

function ChannelGroup({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-foreground text-[13px] font-semibold tracking-tight">
          {title}
        </p>
        {action}
      </div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

function ChannelField({
  label,
  icon,
  placeholder,
  value,
  onChange,
  completed,
  missing,
  onToggleMissing,
}: {
  label: string;
  icon: React.ReactNode;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  completed?: boolean;
  missing?: boolean;
  onToggleMissing?: (missing: boolean) => void;
}) {
  const isMissing = !!missing;
  const iconTone =
    CHANNEL_ICON_TONE[label] ?? "bg-foreground/8 text-foreground";
  return (
    <div
      className={cn(
        "border-border/60 bg-muted/20 flex items-center gap-3 rounded-2xl border px-3 py-2.5",
        isMissing && "opacity-75",
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
          iconTone,
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
            {label}
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            {onToggleMissing && (
              <button
                type="button"
                onClick={() => onToggleMissing(!isMissing)}
                className="text-muted-foreground hover:text-foreground text-[9px] font-semibold tracking-wide uppercase transition"
              >
                {isMissing ? "Add" : "N/A"}
              </button>
            )}
            {typeof completed === "boolean" && (
              <ChannelStatus completed={completed} missing={isMissing} />
            )}
          </div>
        </div>
        {isMissing ? (
          <p className="text-muted-foreground truncate text-[12px] italic">
            Not available
          </p>
        ) : (
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            spellCheck={false}
            autoCapitalize="none"
            className="placeholder:text-muted-foreground/55 w-full truncate bg-transparent py-0 text-[12px] outline-none"
          />
        )}
      </div>
    </div>
  );
}

function ChannelStatus({
  completed,
  missing,
}: {
  completed: boolean;
  missing: boolean;
}) {
  if (missing) {
    return (
      <span className="text-muted-foreground text-[10px] font-medium">N/A</span>
    );
  }
  if (completed) {
    return <Check className="text-emerald-500 h-3.5 w-3.5 shrink-0" />;
  }
  return <span className="bg-amber-400 h-1.5 w-1.5 shrink-0 rounded-full" />;
}

function UrlField({
  label,
  icon,
  placeholder,
  value,
  onChange,
  completed,
  missing,
  onToggleMissing,
}: {
  label: string;
  icon: React.ReactNode;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  completed?: boolean;
  missing?: boolean;
  onToggleMissing?: (missing: boolean) => void;
}) {
  return (
    <label className="block">
      <span className="text-muted-foreground mb-1.5 flex items-center gap-1.5 text-xs font-medium">
        <span className="text-foreground/70">{icon}</span>
        {label}
        {typeof completed === "boolean" && (
          <FieldStatusBadge completed={completed} missing={missing} />
        )}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        autoCapitalize="none"
        disabled={!!missing}
        className={cn(
          INPUT,
          missing && "bg-muted/35 text-muted-foreground cursor-not-allowed",
        )}
      />
      {onToggleMissing && (
        <button
          type="button"
          onClick={() => onToggleMissing(!missing)}
          className={cn(
            "mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase transition",
            missing
              ? "bg-muted text-foreground hover:bg-muted/80"
              : "text-muted-foreground hover:bg-muted",
          )}
        >
          {missing ? (
            <CheckCircle2 className="h-3 w-3" />
          ) : (
            <Clock className="h-3 w-3" />
          )}
          {missing ? "Has channel" : "I don't have this"}
        </button>
      )}
    </label>
  );
}

function FieldStatusBadge({
  completed,
  missing,
}: {
  completed: boolean;
  missing?: boolean;
}) {
  const isMissing = !!missing;
  return (
    <span
      className={cn(
        "ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
        isMissing
          ? "bg-slate-500/10 text-slate-700"
          : completed
            ? "bg-emerald-500/10 text-emerald-700"
            : "bg-amber-500/10 text-amber-700",
      )}
    >
      {isMissing ? (
        <Sparkles className="h-3 w-3" />
      ) : completed ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : (
        <Clock className="h-3 w-3" />
      )}
      {isMissing ? "N/A" : completed ? "Completed" : "Pending"}
    </span>
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

  const setRange = (key: DayKey, patch: Partial<HoursRange>) => {
    const day = hours[key];
    const current = day.ranges[0] ?? { open: "", close: "" };
    setDay(key, {
      ...day,
      closed: false,
      ranges: [{ ...current, ...patch }],
    });
  };

  const markClosed = (key: DayKey) => setDay(key, { closed: true, ranges: [] });

  const reopen = (key: DayKey) =>
    setDay(key, { closed: false, ranges: [{ open: "", close: "" }] });

  return (
    <div className="border-border divide-border/60 divide-y rounded-lg border text-[11px]">
      {DAYS.map(({ key, label }) => {
        const d = hours[key];
        const isClosed = d.closed;
        const range = d.ranges[0] ?? { open: "", close: "" };
        return (
          <div
            key={key}
            className={cn(
              "flex items-center gap-2 px-2 py-1",
              isClosed && "bg-muted/25",
            )}
          >
            <span className="text-muted-foreground w-7 shrink-0 font-semibold">
              {label}
            </span>

            {isClosed ? (
              <span className="text-muted-foreground flex-1">Closed</span>
            ) : (
              <div className="flex min-w-0 flex-1 items-center gap-1">
                <input
                  value={range.open}
                  onChange={(e) => setRange(key, { open: e.target.value })}
                  placeholder="09:00"
                  aria-label={`${label} opens`}
                  className="border-border bg-muted/40 focus:border-foreground/35 h-7 w-[4.25rem] rounded-md border px-1 text-center text-[11px] tabular-nums outline-none"
                />
                <span className="text-muted-foreground/70 text-[10px]">–</span>
                <input
                  value={range.close}
                  onChange={(e) => setRange(key, { close: e.target.value })}
                  placeholder="22:00"
                  aria-label={`${label} closes`}
                  className="border-border bg-muted/40 focus:border-foreground/35 h-7 w-[4.25rem] rounded-md border px-1 text-center text-[11px] tabular-nums outline-none"
                />
                {isOvernight(range.open, range.close) && (
                  <span
                    title="Closes the next day"
                    className="text-muted-foreground text-[9px] font-medium"
                  >
                    +1d
                  </span>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => (isClosed ? reopen(key) : markClosed(key))}
              aria-label={isClosed ? `Open ${label}` : `Close ${label}`}
              className={cn(
                "shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold transition",
                isClosed
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {isClosed ? "Open" : "Closed"}
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
  const remove = (idx: number) => onChange(values.filter((_, i) => i !== idx));
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
