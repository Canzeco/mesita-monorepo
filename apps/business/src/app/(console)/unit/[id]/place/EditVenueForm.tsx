"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Save } from "lucide-react";
import { SubTabs } from "@/components/business/SubTabs";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { placePath } from "@/lib/business-route-contract";
import {
  apiUpdateVenue,
  type MyVenue,
  type UpdateVenueInput,
  type VenueHours,
} from "@/lib/api/venues";
import {
  PLACE_DESCRIPTION_MAX,
  PLACE_HOUR_DAYS,
  PLACE_VENUE_NAME_MAX,
  PLACE_PR_WHATSAPP_MAX,
  PLACE_PR_INSTAGRAM_MAX,
  PlaceBasicsModule,
  PlaceChannelsModule,
  PlaceMediaModule,
  PlaceMenuModule,
  PlacePreviewModule,
  PlaceReviewsModule,
  type DayKey,
  type DayShifts,
  type PlaceFormState,
} from "@/components/business/place";
import {
  PLACE_SUB_TABS,
  type PlaceSubTab,
} from "@/components/business/place/place-subtabs";
import { MAX_PHOTOS } from "@/components/business/place/place-upload-utils";
import { cn, errMsg } from "@/lib/utils";

const DAYS = PLACE_HOUR_DAYS;
const MAX_SHIFTS_PER_DAY = 1;
const SAVED_TOAST_MS = 2200;
const VENUE_NAME_MAX = PLACE_VENUE_NAME_MAX;
const DESCRIPTION_MAX = PLACE_DESCRIPTION_MAX;
const TAG_MAX = 40;
const TAG_MAX_COUNT = 20;

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

function venueToFormState(venue: MyVenue): PlaceFormState {
  return {
    name: venue.name ?? "",
    category: venue.category ?? "",
    description: venue.description ?? "",
    hours: venueHoursToForm(venue.hours),
    menu_links: venue.menu_pdf_url
      ? [{ name: venue.menu_pdf_name ?? "", url: venue.menu_pdf_url }]
      : [{ name: "", url: "" }],
    photos: (venue.photos ?? []).slice(0, MAX_PHOTOS),
    tags: venue.tags ?? [],
    phone: venue.phone ?? "",
    whatsapp_url: venue.whatsapp_url ?? "",
    whatsapp_pr_urls: (venue.whatsapp_pr_urls ?? []).slice(0, PLACE_PR_WHATSAPP_MAX),
    email: venue.email ?? "",
    website_url: venue.website_url ?? "",
    instagram_url: venue.instagram_url ?? "",
    instagram_pr_urls: (venue.instagram_pr_urls ?? []).slice(0, PLACE_PR_INSTAGRAM_MAX),
    facebook_url: venue.facebook_url ?? "",
    tiktok_url: venue.tiktok_url ?? "",
    threads_url: venue.threads_url ?? "",
    reddit_url: venue.reddit_url ?? "",
    opentable_url: venue.opentable_url ?? "",
    resy_url: venue.resy_url ?? "",
    tripadvisor_url: venue.tripadvisor_url ?? "",
    google_maps_url: venue.google_maps_url ?? "",
    uber_eats_url: venue.uber_eats_url ?? "",
    didi_food_url: venue.didi_food_url ?? "",
  };
}

