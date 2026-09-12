// createOrganizationAction (MESITA-1793). The ceremony redirects; a
// swallowed NEXT_REDIRECT is the failure that looks like a form error.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(__dirname, "..");
const ACTION = readFileSync(
  path.join(SRC, "app", "(shell)", "actions", "organizations.ts"),
  "utf8",
);

function createFn(): string {
  const start = ACTION.indexOf(
    "export async function createOrganizationAction",
  );
  const end = ACTION.indexOf("export async function updateOrganizationAction");
  return ACTION.slice(start, end);
}

describe("createOrganizationAction", () => {
  const fn = createFn();

  it("rejects an empty name before calling the EF", () => {
    expect(fn).toContain('if (!name) return { error: "Name is required." }');
    const empty = fn.indexOf("if (!name)");
    expect(empty).toBeGreaterThan(-1);
    expect(empty).toBeLessThan(fn.indexOf("apiCreateOrganization"));
  });

  it("mirrors the 120-character cap the input already has", () => {
    expect(fn).toContain("name.length > 120");
    expect(fn.indexOf("name.length > 120")).toBeLessThan(
      fn.indexOf("apiCreateOrganization"),
    );
  });

  it("catches only the Edge Function, never redirect", () => {
    const tryAt = fn.indexOf("try {");
    const catchAt = fn.indexOf("} catch");
    const tryBlock = fn.slice(tryAt, catchAt);
    expect(tryBlock).toContain("apiCreateOrganization");
    expect(tryBlock).not.toContain("redirect");
    expect(tryBlock).not.toContain("revalidatePath");
  });

  it("redirects to the new id after revalidate, outside the catch", () => {
    const code = fn
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(code).toContain("revalidatePath");
    expect(code).toContain("redirect(");
    expect(code.indexOf("} catch")).toBeLessThan(code.indexOf("redirect("));
    expect(code.indexOf("revalidatePath")).toBeLessThan(
      code.indexOf("redirect("),
    );
    expect(code).toContain("encodeURIComponent(created.id)");
  });

  it("names a missing id instead of redirecting to ?org=", () => {
    expect(fn).toContain("if (!created?.id)");
    expect(fn).toContain("Created organization is missing an id.");
  });
});

describe("the ceremony page", () => {
  it("has a form-shaped loading boundary, not the dashboard cards", () => {
    const loading = readFileSync(
      path.join(SRC, "app", "(shell)", "organization", "new", "loading.tsx"),
      "utf8",
    );
    expect(loading).not.toContain("h-[132px]");
    expect(loading).toContain("max-w-md");
  });

  it("sends a signed-out visitor back here after sign-in", () => {
    const page = readFileSync(
      path.join(SRC, "app", "(shell)", "organization", "new", "page.tsx"),
      "utf8",
    );
    expect(page).toContain('redirect("/signin?next=/organization/new")');
    expect(page).not.toContain("<Section");
  });
});
