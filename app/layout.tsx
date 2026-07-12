import type { Metadata } from "next";
import "./globals.css";
import { LangProvider } from "./i18n";

const SITE = "https://bentoos.io";

// Root metadata = homepage metadata + site-wide defaults. Per-route pages
// (/pricing, /how-it-works, /get-started, /demo) override title/description
// via their own server layout.tsx. Pages are "use client" and cannot export
// metadata themselves, so metadata lives on the server layouts.
export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "BentoOS — QR Ordering & Back-Office for Restaurants & Cafés",
    template: "%s · BentoOS",
  },
  description:
    "A tailored all-in-one system for restaurants and cafés — QR ordering, kitchen tickets, sales & tax, staff roles. Commission-free, no bundled POS or hardware lock-in, quoted per shop. Built in Toronto.",
  keywords: [
    "QR ordering",
    "commission-free restaurant ordering",
    "kitchen ticket printing",
    "restaurant back-office",
    "restaurant management system Toronto",
    "café ordering system",
    "bilingual restaurant menu Toronto",
    "restaurant online ordering",
    "QR menu ordering",
    "POS alternative",
  ],
  applicationName: "BentoOS",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "BentoOS",
    locale: "en_CA",
    url: SITE,
    title: "BentoOS — QR Ordering & Back-Office for Restaurants & Cafés",
    description:
      "Tailored ordering + back-office for restaurants and cafés. Commission-free, no bundled POS or hardware lock-in. Built in Toronto.",
  },
  twitter: {
    card: "summary_large_image",
    title: "BentoOS — QR Ordering & Back-Office for Restaurants & Cafés",
    description:
      "Tailored ordering + back-office for restaurants and cafés. Commission-free, no hardware lock-in. Built in Toronto.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  // Set GOOGLE_SITE_VERIFICATION in Vercel env to claim the property in Search Console.
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
};

// Site-wide structured data. Organization + SoftwareApplication only — NOT
// LocalBusiness (BentoOS has no public storefront/NAP). No price is published
// (pricing is quoted per shop), so offers is intentionally omitted.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE}/#org`,
      name: "BentoOS",
      url: SITE,
      email: "support@bentoos.io",
      areaServed: { "@type": "Country", name: "Canada" },
      slogan: "One dashboard for your whole shop.",
    },
    {
      "@type": "SoftwareApplication",
      name: "BentoOS",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, iOS, Android",
      url: SITE,
      provider: { "@id": `${SITE}/#org` },
      description:
        "Tailored ordering and back-office for restaurants and cafés — QR ordering, kitchen tickets, sales & tax, staff roles. Commission-free, no bundled POS or hardware lock-in.",
      offers: { "@type": "Offer", availability: "https://schema.org/InStock", priceSpecification: { "@type": "PriceSpecification", description: "Quoted per shop" } },
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Platform fonts (DESIGN-PLATFORM.md), server-rendered so marketing
            pages don't inject the stylesheet from a client component. The
            customer menu (app/menu) sets its own faces and is unaffected. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Noto+Sans+SC:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      {/* suppressHydrationWarning: browser extensions (Grammarly, etc.) inject
          data-* attributes onto <body> before React hydrates — this silences that
          benign mismatch without hiding real hydration bugs in child components. */}
      <body className="font-sans antialiased" suppressHydrationWarning>
        <LangProvider>{children}</LangProvider>
      </body>
    </html>
  );
}
