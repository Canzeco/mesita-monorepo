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
import {
  CONSOLE_MODES,
  setConsoleMode,
  type ConsoleMode,
} from "@/lib/console-mode";
import { cn } from "@/lib/utils";
import { Z_ROUTE_BADGE } from "@/lib/z-index";

import { BESIDE_CARD, useConsoleMode, useHydrated } from "./console-layout";

// Over this a line turns amber: slow enough to feel on a tap.
const SLOW_MS = 800;

/**
 * The desktop console right of the phone card (MESITA-3040, MESITA-3518):
 * a log of every Edge Function call this browser makes and every screen
 * change, newest first, with its status and milliseconds; then a panel with
 * the request and response of the newest Edge Function call. Clicking a
 * line pins that call in the panel (MESITA-3089); "latest" lets it follow
 * the newest again. Under xl there is no room for the panel, so a clicked
 * line opens the same box over the log instead. Phones show none of it.
 *
 * A switch at the top right picks how much shows (MESITA-3575): Phone,
 * Functions (+ the log) or Terminal (+ the request/response panel).
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
  const mode = useConsoleMode();
  const pathname = usePathname() ?? "/";
  const previous = useRef<string | null>(null);
  const [pinnedId, setPinnedId] = useState<number | null>(null);
  // Gone once it scrolls out of the last 40 lines; then the panel follows
  // the newest call again.
  const pinned = lines.find((line) => line.id === pinnedId) ?? null;
  const latest = lines.find((line) => line.kind === "ef") ?? null;
  const shown = pinned ?? latest;

  useEffect(() => {
    if (pinnedId === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPinnedId(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pinnedId]);

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

  const hydrated = useHydrated();
  const unpin = () => setPinnedId(null);
  const terminal = mode === "terminal";

  // Secondary: the phone paints first; the console joins after hydration.
  if (!hydrated) return null;

  return (
    <>
      <ModeSwitch mode={mode} />
      {mode === "phone" ? null : (
        <div
          data-testid="call-log"
          className={cn(
            // 0.75rem right of the card (console-layout.ts, MESITA-3580),
            // under the route badge, to 1rem from the window's right edge.
            "fixed top-10 bottom-2 hidden gap-3 select-none md:right-4 md:flex",
            BESIDE_CARD[mode],
            "type-label font-mono leading-tight tabular-nums",
            Z_ROUTE_BADGE,
          )}
        >
          <div
            className={cn(
              "relative flex min-w-0 flex-col gap-0.5 overflow-hidden",
              // Functions alone: a 26rem column, not the whole width.
              terminal
                ? "flex-1 xl:w-[26rem] xl:flex-none"
                : "w-[26rem] max-w-full flex-none",
              TERMINAL,
            )}
          >
            <div className="pb-1 text-zinc-500">
              edge functions · navigation
            </div>
            {lines.length === 0 ? (
              <div className="text-zinc-500">waiting for the first call…</div>
            ) : (
              lines.map((line) => (
                <Line
                  key={line.id}
                  line={line}
                  open={line.id === shown?.id}
                  onToggle={() =>
                    setPinnedId((current) =>
                      current === line.id ? null : line.id,
                    )
                  }
                />
              ))
            )}
            {/* No panel (Functions, or under xl): a pinned call opens over
            the log. */}
            {pinned ? (
              <div
                className={cn(
                  "absolute inset-x-2 top-8 bottom-2 flex",
                  terminal && "xl:hidden",
                )}
              >
                <Detail line={pinned} pinned onUnpin={unpin} />
              </div>
            ) : null}
          </div>
          {terminal ? (
            <div
              className={cn(
                "hidden min-w-0 flex-1 xl:flex",
                TERMINAL,
                "border-green-950 bg-black",
              )}
            >
              {shown ? (
                <Detail line={shown} pinned={pinned !== null} onUnpin={unpin} />
              ) : (
                <div className="text-green-700">
                  request · response — waiting for the first call…
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}

const MODE_LABEL: Record<ConsoleMode, string> = {
  phone: "Phone",
  functions: "Functions",
  terminal: "Terminal",
};

// Top right, desktop only: how much of the console shows.
function ModeSwitch({ mode }: { mode: ConsoleMode }) {
  return (
    <div
      role="radiogroup"
      aria-label="Console"
      className={cn(
        "fixed top-2 right-4 hidden gap-0.5 rounded-full border p-0.5 md:flex",
        "bg-card/80 border-border backdrop-blur-sm",
        "type-label font-mono leading-none select-none",
        Z_ROUTE_BADGE,
      )}
    >
      {CONSOLE_MODES.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={mode === option}
          onClick={() => setConsoleMode(option)}
          className={cn(
            "cursor-pointer rounded-full px-2.5 py-1",
            mode === option
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {MODE_LABEL[option]}
        </button>
      ))}
    </div>
  );
}

// A terminal: dark whatever the app theme (MESITA-3088).
const TERMINAL =
  "rounded-lg border border-zinc-800 bg-zinc-950/95 p-2 text-zinc-200 shadow-lg backdrop-blur-sm";

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
      aria-pressed={open}
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

// One call: its line, then what it sent and got back — raw JSON, green on
// black, a wall of text that changes with every call (MESITA-3521).
function Detail({
  line,
  pinned,
  onUnpin,
}: {
  line: CallLine;
  pinned: boolean;
  onUnpin: () => void;
}) {
  return (
    <div className="flex min-h-0 w-full flex-col gap-2 rounded-md border border-green-950 bg-black p-2 text-green-400 shadow-2xl select-text">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate">
          {line.label.replace(/^consumer-web-/, "")} · {line.status} ·{" "}
          {line.ms === null ? "—" : `${line.ms} ms`} · {clock(line.at)}
        </span>
        {pinned ? (
          <button
            type="button"
            onClick={onUnpin}
            className="cursor-pointer rounded-sm px-1 text-green-600 hover:bg-green-950 hover:text-green-300"
          >
            pinned · show latest
          </button>
        ) : (
          <span className="text-green-700">latest</span>
        )}
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
      <div className="pb-1 text-green-700">{title}</div>
      <pre className="min-h-0 flex-1 overflow-auto break-all whitespace-pre-wrap">
        {raw(value)}
      </pre>
    </div>
  );
}

// Past this a response (a long list) is cut: the box is for reading, not
// for holding a whole catalog.
const MAX_CHARS = 100_000;

function raw(value: unknown): string {
  let text: string;
  try {
    text = JSON.stringify(value) ?? String(value);
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
