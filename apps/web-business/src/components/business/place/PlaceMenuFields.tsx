"use client";

import { useRef, useState } from "react";
import {
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { INPUT_CLASS as INPUT } from "@/lib/ui-classes";
import { errMsg } from "@/lib/utils";
import { PdfFirstPage } from "./PdfFirstPage";
import { PlaceFormField } from "./PlaceFormField";
import type {
  MenuEntry,
  MenuSource,
  PlaceFormState,
  SetPlaceForm,
} from "./place-form-types";
import {
  ALLOWED_MENU_ACCEPT,
  bucketForMenuFile,
  detectMenuFileKind,
  drivePreviewUrl,
  isDriveMenuUrl,
  placeMenuObjectPath,
  validateMenuUploadFile,
} from "./place-upload-utils";

const MENU_NAME_MAX_LENGTH = 80;

type MenuDraft = {
  key: string;
  name: string;
  url: string;
  /** Exclusive source — upload file XOR Drive link. Null until the operator picks. */
  source: MenuSource | null;
};

function newKey(): string {
  return crypto.randomUUID();
}

function normalizeHttpsUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^[a-z]+:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function sourceFromUrl(url: string): MenuSource {
  return isDriveMenuUrl(url) ? "drive" : "upload";
}

function draftsFromLinks(links: MenuEntry[]): MenuDraft[] {
  return links
    .map((m): MenuDraft | null => {
      const name = m.name.trim();
      const url = m.url.trim();
      // Keep source-only drafts (picker chosen, file/link not yet set).
      if (!name && !url && !m.source) return null;
      return {
        key: newKey(),
        name: m.name,
        url: m.url,
        source: m.source ?? (url ? sourceFromUrl(url) : null),
      };
    })
    .filter((m): m is MenuDraft => m != null);
}

function linksFromDrafts(items: MenuDraft[]): MenuEntry[] {
  // Source rides along in form state so Save can validate Drive rows;
  // EditPlaceForm strips it before calling the EF.
  return items.map((m) => ({ name: m.name, url: m.url, source: m.source }));
}

function menuNumberSuffix(index: number): string {
  return index === 0 ? "" : ` ${index + 1}`;
}

export function PlaceMenuFields({
  projectId,
  form,
  set,
  onError,
}: {
  projectId: string;
  form: PlaceFormState;
  set: SetPlaceForm;
  onError: (msg: string | null) => void;
}) {
  const supabase = useBrowserSupabase();
  // Local drafts carry the exclusive Upload/Drive source; form.menu_links
  // mirrors them (including source for Save validation). Parent remounts
  // this component (via key) on Discard so drafts rehydrate cleanly.
  const [items, setItems] = useState<MenuDraft[]>(() =>
    draftsFromLinks(form.menu_links),
  );
  // Updated only inside commit() so rapid New menu / patch clicks never
  // race on a stale render-scoped `items` snapshot (and never during render).
  const itemsRef = useRef(items);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetKey = useRef<string | null>(null);

  const commit = (updater: (prev: MenuDraft[]) => MenuDraft[]) => {
    const next = updater(itemsRef.current);
    itemsRef.current = next;
    setItems(next);
    set("menu_links", linksFromDrafts(next));
  };

  const patchItem = (
    key: string,
    patch: Partial<Pick<MenuDraft, "name" | "url" | "source">>,
  ) => {
    commit((prev) =>
      prev.map((m) => (m.key === key ? { ...m, ...patch } : m)),
    );
  };

  const setSource = (key: string, source: MenuSource) => {
    commit((prev) =>
      prev.map((m) => {
        if (m.key !== key) return m;
        if (m.source === source) return m;
        // Switching path clears the other — upload XOR drive, never both.
        return { ...m, source, url: "" };
      }),
    );
  };

  const removeItem = (key: string) => {
    commit((prev) => prev.filter((m) => m.key !== key));
  };

  const addMenu = () => {
    commit((prev) => [
      ...prev,
      { key: newKey(), name: "", url: "", source: null },
    ]);
  };

  const startUpload = (key: string) => {
    uploadTargetKey.current = key;
    fileInputRef.current?.click();
  };

  const onFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    const key = uploadTargetKey.current;
    uploadTargetKey.current = null;
    if (!file || !key || uploadingKey) return;

    const fileError = validateMenuUploadFile(file);
    if (fileError) {
      onError(fileError);
      return;
    }

    setUploadingKey(key);
    onError(null);
    try {
      const bucket = bucketForMenuFile(file);
      const path = placeMenuObjectPath(projectId, file);
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, file, {
          upsert: false,
          contentType: file.type,
          cacheControl: "31536000",
        });
      if (uploadError) throw new Error(uploadError.message);
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      if (!data?.publicUrl) {
        throw new Error("Couldn't get a public URL for the upload.");
      }
      const baseName = file.name
        .replace(/\.[^.]+$/, "")
        .trim()
        .slice(0, MENU_NAME_MAX_LENGTH);
      commit((prev) =>
        prev.map((m) =>
          m.key === key
            ? {
                ...m,
                source: "upload",
                url: data.publicUrl,
                name: m.name.trim() || baseName,
              }
            : m,
        ),
      );
      onError(null);
    } catch (err) {
      onError(errMsg(err, "Couldn't upload catalog file."));
    } finally {
      setUploadingKey(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-[12px] leading-snug">
        Add menus shown to consumers. For each menu, choose Upload or Drive —
        not both.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_MENU_ACCEPT}
        className="hidden"
        onChange={onFilePicked}
      />

      {items.length === 0 ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-muted-foreground text-[13px]">No menus yet.</p>
          <button
            type="button"
            disabled={uploadingKey != null}
            onClick={addMenu}
            className="border-border hover:border-primary/50 hover:text-primary inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium transition disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            New menu
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item, idx) => (
            <MenuItemCard
              key={item.key}
              index={idx}
              item={item}
              uploading={uploadingKey === item.key}
              onPatch={(patch) => patchItem(item.key, patch)}
              onSource={(source) => setSource(item.key, source)}
              onRemove={() => removeItem(item.key)}
              onUpload={() => startUpload(item.key)}
            />
          ))}
          <button
            type="button"
            disabled={uploadingKey != null}
            onClick={addMenu}
            className="border-border hover:border-primary/50 hover:text-primary inline-flex h-9 w-fit items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium transition disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            New menu
          </button>
        </div>
      )}
    </div>
  );
}

