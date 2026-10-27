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

  const hasFilters = Boolean(selectedDepartment || selectedTeam || selectedEmployee || from || to);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-800">Bộ lọc danh sách</p>
          <p className="text-xs text-slate-500">Chọn điều kiện, hệ thống sẽ tự động cập nhật kết quả.</p>
        </div>
        {hasFilters && <span className="text-xs font-semibold text-[#005a3c]">Đang áp dụng bộ lọc</span>}
      </div>
      <form ref={formRef} method="get" className="grid grid-cols-1 gap-3.5 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs sm:grid-cols-2 sm:p-5 lg:grid-cols-6">
        <input type="hidden" name="tab" value="scope" />
        {status && status !== 'ALL' && <input type="hidden" name="status" value={status} />}

        <div className="min-w-0">
          <label htmlFor={`${basePath}-department`} className="mb-1.5 block text-xs font-bold text-slate-700">Phòng ban</label>
          <select id={`${basePath}-department`} name="departmentId" value={selectedDepartment} onChange={(event) => { setSelectedDepartment(event.target.value); setSelectedTeam(''); setSelectedEmployee(''); submitAfterChange(); }} className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3.5 py-2.5 text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#005a3c] sm:text-sm">
            <option value="">Tất cả phòng ban</option>
            {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
          </select>
        </div>

        <div className="min-w-0">
          <label htmlFor={`${basePath}-team`} className="mb-1.5 block text-xs font-bold text-slate-700">Team</label>
          <select id={`${basePath}-team`} name="teamId" value={selectedTeam} onChange={(event) => { setSelectedTeam(event.target.value); setSelectedEmployee(''); submitAfterChange(); }} className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3.5 py-2.5 text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#005a3c] sm:text-sm">
            <option value="">Tất cả team</option>
            {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
          </select>
        </div>

        <div className="min-w-0">
          <label htmlFor={`${basePath}-employee`} className="mb-1.5 block text-xs font-bold text-slate-700">Nhân viên</label>
          <select id={`${basePath}-employee`} name="employeeId" value={selectedEmployee} onChange={(event) => { setSelectedEmployee(event.target.value); submitAfterChange(); }} className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3.5 py-2.5 text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#005a3c] sm:text-sm">
            <option value="">Tất cả nhân viên</option>
            {users.map((user) => <option key={user.id} value={user.id}>{user.full_name}</option>)}
          </select>
        </div>

        <div className="min-w-0">
          <label htmlFor={`${basePath}-from`} className="mb-1.5 block text-xs font-bold text-slate-700">Từ ngày</label>
          <input id={`${basePath}-from`} name="from" type="date" defaultValue={from} onChange={submitAfterChange} className="w-full min-w-0 rounded-xl border border-slate-300 bg-slate-50/50 px-3.5 py-2.5 text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#005a3c] sm:text-sm" />
        </div>
        <div className="min-w-0">
          <label htmlFor={`${basePath}-to`} className="mb-1.5 block text-xs font-bold text-slate-700">Đến ngày</label>
          <input id={`${basePath}-to`} name="to" type="date" defaultValue={to} onChange={submitAfterChange} className="w-full min-w-0 rounded-xl border border-slate-300 bg-slate-50/50 px-3.5 py-2.5 text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#005a3c] sm:text-sm" />
        </div>
        <div className="flex items-end">
          {hasFilters && <button type="button" onClick={clearFilters} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 lg:w-auto">Xóa bộ lọc</button>}
        </div>
      </form>
    </div>
  );
}
