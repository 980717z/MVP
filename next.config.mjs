/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @napi-rs/canvas ships a native .node binary — keep it external so Next
  // doesn't try to webpack-bundle it; Vercel traces it from node_modules.
  serverExternalPackages: ["@napi-rs/canvas", "web-push"],
  // Customer-menu dish photos live in Supabase Storage. Serving them through
  // next/image routes them via Vercel's image optimizer + CDN (resized to the
  // 56px thumbnail, WebP, cached) — moving that bandwidth OFF Supabase's egress
  // quota and shrinking each download from a full-size photo to a few KB.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
  },
  // Ship the CJK font with the Epson print route's serverless function so the
  // Chinese kitchen ticket can be rendered to a bitmap at request time.
  outputFileTracingIncludes: {
    "/api/epson": ["./assets/fonts/NotoSansSC.ttf"],
  },
  // Subdomain → path: utoronto.bentoos.io serves the UofT food-pickup manifesto
  // at /utoronto. Requires the DNS/Vercel domain `utoronto.bentoos.io` to point
  // at this project; this rewrite maps its root to the page. Assets/api stay shared.
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/",
          has: [{ type: "host", value: "utoronto.bentoos.io" }],
          destination: "/utoronto",
        },
      ],
    };
  },
};

export default nextConfig;
