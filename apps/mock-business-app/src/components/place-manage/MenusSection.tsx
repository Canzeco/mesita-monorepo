"use client";

// A SNAPSHOT of apps/web-business/src/components/place-manage/sections/
// MenusSection.tsx — the menus card, back on Profile (MESITA-1917).
//
// One menu is a NAME plus exactly one source: a file the operator uploads, or
// a Google Drive link they paste. Never both — the two radio cards are
// exclusive because the record holds one URL, and a card that let you fill
// both would have to silently pick a winner at save.
//
// TWO THINGS ARE DIFFERENT, and both are the absent backend:
//
//   1. An upload never leaves the tab (a FileReader data URI), as on the
//      Photos card. There it is a Storage PUT into `menu-pdfs`/`menu-images`,
//      and a save also sweeps the objects the edit orphaned.
//   2. NO FILE PREVIEW. The real card renders the menu — a remote image, a
//      Drive `/preview` iframe, or the PDF's first page through pdf.js. Every
//      one of those is a request, and this app makes none. The link is here;
//      the picture of it is not.

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
import { SectionCard, TextField } from "@/components/admin-ui/manage";
import { ErrorNote } from "@/components/ErrorNote";
import { usePlaceContext, useSectionSaver } from "./PlaceContext";
import { ALLOWED_MENU_ACCEPT, validateMenuUploadFile } from "@/lib/place-upload-utils";
import { MENU_MAX_COUNT, type MockPlaceProfile, type MockProfileMenu } from "@/mock/types";

const MENU_NAME_MAX = 80;

type MenuSource = "upload" | "drive";

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

function isDriveUrl(url: string): boolean {
  const host = url.trim().toLowerCase();
  return host.includes("drive.google.com") || host.includes("docs.google.com");
}

function menusFromProfile(profile: MockPlaceProfile): MenuDraft[] {
  return profile.menus.map((m) => ({
    key: m.key,
    name: m.name,
    url: m.url,
    source: m.source,
  }));
}

/** Only rows with a URL survive a save — a half-filled draft is work in
 *  progress, not a menu, and persisting it would put a nameless empty row on
 *  the public page. */
function serializeMenus(items: MenuDraft[]): MockProfileMenu[] {
  return items
    .filter((m) => m.url.trim() !== "")
    .map((m) => ({
      key: m.key,
      name: m.name.trim().slice(0, MENU_NAME_MAX),
      url: m.url.trim(),
      source: m.source ?? (isDriveUrl(m.url) ? "drive" : "upload"),
    }));
}

function menuNumberSuffix(index: number): string {
  return index === 0 ? "" : ` ${index + 1}`;
}

function sameMenus(a: MenuDraft[], b: MenuDraft[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function MenusSection({ place }: { place: MockPlaceProfile }) {
  const [items, setItems] = useState<MenuDraft[]>(() => menusFromProfile(place));
  const [saved, setSaved] = useState<MenuDraft[]>(items);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingUploadKey = useRef<string | null>(null);

  const { savePending } = usePlaceContext();
  const dirty = useMemo(() => !sameMenus(items, saved), [items, saved]);

  useSectionSaver(
    "menus",
    "Menus",
    dirty,
    () => {
      if (items.length > MENU_MAX_COUNT) {
        return {
          kind: "invalid" as const,
          error: `At most ${MENU_MAX_COUNT} menus per place.`,
        };
      }
      // A Drive row whose link is not a Drive link is the one shape the real
      // EF rejects outright, so it is refused here rather than saved wrong.
      const badDrive = items.find(
        (m) => m.source === "drive" && m.url.trim() !== "" && !isDriveUrl(m.url),
      );
      if (badDrive) {
        return {
          kind: "invalid" as const,
          error: "Drive menus need a Google Drive or Docs link.",
        };
      }
      if (!dirty) return { kind: "clean" as const };
      return { kind: "patch" as const, patch: { menus: serializeMenus(items) } };
    },
    (fresh) => {
      const next = menusFromProfile(fresh);
      setItems(next);
      setSaved(next);
      setError(null);
    },
    () => {
      const next = menusFromProfile(place);
      setItems(next);
      setSaved(next);
      setError(null);
    },
  );

  const patchItem = (key: string, patch: Partial<Pick<MenuDraft, "name" | "url">>) =>
    setItems((list) => list.map((m) => (m.key === key ? { ...m, ...patch } : m)));

  /** Switching source CLEARS the url. The two are exclusive, so carrying a
   *  Drive link into the upload slot would leave a row whose picked source and
   *  stored value disagree. */
  const setSource = (key: string, source: MenuSource) =>
    setItems((list) =>
      list.map((m) => (m.key === key ? { ...m, source, url: "" } : m)),
    );

  const clearUpload = (key: string) => patchItem(key, { url: "" });

  const removeItem = (key: string) =>
    setItems((list) => list.filter((m) => m.key !== key));

  const addMenu = () => {
    if (items.length >= MENU_MAX_COUNT) {
      setError(`At most ${MENU_MAX_COUNT} menus per place.`);
      return;
    }
    setError(null);
    setItems((list) => [...list, { key: newKey(), name: "", url: "", source: null }]);
  };

  const startUpload = (key: string) => {
    pendingUploadKey.current = key;
    fileInputRef.current?.click();
  };

  const onFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    const key = pendingUploadKey.current;
    pendingUploadKey.current = null;
    if (!file || !key) return;

    const fileError = validateMenuUploadFile(file);
    if (fileError) {
      setError(fileError);
      return;
    }
    setError(null);
    setUploadingKey(key);
    try {
      const dataUrl = await readAsDataUrl(file);
      patchItem(key, { url: dataUrl });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that file.");
    } finally {
      setUploadingKey(null);
    }
  };

  return (
    <SectionCard
      // THE SAME ID THE COMPLETENESS CHIP SCROLLS TO. `ProfileCompleteness`'s
      // "Add a menu" chip looks this element up by name, so renaming it turns
      // that chip into a button that does nothing — silently, which is what
      // MESITA-1883 is about.
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
          <button
            type="button"
            disabled={
              savePending || uploadingKey != null || items.length >= MENU_MAX_COUNT
            }
            onClick={addMenu}
            className="border-border hover:border-primary/50 hover:text-primary inline-flex h-9 w-fit items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            New menu
          </button>
        </div>
      )}

      {error ? <ErrorNote message={error} /> : null}
    </SectionCard>
  );
}

/** A picked file as a data URI — the same reader the Photos card uses, and
 *  for the same reason: nothing here reaches a network. */
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
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
          {hasDrive && isDriveUrl(item.url) ? (
            <a
              href={normalizeHttpsUrl(item.url)}
              target="_blank"
              rel="noreferrer"
              className="text-secondary mt-2 inline-flex w-fit items-center gap-1.5 text-sm font-medium hover:underline"
            >
              Open link <ExternalLink className="h-3.5 w-3.5" />
            </a>
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
        "flex items-start gap-2.5 rounded-xl border p-3 text-left transition disabled:opacity-50 " +
        (active
          ? "border-primary/60 bg-primary/[0.04]"
          : "border-border hover:border-primary/40")
      }
    >
      <span
        className={
          "mt-0.5 shrink-0 " + (active ? "text-primary" : "text-muted-foreground")
        }
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="text-muted-foreground block text-xs">{hint}</span>
      </span>
    </button>
  );
}
