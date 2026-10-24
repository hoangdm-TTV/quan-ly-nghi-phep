import { requireAuth } from '@/lib/auth/permissions';
import { canSubmitPersonalRequests, canApproveWorkflowRequests } from '@/lib/auth/roles';
import { redirect } from 'next/navigation';
import LeaveForm from '@/components/leave/leave-form';

export const metadata = {
  title: 'Tạo đơn nghỉ phép | Leave & Gate Pass',
};

export default async function NewLeavePage() {
  const user = await requireAuth();

  if (!canSubmitPersonalRequests(user.role)) {
    redirect(canApproveWorkflowRequests(user.role) ? '/approvals/leave' : '/');
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Tạo đơn xin nghỉ phép</h2>
        <p className="text-xs text-slate-500 mt-1">
          Điền khoảng thời gian và lý do xin nghỉ. Hệ thống sẽ tự động tính số ngày làm việc và xác định luồng duyệt.
        </p>
      </div>

      <LeaveForm />
    </div>
  );
}
