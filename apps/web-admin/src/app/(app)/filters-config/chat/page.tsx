import { redirect } from "next/navigation";

// Chat parent → Memo, the substance of this surface. The filter knobs, the
// playground and the data-access reference are the other three inner tabs.
export default function ChatSurfaceIndex() {
  redirect("/filters-config/chat/memo");
}
