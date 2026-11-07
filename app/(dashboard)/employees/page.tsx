import Link from "next/link";
import {
  Building2,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Mail,
  UsersRound,
} from "lucide-react";
import { requireAuth } from "@/lib/auth/permissions";
import { getEmployeeDirectory } from "@/lib/employees/queries";
import { getUserDataScopeLabel } from "@/lib/auth/data-scope";
import { canManageHr } from "@/lib/auth/admin-account";
import EmployeeDirectoryFilters from "@/components/employees/employee-directory-filters";

export const metadata = {
  title: "Danh bạ nhân sự | Tri Thức Việt",
  description: "Tra cứu danh bạ nhân sự nội bộ theo phạm vi quyền được cấp.",
  robots: { index: false, follow: false },
};

const roleLabels: Record<string, string> = {
  STAFF: "Nhân viên",
  TEAM_LEAD: "Trưởng nhóm",
  MANAGER: "Trưởng phòng",
  ACCOUNTANT: "Kế toán",
  DIRECTOR: "Giám đốc",
  ADMIN: "Quản trị hệ thống",
};

const statusLabels: Record<string, string> = {
  ACTIVE: "Đang làm việc",
  SUSPENDED: "Tạm khóa",
  TERMINATED: "Đã nghỉ việc",
};

const roleStyles: Record<string, string> = {
  STAFF: "bg-sky-50 text-sky-800 ring-sky-200",
  TEAM_LEAD: "bg-violet-50 text-violet-800 ring-violet-200",
  MANAGER: "bg-amber-50 text-amber-900 ring-amber-200",
  ACCOUNTANT: "bg-cyan-50 text-cyan-900 ring-cyan-200",
  DIRECTOR: "bg-emerald-50 text-emerald-900 ring-emerald-200",
  ADMIN: "bg-rose-50 text-rose-800 ring-rose-200",
};

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0] || "")
    .join("")
    .toLocaleUpperCase("vi-VN");
}

function getStatus(employee: { is_active: boolean; employment_status: string }) {
  if (!employee.is_active) return "Đã khóa";
  return statusLabels[employee.employment_status] || "Không xác định";
}

function getStatusStyle(employmentStatus: string, isActive: boolean) {
  if (employmentStatus === "TERMINATED") return "bg-slate-100 text-slate-700";
  if (!isActive || employmentStatus === "SUSPENDED") return "bg-amber-50 text-amber-900";
  return "bg-emerald-50 text-emerald-900";
}

