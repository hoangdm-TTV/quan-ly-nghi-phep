import { History } from "lucide-react";
import { formatDateTimeVN } from "@/lib/date-time";

type ChangeHistoryEntry = {
  id: string;
  action:
    | "CREATED"
    | "UPDATED"
    | "CANCELLED"
    | "RETURN_DOCUMENT_UPLOADED"
    | "LEAVE_DOCUMENT_UPLOADED";
  actor_name: string | null;
  created_at: Date;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
};

type ApprovalHistoryEntry = {
  id: string;
  approver_name: string;
  approver_role: string;
  action: "APPROVED_LEAD" | "APPROVED_DIRECTOR" | "REJECTED";
  comment: string | null;
  created_at: Date;
};

type TimelineEvent =
  | {
      id: string;
      kind: "change";
      created_at: Date;
      entry: ChangeHistoryEntry;
    }
  | {
      id: string;
      kind: "approval";
      created_at: Date;
      entry: ApprovalHistoryEntry;
    };

type TimelineDetail = {
  label: string;
  value: string;
};

const fieldLabels: Record<string, string> = {
  start_date: "Từ ngày",
  end_date: "Đến ngày",
  duration_days: "Số ngày",
  day_part: "Buổi nghỉ",
  replacement_user_id: "Mã người thay thế",
  handover_note: "Ghi chú bàn giao",
  reason: "Lý do",
  request_date: "Ngày",
  start_time: "Từ giờ",
  end_time: "Đến giờ",
  estimated_hours: "Số giờ",
  reason_type: "Mục đích",
  status: "Trạng thái",
  return_document_file_name: "Tên giấy xác nhận",
  actual_return_at: "Giờ về được ghi nhận",
  document_file_name: "Tên giấy nghỉ phép",
  document_uploaded_at: "Thời điểm nộp giấy",
};

const roleLabels: Record<string, string> = {
  STAFF: "Nhân viên",
  TEAM_LEAD: "Trưởng nhóm",
  MANAGER: "Trưởng phòng",
  ACCOUNTANT: "Kế toán",
  ADMIN: "Quản trị hệ thống",
  DIRECTOR: "Giám đốc",
};

function displayValue(key: string, value: unknown) {
  if (value == null || value === "") return "—";
  if (key === "actual_return_at" || key === "document_uploaded_at")
    return formatDateTimeVN(String(value));
  if (key === "day_part") {
    return value === "FULL_DAY"
      ? "Cả ngày"
      : value === "MORNING"
        ? "Buổi sáng"
        : value === "AFTERNOON"
          ? "Buổi chiều"
          : String(value);
  }
  if (key === "reason_type")
    return value === "WORK"
      ? "Việc công"
      : value === "PERSONAL"
        ? "Việc riêng"
        : String(value);
  const statuses: Record<string, string> = {
    PENDING: "Chờ duyệt",
    APPROVED_BY_LEAD: "Chờ Giám đốc",
    WAITING_FOR_DOC: "Chờ nộp giấy",
    COMPLETED: "Hoàn tất",
    REJECTED: "Từ chối",
    CANCELLED: "Đã hủy",
    APPROVED: "Đã duyệt",
  };
  if (key === "status") return statuses[String(value)] || String(value);
  return String(value);
}

function getEventTitle(event: TimelineEvent) {
  if (event.kind === "approval") {
    return event.entry.action === "REJECTED"
      ? "Đã từ chối đơn"
      : event.entry.action === "APPROVED_DIRECTOR"
        ? "Giám đốc đã duyệt"
        : "Đã duyệt đơn";
  }

  return {
    CREATED: "Đã tạo đơn",
    UPDATED: "Đã chỉnh sửa đơn",
    CANCELLED: "Đã hủy đơn",
    RETURN_DOCUMENT_UPLOADED: "Đã nộp giấy xác nhận khi về",
    LEAVE_DOCUMENT_UPLOADED: "Đã nộp giấy nghỉ phép",
  }[event.entry.action];
}

function getEventActor(event: TimelineEvent) {
  if (event.kind === "approval") {
    const roleLabel =
      roleLabels[event.entry.approver_role] || event.entry.approver_role;
    return `${event.entry.approver_name} · ${roleLabel}`;
  }
  return event.entry.actor_name || "Người dùng";
}

