// The two assistants Mesita's MCP is for (MESITA-3984), as their OFFICIAL
// icons (MESITA-3985): public/marks/chatgpt.svg and claude.svg, from
// Wikimedia Commons (public domain / CC0), shipped unchanged. Shown on
// Me › Integrations' MCP row.

/* eslint-disable @next/next/no-img-element -- static SVG files, no optimizer needed */

export type AssistantKind = "chatgpt" | "claude";

const FILES: Record<AssistantKind, string> = {
  chatgpt: "/marks/chatgpt.svg",
  claude: "/marks/claude.svg",
};

export function AssistantMark({ kind, size = 20 }: { kind: AssistantKind; size?: number }) {
  return (
    <img
      src={FILES[kind]}
      alt=""
      aria-hidden
      width={size}
      height={size}
      className="shrink-0 object-contain"
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
