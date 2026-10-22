import AskAiSheetPage from "./page";

// Renders INSIDE the RouteSheetShell mounted by layout.tsx, so the sheet is
// already rising while this waits; without it the slot's dark scrim and
// spinner stood in. Its body is the page itself (Pato, MESITA-2701: "the
// placeholders must be similar to the page you are loading, like the
// sizes"): Ask AI is Soon (MESITA-2168), the title row and the Soon state
// are fixed, so nothing moves when the page lands. When Memo mounts here
// and the page fetches, draw that page's skeleton instead.
export default function AskAiSheetLoading() {
  return <AskAiSheetPage />;
}
