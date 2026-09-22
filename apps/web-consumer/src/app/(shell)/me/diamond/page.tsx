import { DiamondModal } from "@/components/consumer/me/DiamondModal";

// /me/diamond — invited or not (MESITA-2040). Was /me/class, a four-rung
// ladder; the old path 308s here.
export const dynamic = "force-dynamic";

export default function Page() {
  return <DiamondModal />;
}
