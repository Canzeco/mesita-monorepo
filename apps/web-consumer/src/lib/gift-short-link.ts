// A gift's short link (MESITA-4390, Pato: "the link must only be
// mesita.ai/g/abcdef"): /g/<key> is the Wallet with that key,
// /wallet/gift/<key>, where a signed-out friend lands on Sign with the
// gift's card. Not legacy: the address every new gift is sent with.
export const GIFT_SHORT_REDIRECTS = [
  { source: "/g/:code", destination: "/wallet/gift/:code", permanent: false },
] as const;
