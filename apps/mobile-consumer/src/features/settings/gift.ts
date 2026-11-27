import { z } from "zod";

import { callEdge } from "@/lib/edge";

const person = z.object({
  name: z.string().catch(""),
  you: z.boolean().catch(false),
}).nullish().catch(null);

const giftSchema = z.object({
  gift_id: z.string(),
  place_id: z.string().catch(""),
  amount_cents: z.number().catch(0),
  currency: z.string().catch("mxn"),
  status: z.string().catch(""),
  role: z.string().catch(""),
  created_at: z.string().catch(""),
  claimed_at: z.string().nullish().catch(null),
  taken_back_at: z.string().nullish().catch(null),
  place: z.object({ name: z.string().nullish().catch(null) }).nullish().catch(null),
  sender: person,
  recipient: person,
});

export type Gift = {
  id: string;
  placeId: string;
  place: string;
  amountCents: number;
  currency: string;
  status: string;
  createdAt: string;
  claimedAt: string | null;
  takenBackAt: string | null;
  sender: { name: string; you: boolean };
  recipient: { name: string; you: boolean } | null;
};

/** One gift from the wallet the Tickets page already reads. */
export function getGift(id: string, signal?: AbortSignal): Promise<Gift | null> {
  return callEdge(
    "consumer-web-get-wallet",
    {},
    z.object({ gifts: z.array(giftSchema).catch([]) }),
    { signal },
  ).then((answer) => {
    const gift = answer.gifts.find((row) => row.gift_id === id);
    if (!gift) return null;
    return {
      id: gift.gift_id,
      placeId: gift.place_id,
      place: gift.place?.name ?? "A Mesita place",
      amountCents: gift.amount_cents,
      currency: gift.currency,
      status: gift.status,
      createdAt: gift.created_at,
      claimedAt: gift.claimed_at ?? null,
      takenBackAt: gift.taken_back_at ?? null,
      sender: gift.sender ?? { name: "Someone", you: false },
      recipient: gift.recipient ?? null,
    };
  });
}

export function giftMoney(cents: number, currency: string): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: currency.toUpperCase() });
}

function who(person: { name: string; you: boolean } | null, none: string): string {
  if (!person) return none;
  return person.you ? "You" : person.name || none;
}

export function giftSentence(gift: Gift): string {
  const amount = giftMoney(gift.amountCents, gift.currency);
  if (gift.sender.you) return `You sent ${amount}`;
  if (gift.recipient?.you) return `${gift.sender.name} sent you ${amount}`;
  return `${gift.sender.name} sent ${amount}`;
}

export function giftOutcome(gift: Gift): string {
  const amount = giftMoney(gift.amountCents, gift.currency);
  if (gift.status === "open") return "Waiting for a friend to take it.";
  if (gift.status === "taken_back") {
    return gift.sender.you ? `You took it back. ${amount} is in your balance again.` : `${gift.sender.name} took it back.`;
  }
  if (gift.recipient?.you) return `You took ${amount} from ${gift.sender.name}.`;
  return `${who(gift.recipient, "A friend")} took ${amount}.`;
}

export function giftState(gift: Gift): string {
  if (gift.status === "open") return "Waiting for a friend";
  if (gift.status === "taken_back") return "Taken back";
  return "Taken";
}
