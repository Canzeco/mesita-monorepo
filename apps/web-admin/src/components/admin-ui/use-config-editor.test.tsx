import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { useConfigEditor } from "./use-config-editor";

// MESITA-737: when the server load failed, the page holds fallbacks, not the
// live blob, so Save must stay blocked and a save must never reach the write.
// A static render runs no effects, so this pins the seeded state; the mount
// re-fetch that unblocks is the hook's own effect.

type Cfg = { n: number };
const load = async () => ({ ok: true as const, config: { n: 2 }, updatedAt: null });

function Probe({
  loadError,
  write,
}: {
  loadError: string | null;
  write?: (cfg: Cfg) => Promise<{ ok: true; config: Cfg }>;
}) {
  const ed = useConfigEditor({ initialConfig: { n: 1 }, initialUpdatedAt: null, loadError, load });
  if (write) ed.saveWith(write);
  return <p>{JSON.stringify({ blocked: ed.loadBlocked, error: ed.error, n: ed.cfg.n })}</p>;
}

describe("useConfigEditor", () => {
  it("seeds a failed server load as blocked, with its error showing", () => {
    const html = renderToStaticMarkup(<Probe loadError="boom" />);
    expect(html).toContain(JSON.stringify({ blocked: true, error: "boom", n: 1 }).replace(/"/g, "&quot;"));
  });

  it("never calls the write while blocked", () => {
    const write = vi.fn(async (cfg: Cfg) => ({ ok: true as const, config: cfg }));
    renderToStaticMarkup(<Probe loadError="boom" write={write} />);
    expect(write).not.toHaveBeenCalled();
  });

  it("seeds a good server load as unblocked, with no error", () => {
    const html = renderToStaticMarkup(<Probe loadError={null} />);
    expect(html).toContain(JSON.stringify({ blocked: false, error: null, n: 1 }).replace(/"/g, "&quot;"));
  });
});
