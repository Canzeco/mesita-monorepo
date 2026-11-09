// visit.mesita.ai (MESITA-3221, Pato: "keep it super simple"). The close-visit
// flow of the discount product (the guest's QR, the member number and the
// place code, the bill and the Instagram story check) left with MESITA-3299.
// The payment proof lives at /proof/<token> (MESITA-3304): a guest's QR opens
// it. The waiter's charge lives at /charge/<place> (MESITA-3306): the owner's
// Business › Payments links it, and the staff list of the place's payments
// at /payments/<place> (MESITA-3462), opened with the place code. This home says what the page is for.
export default function VisitHome() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-2xl font-semibold tracking-tight">Mesita Visit</p>
      <p className="mt-2 max-w-[32ch] text-sm leading-relaxed opacity-70">
        Scan a guest&apos;s payment QR to check it here. To charge a guest or see today&apos;s payments, open your place&apos;s
        links from Business › Payments.
      </p>
    </main>
  );
}
