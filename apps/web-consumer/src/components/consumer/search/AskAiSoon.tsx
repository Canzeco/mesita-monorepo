import { BotMessageSquare } from "lucide-react";
import { HomeSoon } from "@/components/consumer/home/HomeSoon";

/** Ask AI's body, Soon for the moment (MESITA-2168). Like the Menu tab it
 *  says what Mesita is adding (MESITA-3415, MESITA-3991), not a persona
 *  nothing on screen has introduced. */
export function AskAiSoon() {
  return (
    <HomeSoon
      icon={BotMessageSquare}
      name="Ask AI"
      description="We're adding Ask AI in the next version of Mesita."
    />
  );
}
