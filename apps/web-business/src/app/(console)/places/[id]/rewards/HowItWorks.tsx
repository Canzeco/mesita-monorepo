// How a reward works at the table (Pato, MESITA-3265: "mention below like How it
// works and mention the flow"). Premier's card, in the order it happens, and the same
// whether or not a place code is set: the row above says so.

import { Card } from "@/components/shell/Page";

const HOW_IT_WORKS: Array<{ name: string; line: string }> = [
  {
    name: "The guest shows a QR",
    line: "They see the rewards that apply in Mesita, enter their bill and get a QR. It works for ten minutes, once.",
  },
  {
    name: "Your staff scan it",
    line: "visit.mesita.ai opens with the guest and their rewards, with no app or sign-in. If it won't scan, staff type the guest's member number and your place code there.",
  },
  {
    name: "Instagram Story is the guest's choice",
    line: "It only appears if the guest ticked it, so ask to see the story before you close the visit.",
  },
  {
    name: "Your staff close it",
    line: "Tap Received, correct the bill if it's wrong and type your place code.",
  },
  {
    name: "The guest pays you",
    line: "The page shows the discount and what the guest pays, and the visit lands in Visits. No money goes through Mesita.",
  },
];

export function HowItWorks() {
  return (
    <Card className="flex flex-col p-0 sm:p-0">
      <h2 className="px-5 pt-4 pb-2 font-semibold sm:px-6">How it works</h2>
      <ul className="divide-border divide-y">
        {HOW_IT_WORKS.map((row) => (
          <li key={row.name} className="px-5 py-3 text-sm sm:px-6">
            <p className="font-medium">{row.name}</p>
            <p className="text-muted-foreground">{row.line}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
