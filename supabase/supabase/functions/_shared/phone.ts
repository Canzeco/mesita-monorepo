/** The digits of a phone as typed or stored, nothing else. */
export function phoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}
