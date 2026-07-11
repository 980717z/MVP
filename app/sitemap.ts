import type { MetadataRoute } from "next";

const SITE = "https://bentoos.io";

// Marketing routes ONLY. Deliberately excludes:
//  - /menu/[tenant] (customer menus — e.g. fulai; authorization pending, not a BentoOS marketing asset)
//  - /[tenant], /app, /login, /onboarding (auth-gated operator surfaces)
// See the indexability matrix in the plan.
export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/pricing", "/how-it-works", "/get-started", "/demo"];
  return routes.map((path) => ({
    url: `${SITE}${path}`,
    lastModified: new Date("2026-07-11"),
    changeFrequency: "monthly",
    priority: path === "" ? 1 : 0.7,
  }));
}
