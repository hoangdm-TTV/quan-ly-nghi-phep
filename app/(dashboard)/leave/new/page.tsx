import { requireAuth } from '@/lib/auth/permissions';
import { canSubmitPersonalRequests, canApproveWorkflowRequests } from '@/lib/auth/roles';
import { redirect } from 'next/navigation';
import LeaveForm from '@/components/leave/leave-form';

export const metadata = {
  title: 'Tạo đơn nghỉ phép | Tri Thức Việt',
};

export default async function NewLeavePage() {
  const user = await requireAuth();

  if (!canSubmitPersonalRequests(user.role)) {
    redirect(canApproveWorkflowRequests(user.role) ? '/approvals/leave' : '/');
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/90">
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          Tạo đơn xin nghỉ phép
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Điền khoảng thời gian và lý do xin nghỉ. Hệ thống sẽ tự động tính số ngày làm việc (trừ Chủ Nhật và ngày lễ) và phân bổ luồng duyệt phù hợp.
        </p>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/90">
        <LeaveForm />
      </div>
    </div>
  );
}
