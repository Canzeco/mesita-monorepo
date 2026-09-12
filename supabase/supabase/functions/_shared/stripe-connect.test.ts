// The PLATFORM law as executable tests: the controller + capabilities
// literals are FROZEN — changing them is changing the payments architecture
// (place as merchant of record, direct charges, IFPE shield) and must be a
// deliberate, gated decision, not a drive-by edit.

import { assert, assertEquals } from "jsr:@std/assert@1";
import type Stripe from "npm:stripe@17";
import {
  accountSnapshotFromStripe,
  classifyExistingAccount,
  isMockConnectAccountId,
  isSupportedConnectCountry,
  isSupportedConnectEntityType,
  connectApiVersion,
  keyIsLive,
  CONNECT_API_VERSION,
  connectAccountCreateParams,
  connectAccountIdempotencyKey,
  connectPairingHolds,
  EXPRESS_STRIPE_LOSSES_MIN_VERSION,
  isAbsoluteHttpsUrl,
  MESITA_CONNECT_CAPABILITIES,
  MESITA_CONNECT_CONTROLLER,
  MESITA_CONNECT_COUNTRIES,
  MESITA_CONNECT_ENTITY_TYPES,
  mockConnectAccountId,
} from "./stripe-connect.ts";

Deno.test("PLATFORM law: the controller literal is the Express-dashboard configuration", () => {
  assertEquals(MESITA_CONNECT_CONTROLLER, {
    stripe_dashboard: { type: "express" },
    fees: { payer: "account" },
    losses: { payments: "stripe" },
    requirement_collection: "stripe",
  });
});

Deno.test("PLATFORM law: the IFPE posture survives Express — Stripe eats losses, the place pays fees", () => {
  // This is the whole reason the Express pivot was allowed (MESITA-1532).
  // If a future edit sets fees.payer to "application", Stripe forces platform
  // loss liability and Mesita enters the funds flow — the exact thing the
  // 2026-08-29 gate exists to prevent.
  assertEquals(MESITA_CONNECT_CONTROLLER.fees.payer, "account");
  assertEquals(MESITA_CONNECT_CONTROLLER.losses.payments, "stripe");
  // Stripe collects KYC: the hosted flow is what keeps us out of PII storage.
  assertEquals(MESITA_CONNECT_CONTROLLER.requirement_collection, "stripe");
});

// ── THE PAIRING (MESITA-1643) ────────────────────────────────────────────
//
// The assertion that used to sit in the test above read:
//
//   assert(fees.payer !== "account" || losses.payments === "stripe")
//
// placed AFTER assertEquals pinned both values. That is `false || true`. It
// could not fail, and its comment said "Assert the PAIR, not just the values."
// It was green through the entire MESITA-1623 outage.
//
// The real invariant spans two facts, and the old test file imported only one
// of them. The version now lives beside the controller, so this test can see
// both — and it is the test that would have failed on MESITA-1532's PR.

Deno.test("the controller and the API version are ONE fact, and they agree", () => {
  assert(
    connectPairingHolds(MESITA_CONNECT_CONTROLLER, CONNECT_API_VERSION),
    `controller ${JSON.stringify(MESITA_CONNECT_CONTROLLER)} is not accepted at ` +
      `API version ${CONNECT_API_VERSION} — Express + fees.payer=account + ` +
      `losses.payments=stripe needs ${EXPRESS_STRIPE_LOSSES_MIN_VERSION} or later`,
  );
});

Deno.test("connectPairingHolds actually fails on the combination Stripe rejected", () => {
  // The exact 400 of 2026-09-07: today's controller on the GA version the
  // platform pins everywhere else.
  assertEquals(
    connectPairingHolds(
      {
        stripe_dashboard: { type: "express" },
        fees: { payer: "account" },
        losses: { payments: "stripe" },
      },
      "2025-03-31.basil",
    ),
    false,
  );
});

