"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/shared/EmptyState";
import { ReceiptText } from "lucide-react";
import { EFError } from "@/lib/api/_invoke";
import { apiGetPayment, apiReleasePayment, type PayProof } from "@/lib/api/wallet";
import { CONSUMER_ROUTES, payReceiptPath } from "@/lib/consumer-route-contract";
import { goBack, navigateTo, replaceAddress } from "@/lib/navigate";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import { PayFormSheet } from "./PayForm";
import { isGone, NETWORK_FAILURE, type Refill } from "./pay-common";
import { ProofSkeleton, ProofView } from "./ProofView";
import { usePayPlaces } from "./use-pay-places";

// A PAID BILL'S PROOF, /pay/receipt/<paymentId> (MESITA-3459; its own
// address since MESITA-3614). Reached from the bill or the form when the
// guest pays, from a Wallet or Me › Transactions row, and from Stripe:
// a card part comes back as /pay?payment=<id>&checkout=<session|cancel>,
// which /pay forwards here with `checkout` kept.
//
// Back from a cancelled Checkout (MESITA-3458), `?checkout=cancel`: the
// screen releases the payment first (consumer-web-release-payment expires
// the session and frees the held credit) and opens the form again over it
// with the same place, amount, tip and ticket and a quiet "Payment
// cancelled". Done lands where the guest came from (goBack), or on the Pay
// list when the receipt was opened from outside the app.

const CHECKOUT_PARAM = "checkout";
const CHECKOUT_CANCEL = "cancel";

export function PayReceiptScreen({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const getSupabase = useLazyBrowserSupabase();
  const [proof, setProof] = useState<PayProof | null>(null);
  const [failed, setFailed] = useState(false);
  const [refill, setRefill] = useState<Refill | null>(null);
  const { places, refresh } = usePayPlaces(null);
  const refillPlace = refill && places ? places.find((p) => p.place_id === refill.placeId) ?? null : null;
  const leave = () => goBack(router, CONSUMER_ROUTES.pay);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    const cancelledCheckout = params.get(CHECKOUT_PARAM) === CHECKOUT_CANCEL;
    // The Stripe event is read once: a reload is the receipt, not a replay.
    if (params.has(CHECKOUT_PARAM)) replaceAddress(payReceiptPath(paymentId));
    const read = cancelledCheckout
      ? apiReleasePayment(getSupabase(), paymentId).then((r) => {
        if (r.payment.status === "expired" || r.payment.status === "failed") {
          if (!cancelled && r.place_id) {
            setRefill({
              placeId: r.place_id,
              amountCents: r.payment.amount_cents,
              tipCents: r.payment.tip_cents ?? 0,
              ticket: r.ticket ?? "",
            });
          }
          return null;
        }
        return r.payment;
      })
      : apiGetPayment(getSupabase(), paymentId);
    void read
      .then((p) => {
        if (cancelled) return;
        if (p) setProof(p);
      })
      .catch((e) => {
        if (cancelled) return;
        if (isGone(e)) toast("This payment isn't on your account", { tone: "error" });
        else if (e instanceof EFError && e.code) toast("That payment isn't here.", { tone: "error" });
        else toast(NETWORK_FAILURE, { tone: "error" });
        setFailed(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentId]);

  return (
    <div className="scrollbar-hide flex h-full min-h-0 flex-col overflow-y-auto px-4 pt-6 pb-8">
      <h1 className="font-display text-2xl font-semibold tracking-tight">Pay</h1>
      <div className="mt-5 flex min-h-0 flex-1 flex-col">
        {proof ? (
          <ProofView proof={proof} onChange={setProof} onDone={leave} />
        ) : failed || refill ? (
          <EmptyState
            icon={ReceiptText}
            title={refill ? "Payment cancelled" : "Couldn't open this payment"}
            description={refill ? "Nothing was charged to your card." : "Check your connection and try again."}
            action={{ label: "Back to Pay", onClick: leave }}
          />
        ) : (
          <ProofSkeleton />
        )}
      </div>
      <PayFormSheet
        place={refillPlace}
        refill={refill}
        onClose={() => setRefill(null)}
        onPaid={(p) => {
          setRefill(null);
          setProof(p);
          replaceAddress(payReceiptPath(p.payment_id));
        }}
        onTaken={(id) => navigateTo(router, payReceiptPath(id), { replace: true })}
        onRefresh={refresh}
      />
    </div>
  );
}
