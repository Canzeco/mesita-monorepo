import { z } from "zod";

import { callEdge } from "@/lib/edge";

import { noticeSentence, type NoticeView } from "./copy";

const SHOWN = new Set(["reservation", "booking", "credit_ready"]);

export type Notice = { id: string; kind: string; when: string; place: string; sentence: string; photo: string | null; view: NoticeView | null };

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
    answer.notifications.flatMap((row) => {
      if (!SHOWN.has(row.kind)) return [];
      const said = noticeSentence(row.kind, row.payload ?? null);
      const photo = row.payload?.place_photo_url;
      return [{ id: row.id, kind: row.kind, when: row.created_at, place: said.place, sentence: said.sentence, photo: typeof photo === "string" && photo.length > 0 ? photo : null, view: said.view }];
    }),
  );
}
