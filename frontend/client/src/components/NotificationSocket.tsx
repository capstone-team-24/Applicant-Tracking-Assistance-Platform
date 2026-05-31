"use client";

import { useEffect } from "react";
import toast from "react-hot-toast";
import { getAccessToken, useAuth } from "@/lib/auth";
import { API_URL } from "@/lib/config";
import type { AppNotification } from "@/lib/types";

export const NOTIFICATION_RECEIVED_EVENT = "ats-push-notification";

function buildWebSocketUrl(token: string): string {
  const url = new URL("/api/v1/notifications/ws", API_URL);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("access_token", token);
  return url.toString();
}

function stripHtml(value?: string): string {
  if (!value || typeof document === "undefined") return "";
  const element = document.createElement("div");
  element.innerHTML = value;
  return (element.textContent || element.innerText || "").replace(/\s+/g, " ").trim();
}

function emitNotification(notification: AppNotification) {
  window.dispatchEvent(new CustomEvent<AppNotification>(NOTIFICATION_RECEIVED_EVENT, { detail: notification }));
}

function showNotificationToast(notification: AppNotification) {
  const title = notification.subject || "New notification";
  const message = stripHtml(notification.body);

  toast.custom(
    (t) => (
      <div
        className={`w-[min(92vw,24rem)] rounded-2xl border border-white/20 bg-slate-950/95 p-4 text-white shadow-2xl backdrop-blur-xl transition-all ${
          t.visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-300/30">
            <span className="text-sm font-black">ATS</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold leading-5">{title}</p>
            {message && <p className="mt-1 line-clamp-3 text-sm leading-5 text-white/75">{message}</p>}
            <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-200/80">
              {notification.type.replace(/_/g, " ")}
            </p>
          </div>
        </div>
      </div>
    ),
    { duration: 7000 },
  );
}

export default function NotificationSocket() {
  const { user, isLoggedIn } = useAuth();

  useEffect(() => {
    if (!isLoggedIn || !user?.id) return;

    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let reconnectAttempts = 0;
    let stopped = false;

    const connect = () => {
      const token = getAccessToken();
      if (!token || stopped) return;

      socket = new WebSocket(buildWebSocketUrl(token));

      socket.onopen = () => {
        reconnectAttempts = 0;
      };

      socket.onmessage = (event) => {
        try {
          const notification = JSON.parse(event.data) as AppNotification;
          emitNotification(notification);
          showNotificationToast(notification);
        } catch {
          toast("You have a new notification.");
        }
      };

      socket.onclose = () => {
        if (stopped) return;
        const delay = Math.min(30000, 1000 * 2 ** reconnectAttempts);
        reconnectAttempts += 1;
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [isLoggedIn, user?.id]);

  return null;
}
