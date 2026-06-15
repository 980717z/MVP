import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Alpine · 商家系统平台",
  description: "勾选功能，一键生成你的后台管理系统",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
