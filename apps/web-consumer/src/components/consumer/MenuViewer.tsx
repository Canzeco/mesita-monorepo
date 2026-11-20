"use client";

import { Skeleton } from "@/components/shared/Skeleton";
import { useCallback, useState } from "react";
import {
  ChevronLeft,
  ExternalLink,
  FileText,
  Minus,
  Plus,
  Utensils,
} from "lucide-react";
import {
  EmbedFallback,
  ImagePane,
} from "@/components/consumer/menu-viewer-panes";
import { PdfPane } from "@/components/consumer/pdf-pane";
import {
  drivePreviewUrl,
  menuKindLabel,
  type MenuKind,
} from "@mesita/place-profile/lib/menu-url";
import {
  nutritionLine,
  type MenuNutrition,
} from "@mesita/place-profile/lib/nutrition";
import { useRouter } from "next/navigation";
import { placePath } from "@/lib/consumer-route-contract";
import { goBack } from "@/lib/navigate";
import type { PlaceDetail } from "@/lib/place-detail";
import { cn } from "@/lib/utils";

type MenuViewerItem = {
  name: string;
  url: string;
  kind: MenuKind;
  nutrition?: MenuNutrition | null;
};

/** The menu file at `menuId`, the index in `products.menu` (MESITA-4111).
 *  Menus have no stored id. A missing index says so and offers Back. */
export function PlaceMenuPage({
  place,
  menuId,
}: {
  place: PlaceDetail;
  menuId: string;
}) {
  const router = useRouter();
  const back = useCallback(
    () => goBack(router, placePath(place.id)),
    [router, place.id],
  );
  const index = /^\d+$/.test(menuId) ? Number(menuId) : -1;
  const menu = index >= 0 ? place.products.menu[index] : undefined;
  if (!menu) {
    return (
      <div className="bg-background flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="border-border flex shrink-0 items-center gap-2 border-b px-2 py-2">
          <button
            type="button"
            onClick={back}
            className="text-foreground inline-flex h-11 w-11 items-center justify-center rounded-full"
            aria-label="Back"
          >
            <ChevronLeft className="h-6 w-6" strokeWidth={2.25} />
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Menu</p>
            <p className="text-muted-foreground truncate text-xs">
              {place.name}
            </p>
          </div>
        </header>
        <p className="text-muted-foreground px-5 py-8 text-center text-sm">
          This menu isn&apos;t available.
        </p>
      </div>
    );
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <MenuViewerBody
        key={menu.url}
        menu={menu}
        placeName={place.name}
        onBack={back}
      />
    </div>
  );
}

function MenuViewerBody({
  menu,
  placeName,
  onBack,
}: {
  menu: MenuViewerItem;
  placeName: string;
  onBack: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);
  const [embedFailed, setEmbedFailed] = useState(false);
  const [pageCount, setPageCount] = useState(0);

  const previewUrl =
    menu.kind === "drive" ? (drivePreviewUrl(menu.url) ?? menu.url) : menu.url;
  const kindLabel = menuKindLabel(menu.kind);
  // Image and PDF panes render in-app and support pinch-free zoom controls;
  // Drive stays an embed (Google's own /preview viewer handles paging).
  const zoomable = menu.kind !== "drive" && !embedFailed;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-border flex shrink-0 items-center gap-2 border-b px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="text-foreground inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={2.25} />
        </button>
        <span className="bg-muted text-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
          {menu.kind === "image" ? (
            <Utensils className="h-4 w-4" strokeWidth={2} />
          ) : (
            <FileText className="h-4 w-4" strokeWidth={2} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold tracking-tight">
            {menu.name}
          </p>
          <p className="text-muted-foreground truncate text-xs">{placeName}</p>
          {nutritionLine(menu.nutrition) ? (
            <p className="type-label truncate tabular-nums">
              {nutritionLine(menu.nutrition)}
            </p>
          ) : null}
          <p className="text-muted-foreground type-label truncate">
            {kindLabel}
            {menu.kind === "pdf" && pageCount > 0
              ? ` · ${pageCount === 1 ? "1 page" : `${pageCount} pages`}`
              : null}
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
      </header>

      <div className="bg-muted/40 relative min-h-0 flex-1 overflow-hidden">
        {embedFailed ? (
          <EmbedFallback url={menu.url} kind={menu.kind} />
        ) : menu.kind === "image" ? (
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
        ) : menu.kind === "pdf" ? (
          <PdfPane
            url={menu.url}
            zoom={zoom}
            onReady={(pages) => {
              setLoading(false);
              setPageCount(pages);
            }}
            onError={() => {
              setLoading(false);
              setEmbedFailed(true);
            }}
          />
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
          <div
            className="absolute inset-0 flex flex-col gap-3 p-5"
            aria-busy="true"
            aria-label="Loading menu"
          >
            <Skeleton className="h-6 w-1/2" />
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        ) : null}
      </div>

      {zoomable ? (
        <div className="border-border flex shrink-0 items-center justify-center gap-3 border-t px-4 py-2.5">
          <button
            type="button"
            disabled={zoom <= 0.75}
            onClick={() =>
              setZoom((z) => Math.max(0.75, +(z - 0.25).toFixed(2)))
            }
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
            onClick={() =>
              setZoom((z) => Math.min(2.5, +(z + 0.25).toFixed(2)))
            }
            className="bg-muted text-foreground inline-flex h-9 w-9 items-center justify-center rounded-full transition disabled:opacity-40"
            aria-label="Zoom in"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="border-border flex shrink-0 items-center justify-between gap-3 border-t px-4 py-2.5">
          <p className="text-muted-foreground type-body leading-snug">
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