export function EditVenueForm({
  venue,
  tab,
}: {
  venue: MyVenue;
  tab: PlaceSubTab;
}) {
  const router = useRouter();
  const supabase = useBrowserSupabase();

  const setTab = (next: PlaceSubTab) => {
    router.replace(placePath(venue.id, next), { scroll: false });
  };

  const [v, setV] = useState<PlaceFormState>(() => venueToFormState(venue));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [refreshRunning, setRefreshRunning] = useState(false);
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const set = <K extends keyof PlaceFormState>(
    key: K,
    value: PlaceFormState[K],
  ) => {
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

  const handlePlaceRefresh = () => {
    if (refreshRunning) return;
    setRefreshNotice(null);
    setRefreshRunning(true);
    window.setTimeout(() => {
      setRefreshRunning(false);
      setRefreshNotice(
        "Refresh queued — we'll update your place details shortly.",
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
        .filter(Boolean)
        .slice(0, TAG_MAX_COUNT),
      phone: nullable(v.phone),
      whatsapp_url: nullableUrl(v.whatsapp_url),
      whatsapp_pr_urls: v.whatsapp_pr_urls
        .map(nullableUrl)
        .filter((u): u is string => u !== null)
        .slice(0, PLACE_PR_WHATSAPP_MAX),
      email: v.email.trim() === "" ? null : v.email.trim(),
      website_url: nullableUrl(v.website_url),
      instagram_url: nullableUrl(v.instagram_url),
      instagram_pr_urls: v.instagram_pr_urls
        .map(nullableUrl)
        .filter((u): u is string => u !== null)
        .slice(0, PLACE_PR_INSTAGRAM_MAX),
      facebook_url: nullableUrl(v.facebook_url),
      tiktok_url: nullableUrl(v.tiktok_url),
      threads_url: nullableUrl(v.threads_url),
      reddit_url: nullableUrl(v.reddit_url),
      opentable_url: nullableUrl(v.opentable_url),
      resy_url: nullableUrl(v.resy_url),
      tripadvisor_url: nullableUrl(v.tripadvisor_url),
      google_maps_url: nullableUrl(v.google_maps_url),
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
    <form onSubmit={onSubmit} className="flex min-h-full flex-col">
      <SubTabs
        tabs={PLACE_SUB_TABS}
        active={tab}
        onChange={setTab}
        equalWidth
        variant="segmented"
      />

      <div className="flex flex-col gap-4 px-4 pt-5 pb-10">
        {tab === "preview" ? (
          <PlacePreviewModule
            venue={venue}
            v={v}
            refreshRunning={refreshRunning}
            refreshNotice={refreshNotice}
            onRefresh={handlePlaceRefresh}
          />
        ) : null}

        {tab === "basics" ? (
          <PlaceBasicsModule venue={venue} form={v} set={set} />
        ) : null}

        {tab === "media" ? (
          <div className="flex flex-col gap-4">
            <PlaceMediaModule
              hideHeader
              photos={v.photos}
              onChange={(photos) => set("photos", photos)}
              venueId={venue.id}
              venueName={v.name}
              onError={setError}
            />
            <PlaceMenuModule
              hideHeader
              venueId={venue.id}
              form={v}
              set={set}
              onError={setError}
            />
          </div>
        ) : null}

        {tab === "channels" ? (
          <PlaceChannelsModule form={v} set={set} hideHeader />
        ) : null}

        {tab === "reviews" ? (
          <PlaceReviewsModule venue={venue} hideHeader />
        ) : null}
      </div>

      {error && (
        <p className="bg-destructive/10 text-destructive mx-4 mb-2 rounded-lg px-3 py-2 text-sm">
          {error}
        </p>
      )}

      {(isDirty || pending || saved) && (
        <div className="border-border bg-background sticky bottom-0 z-40 mt-auto flex items-center justify-between gap-3 border-t px-4 py-3">
          <p
            className={cn(
              "text-[13px] font-medium",
              pending
                ? "text-muted-foreground"
                : saved
                  ? "text-secondary"
                  : "text-foreground",
            )}
          >
            {pending ? "Saving…" : saved ? "Saved" : "Unsaved changes"}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDiscard}
              disabled={pending || !isDirty}
              className="text-muted-foreground hover:text-foreground text-[13px] font-semibold transition disabled:opacity-40"
            >
              Discard
            </button>
            <button
              type="submit"
              disabled={pending || !isDirty}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold transition disabled:opacity-60",
                saved
                  ? "bg-secondary text-white"
                  : "bg-foreground text-background hover:opacity-90",
              )}
            >
              {pending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Save
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
        </div>
      )}
    </form>
  );
}
