'use client';

import { logoutAction } from '@/lib/auth/actions';
import { LogOut } from 'lucide-react';

export default function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 hover:text-red-600 transition-colors"
      >
        <LogOut className="w-3.5 h-3.5" />
        Đăng xuất
      </button>
    </form>
  );
}
