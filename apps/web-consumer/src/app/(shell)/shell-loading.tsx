import type { ReactNode } from "react";
import { routeFor, type RouteId } from "@/lib/consumer-route-contract";
import { GeneratingPlaceScreen } from "@/components/consumer/GeneratingPlace";
import { HomeLoadingFrame } from "@/components/consumer/home/HomeLoadingFrame";
import { PlacePageSkeleton } from "@/components/consumer/overlay/DetailSkeletons";
import SearchChatLoading from "./(discovery)/search/chat/loading";
import SearchLoading from "./(discovery)/search/loading";
import MeLoading from "./me/(hub)/loading";
import ClassLoading from "./me/class/loading";
import ConnectorLoading from "./me/connector/loading";
import FavoritesLoading from "./me/favorites/loading";
import InstagramLoading from "./me/instagram/loading";
import NotificationsLoading from "./me/notifications/loading";
import PlanLoading from "./me/plan/loading";
import ProfileLoading from "./me/profile/loading";
import ReservationsLoading from "./me/reservations/loading";
import SettingsLoading from "./me/settings/(page)/loading";
import ContactLoading from "./me/settings/contact/loading";
import ActivityLoading from "./activity/loading";
import PayLoading from "./pay/loading";
import ShareLoading from "./share/loading";
import RefundsLoading from "./me/refunds/loading";
import FeedbackLoading from "./me/settings/feedback/loading";
import ReservationPageLoading from "./reservation/[id]/loading";
import WalletPlaceLoading from "./wallet/[placeId]/loading";
import WalletGiftLoading from "./wallet/gift/[token]/loading";
import PlaceReserveLoading from "./place/[id]/reserve/loading";
import PayPlaceLoading from "./pay/[placeId]/loading";
import PayTabLoading from "./pay/tab/[tabId]/loading";
import PayReceiptLoading from "./pay/receipt/[paymentId]/loading";

// One frame per screen in the route map (MESITA-3646): a screen without one
// is a type error, never a blank card.
const FRAMES: Record<RouteId, () => ReactNode> = {
  home: () => <HomeLoadingFrame />,
  homeSocial: () => <HomeLoadingFrame />,
  search: () => <SearchLoading />,
  searchChat: () => <SearchChatLoading />,
  place: () => <PlacePageSkeleton />,
  placeOpen: () => (
    <div className="flex h-full min-h-0 flex-col">
      <GeneratingPlaceScreen variant="page" />
    </div>
  ),
  placeReserve: () => <PlaceReserveLoading />,
  reservation: () => <ReservationPageLoading />,
  pay: () => <PayLoading />,
  payPlace: () => <PayPlaceLoading />,
  payTab: () => <PayTabLoading />,
  payReceipt: () => <PayReceiptLoading />,
  // The Wallet lives under Pay (MESITA-3631): /wallet forwards there.
  wallet: () => <PayLoading />,
  walletPlace: () => <WalletPlaceLoading />,
  walletGift: () => <WalletGiftLoading />,
  activity: () => <ActivityLoading />,
  share: () => <ShareLoading />,
  me: () => <MeLoading />,
  meProfile: () => <ProfileLoading />,
  meInstagram: () => <InstagramLoading />,
  mePlan: () => <PlanLoading />,
  meClass: () => <ClassLoading />,
  meConnector: () => <ConnectorLoading />,
  meRefunds: () => <RefundsLoading />,
  meNotifications: () => <NotificationsLoading />,
  meFavorites: () => <FavoritesLoading />,
  meReservations: () => <ReservationsLoading />,
  meSettings: () => <SettingsLoading />,
  meSettingsContact: () => <ContactLoading />,
  meSettingsFeedback: () => <FeedbackLoading />,
};

// THE PLACEHOLDER IS THE LOADING SCREEN, NEVER A SPINNER (Pato, MESITA-2840:
// "why spinning and then placeholder, don't do that. just use the
// placeholder directly"). A tap on the bar from Me, Pay or Share lands on
// the (shell) boundary, and a full page load on the root one, before the
// target's own loading.tsx can mount; both drew a centred spinner, so Home
// came in as spinner → tiles. Both now draw the target's own frame, picked
// by the bare path (the proxy's x-pathname, which names the target on
// a navigation's request too). A place open that fell back to a full load
// (lib/navigate.ts) lands here too, so it draws the profile's silhouette,
// never a blank card with Home lit (Pato, MESITA-2973). Each Me box draws its
// own frame too (MESITA-3013): a hard load of /me/profile used to land on an
// empty card. The frame is the route map's (FRAMES above); an address with
// no row (a redirect on its way) gets the plain background.
export function ShellLoadingFor({ bare }: { bare: string }) {
  const id = routeFor(bare);
  if (id) return FRAMES[id]();
  return <div className="bg-background min-h-0 flex-1" aria-busy />;
}
