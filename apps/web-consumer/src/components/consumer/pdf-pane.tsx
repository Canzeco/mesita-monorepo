"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

import { cn } from "@/lib/utils";

// In-app PDF reader built on pdf.js — each page renders into a canvas card.
// A plain <iframe src="…pdf"> hands the file to the browser's PDF plumbing,
// which iOS Safari clips to page one and Android Chrome often turns into a
// download prompt; rendering ourselves gives every device the same pretty,
// scrollable, zoomable menu.

type PdfjsModule = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<PdfjsModule> | null = null;

function loadPdfjs(): Promise<PdfjsModule> {
  // Loaded once per session; the worker bundle ships with our build so the
  // API and worker versions can never drift.
  pdfjsPromise ??= import("pdfjs-dist").then((mod) => {
    mod.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    return mod;
  });
  return pdfjsPromise;
}

export function PdfPane({
  url,
  zoom,
  onReady,
  onError,
}: {
  url: string;
  zoom: number;
  /** Fires once the document is parsed, with the page count. */
  onReady: (pages: number) => void;
  onError: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageElsRef = useRef<(HTMLDivElement | null)[]>([]);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [renderWidth, setRenderWidth] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  // Stable callback refs — document loading must not restart when the
  // parent re-renders with new closures.
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onReadyRef.current = onReady;
    onErrorRef.current = onError;
  });

  useEffect(() => {
    let cancelled = false;
    // destroy() lives on the loading task (it also tears down the document
    // and its worker channel) — pdf.js v6 dropped PDFDocumentProxy.destroy.
    let task: ReturnType<PdfjsModule["getDocument"]> | null = null;
    (async () => {
      try {
        const pdfjs = await loadPdfjs();
        task = pdfjs.getDocument({ url });
        const loaded = await task.promise;
        if (cancelled) return;
        // Backing-store width: container width × capped DPR with headroom so
        // pages stay crisp when zoomed in, without unbounded canvas memory.
        const containerWidth =
          scrollRef.current?.clientWidth ?? window.innerWidth;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        setRenderWidth(
          Math.min(2048, Math.round((containerWidth - 32) * dpr * 1.3)),
        );
        setDoc(loaded);
        onReadyRef.current(loaded.numPages);
      } catch {
        if (!cancelled) onErrorRef.current();
      }
    })();
    return () => {
      cancelled = true;
      void task?.destroy();
      setDoc(null);
    };
  }, [url]);

  // Track which page fills the viewport so the floating chip reads "2 / 6".
  const onScroll = () => {
    const container = scrollRef.current;
    if (!container || !doc) return;
    const midpoint = container.scrollTop + container.clientHeight / 2;
    let best = 1;
    let bestDist = Infinity;
    for (const [i, el] of pageElsRef.current.entries()) {
      if (!el) continue;
      const center = el.offsetTop + el.offsetHeight / 2;
      const dist = Math.abs(center - midpoint);
      if (dist < bestDist) {
        bestDist = dist;
        best = i + 1;
      }
    }
    setCurrentPage(best);
  };

  const pageCount = doc?.numPages ?? 0;

  return (
    <>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="absolute inset-0 overflow-auto overscroll-contain"
      >
        {doc && renderWidth > 0 ? (
          <div
            className="mx-auto flex flex-col items-center gap-3 p-4 pb-8"
            // Zoom pans inside the scroll container, matching ImagePane.
            style={{ width: `${Math.round(zoom * 100)}%`, minWidth: "100%" }}
          >
            {Array.from({ length: pageCount }, (_, i) => (
              <div
                key={i}
                ref={(el) => {
                  pageElsRef.current[i] = el;
                }}
                className="w-full"
              >
                <PdfPageCanvas
                  doc={doc}
                  pageNumber={i + 1}
                  renderWidth={renderWidth}
                />
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {pageCount > 1 ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <span className="bg-foreground/80 text-background shadow-media type-label rounded-full px-3 py-1 font-semibold tabular-nums backdrop-blur-sm">
            {currentPage} / {pageCount}
          </span>
        </div>
      ) : null}
    </>
  );
}

function PdfPageCanvas({
  doc,
  pageNumber,
  renderWidth,
}: {
  doc: PDFDocumentProxy;
  pageNumber: number;
  renderWidth: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendered, setRendered] = useState(false);
  // Height/width ratio for the skeleton so the scroll length is right
  // before the page pixels land (defaults to letter-ish portrait).
  const [aspect, setAspect] = useState(1.35);

  useEffect(() => {
    let cancelled = false;
    let renderTask: ReturnType<
      Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]
    > | null = null;
    (async () => {
      try {
        const page = await doc.getPage(pageNumber);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 });
        setAspect(base.height / base.width);
        const viewport = page.getViewport({ scale: renderWidth / base.width });
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        renderTask = page.render({ canvas, viewport });
        await renderTask.promise;
        if (!cancelled) setRendered(true);
      } catch {
        // Cancelled mid-render (viewer closed / zoom remount) — the skeleton
        // simply stays until a successful pass. Document-level failures are
        // surfaced by PdfPane's loader instead.
      }
    })();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [doc, pageNumber, renderWidth]);

  return (
    <div className="relative w-full">
      {!rendered ? (
        // Skeleton-styled placeholder that reserves the true page height so
        // scrolling doesn't jump when the pixels land (Skeleton itself
        // doesn't take a style prop and this needs a dynamic aspect ratio).
        <div
          aria-hidden
          className="bg-muted w-full animate-pulse rounded-xl"
          style={{ aspectRatio: `1 / ${aspect}` }}
        />
      ) : null}
      <canvas
        ref={canvasRef}
        className={cn(
          "shadow-elev h-auto w-full rounded-xl bg-white transition-opacity duration-300",
          rendered ? "opacity-100" : "absolute inset-0 opacity-0",
        )}
      />
    </div>
  );
}
