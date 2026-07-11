import { MessagesSquare } from "lucide-react";

// One sidebar entry — "Memo Config". Memo is Mesita's consumer AI concierge (the
// consumer-web-ask-memo Edge Function); this page tunes its persona, model, and
// place-retrieval knobs. A single flat page, no sub-tabs.
export const MEMO_PARENT = {
  href: "/memo-config",
  label: "Memo Config",
  Icon: MessagesSquare,
} as const;
