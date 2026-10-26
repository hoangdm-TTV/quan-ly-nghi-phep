'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { loginAction, ActionState } from '@/lib/auth/actions';
import { Mail, Lock, Loader2, ArrowRight, AlertCircle } from 'lucide-react';

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full flex items-center justify-center py-3 px-4 rounded-xl shadow-xs text-sm font-bold text-white bg-[#005a3c] hover:bg-[#044e3f] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#005a3c] disabled:opacity-50 transition-all"
    >
      {pending ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Đang xác thực tài khoản...
        </>
      ) : (
        <>
          Đăng nhập hệ thống
          <ArrowRight className="w-4 h-4 ml-2" />
        </>
      )}
    </button>
  );
}

export default function LoginForm() {
  const initialState: ActionState = {};
  const [state, formAction] = useFormState(loginAction, initialState);

  return (
    <form action={formAction} className="space-y-5">
      {state.error && (
        <div className="flex items-center p-3 text-sm text-rose-800 bg-rose-50 border border-rose-200 rounded-xl">
          <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      <div>
        <label
          htmlFor="email"
          className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
        >
          Địa chỉ Email
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Mail className="w-4 h-4" />
          </div>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="ten.nv@trithucviet.vn"
            className="block w-full pl-10 pr-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#005a3c] focus:border-[#005a3c]"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
        >
          Mật khẩu
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Lock className="w-4 h-4" />
          </div>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            className="block w-full pl-10 pr-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#005a3c] focus:border-[#005a3c]"
          />
        </div>
      </div>

      <div className="pt-2">
        <SubmitButton />
      </div>
    </form>
  );
}
