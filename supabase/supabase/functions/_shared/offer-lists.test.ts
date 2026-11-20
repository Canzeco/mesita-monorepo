import { assert, assertEquals } from "jsr:@std/assert@1";
import { withGuestOffers } from "./vouchers.ts";
import { withVouchersUpTo } from "./payments.ts";

const PLACE = "11111111-1111-4111-8111-111111111111";
const GUEST = "22222222-2222-4222-8222-222222222222";

function query(data: unknown) {
  const done = Promise.resolve({ data, error: null });
  const self = {
    select: () => self,
    eq: () => self,
    in: () => self,
    not: () => self,
    gt: () => self,
    is: () => self,
    maybeSingle: () => done,
    then: done.then.bind(done),
  };
  return self;
}

function admin(opts: { paused: boolean; handle: string | null; followers: number }) {
  const settings = {
    place_id: PLACE,
    stripe_payments: true,
    loyalty_cards: true,
    prepayments: true,
    voucher_200: true,
    voucher_1000: true,
    voucher_5000: true,
    voucher_welcome: true,
    voucher_story: true,
  };
  return {
    from(table: string) {
      if (table === "wallet_purchases" || table === "wallet_payments" || table === "stories") return query([]);
      if (table === "consumers") {
        return query({
          instagram_handle: opts.handle,
          instagram_followers_count: opts.followers,
          instagram_is_private: false,
          deleted_at: null,
        });
      }
      if (table === "app_config") {
        return query({
          money_config: { buying_paused: opts.paused, story_min_followers: 1000, story_emulator: false },
        });
      }
      if (table === "place_payment_settings") return query([settings]);
      if (table === "place_payment_accounts") {
        return query([{ place_id: PLACE, charges_enabled: true, livemode: false }]);
      }
      if (table === "profiles") return query([{ id: PLACE, instagram_url: "https://instagram.com/gran" }]);
      return query([]);
    },
  };
}

Deno.test("withGuestOffers drops Story when the guest cannot buy it", async () => {
  Deno.env.set("PAYMENTS_STRIPE_MODE", "test");
  const rows = await withGuestOffers(
    admin({ paused: false, handle: null, followers: 0 }) as never,
    GUEST,
    [{ id: PLACE, offers: { sell: ["voucher_welcome", "voucher_story"] as const } }],
  );
  assertEquals(rows[0].offers.sell.includes("voucher_story"), false);
  assert(rows[0].offers.sell.includes("voucher_welcome"));
});

Deno.test("withVouchersUpTo sells nothing while buying is paused", async () => {
  Deno.env.set("PAYMENTS_STRIPE_MODE", "test");
  const open = await withVouchersUpTo(admin({ paused: false, handle: "ana", followers: 5000 }) as never, [{ id: PLACE }]);
  assert(open[0].offers.sell.includes("voucher_story"), "an open place sells Story");
  const paused = await withVouchersUpTo(admin({ paused: true, handle: "ana", followers: 5000 }) as never, [{ id: PLACE }]);
  assertEquals(paused[0].offers.sell, []);
});

const CHIP_KEYS = ["voucher_200", "voucher_1000", "voucher_5000", "voucher_welcome", "voucher_story"];

Deno.test("chip percents match VOUCHER_CATALOG bonus_bps", async () => {
  const money = await Deno.readTextFile(new URL("./money.ts", import.meta.url));
  const offers = await Deno.readTextFile(new URL("../../../../packages/place-profile/src/lib/offers.ts", import.meta.url));
  for (const key of CHIP_KEYS) {
    const bps = money.match(new RegExp(`${key}:\\s*\\{[^}]*bonus_bps:\\s*(\\d+)`));
    const standard = offers.match(new RegExp(`${key}:\\s*(\\d+)`));
    const slide = offers.match(new RegExp(`bonus:\\s*(\\d+),\\s*voucher:\\s*"${key}"`));
    const pct = standard ? Number(standard[1]) : slide ? Number(slide[1]) : null;
    assert(bps, key);
    assertEquals(pct, Number(bps[1]) / 100, key);
  }
});

Deno.test("the catalog and map lists never call getUser", async () => {
  for (const path of ["consumer-web-list-catalog", "consumer-web-list-places"]) {
    const src = await Deno.readTextFile(new URL(`../${path}/index.ts`, import.meta.url));
    assertEquals(/getUser|getAuthedUser|getOptionalAuthedUser/.test(src), false, path);
  }
});
