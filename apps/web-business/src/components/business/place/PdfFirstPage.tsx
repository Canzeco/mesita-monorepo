"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

// First-page PDF thumbnail rendered with pdf.js — a clean page image with a
// page-count badge instead of an <iframe> full of browser PDF chrome
// (toolbars, dark grey gutters) inside the editor card. If the document
// can't be parsed the caller falls back to the iframe. Peer of the
// web-admin component of the same name.

type PdfjsModule = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<PdfjsModule> | null = null;

function loadPdfjs(): Promise<PdfjsModule> {
  pdfjsPromise ??= import("pdfjs-dist").then((mod) => {
    // Worker ships with our build so API and worker versions never drift.
    mod.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    return mod;
  });
  return pdfjsPromise;
}

export function PdfFirstPage({
  url,
  className,
  onError,
}: {
  url: string;
  className?: string;
  /** Document failed to parse/render — caller should show its fallback. */
  onError: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pageCount, setPageCount] = useState(0);
  const [rendered, setRendered] = useState(false);
  const onErrorRef = useRef(onError);
  useEffect(() => {
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
        const doc: PDFDocumentProxy = await task.promise;
        if (cancelled) return;
        const page = await doc.getPage(1);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 });
        // Thumbnail backing store — card previews cap around ~400 CSS px
        // wide, so 800 backing px stays crisp on retina without waste.
        const viewport = page.getViewport({ scale: 800 / base.width });
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        await page.render({ canvas, viewport }).promise;
        if (cancelled) return;
        setPageCount(doc.numPages);
        setRendered(true);
      } catch {
        if (!cancelled) onErrorRef.current();
      }
    })();
    return () => {
      cancelled = true;
      void task?.destroy();
    };
  }, [url]);

  return (
    <div className={className}>
      <div className="relative flex justify-center p-2">
        <canvas
          ref={canvasRef}
          className={
            "border-border/60 h-auto max-h-48 w-auto max-w-full rounded-md border bg-white shadow-sm transition-opacity duration-300 " +
            (rendered ? "opacity-100" : "opacity-0")
          }
        />
        {!rendered ? (
          <div
            aria-hidden
            className="bg-muted absolute inset-2 animate-pulse rounded-md"
          />
        ) : null}
        {rendered && pageCount > 0 ? (
          <span className="bg-foreground/75 text-background absolute right-3 bottom-3 rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums">
            {pageCount === 1 ? "1 page" : `${pageCount} pages`}
          </span>
        ) : null}
      </div>
    </div>
  );
}
