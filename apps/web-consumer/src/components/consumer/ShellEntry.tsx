"use client";

import { useEffect } from "react";
import { markShellEntry, noteShownEntry } from "@/lib/navigate";

/** Marks the history entry the shell first loaded on, which `goBack` reads
 *  to tell a screen reached in the app from one opened cold (MESITA-3614),
 *  and notes every entry the app shows, so a full page load mid-walk keeps
 *  the trail (MESITA-4622). It listens to the Navigation API's
 *  `currententrychange`, so a push that changes only the query counts too.
 *  Draws nothing. */
export function ShellEntry() {
  useEffect(() => {
    const onEntry = () => {
      markShellEntry();
      noteShownEntry();
    };
    onEntry();
    const nav = (window as unknown as { navigation?: EventTarget }).navigation;
    nav?.addEventListener("currententrychange", onEntry);
    return () => nav?.removeEventListener("currententrychange", onEntry);
  }, []);
  return null;
}
