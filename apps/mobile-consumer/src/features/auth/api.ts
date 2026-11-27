import { z } from "zod";

import { callEdge } from "@/lib/edge";

import type { Profile } from "./model";

const text = z.string().nullish().catch(null);

/** Only the id is needed; everything else a newer backend drops reads null. */
export const consumerSchema = z
  .object({
    id: z.string(),
    first_name: text,
    last_name: text,
    full_name: text,
    avatar_url: text,
    sex: text,
    birth_year: z.number().nullish().catch(null),
    phone: text,
    guest_class: text,
    instagram_handle: text,
    instagram_proved_at: text,
    instagram_vip_status: text,
    instagram_followers_count: z.number().nullish().catch(null),
  })
  .transform(
    (c): Profile => ({
      id: c.id,
      firstName: c.first_name ?? null,
      lastName: c.last_name ?? null,
      fullName: c.full_name ?? null,
      avatarUrl: c.avatar_url ?? null,
      sex: c.sex ?? null,
      birthYear: c.birth_year ?? null,
      phone: c.phone ?? null,
      isVip: c.guest_class === "vip",
      instagramHandle: c.instagram_handle ?? null,
      instagramProvedAt: c.instagram_proved_at ?? null,
      instagramVipStatus:
        c.instagram_vip_status === "eligible" ||
        c.instagram_vip_status === "not_enough" ||
        c.instagram_vip_status === "not_public" ||
        c.instagram_vip_status === "unconfirmed"
          ? c.instagram_vip_status
          : null,
      instagramFollowers: c.instagram_followers_count ?? null,
    }),
  );

/** A read. Answers a suspended guest too. */
export async function getMyProfile(signal?: AbortSignal): Promise<Profile> {
  const answer = await callEdge("consumer-web-get-profile", {}, z.object({ consumer: consumerSchema }), { signal });
  return answer.consumer;
}

/** A mutation with no request id: it makes the guest's row once and stamps
 *  the role, so running it again changes nothing. */
export async function recordSignIn(): Promise<{ onboarded: boolean }> {
  return callEdge("consumer-web-signin-phone", {}, z.object({ onboarded: z.boolean() }), { mutation: true });
}

/** A mutation with no request id: an account already closed answers 410. */
export async function deleteMyAccount(): Promise<void> {
  await callEdge("consumer-web-delete-account", {}, z.object({}), { mutation: true });
}
