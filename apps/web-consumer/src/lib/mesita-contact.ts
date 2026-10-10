// Public Mesita URLs and contact lines — one place so Me › Contact, Settings,
// Support and the account-deletion copy cannot drift apart.
//
// THE LEGAL ROWS POINT AT THIS APP. /terms and /privacy are public pages in
// apps/web-consumer (src/app/terms, src/app/privacy), outside the auth wall,
// so the links work before sign-in. mesita-contact.test.ts pins the URLs and
// fails if either page leaves the app.

export const MESITA_SUPPORT_EMAIL = "support@mesita.ai";
export const MESITA_PRIVACY_EMAIL = "privacy@mesita.ai";
export const MESITA_INSTAGRAM_URL = "https://instagram.com/mesita.ai";
export const MESITA_INSTAGRAM_HANDLE = "@mesita.ai";
export const MESITA_TERMS_URL = "https://consumer.mesita.ai/terms";
export const MESITA_PRIVACY_URL = "https://consumer.mesita.ai/privacy";
