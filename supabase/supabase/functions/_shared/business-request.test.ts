// Mesita Business takes Google accounts only (MESITA-3105).
import { assertEquals } from "jsr:@std/assert@1";
import { isGoogleAccount } from "./business-request.ts";

// deno-lint-ignore no-explicit-any
const u = (emailLower: string | null, app_metadata: Record<string, unknown>) => ({ emailLower, raw: { app_metadata } as any });

Deno.test("a Google sign-in with an email is let in", () => {
  assertEquals(isGoogleAccount(u("ana@gmail.com", { provider: "google", providers: ["google"] })), true);
  assertEquals(isGoogleAccount(u("ana@canzeco.com", { provider: "phone", providers: ["phone", "google"] })), true);
});

Deno.test("a phone session, an email-only session or no email is refused", () => {
  assertEquals(isGoogleAccount(u(null, { provider: "phone", providers: ["phone"] })), false);
  assertEquals(isGoogleAccount(u("ana@gmail.com", { provider: "email", providers: ["email"] })), false);
  assertEquals(isGoogleAccount(u(null, { provider: "google", providers: ["google"] })), false);
});
