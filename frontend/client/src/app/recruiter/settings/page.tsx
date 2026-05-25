"use client";

import { useState, useEffect } from "react";
import { integrationsApi } from "@/lib/api";
import { toast } from "react-hot-toast";

export default function SettingsPage() {
  const [loading, setLoading] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await integrationsApi.getGoogleIntegrationStatus();
        setIsConnected(res.connected);
      } catch (err) {
        console.error(err);
      }
    };
    fetchStatus();
  }, []);

  const handleConnectCalendar = async () => {
    setLoading(true);
    try {
      const response = await integrationsApi.getGoogleAuthUrl();
      window.location.href = response.url;
    } catch (error) {
      console.error(error);
      toast.error("Failed to fetch Google Auth URL");
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen w-full bg-cover bg-center bg-fixed relative flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8 transition-all duration-500"
      style={{ backgroundImage: `url(/bk2.jpg)`}}
    >
      {/* Liquid Overlays */}
      <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-[2px]" />
      <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-4xl">
        {/* Header */}
        <div className="mb-10 px-2">
          <h1 className="text-4xl font-bold text-white tracking-tight drop-shadow-md">
            Settings
          </h1>
          <p className="text-white/40 mt-2 font-medium">
            Manage your account preferences and third-party integrations.
          </p>
        </div>

        {/* Glass Card */}
        <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 sm:p-10 backdrop-blur-3xl shadow-2xl shadow-black/50 ring-1 ring-white/20">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-blue-500/20 rounded-lg border border-blue-500/30">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">Integrations</h2>
          </div>
          
          <div className="bg-white/5 rounded-3xl p-6 sm:p-8 border border-white/10 flex flex-col md:flex-row items-center justify-between gap-6 hover:bg-white/[0.07] transition-all group">
            <div className="flex-1">
              <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                Google Calendar
                {isConnected && (
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase tracking-widest">
                    Active
                  </span>
                )}
              </h3>
              <p className="text-sm text-white/40 leading-relaxed max-w-xl">
                Connect your Google Calendar to automatically schedule interviews and generate Google Meet links. This syncs availability in real-time.
              </p>
            </div>

            <button
              onClick={handleConnectCalendar}
              disabled={loading || isConnected}
              className={`group/btn relative flex items-center space-x-3 px-8 py-4 rounded-2xl font-bold transition-all duration-300 disabled:opacity-50 overflow-hidden ${
                isConnected
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 active:scale-95"
              }`}
            >
              {loading ? (
                <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              ) : isConnected ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5 transition-transform group-hover/btn:rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
              <span className="relative z-10">
                {isConnected ? "Connected" : "Connect Calendar"}
              </span>
            </button>
          </div>

          <div className="mt-8 pt-8 border-t border-white/5">
            <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest text-center">
              Secure OAuth2 Encryption Enabled
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