Deno.test("the pairing rule is VACUOUS for a non-Express dashboard", () => {
  // Deliberate: if the controller ever returns to `full`, the Standard mapping
  // is GA on any version and this rule must stop constraining anything rather
  // than start lying. That is what makes the guard survive the open decision.
  for (const dashboard of ["full", "none"]) {
    assertEquals(
      connectPairingHolds(
        {
          stripe_dashboard: { type: dashboard },
          fees: { payer: "account" },
          losses: { payments: "stripe" },
        },
        "2025-03-31.basil",
      ),
      true,
    );
  }
});

// ── THE PARAMS STRIPE ACTUALLY RECEIVES ──────────────────────────────────
//
// These were an inline literal inside the EF, so nothing could assert them
// without a network call — and the params are exactly where the outage lived.

Deno.test("accounts.create params carry the frozen controller and capabilities", () => {
  const params = connectAccountCreateParams({
    orgId: "org-1",
    country: "MX",
    entityType: "company",
    legalName: "Cabaret Social Room SA de CV",
  });
  assertEquals(params.country, "MX");
  assertEquals(params.controller, MESITA_CONNECT_CONTROLLER);
  assertEquals(params.capabilities, MESITA_CONNECT_CAPABILITIES);
  assertEquals(params.metadata, { organization_id: "org-1" });
  assertEquals(params.business_type, "company");
  assertEquals(params.company?.name, "Cabaret Social Room SA de CV");
  // NEVER the legacy `type` key: it forces fees.payer=application_express and
  // platform loss liability, the one thing this configuration exists to avoid.
  assertEquals((params as Record<string, unknown>).type, undefined);
});

Deno.test("accounts.create params carry MCC/url/RFC so hosted onboarding is not Software", () => {
  const params = connectAccountCreateParams({
    orgId: "org-1",
    country: "MX",
    entityType: "company",
    legalName: "Cabaret Social Room SA de CV",
    email: "hola@cabaret.mx",
    taxId: "CSR010101ABC",
    businessProfile: {
      mcc: "5812",
      url: "https://cabaret.mx/",
      product_description: "Late-night Mexican restaurant and cocktail bar in Roma Norte.",
      name: "Cabaret",
      support_phone: "+52 55 1234 5678",
      support_email: "hola@cabaret.mx",
    },
  });
  assertEquals(params.business_profile?.mcc, "5812");
  assertEquals(params.business_profile?.url, "https://cabaret.mx/");
  assertEquals(params.company?.tax_id, "CSR010101ABC");
  assertEquals(params.email, "hola@cabaret.mx");
  assertEquals(params.individual, undefined);
});

Deno.test("an individual's RFC is not sent — Stripe v17 has no individual.tax_id", () => {
  const params = connectAccountCreateParams({
    orgId: "org-1",
    country: "MX",
    entityType: "individual",
    legalName: "Someone",
    taxId: "XAXX010101000",
  });
  assertEquals(params.company, undefined);
  assertEquals(params.individual, undefined);
});

Deno.test("an individual gets no company.name — Stripe ignores it there", () => {
  const params = connectAccountCreateParams({
    orgId: "org-1",
    country: "MX",
    entityType: "individual",
    legalName: "Someone",
  });
  assertEquals(params.company, undefined);
  assertEquals(params.business_type, "individual");
});

Deno.test("a resume with no entity type sends neither key", () => {
  const params = connectAccountCreateParams({
    orgId: "org-1",
    country: "US",
    entityType: null,
    legalName: "",
  });
  assertEquals(params.business_type, undefined);
  assertEquals(params.company, undefined);
});

Deno.test("the idempotency key is stable per org+country, and varies by both", () => {
  // A lost response must not mint a second permanent account on retry.
  assertEquals(
    connectAccountIdempotencyKey("org-1", "MX"),
    connectAccountIdempotencyKey("org-1", "MX"),
  );
  assert(
    connectAccountIdempotencyKey("org-1", "MX") !==
      connectAccountIdempotencyKey("org-1", "US"),
  );
  assert(
    connectAccountIdempotencyKey("org-1", "MX") !==
      connectAccountIdempotencyKey("org-2", "MX"),
  );
});

