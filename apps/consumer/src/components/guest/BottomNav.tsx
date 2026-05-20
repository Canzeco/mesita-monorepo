"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Bookmark, QrCode, Share2, User } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  {
    href: "/guest/discover/swipe",
    Icon: Compass,
    label: "Discover",
    match: "/guest/discover",
  },
  {
    href: "/guest/saved",
    Icon: Bookmark,
    label: "Saved",
    match: "/guest/saved",
  },
  { href: "/guest/qr", Icon: QrCode, label: "My QR", match: "/guest/qr" },
  { href: "/guest/share", Icon: Share2, label: "Share", match: "/guest/share" },
  {
    href: "/guest/profile",
    Icon: User,
    label: "Profile",
    match: "/guest/profile",
  },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="border-border bg-card/95 sticky bottom-0 z-40 shrink-0 border-t px-2 pt-2 backdrop-blur">
      <div className="flex justify-around">
        {ITEMS.map(({ href, Icon, label, match }) => {
          const active = pathname.startsWith(match);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 rounded-lg px-1.5 py-1 text-[10px] font-medium transition",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} />
              {label}
            </Link>
          );
        })}
      </div>
      <div className="bg-foreground/30 mx-auto mt-1.5 mb-1 h-1 w-32 rounded-full" />
    </nav>
  );
}
