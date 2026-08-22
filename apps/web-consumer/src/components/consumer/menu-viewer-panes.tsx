import { ExternalLink, FileText } from "lucide-react";
import { menuKindLabel, type MenuKind } from "@/lib/menu-url";
import { cn } from "@/lib/utils";

export function ImagePane({
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
            "shadow-elev max-w-none origin-center rounded-lg transition-[transform,opacity] duration-300",
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

export function EmbedFallback({ url, kind }: { url: string; kind: MenuKind }) {
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
