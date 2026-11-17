"use client";

import { useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";
import { MesitaMark } from "@/components/brand/MesitaMark";
import { useViewer } from "@/lib/identity-context";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// THE WELCOME (MESITA-4246, Pato 2026-11-17: "un modal que flota sobre Home
// y te dice como usuario anónimo o este, regístrate ... y que te salga la
// propuesta de valor"). Once per device, over Home, to an anonymous visitor
// only. Create account goes to Sign; Explore anonymously or the close
// leaves Home as it is. The flag is read through useSyncExternalStore (no
// setState in an effect) and storage failures mean "already seen", so a
// private window never gets stuck behind it.
const SEEN_KEY = "mesita.welcomeSeen";
const listeners = new Set<() => void>();

function seen(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

function markSeen(): void {
  try {
    window.localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Nothing to keep; the dialog closes anyway.
  }
  for (const l of listeners) l();
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function WelcomeModal() {
  const viewer = useViewer();
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const alreadySeen = useSyncExternalStore(subscribe, seen, () => true);
  const open =
    viewer === "anonymous" && !alreadySeen && pathname.startsWith("/home");
  return (
    <LocalDialog open={open} onClose={markSeen} ariaLabel="Welcome to Mesita">
      <div className="flex flex-col items-center px-6 pt-7 pb-6 text-center">
        <MesitaMark className="h-10 w-10" />
        <p className="mt-4 text-base font-semibold">Discover your next favorite place.</p>
        <p className="text-muted-foreground mt-1.5 max-w-[280px] text-sm leading-relaxed">
          Find restaurants, cafés and bars near you. Create an account to save
          places, book tables and access offers.
        </p>
        <button
          type="button"
          onClick={() => {
            markSeen();
            router.push(CONSUMER_ROUTES.sign);
          }}
          className="bg-foreground text-paper mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl text-sm font-semibold transition hover:opacity-90 active:scale-[0.99]"
        >
          Create account
        </button>
        <button
          type="button"
          onClick={markSeen}
          className="text-foreground mt-2 inline-flex h-11 w-full items-center justify-center rounded-xl text-sm font-medium"
        >
          Explore anonymously
        </button>
      </div>
    </LocalDialog>
  );
}
