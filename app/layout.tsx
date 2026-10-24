import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Quản lý Nghỉ phép & Đơn ra ngoài | Hệ thống nhân sự nội bộ",
    template: "%s | Quản lý Nghỉ phép & Đơn ra ngoài",
  },
  description:
    "Hệ thống nội bộ quản lý nghỉ phép và đơn xin ra ngoài cho doanh nghiệp: quy trình phê duyệt nhiều cấp, phân quyền theo vai trò, dashboard đối soát chấm công.",
  keywords: [
    "quản lý nghỉ phép",
    "đơn xin ra ngoài",
    "phê duyệt nghỉ phép",
    "quản lý nhân sự",
    "chấm công",
    "gate pass",
    "leave management",
  ],
  authors: [{ name: "HR Internal System" }],
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: "Quản lý Nghỉ phép & Đơn ra ngoài",
    description:
      "Hệ thống nội bộ quản lý nghỉ phép và đơn xin ra ngoài cho doanh nghiệp.",
    locale: "vi_VN",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1e3a5f",
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