Deno.test("Account Link urls must be absolute — a relative path is the bug", () => {
  // What `${origin}/?org=...` produced when origin was "" because the caller
  // is a server action with no Origin header.
  assertEquals(isAbsoluteHttpsUrl("/?org=abc&connect=return"), false);
  assertEquals(isAbsoluteHttpsUrl(""), false);
  assertEquals(isAbsoluteHttpsUrl(undefined), false);
  assertEquals(isAbsoluteHttpsUrl("business.mesita.ai/?org=abc"), false);
  assert(isAbsoluteHttpsUrl("https://business.mesita.ai/?org=abc&connect=return"));
  assert(isAbsoluteHttpsUrl("http://localhost:3002/?connect=return"));
});

Deno.test("country allowlist: only MX and US, and never a free-text passthrough", () => {
  assertEquals([...MESITA_CONNECT_COUNTRIES], ["MX", "US"]);
  assert(isSupportedConnectCountry("MX"));
  assert(isSupportedConnectCountry("US"));
  // Country is baked into the account permanently, so near-misses must fail.
  assert(!isSupportedConnectCountry("mx"));
  assert(!isSupportedConnectCountry("MEX"));
  assert(!isSupportedConnectCountry("México"));
  assert(!isSupportedConnectCountry(""));
  assert(!isSupportedConnectCountry(undefined));
  assert(!isSupportedConnectCountry(null));
  assert(!isSupportedConnectCountry(42));
});

Deno.test("PLATFORM law: capabilities are requested explicitly (typeless creation requests nothing implicitly)", () => {
  assertEquals(MESITA_CONNECT_CAPABILITIES, {
    card_payments: { requested: true },
    transfers: { requested: true },
  });
});

Deno.test("mock account ids are stable, per-place, and recognizable", () => {
  const id = mockConnectAccountId("11111111-2222-3333-4444-555555555555");
  assertEquals(id, "mock_acct_11111111-2222-3333-4444-555555555555");
  assert(isMockConnectAccountId(id));
  assert(!isMockConnectAccountId("acct_1ABC"));
});

Deno.test("keyIsLive reads the secret prefix only", () => {
  assert(keyIsLive("sk_live_abc"));
  assert(!keyIsLive("sk_test_abc"));
  assert(!keyIsLive(""));
});

Deno.test("snapshot mapper: livemode is explicit; optional/null requirements default safe", () => {
  const bare = accountSnapshotFromStripe(
    { id: "acct_1", charges_enabled: false } as unknown as Stripe.Account,
    false,
  );
  assertEquals(bare, {
    charges_enabled: false,
    details_submitted: false,
    payouts_enabled: false,
    requirements_due: [],
    disabled_reason: null,
    livemode: false,
    country: null,
  });

  const full = accountSnapshotFromStripe(
    {
      id: "acct_2",
      charges_enabled: true,
      details_submitted: true,
      payouts_enabled: true,
      requirements: {
        currently_due: ["external_account", "business_profile.url"],
        disabled_reason: "requirements.past_due",
      },
    } as unknown as Stripe.Account,
    true,
  );
  assertEquals(full.charges_enabled, true);
  assertEquals(full.requirements_due, ["external_account", "business_profile.url"]);
  assertEquals(full.disabled_reason, "requirements.past_due");
  assertEquals(full.livemode, true);

  const nullDue = accountSnapshotFromStripe(
    {
      id: "acct_3",
      requirements: { currently_due: null, disabled_reason: null },
    } as unknown as Stripe.Account,
    false,
  );
  assertEquals(nullDue.requirements_due, []);

  // Country comes from STRIPE's answer, never from what we requested — the
  // two can differ and Stripe's is the one that governs KYC and payouts.
  assertEquals(
    accountSnapshotFromStripe(
      { id: "acct_4", country: "MX" } as unknown as Stripe.Account,
      false,
    ).country,
    "MX",
  );
});

