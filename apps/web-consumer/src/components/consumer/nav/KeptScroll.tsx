"use client";

import type { HTMLAttributes } from "react";
import { useKeptScroll } from "@/lib/use-kept-scroll";

/** A scroller that keeps its place when its screen comes back (MESITA-3647),
 *  for frames that also render on the server (loading screens). */
export function KeptScroll(props: HTMLAttributes<HTMLDivElement>) {
  const keep = useKeptScroll<HTMLDivElement>();
  return <div ref={keep} {...props} />;
}
