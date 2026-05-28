'use client';

import { useState, useEffect } from 'react';
import { Bell, Check, Clock, X } from 'lucide-react';
import { NotificationDto } from '@tradesim/shared';

// Ideally this would be fetched from API, but for speed we'll simulate the fetch structure
export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && notifications.length === 0) {
      fetchNotifications();
    }
  }, [isOpen]);

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      // Assuming you have an API client helper, otherwise native fetch
      const res = await fetch('/api/notifications', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`, // Assuming token auth in localStorage
        }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    } finally {
      setIsLoading(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="relative z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-white/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-gray-400" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full" />
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40 sm:hidden"
            onClick={() => setIsOpen(false)}
          />
          <div
            className="fixed sm:absolute top-16 sm:top-12 right-0 left-0 sm:left-auto z-50 sm:w-80 
                     bg-[#141416] sm:border border-[#2A2A2E] sm:rounded-xl shadow-2xl overflow-hidden
                     flex flex-col max-h-[85vh] sm:max-h-[24rem] animate-fade-in-up sm:animate-fade-in"
          >
            <div className="flex items-center justify-between p-4 border-b border-[#2A2A2E]">
              <h3 className="font-semibold text-gray-100">Notifications</h3>
              <button onClick={() => setIsOpen(false)} className="sm:hidden p-1">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto hide-scrollbar p-2">
              {isLoading ? (
                <div className="p-4 text-center text-sm text-gray-500">Loading...</div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-500">
                  <Bell className="w-8 h-8 mx-auto mb-3 text-[#2A2A2E]" />
                  No recent notifications
                </div>
              ) : (
                <div className="space-y-1">
                  {notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`p-3 rounded-lg flex gap-3 ${
                        !notif.isRead ? 'bg-[#1C1C1F]' : ''
                      }`}
                    >
                      <div className="shrink-0 mt-0.5">
                        {notif.type === 'ALERT' ? (
                          <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                            <Bell className="w-4 h-4 text-emerald-500" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                            <Check className="w-4 h-4 text-blue-500" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-gray-100">{notif.message}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <Clock className="w-3 h-3 text-gray-500" />
                          <span className="text-xs text-gray-500">
                            {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
