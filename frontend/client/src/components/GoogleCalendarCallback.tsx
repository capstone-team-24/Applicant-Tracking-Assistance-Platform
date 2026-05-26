"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { integrationsApi } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { toast } from "react-hot-toast";

function getReturnPath() {
  const user = getStoredUser();
  return user?.role === "RECRUITER" ? "/recruiter/settings" : "/settings";
}

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const processedRef = useRef(false);
  const returnPath = getReturnPath();

  useEffect(() => {
    const code = searchParams.get("code");

    if (!code) {
      setStatus("error");
      toast.error("Authorization code is missing");
      return;
    }

    if (processedRef.current) return;
    processedRef.current = true;

    const connectAccount = async () => {
      try {
        await integrationsApi.handleGoogleCallback(code);
        setStatus("success");
        toast.success("Successfully connected Google Calendar!");

        setTimeout(() => {
          router.push(returnPath);
        }, 1800);
      } catch (error: any) {
        setStatus("error");
        const errorMsg =
          error.response?.data?.message || "Failed to connect Google Calendar";
        toast.error(errorMsg);
      }
    };

    connectAccount();
  }, [returnPath, router, searchParams]);

  return (
    <div className="relative z-10 w-full max-w-md rounded-[2.5rem] border border-white/10 bg-white/5 p-10 text-center shadow-2xl backdrop-blur-3xl ring-1 ring-white/20">
      {status === "loading" && (
        <div className="flex flex-col items-center">
          <svg className="mb-6 h-16 w-16 animate-spin text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <h2 className="text-2xl font-bold text-white">Connecting Google Calendar...</h2>
          <p className="mt-3 text-white/45">Securing your calendar access now.</p>
        </div>
      )}

      {status === "success" && (
        <div className="flex flex-col items-center">
          <svg className="mb-6 h-16 w-16 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-2xl font-bold text-white">Calendar Connected</h2>
          <p className="mt-3 text-white/45">Redirecting you back to your settings.</p>
        </div>
      )}

      {status === "error" && (
        <div className="flex flex-col items-center">
          <svg className="mb-6 h-16 w-16 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-2xl font-bold text-white">Connection Failed</h2>
          <p className="mt-3 mb-8 text-white/45">We couldn't connect your calendar. Please try again.</p>
          <button
            onClick={() => router.push(returnPath)}
            className="w-full rounded-2xl bg-blue-600 px-6 py-4 font-bold text-white transition hover:bg-blue-500"
          >
            Return to Settings
          </button>
        </div>
      )}
    </div>
  );
}

export default function GoogleCalendarCallback() {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-cover bg-center bg-fixed p-6" style={{ backgroundImage: "url(/bk2.jpg)" }}>
      <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-[2px]" />
      <Suspense fallback={<div className="relative z-10 text-white/40">Loading...</div>}>
        <CallbackContent />
      </Suspense>
    </div>
  );
}
