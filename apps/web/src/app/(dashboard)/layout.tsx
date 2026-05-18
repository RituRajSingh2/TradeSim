import { Header } from '@/components/layout/header';
import { BottomNav } from '@/components/layout/bottom-nav';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-bg-primary">
      <Header />
      <main className="mx-auto max-w-[var(--container-max)] px-[var(--spacing-page)] pb-20 pt-4 sm:pb-8">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
