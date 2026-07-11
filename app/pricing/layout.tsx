import type { Metadata } from "next";
import { PRICING_FAQ } from "./faq";

export const metadata: Metadata = {
  title: "Pricing — Commission-Free, Quoted Per Shop",
  description:
    "No commission, no contract, no bundled POS. BentoOS is quoted per shop and runs on the devices you already have. Custom online stores at about half the cost of a hosted store platform. Launch offer: free setup + first month free.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "BentoOS Pricing — Commission-Free, Quoted Per Shop",
    description:
      "No commission, no contract, no bundled POS. Custom online stores at about half the cost of a hosted store platform. Launch offer: free setup + first month free.",
    url: "/pricing",
  },
};

// FAQPage JSON-LD generated from the same source the page renders (EN), so it
// can't go stale relative to the visible FAQ.
const faqLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: PRICING_FAQ.map((item) => ({
    "@type": "Question",
    name: item.q.en,
    acceptedAnswer: { "@type": "Answer", text: item.a.en },
  })),
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      {children}
    </>
  );
}
