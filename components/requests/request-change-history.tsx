import { History } from 'lucide-react';

type HistoryEntry = {
  id: string;
  action: 'UPDATED' | 'CANCELLED';
  actor_name: string | null;
  created_at: Date;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
};

const fieldLabels: Record<string, string> = {
  start_date: 'Từ ngày', end_date: 'Đến ngày', duration_days: 'Số ngày', reason: 'Lý do',
  request_date: 'Ngày', start_time: 'Từ giờ', end_time: 'Đến giờ', estimated_hours: 'Số giờ',
  reason_type: 'Mục đích', status: 'Trạng thái',
};

function displayValue(key: string, value: unknown) {
  if (value == null || value === '') return '—';
  if (key === 'reason_type') return value === 'WORK' ? 'Việc công' : value === 'PERSONAL' ? 'Việc riêng' : String(value);
  const statuses: Record<string, string> = { PENDING: 'Chờ duyệt', APPROVED_BY_LEAD: 'Chờ Giám đốc', WAITING_FOR_DOC: 'Chờ nộp giấy', COMPLETED: 'Hoàn tất', REJECTED: 'Từ chối', CANCELLED: 'Đã hủy', APPROVED: 'Đã duyệt' };
  if (key === 'status') return statuses[String(value)] || String(value);
  return String(value);
}

export default function RequestChangeHistory({ entries }: { entries: HistoryEntry[] }) {
  if (!entries.length) return null;
  return <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
    <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900"><History className="h-4 w-4 text-slate-600" />Lịch sử chỉnh sửa</h3>
    <ol className="space-y-2">
      {entries.map((entry) => {
        const before = entry.before_data || {};
        const after = entry.after_data || {};
        const changedFields = Object.keys(after).filter((key) => fieldLabels[key] && String(before[key] ?? '') !== String(after[key] ?? ''));
        return <li key={entry.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
          <div className="flex flex-wrap justify-between gap-2"><span className="text-slate-700"><strong>{entry.action === 'UPDATED' ? 'Đã chỉnh sửa đơn' : 'Đã hủy đơn'}</strong> · {entry.actor_name || 'Người dùng'}</span><time className="text-slate-500">{new Date(entry.created_at).toLocaleString('vi-VN')}</time></div>
          {changedFields.length > 0 && <ul className="mt-2 space-y-1 border-t border-slate-200 pt-2 text-slate-600">{changedFields.map((key) => <li key={key}><span className="font-semibold">{fieldLabels[key]}:</span> {displayValue(key, before[key])} → {displayValue(key, after[key])}</li>)}</ul>}
        </li>;
      })}
    </ol>
  </section>;
}
