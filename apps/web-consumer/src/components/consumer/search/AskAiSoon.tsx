import { BotMessageSquare } from "lucide-react";
import { HomeSoon } from "@/components/consumer/home/HomeSoon";

/** Ask AI's body, Soon for the moment (MESITA-2168): the sheet over Search
 *  and the cold-loaded page both draw it (one body, MESITA-3648). */
export function AskAiSoon() {
  return (
    <HomeSoon
      icon={BotMessageSquare}
      name="Ask AI"
      description="Asking Don Memo lands here shortly — thanks for waiting."
    />
  );
}
