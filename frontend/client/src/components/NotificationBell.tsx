"use client";

import { useEffect, useRef, useState } from "react";
import { notificationsApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { AppNotification } from "@/lib/types";
import { NOTIFICATION_RECEIVED_EVENT } from "@/components/NotificationSocket";

function stripHtml(value?: string): string {
  if (!value || typeof document === "undefined") return "";
  const element = document.createElement("div");
  element.innerHTML = value;
  return (element.textContent || element.innerText || "").replace(/\s+/g, " ").trim();
}

function formatDate(value?: string): string {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function mergeNotification(list: AppNotification[], notification: AppNotification) {
  return [notification, ...list.filter((item) => item.id !== notification.id)].slice(0, 20);
}

export default function NotificationBell() {
  const { isLoggedIn, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isLoggedIn || !user?.id) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    let cancelled = false;
    setLoading(true);
    notificationsApi
      .getMine()
      .then((page) => {
        if (!cancelled) setNotifications(page.content || []);
      })
      .catch(() => {
        if (!cancelled) setNotifications([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, user?.id]);

  useEffect(() => {
    const handleNotification = (event: Event) => {
      const notification = (event as CustomEvent<AppNotification>).detail;
      if (!notification?.id) return;
      setNotifications((current) => mergeNotification(current, notification));
      setUnreadCount((current) => (open ? 0 : current + 1));
    };

    window.addEventListener(NOTIFICATION_RECEIVED_EVENT, handleNotification);
    return () => window.removeEventListener(NOTIFICATION_RECEIVED_EVENT, handleNotification);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setUnreadCount(0);

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  if (!isLoggedIn) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white shadow-inner transition-all hover:border-white/30 hover:bg-white/15"
        aria-label="Open notifications"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-indigo-400 px-1.5 text-[10px] font-black text-slate-950 ring-2 ring-slate-900">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-3 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-white/15 bg-slate-950/95 text-white shadow-2xl backdrop-blur-2xl">
          <div className="border-b border-white/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-white/50">Notifications</p>
                <h2 className="mt-1 text-lg font-black">Activity Inbox</h2>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/70">
                {notifications.length}
              </span>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto p-2">
            {loading ? (
              <div className="px-4 py-10 text-center text-sm font-medium text-white/60">Loading notifications...</div>
            ) : notifications.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white/60">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                  </svg>
                </div>
                <p className="text-sm font-bold text-white">No notifications yet</p>
                <p className="mt-1 text-sm text-white/55">New push notifications will appear here in real time.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {notifications.map((notification) => (
                  <div key={notification.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-bold leading-5">{notification.subject || "New notification"}</p>
                      <span className="shrink-0 text-[11px] font-semibold text-white/45">{formatDate(notification.createdAt)}</span>
                    </div>
                    {notification.body && (
                      <p className="mt-1 line-clamp-2 text-sm leading-5 text-white/65">{stripHtml(notification.body)}</p>
                    )}
                    <p className="mt-2 text-[10px] font-black uppercase tracking-[0.18em] text-indigo-200/75">
                      {notification.type.replace(/_/g, " ")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
