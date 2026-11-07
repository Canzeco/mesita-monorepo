// visit.mesita.ai (MESITA-3221, Pato: "keep it super simple"). The close-visit
// flow of the discount product (the guest's QR, the member number and the
// place code, the bill and the Instagram story check) left with MESITA-3299.
// The app keeps its address for what comes next: the payment proof and the
// waiter's charge (MESITA-3272 W2). Until then it says so and does nothing.
export default function VisitHome() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-2xl font-semibold tracking-tight">Mesita Visit</p>
      <p className="mt-2 max-w-[32ch] text-sm leading-relaxed opacity-70">
        Nothing to do here yet. Staff will check a guest&apos;s payment on this page once Mesita Pay is on.
      </p>
    </main>
  );
}
