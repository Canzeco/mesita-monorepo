"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Compass,
  Bookmark,
  QrCode,
  User,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePendingNotificationCount } from "@/lib/hooks/usePendingNotificationCount";

// Five top-level surfaces: Explore, Saved, Pay, Inbox, Me.

type Item = {
  href: string;
  Icon: LucideIcon;
  label: string;
  match: string;
  badge?: boolean;
};

const ITEMS: Item[] = [
  {
    href: "/explore/swipe",
    Icon: Compass,
    label: "Explore",
    match: "/explore",
  },
  {
    href: "/saved/places",
    Icon: Bookmark,
    label: "Saved",
    match: "/saved",
  },
  {
    href: "/pay",
    Icon: QrCode,
    label: "Pay",
    match: "/pay",
  },
  {
    href: "/inbox",
    Icon: Bell,
    label: "Inbox",
    match: "/inbox",
    badge: true,
  },
  { href: "/profile", Icon: User, label: "Me", match: "/profile" },
];

export function BottomNav({ userId }: { userId?: string }) {
  const pathname = usePathname();
  const pending = usePendingNotificationCount(userId);

  return (
    <nav className="border-border bg-card/95 z-40 shrink-0 border-t px-0.5 pt-2 backdrop-blur">
      <div className="flex items-end justify-around">
        {ITEMS.map(({ href, Icon, label, match, badge }) => {
          const active = pathname.startsWith(match);
          const showBadge = badge && pending > 0;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-0.5 py-1 text-[10px] font-medium transition",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {active && (
                <span className="bg-primary absolute -top-2 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full" />
              )}

              <span
                className={cn(
                  "relative flex h-8 w-8 items-center justify-center rounded-full transition",
                  active && "bg-primary/10 ring-primary/20 ring-1",
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} />
                {showBadge ? (
                  <span className="bg-secondary text-background absolute -top-0.5 -right-0.5 flex h-[14px] min-w-[14px] items-center justify-center rounded-full px-0.5 text-[9px] font-bold leading-none">
                    {pending > 9 ? "9+" : pending}
                  </span>
                ) : null}
              </span>
              <span className="w-full truncate text-center">{label}</span>
            </Link>
          );
        })}
      </div>
      <div className="bg-foreground/20 mx-auto mt-1.5 mb-1 h-1 w-32 rounded-full" />
    </nav>
  );
}
