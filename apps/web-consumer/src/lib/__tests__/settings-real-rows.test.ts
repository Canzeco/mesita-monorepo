import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Settings shows only rows that do something (Pato, MESITA-2589: "remove
// stupid fake buttons from settings"). The four device prefs saved to
// localStorage and nothing read them; Export my data was a mailto; Delete
// account went with them.
const SRC = join(__dirname, "../..");
const SETTINGS = readFileSync(
  join(SRC, "components", "consumer", "me", "SettingsModal.tsx"),
  "utf8",
);

describe("Settings", () => {
  it("has no fake preference rows", () => {
    for (const label of [
      "Push notifications",
      "Default location",
      "Language",
      "Location",
    ]) {
      expect(SETTINGS).not.toContain(`label="${label}"`);
    }
    expect(SETTINGS).not.toMatch(/StoredToggleRow|StoredSelectRow|mesita:pref|mesita:perm|mesita:notif/);
  });

  it("has no Export my data or Delete account", () => {
    expect(SETTINGS).not.toContain('label="Export my data"');
    expect(SETTINGS).not.toContain('label="Delete account"');
    expect(SETTINGS).not.toContain("DeleteAccountSheet");
    expect(SETTINGS).not.toContain("MESITA_PRIVACY_EMAIL");
    expect(
      existsSync(join(SRC, "components", "consumer", "DeleteAccountSheet.tsx")),
    ).toBe(false);
  });

  it("keeps Phone, Contact, Sign out, Terms and Privacy", () => {
    expect(SETTINGS).toContain("<PhoneRow />");
    expect(SETTINGS).toContain("settingsContact");
    expect(SETTINGS).toContain("<SignOutButton");
    expect(SETTINGS).toContain("MESITA_TERMS_URL");
    expect(SETTINGS).toContain("MESITA_PRIVACY_URL");
  });
});
