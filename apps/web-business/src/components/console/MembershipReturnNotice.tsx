// What the owner sees the moment Stripe Checkout sends them back
// (MESITA-1877). The sibling of ConnectReturnNotice, and it exists for the
// same reason that one had to: a payment flow that returns you to an
// unchanged screen leaves you wondering whether it worked, and the badge is
// the wrong thing to find that out from.
//
// TWO CASES, AND THE FIRST ONE IS A RACE. Stripe redirects the browser the
// instant the session completes, and the webhook that writes
// `places.partnered` arrives on its own connection — usually first,
// sometimes not. So "return" must NOT claim the partnership is live: it says
// the payment went through and the page catches up, which is true in both
// orderings. Promising more would be a green banner over a not-yet-partnered
// screen, which is the worst of both.
//
// "cancelled" is Stripe's own cancel_url, reached by backing out of Checkout.
// Nothing was charged and nothing changed, and saying so plainly is the whole
// job — an owner who left on purpose does not need persuading, and one who
// hit the wrong button needs to know they can try again.
export function MembershipReturnNotice({
  membership,
}: {
  membership?: string;
}) {
  if (membership !== "return" && membership !== "cancelled") return null;
  return (
    <div
      role="status"
      className="border-border bg-muted/40 text-foreground rounded-2xl border px-4 py-3 text-sm leading-relaxed"
    >
      {membership === "return"
        ? "Payment received — thank you. Your partnership turns on as soon as Stripe confirms it, usually within a few seconds; reload if this page still shows the price."
        : "No payment was taken and nothing changed. The membership is still here whenever you want it."}
    </div>
  );
}
