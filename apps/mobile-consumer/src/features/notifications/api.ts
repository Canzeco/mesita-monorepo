import { z } from "zod";

import { callEdge } from "@/lib/edge";

import { noticeSentence } from "./copy";

export type Notice = { id: string; kind: string; when: string; place: string; sentence: string };

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
            payload: z.record(z.string(), z.unknown()).nullish().catch(null),
          }),
        )
        .catch([]),
    }),
    { signal },
  ).then((answer) =>
    answer.notifications.map((row) => {
      const said = noticeSentence(row.kind, row.payload ?? null);
      return { id: row.id, kind: row.kind, when: row.created_at, place: said.place, sentence: said.sentence };
    }),
  );
}
