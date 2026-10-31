import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/permissions";
import LoginForm from "@/components/login-form";
import BrandLogo from "@/components/brand/brand-logo";

export const metadata = {
  title: "Đăng nhập | TRI THỨC VIỆT - Quản lý Nghỉ phép & Đơn ra ngoài",
};

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/");
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 sm:px-6 py-8 sm:py-12 bg-[#f8fafc]">
      <div className="w-full max-w-lg flex flex-col items-center text-center">
        <div className="mb-7 sm:mb-8 flex justify-center">
          <BrandLogo
            size="lg"
            subtitle="Quản lý Nghỉ phép & Đơn ra ngoài"
            showBadge={true}
            href="/login"
            className="flex-col sm:flex-row text-center sm:text-left items-center justify-center"
          />
        </div>
        <p className="text-sm text-slate-500 max-w-md leading-relaxed">
          Cổng thông tin nội bộ dành cho cán bộ công nhân viên công ty Tri Thức
          Việt
        </p>
      </div>

      <div className="mt-7 w-full max-w-lg">
        <div className="bg-white py-8 px-5 shadow-sm border border-slate-200/90 rounded-3xl sm:py-10 sm:px-12">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
