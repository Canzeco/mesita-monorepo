"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { usePlaceContext } from "./PlaceContext";

/** Link out to another place tab, routed through the discard guard. */
export function CrossTabLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { guardNav } = usePlaceContext();
  return (
    <Link
      href={href}
      onClick={(e) => guardNav(href, e)}
      className={
        className ??
        "text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-medium transition"
      }
    >
      {children}
      <ArrowRight className="h-3 w-3" />
    </Link>
  );
}
