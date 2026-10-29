"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/report-error";

// AN ERROR NOBODY CAUGHT IS STILL SAID (Pato, MESITA-3021). A throw in an
// event handler or a promise no screen awaited never reaches a route's
// error screen; it used to vanish into the console. Mounted once at the root.
//
// Not said: an aborted request (the guest moved on), the browser's
// ResizeObserver loop notice (harmless, fires on resize), and a failed chunk
// load, which DeploymentWatcher and the route error screen heal by
// reloading onto the live build.
const IGNORED = [
  /AbortError/i,
  /ResizeObserver loop/i,
  /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module/i,
];

function messageOf(reason: unknown): string {
  if (reason instanceof Error) return reason.message || reason.name;
  if (typeof reason === "string") return reason;
  return "Unknown error";
}

function say(reason: unknown): void {
  const message = messageOf(reason);
  const name = reason instanceof Error ? reason.name : "";
  if (IGNORED.some((re) => re.test(`${name} ${message}`))) return;
  // EFError is said where it happened (lib/api/_invoke.ts), with its status.
  if (name === "EFError") return;
  reportError(`Something went wrong: ${message}`, reason);
}

export function ErrorNotifier() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => say(event.error ?? event.message);
    const onRejection = (event: PromiseRejectionEvent) => say(event.reason);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
