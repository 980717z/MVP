import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#0f172a",
          soft: "#334155",
          faint: "#64748b",
        },
        // BentoOS platform brand — emerald (see DESIGN-PLATFORM.md).
        // Replaces legacy blue #2563eb; unifies back-office with the landing.
        brand: {
          DEFAULT: "#0E9F6E",
          soft: "#0B8A5E", // hover/press (darker)
          wash: "#E9F6F0", // active surface / secondary button
          ink: "#0A6A49", // emerald text on wash / links
        },
        // Sang's Seafood customer-menu palette (see DESIGN.md)
        paper: "#FAF7F2",
        jade: {
          DEFAULT: "#117A65",
          wash: "#E7F1ED",
        },
        gold: "#B8862F",
      },
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "PingFang SC",
          "Microsoft YaHei",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
