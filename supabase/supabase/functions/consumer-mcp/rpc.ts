import { CORS } from "../_shared/cors.ts";

export const PROTOCOL_VERSION = "2025-03-26";

export type JsonRpcId = string | number | null;

export function rpcResult(id: JsonRpcId, result: unknown): Response {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id, result }), {
    status: 200,
    headers: {
      ...CORS,
      "Content-Type": "application/json",
      "MCP-Protocol-Version": PROTOCOL_VERSION,
    },
  });
}

export function rpcError(
  id: JsonRpcId,
  code: number,
  message: string,
  status = 200,
): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id,
      error: { code, message },
    }),
    {
      status,
      headers: {
        ...CORS,
        "Content-Type": "application/json",
        "MCP-Protocol-Version": PROTOCOL_VERSION,
      },
    },
  );
}

export function toolText(
  payload: unknown,
): { content: { type: "text"; text: string }[]; isError?: boolean } {
  const text = typeof payload === "string"
    ? payload
    : JSON.stringify(payload, null, 2);
  return { content: [{ type: "text", text }] };
}

export function toolError(message: string) {
  return { ...toolText({ ok: false, error: message }), isError: true };
}
