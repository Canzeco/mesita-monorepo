"use client";

// Profile's Profile picture box (MESITA-3528, Pato 2026-11-08: "add also
// another box for profile picture, by default is the first image in the media
// carousel when the profile is created, then you can manually change it").
//
// The round photo guests see on the place header, the voucher pill and the
// wallet. Until the place picks one it follows the cover, the gallery's first
// photo. A pick (a gallery photo or an upload) is stored on
// place_profiles.profile_photo and saves with the page's one Save; Create,
// Enrich and Google Update never write it, so it sticks. Picking the cover
// (the picker's first circle) saves null and follows the cover again. Tapping
// the photo opens the picker (MESITA-3531).

import { useRef, useState } from "react";
import { UserCircleIcon } from "@phosphor-icons/react/dist/ssr";
import { Check, ImagePlus, Loader2 } from "lucide-react";
import { photoUrl } from "@mesita/place-profile";
import { SectionCard } from "@/components/ui/manage";
import { resizeImageFile } from "@/lib/image-resize";
import { type AdminPlace, uploadPlacePhoto } from "../actions";
import { usePlaceContext } from "../PlaceContext";
import { useSectionSaver } from "../useSectionDirty";

const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_SEND_BYTES = 3.8 * 1024 * 1024;

/** The stored pick, never the view's cover fallback. */
const pickOf = (place: AdminPlace): string | null => place.profile_photo_pick ?? null;

export function ProfilePictureCard({ place }: { place: AdminPlace }) {
  const { savePending } = usePlaceContext();
  const gallery = (Array.isArray(place.photos) ? place.photos : []).filter(
    (u): u is string => typeof u === "string" && u !== "",
  );
  const cover = gallery[0] ?? null;
  const [pick, setPick] = useState<string | null>(() => pickOf(place));
  const [saved, setSaved] = useState<string | null>(pick);
  const [choosing, setChoosing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const dirty = pick !== saved;
  useSectionSaver(
    "profile_photo",
    dirty,
    () => (dirty ? { kind: "patch" as const, patch: { id: place.id, profile_photo: pick } } : { kind: "clean" as const }),
    (fresh) => {
      const next = pickOf(fresh);
      setPick(next);
      setSaved(next);
    },
    () => {
      setPick(saved);
      setChoosing(false);
      setError(null);
    },
  );

  const shown = pick ?? cover;
  const busy = savePending || uploading;

  const upload = async (original: File) => {
    setError(null);
    setUploading(true);
    try {
      const file = await resizeImageFile(original, { maxEdge: 2048 });
      if (!ACCEPT.split(",").includes(file.type)) {
        setError("Use a JPG, PNG or WEBP photo.");
        return;
      }
      if (file.size > MAX_SEND_BYTES) {
        setError("That photo is too large. Try a smaller one.");
        return;
      }
      const form = new FormData();
      form.set("place_id", place.id);
      form.set("file", file);
      const r = await uploadPlacePhoto(form);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setPick(r.data.url);
      setChoosing(false);
    } catch {
      setError("The photo did not upload. Try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <SectionCard
      icon={<UserCircleIcon size={20} />}
      title="Profile picture"
      subtitle="The round photo guests see beside your name. Until you pick one, it is your cover photo."
    >
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        hidden
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload(file);
        }}
      />

      {/* THE PHOTO IS THE BUTTON (MESITA-3531, Pato: "remove the use the cover
          quick button and the change button ... you click on top of the
          image"): a tap opens the picker; the cover is its first circle. */}
      <div className="mt-5 flex items-center gap-4">
        <button
          type="button"
          onClick={() => setChoosing((c) => !c)}
          disabled={busy}
          aria-expanded={choosing}
          aria-label="Change the profile picture"
          className="bg-muted border-border hover:ring-foreground/20 size-20 shrink-0 overflow-hidden rounded-full border transition hover:ring-4 disabled:opacity-50"
        >
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl(shown, "thumb")}
              onError={(e) => {
                if (e.currentTarget.src !== shown) e.currentTarget.src = shown;
              }}
              alt="Profile picture"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-muted-foreground flex h-full w-full items-center justify-center">
              <ImagePlus className="size-5" />
            </span>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{pick ? "Your pick" : shown ? "Your cover photo" : "No photo yet"}</p>
          <p className="text-muted-foreground text-xs">
            {pick ? "Stays when the gallery changes." : "Changes when the cover changes."} Tap the photo to change it.
          </p>
        </div>
      </div>

      {choosing ? (
        <div className="mt-4 grid grid-cols-4 gap-2">
          {gallery.map((src, i) => {
            const selected = (pick ?? cover) === src;
            return (
              <button
                key={src}
                type="button"
                disabled={busy}
                onClick={() => setPick(i === 0 ? null : src)}
                aria-label={i === 0 ? "Use the cover" : `Use photo ${i + 1}`}
                aria-pressed={selected}
                className={
                  "bg-muted relative aspect-square overflow-hidden rounded-full border transition disabled:opacity-50 " +
                  (selected ? "ring-foreground border-transparent ring-2" : "border-border")
                }
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl(src, "thumb")} alt="" className="h-full w-full object-cover" />
                {selected ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-white">
                    <Check className="size-5" />
                  </span>
                ) : null}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            aria-label="Upload a photo"
            className="border-border text-muted-foreground hover:bg-muted/60 flex aspect-square items-center justify-center rounded-full border border-dashed transition disabled:opacity-60"
          >
            {uploading ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
          </button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-destructive mt-3 text-sm">
          {error}
        </p>
      ) : null}
    </SectionCard>
  );
}
