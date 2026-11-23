import { TagIcon } from "@phosphor-icons/react/dist/ssr";

// Admin › Payments (MESITA-3918): the voucher catalog, read-only.
// Offers since MESITA-4698 (Pato: "Rename Payments to Offers in admin page too"); the URL stays.
export const PAYMENTS_PARENT = { href: "/payments-config", label: "Offers", Icon: TagIcon } as const;