Deno.test("transition law: a COUNTRY mismatch is never replaceable", () => {
  // Universe mismatch is replaceable because the account is unreachable.
  // Country mismatch is NOT: the account is real, may hold KYC, may be taking
  // money, and country is per-account permanent. Silently minting a second
  // account and orphaning the first is the failure this guards.
  const mx = { stripe_account_id: "acct_mx", livemode: false, country: "MX" };
  assertEquals(
    classifyExistingAccount(mx, { mockMode: false, keyLive: false, country: "US" }),
    "use_country_mismatch",
  );
  assertEquals(
    classifyExistingAccount(mx, { mockMode: false, keyLive: false, country: "MX" }),
    "use",
  );
  // A row written before the column existed cannot be "wrong".
  const legacy = { stripe_account_id: "acct_old", livemode: false, country: null };
  assertEquals(
    classifyExistingAccount(legacy, { mockMode: false, keyLive: false, country: "US" }),
    "use",
  );
  // Universe mismatch still wins over country: an unreachable account is
  // replaceable no matter what country it claims.
  assertEquals(
    classifyExistingAccount(mx, { mockMode: false, keyLive: true, country: "US" }),
    "replace",
  );
  // Mock mode never touches a real row, country notwithstanding.
  assertEquals(
    classifyExistingAccount(mx, { mockMode: true, keyLive: false, country: "US" }),
    "return_untouched",
  );
});

Deno.test("transition law: mock never overwrites real; real replaces mock; universe mismatch replaceable", () => {
  const mockRow = { stripe_account_id: "mock_acct_p1", livemode: false };
  const testRow = { stripe_account_id: "acct_1", livemode: false };
  const liveRow = { stripe_account_id: "acct_2", livemode: true };

  // No row.
  assertEquals(classifyExistingAccount(null, { mockMode: true, keyLive: false }), "create");
  assertEquals(classifyExistingAccount(null, { mockMode: false, keyLive: false }), "create");
  // Mock mode: reuse mock, NEVER touch real.
  assertEquals(classifyExistingAccount(mockRow, { mockMode: true, keyLive: false }), "use");
  assertEquals(
    classifyExistingAccount(testRow, { mockMode: true, keyLive: false }),
    "return_untouched",
  );
  // Real mode: mock row treated as absent.
  assertEquals(classifyExistingAccount(mockRow, { mockMode: false, keyLive: false }), "replace");
  // Real mode, matching universe: use.
  assertEquals(classifyExistingAccount(testRow, { mockMode: false, keyLive: false }), "use");
  assertEquals(classifyExistingAccount(liveRow, { mockMode: false, keyLive: true }), "use");
  // Universe mismatch (rotated sandbox / live cutover): replaceable.
  assertEquals(classifyExistingAccount(testRow, { mockMode: false, keyLive: true }), "replace");
  assertEquals(classifyExistingAccount(liveRow, { mockMode: false, keyLive: false }), "replace");
});


Deno.test("entity allowlist: individual and company, and never a free-text passthrough", () => {
  assertEquals([...MESITA_CONNECT_ENTITY_TYPES], [
    "individual",
    "company",
    "non_profit",
    "government_entity",
  ]);
  assert(isSupportedConnectEntityType("individual"));
  assert(isSupportedConnectEntityType("company"));
  // Stripe-valid but deliberately not offered: no Mesita merchant is either,
  // and a branch nobody can finish is a support ticket, not a feature.
  assert(isSupportedConnectEntityType("non_profit"));
  assert(isSupportedConnectEntityType("government_entity"));
  // Still an allowlist, not a passthrough.
  assert(!isSupportedConnectEntityType("nonprofit"));
  assert(!isSupportedConnectEntityType("government"));
  // Near-misses and the shapes a form can actually send.
  assert(!isSupportedConnectEntityType("Individual"));
  assert(!isSupportedConnectEntityType("persona_fisica"));
  assert(!isSupportedConnectEntityType(""));
  assert(!isSupportedConnectEntityType(undefined));
  assert(!isSupportedConnectEntityType(null));
  assert(!isSupportedConnectEntityType(42));
});

Deno.test("entity type is a PREFILL, country is PERMANENT — the asymmetry is the law", () => {
  // Country is baked into the account and can only be changed by deleting it
  // at Stripe, which is why classifyExistingAccount refuses to re-mint on a
  // country mismatch. Entity type has no such clause anywhere: Stripe lets
  // the person change it inside hosted onboarding, so nothing here may start
  // treating a changed entity type as a reason to replace an account.
  const row = { stripe_account_id: "acct_1", livemode: false, country: "MX" };
  assertEquals(
    classifyExistingAccount(row, { mockMode: false, keyLive: false, country: "MX" }),
    "use",
  );
  assertEquals(
    classifyExistingAccount(row, { mockMode: false, keyLive: false, country: "US" }),
    "use_country_mismatch",
  );
});


