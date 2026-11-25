import { z } from "zod";

import { consumerSchema, type Profile } from "@/features/auth";
import { callEdge } from "@/lib/edge";

import type { Details } from "./model";

/** A mutation with no request id: it writes the same values again, so a
 *  repeat changes nothing. An unknown outcome is settled by re-reading. */
export async function saveMyDetails(details: Details): Promise<Profile> {
  const answer = await callEdge(
    "consumer-web-update-profile",
    {
      first_name: details.firstName,
      last_name: details.lastName,
      sex: details.sex,
      birth_year: details.birthYear,
    },
    z.object({ consumer: consumerSchema }),
    { mutation: true },
  );
  return answer.consumer;
}

/** Names only. Sex and year stay as the profile already has them. */
export async function saveNames(firstName: string, lastName: string, sex: string | null, birthYear: number | null): Promise<Profile> {
  const answer = await callEdge(
    "consumer-web-update-profile",
    {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      ...(sex ? { sex } : {}),
      ...(birthYear ? { birth_year: birthYear } : {}),
    },
    z.object({ consumer: consumerSchema }),
    { mutation: true },
  );
  return answer.consumer;
}
