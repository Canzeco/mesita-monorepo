import * as Crypto from "expo-crypto";
import { useLocalSearchParams, useRouter } from "expo-router";

import { rememberTarget } from "@/features/auth";
import { ReserveScreen } from "@/features/reservations/screens/reserve-screen";

function one(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

export default function Route() {
  const params = useLocalSearchParams<{
    placeId: string;
    requestId?: string;
    date?: string;
    time?: string;
    party?: string;
    notes?: string;
    firstName?: string;
    lastName?: string;
  }>();
  const router = useRouter();
  const placeId = one(params.placeId);
  const requestId = one(params.requestId) || Crypto.randomUUID();
  const draft = {
    placeId,
    requestId,
    date: one(params.date),
    time: one(params.time),
    party: one(params.party) || "2",
    notes: one(params.notes),
    firstName: one(params.firstName),
    lastName: one(params.lastName),
  };
  const query = new URLSearchParams({
    requestId: draft.requestId,
    date: draft.date,
    time: draft.time,
    party: draft.party,
    notes: draft.notes,
    firstName: draft.firstName,
    lastName: draft.lastName,
  }).toString();
  return (
    <ReserveScreen
      draft={draft}
      onChange={(next) => router.setParams(next)}
      onSignIn={() => {
        rememberTarget(`/reserve/${placeId}?${query}`);
        router.push("/sign-in");
      }}
      onBooked={(id) => router.replace({ pathname: "/reservations/[id]", params: { id } })}
    />
  );
}
