"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Save } from "lucide-react";
import { SubTabs } from "@/components/business/SubTabs";
import type { MenuSessionUploadsHandle } from "@/components/business/place/PlaceMenuFields";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { placePath } from "@/lib/business-route-contract";
import {
  apiUpdatePlace,
  type MyPlace,
  type UpdatePlaceInput,
} from "@/lib/api/places";
import {
  PLACE_DESCRIPTION_MAX,
  PLACE_NAME_MAX,
  PlaceBasicsSection,
  PlaceChannelsModule,
  PlaceMediaModule,
  PlaceMenuModule,
  PlacePreviewModule,
  PlaceReviewsModule,
  type PlaceFormState,
} from "@/components/business/place";
import {
  PLACE_SUB_TABS,
  type PlaceSubTab,
} from "@/components/business/place/place-subtabs";
import {
  isDriveMenuUrl,
  MAX_PHOTOS,
  removeOrphanMenuStorageObjects,
} from "@/components/business/place/place-upload-utils";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";
import { cn, errMsg } from "@/lib/utils";
import { formHoursToPlace } from "./place-hours";
import { nullable, nullableUrl, placeToFormState } from "./place-form-mappers";

const SAVED_TOAST_MS = 2200;
const TAG_MAX = 40;
const TAG_MAX_COUNT = 20;
const MENU_ITEM_NAME_MAX = 80;
const PLACE_REFRESH_SIMULATED_MS = 950;

