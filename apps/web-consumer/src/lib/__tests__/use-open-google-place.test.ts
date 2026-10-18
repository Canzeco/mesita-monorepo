import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import {
  getOrCreateGooglePlace,
  googlePlaceIdOf,
} from "@/lib/use-open-google-place";

// The explicit open is the ONE consumer action that may create a Mesita
// Place (MESITA-2298 req 5): get-or-create by Google Place ID, idempotent, the
// held row opens as is. `getOrCreateGooglePlace` is that one call site; the
// opening screen awaits it. These tests drive it with a recording client.

type Body = Record<string, unknown>;

function fakeClient(answer: (fn: string, body: Body) => unknown) {
  const calls: Array<{ fn: string; body: Body }> = [];
  const invoke = async (fn: string, opts: { body: Body }) => {
    calls.push({ fn, body: opts.body });
    return { data: await answer(fn, opts.body), error: null };
  };
  const client = { functions: { invoke } } as unknown as SupabaseClient;
  return { calls, client };
}

const place = { id: "u1", slug: "casa", name: "Casa", state: "active" };

describe("googlePlaceIdOf", () => {
  it("reads the Google Place ID, else the slug a stub carries", () => {
    expect(googlePlaceIdOf({ name: "Casa", google_place_id: "ChIJx" })).toBe(
      "ChIJx",
    );
    expect(googlePlaceIdOf({ name: "Casa", slug: "ChIJy" })).toBe("ChIJy");
    expect(
      googlePlaceIdOf({ name: "Casa", google_place_id: "ChIJx", slug: "ChIJy" }),
    ).toBe("ChIJx");
  });

  it("is null when neither names a place", () => {
    expect(googlePlaceIdOf({ name: "Casa" })).toBeNull();
    expect(googlePlaceIdOf({ name: "Casa", google_place_id: "   " })).toBeNull();
    expect(
      googlePlaceIdOf({ name: "Casa", google_place_id: null, slug: "" }),
    ).toBeNull();
  });
});

describe("getOrCreateGooglePlace", () => {
  it("opens a held id as is: one create-place call, created false", async () => {
    const { calls, client } = fakeClient(() => ({
      ok: true,
      created: false,
      place,
    }));
    const opened = await getOrCreateGooglePlace(client, "ChIJ-held");
    expect(opened).toEqual({ href: "/place/casa", created: false });
    expect(calls).toEqual([
      {
        fn: "consumer-web-create-place",
        body: { googlePlaceId: "ChIJ-held" },
      },
    ]);
  });

  it("reports a real create, and an older EF with no flag as one", async () => {
    const minted = fakeClient(() => ({ ok: true, created: true, place }));
    expect(
      (await getOrCreateGooglePlace(minted.client, "ChIJ-new")).created,
    ).toBe(true);
    const older = fakeClient(() => ({ ok: true, place }));
    expect(
      (await getOrCreateGooglePlace(older.client, "ChIJ-older")).created,
    ).toBe(true);
  });

  it("routes by slug, falls back to the id, and refuses a row with neither", async () => {
    const byId = fakeClient(() => ({ ok: true, place: { ...place, slug: "" } }));
    expect((await getOrCreateGooglePlace(byId.client, "ChIJ-id")).href).toBe(
      "/place/u1",
    );
    const blank = fakeClient(() => ({
      ok: true,
      place: { ...place, id: "", slug: "" },
    }));
    await expect(
      getOrCreateGooglePlace(blank.client, "ChIJ-blank"),
    ).rejects.toThrow("Couldn't open that place right now.");
  });

  it("shares one request per Google Place ID while it is in flight", async () => {
    let release: (value: unknown) => void = () => {};
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const { calls, client } = fakeClient(() => gate);
    const first = getOrCreateGooglePlace(client, "ChIJ-same");
    const second = getOrCreateGooglePlace(client, "ChIJ-same");
    const other = getOrCreateGooglePlace(client, "ChIJ-other");
    expect(second).toBe(first);
    expect(other).not.toBe(first);
    expect(calls.map((c) => c.body.googlePlaceId)).toEqual([
      "ChIJ-same",
      "ChIJ-other",
    ]);
    release({ ok: true, created: false, place });
    await Promise.all([first, second, other]);
    // Settled, the id is free again: a later open asks the EF once more.
    await getOrCreateGooglePlace(client, "ChIJ-same");
    expect(calls.filter((c) => c.body.googlePlaceId === "ChIJ-same")).toHaveLength(
      2,
    );
  });

  it("surfaces the EF's refusal and lets a retry ask again", async () => {
    const { calls, client } = fakeClient(() => ({
      ok: false,
      error: "Creating places is off right now.",
      code: "create_on_open_off",
    }));
    await expect(getOrCreateGooglePlace(client, "ChIJ-off")).rejects.toThrow(
      "Creating places is off right now.",
    );
    await expect(getOrCreateGooglePlace(client, "ChIJ-off")).rejects.toThrow();
    expect(calls).toHaveLength(2);
    expect(new Set(calls.map((c) => c.fn))).toEqual(
      new Set(["consumer-web-create-place"]),
    );
  });
});
