import { DashboardShell } from '@/components/layout/DashboardShell';
import { DashboardHeader } from '@/components/layout/DashboardHeader';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardShell>
      <DashboardHeader />
      {/* We no longer have a bottom nav fixed globally, mobile navigation will be part of the grid/shell later */}
      {children}
    </DashboardShell>
  );
}
