// Country dial-code list — port of web-consumer `lib/consumer-data` COUNTRIES.
// Residence dropdown was retired; country is inferred from the phone dial code.

export type Country = {
  code: string;
  name: string;
  flag: string;
  dial: string;
  /** ISO 3166-1 alpha-3 — the MRZ nationality field (MESITA-1820). `UK` is
   *  the row's local key; its real alpha-3 is GBR. Mirrors web-consumer
   *  `lib/consumer-data.ts`, same rows in the same order. */
  iso3: string;
};

export const COUNTRIES: Country[] = [
  { code: 'MX', name: 'Mexico', flag: '🇲🇽', dial: '52', iso3: 'MEX' },
  { code: 'US', name: 'United States', flag: '🇺🇸', dial: '1', iso3: 'USA' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', dial: '1', iso3: 'CAN' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸', dial: '34', iso3: 'ESP' },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷', dial: '54', iso3: 'ARG' },
  { code: 'CO', name: 'Colombia', flag: '🇨🇴', dial: '57', iso3: 'COL' },
  { code: 'CL', name: 'Chile', flag: '🇨🇱', dial: '56', iso3: 'CHL' },
  { code: 'PE', name: 'Peru', flag: '🇵🇪', dial: '51', iso3: 'PER' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷', dial: '55', iso3: 'BRA' },
  { code: 'UY', name: 'Uruguay', flag: '🇺🇾', dial: '598', iso3: 'URY' },
  { code: 'PY', name: 'Paraguay', flag: '🇵🇾', dial: '595', iso3: 'PRY' },
  { code: 'BO', name: 'Bolivia', flag: '🇧🇴', dial: '591', iso3: 'BOL' },
  { code: 'EC', name: 'Ecuador', flag: '🇪🇨', dial: '593', iso3: 'ECU' },
  { code: 'VE', name: 'Venezuela', flag: '🇻🇪', dial: '58', iso3: 'VEN' },
  { code: 'GT', name: 'Guatemala', flag: '🇬🇹', dial: '502', iso3: 'GTM' },
  { code: 'HN', name: 'Honduras', flag: '🇭🇳', dial: '504', iso3: 'HND' },
  { code: 'SV', name: 'El Salvador', flag: '🇸🇻', dial: '503', iso3: 'SLV' },
  { code: 'NI', name: 'Nicaragua', flag: '🇳🇮', dial: '505', iso3: 'NIC' },
  { code: 'CR', name: 'Costa Rica', flag: '🇨🇷', dial: '506', iso3: 'CRI' },
  { code: 'PA', name: 'Panama', flag: '🇵🇦', dial: '507', iso3: 'PAN' },
  { code: 'DO', name: 'Dominican Republic', flag: '🇩🇴', dial: '1', iso3: 'DOM' },
  { code: 'PR', name: 'Puerto Rico', flag: '🇵🇷', dial: '1', iso3: 'PRI' },
  { code: 'UK', name: 'United Kingdom', flag: '🇬🇧', dial: '44', iso3: 'GBR' },
  { code: 'FR', name: 'France', flag: '🇫🇷', dial: '33', iso3: 'FRA' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹', dial: '39', iso3: 'ITA' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪', dial: '49', iso3: 'DEU' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱', dial: '31', iso3: 'NLD' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹', dial: '351', iso3: 'PRT' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵', dial: '81', iso3: 'JPN' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺', dial: '61', iso3: 'AUS' },
];

export const COUNTRY_BY_CODE: Record<string, Country> = Object.fromEntries(
  COUNTRIES.map((c) => [c.code, c]),
);

// E.164 assembly moved to lib/phone-otp.ts (`parsePhone`), which also
// strips national trunk prefixes and validates length before we pay Twilio
// for a lookup.
