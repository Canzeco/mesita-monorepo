import { MessagesSquare } from "lucide-react";

// One sidebar entry — "Memo Config" — sits directly below Atlas Config. Memo is
// Mesita's consumer AI concierge (the consumer-web-ask-memo Edge Function); this
// page is where operators tune its persona, model, and place-retrieval knobs.
// Single page, no sub-tabs (unlike Atlas), so there's no SUBROUTES list here.
export const MEMO_PARENT = {
  href: "/memo-config",
  label: "Memo Config",
  Icon: MessagesSquare,
} as const;
