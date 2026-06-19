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
        brand: {
          DEFAULT: "#2563eb",
          soft: "#3b82f6",
          wash: "#eff6ff",
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