function MenuItemCard({
  index,
  item,
  uploading,
  onPatch,
  onSource,
  onRemove,
  onUpload,
}: {
  index: number;
  item: MenuDraft;
  uploading: boolean;
  onPatch: (patch: Partial<Pick<MenuDraft, "name" | "url">>) => void;
  onSource: (source: MenuSource) => void;
  onRemove: () => void;
  onUpload: () => void;
}) {
  const hasFile = item.source === "upload" && item.url.trim() !== "";
  const hasDrive = item.source === "drive" && item.url.trim() !== "";
  const isNew = !item.name.trim() && !item.url.trim() && item.source == null;

  return (
    <div className="border-border/60 bg-muted/30 rounded-xl border p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText className="text-muted-foreground h-4 w-4" />
          <span className="text-[13px] font-semibold">
            {isNew ? "New menu" : `Menu${menuNumberSuffix(index)}`}
          </span>
        </div>
        <button
          type="button"
          disabled={uploading}
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive inline-flex h-8 w-8 items-center justify-center rounded-md transition disabled:opacity-50"
          aria-label="Remove menu"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <PlaceFormField label="Menu name">
        <input
          type="text"
          value={item.name}
          onChange={(e) =>
            onPatch({ name: e.target.value.slice(0, MENU_NAME_MAX_LENGTH) })
          }
          placeholder="Dinner menu"
          maxLength={MENU_NAME_MAX_LENGTH}
          disabled={uploading}
          className={INPUT}
        />
      </PlaceFormField>

      <div className="mt-4">
        <p className="text-[13px] font-medium">How do you want to add it?</p>
        <p className="text-muted-foreground mt-0.5 text-[11px]">
          Pick one — upload a file or paste a Drive link, not both.
        </p>
        <div
          role="radiogroup"
          aria-label="Menu source"
          className="mt-3 grid gap-2 sm:grid-cols-2"
        >
          <SourceCard
            active={item.source === "upload"}
            disabled={uploading}
            icon={<Upload className="h-4 w-4" />}
            label="Upload file"
            hint="PDF or image · max 8 MB"
            onClick={() => onSource("upload")}
          />
          <SourceCard
            active={item.source === "drive"}
            disabled={uploading}
            icon={<Link2 className="h-4 w-4" />}
            label="Google Drive"
            hint="Paste a share link"
            onClick={() => onSource("drive")}
          />
        </div>
      </div>

      {item.source === "upload" ? (
        <div className="border-border bg-muted/20 mt-3 rounded-xl border border-dashed p-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={uploading}
              onClick={onUpload}
              className="bg-foreground text-background inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  {hasFile ? "Replace file" : "Choose file"}
                </>
              )}
            </button>
            {hasFile ? (
              <>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-secondary inline-flex items-center gap-1.5 text-[13px] font-medium hover:underline"
                >
                  Open file <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => onPatch({ url: "" })}
                  className="text-muted-foreground hover:text-destructive text-[11px] font-medium"
                >
                  Clear file
                </button>
              </>
            ) : (
              <p className="text-muted-foreground text-[11px]">
                JPG, PNG, WEBP, AVIF, or PDF · max 8 MB
              </p>
            )}
          </div>
          {hasFile ? <MenuFilePreview key={item.url} url={item.url} /> : null}
        </div>
      ) : item.source === "drive" ? (
        <div className="border-border bg-muted/20 mt-3 rounded-xl border border-dashed p-4">
          <PlaceFormField label="Drive link">
            <input
              type="url"
              value={item.url}
              onChange={(e) => onPatch({ url: e.target.value })}
              placeholder="https://drive.google.com/…"
              spellCheck={false}
              autoCapitalize="none"
              disabled={uploading}
              className={INPUT}
            />
          </PlaceFormField>
          {hasDrive && /^https:\/\//i.test(normalizeHttpsUrl(item.url)) ? (
            <>
              <a
                href={normalizeHttpsUrl(item.url)}
                target="_blank"
                rel="noreferrer"
                className="text-secondary mt-2 inline-flex w-fit items-center gap-1.5 text-[13px] font-medium hover:underline"
              >
                Open link <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <MenuFilePreview
                key={normalizeHttpsUrl(item.url)}
                url={normalizeHttpsUrl(item.url)}
              />
            </>
          ) : (
            <p className="text-muted-foreground mt-2 text-[11px]">
              Google Drive or Docs share link only
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Compact thumbnail / embed for the uploaded or shared menu file. */
function MenuFilePreview({ url }: { url: string }) {
  const kind = detectMenuFileKind(url);
  const src = normalizeHttpsUrl(url);
  // pdf.js couldn't parse the document — fall back to the browser iframe.
  const [pdfFailed, setPdfFailed] = useState(false);

  if (kind === "image") {
    return (
      <div className="border-border/60 bg-background mt-3 overflow-hidden rounded-lg border">
        {/* eslint-disable-next-line @next/next/no-img-element -- remote Storage URL; sizes unknown */}
        <img
          src={src}
          alt="Menu preview"
          className="mx-auto max-h-48 w-full object-contain p-2"
        />
      </div>
    );
  }

  if (kind === "drive") {
    const preview = drivePreviewUrl(src);
    if (!preview) {
      return (
        <p className="text-muted-foreground mt-3 text-[11px]">
          Preview unavailable for this Drive link — open it to view.
        </p>
      );
    }
    return (
      <div className="border-border/60 bg-background mt-3 overflow-hidden rounded-lg border">
        <iframe
          title="Drive menu preview"
          src={preview}
          className="bg-background h-52 w-full border-0"
          allow="autoplay"
        />
      </div>
    );
  }

  if (pdfFailed) {
    return (
      <div className="border-border/60 bg-background mt-3 overflow-hidden rounded-lg border">
        <iframe
          title="PDF menu preview"
          src={src}
          className="h-52 w-full border-0 bg-white"
        />
      </div>
    );
  }

  return (
    <PdfFirstPage
      url={src}
      onError={() => setPdfFailed(true)}
      className="border-border/60 bg-background mt-3 overflow-hidden rounded-lg border"
    />
  );
}

function SourceCard({
  active,
  disabled,
  icon,
  label,
  hint,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onClick}
      className={
        "flex items-start gap-3 rounded-xl border p-3.5 text-left transition disabled:opacity-50 " +
        (active
          ? "border-pink-400/60 bg-card ring-1 ring-pink-400/30"
          : "border-border bg-card hover:border-foreground/40")
      }
    >
      <span
        className={
          "mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg " +
          (active
            ? "bg-pink-gradient text-white shadow-sm"
            : "bg-muted text-muted-foreground")
        }
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold">{label}</span>
        <span className="text-muted-foreground mt-0.5 block text-[11px] leading-snug">
          {hint}
        </span>
      </span>
    </button>
  );
}
