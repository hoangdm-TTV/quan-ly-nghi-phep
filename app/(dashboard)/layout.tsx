import { requireAuth } from "@/lib/auth/permissions";
import DashboardShell from "@/components/dashboard/dashboard-shell";
import { canApproveWorkflowRequests } from "@/lib/auth/roles";
import { getPendingLeaveApprovalCount } from "@/lib/leave/queries";
import { getPendingOutOfficeApprovalCount } from "@/lib/out-office/queries";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();
  const [pendingLeaveCount, pendingOutOfficeCount] = canApproveWorkflowRequests(
    user.role,
  )
    ? await Promise.all([
        getPendingLeaveApprovalCount(user),
        getPendingOutOfficeApprovalCount(user),
      ])
    : [0, 0];

  return (
    <DashboardShell
      user={user}
      approvalCounts={{
        leave: pendingLeaveCount,
        outOffice: pendingOutOfficeCount,
      }}
    >
      {children}
    </DashboardShell>
  );
}
