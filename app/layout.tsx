import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "TRI THỨC VIỆT | Quản lý Nghỉ phép & Đơn ra ngoài",
    template: "%s | Tri Thức Việt",
  },
  description:
    "Hệ thống nội bộ quản lý nghỉ phép và đơn xin ra ngoài cho cán bộ công nhân viên công ty Tri Thức Việt: quy trình phê duyệt nhiều cấp, phân quyền theo vai trò, dashboard đối soát chấm công.",
  keywords: [
    "tri thức việt",
    "quản lý nghỉ phép",
    "đơn xin ra ngoài",
    "phê duyệt nghỉ phép",
    "quản lý nhân sự",
    "chấm công",
    "gate pass",
    "leave management",
  ],
  authors: [{ name: "Tri Thức Việt IT & HR" }],
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: "TRI THỨC VIỆT | Quản lý Nghỉ phép & Đơn ra ngoài",
    description:
      "Hệ thống nội bộ quản lý nghỉ phép và đơn xin ra ngoài công ty Tri Thức Việt.",
    locale: "vi_VN",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#005a3c",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="antialiased min-h-screen text-slate-900 bg-[#f1f5f9]">{children}</body>
    </html>
  );
}
