"use client";

// THE SUSPENDED SCREEN (MESITA-4899): over the whole app, with the one way out.

import { useSyncExternalStore } from "react";
import { ShieldAlert } from "lucide-react";
import { MESITA_SUPPORT_EMAIL } from "@/lib/mesita-contact";
import { onSuspended, readSuspended } from "@/lib/suspended";

export function SuspendedScreen() {
  const on = useSyncExternalStore(onSuspended, readSuspended, () => false);
  if (!on) return null;
  return (
    <div className="bg-card fixed inset-0 z-[1000] flex flex-col items-center justify-center gap-3 px-6 text-center" role="alertdialog" aria-modal aria-labelledby="suspended-title" data-suspended>
      <ShieldAlert className="h-12 w-12 text-red-700" aria-hidden />
      <h1 id="suspended-title" className="text-xl font-semibold">Your account is suspended</h1>
      <p className="text-muted-foreground max-w-xs text-base">Too many of your tickets were closed by wrong waiter codes. Your credits are safe.</p>
      <a href={`mailto:${MESITA_SUPPORT_EMAIL}`} className="bg-foreground text-background mt-2 flex min-h-12 items-center justify-center rounded-full px-6 text-base font-semibold">
        Write to us
      </a>
      <p className="text-muted-foreground text-sm">{MESITA_SUPPORT_EMAIL}</p>
    </div>
  );
}
