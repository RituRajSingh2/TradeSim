'use client';

/**
 * useNotifications — Subscribe to server-pushed toast notifications.
 *
 * Listens for:
 *   - Order executed confirmations
 *   - System alerts
 *   - Admin notifications
 *
 * Usage:
 *   const { notifications, dismiss } = useNotifications();
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  WS_EVENTS,
  type WsNotificationPayload,
  type WsOrderExecutedPayload,
} from '@tradesim/shared';
import { useSocket } from './use-socket';

export interface ActiveNotification extends WsNotificationPayload {
  receivedAt: number;
}

export interface UseNotificationsReturn {
  notifications: ActiveNotification[];
  dismiss: (id: string) => void;
  clearAll: () => void;
}

const MAX_NOTIFICATIONS = 10;

export function useNotifications(): UseNotificationsReturn {
  const { socket } = useSocket();
  const [notifications, setNotifications] = useState<ActiveNotification[]>([]);
  const autoDismissTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const addNotification = useCallback((n: WsNotificationPayload) => {
    const active: ActiveNotification = { ...n, receivedAt: Date.now() };

    setNotifications((prev) => {
      // Cap at MAX_NOTIFICATIONS (drop oldest)
      const next = [active, ...prev].slice(0, MAX_NOTIFICATIONS);
      return next;
    });

    // Auto-dismiss
    if (n.dismissAfterMs && n.dismissAfterMs > 0) {
      const timer = setTimeout(() => {
        dismiss(n.id);
      }, n.dismissAfterMs);
      autoDismissTimers.current.set(n.id, timer);
    }
  }, []);

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    const timer = autoDismissTimers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      autoDismissTimers.current.delete(id);
    }
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    for (const timer of autoDismissTimers.current.values()) {
      clearTimeout(timer);
    }
    autoDismissTimers.current.clear();
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleNotification = (data: WsNotificationPayload) => {
      addNotification(data);
    };

    // Order executed → generate a success notification
    const handleOrderExecuted = (data: WsOrderExecutedPayload) => {
      addNotification({
        id: `order-${data.orderId}`,
        type: 'success',
        title: `${data.side} Order Executed`,
        message: `${data.quantity}x ${data.symbol} @ ₹${data.price.toFixed(2)}`,
        dismissAfterMs: 5000,
      });
    };

    socket.on(WS_EVENTS.NOTIFICATION, handleNotification);
    socket.on(WS_EVENTS.ORDER_EXECUTED, handleOrderExecuted);

    return () => {
      socket.off(WS_EVENTS.NOTIFICATION, handleNotification);
      socket.off(WS_EVENTS.ORDER_EXECUTED, handleOrderExecuted);
    };
  }, [socket, addNotification]);

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      for (const timer of autoDismissTimers.current.values()) {
        clearTimeout(timer);
      }
    };
  }, []);

  return { notifications, dismiss, clearAll };
}
