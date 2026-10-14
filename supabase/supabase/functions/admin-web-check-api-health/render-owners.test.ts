import { assertEquals } from "jsr:@std/assert";
import { renderWorkspaceName } from "./render-owners.ts";

Deno.test("render owners: nested owner name", () => {
  assertEquals(
    renderWorkspaceName([{ owner: { name: "Canzeco Workspace" }, cursor: "c" }]),
    "Canzeco Workspace",
  );
});

Deno.test("render owners: flat name", () => {
  assertEquals(
    renderWorkspaceName([{ name: "Canzeco Workspace", id: "tea-1" }]),
    "Canzeco Workspace",
  );
});

Deno.test("render owners: empty list has no name", () => {
  assertEquals(renderWorkspaceName([]), null);
  assertEquals(renderWorkspaceName(null), null);
});
