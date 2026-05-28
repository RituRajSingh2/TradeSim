'use client';

/**
 * NotificationToastStack
 *
 * Renders real-time server-pushed notifications as subtle,
 * auto-dismissing toasts. Financial-grade UX — no confetti,
 * no aggressive colours, no gamification.
 *
 * Lives at the root layout level. Only one instance should be mounted.
 */

import { useEffect } from 'react';
import { toast, Toaster } from 'sonner';
import { useNotifications } from '@/lib/websocket/use-notifications';
import { Bell, CheckCircle, AlertTriangle, Info } from 'lucide-react';

function NotificationConsumer() {
  const { notifications, dismiss } = useNotifications();

  useEffect(() => {
    if (notifications.length === 0) return;
    const latest = notifications[0];

    const icon =
      latest.type === 'success' ? (
        <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
      ) : latest.type === 'error' ? (
        <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
      ) : latest.type === 'info' ? (
        <Bell className="w-4 h-4 text-sky-400 shrink-0" />
      ) : (
        <Info className="w-4 h-4 text-gray-400 shrink-0" />
      );

    toast.custom(
      (toastId) => (
        <div
          className="flex items-start gap-3 bg-[#18181B] border border-[#2A2A2E] rounded-xl px-4 py-3 shadow-xl min-w-[280px] max-w-[360px]"
          onClick={() => {
            toast.dismiss(toastId);
            dismiss(latest.id);
          }}
        >
          <div className="mt-0.5">{icon}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-100 leading-tight">
              {latest.title}
            </p>
            <p className="text-xs text-gray-400 mt-0.5 leading-snug">
              {latest.message}
            </p>
          </div>
        </div>
      ),
      {
        id: latest.id,
        duration: latest.dismissAfterMs ?? 6000,
        onDismiss: () => dismiss(latest.id),
        onAutoClose: () => dismiss(latest.id),
      }
    );
  // Only trigger when a new notification arrives (compare by id of first item)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications[0]?.id]);

  return null;
}

export function NotificationToastStack() {
  return (
    <>
      <Toaster
        position="top-right"
        gap={8}
        toastOptions={{
          unstyled: true,
          classNames: {
            toast: '',
          },
        }}
      />
      <NotificationConsumer />
    </>
  );
}
