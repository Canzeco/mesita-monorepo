import { describe, expect, it, vi } from "vitest";
import { apiFetchPlaceDetail } from "@/lib/api/places";

// Data loss (MESITA-4917): `?gone` un-saves, so only a 404 may mean gone.
const client = (status: number | null) =>
  ({
    functions: {
      invoke: vi.fn(async () => ({
        data: null,
        error: Object.assign(new Error("x"), {
          context: status ? new Response("{}", { status }) : undefined,
        }),
      })),
    },
  }) as unknown as Parameters<typeof apiFetchPlaceDetail>[0];

describe("a failed place read", () => {
  it("is gone only on a 404", async () => {
    expect(await apiFetchPlaceDetail(client(404), "dead")).toBeNull();
  });
  it.each([401, 500, 503, null])("throws on %s", async (status) => {
    await expect(apiFetchPlaceDetail(client(status), "up")).rejects.toThrow();
  });
});
