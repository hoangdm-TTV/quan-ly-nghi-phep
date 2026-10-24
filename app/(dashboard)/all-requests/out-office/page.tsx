import { requireAuth } from '@/lib/auth/permissions';
import { getAllOutOfficeRequests } from '@/lib/out-office/queries';
import { redirect } from 'next/navigation';
import OutOfficeStatusBadge from '@/components/out-office/out-office-status-badge';
import Link from 'next/link';
import { Clock, ArrowRight, Calendar, Briefcase, UserCheck, Users } from 'lucide-react';

export const metadata = {
  title: 'Tất cả đơn ra ngoài | Leave & Gate Pass',
};

export default async function AllOutOfficeRequestsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const user = await requireAuth();
  if (user.role !== 'DIRECTOR' && user.role !== 'ACCOUNTANT') {
    redirect('/');
  }
  const currentFilter = searchParams?.status || 'ALL';
  const requests = await getAllOutOfficeRequests(currentFilter);
  const isReadOnly = user.role === 'ACCOUNTANT';

  const filters = [
    { label: 'Tất cả', value: 'ALL' },
    { label: 'Chờ duyệt', value: 'PENDING' },
    { label: 'Đang ra ngoài', value: 'APPROVED' },
    { label: 'Đã hoàn tất', value: 'COMPLETED' },
    { label: 'Đã từ chối', value: 'REJECTED' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-600" />
          Tất cả đơn xin ra ngoài
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          {isReadOnly
            ? 'Xem toàn bộ đơn ra ngoài trong công ty (chỉ đọc — đối soát chấm công).'
            : 'Xem toàn bộ đơn xin ra ngoài trong công ty.'}
        </p>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-200">
        {filters.map((f) => {
          const isActive = currentFilter === f.value;
          return (
            <Link
              key={f.value}
              href={f.value === 'ALL' ? '/all-requests/out-office' : `/all-requests/out-office?status=${f.value}`}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {requests.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-xl border border-slate-200 shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800">Không có đơn ra ngoài nào</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Không có đơn nào phù hợp với bộ lọc hiện tại.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Nhân viên</th>
                  <th className="px-6 py-3.5">Phòng ban</th>
                  <th className="px-6 py-3.5">Ngày ra ngoài</th>
                  <th className="px-6 py-3.5">Khung giờ</th>
                  <th className="px-6 py-3.5">Số giờ</th>
                  <th className="px-6 py-3.5">Mục đích</th>
                  <th className="px-6 py-3.5">Trạng thái</th>
                  <th className="px-6 py-3.5 text-right">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {requests.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">
                      {r.employee_name}
                    </td>
                    <td className="px-6 py-4 text-slate-600 whitespace-nowrap">
                      {r.department_name || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{r.request_date}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-700 whitespace-nowrap">
                      {r.start_time} → {r.end_time}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-bold text-blue-700">{r.estimated_hours}</span> giờ
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {r.reason_type === 'WORK' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                          <Briefcase className="w-3 h-3" /> Việc công
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                          <UserCheck className="w-3 h-3" /> Việc riêng
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <OutOfficeStatusBadge status={r.status} />
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <Link
                        href={`/out-office/${r.id}`}
                        className="inline-flex items-center text-xs font-semibold text-blue-600 hover:text-blue-800"
                      >
                        Xem
                        <ArrowRight className="w-3.5 h-3.5 ml-1" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
