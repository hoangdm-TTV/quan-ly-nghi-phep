import { LeaveStatus } from '@/lib/leave/workflow';

interface LeaveStatusBadgeProps {
  status: LeaveStatus;
}

export default function LeaveStatusBadge({ status }: LeaveStatusBadgeProps) {
  const configs: Record<LeaveStatus, { label: string; className: string }> = {
    PENDING: {
      label: 'Chờ duyệt',
      className: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    APPROVED_BY_LEAD: {
      label: 'Chờ Giám đốc duyệt',
      className: 'bg-blue-50 text-blue-700 border-blue-200',
    },
    WAITING_FOR_DOC: {
      label: 'Chờ nộp giấy đã ký',
      className: 'bg-teal-50 text-teal-700 border-teal-200',
    },
    COMPLETED: {
      label: 'Đã hoàn tất',
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    REJECTED: {
      label: 'Đã từ chối',
      className: 'bg-rose-50 text-rose-700 border-rose-200',
    },
  };

  const current = configs[status] || {
    label: status,
    className: 'bg-slate-50 text-slate-700 border-slate-200',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${current.className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-70"></span>
      {current.label}
    </span>
  );
}
