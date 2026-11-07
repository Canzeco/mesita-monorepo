// How a reward works at the table (Pato, MESITA-3265: "mention below like How it
// works and mention the flow"). Premier's card, in the order it happens, and the same
// whether or not a place code is set: the row above says so. MESITA-3270: the shared
// visit, where staff type the bill and the guest confirms it.

import { Card } from "@/components/shell/Page";

const HOW_IT_WORKS: Array<{ name: string; line: string }> = [
  {
    name: "The guest shows a QR",
    line: "It works for ten minutes until it's scanned. Your staff scan it with their camera and visit.mesita.ai opens, with no app or sign-in. If it won't scan, staff type the guest's member number and your place code there.",
  },
  {
    name: "Your staff type the bill",
    line: "The full bill from the ticket, with your place code. It appears on the guest's phone and they confirm it. If it's wrong, staff change it and the guest confirms again.",
  },
  {
    name: "Both phones show the reward",
    line: "Mesita lists the rewards that apply and what the guest pays.",
  },
  {
    name: "Your staff check the Instagram Story",
    line: "Only if the guest can use it. Ask to see the story, then tap Seen it. If there isn't one, tap No story or let the guest skip it. Story only counts if staff saw it.",
  },
  {
    name: "The guest pays you",
    line: "Take the payment at your till, then tap Received. The visit lands in Visits. No money goes through Mesita.",
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
