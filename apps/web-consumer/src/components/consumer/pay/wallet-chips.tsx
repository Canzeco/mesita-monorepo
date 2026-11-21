/** Apple Pay's and Google Pay's marks (MESITA-4397): a black chip and a
 *  white one, the Wallet's chip shape; the brands' own buttons are on Pay.
 *  Shared by Pay › Method and Payment methods (MESITA-4526). */
export function ApplePayChip() {
  return (
    <span className="flex h-8 w-[3.2rem] items-center justify-center rounded-md bg-neutral-950 text-xs font-semibold tracking-tight text-white" aria-hidden>
      <svg viewBox="0 0 814 1000" className="mr-0.5 h-3.5 w-3.5 fill-current" aria-hidden>
        <path d="M788 341c-6 4-108 62-108 190 0 149 131 201 135 203-1 3-21 72-69 142-43 62-88 123-156 123s-86-40-164-40c-77 0-104 41-166 41s-106-57-156-127C47 790 0 663 0 541c0-194 126-297 250-297 66 0 121 43 162 43 40 0 102-46 177-46 29 0 131 3 199 100zM554 160c31-37 53-88 53-139 0-7-1-14-2-20-50 2-110 34-146 76-28 32-55 83-55 135 0 8 1 16 2 18 3 1 9 2 14 2 45 0 102-30 134-72z" />
      </svg>
      Pay
    </span>
  );
}

export function GooglePayChip() {
  return (
    <span className="border-border flex h-8 w-[3.2rem] items-center justify-center gap-0.5 rounded-md border bg-white text-xs font-semibold tracking-tight text-neutral-700" aria-hidden>
      <svg viewBox="0 0 48 48" className="h-3.5 w-3.5" aria-hidden>
        <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.8-2.1 5.1-4.4 6.7v5.5h7.1c4.2-3.8 6.6-9.5 6.6-16.2z" />
        <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.6-3.9-12.3-9.1H4.4v5.7C8 41.1 15.4 46 24 46z" />
        <path fill="#FBBC05" d="M11.7 28.2c-.4-1.3-.7-2.7-.7-4.2s.3-2.9.7-4.2v-5.7H4.4C2.9 17.1 2 20.5 2 24s.9 6.9 2.4 9.9l7.3-5.7z" />
        <path fill="#EA4335" d="M24 10.7c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.2 29.9 2 24 2 15.4 2 8 6.9 4.4 14.1l7.3 5.7c1.7-5.2 6.6-9.1 12.3-9.1z" />
      </svg>
      Pay
    </span>
  );
}
