"use client";

import { Screen } from "@/components/consumer/nav/Screen";
import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CONSUMER_ROUTES, payPlacePath, payReceiptPath, payTabPath } from "@/lib/consumer-route-contract";
import { goBack, navigateTo, replaceAddress } from "@/lib/navigate";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { locationSnapshot } from "@/lib/use-user-location";
import { GuestPayScreen } from "./GuestPayScreen";
import { CloseX } from "./pay-flow";
import { PayFormSheet } from "./PayForm";
import { writeOpenTabId } from "./pay-common";
import { TabView, type TabStart } from "./TabView";
import { usePayPlaces } from "./use-pay-places";

// THE BILL AT THE TABLE (MESITA-3564, TabView.tsx), at two addresses
// (MESITA-3614):
//
//   /pay/<placeId>   the door: opens (or reuses) the guest's bill there, then
//                    rewrites the address to the bill's own. The table QR's
//                    /pay?place=, the place screen's Pay and the Wallet's
//                    "Pay here" all come through it.
//   /pay/tab/<id>    the bill itself; a reload shows the same bill.
//
// Back and Done land where the guest came from (goBack), or on the Pay list
// when the bill was opened from outside the app. "Waiter gave you a code?"
// opens the older form as a sheet over the bill; paying there opens the
// receipt in the bill's place.

export function PayTabScreen({ start }: { start: TabStart }) {
  const router = useRouter();
  const getSupabase = useLazyBrowserSupabase();
  // The places that take the waiter's code (and the form's place).
  // A fix already in hand gives the distance on Open (MESITA-3861); none is asked here.
  const [at] = useState(() => {
    const c = typeof window === "undefined" ? null : locationSnapshot().coords;
    return c ? { lat: Math.round(c.lat * 1000) / 1000, lng: Math.round(c.lng * 1000) / 1000 } : null;
  });
  const { places, failed, refresh } = usePayPlaces(at);
  const [formPlaceId, setFormPlaceId] = useState<string | null>(null);
  const formPlace = formPlaceId && places ? places.find((p) => p.place_id === formPlaceId) ?? null : null;
  const leave = () => goBack(router);
  // MESITA-3715: on the guest's steps the back arrow steps back first.
  const stepBack = useRef<(() => boolean) | null>(null);
  const registerBack = useCallback((back: (() => boolean) | null) => {
    stepBack.current = back;
  }, []);
  const back = () => {
    if (!stepBack.current?.()) leave();
  };
  // MESITA-3880: the guest's X sits top left, beside "Pay", in Back's place.
  const close = useRef<(() => void) | null>(null);
  const [hasClose, setHasClose] = useState(false);
  const registerClose = useCallback((fn: (() => void) | null) => {
    close.current = fn;
    setHasClose(fn !== null);
  }, []);

  return (
    <Screen
      title="Pay"
      onBack={back}
      noBack={start.kind === "place"}
      lead={hasClose ? <CloseX onClick={() => close.current?.()} label="Cancel this ticket" /> : undefined}
      flush
      paper
    >
      {/* MESITA-3739: white, no tab bar, and a fixed height chain down to
          each step's flexible part (keypad rows, the QR), so nothing scrolls. */}
      <div className="flex min-h-0 flex-1 flex-col px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {start.kind === "place" ? (
          // MESITA-3709: the guest pays alone; the waiter verifies after.
          <GuestPayScreen
            placeId={start.placeId}
            places={places}
            placesFailed={failed}
            getSupabase={getSupabase}
            onPaid={(id) => navigateTo(router, payTabPath(id), { replace: true })}
            onOpenPlace={(id) => navigateTo(router, payPlacePath(id), { replace: true })}
            onChoosePlace={() => navigateTo(router, `${CONSUMER_ROUTES.pay}?pick=1`, { replace: true })}
            registerBack={registerBack}
            registerClose={registerClose}
          />
        ) : (
        <TabView
          start={start}
          getSupabase={getSupabase}
          canUseCode={(placeId) => places?.some((p) => p.place_id === placeId) ?? false}
          onTabId={(id) => {
            writeOpenTabId(id);
            replaceAddress(payTabPath(id));
          }}
          onWaiterCode={setFormPlaceId}
          onDone={leave}
          onPayAgain={(placeId) => navigateTo(router, payPlacePath(placeId), { replace: true })}
          placeFor={(id) => places?.find((p) => p.place_id === id) ?? null}
          registerBack={registerBack}
          registerClose={registerClose}
        />
        )}
      </div>
      <PayFormSheet
        place={formPlace}
        refill={null}
        onClose={() => {
          setFormPlaceId(null);
          leave();
        }}
        onPaid={(p) => navigateTo(router, payReceiptPath(p.payment_id), { replace: true })}
        onTaken={(id) => navigateTo(router, payReceiptPath(id), { replace: true })}
        onRefresh={refresh}
      />
    </Screen>
  );
}
