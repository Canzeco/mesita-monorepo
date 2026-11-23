"use client";

import { Screen } from "@/components/consumer/nav/Screen";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/shared/EmptyState";
import { ReceiptText } from "lucide-react";
import { EFError } from "@/lib/api/_invoke";
import { apiGetPayment, type PayProof } from "@/lib/api/wallet";
import { payReceiptPath } from "@/lib/consumer-route-contract";
import { goBack, replaceAddress } from "@/lib/navigate";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import { isGone, NETWORK_FAILURE } from "./pay-common";
import { ProofSkeleton, ProofView } from "./ProofView";

// A PAID BILL'S PROOF, /pay/receipt/<paymentId> (MESITA-3459; its own
// address since MESITA-3614). Reached from the bill or the form when the
// guest pays, and from a Wallet or Me › Transactions row. Done lands where
// the guest came from (goBack), or on the Pay list when the receipt was
// opened from outside the app.
//
// MESITA-4708: no card part for a bill, so no Stripe Checkout return. An old
// /pay?payment=<id>&checkout=… link still lands here; `checkout` is dropped
// from the address and the receipt reads as it stands.

const CHECKOUT_PARAM = "checkout";

export function PayReceiptScreen({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const getSupabase = useLazyBrowserSupabase();
  const [proof, setProof] = useState<PayProof | null>(null);
  const [failed, setFailed] = useState(false);
  const leave = () => goBack(router);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    // The Stripe return is read once: a reload is the receipt, not a replay.
    if (params.has(CHECKOUT_PARAM)) replaceAddress(payReceiptPath(paymentId));
    const read = apiGetPayment(getSupabase(), paymentId);
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
    <Screen title="Pay" onBack={leave} flush paper>
      <div className="flex min-h-0 flex-1 flex-col px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {proof ? (
          <ProofView proof={proof} onChange={setProof} onDone={leave} />
        ) : failed ? (
          <EmptyState
            icon={ReceiptText}
            title="Couldn't open this payment"
            description="Check your connection and try again."
            action={{ label: "Back to Pay", onClick: leave }}
          />
        ) : (
          <ProofSkeleton />
        )}
      </div>
    </Screen>
  );
}
