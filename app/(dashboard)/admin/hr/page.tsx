import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/permissions";
import { getHrAdminData, getLeaveEntitlements } from "@/lib/admin/queries";
import HrAdminPanel from "@/components/admin/hr-admin-panel";
import { canManageHr } from "@/lib/auth/admin-account";

export const metadata = { title: "Quản trị nhân sự | Tri Thức Việt" };

export default async function HrAdminPage({
  searchParams,
}: {
  searchParams?: {
    year?: string;
    q?: string;
    department?: string;
    team?: string;
    status?: string;
    page?: string;
    section?: string;
  };
}) {
  const user = await requireAuth();
  if (!canManageHr(user)) redirect("/");
  const currentYear = Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
    }).format(new Date()),
  );
  const requestedYear = Number(searchParams?.year);
  const year =
    Number.isInteger(requestedYear) &&
    requestedYear >= 2000 &&
    requestedYear <= 2200
      ? requestedYear
      : currentYear;
  const pageNumber = Number(searchParams?.page);
  const [
    { users, departments, teams, managers, total, hasNext, page },
    entitlements,
  ] = await Promise.all([
    getHrAdminData({
      q: searchParams?.q,
      departmentId: searchParams?.department,
      teamId: searchParams?.team,
      status: searchParams?.status,
      page: Number.isInteger(pageNumber) && pageNumber > 0 ? pageNumber : 1,
    }),
    getLeaveEntitlements(year),
  ]);
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">
          Khu vực quản trị
        </p>
        <h1 className="mt-1 text-2xl font-black text-slate-900">
          Quản lý nhân sự
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Quản lý tài khoản, phòng ban, team, quản lý trực tiếp và hạn mức phép
          theo năm.
        </p>
        <form method="get" className="mt-4 flex items-center gap-2 text-sm">
          <label htmlFor="year" className="font-semibold text-slate-700">
            Năm phép
          </label>
          <input
            id="year"
            name="year"
            type="number"
            min="2000"
            max="2200"
            defaultValue={year}
            className="w-28 rounded-lg border border-slate-300 px-3 py-2"
          />
          <button className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white">
            Xem năm
          </button>
        </form>
      </header>
      <HrAdminPanel
        users={users}
        managers={managers}
        departments={departments}
        teams={teams}
        entitlements={entitlements}
        year={year}
        total={total}
        hasNext={hasNext}
        page={page}
        filters={{
          q: searchParams?.q || "",
          department: searchParams?.department || "",
          team: searchParams?.team || "",
          status: searchParams?.status || "",
        }}
        section={searchParams?.section || "employees"}
      />
    </div>
  );
}
