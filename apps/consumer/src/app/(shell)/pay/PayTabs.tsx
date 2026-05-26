"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { QrCode, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/pay/qr", label: "QR", Icon: QrCode },
  { href: "/pay/wallet", label: "Wallet", Icon: Wallet },
];

export function PayTabs() {
  const pathname = usePathname();
  // Optimistic active href so the pill flips immediately on tap; reset on
  // every real pathname change via the "previous value" pattern (matches
  // DiscoverTabs, no useEffect needed).
  const [optimisticHref, setOptimisticHref] = useState<string | null>(null);
  const [lastPathname, setLastPathname] = useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setOptimisticHref(null);
  }

  const activeHref = optimisticHref ?? pathname;

  return (
    <div className="px-3 pt-2 pb-1">
      <div className="border-border bg-card/70 flex items-center gap-1 rounded-full border p-1 backdrop-blur">
        {TABS.map(({ href, label, Icon }) => {
          const active = activeHref === href;
          return (
            <Link
              key={href}
              href={href}
              prefetch
              onClick={() => {
                if (href !== pathname) setOptimisticHref(href);
              }}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-full px-2.5 py-2 text-[12px] font-medium transition",
                active
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
