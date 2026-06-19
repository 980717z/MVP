import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BentoOS · Back-office for small businesses",
  description:
    "Pick the features you need and we generate a back-office built for your shop — orders, prep, reconciliation, members. 为中小商家打造的轻量管理系统。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
