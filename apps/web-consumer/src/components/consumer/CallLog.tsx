"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

import {
  logCall,
  markNavStart,
  readCallLog,
  readCallLogOnServer,
  subscribeCallLog,
  takeNavStart,
  type CallLine,
} from "@/lib/call-log";
import { cn } from "@/lib/utils";
import { Z_ROUTE_BADGE } from "@/lib/z-index";

// Over this a line turns amber: slow enough to feel on a tap.
const SLOW_MS = 800;

/**
 * A read-only log under the route badge (MESITA-3040): every Edge Function
 * call this browser makes and every screen change, newest first, with its
 * status and milliseconds. Desktop gutter only (a phone has no room beside
 * the card), `pointer-events-none`, so it never takes a click.
 *
 * Server-side calls (the shell layout's profile read, a place page's read)
 * do not appear as lines: they are inside the `nav` line's time.
 */
export function CallLog() {
  const lines = useSyncExternalStore(
    subscribeCallLog,
    readCallLog,
    readCallLogOnServer,
  );
  const pathname = usePathname() ?? "/";
  const previous = useRef<string | null>(null);

  // Start the clock on the finger, before any router work.
  useEffect(() => {
    const onDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      const link = target?.closest?.("a[href]");
      if (link) markNavStart(link.getAttribute("href") ?? "");
    };
    document.addEventListener("pointerdown", onDown, { capture: true });
    return () =>
      document.removeEventListener("pointerdown", onDown, { capture: true });
  }, []);

  // One line per screen change: from → to, and the time since the tap.
  useEffect(() => {
    const from = previous.current;
    previous.current = pathname;
    if (from === null || from === pathname) return;
    logCall({
      kind: "nav",
      label: `${from} → ${pathname}`,
      status: "ok",
      ms: takeNavStart(),
    });
  }, [pathname]);

  return (
    <div
      aria-hidden
      data-testid="call-log"
      className={cn(
        "pointer-events-none fixed top-10 bottom-2 hidden select-none md:flex",
        // Same gutter as RouteBadge: right edge 0.75rem left of the card.
        "md:right-[calc(50%+14.75rem)] md:w-[min(26rem,calc(50%-15.5rem))]",
        // A terminal: dark whatever the app theme (MESITA-3088).
        "flex-col gap-0.5 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/95 p-2 text-zinc-200 shadow-lg backdrop-blur-sm",
        "type-label font-mono leading-tight tabular-nums",
        Z_ROUTE_BADGE,
      )}
    >
      <div className="pb-1 text-zinc-500">edge functions · navigation</div>
      {lines.length === 0 ? (
        <div className="text-zinc-500">waiting for the first call…</div>
      ) : (
        lines.map((line) => <Line key={line.id} line={line} />)
      )}
    </div>
  );
}

function Line({ line }: { line: CallLine }) {
  const failed = line.status !== "ok";
  const slow = line.ms !== null && line.ms > SLOW_MS;
  return (
    <div
      className={cn(
        "flex gap-2 whitespace-nowrap",
        failed ? "text-red-400" : slow ? "text-amber-400" : "text-zinc-200",
      )}
    >
      <span className="text-zinc-500">{clock(line.at)}</span>
      <span className="w-7 shrink-0">{line.kind === "nav" ? "nav" : "ef"}</span>
      <span className="min-w-0 flex-1 truncate">
        {line.label.replace(/^consumer-web-/, "")}
      </span>
      <span className="w-9 shrink-0 text-right">{line.status}</span>
      <span className="w-14 shrink-0 text-right">
        {line.ms === null ? "—" : `${line.ms} ms`}
      </span>
    </div>
  );
}

function clock(at: number): string {
  const d = new Date(at);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
