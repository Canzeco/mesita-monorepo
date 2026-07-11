"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { TicketDetailsRouteClient } from "@/components/consumer/TicketDetailsRouteClient";
import { TicketDetailsSkeleton } from "@/components/consumer/TicketDetailsSkeleton";

const TicketDetailsRouteClientLazy = dynamic(
  () =>
    import("@/components/consumer/TicketDetailsRouteClient").then(
      (mod) => mod.TicketDetailsRouteClient,
    ),
  {
    loading: () => <TicketDetailsSkeleton />,
  },
);

export function TicketDetailsRouteClientDynamic(
  props: ComponentProps<typeof TicketDetailsRouteClient>,
) {
  return <TicketDetailsRouteClientLazy {...props} />;
}
