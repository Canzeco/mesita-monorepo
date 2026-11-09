"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** The live clock: the anti-fake check beside the server's Paid answer.
 *  Decorative to a screen reader (aria-hidden); ticks every second. */
export function LiveClock({ className }: { className?: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return (
    <p className={cn("font-display mt-3 text-2xl font-semibold tabular-nums", className)} aria-hidden data-live-clock>
      {hh}:{mm}:{ss}
    </p>
  );
}
