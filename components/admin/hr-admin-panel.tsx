'use client';

import { useFormState } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import {
  createDepartmentAction, createTeamAction, saveEmployeeAction, setLeaveEntitlementAction,
  deleteDepartmentAction, deleteTeamAction, deleteEmployeeAction, updateDepartmentAction, updateTeamAction,
} from '@/lib/admin/actions';
import type { HrDepartment, HrTeam, HrUserRow, HrLeaveEntitlement } from '@/lib/admin/queries';

function Feedback({ state }: { state: { success?: string; error?: string } }) {
  if (state.error) return <p className="mt-2 text-xs text-rose-700">{state.error}</p>;
  if (state.success) return <p className="mt-2 text-xs text-emerald-700">{state.success}</p>;
  return null;
}

function EmployeeForm({ employee, departments, teams, managers }: {
  employee?: HrUserRow; departments: HrDepartment[]; teams: HrTeam[]; managers: Pick<HrUserRow, 'id' | 'full_name' | 'role'>[];
}) {
  const [state, action] = useFormState(saveEmployeeAction, {});
  const [selectedDepartment, setSelectedDepartment] = useState(employee?.department_id || '');
  const [selectedTeam, setSelectedTeam] = useState(employee?.team_id || '');
  const field = 'block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';
  return <form action={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {employee && <input type="hidden" name="id" value={employee.id} />}
    <label className="text-xs font-semibold text-slate-700">Họ tên<input required name="fullName" defaultValue={employee?.full_name} className={field} /></label>
    <label className="text-xs font-semibold text-slate-700">Email<input required type="email" name="email" defaultValue={employee?.email} className={field} /></label>
    <label className="text-xs font-semibold text-slate-700">Mã nhân viên<input name="employeeCode" defaultValue={employee?.employee_code || ''} className={field} /></label>
    <label className="text-xs font-semibold text-slate-700">Vai trò<select name="role" defaultValue={employee?.role || 'STAFF'} className={field}>
      <option value="STAFF">Nhân viên</option><option value="TEAM_LEAD">Trưởng nhóm</option><option value="MANAGER">Trưởng phòng</option><option value="ACCOUNTANT">Kế toán</option>
      {employee?.role === 'ADMIN' && <option value="ADMIN">Quản trị hệ thống</option>}{employee?.role === 'DIRECTOR' && <option value="DIRECTOR">Giám đốc</option>}
    </select></label>
    <label className="text-xs font-semibold text-slate-700">Chức vụ<input name="position" defaultValue={employee?.position || ''} className={field} /></label>
    <label className="text-xs font-semibold text-slate-700">Trạng thái<select name="isActive" defaultValue={employee?.is_active === false ? 'false' : 'true'} className={field}><option value="true">Đang hoạt động</option><option value="false">Đã khóa</option></select></label>
    <label className="text-xs font-semibold text-slate-700">Phòng ban<select name="departmentId" value={selectedDepartment} onChange={(event) => { setSelectedDepartment(event.target.value); setSelectedTeam(''); }} className={field}><option value="">Chưa phân bổ</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
    <label className="text-xs font-semibold text-slate-700">Team<select name="teamId" value={selectedTeam} onChange={(event) => setSelectedTeam(event.target.value)} disabled={!selectedDepartment} className={`${field} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400`}><option value="">{selectedDepartment ? 'Chưa phân bổ' : 'Chọn phòng ban trước'}</option>{teams.filter((t) => t.department_id === selectedDepartment).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
    <label className="text-xs font-semibold text-slate-700">Quản lý trực tiếp<select name="managerId" defaultValue={employee?.manager_id || ''} className={field}><option value="">Không có</option>{managers.filter((m) => m.id !== employee?.id).map((m) => <option key={m.id} value={m.id}>{m.full_name} · {m.role}</option>)}</select></label>
    <label className="text-xs font-semibold text-slate-700 sm:col-span-2 lg:col-span-3">{employee ? 'Đặt mật khẩu mới (để trống nếu không đổi)' : 'Mật khẩu khởi tạo'}<input name="password" type="password" minLength={6} maxLength={72} required={!employee} autoComplete="new-password" className={field} /></label>
    <div className="sm:col-span-2 lg:col-span-3"><button className="rounded-lg bg-[#005a3c] px-4 py-2 text-xs font-bold text-white">{employee ? 'Lưu hồ sơ' : 'Tạo tài khoản'}</button><Feedback state={state} /></div>
  </form>;
}

function DepartmentForm() {
  const [state, action] = useFormState(createDepartmentAction, {});
  return <form action={action} className="flex gap-2"><input name="name" required minLength={2} maxLength={255} placeholder="Tên phòng ban" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" /><button className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white">Thêm</button><Feedback state={state} /></form>;
}

function TeamForm({ departments }: { departments: HrDepartment[] }) {
  const [state, action] = useFormState(createTeamAction, {});
  return <form action={action} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
    <input name="name" required minLength={2} maxLength={255} placeholder="Tên team" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
    <select name="departmentId" required className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value="">Chọn phòng ban</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
    <button className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white">Thêm team</button><div className="sm:col-span-3"><Feedback state={state} /></div>
  </form>;
}

function DepartmentRow({ department }: { department: HrDepartment }) {
  const [editState, editAction] = useFormState(updateDepartmentAction, {});
  const [deleteState, deleteAction] = useFormState(deleteDepartmentAction, {});
  return <details className="border-b border-slate-100 py-2 last:border-0"><summary className="cursor-pointer text-xs font-medium text-slate-700">{department.name}</summary>
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      <form action={editAction} className="flex gap-2"><input type="hidden" name="id" value={department.id} /><input name="name" defaultValue={department.name} className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-xs" /><button className="rounded bg-slate-800 px-2 py-1 text-xs text-white">Đổi tên</button><Feedback state={editState} /></form>
      <form action={deleteAction} onSubmit={(e) => { if (!window.confirm('Xóa phòng ban này?')) e.preventDefault(); }}><input type="hidden" name="id" value={department.id} /><button className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-700">Xóa nếu chưa được sử dụng</button><Feedback state={deleteState} /></form>
    </div>
  </details>;
}

function TeamRow({ team, departments }: { team: HrTeam; departments: HrDepartment[] }) {
  const [editState, editAction] = useFormState(updateTeamAction, {});
  const [deleteState, deleteAction] = useFormState(deleteTeamAction, {});
  return <details className="border-b border-slate-100 py-2 last:border-0"><summary className="cursor-pointer text-xs font-medium text-slate-700">{team.name} · {departments.find((d) => d.id === team.department_id)?.name || 'Chưa phân bổ'}</summary>
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      <form action={editAction} className="grid gap-2"><input type="hidden" name="id" value={team.id} /><input name="name" required defaultValue={team.name} className="rounded border border-slate-300 px-2 py-1 text-xs" /><select name="departmentId" defaultValue={team.department_id || ''} className="rounded border border-slate-300 bg-white px-2 py-1 text-xs">{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select><button className="rounded bg-slate-800 px-2 py-1 text-xs text-white">Lưu team</button><Feedback state={editState} /></form>
      <form action={deleteAction} onSubmit={(e) => { if (!window.confirm('Xóa team này?')) e.preventDefault(); }}><input type="hidden" name="id" value={team.id} /><button className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-700">Xóa nếu chưa có nhân sự</button><Feedback state={deleteState} /></form>
    </div>
  </details>;
}

function EntitlementForm({ year, employee }: { year: number; employee: HrLeaveEntitlement }) {
  const [state, action] = useFormState(setLeaveEntitlementAction, {});
  return <form action={action} className="grid items-center gap-2 border-b border-slate-100 py-2 last:border-0 sm:grid-cols-[1fr_180px_140px_auto]">
    <input type="hidden" name="userId" value={employee.user_id} /><input type="hidden" name="year" value={year} />
    <span className="text-xs font-medium text-slate-800">{employee.full_name}<span className="ml-2 text-slate-400">{employee.department_name || 'Chưa phân bổ'} · {employee.employee_code || 'Chưa có mã'}</span></span>
    <label className="text-[11px] text-slate-500">Hạn mức (ngày)<input type="number" name="days" min="0" max="366" step="0.5" required defaultValue={employee.entitled_days} className="ml-2 w-24 rounded border border-slate-300 px-2 py-1 text-sm text-slate-900" /></label>
    <button className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-bold text-emerald-800">Lưu</button>
    <Feedback state={state} />
  </form>;
}

function DeleteEmployeeForm({ employee }: { employee: HrUserRow }) {
  const [state, action] = useFormState(deleteEmployeeAction, {});
  return <form action={action} className="mt-4 border-t border-rose-100 pt-3" onSubmit={(event) => { if (!window.confirm(`Xóa vĩnh viễn hồ sơ ${employee.full_name}? Nếu đã có đơn liên quan, hệ thống sẽ giữ hồ sơ và yêu cầu khóa tài khoản.`)) event.preventDefault(); }}>
    <input type="hidden" name="id" value={employee.id} /><button className="rounded-lg border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700">Xóa vĩnh viễn nếu chưa phát sinh dữ liệu</button><Feedback state={state} />
  </form>;
}

function EmployeeFilters({
  departments, teams, filters,
}: {
  departments: HrDepartment[]; teams: HrTeam[]; filters: { q: string; department: string; team: string; status: string };
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const teamSelectRef = useRef<HTMLSelectElement>(null);
  const [search, setSearch] = useState(filters.q);
  const lastSubmittedSearch = useRef(filters.q);
  const activeCount = [filters.q, filters.department, filters.team, filters.status].filter(Boolean).length;

  useEffect(() => {
    if (search === lastSubmittedSearch.current) return;
    const timeout = window.setTimeout(() => formRef.current?.requestSubmit(), 400);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const submitSearch = () => { lastSubmittedSearch.current = search; };

  const selectClass = 'w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100';
  const labelClass = 'mb-1.5 block text-xs font-bold text-slate-700';
  return <div className="mt-4 rounded-2xl bg-slate-100/80 p-4 sm:p-5">
    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
      <div><h3 className="text-sm font-bold text-slate-900">Bộ lọc danh sách</h3><p className="mt-1 text-xs text-slate-500">Chọn điều kiện, danh sách sẽ tự động cập nhật.</p></div>
      <span className={`pt-1 text-xs font-semibold ${activeCount ? 'text-emerald-800' : 'text-slate-500'}`} aria-live="polite">{activeCount ? `Đang áp dụng ${activeCount} bộ lọc` : 'Chưa áp dụng bộ lọc'}</span>
    </div>
    <form ref={formRef} method="get" onSubmit={submitSearch} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
      <input type="hidden" name="section" value="employees" />
      <label className={labelClass}>Tìm nhân viên<input name="q" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tên, email hoặc mã NV" className={`${selectClass} mt-1 font-normal`} /></label>
      <label className={labelClass}>Phòng ban<select name="department" defaultValue={filters.department} onChange={(event) => { if (teamSelectRef.current) teamSelectRef.current.value = ''; event.currentTarget.form?.requestSubmit(); }} className={`${selectClass} mt-1 font-normal`}><option value="">Tất cả phòng ban</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
      <label className={labelClass}>Team<select ref={teamSelectRef} name="team" defaultValue={filters.team} onChange={(event) => event.currentTarget.form?.requestSubmit()} className={`${selectClass} mt-1 font-normal`}><option value="">Tất cả team</option>{teams.filter((t) => !filters.department || t.department_id === filters.department).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      <label className={labelClass}>Trạng thái tài khoản<select name="status" defaultValue={filters.status} onChange={(event) => event.currentTarget.form?.requestSubmit()} className={`${selectClass} mt-1 font-normal`}><option value="">Mọi trạng thái</option><option value="active">Đang hoạt động</option><option value="inactive">Đã khóa</option></select></label>
      <div className="flex items-end"><a href="/admin/hr?section=employees" className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-center text-sm font-semibold text-slate-700 hover:bg-slate-100">Xóa bộ lọc</a></div>
    </form>
  </div>;
}

export default function HrAdminPanel({
  users, managers, departments, teams, entitlements, year, total, hasNext, page, filters, section,
}: {
  users: HrUserRow[]; managers: Pick<HrUserRow, 'id' | 'full_name' | 'role'>[]; departments: HrDepartment[]; teams: HrTeam[]; entitlements: HrLeaveEntitlement[]; year: number;
  total: number; hasNext: boolean; page: number; filters: { q: string; department: string; team: string; status: string };
  section: string;
}) {
  const linkParams = new URLSearchParams({ q: filters.q, department: filters.department, team: filters.team, status: filters.status });
  const sectionLink = (value: string) => `/admin/hr?section=${value}`;
  const navClass = (value: string) => `rounded-lg px-3 py-2 text-sm font-semibold ${section === value ? 'bg-[#005a3c] text-white' : 'border border-slate-200 bg-white text-slate-700'}`;
  return <div className="space-y-6">
    <nav className="flex flex-wrap gap-2" aria-label="Các phần quản trị"><a className={navClass('employees')} href={sectionLink('employees')}>Nhân viên</a><a className={navClass('organization')} href={sectionLink('organization')}>Phòng ban & team</a><a className={navClass('leave')} href={sectionLink('leave')}>Hạn mức nghỉ phép</a></nav>
    {section === 'employees' && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
      <details><summary className="cursor-pointer text-base font-bold text-slate-900">+ Thêm nhân viên và tạo tài khoản</summary><p className="mb-4 mt-2 text-xs text-slate-500">Tạo hồ sơ và tài khoản đăng nhập cùng lúc. Mật khẩu khởi tạo cần tối thiểu 6 ký tự.</p>
        <EmployeeForm departments={departments} teams={teams} managers={managers} />
      </details>
    </section>}

    {section === 'employees' && <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
      <div className="border-b border-slate-200 p-5"><h2 className="text-base font-bold text-slate-900">Danh sách nhân viên <span className="text-sm font-medium text-slate-500">({total})</span></h2>
        <EmployeeFilters departments={departments} teams={teams} filters={filters} />
      </div>
      <div className="divide-y divide-slate-100">{users.map((employee) => <details key={employee.id} className="group px-5 py-3">
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2"><span><span className="font-semibold text-sm text-slate-900">{employee.full_name}</span><span className="ml-2 text-xs text-slate-500">{employee.employee_code || 'Chưa có mã'} · {employee.email}</span></span><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${employee.is_active ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{employee.is_active ? 'Đang hoạt động' : 'Đã khóa'}</span><span className="w-full text-xs text-slate-500 sm:w-auto">{employee.department_name || 'Chưa phân phòng ban'} · {employee.team_name || 'Chưa phân team'} · {employee.role}</span></summary>
        <div className="border-t border-slate-100 pt-4 mt-3"><EmployeeForm employee={employee} departments={departments} teams={teams} managers={managers} /></div>
        <DeleteEmployeeForm employee={employee} />
      </details>)}{!users.length && <p className="p-8 text-center text-sm text-slate-500">Không tìm thấy nhân viên phù hợp.</p>}</div>
      <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 text-sm"><span className="text-slate-500">Trang {page} · Hiển thị {users.length} / {total}</span><div className="flex gap-2">{page > 1 && <a className="rounded-lg border px-3 py-1.5" href={`/admin/hr?${new URLSearchParams({ ...Object.fromEntries(linkParams), section: 'employees', page: String(page - 1) })}`}>Trước</a>}{hasNext && <a className="rounded-lg border px-3 py-1.5" href={`/admin/hr?${new URLSearchParams({ ...Object.fromEntries(linkParams), section: 'employees', page: String(page + 1) })}`}>Tiếp</a>}</div></div>
    </section>}

    {section === 'organization' && <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4"><h2 className="text-base font-bold text-slate-900">Phòng ban</h2><DepartmentForm />{departments.map((d) => <DepartmentRow key={d.id} department={d} />)}</section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4"><h2 className="text-base font-bold text-slate-900">Team</h2><TeamForm departments={departments} />{teams.map((t) => <TeamRow key={t.id} team={t} departments={departments} />)}</section>
    </div>}

    {section === 'leave' && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
      <div><h2 className="text-base font-bold text-slate-900">Hạn mức nghỉ phép năm {year}</h2><p className="mt-1 text-xs text-slate-500">Hạn mức được áp dụng khi nhân viên tạo hoặc sửa đơn. Chưa thiết lập hạn mức thì giữ luồng cũ; đặt 0 ngày sẽ không cấp phép nghỉ trong năm đó.</p></div>
      {entitlements.map((employee) => <EntitlementForm key={employee.user_id} employee={employee} year={year} />)}
    </section>}
  </div>;
}
