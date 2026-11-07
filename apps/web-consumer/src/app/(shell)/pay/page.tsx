import { redirect } from "next/navigation";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// The bar's Pay tab (Pato, MESITA-3291: Pay again, after Reward, MESITA-3208
// and MESITA-3211); the route stays /pay. Its list is in layout.tsx
// (MESITA-3254). The bar's tab wears no tag (MESITA-3124).
//
// MONEY: a Mesita Prepay checkout (MESITA-3098) still returns here with
// `?prepay=<session>`, the return URL `consumer-web-start-prepay` was given.
// The Wallet is its own tab now (MESITA-3295), so that one return is sent on
// to /wallet, whose read credits the payment. Nothing else links it.
export default async function PayPage({ searchParams }: { searchParams: Promise<{ prepay?: string }> }) {
  const { prepay } = await searchParams;
  if (prepay) redirect(`${CONSUMER_ROUTES.wallet}?prepay=${encodeURIComponent(prepay)}`);
  return null;
}
