"use client";

import { useEffect, useRef, useState } from "react";
import type {
  EmployeeDirectoryDepartment,
  EmployeeDirectoryTeam,
} from "@/lib/employees/queries";

type Props = {
  q: string;
  departmentId: string;
  teamId: string;
  unassignedOnly: boolean;
  employmentStatus: string;
  missingEntitlementYear?: number;
  pageSize: number;
  departments: EmployeeDirectoryDepartment[];
  teams: EmployeeDirectoryTeam[];
};

export default function EmployeeDirectoryFilters({
  q,
  departmentId,
  teamId,
  unassignedOnly,
  employmentStatus,
  missingEntitlementYear,
  pageSize,
  departments,
  teams,
}: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [selectedDepartment, setSelectedDepartment] = useState(departmentId);
  const [selectedTeam, setSelectedTeam] = useState(teamId);
  const [search, setSearch] = useState(q);
  const initialSearch = useRef(q);
  const availableTeams = selectedDepartment
    ? teams.filter((team) => team.department_id === selectedDepartment)
    : teams;
  const hasFilters = Boolean(
    q ||
      selectedDepartment ||
      selectedTeam ||
      unassignedOnly ||
      employmentStatus ||
      missingEntitlementYear,
  );
  const selectClass =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800";

  const submitOnChange = () => {
    window.setTimeout(() => formRef.current?.requestSubmit(), 0);
  };

  useEffect(() => {
    if (search === initialSearch.current) return;
    const timeout = window.setTimeout(() => formRef.current?.requestSubmit(), 400);
    return () => window.clearTimeout(timeout);
  }, [search]);

  return (
    <form
      ref={formRef}
      method="get"
      className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-[minmax(240px,1fr)_220px_220px_180px_auto_auto]"
    >
      {missingEntitlementYear && (
        <input
          type="hidden"
          name="missingEntitlementYear"
          value={missingEntitlementYear}
        />
      )}
      <input type="hidden" name="pageSize" value={pageSize} />
      <label className="text-xs font-semibold text-slate-700">
        Tìm nhân viên
        <input
          name="q"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          maxLength={100}
          placeholder="Tên, email, mã NV hoặc chức vụ"
          className={`${selectClass} mt-1`}
        />
      </label>
      <label className="text-xs font-semibold text-slate-700">
        Phòng ban
        <select
          name="departmentId"
          value={selectedDepartment}
          onChange={(event) => {
            setSelectedDepartment(event.target.value);
            setSelectedTeam("");
            submitOnChange();
          }}
          className={`${selectClass} mt-1`}
        >
          <option value="">Tất cả phòng ban trong phạm vi</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
          <option value="__UNASSIGNED__">Chưa phân phòng ban</option>
        </select>
      </label>
      <label className="text-xs font-semibold text-slate-700">
        Team
        <select
          name="teamId"
          value={selectedTeam}
          onChange={(event) => {
            setSelectedTeam(event.target.value);
            submitOnChange();
          }}
          className={`${selectClass} mt-1`}
        >
          <option value="">Tất cả team trong phạm vi</option>
          <option value="__UNASSIGNED__">Chưa phân team</option>
          {availableTeams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-semibold text-slate-700">
        Trạng thái nhân sự
        <select
          name="employmentStatus"
          defaultValue={employmentStatus}
          onChange={submitOnChange}
          className={`${selectClass} mt-1`}
        >
          <option value="">Mọi trạng thái</option>
          <option value="ACTIVE">Đang làm việc</option>
          <option value="SUSPENDED">Tạm khóa</option>
          <option value="TERMINATED">Đã nghỉ việc</option>
        </select>
      </label>
      <label className="flex items-center gap-2 self-end rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 sm:col-span-2 lg:col-span-1">
        <input
          type="checkbox"
          name="unassignedOnly"
          value="true"
          defaultChecked={unassignedOnly}
          onChange={submitOnChange}
          className="h-4 w-4 rounded border-amber-400 text-amber-700 focus:ring-amber-500"
        />
        Thiếu phòng ban hoặc team
      </label>
      <div className="flex gap-2 self-end">
          {hasFilters && (
          <a
            href="/employees"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-center text-sm font-semibold text-slate-700"
          >
            Xóa lọc
          </a>
        )}
      </div>
    </form>
  );
}
