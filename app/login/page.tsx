import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/permissions';
import LoginForm from '@/components/login-form';
import BrandLogo from '@/components/brand/brand-logo';

export const metadata = {
  title: 'Đăng nhập | TRI THỨC VIỆT - Quản lý Nghỉ phép & Đơn ra ngoài',
};

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect('/');
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-12 bg-[#f8fafc]">
      <div className="sm:mx-auto sm:w-full sm:max-w-md flex flex-col items-center text-center">
        <div className="mb-6 flex justify-center">
          <BrandLogo
            size="lg"
            subtitle="Quản lý Nghỉ phép & Đơn ra ngoài"
            showBadge={true}
            href="/login"
            className="flex-col sm:flex-row text-center sm:text-left items-center justify-center"
          />
        </div>
        <p className="text-xs sm:text-sm text-slate-500 max-w-sm">
          Cổng thông tin nội bộ dành cho cán bộ công nhân viên công ty Tri Thức Việt
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200/90 rounded-2xl sm:px-10">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
