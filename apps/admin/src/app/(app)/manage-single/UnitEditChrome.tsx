"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ImageOff, Search } from "lucide-react";
import type { AdminPlace } from "./actions";
import { UNIT_SECTIONS, unitSectionHref } from "./nav";

export function currentUnitSection(pathname: string) {
  for (const { id } of UNIT_SECTIONS) {
    if (pathname.endsWith(`/${id}`) || pathname.includes(`/${id}/`)) {
      return id;
    }
  }
  return "place" as const;
}

export function UnitEditChrome({
  projectId,
  place,
}: {
  projectId: string;
  place: AdminPlace;
}) {
  const pathname = usePathname();

  return (
    <div className="border-border bg-card/95 supports-[backdrop-filter]:bg-card/85 sticky top-0 z-30 border-b backdrop-blur-md">
      <div className="flex items-center gap-3 px-4 py-2 sm:gap-4 sm:px-6 lg:px-8">
        <Link
          href="/manage-single/select"
          className="text-muted-foreground hover:text-foreground hover:bg-muted/60 inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition"
        >
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">Switch unit</span>
        </Link>

        <span className="bg-border h-4 w-px shrink-0" aria-hidden />

        <p
          className="max-w-[8rem] shrink-0 truncate text-sm font-semibold sm:max-w-[12rem] lg:max-w-none"
          title={place.name}
        >
          {place.name}
        </p>

        <nav
          role="tablist"
          aria-label="Unit sections"
          className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {UNIT_SECTIONS.map(({ id, label }) => {
            const href = unitSectionHref(projectId, id);
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={id}
                href={href}
                role="tab"
                aria-selected={active}
                className={
                  "inline-flex shrink-0 items-center rounded-md px-2.5 py-1.5 text-sm font-medium transition sm:px-3 " +
                  (active
                    ? "bg-secondary/10 text-secondary"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground")
                }
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

export function UnitThumb({
  photo,
  name,
  size = "sm",
}: {
  photo: string | null;
  name: string;
  size?: "sm" | "lg";
}) {
  const dim = size === "lg" ? "h-11 w-11 rounded-lg" : "h-8 w-8 rounded-md";
  const icon = size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5";

  if (!photo) {
    return (
      <div
        className={
          "border-border bg-muted/40 text-muted-foreground flex shrink-0 items-center justify-center border " +
          dim
        }
      >
        <ImageOff className={icon} />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photo}
      alt={name}
      className={"border-border shrink-0 border object-cover " + dim}
    />
  );
}
