"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { integrationsApi } from "@/lib/api";
import { toast } from "react-hot-toast";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const processedRef = useRef(false);

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
        
        // Redirect back to settings after 2 seconds
        setTimeout(() => {
          router.push("/recruiter/settings");
        }, 2000);
      } catch (error: any) {
        setStatus("error");
        console.error(error);
        const errorMsg = error.response?.data?.message || "Failed to connect Google Calendar";
        toast.error(errorMsg);
      }
    };

    connectAccount();
  }, [searchParams, router]);

  
  return (
    <div className="relative z-10 bg-white/5 border border-white/10 p-10 rounded-[2.5rem] shadow-2xl backdrop-blur-3xl max-w-md w-full text-center ring-1 ring-white/20">
      
      {/* LOADING STATE */}
      {status === "loading" && (
        <div className="flex flex-col items-center animate-in fade-in zoom-in-95 duration-500">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full" />
            <svg className="w-16 h-16 text-blue-400 animate-spin relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Connecting to Google Calendar...</h2>
          <p className="text-white/40 mt-3 font-medium">Please wait while we secure your connection.</p>
        </div>
      )}

      {/* SUCCESS STATE */}
      {status === "success" && (
        <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-green-500/20 blur-xl rounded-full" />
            <svg className="w-16 h-16 text-green-400 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Connection Successful!</h2>
          <p className="text-white/40 mt-3 font-medium">Redirecting you back to settings...</p>
        </div>
      )}

      {/* ERROR STATE */}
      {status === "error" && (
        <div className="flex flex-col items-center animate-in fade-in zoom-in-95 duration-500">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-red-500/20 blur-xl rounded-full" />
            <svg className="w-16 h-16 text-red-400 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Connection Failed</h2>
          <p className="text-white/40 mt-3 mb-8 font-medium">We couldn't connect your calendar. Please try again.</p>
          <button
            onClick={() => router.push("/recruiter/settings")}
            className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold transition-all shadow-xl shadow-blue-600/30 active:scale-95"
          >
            Return to Settings
          </button>
        </div>
      )}
    </div>
  );
}

export default function GoogleCallbackPage() {
  return (
    <div 
      className="min-h-screen w-full bg-cover bg-center bg-fixed relative flex items-center justify-center p-6 transition-all duration-500"
      style={{ backgroundImage: `url(/bk2.jpg)` }}
    >
      {/* Background Overlays */}
      <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-[2px]" />
      <div className="fixed top-[-5%] right-[-5%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />

      <Suspense fallback={<div className="text-white/40 font-medium animate-pulse relative z-10">Loading...</div>}>
        <CallbackContent />
      </Suspense>
    </div>
  );
}