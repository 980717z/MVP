import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Get Started",
  description:
    "Tell us about your restaurant, café, bakery, or shop and we'll tailor a BentoOS setup for you. Free setup + first month free during launch.",
  alternates: { canonical: "/get-started" },
  openGraph: {
    title: "Get Started with BentoOS",
    description: "Tailored setup for your shop. Free setup + first month free during launch.",
    url: "/get-started",
  },
};

export default function GetStartedLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
