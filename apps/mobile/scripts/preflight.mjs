// node scripts/preflight.mjs NAME… [--test-code] — fails naming the credential
// that is missing. --test-code also signs in with the test number (a test
// number sends no text). It prints no value.

import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const names = args.filter((a) => !a.startsWith("--"));
const missing = names.filter((name) => !process.env[name]?.trim());
if (missing.length > 0) {
  console.error(`Missing in Expo's preview environment: ${missing.join(", ")} (MESITA-4944).`);
  process.exit(1);
}

if (args.includes("--test-code")) {
  const { env } = JSON.parse(readFileSync(new URL("../eas.json", import.meta.url), "utf8")).build.preview;
  const phone = process.env.MAESTRO_TEST_PHONE;
  const post = (path, body) =>
    fetch(`${env.EXPO_PUBLIC_SUPABASE_URL}/auth/v1/${path}`, {
      method: "POST",
      headers: { apikey: env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const sent = await post("otp", { phone });
  const verified = sent.ok && (await post("verify", { phone, token: process.env.MAESTRO_TEST_CODE, type: "sms" }));
  if (!verified || !verified.ok) {
    console.error(
      `The test number did not sign in (${sent.status}${verified ? `, ${verified.status}` : ""}). ` +
        "Its code may have lapsed: extend Supabase › Auth › Phone › Test phone numbers.",
    );
    process.exit(1);
  }
}
console.log("preflight: ok");
