import { requireAuth } from '@/lib/auth/permissions';
import { redirect } from 'next/navigation';
import { User, Mail, Shield, Building, Users, KeyRound, CheckCircle2 } from 'lucide-react';

export const metadata = {
  title: 'Hồ sơ tài khoản | Leave & Gate Pass',
};

export default async function ProfilePage() {
  const user = await requireAuth();
  if (user.role === 'ACCOUNTANT') redirect('/');

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Hồ sơ người dùng</h2>
        <p className="text-xs text-slate-500 mt-1">
          Thông tin chi tiết về tài khoản, vai trò và phạm vi phân quyền truy cập hệ thống của bạn.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Cột trái: Thẻ tóm tắt thông tin */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 flex flex-col items-center text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-2xl border-4 border-blue-50">
            {user.full_name.slice(0, 2).toUpperCase()}
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900">{user.full_name}</h3>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>
          <div className="pt-2">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              {user.role}
            </span>
          </div>

          <div className="w-full pt-4 border-t border-slate-100 text-left text-xs space-y-2">
            <div className="flex items-center justify-between text-slate-500">
              <span>Trạng thái tài khoản:</span>
              <span className="font-semibold text-emerald-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Hoạt động
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-500">
              <span>Bảo mật phiên:</span>
              <span className="font-medium text-slate-700">HttpOnly Session</span>
            </div>
          </div>
        </div>

        {/* Cột phải: Chi tiết tổ chức và phân quyền */}
        <div className="md:col-span-2 space-y-6">
          {/* Thông tin phòng ban và tổ chức */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Building className="w-4 h-4 text-blue-600" />
              Thông tin tổ chức & Phòng ban
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                <span className="text-slate-500 block">Phòng ban công tác:</span>
                <span className="font-bold text-slate-800 text-sm">
                  {user.department_name || 'Ban điều hành / Chưa phân bổ'}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                <span className="text-slate-500 block">Nhóm làm việc (Team):</span>
                <span className="font-bold text-slate-800 text-sm">
                  {user.team_name || 'Toàn phòng ban / Chưa phân bổ'}
                </span>
              </div>
            </div>
          </div>

          {/* Phạm vi phân quyền */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Shield className="w-4 h-4 text-purple-600" />
              Phạm vi quyền hạn hệ thống
            </h3>

            <div className="space-y-3 text-xs leading-relaxed text-slate-700">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900">Xem và tạo đơn: </strong>
                  {user.role === 'DIRECTOR'
                    ? 'Giám sát và xem toàn bộ dữ liệu đơn của công ty.'
                    : 'Được tạo và quản lý toàn bộ các đơn nghỉ phép và đơn ra ngoài cá nhân.'}
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900">Quyền phê duyệt đơn: </strong>
                  {user.role === 'DIRECTOR'
                    ? 'Có quyền duyệt đơn nghỉ phép và đơn ra ngoài toàn công ty; đơn nghỉ nhiều ngày theo luồng Manager → Director.'
                    : user.role === 'MANAGER'
                    ? 'Duyệt đơn nghỉ phép và đơn ra ngoài của Staff/Team Lead trong phòng ban; nghỉ nhiều ngày chuyển tiếp Giám đốc.'
                    : user.role === 'TEAM_LEAD'
                    ? 'Không có quyền duyệt; chỉ tạo và theo dõi đơn của mình/theo phạm vi được phép xem.'
                    : 'Nhân viên không có quyền phê duyệt.'}
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900">Bảo mật dữ liệu: </strong>
                  Mọi thao tác đọc, tạo hoặc duyệt đều được kiểm tra tính hợp lệ và xác thực danh tính tại Server.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
