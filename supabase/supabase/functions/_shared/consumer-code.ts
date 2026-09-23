// Consumer QR codes: sequential 8 digits, canonical form 0000-0000 … 9999-9999.

const CONSUMER_CODE_RE = /^[0-9]{4}-[0-9]{4}$/;

export function isCanonicalConsumerCode(code: string): boolean {
  return CONSUMER_CODE_RE.test(code);
}
