import type { MetadataRoute } from "next";

const SITE = "https://bentoos.io";

// Tenants live at ROOT slugs (bentoos.io/<slug>) and the customer menu at
// /menu/<slug>, so a prefix rule can't cleanly separate "all tenants" from the
// marketing pages. We disallow the known private/app prefixes and the customer
// menus; tenant back-offices at root slugs are auth-gated, unlinked, and absent
// from the sitemap, so they aren't discovered. (Per-shop menu indexing can be
// re-enabled later once a merchant authorizes it.)
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/app", "/api", "/login", "/onboarding", "/menu/"],
    },
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
