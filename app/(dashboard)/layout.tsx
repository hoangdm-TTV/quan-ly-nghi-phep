import { requireAuth } from "@/lib/auth/permissions";
import DashboardShell from "@/components/dashboard/dashboard-shell";
import {
  canApproveWorkflowRequests,
  canApproveOutOfficeRequests,
} from "@/lib/auth/roles";
import { getPendingLeaveApprovalCount } from "@/lib/leave/queries";
import { getPendingOutOfficeApprovalCount } from "@/lib/out-office/queries";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();
  const [pendingLeaveCount, pendingOutOfficeCount] = await Promise.all([
    canApproveWorkflowRequests(user.role)
      ? getPendingLeaveApprovalCount(user)
      : Promise.resolve(0),
    canApproveOutOfficeRequests(user.role)
      ? getPendingOutOfficeApprovalCount(user)
      : Promise.resolve(0),
  ]);

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
