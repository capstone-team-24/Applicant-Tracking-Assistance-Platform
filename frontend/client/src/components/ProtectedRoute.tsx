"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken, getStoredUser } from "@/lib/auth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "CANDIDATE" | "RECRUITER";
}

export default function ProtectedRoute({
  children,
  requiredRole,
}: ProtectedRouteProps) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const token = getAccessToken();
    const user = getStoredUser();

    if (!token || !user) {
      router.push("/login");
      return;
    }

    if (requiredRole && user.role !== requiredRole) {
      router.push("/dashboard");
      return;
    }

    setIsAuthorized(true);
    setIsChecking(false);
  }, [router, requiredRole]);

  if (isChecking) {
    return (
      <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden">
        {/* Consistent Background Layer */}
        <div 
          className="fixed inset-0 z-0"
          style={{
            backgroundImage: `url('/signup-bg.jpg')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div className="fixed inset-0 z-0 bg-slate-950/60 backdrop-blur-sm" />

        {/* Loading Glass Card */}
        <div className="relative z-10 flex flex-col items-center gap-6 p-12 bg-white/5 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-2xl">
          <div className="relative">
            {/* Outer Glow Ring */}
            <div className="w-12 h-12 border-2 border-white/5 rounded-full" />
            {/* Spinning Indicator */}
            <div className="absolute inset-0 w-12 h-12 border-t-2 border-white rounded-full animate-spin shadow-[0_0_15px_rgba(255,255,255,0.5)]" />
          </div>
          
          <div className="space-y-1 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">
              System
            </p>
            <p className="text-sm font-bold text-white tracking-tight">
              Verifying Credentials...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return <>{children}</>;
}