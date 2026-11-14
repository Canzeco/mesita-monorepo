// The two assistants Mesita's MCP is for (MESITA-3984), as their APP icons
// (MESITA-3987, Pato sending his dock: "fucking icons"): Claude's official
// symbol in white on its orange tile, ChatGPT's official knot in black on a
// white tile with a hairline — public/marks/{claude,chatgpt}-app.svg, built
// from the Wikimedia Commons files (public domain / CC0) of MESITA-3985.
// Shown on Me › Integrations' MCP row.

/* eslint-disable @next/next/no-img-element -- static SVG files, no optimizer needed */

export type AssistantKind = "chatgpt" | "claude";

const FILES: Record<AssistantKind, string> = {
  chatgpt: "/marks/chatgpt-app.svg",
  claude: "/marks/claude-app.svg",
};

export function AssistantMark({ kind, size = 20 }: { kind: AssistantKind; size?: number }) {
  return (
    <img
      src={FILES[kind]}
      alt=""
      aria-hidden
      width={size}
      height={size}
      className={`shrink-0 object-contain ${kind === "chatgpt" ? "rounded-[22.5%] ring-1 ring-black/10" : ""}`}
      style={{ width: size, height: size }}
      draggable={false}
    />
  );
}

/** ChatGPT then Claude, side by side, the calendar row's spacing. */
export function AssistantMarksRow({ size = 20 }: { size?: number }) {
  return (
    <span className="flex items-center gap-1.5" aria-hidden>
      <AssistantMark kind="chatgpt" size={size} />
      <AssistantMark kind="claude" size={size} />
    </span>
  );
}
