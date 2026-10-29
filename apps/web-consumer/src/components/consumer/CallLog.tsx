"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
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
 * A log under the route badge (MESITA-3040): every Edge Function call this
 * browser makes and every screen change, newest first, with its status and
 * milliseconds. Desktop gutter only (a phone has no room beside the card),
 * so it never sits over the app. Clicking an Edge Function line opens a box
 * over the log with the request it sent and the response (MESITA-3089).
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
  const [openId, setOpenId] = useState<number | null>(null);
  // Gone once it scrolls out of the last 40 lines.
  const open = lines.find((line) => line.id === openId) ?? null;

  useEffect(() => {
    if (openId === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenId(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openId]);

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
      data-testid="call-log"
      className={cn(
        "fixed top-10 bottom-2 hidden select-none md:flex",
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
        lines.map((line) => (
          <Line
            key={line.id}
            line={line}
            open={line.id === openId}
            onToggle={() =>
              setOpenId((current) => (current === line.id ? null : line.id))
            }
          />
        ))
      )}
      {open ? <Detail line={open} onClose={() => setOpenId(null)} /> : null}
    </div>
  );
}

function Line({
  line,
  open,
  onToggle,
}: {
  line: CallLine;
  open: boolean;
  onToggle: () => void;
}) {
  const failed = line.status !== "ok";
  const slow = line.ms !== null && line.ms > SLOW_MS;
  const className = cn(
    "flex gap-2 rounded-sm text-left whitespace-nowrap",
    failed ? "text-red-400" : slow ? "text-amber-400" : "text-zinc-200",
  );
  const cells = (
    <>
      <span className="text-zinc-500">{clock(line.at)}</span>
      <span className="w-7 shrink-0">{line.kind === "nav" ? "nav" : "ef"}</span>
      <span className="min-w-0 flex-1 truncate">
        {line.label.replace(/^consumer-web-/, "")}
      </span>
      <span className="w-9 shrink-0 text-right">{line.status}</span>
      <span className="w-14 shrink-0 text-right">
        {line.ms === null ? "—" : `${line.ms} ms`}
      </span>
    </>
  );
  // A screen change has no request or response to show.
  if (line.kind === "nav") return <div className={className}>{cells}</div>;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={cn(
        className,
        "w-full cursor-pointer hover:bg-zinc-800/80",
        open && "bg-zinc-800",
      )}
    >
      {cells}
    </button>
  );
}

// The box over the log: the clicked line, then what it sent and got back.
function Detail({ line, onClose }: { line: CallLine; onClose: () => void }) {
  return (
    <div className="absolute inset-x-2 top-8 bottom-2 flex flex-col gap-2 rounded-md border border-zinc-700 bg-zinc-900 p-2 shadow-2xl select-text">
      <div className="flex items-center gap-2 text-zinc-200">
        <span className="min-w-0 flex-1 truncate">
          {line.label.replace(/^consumer-web-/, "")} · {line.status} ·{" "}
          {line.ms === null ? "—" : `${line.ms} ms`} · {clock(line.at)}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="cursor-pointer rounded-sm px-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
        >
          ×
        </button>
      </div>
      <Section title="request" value={line.request} className="max-h-[35%]" />
      <Section title="response" value={line.response} className="flex-1" />
    </div>
  );
}

function Section({
  title,
  value,
  className,
}: {
  title: string;
  value: unknown;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="pb-1 text-zinc-500">{title}</div>
      <pre className="min-h-0 flex-1 overflow-auto rounded-sm bg-zinc-950 p-2 break-all whitespace-pre-wrap text-zinc-300">
        {pretty(value)}
      </pre>
    </div>
  );
}

// Past this a response (a long list) is cut: the box is for reading, not
// for holding a whole catalog.
const MAX_CHARS = 100_000;

function pretty(value: unknown): string {
  let text: string;
  try {
    text = JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    text = String(value);
  }
  return text.length > MAX_CHARS
    ? `${text.slice(0, MAX_CHARS)}\n… cut at ${MAX_CHARS.toLocaleString()} characters`
    : text;
}

function clock(at: number): string {
  const d = new Date(at);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
