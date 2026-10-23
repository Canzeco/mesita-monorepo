"use client";

import { useEffect, useMemo, useState } from "react";
import { Images } from "lucide-react";
import type { AdminPlace } from "../actions";
import { SectionCard } from "@/components/admin-ui/manage";
import { effectivePlacePhotos } from "@mesita/place-profile";
import { usePlaceContext } from "../PlaceContext";
import { useSectionSaver } from "../useSectionDirty";
import { ErrorNote } from "@/components/ErrorNote";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import {
  PLACE_IMAGES_BUCKET,
  placeImageObjectPath,
  validateUploadFile,
} from "@/lib/place-upload-utils";
import { photoCaption } from "../photo-caption";
import {
  MesitaPhotoMetaDialog,
  MesitaPhotosEditor,
  urlPhotoList,
} from "./MesitaPhotosEditor";

function mesitaPhotosFromPlace(place: AdminPlace): string[] {
  return urlPhotoList(place.mesita_photos);
}

export function PhotoSourcesCard({ place }: { place: AdminPlace }) {
  const { savePending, profile } = usePlaceContext();
  const limits = profile.fieldLimits;
  const google = urlPhotoList(place.google_photos);
  const hero =
    mesitaPhotosFromPlace(place)[0] ??
    google[0] ??
    effectivePlacePhotos(place)[0] ??
    null;

  const [mesita, setMesita] = useState(() => mesitaPhotosFromPlace(place));
  const [saved, setSaved] = useState(mesita);
  const [errors, setErrors] = useState<{ photos?: string }>({});
  const [uploading, setUploading] = useState(false);
  const [metaFor, setMetaFor] = useState<string | null>(null);

  useEffect(() => {
    const next = mesitaPhotosFromPlace(place);
    setMesita(next);
    setSaved(next);
    setErrors({});
  }, [place.id, place.mesita_photos]);

  const dirty = useMemo(
    () => JSON.stringify(mesita) !== JSON.stringify(saved),
    [mesita, saved],
  );

  useSectionSaver(
    "mesitaPhotos",
    dirty,
    () => {
      if (mesita.length > limits.photosMax) {
        const over = mesita.length - limits.photosMax;
        return {
          kind: "invalid" as const,
          error: `Mesita gallery has ${mesita.length} photos and the ceiling is ${limits.photosMax}. Remove ${over} to save.`,
        };
      }
      if (!dirty) return { kind: "clean" as const };
      return {
        kind: "patch" as const,
        patch: { id: place.id, mesita_photos: mesita },
      };
    },
    (fresh) => {
      const next = mesitaPhotosFromPlace(fresh);
      setMesita(next);
      setSaved(next);
      setErrors({});
    },
    () => {
      const next = mesitaPhotosFromPlace(place);
      setMesita(next);
      setSaved(next);
      setErrors({});
    },
  );

  const anyPending = savePending;

  const uploadPhoto = async (file: File) => {
    if (uploading || anyPending) return;
    if (mesita.length >= limits.photosMax) {
      setErrors((e) => ({
        ...e,
        photos: `At most ${limits.photosMax} photos.`,
      }));
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
      if (uploadError) throw new Error(uploadError.message);
      const { data } = supabase.storage
        .from(PLACE_IMAGES_BUCKET)
        .getPublicUrl(path);
      if (!data?.publicUrl) {
        throw new Error("Upload succeeded but no public URL was returned.");
      }
      setMesita([...mesita, data.publicUrl]);
    } catch (err) {
      setErrors((e) => ({
        ...e,
        photos:
          err instanceof Error ? err.message : "Couldn't upload that photo.",
      }));
    } finally {
      setUploading(false);
    }
  };

  const movePhoto = (from: number, dir: -1 | 1) => {
    const to = from + dir;
    if (to < 0 || to >= mesita.length) return;
    const next = mesita.slice();
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setMesita(next);
  };

  const removePhoto = (idx: number) => {
    setMesita(mesita.filter((_, i) => i !== idx));
  };

  return (
    <>
      <SectionCard
        icon={<Images className="h-4 w-4" />}
        tint="violet"
        title="Photo sources"
        action={
          <span
            className={
              "type-label tabular-nums " +
              (mesita.length > limits.photosMax
                ? "text-destructive font-semibold"
                : "text-muted-foreground")
            }
          >
            Mesita {mesita.length} / {limits.photosMax}
          </span>
        }
      >
        <p className="text-sm text-muted-foreground">
          Update refreshes Google only. Edit the Mesita gallery here; Enrich can rebuild it. The first Mesita photo is the hero when the catalog is non-empty.
        </p>

        <dl className="mt-4 grid gap-3 text-sm">
          <div>
            <dt className="font-medium text-foreground">Hero (display)</dt>
            <dd className="text-muted-foreground break-all">{hero ?? "—"}</dd>
          </div>
        </dl>

        <div className="mt-6">
          <h3 className="text-sm font-medium text-foreground">
            Google catalog ({google.length}) — read only
          </h3>
          <p className="text-muted-foreground mt-1 text-xs">
            Refreshed by Update; not editable on this screen.
          </p>
          {google.length > 0 ? (
            <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
              {google.slice(0, 6).map((src, idx) => (
                <div
                  key={`${src}-${idx}`}
                  className="overflow-hidden rounded-lg ring-1 ring-black/5"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`Google photo ${idx + 1}`}
                    className="aspect-square w-full object-cover opacity-90"
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground mt-2 text-xs">Empty — run Update after Create.</p>
          )}
        </div>

        <div className="mt-6 border-border/60 border-t pt-6">
          <h3 className="text-sm font-medium text-foreground">Mesita gallery</h3>
          {mesita.length > limits.photosMax ? (
            <p className="border-destructive/30 bg-destructive/5 text-destructive mt-3 rounded-xl border px-3.5 py-2.5 text-xs leading-relaxed">
              Over the ceiling by {mesita.length - limits.photosMax}. Remove{" "}
              {mesita.length - limits.photosMax} before saving.
            </p>
          ) : null}
          <MesitaPhotosEditor
            placeId={place.id}
            photos={mesita}
            photosMax={limits.photosMax}
            pending={anyPending}
            uploading={uploading}
            onUpload={uploadPhoto}
            onMove={movePhoto}
            onRemove={removePhoto}
            onInfo={setMetaFor}
          />
          {errors.photos ? <ErrorNote message={errors.photos} /> : null}
        </div>
      </SectionCard>

      {metaFor !== null && (
        <MesitaPhotoMetaDialog
          url={metaFor}
          analysis={photoCaption(place.photo_analysis, metaFor)}
          position={mesita.indexOf(metaFor) + 1}
          total={mesita.length}
          onClose={() => setMetaFor(null)}
        />
      )}
    </>
  );
}
