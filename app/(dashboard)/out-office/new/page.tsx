import { requireAuth } from '@/lib/auth/permissions';
import { redirect } from 'next/navigation';
import OutOfficeForm from '@/components/out-office/out-office-form';

export const metadata = {
  title: 'Tạo đơn xin ra ngoài | Leave & Gate Pass',
};

export default async function NewOutOfficePage() {
  const user = await requireAuth();

  if (user.role === 'DIRECTOR') {
    redirect('/out-office');
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Tạo đơn xin ra ngoài (Gate Pass)</h2>
        <p className="text-xs text-slate-500 mt-1">
          Đăng ký khung giờ và lý do ra ngoài trong ngày làm việc. Đơn sẽ được chuyển đến Phòng Kế toán duyệt trước khi bạn đi.
        </p>
      </div>

      <OutOfficeForm />
    </div>
  );
}
