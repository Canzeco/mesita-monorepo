"use client";

import { useState } from "react";
import {
  ExternalLink,
  FileText,
  Loader2,
  Minus,
  Plus,
  Utensils,
  X,
} from "lucide-react";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import {
  drivePreviewUrl,
  menuKindLabel,
  type MenuKind,
} from "@/lib/menu-url";
import { cn } from "@/lib/utils";

export type MenuViewerItem = {
  name: string;
  url: string;
  kind: MenuKind;
};

export function MenuViewer({
  open,
  onClose,
  menu,
}: {
  open: boolean;
  onClose: () => void;
  menu: MenuViewerItem | null;
}) {
  if (!menu) return null;

  return (
    <LocalSheet
      open={open}
      onClose={onClose}
      ariaLabel={`${menu.name} menu`}
      panelClassName="h-[92%] max-h-[92%]"
    >
      {/* key remounts body so zoom/loading reset without an effect */}
      <MenuViewerBody key={menu.url} menu={menu} onClose={onClose} />
    </LocalSheet>
  );
}

function MenuViewerBody({
  menu,
  onClose,
}: {
  menu: MenuViewerItem;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);
  const [embedFailed, setEmbedFailed] = useState(false);

  const previewUrl =
    menu.kind === "drive" ? drivePreviewUrl(menu.url) ?? menu.url : menu.url;
  const kindLabel = menuKindLabel(menu.kind);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-border flex shrink-0 items-center gap-2 border-b px-4 py-3">
        <span className="bg-amber-50 text-amber-700 flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
          {menu.kind === "image" ? (
            <Utensils className="h-4 w-4" strokeWidth={2} />
          ) : (
            <FileText className="h-4 w-4" strokeWidth={2} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display truncate text-[15px] font-semibold tracking-tight">
            {menu.name}
          </p>
          <p className="text-muted-foreground truncate text-[11px]">
            {kindLabel}
            {menu.kind === "drive" ? " · reference preview" : null}
          </p>
        </div>
        <a
          href={menu.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground inline-flex h-9 w-9 items-center justify-center rounded-full transition"
          aria-label="Open externally"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
        <button
          type="button"
          onClick={onClose}
          className="bg-muted text-foreground inline-flex h-9 w-9 items-center justify-center rounded-full transition hover:opacity-90"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="bg-muted/40 relative min-h-0 flex-1 overflow-hidden">
        {menu.kind === "image" ? (
          <ImagePane
            url={menu.url}
            zoom={zoom}
            loading={loading}
            onLoaded={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setEmbedFailed(true);
            }}
          />
        ) : embedFailed ? (
          <EmbedFallback url={menu.url} kind={menu.kind} />
        ) : (
          <iframe
            key={previewUrl}
            title={menu.name}
            src={previewUrl}
            className={cn(
              "absolute inset-0 h-full w-full border-0 bg-white transition-opacity duration-300",
              loading ? "opacity-0" : "opacity-100",
            )}
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setEmbedFailed(true);
            }}
            allow="autoplay"
          />
        )}

        {loading && !embedFailed ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <Loader2 className="text-primary h-7 w-7 animate-spin" />
            <p className="text-muted-foreground text-xs font-medium">
              Loading menu…
            </p>
          </div>
        ) : null}
      </div>

      {menu.kind === "image" && !embedFailed ? (
        <div className="border-border flex shrink-0 items-center justify-center gap-3 border-t px-4 py-2.5">
          <button
            type="button"
            disabled={zoom <= 0.75}
            onClick={() => setZoom((z) => Math.max(0.75, +(z - 0.25).toFixed(2)))}
            className="bg-muted text-foreground inline-flex h-9 w-9 items-center justify-center rounded-full transition disabled:opacity-40"
            aria-label="Zoom out"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="text-muted-foreground w-12 text-center text-xs font-semibold tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            disabled={zoom >= 2.5}
            onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.25).toFixed(2)))}
            className="bg-muted text-foreground inline-flex h-9 w-9 items-center justify-center rounded-full transition disabled:opacity-40"
            aria-label="Zoom in"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="border-border flex shrink-0 items-center justify-between gap-3 border-t px-4 py-2.5">
          <p className="text-muted-foreground text-[11px] leading-snug">
            Prices may differ at the place.
          </p>
          <a
            href={menu.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary inline-flex items-center gap-1 text-xs font-semibold"
          >
            Open full
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
    </div>
  );
}

function ImagePane({
  url,
  zoom,
  loading,
  onLoaded,
  onError,
}: {
  url: string;
  zoom: number;
  loading: boolean;
  onLoaded: () => void;
  onError: () => void;
}) {
  return (
    <div className="absolute inset-0 overflow-auto overscroll-contain">
      <div
        className="flex min-h-full min-w-full items-center justify-center p-4"
        style={{
          // Give zoomed images room to pan inside the scroll container.
          minHeight: `${Math.max(100, zoom * 100)}%`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt="Menu"
          onLoad={onLoaded}
          onError={onError}
          className={cn(
            "max-w-none rounded-lg shadow-lg transition-[transform,opacity] duration-300 origin-center",
            loading ? "opacity-0" : "opacity-100",
          )}
          style={{
            transform: `scale(${zoom})`,
            width: zoom <= 1 ? "100%" : undefined,
            maxWidth: zoom <= 1 ? "100%" : "none",
          }}
          draggable={false}
        />
      </div>
    </div>
  );
}

function EmbedFallback({ url, kind }: { url: string; kind: MenuKind }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
      <span className="bg-muted text-muted-foreground flex h-12 w-12 items-center justify-center rounded-full">
        <FileText className="h-5 w-5" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-foreground text-sm font-semibold">
          Couldn&apos;t preview this {menuKindLabel(kind).toLowerCase()}
        </p>
        <p className="text-muted-foreground text-xs leading-snug">
          Open it in a new tab to view the full menu.
        </p>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="bg-foreground text-background inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold"
      >
        Open menu
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}
