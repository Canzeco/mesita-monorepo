import { z } from "zod";

import { callEdge } from "@/lib/edge";

export type Notice = { id: string; kind: string; when: string };

export function listNotices(signal?: AbortSignal): Promise<Notice[]> {
  return callEdge(
    "consumer-web-list-pay-notifications",
    { limit: 40 },
    z.object({
      notifications: z
        .array(
          z.object({
            id: z.string(),
            kind: z.string().catch(""),
            created_at: z.string().catch(""),
          }),
        )
        .catch([]),
    }),
    { signal },
  ).then((answer) => answer.notifications.map((row) => ({ id: row.id, kind: row.kind, when: row.created_at })));
}
