"use client";

import { useSyncExternalStore } from "react";
import Image from "next/image";
import { Outfit } from "next/font/google";
import { usePathname, useRouter } from "next/navigation";
import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";
import { MesitaMark } from "@/components/brand/MesitaMark";
import { useViewer } from "@/lib/identity-context";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// THE WELCOME (MESITA-4246, Pato 2026-11-17: "un modal que flota sobre Home
// y te dice como usuario anónimo o este, regístrate ... y que te salga la
// propuesta de valor"). Over Home, to an anonymous visitor only. Create
// account goes to Sign; Explore anonymously or the close leaves Home as it
// is. The flag is read through useSyncExternalStore (no setState in an
// effect); the server snapshot is "answered", so SSR never paints it.
//
// THE MONTERREY COVER (Pato, 2026-11-17, MESITA-4284: "use the monterrey
// background in thism modal. that modal looks like shit"; /plan-design-review,
// "Photo fills the card"): the card IS the sign-in cover photo (the terrace
// under the Cerro de la Silla, CoverAuthLayout's), 4:5, full bleed, no blur
// (MESITA-3746). A veil at the top holds the mark and the wordmark, a deep
// fade at the bottom holds the copy in white, a solid white Create account
// (MESITA-3795) and Explore anonymously in white text.
// The wordmark as the header and the sign-in cover write it (MESITA-3653).
const wordmarkFont = Outfit({ subsets: ["latin"], weight: "700" });
const listeners = new Set<() => void>();

// EVERY PAGE LOAD (Pato, 2026-11-17, MESITA-4285: "when i reload page as an
// not user, redirect the home and first show the modal and ask the
// question"; /autoplan, gate answered rec): the answer lives in memory, not
// on the device, so every full load or new visit asks again until the guest
// has an account. Explore anonymously or the backdrop closes it for this load
// only; in-app tab taps keep the module alive and never bring it back. It
// was once per device (localStorage) before. Explore anonymously creates no
// Supabase session: there is none for anonymous visitors (MESITA-2137).
let answered = false;

function seen(): boolean {
  return answered;
}

function markSeen(): void {
  answered = true;
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
      <div className="relative aspect-[4/5] w-full bg-black text-white">
        <Image
          src="/auth/terrace.jpg"
          alt=""
          fill
          priority
          sizes="24rem"
          className="object-cover object-[center_35%]"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent via-30% to-black/90"
        />
        <div className="absolute inset-0 flex flex-col justify-between p-5">
          <span className="flex items-center gap-2 self-start select-none">
            <MesitaMark className="h-7 w-7" />
            <span
              className={`${wordmarkFont.className} text-2xl leading-none tracking-[-0.03em]`}
            >
              Mesita
            </span>
          </span>
          <div className="flex flex-col">
            <p className="font-display text-3xl leading-[1.1] font-semibold tracking-[-0.02em] text-balance">
              Discover your next favorite place.
            </p>
            <p className="mt-2 text-sm leading-snug text-white/80">
              Find restaurants, cafés and bars near you. Create an account to
              save places, book tables and access offers.
            </p>
            <button
              type="button"
              onClick={() => {
                markSeen();
                router.push(CONSUMER_ROUTES.sign);
              }}
              className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-white text-base font-semibold text-black shadow-[0_8px_24px_rgba(0,0,0,0.35)] transition hover:bg-white/90 active:scale-[0.99]"
            >
              Create account
            </button>
            <button
              type="button"
              onClick={markSeen}
              className="mt-1 inline-flex h-11 w-full items-center justify-center rounded-xl text-sm font-semibold text-white"
            >
              Explore anonymously
            </button>
          </div>
        </div>
      </div>
    </LocalDialog>
  );
}
