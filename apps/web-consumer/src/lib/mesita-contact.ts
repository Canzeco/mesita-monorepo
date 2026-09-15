// Public Mesita URLs and contact lines — one place so Me › Contact, Settings,
// Share cards, and account-deletion copy cannot drift apart.
//
// THE HOST IS THE APEX, NO `www.` (MESITA-1888). web-landing canonicalizes on
// https://mesita.ai in layout.tsx `metadataBase`, sitemap.ts and robots.ts;
// these constants said `www.` and the two legal rows below pointed at routes
// that did not exist, so Me › Help › Legal 404'd in production. The routes
// exist now, on the apex. Do not reintroduce a `www.` host here —
// mesita-contact.test.ts fails the build if one comes back.

export const MESITA_SUPPORT_EMAIL = "support@mesita.ai";
export const MESITA_PRIVACY_EMAIL = "privacy@mesita.ai";
export const MESITA_INSTAGRAM_URL = "https://instagram.com/mesita.ai";
export const MESITA_INSTAGRAM_HANDLE = "@mesita.ai";
export const MESITA_SITE_URL = "https://mesita.ai";
export const MESITA_TERMS_URL = "https://mesita.ai/terms";
export const MESITA_PRIVACY_URL = "https://mesita.ai/privacy";
