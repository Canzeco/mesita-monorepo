"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import { motionFor, noteTraverse, transitionTypesFor } from "@/lib/navigate";

// THE DRILL-IN LINK (MESITA-3644): a plain next/link that tells the stage to
// slide the new screen in from the right over this one. A panel (a place, a
// reservation, Ask AI) opened from a page slides itself, so the link sends no
// motion then (motionFor). Use a plain Link for a bar tab, a jump to another
// tab, or a link that replaces the screen.
export function PushLink(props: ComponentProps<typeof Link>) {
  const pathname = usePathname() ?? "/";
  const href = typeof props.href === "string" ? props.href : (props.href.pathname ?? "/");
  const types = transitionTypesFor(motionFor(pathname, href));
  return (
    <Link
      {...props}
      transitionTypes={types}
      onClick={(e) => {
        noteTraverse(false);
        props.onClick?.(e);
      }}
    />
  );
}
