'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { KeyRound, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { changePasswordAction, ProfileActionState } from '@/lib/profile/actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#005a3c] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#044e3f] disabled:opacity-50">{pending && <Loader2 className="h-4 w-4 animate-spin" />}{pending ? 'Đang cập nhật...' : 'Đổi mật khẩu'}</button>;
}

export default function PasswordForm() {
  const [state, action] = useFormState(changePasswordAction, {} as ProfileActionState);
  return (
    <form action={action} className="space-y-4">
      {state.error && <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"><AlertCircle className="h-4 w-4 shrink-0" />{state.error}</div>}
      {state.success && <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700"><CheckCircle2 className="h-4 w-4 shrink-0" />Đổi mật khẩu thành công.</div>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="text-xs font-bold text-slate-700 sm:col-span-2">Mật khẩu hiện tại<input name="currentPassword" type="password" autoComplete="current-password" required className="mt-1.5 block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-[#005a3c] focus:outline-none focus:ring-2 focus:ring-[#005a3c]/20" /></label>
        <label className="text-xs font-bold text-slate-700">Mật khẩu mới<input name="newPassword" type="password" autoComplete="new-password" minLength={6} required className="mt-1.5 block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-[#005a3c] focus:outline-none focus:ring-2 focus:ring-[#005a3c]/20" /></label>
        <label className="text-xs font-bold text-slate-700">Nhập lại mật khẩu mới<input name="confirmPassword" type="password" autoComplete="new-password" minLength={6} required className="mt-1.5 block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-[#005a3c] focus:outline-none focus:ring-2 focus:ring-[#005a3c]/20" /></label>
      </div>
      <p className="text-xs text-slate-500">Mật khẩu mới cần có ít nhất 6 ký tự và khác mật khẩu hiện tại.</p>
      <SubmitButton />
    </form>
  );
}