function getRoleStyle(role: string) {
  return roleStyles[role] || "bg-slate-100 text-slate-700 ring-slate-200";
}

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams?: {
    q?: string;
    page?: string;
    departmentId?: string;
    teamId?: string;
    unassignedOnly?: string;
    employmentStatus?: string;
    missingEntitlementYear?: string;
  };
}) {
  const user = await requireAuth();
  const requestedPage = Number(searchParams?.page);
  const pageNumber =
    Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const q = (searchParams?.q || "").trim().slice(0, 100);
  const requestedEntitlementYear = Number(searchParams?.missingEntitlementYear);
  const missingEntitlementYear =
    Number.isInteger(requestedEntitlementYear) &&
    requestedEntitlementYear >= 2000 &&
    requestedEntitlementYear <= 2200
      ? requestedEntitlementYear
      : undefined;
  const requestedDepartmentId = searchParams?.departmentId || "";
  const requestedTeamId = searchParams?.teamId || "";
  const unassignedOnly =
    searchParams?.unassignedOnly === "true" || searchParams?.unassignedOnly === "1";
  const employmentStatus = ["ACTIVE", "SUSPENDED", "TERMINATED"].includes(
    searchParams?.employmentStatus || "",
  )
    ? (searchParams?.employmentStatus as "ACTIVE" | "SUSPENDED" | "TERMINATED")
    : undefined;

  const {
    employees,
    total,
    page,
    hasNext,
    departments,
    teams,
  } = await getEmployeeDirectory(user, {
    q,
    departmentId: requestedDepartmentId,
    teamId: requestedTeamId,
    unassignedOnly,
    employmentStatus,
    missingEntitlementYear,
    page: pageNumber,
  });

  const departmentId =
    requestedDepartmentId === "__UNASSIGNED__" ||
    departments.some((item) => item.id === requestedDepartmentId)
      ? requestedDepartmentId
      : "";
  const teamId =
    requestedTeamId === "__UNASSIGNED__" ||
    teams.some((item) => item.id === requestedTeamId)
      ? requestedTeamId
      : "";
  const scopeLabel = getUserDataScopeLabel(user);

  const pageHref = (nextPage: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (departmentId) params.set("departmentId", departmentId);
    if (teamId) params.set("teamId", teamId);
    if (unassignedOnly) params.set("unassignedOnly", "true");
    if (employmentStatus) params.set("employmentStatus", employmentStatus);
    if (missingEntitlementYear)
      params.set("missingEntitlementYear", String(missingEntitlementYear));
    params.set("page", String(nextPage));
    return `/employees?${params.toString()}`;
  };

  return (
    <main className="mx-auto max-w-7xl space-y-6">
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#064e3b] via-[#047857] to-teal-700 px-5 py-6 text-white shadow-sm sm:px-8 sm:py-8">
        <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-emerald-50">
              <UsersRound className="h-3.5 w-3.5" />
              Nhân sự · Danh bạ
            </div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
              Danh bạ nhân sự
            </h1>
            <p className="mt-2 text-sm leading-6 text-emerald-50/90">
              Tra cứu thông tin đồng nghiệp trong phạm vi được phân quyền. Phạm vi hiện tại: <strong className="text-white">{scopeLabel}</strong>.
            </p>
          </div>
          {canManageHr(user) && (
            <Link
              href="/admin/hr"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-emerald-900 shadow-sm transition hover:bg-emerald-50"
            >
              <Briefcase className="h-4 w-4" />
              Quản trị hồ sơ
            </Link>
          )}
        </div>
        <div className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full border-[28px] border-white/5" />
        <div className="pointer-events-none absolute -bottom-28 right-40 h-48 w-48 rounded-full bg-white/5" />
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800">
            <Building2 className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Lọc danh sách</h2>
            <p className="text-xs text-slate-500">Các lựa chọn chỉ bao gồm dữ liệu trong phạm vi của bạn.</p>
          </div>
        </div>
        <EmployeeDirectoryFilters
          q={q}
          departmentId={departmentId}
          teamId={teamId}
          unassignedOnly={unassignedOnly}
          employmentStatus={employmentStatus || ""}
          missingEntitlementYear={missingEntitlementYear}
          departments={departments}
          teams={teams}
        />
      </section>

      {missingEntitlementYear && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 font-bold">!</span>
          <p>Đang hiển thị nhân sự hoạt động chưa được cấp hạn mức nghỉ phép năm <strong>{missingEntitlementYear}</strong>.</p>
        </div>
      )}
      {unassignedOnly && (
        <div className="flex items-start gap-3 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-950">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-100 font-bold">!</span>
          <p>Đang hiển thị nhân sự chưa được gán <strong>phòng ban hoặc team</strong>.</p>
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="text-base font-bold text-slate-900">Danh sách nhân viên</h2>
            <p className="mt-0.5 text-xs text-slate-500">Trang {page} · Hiển thị {employees.length} trên {total} kết quả</p>
          </div>
          <span className="inline-flex w-fit items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
            {total.toLocaleString("vi-VN")} nhân sự
          </span>
        </div>

        {employees.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <UsersRound className="h-6 w-6" />
            </div>
            <h3 className="mt-3 text-sm font-bold text-slate-800">Không tìm thấy nhân sự</h3>
            <p className="mt-1 text-xs text-slate-500">Thử thay đổi từ khóa hoặc bộ lọc trong phạm vi được phép.</p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3.5">Nhân viên</th>
                    <th className="px-4 py-3.5">Vai trò / Chức vụ</th>
                    <th className="px-4 py-3.5">Phòng ban / Team</th>
                    <th className="px-4 py-3.5">Quản lý</th>
                    <th className="px-4 py-3.5">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employees.map((employee) => {
                    const status = getStatus(employee);
                    const statusStyle = getStatusStyle(employee.employment_status, employee.is_active);
                    return (
                      <tr key={employee.id} className="transition-colors hover:bg-slate-50/70">
                        <td className="px-5 py-4">
                          <div className="flex min-w-56 items-center gap-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-xs font-black text-emerald-800 ring-1 ring-emerald-100">
                              {getInitials(employee.full_name)}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-bold text-slate-900">{employee.full_name}</p>
                              <a href={`mailto:${employee.email}`} className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-500 hover:text-emerald-800">
                                <Mail className="h-3 w-3 shrink-0" />{employee.email}
                              </a>
                              <p className="mt-0.5 text-[11px] font-medium text-slate-400">Mã NV: {employee.employee_code || "—"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${getRoleStyle(employee.role)}`}>{roleLabels[employee.role] || employee.role}</span>
                          <p className="mt-1.5 text-xs text-slate-600">{employee.position || "Chưa cập nhật chức vụ"}</p>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col items-start gap-1.5">
                            <span className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold ${employee.department_name ? "bg-teal-50 text-teal-900" : "bg-orange-50 text-orange-900 ring-1 ring-inset ring-orange-200"}`}>
                              <Building2 className="h-3.5 w-3.5" />{employee.department_name || "Chưa phân phòng ban"}
                            </span>
                            <span className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold ${employee.team_name ? "bg-indigo-50 text-indigo-900" : "bg-orange-50 text-orange-900 ring-1 ring-inset ring-orange-200"}`}>
                              <UsersRound className="h-3.5 w-3.5" />{employee.team_name || "Chưa phân team"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700">{employee.manager_name || "Chưa phân công"}</td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${employee.employment_status === "TERMINATED" ? "bg-slate-500" : !employee.is_active || employee.employment_status === "SUSPENDED" ? "bg-amber-500" : "bg-emerald-500"}`} />
                            {status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-100 md:hidden">
              {employees.map((employee) => {
                const status = getStatus(employee);
                const statusStyle = getStatusStyle(employee.employment_status, employee.is_active);
                return (
                  <article key={employee.id} className="space-y-3 p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-xs font-black text-emerald-800 ring-1 ring-emerald-100">
                        {getInitials(employee.full_name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="font-bold text-slate-900">{employee.full_name}</h3>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusStyle}`}>{status}</span>
                        </div>
                        <a href={`mailto:${employee.email}`} className="mt-1 flex items-center gap-1 truncate text-xs text-slate-500">
                          <Mail className="h-3 w-3 shrink-0" />{employee.email}
                        </a>
                        <p className="mt-1 text-[11px] text-slate-400">{employee.employee_code || "Chưa có mã nhân viên"}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-xs">
                      <div>
                        <p className="text-slate-400">Vai trò / chức vụ</p>
                        <span className={`mt-1 inline-flex rounded-full px-2 py-1 text-[11px] font-bold ring-1 ring-inset ${getRoleStyle(employee.role)}`}>{roleLabels[employee.role] || employee.role}</span>
                        <p className="mt-1 font-medium text-slate-700">{employee.position || "Chưa cập nhật chức vụ"}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Phân bổ</p>
                        <p className={`mt-1 font-semibold ${employee.department_name ? "text-teal-900" : "text-orange-900"}`}>{employee.department_name || "Chưa phân phòng ban"}</p>
                        <p className={`mt-1 font-semibold ${employee.team_name ? "text-indigo-900" : "text-orange-900"}`}>{employee.team_name || "Chưa phân team"}</p>
                      </div>
                      <div className="col-span-2"><p className="text-slate-400">Quản lý trực tiếp</p><p className="mt-1 font-semibold text-slate-700">{employee.manager_name || "Chưa phân công"}</p></div>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}

        <footer className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-xs text-slate-500">Kết quả được giới hạn theo quyền truy cập của bạn.</p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={pageHref(page - 1)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                <ChevronLeft className="h-3.5 w-3.5" /> Trước
              </Link>
            )}
            {hasNext && (
              <Link href={pageHref(page + 1)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                Tiếp <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </footer>
      </section>
    </main>
  );
}
