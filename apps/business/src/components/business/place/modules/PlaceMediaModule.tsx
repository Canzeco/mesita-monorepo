"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ImagePlus,
  Loader2,
  X,
} from "lucide-react";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { cn, errMsg } from "@/lib/utils";
import { PlaceBox } from "../PlaceBox";
import { PlaceKvField } from "../PlaceKvField";
import { PlaceModule } from "../PlaceModule";
import {
  ALLOWED_IMAGE_ACCEPT,
  MAX_PHOTOS,
  extForFile,
  validateUploadFile,
} from "../place-upload-utils";

function PhotoLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
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

function MediaSection({
  photos,
  onChange,
  projectId,
  placeName,
  onError,
}: {
  photos: string[];
  onChange: (next: string[]) => void;
  projectId: string;
  placeName: string;
  onError: (msg: string | null) => void;
}) {
  const supabase = useBrowserSupabase();
  const [uploading, setUploading] = useState(false);
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
        const path = `business/${projectId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("place-images")
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
          .from("place-images")
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
    <div className="flex flex-col gap-3">
      {photos.length === 0 ? (
        <p className="text-muted-foreground text-[12px]">No photos yet.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2">
          {photos.map((src, idx) => (
            <li
              key={`${src}-${idx}`}
              className="group border-border bg-muted relative overflow-hidden rounded-lg border"
            >
              <button
                type="button"
                onClick={() => setZoomIdx(idx)}
                aria-label={`Open ${placeName || "place"} photo ${idx + 1}`}
                className="block aspect-square w-full"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={`${placeName || "Place"} photo ${idx + 1}`}
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
          id={`place-image-upload-${projectId}`}
          type="file"
          accept={ALLOWED_IMAGE_ACCEPT}
          multiple
          onChange={onFilesPicked}
          disabled={uploading || photos.length >= MAX_PHOTOS}
          className="hidden"
        />
        <label
          htmlFor={`place-image-upload-${projectId}`}
          className={cn(
            "border-border bg-card hover:bg-muted inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-3 text-[12px] font-semibold transition",
            (uploading || photos.length >= MAX_PHOTOS) &&
              "pointer-events-none cursor-not-allowed opacity-55",
          )}
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading…
            </>
          ) : (
            <>
              <ImagePlus className="h-4 w-4" />
              Upload images
            </>
          )}
        </label>
        <p className="text-muted-foreground text-[11px]">
          {photos.length}/{MAX_PHOTOS}
        </p>
      </div>

      {zoomIdx != null && photos[zoomIdx] && (
        <PhotoLightbox
          src={photos[zoomIdx]}
          alt={`${placeName || "Place"} photo ${zoomIdx + 1}`}
          onClose={() => setZoomIdx(null)}
        />
      )}
    </div>
  );
}

export function PlaceMediaModule({
  photos,
  onChange,
  projectId,
  placeName,
  onError,
  hideHeader = false,
}: {
  photos: string[];
  onChange: (photos: string[]) => void;
  projectId: string;
  placeName: string;
  onError: (msg: string | null) => void;
  hideHeader?: boolean;
}) {
  if (hideHeader) {
    return (
      <PlaceBox>
        <PlaceKvField label="Photos">
          <MediaSection
            photos={photos}
            onChange={onChange}
            projectId={projectId}
            placeName={placeName}
            onError={onError}
          />
        </PlaceKvField>
      </PlaceBox>
    );
  }

  return (
    <PlaceModule id="media" hideHeader={hideHeader}>
      <MediaSection
        photos={photos}
        onChange={onChange}
        projectId={projectId}
        placeName={placeName}
        onError={onError}
      />
    </PlaceModule>
  );
}
