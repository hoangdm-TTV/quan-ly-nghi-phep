'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';

type Option = { id: string; name: string };
type UserOption = { id: string; full_name: string; role: string };

type Props = {
  basePath: '/leave' | '/out-office';
  status?: string;
  departmentId?: string;
  teamId?: string;
  employeeId?: string;
  from?: string;
  to?: string;
  departments: Option[];
  teams: Array<Option & { department_id: string | null }>;
  users: UserOption[];
};

export default function ScopeFilterForm({
  basePath,
  status,
  departmentId = '',
  teamId = '',
  employeeId = '',
  from = '',
  to = '',
  departments,
  teams,
  users,
}: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [selectedDepartment, setSelectedDepartment] = useState(departmentId);
  const [selectedTeam, setSelectedTeam] = useState(teamId);
  const [selectedEmployee, setSelectedEmployee] = useState(employeeId);

  const submitAfterChange = () => {
    window.setTimeout(() => formRef.current?.requestSubmit(), 0);
  };

  const clearFilters = () => {
    const params = new URLSearchParams({ tab: 'scope' });
    if (status && status !== 'ALL') params.set('status', status);
    window.location.assign(`${basePath}?${params.toString()}`);
  };

  return (
    <form ref={formRef} method="get" className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200/90 flex flex-col sm:flex-row sm:items-end gap-3.5">
      <input type="hidden" name="tab" value="scope" />
      {status && status !== 'ALL' && <input type="hidden" name="status" value={status} />}

      <div className="flex-1 min-w-[180px]">
        <label htmlFor={`${basePath}-department`} className="block text-xs font-bold text-slate-700 mb-1.5">Phòng ban</label>
        <select
          id={`${basePath}-department`}
          name="departmentId"
          value={selectedDepartment}
          onChange={(event) => {
            setSelectedDepartment(event.target.value);
            setSelectedTeam('');
            setSelectedEmployee('');
            submitAfterChange();
          }}
          className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#005a3c]"
        >
          <option value="">Tất cả phòng ban</option>
          {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
        </select>
      </div>

      <div className="flex-1 min-w-[180px]">
        <label htmlFor={`${basePath}-team`} className="block text-xs font-bold text-slate-700 mb-1.5">Team</label>
        <select
          id={`${basePath}-team`}
          name="teamId"
          value={selectedTeam}
          onChange={(event) => {
            setSelectedTeam(event.target.value);
            setSelectedEmployee('');
            submitAfterChange();
          }}
          className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#005a3c]"
        >
          <option value="">Tất cả team</option>
          {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
        </select>
      </div>

      <div className="flex-1 min-w-[200px]">
        <label htmlFor={`${basePath}-employee`} className="block text-xs font-bold text-slate-700 mb-1.5">Nhân viên</label>
        <select
          id={`${basePath}-employee`}
          name="employeeId"
          value={selectedEmployee}
          onChange={(event) => {
            setSelectedEmployee(event.target.value);
            submitAfterChange();
          }}
          className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#005a3c]"
        >
          <option value="">Tất cả nhân viên</option>
          {users.map((user) => <option key={user.id} value={user.id}>{user.full_name}</option>)}
        </select>
      </div>

      <div>
        <label htmlFor={`${basePath}-from`} className="block text-xs font-bold text-slate-700 mb-1.5">Từ ngày</label>
        <input id={`${basePath}-from`} name="from" type="date" defaultValue={from} onChange={submitAfterChange} className="rounded-xl border border-slate-300 bg-slate-50/50 px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#005a3c]" />
      </div>
      <div>
        <label htmlFor={`${basePath}-to`} className="block text-xs font-bold text-slate-700 mb-1.5">Đến ngày</label>
        <input id={`${basePath}-to`} name="to" type="date" defaultValue={to} onChange={submitAfterChange} className="rounded-xl border border-slate-300 bg-slate-50/50 px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#005a3c]" />
      </div>

      {(selectedDepartment || selectedTeam || selectedEmployee || from || to) && (
        <button type="button" onClick={clearFilters} className="px-3 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 whitespace-nowrap">Xóa lọc</button>
      )}
    </form>
  );
}
