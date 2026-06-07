"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleUser } from "lucide-react";
import { cn } from "@/lib/utils";

// Account entry point — a profile avatar pinned to the top-right of the
// app bar. Account is a utility destination (profile, venue switching,
// sign out), so it lives here rather than as a bottom-bar tab alongside
// the operating surfaces (Place / Promos / Scan / Team / Stats).
//
// Derives the active unit from the URL (same contract as BottomNav) and
// hides itself on the Account page itself (no self-link).
export function AccountAvatar({ className }: { className?: string }) {
  const pathname = usePathname() ?? "";
  const match = pathname.match(/^\/unit\/([^/]+)(?:\/([^/]+))?/);
  const unitId = match?.[1];
  const slug = match?.[2] ?? null;

  if (!unitId || slug === "settings") return null;

  return (
    <Link
      href={`/unit/${unitId}/settings`}
      aria-label="Account"
      className={cn(
        "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition",
        className,
      )}
    >
      <CircleUser className="h-5 w-5" />
    </Link>
  );
}
