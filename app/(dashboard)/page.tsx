import { requireAuth } from '@/lib/auth/permissions';
import { getDashboardStats, getRecentActivities } from '@/lib/dashboard/queries';
import { getPendingLeaveRequestsForApprover } from '@/lib/leave/queries';
import { getPendingOutOfficeRequestsForApprover } from '@/lib/out-office/queries';
import Link from 'next/link';
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  ArrowRight,
  ShieldAlert,
  Inbox,
  Sparkles,
  FileText,
  UserCheck,
} from 'lucide-react';

export default async function DashboardPage() {
  const user = await requireAuth();

  // Nạp số liệu thống kê và hoạt động gần đây từ PostgreSQL
  const [stats, recentActivities, pendingLeaves, pendingOutOffices] = await Promise.all([
    getDashboardStats(user),
    getRecentActivities(user),
    getPendingLeaveRequestsForApprover(user),
    getPendingOutOfficeRequestsForApprover(user),
  ]);

  const canApprove =
    user.role === 'TEAM_LEAD' ||
    user.role === 'MANAGER' ||
    user.role === 'ACCOUNTANT' ||
    user.role === 'DIRECTOR';

  const totalPendingForMe = stats.pendingLeaveApprovals + stats.pendingOutOfficeApprovals;

  return (
    <div className="space-y-8">
      {/* 1. Lời chào và Lối tắt nhanh */}
      <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 rounded-2xl p-6 sm:p-8 text-white shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-200 border border-blue-400/20">
            <Sparkles className="w-3.5 h-3.5" />
            Cổng quản trị nhân sự nội bộ
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
            Xin chào, {user.full_name}!
          </h2>
          <p className="text-xs sm:text-sm text-blue-200/80 max-w-xl">
            Vai trò: <span className="font-semibold text-white">{user.role}</span>
            {user.department_name ? ` • ${user.department_name}` : ''}
            {user.team_name ? ` • ${user.team_name}` : ''}. Chúc bạn một ngày làm việc hiệu quả!
          </p>
        </div>

        {/* Lối tắt tạo đơn (Ẩn đối với Giám đốc) */}
        {user.role !== 'DIRECTOR' && (
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/leave/new"
              className="inline-flex items-center px-4 py-2.5 rounded-xl text-xs font-semibold text-blue-900 bg-white hover:bg-blue-50 transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Tạo đơn nghỉ phép
            </Link>

            <Link
              href="/out-office/new"
              className="inline-flex items-center px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-blue-600/60 hover:bg-blue-600 border border-white/20 transition-colors"
            >
              <Clock className="w-4 h-4 mr-1.5" />
              Tạo đơn ra ngoài
            </Link>
          </div>
        )}
      </div>

      {/* 2. Cảnh báo việc cần làm (Dành cho Người phê duyệt có đơn chờ) */}
      {canApprove && totalPendingForMe > 0 && (
        <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl flex-shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-900">
                Bạn có {totalPendingForMe} đơn cần xử lý phê duyệt
              </h3>
              <p className="text-xs text-amber-700/90 mt-0.5">
                {stats.pendingLeaveApprovals > 0 && (
                  <span>• {stats.pendingLeaveApprovals} đơn nghỉ phép đang chờ. </span>
                )}
                {stats.pendingOutOfficeApprovals > 0 && (
                  <span>• {stats.pendingOutOfficeApprovals} đơn ra ngoài đang chờ. </span>
                )}
                Vui lòng xử lý để nhân viên kịp thời nhận thông báo.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {stats.pendingLeaveApprovals > 0 && (
              <Link
                href="/approvals/leave"
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors whitespace-nowrap"
              >
                Duyệt nghỉ phép ({stats.pendingLeaveApprovals})
              </Link>
            )}
            {stats.pendingOutOfficeApprovals > 0 && (
              <Link
                href="/approvals/out-office"
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-700 text-white hover:bg-amber-800 transition-colors whitespace-nowrap"
              >
                Duyệt ra ngoài ({stats.pendingOutOfficeApprovals})
              </Link>
            )}
          </div>
        </div>
      )}

      {/* 3. Lưới thẻ thống kê số liệu thực tế (Stats Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Tổng đơn nghỉ phép */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Nghỉ phép cá nhân</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <CalendarDays className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-2xl font-bold text-slate-900">{stats.myLeaveTotal}</span>
            <span className="text-xs text-slate-500 ml-1.5">tổng số đơn</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <span className="text-amber-600 font-medium">{stats.myLeavePending} đang chờ</span>
            <span>•</span>
            <span className="text-emerald-600 font-medium">{stats.myLeaveApproved} đã duyệt</span>
          </div>
        </div>

        {/* Card 2: Tổng đơn ra ngoài */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Đơn ra ngoài cá nhân</span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-2xl font-bold text-slate-900">{stats.myOutOfficeTotal}</span>
            <span className="text-xs text-slate-500 ml-1.5">lượt ra ngoài</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <span className="text-amber-600 font-medium">{stats.myOutOfficePending} chờ duyệt</span>
            <span>•</span>
            <span className="text-emerald-600 font-medium">{stats.myOutOfficeCompleted} hoàn tất</span>
          </div>
        </div>

        {/* Card 3: Thống kê trạng thái đang xử lý */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Đang chờ bạn xử lý</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <Inbox className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-2xl font-bold text-slate-900">
              {canApprove ? totalPendingForMe : 0}
            </span>
            <span className="text-xs text-slate-500 ml-1.5">đơn đến lượt</span>
          </div>
          <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100 truncate">
            {canApprove
              ? totalPendingForMe > 0
                ? 'Có đơn đang chờ duyệt'
                : 'Đã hoàn thành duyệt tất cả'
              : 'Tài khoản không có quyền duyệt'}
          </div>
        </div>

        {/* Card 4: Phạm vi quyền hạn thực tế */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Phạm vi tài khoản</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-sm font-bold text-slate-900 truncate block">
              {user.department_name || 'Công ty'}
            </span>
            <span className="text-xs text-slate-500 block truncate">
              {user.team_name ? `Nhóm: ${user.team_name}` : `Cấp bậc: ${user.role}`}
            </span>
          </div>
          <div className="text-[11px] text-emerald-700 font-medium pt-1 border-t border-slate-100 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Đang hoạt động (Active)
          </div>
        </div>
      </div>

      {/* 4. Danh sách hoạt động gần đây & Đơn chờ xử lý */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cột trái: Đơn gần đây của cá nhân (Chiếm 2 cột) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              Đơn gần đây của bạn
            </h3>
            <div className="flex items-center gap-3 text-xs">
              <Link href="/leave" className="text-blue-600 hover:text-blue-800 font-medium">
                Nghỉ phép →
              </Link>
              <Link href="/out-office" className="text-blue-600 hover:text-blue-800 font-medium">
                Ra ngoài →
              </Link>
            </div>
          </div>

          {recentActivities.length === 0 ? (
            <div className="p-8 text-center text-slate-400 space-y-2">
              <Inbox className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-xs font-medium text-slate-600">Bạn chưa có đơn nào gần đây</p>
              <p className="text-[11px] text-slate-400">
                Các đơn xin nghỉ phép hoặc ra ngoài bạn tạo sẽ xuất hiện tại đây.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentActivities.map((item) => (
                <div
                  key={item.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 hover:bg-slate-50/60 rounded-lg px-2 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                          item.type === 'LEAVE'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-purple-50 text-purple-700 border border-purple-200'
                        }`}
                      >
                        {item.type === 'LEAVE' ? 'Nghỉ phép' : 'Ra ngoài'}
                      </span>
                      <h4 className="text-xs font-semibold text-slate-900">{item.title}</h4>
                    </div>
                    <p className="text-[11px] text-slate-500">{item.dateInfo}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${
                        item.status === 'COMPLETED' || item.status === 'WAITING_FOR_DOC'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : item.status === 'REJECTED'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {item.status}
                    </span>
                    <Link
                      href={item.link}
                      className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      Chi tiết <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cột phải: Đơn cần phê duyệt gấp & Lối tắt */}
        <div className="space-y-6">
          {/* Box hàng đợi duyệt đơn */}
          {canApprove && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-purple-600" />
                  Cần bạn phê duyệt
                </span>
                <span className="text-xs font-bold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full">
                  {totalPendingForMe}
                </span>
              </h3>

              {totalPendingForMe === 0 ? (
                <p className="text-xs text-slate-500 py-3 text-center italic">
                  Không có đơn nào đang chờ duyệt.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {pendingLeaves.slice(0, 2).map((req) => (
                    <Link
                      key={req.id}
                      href={`/leave/${req.id}`}
                      className="block p-3 rounded-xl bg-slate-50 hover:bg-purple-50/60 border border-slate-200 hover:border-purple-200 transition-colors"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-900">{req.employee_name}</span>
                        <span className="text-[10px] text-purple-700 font-medium">Nghỉ phép</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 truncate">
                        {req.start_date} → {req.end_date} ({req.duration_days} ngày)
                      </p>
                    </Link>
                  ))}

                  {pendingOutOffices.slice(0, 2).map((req) => (
                    <Link
                      key={req.id}
                      href={`/out-office/${req.id}`}
                      className="block p-3 rounded-xl bg-slate-50 hover:bg-amber-50/60 border border-slate-200 hover:border-amber-200 transition-colors"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-900">{req.employee_name}</span>
                        <span className="text-[10px] text-amber-700 font-medium">Ra ngoài</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 truncate">
                        {req.request_date} ({req.start_time} - {req.end_time})
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Box hướng dẫn quy trình */}
          <div className="bg-slate-900 text-slate-300 rounded-2xl p-6 shadow-xs space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Quy tắc hệ thống
            </h4>
            <div className="space-y-2 text-xs leading-relaxed text-slate-300">
              <p>
                • <strong>Nghỉ phép:</strong> Lịch làm việc T2 – T7 (đã tự động loại trừ Chủ Nhật).
              </p>
              <p>
                • <strong>Duyệt đa cấp:</strong> Đơn nghỉ từ 2 ngày trở lên yêu cầu Giám đốc phê duyệt cấp 2.
              </p>
              <p>
                • <strong>Ra ngoài:</strong> Đăng ký trước khi đi và ký xác nhận khi về tại phòng Kế toán.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
