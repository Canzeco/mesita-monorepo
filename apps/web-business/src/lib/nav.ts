import {
  CreditCard,
  Gift,
  LayoutGrid,
  ReceiptText,
  Settings,
  Sparkles,
  Star,
  Store,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { profileChecklist, visits } from "./mock";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** A count that needs the owner: setup left, visits waiting. */
  badge?: number;
  /** One of the four phone tabs; everything else lives under More. */
  tab?: boolean;
};

const waiting = visits.filter((v) => v.status === "waiting").length;
const profileLeft = profileChecklist.filter((c) => !c.done).length;

export const products: NavItem[] = [
  { href: "/visits", label: "Visits", icon: ReceiptText, badge: waiting, tab: true },
  { href: "/profile", label: "Profile", icon: Store, badge: profileLeft },
  { href: "/premier", label: "Premier", icon: Star },
  { href: "/rewards", label: "Rewards", icon: Gift, tab: true },
  { href: "/payments", label: "Payments", icon: CreditCard, tab: true },
  { href: "/credits", label: "Credits", icon: Wallet, tab: true },
];

export const soon: NavItem = { href: "/soon", label: "Coming soon", icon: Sparkles };

export const manage: NavItem[] = [
  { href: "/billing", label: "Billing", icon: LayoutGrid },
  { href: "/settings", label: "Settings", icon: Settings },
];

/** Under More on the phone, in this order. */
export const moreItems: NavItem[] = [
  ...products.filter((p) => !p.tab),
  soon,
  ...manage,
];

export const isActive = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);
