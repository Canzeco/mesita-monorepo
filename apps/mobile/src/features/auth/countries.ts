// The sign-in picker's countries, in the web's order. Mexico first, always.

export const COUNTRIES = [
  ["MX", "Mexico", "52"], ["US", "United States", "1"], ["CA", "Canada", "1"], ["ES", "Spain", "34"],
  ["AR", "Argentina", "54"], ["CO", "Colombia", "57"], ["CL", "Chile", "56"], ["PE", "Peru", "51"],
  ["BR", "Brazil", "55"], ["UY", "Uruguay", "598"], ["PY", "Paraguay", "595"], ["BO", "Bolivia", "591"],
  ["EC", "Ecuador", "593"], ["VE", "Venezuela", "58"], ["GT", "Guatemala", "502"], ["HN", "Honduras", "504"],
  ["SV", "El Salvador", "503"], ["NI", "Nicaragua", "505"], ["CR", "Costa Rica", "506"], ["PA", "Panama", "507"],
  ["DO", "Dominican Republic", "1"], ["PR", "Puerto Rico", "1"], ["GB", "United Kingdom", "44"],
  ["FR", "France", "33"], ["IT", "Italy", "39"], ["DE", "Germany", "49"], ["NL", "Netherlands", "31"],
  ["PT", "Portugal", "351"], ["JP", "Japan", "81"], ["AU", "Australia", "61"],
] as const;

export type CountryCode = (typeof COUNTRIES)[number][0];

export function countryOf(code: CountryCode) {
  const [, name, dial] = COUNTRIES.find((c) => c[0] === code) ?? COUNTRIES[0];
  const flag = [...code].map((c) => String.fromCodePoint(0x1f1a5 + c.charCodeAt(0))).join("");
  return { code, name, dial, flag };
}
