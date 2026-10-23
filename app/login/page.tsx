import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/permissions';
import LoginForm from '@/components/login-form';
import { ShieldCheck } from 'lucide-react';

export const metadata = {
  title: 'Đăng nhập | Leave & Gate Pass Management',
};

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect('/');
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-12 bg-slate-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-3">
          <div className="p-3 bg-blue-100 rounded-full text-blue-600">
            <ShieldCheck className="w-8 h-8" />
          </div>
        </div>
        <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900">
          Leave & Gate Pass
        </h2>
        <p className="mt-1 text-center text-sm text-slate-600">
          Hệ thống Quản lý Nghỉ phép & Đơn ra ngoài nội bộ
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-xl sm:px-10">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
