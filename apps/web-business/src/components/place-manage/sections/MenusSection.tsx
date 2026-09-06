"use client";

import { useMemo, useRef, useState } from "react";
import {
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  Plus,
  Trash2,
  Upload,
  UtensilsCrossed,
} from "lucide-react";
import { PdfFirstPage } from "@/components/PdfFirstPage";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import {
  ALLOWED_MENU_ACCEPT,
  bucketForMenuFile,
  detectMenuFileKind,
  drivePreviewUrl,
  isDriveMenuUrl,
  MENU_MAX_COUNT,
  placeMenuObjectPath,
  removeOrphanMenuStorageObjects,
  validateMenuUploadFile,
} from "@/lib/place-upload-utils";
import { type AdminMenuItem, type AdminPlace } from "../actions";
import { usePlaceContext, type PatchResult } from "../PlaceContext";
import { useSectionSaver } from "../useSectionDirty";
import { SectionCard, TextField } from "@/components/admin-ui/manage";
import { ErrorNote } from "@/components/ErrorNote";

const MENU_NAME_MAX = 80;

type MenuSource = "upload" | "drive";

type MenuDraft = {
  key: string;
  name: string;
  url: string;
  /** Exclusive source — upload file XOR Drive link. Null until the operator picks. */
  source: MenuSource | null;
};

type ItemKind = "menu";

const ITEM_KINDS: { id: ItemKind; label: string; hint: string }[] = [
  {
    id: "menu",
    label: "Menu",
    hint: "Upload a PDF/image, or paste a Drive link — pick one",
  },
];

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

function menusFromPlace(place: AdminPlace): MenuDraft[] {
  const fromProducts = Array.isArray(place.products?.menu)
    ? place.products.menu
    : [];
  const fromLegacy = Array.isArray(place.menus) ? place.menus : [];
  const source: AdminMenuItem[] =
    fromProducts.length > 0 ? fromProducts : fromLegacy;

  const fromJson = source
    .map((m): MenuDraft | null => {
      const legacyPdfUrl = (m as { pdf_url?: unknown })?.pdf_url;
      const legacySourceUrl = (m as { source_url?: unknown })?.source_url;
      const url =
        typeof m?.url === "string"
          ? m.url.trim()
          : typeof legacyPdfUrl === "string"
            ? legacyPdfUrl.trim()
            : typeof legacySourceUrl === "string"
              ? legacySourceUrl.trim()
              : "";
      const name = typeof m?.name === "string" ? m.name.trim() : "";
      if (!url && !name) return null;
      return { key: newKey(), name, url, source: sourceFromUrl(url) };
    })
    .filter((m): m is MenuDraft => m != null);

  if (fromJson.length > 0) return fromJson;

  // Legacy single-slot columns (pre-products.menu).
  if (place.menu_pdf_url?.trim() || place.menu_pdf_name?.trim()) {
    const url = place.menu_pdf_url?.trim() ?? "";
    return [
      {
        key: newKey(),
        name: place.menu_pdf_name?.trim() ?? "",
        url,
        source: sourceFromUrl(url),
      },
    ];
  }
  return [];
}

function serializeMenus(items: MenuDraft[]): AdminMenuItem[] {
  return items
    .map((m) => {
      const name = m.name.trim();
      return {
        name: name ? name.slice(0, MENU_NAME_MAX) : null,
        url: m.url.trim() || null,
      };
    })
    .filter((m) => m.url);
}

