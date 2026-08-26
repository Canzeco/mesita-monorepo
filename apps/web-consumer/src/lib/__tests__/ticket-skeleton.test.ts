import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..", "..");

function read(rel: string): string {
  return readFileSync(join(SRC, rel), "utf8");
}

// Hard-load and list-load must share one silhouette (MESITA-1336). A second
// inline pulse block in TicketScreen is the original lie class.
describe("TicketSkeleton is the one ticket loading silhouette", () => {
  it("hard-load and list-load both render TicketSkeleton", () => {
    expect(read("app/(shell)/visit/[id]/loading.tsx")).toContain(
      "TicketSkeleton",
    );
    expect(read("components/consumer/rewards/TicketScreen.tsx")).toContain(
      "TicketSkeleton",
    );
  });

  it("the silhouette is chrome + rail + rounded-panel pass, not three bars", () => {
    const skeleton = read("components/consumer/rewards/TicketSkeleton.tsx");
    expect(skeleton).toContain("rounded-panel");
    expect(skeleton).toContain("rounded-full");
    expect(skeleton).toContain("border-b");
  });
});
