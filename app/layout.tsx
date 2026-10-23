import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Leave & Gate Pass Management System",
  description: "Hệ thống quản lý nghỉ phép và đơn ra ngoài nội bộ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="antialiased min-h-screen">{children}</body>
    </html>
  );
}
