import { requireAuth } from '@/lib/auth/permissions';
import { canSubmitPersonalRequests, canApproveWorkflowRequests } from '@/lib/auth/roles';
import { redirect } from 'next/navigation';
import OutOfficeForm from '@/components/out-office/out-office-form';

export const metadata = {
  title: 'Tạo đơn ra ngoài | Tri Thức Việt',
};

export default async function NewOutOfficePage() {
  const user = await requireAuth();

  if (!canSubmitPersonalRequests(user.role)) {
    redirect(canApproveWorkflowRequests(user.role) ? '/approvals/out-office' : '/');
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/90">
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          Tạo đơn xin ra ngoài (Gate Pass)
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Đăng ký khung giờ và lý do ra ngoài trong ngày làm việc. Đơn sẽ được chuyển đến Trưởng phòng trực tiếp hoặc Giám đốc xem xét duyệt.
        </p>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/90">
        <OutOfficeForm />
      </div>
    </div>
  );
}
