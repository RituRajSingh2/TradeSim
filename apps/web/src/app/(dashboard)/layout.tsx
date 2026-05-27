import { DashboardShell } from '@/components/layout/DashboardShell';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { BottomNav } from '@/components/layout/bottom-nav';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardShell>
      <DashboardHeader />
      <div className="flex-1 overflow-y-auto pb-16 lg:pb-0">
        {children}
      </div>
      <BottomNav />
    </DashboardShell>
  );
}