function getEventDetails(event: TimelineEvent): TimelineDetail[] {
  if (event.kind === "approval") {
    return event.entry.comment
      ? [{ label: "Ý kiến", value: event.entry.comment }]
      : [];
  }

  const { action, after_data: afterData, before_data: beforeData } =
    event.entry;
  const before = beforeData || {};
  const after = afterData || {};
  const detail = (label: string, value: unknown): TimelineDetail | null =>
    value == null || value === ""
      ? null
      : { label, value: String(value) };

  if (action === "CREATED") {
    if ("request_date" in after) {
      return [
        detail("Ngày", displayValue("request_date", after.request_date)),
        detail(
          "Giờ",
          `${after.start_time || "—"} – ${after.end_time || "—"}`,
        ),
        detail(
          "Thời lượng",
          after.estimated_hours == null ? null : `${after.estimated_hours} giờ`,
        ),
        detail("Mục đích", displayValue("reason_type", after.reason_type)),
        detail("Lý do", after.reason),
      ].filter((item): item is TimelineDetail => item !== null);
    }

    const startDate = displayValue("start_date", after.start_date);
    const endDate = displayValue("end_date", after.end_date);
    return [
      detail(
        "Thời gian",
        startDate === endDate ? startDate : `${startDate} – ${endDate}`,
      ),
      detail(
        "Thời lượng",
        after.duration_days == null
          ? null
          : `${after.duration_days} ngày${
              after.day_part
                ? ` · ${displayValue("day_part", after.day_part)}`
                : ""
            }`,
      ),
      detail("Lý do", after.reason),
    ].filter((item): item is TimelineDetail => item !== null);
  }

  if (action === "CANCELLED") return [];
  if (action === "RETURN_DOCUMENT_UPLOADED") {
    return [
      detail("Giấy xác nhận", after.return_document_file_name),
    ].filter((item): item is TimelineDetail => item !== null);
  }
  if (action === "LEAVE_DOCUMENT_UPLOADED") {
    return [detail("Giấy nghỉ phép", after.document_file_name)].filter(
      (item): item is TimelineDetail => item !== null,
    );
  }

  return Object.keys(after)
    .filter(
      (key) =>
        fieldLabels[key] &&
        String(before[key] ?? "") !== String(after[key] ?? ""),
    )
    .map((key) => ({
      label: fieldLabels[key],
      value:
        before[key] == null || before[key] === ""
          ? displayValue(key, after[key])
          : `${displayValue(key, before[key])} → ${displayValue(
              key,
              after[key],
            )}`,
    }));
}

export default function RequestHistoryTimeline({
  changes,
  approvals,
}: {
  changes: ChangeHistoryEntry[];
  approvals: ApprovalHistoryEntry[];
}) {
  const events: TimelineEvent[] = [
    ...changes.map((entry) => ({
      id: entry.id,
      kind: "change" as const,
      created_at: entry.created_at,
      entry,
    })),
    ...approvals.map((entry) => ({
      id: entry.id,
      kind: "approval" as const,
      created_at: entry.created_at,
      entry,
    })),
  ].sort((a, b) => a.created_at.getTime() - b.created_at.getTime());

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="border-b border-slate-100 pb-3">
        <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
          <History className="h-5 w-5 text-blue-600" />
          Lịch sử đơn
        </h3>
      </div>

      {events.length === 0 ? (
        <p className="py-2 text-xs italic text-slate-500">
          Chưa ghi nhận hoạt động nào.
        </p>
      ) : (
        <ol className="relative space-y-2 before:absolute before:bottom-4 before:left-[7px] before:top-2 before:w-px before:bg-slate-200">
          {events.map((event) => {
            const isApproval = event.kind === "approval";
            const details = getEventDetails(event);

            return (
              <li key={`${event.kind}-${event.id}`} className="relative pl-7">
                <span
                  className={`absolute left-0 top-2 h-4 w-4 rounded-full border-2 ring-2 ring-white ${
                    isApproval
                      ? event.kind === "approval" &&
                        event.entry.action === "REJECTED"
                        ? "border-rose-500 bg-rose-50"
                        : "border-emerald-500 bg-emerald-50"
                      : "border-blue-500 bg-blue-50"
                  }`}
                />
                <article className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <strong className="text-sm text-slate-900">
                        {getEventTitle(event)}
                      </strong>
                      <span className="text-slate-500">
                        {getEventActor(event)}
                      </span>
                    </div>
                    <time className="shrink-0 text-[11px] text-slate-500">
                      {formatDateTimeVN(event.created_at)}
                    </time>
                  </div>
                  {details.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-slate-600">
                      {details.map((item) => (
                        <span
                          key={item.label}
                          className="inline-flex max-w-full items-baseline gap-1"
                          title={`${item.label}: ${item.value}`}
                        >
                          <span className="shrink-0 font-medium text-slate-500">
                            {item.label}:
                          </span>
                          <span className="max-w-[34rem] truncate">
                            {item.value}
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                </article>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
