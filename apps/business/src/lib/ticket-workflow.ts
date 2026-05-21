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

// Composable step atoms. Each ticket type is the concatenation of a few
// of these in order — keeping them named means the copy lives in one
// place and the per-type sequences read like a script.
const ARRIVE_CASUAL: WorkflowStep = {
  title: "Arrive & enjoy",
  sub: "Enjoy your visit as usual. (Shown for clarity, not a real system event.)",
  forClarity: true,
};

const ARRIVE_AFTER_RESERVATION: WorkflowStep = {
  title: "Arrive & enjoy",
  sub: "Show up at the confirmed time and enjoy your visit as usual. (Shown for clarity, not a real system event.)",
  forClarity: true,
};

const ASK_FOR_BILL: WorkflowStep = {
  title: "Ask for the bill",
  sub: "When you're ready to leave, ask the waiter for your bill. (Shown so you know when Mesita comes in, not a real system event.)",
  forClarity: true,
};

const SHOW_QR: WorkflowStep = {
  title: "Show your QR to waiter",
  sub: "Open this coupon and show your personal QR code to the waiter.",
  action: "show-qr",
};

const VALIDATES_QR: WorkflowStep = {
  title: "Waiter validates QR",
  sub: "The waiter scans your QR and enters your bill total and tip.",
};

const PAY_FROM_PHONE: WorkflowStep = {
  title: "Pay from your phone",
  sub: "We send a secure payment link to your phone. Pay in a couple of taps.",
  action: "stripe-checkout",
};

const CASHBACK_LANDS: WorkflowStep = {
  title: "Cashback lands",
  sub: "Your cashback is added to your Mesita balance once payment clears.",
};

const CASHBACK_LANDS_AFTER_STORY: WorkflowStep = {
  title: "Cashback lands",
  sub: "Added once both payment and story are confirmed. No story, no cashback.",
};

const VALIDATES_SCREENSHOT: WorkflowStep = {
  title: "Waiter validates screenshot",
  sub: "The waiter confirms your story tagged the venue and shows the experience.",
};

// Story steps depend on the venue handle, so they're built per-call.
function postStoryStep(venueHandle: string): WorkflowStep {
  return {
    title: "Post story & submit screenshot",
    sub: `Post an Instagram story tagging ${venueHandle}, then upload a screenshot as proof. Keep it real: show the food, drinks, or the place itself. It's content for the venue, so make it look good.`,
    action: "attach-screenshot",
  };
}

function postStoryLateStep(venueHandle: string): WorkflowStep {
  return {
    title: "Post story & submit screenshot",
    sub: `Haven't posted yet? Post your story tagging ${venueHandle} and upload the screenshot now.`,
    action: "attach-screenshot",
  };
}

function callingStep(item: SavedItem, v: Venue): WorkflowStep {
  const when = item.when ?? "TBD";
  const party = `${item.partySize ?? 2} guests`;
  const confirmed = item.reservationStatus === "confirmed";
  return {
    title: confirmed ? "Reservation confirmed" : "Reserving your spot",
    sub: confirmed
      ? `${when} · ${party}`
      : `Calling ${v.name}… requesting ${when} · ${party}`,
  };
}

export function workflowFor(
  type: TicketType,
  item: SavedItem,
  v: Venue,
): WorkflowStep[] {
  const venueHandle = `@${v.id.replace(/-/g, "")}`;
  const calling = callingStep(item, v);
  const postStory = postStoryStep(venueHandle);
  const postStoryLate = postStoryLateStep(venueHandle);

  // PC and PSC are the casual-arrival variants; RPC and RPSC bolt the
  // calling step onto the front and swap in the reservation-aware arrival.
  const pcSteps: WorkflowStep[] = [
    ARRIVE_CASUAL,
    ASK_FOR_BILL,
    SHOW_QR,
    VALIDATES_QR,
    PAY_FROM_PHONE,
    CASHBACK_LANDS,
  ];

  const pscSteps: WorkflowStep[] = [
    ARRIVE_CASUAL,
    postStory,
    ASK_FOR_BILL,
    SHOW_QR,
    VALIDATES_QR,
    PAY_FROM_PHONE,
    postStoryLate,
    VALIDATES_SCREENSHOT,
    CASHBACK_LANDS_AFTER_STORY,
  ];

  switch (type) {
    case "R":
      return [calling, ARRIVE_AFTER_RESERVATION];
    case "PC":
      return pcSteps;
    case "RPC":
      return [calling, ARRIVE_AFTER_RESERVATION, ...pcSteps.slice(1)];
    case "PSC":
      return pscSteps;
    case "RPSC":
      return [calling, ARRIVE_AFTER_RESERVATION, ...pscSteps.slice(1)];
  }
}

export function getTicketType(item: SavedItem): TicketType {
  return ticketType(item.steps);
}
