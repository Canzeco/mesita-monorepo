"use client";

import { useSearchParams } from "next/navigation";
import { ModeTabs } from "@/components/consumer/ModeTabs";
import { RewardPlaces } from "./RewardPlaces";

/** Home's header over every Mesita place, nearest first (MESITA-3214). A Prepay
 *  return (`?prepay=`) is the Wallet's page alone. */
export function PayList() {
  const prepay = useSearchParams().get("prepay");
  if (prepay) return null;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <ModeTabs />
      <RewardPlaces />
    </div>
  );
}
