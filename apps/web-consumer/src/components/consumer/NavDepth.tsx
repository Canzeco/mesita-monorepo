"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { listenForBack, noteInAppMove } from "@/lib/navigate";

/** Keeps the in-app depth `goBack` reads (MESITA-3614). Draws nothing. */
export function NavDepth() {
  const pathname = usePathname();
  const first = useRef(true);
  useEffect(() => listenForBack(), []);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    noteInAppMove();
  }, [pathname]);
  return null;
}