export function MenusSection({
  place,
}: {
  place: AdminPlace;
}) {
  // Parent remounts this section with key={place.id} when the operator switches
  // places, so initial state is always the active place's product items.
  const [items, setItems] = useState<MenuDraft[]>(() => menusFromPlace(place));
  const [saved, setSaved] = useState<MenuDraft[]>(items);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetKey = useRef<string | null>(null);
  // Public URLs uploaded this editing session but not yet in the last-saved
  // set — cleaned up on Cancel/Discard, or if Save drops them.
  const sessionUploadsRef = useRef<Set<string>>(new Set());

  const dirty = useMemo(() => {
    // Incomplete drafts (source chosen, no file/link yet) count as dirty so
    // the nav guard still runs and can drain session uploads.
    if (items.some((m) => m.source != null && !m.url.trim())) return true;
    if (items.some((m) => !m.source && !m.url.trim() && !m.name.trim())) {
      // Brand-new empty rows — dirty until removed or filled.
      if (items.length !== saved.length) return true;
    }
    const a = serializeMenus(items);
    const b = serializeMenus(saved);
    if (a.length !== b.length) return true;
    return a.some(
      (m, i) => (m.name ?? "") !== (b[i]?.name ?? "") || (m.url ?? "") !== (b[i]?.url ?? ""),
    );
  }, [items, saved]);

  /** Drop a never-saved Storage object immediately (Clear / Remove / switch). */
  const releaseSessionUrl = (url: string) => {
    const trimmed = url.trim();
    if (!trimmed || !sessionUploadsRef.current.has(trimmed)) return;
    sessionUploadsRef.current.delete(trimmed);
    void removeOrphanMenuStorageObjects(
      createBrowserSupabase(),
      [trimmed],
      [],
    );
  };

  const patchItem = (
    key: string,
    patch: Partial<Pick<MenuDraft, "name" | "url" | "source">>,
  ) => {
    setItems((prev) =>
      prev.map((m) => (m.key === key ? { ...m, ...patch } : m)),
    );
  };

  const clearUpload = (key: string) => {
    const prevUrl = items.find((m) => m.key === key)?.url.trim() ?? "";
    releaseSessionUrl(prevUrl);
    patchItem(key, { url: "" });
  };

  const setSource = (key: string, source: MenuSource) => {
    const prev = items.find((m) => m.key === key);
    if (!prev || prev.source === source) return;
    // Switching path clears the other — upload XOR drive, never both.
    releaseSessionUrl(prev.url);
    setItems((list) =>
      list.map((m) =>
        m.key === key ? { ...m, source, url: "" } : m,
      ),
    );
  };

  const removeItem = (key: string) => {
    const prevUrl = items.find((m) => m.key === key)?.url.trim() ?? "";
    releaseSessionUrl(prevUrl);
    setItems((prev) => prev.filter((m) => m.key !== key));
  };

  const addMenu = () => {
    if (items.length >= MENU_MAX_COUNT) {
      setError(`At most ${MENU_MAX_COUNT} menus per place.`);
      return;
    }
    setItems((prev) => [
      ...prev,
      { key: newKey(), name: "", url: "", source: null },
    ]);
    setPickerOpen(false);
  };

  const onPickKind = (kind: ItemKind) => {
    if (kind === "menu") addMenu();
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
      setError(fileError);
      return;
    }

    setUploadingKey(key);
    setError(null);
    try {
      const supabase = createBrowserSupabase();
      const path = placeMenuObjectPath(place.id, file);
      const bucket = bucketForMenuFile(file);
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
        throw new Error("Upload succeeded but no public URL was returned.");
      }
      const baseName = file.name.replace(/\.[^.]+$/, "").trim().slice(0, MENU_NAME_MAX);
      const prevUrl =
        items.find((m) => m.key === key)?.url.trim() ?? "";
      setItems((prev) =>
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
      sessionUploadsRef.current.add(data.publicUrl);
      // Replacing a never-saved upload — drop the previous object now.
      if (prevUrl && sessionUploadsRef.current.has(prevUrl)) {
        sessionUploadsRef.current.delete(prevUrl);
        void removeOrphanMenuStorageObjects(supabase, [prevUrl], []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload that file.");
    } finally {
      setUploadingKey(null);
    }
  };

  // Cancel — restore last-saved menus and delete never-saved uploads.
  // Validate + build, no I/O. The page-level save calls this, merges the patch
  // with every other dirty box and writes them in one call, so a bad menu here
  // stops the whole save rather than letting the other boxes through.
  const { savePending } = usePlaceContext();

  const buildPatch = (): PatchResult => {
    if (!dirty) return { kind: "clean" };
    for (const m of items) {
      const trimmed = m.url.trim();
      if (!trimmed) {
        // Block incomplete drafts — don't silently drop a chosen source.
        if (m.source) {
          return {
            kind: "invalid",
            error:
              m.source === "drive"
                ? "Each Drive menu needs a Google Drive or Docs share link."
                : "Each uploaded menu needs a file.",
          };
        }
        continue;
      }
      const normalized = normalizeHttpsUrl(trimmed);
      if (!/^https:\/\//i.test(normalized)) {
        return {
          kind: "invalid",
          error:
            "Each menu needs a valid https:// URL (Drive link or uploaded file).",
        };
      }
      if (m.source === "drive" && !isDriveMenuUrl(normalized)) {
        return { kind: "invalid", error: "Drive menus need a Google Drive or Docs link." };
      }
      if (!m.source) {
        return {
          kind: "invalid",
          error: "Each menu needs a source — Upload file or Google Drive.",
        };
      }
    }
    const menu = serializeMenus(
      items.map((m) => ({
        ...m,
        url: m.url.trim() ? normalizeHttpsUrl(m.url) : "",
      })),
    );
    const first = menu[0] ?? null;
    return {
      kind: "patch",
      patch: {
        // Preserve sibling products keys (e.g. reservations routing).
        products: { ...(place.products ?? {}), menu },
        // Keep legacy single-slot columns in sync for older surfaces.
        menu_pdf_url: first?.url ?? null,
        menu_pdf_name: first?.name ?? null,
      },
    };
  };

  // Storage cleanup still belongs to this box: only it knows which objects it
  // uploaded this session and which the save actually kept.
  const afterSaved = (fresh: AdminPlace) => {
    const next = menusFromPlace(fresh);
    const keep = next.map((m) => m.url);
    const previous = saved.map((m) => m.url);
    const session = [...sessionUploadsRef.current];
    sessionUploadsRef.current = new Set();
    void removeOrphanMenuStorageObjects(
      createBrowserSupabase(),
      [...previous, ...session],
      keep,
    );
    setItems(next);
    setSaved(next);
    setError(null);
  };

  useSectionSaver(
    "products",
    dirty,
    buildPatch,
    afterSaved,
    () => {
      const next = menusFromPlace(place);
      const keep = next.map((m) => m.url);
      const orphans = [...sessionUploadsRef.current];
      sessionUploadsRef.current = new Set();
      void removeOrphanMenuStorageObjects(
        createBrowserSupabase(),
        orphans,
        keep,
      );
      setItems(next);
      setSaved(next);
      setError(null);
    },
  );

  return (
    <SectionCard
      id="place-products"
      icon={<UtensilsCrossed className="h-4 w-4" />}
      // teal, not orange: Photos sits directly above this box in the same
      // masonry column and was also orange, which is the one thing the tint
      // palette's own contract asks you not to do ("keep sibling cards on
      // different tints").
      tint="teal"
      title="Menus"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_MENU_ACCEPT}
        className="hidden"
        onChange={onFilePicked}
      />

      {items.length === 0 ? (
        <div className="mt-6 flex flex-col items-start gap-3">
          <p className="text-muted-foreground text-sm">No menus yet.</p>
          <button
            type="button"
            disabled={savePending}
            onClick={addMenu}
            className="border-border hover:border-primary/50 hover:text-primary inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            New menu
          </button>
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-4">
          {items.map((item, idx) => (
            <MenuItemCard
              key={item.key}
              index={idx}
              item={item}
              pending={savePending}
              uploading={uploadingKey === item.key}
              onPatch={(patch) => patchItem(item.key, patch)}
              onClearUpload={() => clearUpload(item.key)}
              onSource={(source) => setSource(item.key, source)}
              onRemove={() => removeItem(item.key)}
              onUpload={() => startUpload(item.key)}
            />
          ))}
          <AddItemsControl
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            onPick={onPickKind}
            disabled={
              savePending ||
              uploadingKey != null ||
              items.length >= MENU_MAX_COUNT
            }
          />
        </div>
      )}

            {error ? <ErrorNote message={error} /> : null}
    </SectionCard>
  );
}