Deno.test("the onboarding HANDLER builds its client from the Connect version, not the GA pin", async () => {
  // Reads the CALL SITE, never two constants. MESITA-1643 added
  // CONNECT_API_VERSION and a pairing predicate, and every test passed while
  // the handler still constructed Stripe with STRIPE_API_VERSION — so the
  // constant reached no runtime path and accounts.create kept 400ing. The
  // only question that matters is what the handler actually passes.
  const src = await Deno.readTextFile(
    new URL("../business-web-start-payment-onboarding/index.ts", import.meta.url),
  );
  const ctor = src.match(/new Stripe\([\s\S]{0,220}?\)\s*;/);
  assert(ctor, "onboarding EF must construct a Stripe client");
  assert(
    /connectApiVersion\(\)|CONNECT_API_VERSION/.test(ctor[0]),
    `onboarding EF must build its client from the Connect version; got: ${ctor[0]}`,
  );
  assert(
    !ctor[0].includes("STRIPE_API_VERSION"),
    "onboarding EF must NOT use the GA pin: it 400s the Express + Stripe-losses controller",
  );
});

Deno.test("the onboarding HANDLER prefills from org places before accounts.create", async () => {
  const src = await Deno.readTextFile(
    new URL("../business-web-start-payment-onboarding/index.ts", import.meta.url),
  );
  assert(
    src.includes("deterministicConnectPrefill"),
    "onboarding EF must send Atlas prefill on accounts.create",
  );
  assert(
    /businessProfile:\s*prefill\.businessProfile/.test(src),
    "onboarding EF must pass the prefill into connectAccountCreateParams",
  );
  assert(
    !src.includes("completePrefillWithLlm") && !src.includes("stripe.accounts.update"),
    "LLM must not sit between accounts.create and the mirror write — a concurrent retry would del the account",
  );
});

Deno.test("connectApiVersion: the Connect constant by default, env-overridable when Stripe rolls it", () => {
  const env: Record<string, string> = {};
  const read = (n: string) => env[n];
  assertEquals(connectApiVersion(read), CONNECT_API_VERSION);
  // Preview channel is `<date>.preview`; a GA string here silently reinstates
  // the 400, so assert the SHAPE and not just the value.
  assert(
    /^\d{4}-\d{2}-\d{2}\.preview$/.test(CONNECT_API_VERSION),
    `Connect version must be <date>.preview, got ${CONNECT_API_VERSION}`,
  );
  // What we send must still satisfy what Stripe requires.
  assert(connectPairingHolds(MESITA_CONNECT_CONTROLLER, CONNECT_API_VERSION));
  env.STRIPE_CONNECT_API_VERSION = "2027-01-01.preview";
  assertEquals(connectApiVersion(read), "2027-01-01.preview");
  env.STRIPE_CONNECT_API_VERSION = "   ";
  assertEquals(connectApiVersion(read), CONNECT_API_VERSION);
});

Deno.test("no merchant-facing Connect EF relays Stripe's own words to the browser", async () => {
  // Scoped to the CLASS of files, not the one that happened to be edited.
  // MESITA-1645 fixed the copy in start-payment-onboarding and guarded it
  // with a test whose SRC was that one file, so the identical passthrough
  // survived in get-payment-dashboard-link — the EF merchants actually reach.
  for (
    const ef of [
      "business-web-start-payment-onboarding",
      "business-web-get-payment-dashboard-link",
    ]
  ) {
    const src = await Deno.readTextFile(
      new URL(`../${ef}/index.ts`, import.meta.url),
    );
    assert(
      !/error:\s*message\s*,/.test(src),
      `${ef} hands the merchant Stripe's raw message. Log it; send them the house sentence.`,
    );
    assert(
      src.includes("nothing to fix on your end"),
      `${ef} must carry the house sentence for a platform-side failure`,
    );
  }
});
