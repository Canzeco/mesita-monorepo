// The MCP wire protocol, Streamable HTTP without a stream (MESITA-3971).
//
// Pure: one JSON-RPC message in, one reply out (or none, for a
// notification), so the protocol is testable without a database. The
// server is stateless: no session id, every POST stands alone, and GET
// (the optional server-to-client stream) answers 405, which the spec
// allows. Tools come in as data and a `call` function.

export const MCP_PROTOCOL_VERSIONS = [
  "2025-06-18",
  "2025-03-26",
  "2024-11-05",
] as const;
export const SERVER_INFO = {
  name: "mesita",
  title: "Mesita",
  version: "1.0.0",
};

export type ToolSpec = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export type ToolResult = { text: string; data?: unknown; isError?: boolean };
export type ToolCall = (
  name: string,
  args: Record<string, unknown>,
) => Promise<ToolResult>;

type Id = string | number | null;
type RpcReply = {
  jsonrpc: "2.0";
  id: Id;
  result?: unknown;
  error?: { code: number; message: string };
};

const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;

function err(id: Id, code: number, message: string): RpcReply {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

const INSTRUCTIONS =
  "Mesita is a restaurant app. Use search_places to find restaurants Mesita knows, " +
  "get_place for one place's hours, address and links, and list_my_reservations for " +
  "the user's own Mesita reservations. Booking happens in the Mesita app.";

/** One message → its reply, or null for a notification. */
export async function handleRpc(
  msg: unknown,
  tools: ToolSpec[],
  call: ToolCall,
): Promise<RpcReply | null> {
  if (!msg || typeof msg !== "object" || Array.isArray(msg)) {
    return err(null, INVALID_REQUEST, "Invalid request");
  }
  const m = msg as {
    jsonrpc?: unknown;
    id?: unknown;
    method?: unknown;
    params?: unknown;
  };
  const hasId = "id" in m &&
    (typeof m.id === "string" || typeof m.id === "number");
  const id: Id = hasId ? (m.id as string | number) : null;
  if (m.jsonrpc !== "2.0" || typeof m.method !== "string") {
    // A response or a malformed message: a client's reply needs no answer.
    return hasId && typeof m.method === "string"
      ? err(id, INVALID_REQUEST, "Invalid request")
      : null;
  }
  if (!hasId) return null; // notifications/initialized, cancelled, …
  const params =
    (m.params && typeof m.params === "object" ? m.params : {}) as Record<
      string,
      unknown
    >;

  switch (m.method) {
    case "initialize": {
      const asked = typeof params.protocolVersion === "string"
        ? params.protocolVersion
        : "";
      const version =
        (MCP_PROTOCOL_VERSIONS as readonly string[]).includes(asked)
          ? asked
          : MCP_PROTOCOL_VERSIONS[0];
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: version,
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions: INSTRUCTIONS,
        },
      };
    }
    case "ping":
      return { jsonrpc: "2.0", id, result: {} };
    case "tools/list":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          tools: tools.map((t) => ({
            ...t,
            annotations: { readOnlyHint: true, openWorldHint: false },
          })),
        },
      };
    case "tools/call": {
      const name = params.name;
      if (typeof name !== "string" || !tools.some((t) => t.name === name)) {
        return err(id, INVALID_PARAMS, `Unknown tool: ${String(name)}`);
      }
      const args =
        (params.arguments && typeof params.arguments === "object"
          ? params.arguments
          : {}) as Record<
            string,
            unknown
          >;
      let out: ToolResult;
      try {
        out = await call(name, args);
      } catch (e) {
        out = {
          text: `Mesita couldn't do that: ${
            e instanceof Error ? e.message : String(e)
          }`,
          isError: true,
        };
      }
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: out.text }],
          ...(out.data !== undefined ? { structuredContent: out.data } : {}),
          isError: out.isError ?? false,
        },
      };
    }
    case "resources/list":
      return { jsonrpc: "2.0", id, result: { resources: [] } };
    case "prompts/list":
      return { jsonrpc: "2.0", id, result: { prompts: [] } };
    default:
      return err(id, METHOD_NOT_FOUND, `Method not found: ${m.method}`);
  }
}

/** A POST body → the HTTP reply: 202 when nothing needs answering. */
export async function handleMcpBody(
  raw: string,
  tools: ToolSpec[],
  call: ToolCall,
): Promise<Response> {
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json(err(null, PARSE_ERROR, "Parse error"), {
      status: 400,
    });
  }
  if (Array.isArray(body)) {
    const replies = (await Promise.all(body.map((m) =>
      handleRpc(m, tools, call)
    ))).filter((r) =>
      r !== null
    );
    return replies.length
      ? Response.json(replies)
      : new Response(null, { status: 202 });
  }
  const reply = await handleRpc(body, tools, call);
  return reply ? Response.json(reply) : new Response(null, { status: 202 });
}
