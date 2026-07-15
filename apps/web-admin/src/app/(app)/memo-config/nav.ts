import { MessagesSquare } from "lucide-react";

// One sidebar entry — "Memo Config". Tunes the consumer AI concierge. A single
// flat page, no sub-tabs.
export const MEMO_PARENT = {
  href: "/memo-config",
  label: "Memo Config",
  Icon: MessagesSquare,
} as const;
