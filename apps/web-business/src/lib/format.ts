const mxn = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "MXN",
  currencyDisplay: "narrowSymbol",
  maximumFractionDigits: 0,
});

/** Pesos, whole: $1,100. */
export const money = (n: number) => mxn.format(Math.round(n));

/** Signed pesos for ledgers: +$1,100 / −$450. */
export const signedMoney = (n: number) =>
  `${n < 0 ? "−" : "+"}${mxn.format(Math.round(Math.abs(n)))}`;

export const compact = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, "")}k` : String(n);

export const percent = (n: number) => `${Math.round(n)}%`;