function AddItemsControl({
  open,
  onOpenChange,
  onPick,
  disabled,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (kind: ItemKind) => void;
  disabled?: boolean;
}) {
  // Only one kind today — still keep the picker shell for future product types.
  if (ITEM_KINDS.length === 1) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => onPick(ITEM_KINDS[0].id)}
        className="border-border hover:border-primary/50 hover:text-primary inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition disabled:opacity-50"
      >
        <Plus className="h-4 w-4" />
        New menu
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onOpenChange(!open)}
        className="border-border hover:border-primary/50 hover:text-primary inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition disabled:opacity-50"
      >
        <Plus className="h-4 w-4" />
        Add items
      </button>
      {open ? (
        <>
          <button
            type="button"
            aria-label="Close"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => onOpenChange(false)}
          />
          <div className="border-border bg-card absolute top-full left-0 z-20 mt-1 min-w-56 overflow-hidden rounded-xl border shadow-card">
            {ITEM_KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => onPick(k.id)}
                className="hover:bg-muted flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left transition"
              >
                <span className="text-sm font-medium">{k.label}</span>
                <span className="text-muted-foreground text-xs">{k.hint}</span>
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function MenuItemCard({
  index,
  item,
  pending,
  uploading,
  onPatch,
  onClearUpload,
  onSource,
  onRemove,
  onUpload,
}: {
  index: number;
  item: MenuDraft;
  pending: boolean;
  uploading: boolean;
  onPatch: (patch: Partial<Pick<MenuDraft, "name" | "url">>) => void;
  onClearUpload: () => void;
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
          <span className="text-sm font-semibold">
            {isNew ? "New menu" : `Menu${menuNumberSuffix(index)}`}
          </span>
        </div>
        <button
          type="button"
          disabled={pending || uploading}
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive inline-flex h-8 w-8 items-center justify-center rounded-md transition disabled:opacity-50"
          aria-label="Remove menu"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <TextField
        label="Menu name"
        value={item.name}
        onChange={(v) => onPatch({ name: v.slice(0, MENU_NAME_MAX) })}
        placeholder="Dinner menu"
        maxLength={MENU_NAME_MAX}
        disabled={pending || uploading}
      />

      <div className="mt-4">
        <p className="text-sm font-medium">How do you want to add it?</p>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Pick one — upload a file or paste a Drive link, not both.
        </p>
        <div
          role="radiogroup"
          aria-label="Menu source"
          className="mt-3 grid gap-2 sm:grid-cols-2"
        >
          <SourceCard
            active={item.source === "upload"}
            disabled={pending || uploading}
            icon={<Upload className="h-4 w-4" />}
            label="Upload file"
            hint="PDF or image · max 8 MB"
            onClick={() => onSource("upload")}
          />
          <SourceCard
            active={item.source === "drive"}
            disabled={pending || uploading}
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
              disabled={pending || uploading}
              onClick={onUpload}
              className="bg-foreground text-background inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition disabled:opacity-50"
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
                  className="text-secondary inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
                >
                  Open file <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <button
                  type="button"
                  disabled={pending || uploading}
                  onClick={onClearUpload}
                  className="text-muted-foreground hover:text-destructive text-xs font-medium"
                >
                  Clear file
                </button>
              </>
            ) : (
              <p className="text-muted-foreground text-xs">
                JPG, PNG, WEBP, AVIF, or PDF · max 8 MB
              </p>
            )}
          </div>
          {/* Keyed by URL so a failed-parse fallback resets on file replace. */}
          {hasFile ? <MenuFilePreview key={item.url} url={item.url} /> : null}
        </div>
      ) : item.source === "drive" ? (
        <div className="border-border bg-muted/20 mt-3 rounded-xl border border-dashed p-4">
          <TextField
            label="Drive link"
            value={item.url}
            onChange={(v) => onPatch({ url: v })}
            placeholder="https://drive.google.com/…"
            disabled={pending || uploading}
          />
          {hasDrive && /^https:\/\//i.test(normalizeHttpsUrl(item.url)) ? (
            <>
              <a
                href={normalizeHttpsUrl(item.url)}
                target="_blank"
                rel="noreferrer"
                className="text-secondary mt-2 inline-flex w-fit items-center gap-1.5 text-sm font-medium hover:underline"
              >
                Open link <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <MenuFilePreview url={normalizeHttpsUrl(item.url)} />
            </>
          ) : (
            <p className="text-muted-foreground mt-2 text-xs">
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
        <p className="text-muted-foreground mt-3 text-xs">
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
          (active ? "bg-pink-gradient text-white shadow-card" : "bg-muted text-muted-foreground")
        }
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="text-muted-foreground mt-0.5 block text-xs leading-snug">
          {hint}
        </span>
      </span>
    </button>
  );
}

function menuNumberSuffix(index: number): string {
  return index === 0 ? "" : ` ${index + 1}`;
}
