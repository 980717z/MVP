import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How It Works — White-Glove Setup",
  description:
    "We enter your menu, print your table QR codes, and connect your printer — live the same day. See how BentoOS gets your restaurant or café up and running.",
  alternates: { canonical: "/how-it-works" },
  openGraph: {
    title: "How BentoOS Works — White-Glove Setup",
    description: "Menu entered, QR codes printed, printer connected — live the same day.",
    url: "/how-it-works",
  },
};

export default function HowItWorksLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
