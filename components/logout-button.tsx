"use client";

import { logoutAction } from "@/lib/auth/actions";
import { LogOut } from "lucide-react";

export default function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="flex min-h-11 items-center gap-1.5 whitespace-nowrap px-3 py-2 text-xs font-medium sm:min-h-10 text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 hover:text-red-600 transition-colors"
      >
        <LogOut className="w-3.5 h-3.5" />
        Đăng xuất
      </button>
    </form>
  );
}
