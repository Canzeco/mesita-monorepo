"use client";

// What the owner sees the moment Stripe Checkout sends them back
// (MESITA-1927). Snapshot of `web-business`'s component of the same name, and
// the sibling of the `?connect=` notice `PayView` already renders for the
// other Stripe redirect.
//
// TWO OF THE THREE CASES ARE A RACE, AND THAT IS THE POINT. Stripe redirects
// the browser the instant the session completes, and the webhook that writes
// `places.partnered` arrives on its own connection — usually first, sometimes
// not. So "return" must NOT claim the partnership is live: it says the
// payment went through and the page catches up, which is true in both
// orderings. Promising more would be a green banner over a not-yet-partnered
// screen, which is the worst of both.
//
// "managed" is the Billing Portal's return_url, and it is the same race in
// the other direction: a cancellation lands in Stripe first and reaches the
// console through the webhook. It says they are back and the page catches up
// — true whether they cancelled, paid an invoice, or only looked.
//
// "cancelled" is Stripe's own cancel_url, reached by backing out of Checkout.
// Nothing was charged and nothing changed, and saying so plainly is the whole
// job: an owner who left on purpose does not need persuading, and one who hit
// the wrong button needs to know they can try again.
//
// THE MOCK CAN REACH ALL THREE, which is why the file is here at all. In the
// real console seeing any of them needs a card, a redirect and an unpartnered
// place; here they are a query string.
import { useSearchParams } from "next/navigation";
import { INFO_BOX_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

const NOTICES = {
  return:
    "Payment received — thank you. Your partnership turns on as soon as Stripe confirms it, usually within a few seconds; reload if this page still shows the price.",
  managed:
    "Back from Stripe. Anything you changed there — a cancellation, a new card — shows here as soon as Stripe confirms it, usually within a few seconds.",
  cancelled:
    "No payment was taken and nothing changed. The Membership is still here whenever you want it.",
} as const;

type NoticeKey = keyof typeof NOTICES;

export function MembershipReturnNotice() {
  const search = useSearchParams();
  const key = search.get("membership");
  if (!key || !(key in NOTICES)) return null;
  return (
    <div className={cn(INFO_BOX_CLASS, "px-4 py-3 text-[13px] leading-relaxed")} role="status">
      {NOTICES[key as NoticeKey]}
    </div>
  );
}
