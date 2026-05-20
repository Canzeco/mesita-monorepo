import type { SavedItem, Venue } from "./guest-data";
import { ticketType } from "./guest-data";

export type WorkflowAction =
  | "attach-screenshot"
  | "show-qr"
  | "stripe-checkout";

export type WorkflowStep = {
  title: string;
  sub: string;
  action?: WorkflowAction;
  forClarity?: boolean;
};

export type TicketType = "R" | "PC" | "RPC" | "PSC" | "RPSC";

export function workflowFor(
  type: TicketType,
  item: SavedItem,
  v: Venue,
): WorkflowStep[] {
  const venueHandle = `@${v.id.replace(/-/g, "")}`;
  const when = item.when ?? "TBD";
  const party = `${item.partySize ?? 2} guests`;

  const callingTitle =
    item.reservationStatus === "confirmed"
      ? "Reservation confirmed"
      : "Reserving your spot";
  const callingSub =
    item.reservationStatus === "confirmed"
      ? `${when} · ${party}`
      : `Calling ${v.name}… requesting ${when} · ${party}`;

  const STEPS: Record<TicketType, WorkflowStep[]> = {
    R: [
      { title: callingTitle, sub: callingSub },
      {
        title: "Arrive & enjoy",
        sub: "Show up at the confirmed time and enjoy your visit as usual. (Shown for clarity, not a real system event.)",
        forClarity: true,
      },
    ],
    PC: [
      {
        title: "Arrive & enjoy",
        sub: "Enjoy your visit as usual. (Shown for clarity, not a real system event.)",
        forClarity: true,
      },
      {
        title: "Ask for the bill",
        sub: "When you're ready to leave, ask the waiter for your bill. (Shown so you know when Mesita comes in, not a real system event.)",
        forClarity: true,
      },
      {
        title: "Show your QR to waiter",
        sub: "Open this coupon and show your personal QR code to the waiter.",
        action: "show-qr",
      },
      {
        title: "Waiter validates QR",
        sub: "The waiter scans your QR and enters your bill total and tip.",
      },
      {
        title: "Pay from your phone",
        sub: "We send a secure payment link to your phone. Pay in a couple of taps.",
        action: "stripe-checkout",
      },
      {
        title: "Cashback lands",
        sub: "Your cashback is added to your Mesita balance once payment clears.",
      },
    ],
    RPC: [
      { title: callingTitle, sub: callingSub },
      {
        title: "Arrive & enjoy",
        sub: "Show up at the confirmed time and enjoy your visit as usual. (Shown for clarity, not a real system event.)",
        forClarity: true,
      },
      {
        title: "Ask for the bill",
        sub: "When you're ready to leave, ask the waiter for your bill. (Shown so you know when Mesita comes in, not a real system event.)",
        forClarity: true,
      },
      {
        title: "Show your QR to waiter",
        sub: "Open this coupon and show your personal QR code to the waiter.",
        action: "show-qr",
      },
      {
        title: "Waiter validates QR",
        sub: "The waiter scans your QR and enters your bill total and tip.",
      },
      {
        title: "Pay from your phone",
        sub: "We send a secure payment link to your phone. Pay in a couple of taps.",
        action: "stripe-checkout",
      },
      {
        title: "Cashback lands",
        sub: "Your cashback is added to your Mesita balance once payment clears.",
      },
    ],
    PSC: [
      {
        title: "Arrive & enjoy",
        sub: "Enjoy your visit as usual. (Shown for clarity, not a real system event.)",
        forClarity: true,
      },
      {
        title: "Post story & submit screenshot",
        sub: `Post an Instagram story tagging ${venueHandle}, then upload a screenshot as proof. Keep it real: show the food, drinks, or the place itself. It's content for the venue, so make it look good.`,
        action: "attach-screenshot",
      },
      {
        title: "Ask for the bill",
        sub: "When you're ready to leave, ask the waiter for your bill. (Shown so you know when Mesita comes in, not a real system event.)",
        forClarity: true,
      },
      {
        title: "Show your QR to waiter",
        sub: "Open this coupon and show your personal QR code to the waiter.",
        action: "show-qr",
      },
      {
        title: "Waiter validates QR",
        sub: "The waiter scans your QR and enters your bill total and tip.",
      },
      {
        title: "Pay from your phone",
        sub: "We send a secure payment link to your phone. Pay in a couple of taps.",
        action: "stripe-checkout",
      },
      {
        title: "Post story & submit screenshot",
        sub: `Haven't posted yet? Post your story tagging ${venueHandle} and upload the screenshot now.`,
        action: "attach-screenshot",
      },
      {
        title: "Waiter validates screenshot",
        sub: "The waiter confirms your story tagged the venue and shows the experience.",
      },
      {
        title: "Cashback lands",
        sub: "Added once both payment and story are confirmed. No story, no cashback.",
      },
    ],
    RPSC: [
      { title: callingTitle, sub: callingSub },
      {
        title: "Arrive & enjoy",
        sub: "Show up at the confirmed time and enjoy your visit as usual. (Shown for clarity, not a real system event.)",
        forClarity: true,
      },
      {
        title: "Post story & submit screenshot",
        sub: `Post an Instagram story tagging ${venueHandle}, then upload a screenshot as proof. Keep it real: show the food, drinks, or the place itself. It's content for the venue, so make it look good.`,
        action: "attach-screenshot",
      },
      {
        title: "Ask for the bill",
        sub: "When you're ready to leave, ask the waiter for your bill. (Shown so you know when Mesita comes in, not a real system event.)",
        forClarity: true,
      },
      {
        title: "Show your QR to waiter",
        sub: "Open this coupon and show your personal QR code to the waiter.",
        action: "show-qr",
      },
      {
        title: "Waiter validates QR",
        sub: "The waiter scans your QR and enters your bill total and tip.",
      },
      {
        title: "Pay from your phone",
        sub: "We send a secure payment link to your phone. Pay in a couple of taps.",
        action: "stripe-checkout",
      },
      {
        title: "Post story & submit screenshot",
        sub: `Haven't posted yet? Post your story tagging ${venueHandle} and upload the screenshot now.`,
        action: "attach-screenshot",
      },
      {
        title: "Waiter validates screenshot",
        sub: "The waiter confirms your story tagged the venue and shows the experience.",
      },
      {
        title: "Cashback lands",
        sub: "Added once both payment and story are confirmed. No story, no cashback.",
      },
    ],
  };

  return STEPS[type];
}

export function getTicketType(item: SavedItem): TicketType {
  return ticketType(item.steps);
}
