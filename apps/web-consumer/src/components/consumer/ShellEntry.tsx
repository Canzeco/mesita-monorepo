"use client";

import { useEffect } from "react";
import { markShellEntry } from "@/lib/navigate";

/** Marks the history entry the shell first loaded on, which `goBack` reads
 *  to tell a screen reached in the app from one opened cold (MESITA-3614).
 *  Draws nothing. */
export function ShellEntry() {
  useEffect(() => markShellEntry(), []);
  return null;
}
