// MESITA-3971: the handshake Claude and ChatGPT run before any tool. A wrong
// reply here and the connector shows "couldn't connect" with no detail.

import { assert, assertEquals } from "jsr:@std/assert@1";
import { handleMcpBody, handleRpc, type ToolSpec } from "./mcp-rpc.ts";
import { searchWords } from "./mcp-tools.ts";
import { isLinkToken } from "./link-token.ts";

const TOOLS: ToolSpec[] = [{
  name: "echo",
  title: "Echo",
  description: "",
  inputSchema: { type: "object" },
}];
const call = (_: string, args: Record<string, unknown>) =>
  Promise.resolve({ text: String(args.x ?? "") });

Deno.test("initialize answers the client's version when known, else the newest", async () => {
  const a = await handleRpc(
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-03-26" },
    },
    TOOLS,
    call,
  );
  assertEquals(
    (a?.result as { protocolVersion: string }).protocolVersion,
    "2025-03-26",
  );
  const b = await handleRpc(
    {
      jsonrpc: "2.0",
      id: 2,
      method: "initialize",
      params: { protocolVersion: "1999-01-01" },
    },
    TOOLS,
    call,
  );
  assertEquals(
    (b?.result as { protocolVersion: string }).protocolVersion,
    "2025-06-18",
  );
  assert(
    (b?.result as { capabilities: { tools: unknown } }).capabilities.tools,
  );
});

Deno.test("a notification gets HTTP 202 and no body", async () => {
  const res = await handleMcpBody(
    JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    TOOLS,
    call,
  );
  assertEquals(res.status, 202);
});

Deno.test("tools/call runs the tool; an unknown tool is invalid params", async () => {
  const ok = await handleRpc(
    {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "echo", arguments: { x: "hi" } },
    },
    TOOLS,
    call,
  );
  assertEquals(
    (ok?.result as { content: Array<{ text: string }> }).content[0].text,
    "hi",
  );
  const bad = await handleRpc(
    { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "nope" } },
    TOOLS,
    call,
  );
  assertEquals(bad?.error?.code, -32602);
});

Deno.test("a tool that throws is an isError result, not a dead connection", async () => {
  const boom = () => Promise.reject(new Error("db down"));
  const r = await handleRpc(
    { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "echo" } },
    TOOLS,
    boom,
  );
  assertEquals((r?.result as { isError: boolean }).isError, true);
});

Deno.test("bad JSON is a parse error", async () => {
  const res = await handleMcpBody("{", TOOLS, call);
  assertEquals(res.status, 400);
  assertEquals((await res.json()).error.code, -32700);
});

Deno.test("search words can't break out of the PostgREST or() filter", () => {
  assertEquals(searchWords("sushi,name.eq.x)%_*"), "sushi name eq x");
});

Deno.test("link tokens are base64url and long", () => {
  assert(isLinkToken("kwkPzBJxhN_m0smCvKOxUbFu7jauVe1D"));
  assert(!isLinkToken("short"));
  assert(!isLinkToken("has/slash-kwkPzBJxhN_m0smCvKOxUbFu7jauVe1D"));
});
