"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import {
  ExternalLink,
  FileText,
  Loader2,
  Plus,
  Trash2,
  Upload,
  UtensilsCrossed,
} from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import {
  ALLOWED_MENU_ACCEPT,
  isDriveMenuUrl,
  PLACE_IMAGES_BUCKET,
  placeMenuObjectPath,
  validateMenuUploadFile,
} from "@/lib/place-upload-utils";
import { updatePlace, type AdminMenuItem, type AdminPlace } from "../actions";
import { ErrorNote, SaveBar, SectionCard, TextField } from "../ui";

const MENU_NAME_MAX = 80;

type MenuDraft = {
  key: string;
  name: string;
  url: string;
};

type ItemKind = "menu";

const ITEM_KINDS: { id: ItemKind; label: string; hint: string }[] = [
  {
    id: "menu",
    label: "Menu",
    hint: "PDF upload or Google Drive link",
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

function menusFromPlace(place: AdminPlace): MenuDraft[] {
  const fromProducts = Array.isArray(place.products?.menu)
    ? place.products.menu
    : [];
  const fromLegacy = Array.isArray(place.menus) ? place.menus : [];
  const source: AdminMenuItem[] =
    fromProducts.length > 0 ? fromProducts : fromLegacy;

  const fromJson = source
    .map((m) => {
      const url =
        typeof m?.url === "string"
          ? m.url.trim()
          : typeof (m as { pdf_url?: unknown })?.pdf_url === "string"
            ? String((m as { pdf_url: string }).pdf_url).trim()
            : "";
      const name = typeof m?.name === "string" ? m.name.trim() : "";
      if (!url && !name) return null;
      return { key: newKey(), name, url };
    })
    .filter((m): m is MenuDraft => m != null);

  if (fromJson.length > 0) return fromJson;

  // Legacy single-slot columns (pre-products.menu).
  if (place.menu_pdf_url?.trim() || place.menu_pdf_name?.trim()) {
    return [
      {
        key: newKey(),
        name: place.menu_pdf_name?.trim() ?? "",
        url: place.menu_pdf_url?.trim() ?? "",
      },
    ];
  }
  return [];
}

function serializeMenus(items: MenuDraft[]): AdminMenuItem[] {
  return items
    .map((m) => ({
      name: m.name.trim() ? m.name.trim().slice(0, MENU_NAME_MAX) : null,
      url: m.url.trim() || null,
    }))
    .filter((m) => m.url);
}

export function ProductsSection({
  place,
  onSaved,
}: {
  place: AdminPlace;
  onSaved: (v: AdminPlace) => void;
}) {
  // Parent remounts this section with key={place.id} when the operator switches
  // units, so initial state is always the active place's product items.
  const [items, setItems] = useState<MenuDraft[]>(() => menusFromPlace(place));
  const [saved, setSaved] = useState<MenuDraft[]>(items);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetKey = useRef<string | null>(null);

  const dirty = useMemo(() => {
    const a = serializeMenus(items);
    const b = serializeMenus(saved);
    if (a.length !== b.length) return true;
    return a.some(
      (m, i) => (m.name ?? "") !== (b[i]?.name ?? "") || (m.url ?? "") !== (b[i]?.url ?? ""),
    );
  }, [items, saved]);

  const patchItem = (key: string, patch: Partial<Pick<MenuDraft, "name" | "url">>) => {
    setItems((prev) =>
      prev.map((m) => (m.key === key ? { ...m, ...patch } : m)),
    );
    setOk(false);
  };

  const removeItem = (key: string) => {
    setItems((prev) => prev.filter((m) => m.key !== key));
    setOk(false);
  };

  const addMenu = () => {
    setItems((prev) => [...prev, { key: newKey(), name: "", url: "" }]);
    setPickerOpen(false);
    setOk(false);
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
      const { error: uploadError } = await supabase.storage
        .from(PLACE_IMAGES_BUCKET)
        .upload(path, file, {
          upsert: false,
          contentType: file.type,
          cacheControl: "31536000",
        });
      if (uploadError) throw new Error(uploadError.message);
      const { data } = supabase.storage.from(PLACE_IMAGES_BUCKET).getPublicUrl(path);
      if (!data?.publicUrl) {
        throw new Error("Upload succeeded but no public URL was returned.");
      }
      const baseName = file.name.replace(/\.[^.]+$/, "").trim().slice(0, MENU_NAME_MAX);
      setItems((prev) =>
        prev.map((m) =>
          m.key === key
            ? {
                ...m,
                url: data.publicUrl,
                name: m.name.trim() || baseName,
              }
            : m,
        ),
      );
      setOk(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload that file.");
    } finally {
      setUploadingKey(null);
    }
  };

  const save = () => {
    if (!dirty) return;
    for (const m of items) {
      const trimmed = m.url.trim();
      if (!trimmed) continue;
      const normalized = normalizeHttpsUrl(trimmed);
      if (!/^https:\/\//i.test(normalized)) {
        setError("Each menu needs a valid https:// URL (Drive link or uploaded file).");
        return;
      }
    }
    const menu = serializeMenus(
      items.map((m) => ({
        ...m,
        url: m.url.trim() ? normalizeHttpsUrl(m.url) : "",
      })),
    );
    const first = menu[0] ?? null;
    setError(null);
    setOk(false);
    start(async () => {
      const r = await updatePlace({
        id: place.id,
        products: { menu },
        // Keep legacy single-slot columns in sync for older surfaces.
        menu_pdf_url: first?.url ?? null,
        menu_pdf_name: first?.name ?? null,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      const next = menusFromPlace(r.data);
      setItems(next);
      setSaved(next);
      onSaved(r.data);
      setOk(true);
    });
  };

  return (
    <SectionCard
      icon={<UtensilsCrossed className="text-muted-foreground h-4 w-4" />}
      title="Products"
      subtitle="Add menus and other product items shown to consumers. Menu = PDF upload or Google Drive link."
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
          <p className="text-muted-foreground text-sm">No items yet.</p>
          <AddItemsControl
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            onPick={onPickKind}
            disabled={pending}
          />
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-4">
          {items.map((item, idx) => (
            <MenuItemCard
              key={item.key}
              index={idx}
              item={item}
              pending={pending}
              uploading={uploadingKey === item.key}
              onPatch={(patch) => patchItem(item.key, patch)}
              onRemove={() => removeItem(item.key)}
              onUpload={() => startUpload(item.key)}
            />
          ))}
          <AddItemsControl
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            onPick={onPickKind}
            disabled={pending || uploadingKey != null}
          />
        </div>
      )}

      {error ? <ErrorNote message={error} /> : null}
      {items.length > 0 || dirty ? (
        <SaveBar pending={pending} dirty={dirty} ok={ok} onSave={save} />
      ) : null}
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
  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onOpenChange(!open)}
        className="border-border hover:border-foreground/40 inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition disabled:opacity-50"
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
          <div className="border-border bg-card absolute top-full left-0 z-20 mt-1 min-w-56 overflow-hidden rounded-xl border shadow-md">
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
  onRemove,
  onUpload,
}: {
  index: number;
  item: MenuDraft;
  pending: boolean;
  uploading: boolean;
  onPatch: (patch: Partial<Pick<MenuDraft, "name" | "url">>) => void;
  onRemove: () => void;
  onUpload: () => void;
}) {
  const hasUploadedFile = item.url.trim() !== "" && !isDriveMenuUrl(item.url);
  const linkValue =
    isDriveMenuUrl(item.url) || !hasUploadedFile ? item.url : "";

  return (
    <div className="border-border bg-background rounded-xl border p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText className="text-muted-foreground h-4 w-4" />
          <span className="text-sm font-semibold">
            Menu{itemsLabel(index)}
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

      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label="Menu name"
          value={item.name}
          onChange={(v) => onPatch({ name: v.slice(0, MENU_NAME_MAX) })}
          placeholder="Dinner menu"
          maxLength={MENU_NAME_MAX}
          disabled={pending || uploading}
        />
        <TextField
          label="Drive link"
          value={linkValue}
          onChange={(v) => onPatch({ url: v })}
          placeholder="https://drive.google.com/…"
          disabled={pending || uploading}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending || uploading}
          onClick={onUpload}
          className="border-border hover:border-foreground/40 inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition disabled:opacity-50"
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading…
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              {hasUploadedFile ? "Replace PDF" : "Upload PDF"}
            </>
          )}
        </button>
        {hasUploadedFile ? (
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
              onClick={() => onPatch({ url: "" })}
              className="text-muted-foreground hover:text-destructive text-xs font-medium"
            >
              Clear file
            </button>
          </>
        ) : item.url.trim() && /^https:\/\//i.test(normalizeHttpsUrl(item.url)) ? (
          <a
            href={normalizeHttpsUrl(item.url)}
            target="_blank"
            rel="noreferrer"
            className="text-secondary inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
          >
            Open link <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : null}
        <p className="text-muted-foreground text-xs">
          PDF or image · max 8 MB · or paste a Drive link
        </p>
      </div>
    </div>
  );
}

function itemsLabel(index: number): string {
  return index === 0 ? "" : ` ${index + 1}`;
}
