import { GiftCardDeck } from "@/components/consumer/share/GiftCardDeck";

// Canonical /share referral surface (/invite redirects here): the five gift
// cards, one per audience, no chrome header — also reached from the Me page's
// Share box (which renders the same GiftCardDeck).
export default function SharePage() {
  return (
    <div className="scrollbar-hide h-full overflow-y-auto px-4 pt-4 pb-6">
      <GiftCardDeck />
    </div>
  );
}
