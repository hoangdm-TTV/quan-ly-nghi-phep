import { requireAuth } from '@/lib/auth/permissions';
import { canSubmitPersonalRequests, canApproveWorkflowRequests } from '@/lib/auth/roles';
import { redirect } from 'next/navigation';
import LeaveForm from '@/components/leave/leave-form';
import { getEmployeeLeaveBalance } from '@/lib/admin/queries';

export const metadata = {
  title: 'Tạo đơn nghỉ phép | Tri Thức Việt',
};

export default async function NewLeavePage() {
  const user = await requireAuth();

  if (!canSubmitPersonalRequests(user.role)) {
    redirect(canApproveWorkflowRequests(user.role) ? '/approvals/leave' : '/');
  }

  const currentYear = Number(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric',
  }).format(new Date()));
  const leaveBalance = await getEmployeeLeaveBalance(user.id, currentYear);

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

      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5">
        <h2 className="text-sm font-bold text-emerald-950">Hạn mức nghỉ phép năm {currentYear}</h2>
        {leaveBalance.has_entitlement ? (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <BalanceMetric label="Hạn mức" value={leaveBalance.entitled_days} />
            <BalanceMetric label="Đã sử dụng" value={leaveBalance.used_days} />
            <BalanceMetric label="Đang chờ duyệt" value={leaveBalance.pending_days} />
            <BalanceMetric label="Còn khả dụng" value={leaveBalance.available_days} />
          </div>
        ) : (
          <p className="mt-2 text-xs text-emerald-900">Hạn mức năm này chưa được thiết lập; đơn vẫn được xử lý theo quy trình phê duyệt hiện tại.</p>
        )}
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/90">
        <LeaveForm />
      </div>
    </div>
  );
}

function BalanceMetric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-emerald-200 bg-white/80 p-3">
    <p className="text-[11px] font-medium text-emerald-800">{label}</p>
    <p className="mt-1 text-lg font-black text-emerald-950">{Number(value).toLocaleString('vi-VN')} ngày</p>
  </div>;
}
