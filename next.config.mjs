/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @napi-rs/canvas ships a native .node binary — keep it external so Next
  // doesn't try to webpack-bundle it; Vercel traces it from node_modules.
  serverExternalPackages: ["@napi-rs/canvas", "web-push"],
  // Ship the CJK font with the Epson print route's serverless function so the
  // Chinese kitchen ticket can be rendered to a bitmap at request time.
  outputFileTracingIncludes: {
    "/api/epson": ["./assets/fonts/NotoSansSC.ttf"],
  },
};

export default nextConfig;
