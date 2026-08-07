// Country dial-code list — port of web-consumer `lib/consumer-data` COUNTRIES.
// Residence dropdown was retired; country is inferred from the phone dial code.

export type Country = {
  code: string;
  name: string;
  flag: string;
  dial: string;
};

export const COUNTRIES: Country[] = [
  { code: 'MX', name: 'Mexico', flag: '🇲🇽', dial: '52' },
  { code: 'US', name: 'United States', flag: '🇺🇸', dial: '1' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', dial: '1' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸', dial: '34' },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷', dial: '54' },
  { code: 'CO', name: 'Colombia', flag: '🇨🇴', dial: '57' },
  { code: 'CL', name: 'Chile', flag: '🇨🇱', dial: '56' },
  { code: 'PE', name: 'Peru', flag: '🇵🇪', dial: '51' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷', dial: '55' },
  { code: 'UY', name: 'Uruguay', flag: '🇺🇾', dial: '598' },
  { code: 'PY', name: 'Paraguay', flag: '🇵🇾', dial: '595' },
  { code: 'BO', name: 'Bolivia', flag: '🇧🇴', dial: '591' },
  { code: 'EC', name: 'Ecuador', flag: '🇪🇨', dial: '593' },
  { code: 'VE', name: 'Venezuela', flag: '🇻🇪', dial: '58' },
  { code: 'GT', name: 'Guatemala', flag: '🇬🇹', dial: '502' },
  { code: 'HN', name: 'Honduras', flag: '🇭🇳', dial: '504' },
  { code: 'SV', name: 'El Salvador', flag: '🇸🇻', dial: '503' },
  { code: 'NI', name: 'Nicaragua', flag: '🇳🇮', dial: '505' },
  { code: 'CR', name: 'Costa Rica', flag: '🇨🇷', dial: '506' },
  { code: 'PA', name: 'Panama', flag: '🇵🇦', dial: '507' },
  { code: 'DO', name: 'Dominican Republic', flag: '🇩🇴', dial: '1' },
  { code: 'PR', name: 'Puerto Rico', flag: '🇵🇷', dial: '1' },
  { code: 'UK', name: 'United Kingdom', flag: '🇬🇧', dial: '44' },
  { code: 'FR', name: 'France', flag: '🇫🇷', dial: '33' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹', dial: '39' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪', dial: '49' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱', dial: '31' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹', dial: '351' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵', dial: '81' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺', dial: '61' },
];

export const COUNTRY_BY_CODE: Record<string, Country> = Object.fromEntries(
  COUNTRIES.map((c) => [c.code, c]),
);

// E.164 assembly moved to lib/phone-otp.ts (`parsePhone`), which also
// strips national trunk prefixes and validates length before we pay Twilio
// for a lookup.
