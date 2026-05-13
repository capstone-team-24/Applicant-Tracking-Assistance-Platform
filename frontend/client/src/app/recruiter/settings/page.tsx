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
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4 border-b pb-2">Integrations</h2>
        
        <div className="flex items-center justify-between mt-4">
          <div>
            <h3 className="text-lg font-medium">Google Calendar</h3>
            <p className="text-sm text-gray-500">
              Connect your Google Calendar to automatically schedule interviews and generate Google Meet links.
            </p>
          </div>
          <button
            onClick={handleConnectCalendar}
            disabled={loading || isConnected}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md font-medium shadow-sm transition disabled:opacity-50 ${
              isConnected
                ? "bg-green-100 text-green-700 hover:bg-green-100 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
          >
            {loading ? (
              <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            ) : isConnected ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            )}
            <span>{isConnected ? "Connected" : "Connect Calendar"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