export function EditPlaceForm({
  place,
  tab,
}: {
  place: MyPlace;
  tab: PlaceSubTab;
}) {
  const router = useRouter();
  const supabase = useBrowserSupabase();

  const setTab = (next: PlaceSubTab) => {
    router.replace(placePath(place.id, next), { scroll: false });
  };

  const [v, setV] = useState<PlaceFormState>(() => placeToFormState(place));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [refreshRunning, setRefreshRunning] = useState(false);
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  // Bumped on Discard so PlaceMenuFields remounts and rehydrates its
  // Upload/Drive source drafts from the last-saved menu_links.
  const [menuEditorKey, setMenuEditorKey] = useState(0);
  // Parent-owned so Media tab unmounts don't lose never-saved upload URLs.
  const menuSessionUrlsRef = useRef<Set<string>>(new Set());
  const menuSessionUploads = useMemo<MenuSessionUploadsHandle>(
    () => ({
      track: (url: string) => {
        const trimmed = url.trim();
        if (trimmed) menuSessionUrlsRef.current.add(trimmed);
      },
      release: (url: string) => {
        const trimmed = url.trim();
        if (!trimmed || !menuSessionUrlsRef.current.has(trimmed)) return;
        menuSessionUrlsRef.current.delete(trimmed);
        void removeOrphanMenuStorageObjects(supabase, [trimmed], []);
      },
      drain: () => {
        const urls = [...menuSessionUrlsRef.current];
        menuSessionUrlsRef.current = new Set();
        return urls;
      },
    }),
    [supabase],
  );

  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

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
    const keep = placeToFormState(place).menu_links.map((m) => m.url);
    const session = menuSessionUploads.drain();
    void removeOrphanMenuStorageObjects(supabase, session, keep);
    setV(placeToFormState(place));
    setMenuEditorKey((k) => k + 1);
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
    }, PLACE_REFRESH_SIMULATED_MS);
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

    for (const m of v.menu_links) {
      const trimmed = m.url.trim();
      if (!trimmed) {
        // Draft rows with a source but no file/link yet — block save so we
        // don't silently drop them (matches admin Products posture).
        if (m.source) {
          setError(
            m.source === "drive"
              ? "Each Drive menu needs a Google Drive or Docs share link."
              : "Each uploaded menu needs a file.",
          );
          return;
        }
        continue;
      }
      const normalized = nullableUrl(trimmed);
      if (!normalized || !/^https:\/\//i.test(normalized)) {
        setError(
          "Each menu needs a valid https:// URL (Drive link or uploaded file).",
        );
        return;
      }
      if (m.source === "drive" && !isDriveMenuUrl(normalized)) {
        setError("Drive menus need a Google Drive or Docs link.");
        return;
      }
      if (!m.source) {
        setError("Each menu needs a source — Upload file or Google Drive.");
        return;
      }
    }

    const menuEntries = v.menu_links
      .map((m) => ({
        name: nullable(m.name)?.slice(0, MENU_ITEM_NAME_MAX) ?? null,
        url: nullableUrl(m.url),
      }))
      .filter((m): m is { name: string | null; url: string } => !!m.url);
    const firstMenu = menuEntries[0] ?? null;

    // Preserve sibling products keys (e.g. reservations) while rewriting menu.
    const existingProducts =
      place.products &&
      typeof place.products === "object" &&
      !Array.isArray(place.products)
        ? { ...place.products }
        : {};

    const payload: UpdatePlaceInput = {
      id: place.id,
      name: trimmedName.slice(0, PLACE_NAME_MAX),
      category: nullable(v.category),
      description:
        nullable(v.description)?.slice(0, PLACE_DESCRIPTION_MAX) ?? null,
      hours: formHoursToPlace(v.hours),
      menu_pdf_url: firstMenu?.url ?? null,
      menu_pdf_name: firstMenu?.name ?? null,
      products: { ...existingProducts, menu: menuEntries },
      photos: v.photos.slice(0, MAX_PHOTOS),
      tags: v.tags
        .map((t) => t.trim().toLowerCase().slice(0, TAG_MAX))
        .filter(Boolean)
        .slice(0, TAG_MAX_COUNT),
      phone: nullable(v.phone),
      whatsapp_url: nullableUrl(v.whatsapp_url),
      email: nullable(v.email),
      website_url: nullableUrl(v.website_url),
      instagram_url: nullableUrl(v.instagram_url),
      facebook_url: nullableUrl(v.facebook_url),
      threads_url: nullableUrl(v.threads_url),
      reddit_url: nullableUrl(v.reddit_url),
      opentable_url: nullableUrl(v.opentable_url),
      resy_url: nullableUrl(v.resy_url),
      // google_maps_url is native-locked (MESITA-468) — never patch.
      uber_eats_url: nullableUrl(v.uber_eats_url),
      didi_food_url: nullableUrl(v.didi_food_url),
    };

    const previousMenuUrls = placeToFormState(place).menu_links.map(
      (m) => m.url,
    );
    const keepMenuUrls = menuEntries.map((m) => m.url);

    startTransition(async () => {
      try {
        await apiUpdatePlace(supabase, payload);
        const session = menuSessionUploads.drain();
        void removeOrphanMenuStorageObjects(
          supabase,
          [...previousMenuUrls, ...session],
          keepMenuUrls,
        );
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
            place={place}
            v={v}
            refreshRunning={refreshRunning}
            refreshNotice={refreshNotice}
            onRefresh={handlePlaceRefresh}
          />
        ) : null}

        {tab === "basics" ? (
          <PlaceBasicsSection place={place} form={v} set={set} />
        ) : null}

        {tab === "media" ? (
          <div className="flex flex-col gap-4">
            <PlaceMediaModule
              photos={v.photos}
              onChange={(photos) => set("photos", photos)}
              projectId={place.id}
              placeName={v.name}
              onError={setError}
            />
            <PlaceMenuModule
              key={menuEditorKey}
              hideHeader
              projectId={place.id}
              form={v}
              set={set}
              onError={setError}
              sessionUploads={menuSessionUploads}
            />
          </div>
        ) : null}

        {tab === "channels" ? (
          <PlaceChannelsModule form={v} set={set} hideHeader />
        ) : null}

        {tab === "reviews" ? (
          <PlaceReviewsModule place={place} hideHeader />
        ) : null}
      </div>

      {error && (
        <p className={cn(ERROR_BOX_CLASS, "mx-4 mb-2 text-sm")}>{error}</p>
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
