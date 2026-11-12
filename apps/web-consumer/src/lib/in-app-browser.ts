// Google refuses OAuth inside embedded app browsers ("disallowed_useragent"),
// and Mesita links travel through exactly those: Instagram, Facebook,
// Messenger, WhatsApp, TikTok, Line, Snapchat. There the sign-in sheet hides
// Continue with Google and leads with the phone (MESITA-3777).
const IN_APP = /(Instagram|FBAN|FBAV|FB_IAB|FBIOS|Messenger|WhatsApp|musical_ly|BytedanceWebview|TikTok|\bLine\/|Snapchat)/i;

export function isInAppBrowser(userAgent: string | null | undefined): boolean {
  return !!userAgent && IN_APP.test(userAgent);
}
