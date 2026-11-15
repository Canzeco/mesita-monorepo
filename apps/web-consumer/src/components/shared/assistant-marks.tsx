// The two assistants Mesita's MCP is for (MESITA-3984), as their app icons
// (MESITA-3987): Claude's official symbol white on its orange tile,
// ChatGPT's official knot black on white — public/marks/{claude,chatgpt}-app.svg,
// built from the Wikimedia Commons files (public domain / CC0) — on the one
// app tile (AppTile, MESITA-3990). Shown on Me › Integrations' MCP row.

import { AppTile } from "./app-tile";

export type AssistantKind = "chatgpt" | "claude";

const FILES: Record<AssistantKind, string> = {
  chatgpt: "/marks/chatgpt-app.svg",
  claude: "/marks/claude-app.svg",
};

export function AssistantMark({ kind, size = 28 }: { kind: AssistantKind; size?: number }) {
  return <AppTile src={FILES[kind]} inset={false} size={size} />;
}

/** ChatGPT then Claude, side by side, the calendar row's spacing. */
export function AssistantMarksRow({ size = 28 }: { size?: number }) {
  return (
    <span className="flex items-center gap-1.5" aria-hidden>
      <AssistantMark kind="chatgpt" size={size} />
      <AssistantMark kind="claude" size={size} />
    </span>
  );
}
