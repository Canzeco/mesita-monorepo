import { ChatTabNav } from "./ChatTabNav";

// Chat is the only surface tab with an inner strip — it holds the agent that
// IS this surface (Memo) alongside the surface's own filter knobs. The outer
// Filters Config layout already supplies the page container, header and the
// seven-tab strip; this only adds the second row beneath it.
export default function ChatSurfaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <ChatTabNav />
      <div className="mt-6">{children}</div>
    </>
  );
}
