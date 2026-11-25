import { fetch } from "expo/fetch";

import { secret } from "@/lib/storage";
import { authFetch, refreshToken, storedGuestId, supabase } from "@/lib/supabase";

const send = fetch as unknown as jest.Mock;
const REFRESH = "https://stub.supabase.co/auth/v1/token?grant_type=refresh_token";

afterEach(() => jest.restoreAllMocks());

test("parallel 401s share one refresh", async () => {
  const refresh = jest
    .spyOn(supabase.auth, "refreshSession")
    .mockResolvedValue({ data: { session: { access_token: "t2" }, user: null }, error: null } as never);
  const all = await Promise.all([refreshToken(), refreshToken(), refreshToken()]);
  expect(all).toEqual(Array(3).fill({ kind: "member", token: "t2" }));
  expect(refresh).toHaveBeenCalledTimes(1);
  await refreshToken();
  expect(refresh).toHaveBeenCalledTimes(2);
});

test("a refresh that fails on the network, a 500 or a 429 is not a refusal", async () => {
  for (const status of [500, 503, 429]) {
    send.mockResolvedValue({ status });
    await expect(authFetch(REFRESH)).rejects.toThrow("Network request failed");
  }
  send.mockResolvedValue({ status: 400 });
  expect((await authFetch(REFRESH)).status).toBe(400);
  send.mockResolvedValue({ status: 429 });
  expect((await authFetch("https://stub.supabase.co/auth/v1/otp")).status).toBe(429);
});

test("the stored guest is read with no network", async () => {
  send.mockReset();
  expect(await storedGuestId()).toBeNull();
  await secret.set("mesita.session", JSON.stringify({ access_token: "x", user: { id: "g1" } }));
  expect(await storedGuestId()).toBe("g1");
  await secret.set("mesita.session", "not json");
  expect(await storedGuestId()).toBeNull();
  expect(send).not.toHaveBeenCalled();
});
