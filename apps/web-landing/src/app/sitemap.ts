import type { MetadataRoute } from "next";

// The apex is canonical — layout.tsx `metadataBase` and robots.ts agree, and
// the two consumer clients were pointed here (off `www.`) in MESITA-1888.
// One entry per static route; legal-routes.test.ts asserts this list and the
// page.tsx files under src/app are the same set, so a new route that never
// reaches the sitemap fails the build's test step rather than shipping unseen.
const HOST = "https://mesita.ai";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    {
      url: HOST,
      lastModified,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${HOST}/terms`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${HOST}/privacy`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
