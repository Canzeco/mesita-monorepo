import { assertEquals } from "jsr:@std/assert@1";

import { deliverPush, reservationPushMessage } from "./push.ts";

Deno.test("the push is the place name and the state, and nothing else", () => {
  const message = reservationPushMessage("Café Central", "confirmed");
  assertEquals(message, {
    title: "Café Central",
    body: "confirmed",
    data: { place_name: "Café Central", state: "confirmed" },
  });
  assertEquals("amount" in message.data, false);
  assertEquals(JSON.stringify(message).includes("http"), false);
});

Deno.test("a missing place name still sends the state", () => {
  const message = reservationPushMessage("(unnamed)", "declined");
  assertEquals(message.title, "Reservation");
  assertEquals(message.data, { state: "declined" });
});

Deno.test("a dead provider is tried three times and then stops", async () => {
  let calls = 0;
  const sent = await deliverPush(["ExponentPushToken[x]"], reservationPushMessage("A", "confirmed"), () => {
    calls += 1;
    return Promise.resolve({ ok: false });
  });
  assertEquals(sent, false);
  assertEquals(calls, 3);
});

Deno.test("the first success is not sent again", async () => {
  let calls = 0;
  const sent = await deliverPush(["ExponentPushToken[x]"], reservationPushMessage("A", "confirmed"), () => {
    calls += 1;
    return Promise.resolve({ ok: true });
  });
  assertEquals([sent, calls], [true, 1]);
});

Deno.test("no token means no request", async () => {
  let calls = 0;
  const sent = await deliverPush(["", ""], reservationPushMessage("A", "confirmed"), () => {
    calls += 1;
    return Promise.resolve({ ok: true });
  });
  assertEquals([sent, calls], [false, 0]);
});
