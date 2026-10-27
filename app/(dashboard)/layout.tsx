import { requireAuth } from '@/lib/auth/permissions';
import DashboardShell from '@/components/dashboard/dashboard-shell';
import { canApproveWorkflowRequests } from '@/lib/auth/roles';
import { getPendingLeaveRequestsForApprover } from '@/lib/leave/queries';
import { getPendingOutOfficeRequestsForApprover } from '@/lib/out-office/queries';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();
  const [pendingLeaveRequests, pendingOutOfficeRequests] = canApproveWorkflowRequests(user.role)
    ? await Promise.all([
        getPendingLeaveRequestsForApprover(user),
        getPendingOutOfficeRequestsForApprover(user),
      ])
    : [[], []];

  return (
    <DashboardShell
      user={user}
      approvalCounts={{
        leave: pendingLeaveRequests.length,
        outOffice: pendingOutOfficeRequests.length,
      }}
    >
      {children}
    </DashboardShell>
  );
}
