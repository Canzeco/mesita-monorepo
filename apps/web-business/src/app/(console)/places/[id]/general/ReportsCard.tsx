import { Mail } from "lucide-react";
import { Card } from "@/components/shell/Page";

const ROW = "flex min-h-14 items-center gap-4 px-5 py-3 text-sm sm:px-6";
const FREQUENCIES = ["Daily", "Weekly", "Monthly"] as const;

// Reports (Pato, 2026-11-22, MESITA-4686: "a box at the bottom called
// Reports. there you simply say how often you want a report about the Mesita
// Performance … and send to what email. BUT LEAVE THAT AS SOON"). Shown, not
// live: the controls are off, nothing is stored and nothing is sent.
export function ReportsCard() {
  return (
    <Card className="flex flex-col p-0 sm:p-0">
      <div className="flex items-center gap-2 px-5 pt-4 pb-1 sm:px-6">
        <h2 className="font-semibold">Reports</h2>
        <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium">
          Soon
        </span>
      </div>
      <p className="text-muted-foreground px-5 pb-2 text-sm sm:px-6">
        A summary of your Mesita performance, by email.
      </p>
      <ul className="divide-border divide-y">
        <li className={ROW}>
          <span className="text-muted-foreground w-20 shrink-0">How often</span>
          <span className="flex flex-wrap gap-2">
            {FREQUENCIES.map((f) => (
              <span
                key={f}
                className="border-border text-muted-foreground rounded-full border px-3 py-1 text-sm"
              >
                {f}
              </span>
            ))}
          </span>
        </li>
        <li className={ROW}>
          <span className="text-muted-foreground w-20 shrink-0">Send to</span>
          <span className="bg-muted text-muted-foreground flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full px-4">
            <Mail size={16} aria-hidden />
            Email
          </span>
        </li>
      </ul>
    </Card>
  );
}
