// The two assistants Mesita's MCP is for (MESITA-3984, Pato: "ALSO ADD ICONS
// FOR CHATGPT AND CLAUDE BTW"). Simplified app marks drawn inline, the
// calendar marks' shape (calendar-marks.tsx): a 24-unit rounded tile in the
// app's own colours. Shown on Me › Integrations' MCP row.

export type AssistantKind = "chatgpt" | "claude";

function ChatGptMark({ size }: { size: number }) {
  // Six rounded links around the centre, ChatGPT's knot reduced to a ring.
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <rect x="1" y="1" width="22" height="22" rx="5" fill="#0D0D0D" />
      <g fill="none" stroke="#fff" strokeWidth="1.3">
        {[0, 60, 120, 180, 240, 300].map((deg) => (
          <rect
            key={deg}
            x="9.6"
            y="4.6"
            width="4.8"
            height="8.4"
            rx="2.4"
            transform={`rotate(${deg} 12 12)`}
          />
        ))}
      </g>
    </svg>
  );
}

function ClaudeMark({ size }: { size: number }) {
  // Claude's sunburst: rays of two lengths around the centre.
  const rays = Array.from({ length: 12 }, (_, i) => i * 30);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <rect x="1" y="1" width="22" height="22" rx="5" fill="#D97757" />
      <g stroke="#fff" strokeWidth="1.7" strokeLinecap="round">
        {rays.map((deg, i) => {
          const r = i % 2 === 0 ? 7 : 5.4;
          const rad = (deg * Math.PI) / 180;
          return (
            <line
              key={deg}
              x1={12 + 1.6 * Math.cos(rad)}
              y1={12 + 1.6 * Math.sin(rad)}
              x2={12 + r * Math.cos(rad)}
              y2={12 + r * Math.sin(rad)}
            />
          );
        })}
      </g>
    </svg>
  );
}

const MARKS: Record<AssistantKind, (p: { size: number }) => React.ReactElement> = {
  chatgpt: ChatGptMark,
  claude: ClaudeMark,
};

export function AssistantMark({ kind, size = 20 }: { kind: AssistantKind; size?: number }) {
  const Mark = MARKS[kind];
  return <Mark size={size} />;
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
