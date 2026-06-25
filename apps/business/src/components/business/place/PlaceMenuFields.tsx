"use client";

import { useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { INPUT_CLASS as INPUT } from "@/lib/ui-classes";
import { cn, errMsg } from "@/lib/utils";
import { PlaceFormField } from "./PlaceFormField";
import type { PlaceFormState, SetPlaceForm } from "./place-form-types";
import {
  ALLOWED_MENU_ACCEPT,
  extForMenuFile,
  isDriveMenuUrl,
  validateMenuUploadFile,
} from "./place-upload-utils";

export function PlaceMenuFields({
  venueId,
  form,
  set,
  onError,
}: {
  venueId: string;
  form: PlaceFormState;
  set: SetPlaceForm;
  onError: (msg: string | null) => void;
}) {
  const supabase = useBrowserSupabase();
  const link = form.menu_links[0] ?? { name: "", url: "" };
  const [uploading, setUploading] = useState(false);

  const setLink = (patch: Partial<{ name: string; url: string }>) => {
    set("menu_links", [{ ...link, ...patch }]);
  };

  const hasUploadedFile =
    link.url.trim() !== "" && !isDriveMenuUrl(link.url);

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
    <div className="flex flex-col gap-3">
      <PlaceFormField label="Menu name" kv>
        <input
          type="text"
          value={link.name}
          onChange={(e) => setLink({ name: e.target.value.slice(0, 80) })}
          placeholder="Dinner menu"
          className={INPUT}
        />
      </PlaceFormField>
      <PlaceFormField label="Menu link" kv>
        <input
          type="url"
          value={isDriveMenuUrl(link.url) || !hasUploadedFile ? link.url : ""}
          onChange={(e) => setLink({ url: e.target.value })}
          placeholder="Google Drive or URL"
          spellCheck={false}
          autoCapitalize="none"
          className={INPUT}
        />
      </PlaceFormField>
      <div className="flex items-center gap-3">
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
            "border-border bg-card hover:bg-muted inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-3 text-[12px] font-semibold transition",
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
              {hasUploadedFile ? "Replace file" : "Upload file"}
            </>
          )}
        </label>
        {hasUploadedFile ? (
          <button
            type="button"
            onClick={() => setLink({ url: "" })}
            className="text-muted-foreground hover:text-destructive text-[11px] font-medium"
          >
            Remove
          </button>
        ) : null}
      </div>
    </div>
  );
}
