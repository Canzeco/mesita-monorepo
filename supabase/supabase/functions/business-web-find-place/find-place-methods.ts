import { isOnDomain } from "../_shared/onboarding.ts";

export type PlaceRow = {
  id: string;
  phone: string | null;
  email: string | null;
  website_url: string | null;
};

export type MethodsBlock = {
  phone: { available: boolean; displayPhone: string | null };
  email: { available: boolean; displayEmail: string | null };
};

export function methodsFor(place: PlaceRow): MethodsBlock {
  const phoneOk = !!place.phone;
  const emailOk =
    !!place.email &&
    !!place.website_url &&
    isOnDomain(place.email, place.website_url);
  return {
    phone: {
      available: phoneOk,
      displayPhone: phoneOk ? place.phone : null,
    },
    email: {
      available: emailOk,
      displayEmail: emailOk ? place.email : null,
    },
  };
}
