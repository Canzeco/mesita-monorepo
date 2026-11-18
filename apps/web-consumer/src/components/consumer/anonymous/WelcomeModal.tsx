"use client";

import { useSyncExternalStore } from "react";
import Image from "next/image";
import { Outfit } from "next/font/google";
import { usePathname, useRouter } from "next/navigation";
import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";
import { MesitaMark } from "@/components/brand/MesitaMark";
import { VALUE_LINE } from "@/components/auth/CoverAuthLayout";
import { useViewer } from "@/lib/identity-context";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// THE WELCOME (MESITA-4246, Pato 2026-11-17: "un modal que flota sobre Home
// y te dice como usuario anónimo o este, regístrate ... y que te salga la
// propuesta de valor"). Over Home, to an anonymous visitor only. Create
// account goes to Sign; Browse without an account or the close leaves Home as it
// is. The flag is read through useSyncExternalStore (no setState in an
// effect); the server snapshot is "answered", so SSR never paints it.
//
// THE MONTERREY COVER (Pato, 2026-11-17, MESITA-4284: "use the monterrey
// background in thism modal. that modal looks like shit"; /plan-design-review,
// "Photo fills the card"): the card IS the sign-in cover photo (the terrace
// under the Cerro de la Silla, CoverAuthLayout's), 4:5, full bleed, no blur
// (MESITA-3746). A veil at the top holds the mark and the wordmark, a deep
// fade at the bottom holds the copy in white, the green Continue with phone
// (MESITA-4287; a white Create account before) and Explore anonymously in
// white text.
//
// SIGN IN, NO METHOD (Pato, 2026-11-18, MESITA-4317: "continue with phone
// here just look weird. maybe login or sign … don't mention the method
// yet"; picked "Sign in / Not now"): the cover's value line (VALUE_LINE), a white Sign in and a
// plain second way, now Browse without an account (MESITA-4323). The phone comes up on the Sign page, not here.
// The wordmark as the header and the sign-in cover write it (MESITA-3653).
const wordmarkFont = Outfit({ subsets: ["latin"], weight: "700" });
const listeners = new Set<() => void>();

// EVERY PAGE LOAD (Pato, 2026-11-17, MESITA-4285: "when i reload page as an
// not user, redirect the home and first show the modal and ask the
// question"; /autoplan, gate answered rec): the answer lives in memory, not
// on the device, so every full load or new visit asks again until the guest
// has an account. Browse without an account or the backdrop closes it for this load
// only; in-app tab taps keep the module alive and never bring it back. It
// was once per device (localStorage) before. Browsing without an account creates no
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
              {VALUE_LINE}
            </p>
            <button
              type="button"
              onClick={() => {
                markSeen();
                router.push(CONSUMER_ROUTES.sign);
              }}
              // SIGN IN (MESITA-4317): white on the photo, the one action.
              // "Sign in" covers a returning guest and a new one alike: the
              // first code on a number creates the account (MESITA-4287).
              className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-white text-sm font-semibold text-neutral-900 transition hover:bg-white/90 active:scale-[0.99]"
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={markSeen}
              // BROWSE WITHOUT AN ACCOUNT (Pato, 2026-11-18, MESITA-4323:
              // "don't say not now ... continue with NO account ... keep it
              // LEAN"): plain white words on the photo, 44px tall, so the
              // white Sign in is the only button that shouts. "Not now"
              // (MESITA-4317) said nothing; "Explore anonymously"
              // (MESITA-4287) sounded like hiding; "as guest" is out because
              // a Mesita guest is a signed-in diner.
              className="mt-1 inline-flex h-11 w-full items-center justify-center rounded-xl text-sm font-semibold text-white/85 transition hover:text-white"
            >
              Browse without an account
            </button>
          </div>
        </div>
      </div>
    </LocalDialog>
  );
}
