import { WalletMock } from "./WalletMock";

export const dynamic = "force-dynamic";
export const metadata = { title: "Wallet" };

// Wallet (MESITA-3377, Pato 2026-11-07, with five hand-drawn frames: "Create
// mock cards for the wallet ... build that into the business app"): the
// place's credits as the sketch draws them, a MOCK under the TEST band with
// sample data and no server call, so the shape can be judged before the
// credit products ship. Views · Visits · Money · Wallet is Operations.
export default async function WalletPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <WalletMock placeId={id} />;
}
