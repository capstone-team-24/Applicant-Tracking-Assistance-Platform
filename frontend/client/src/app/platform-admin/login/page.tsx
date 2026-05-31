"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { storeAuthData } from "@/lib/auth";

export default function PlatformAdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await authApi.login(email, password);
      if (response.role !== "ADMIN") {
        setError("Unauthorized: You do not have platform admin privileges.");
      } else {
        storeAuthData(response.accessToken, response.refreshToken, {
          id: response.userId,
          email: response.email,
          firstName: response.firstName,
          lastName: response.lastName,
          role: response.role,
        });
        router.push("/platform-admin/dashboard");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen w-full bg-cover bg-center bg-fixed relative flex flex-col justify-center py-12 sm:px-6 lg:px-8 transition-all duration-500"
      style={{ backgroundImage: `url(/bk2.jpg)` }}
    >
      {/* Liquid Overlays */}
      <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-[2px]" />
      <div className="fixed top-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-4xl font-extrabold text-white tracking-tight drop-shadow-lg">
          Platform Administration
        </h2>
      </div>

      <div className="relative z-10 mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white/5 border border-white/10 py-10 px-6 shadow-2xl backdrop-blur-3xl sm:rounded-[2rem] sm:px-12 ring-1 ring-white/20">
          
          {error && (
            <div className="mb-6 bg-red-500/10 border border-red-500/30 p-4 rounded-xl animate-in fade-in slide-in-from-top-2">
              <p className="text-red-200 text-sm font-medium flex items-center justify-center">
                {error}
              </p>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label htmlFor="email" className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-2 ml-1">
                Admin Email
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="appearance-none block w-full px-4 py-3 border border-white/10 rounded-xl shadow-inner placeholder-gray-500 bg-white/5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all sm:text-sm"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-2 ml-1">
                Password
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="appearance-none block w-full px-4 py-3 border border-white/10 rounded-xl shadow-inner placeholder-gray-500 bg-white/5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all sm:text-sm"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-4 px-4 border border-transparent rounded-2xl shadow-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] "
              >
                {loading ? (
                  <span className="flex items-center space-x-2">
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Authenticating...</span>
                  </span>
                ) : "Sign In"}
              </button>
            </div>
          </form>
        </div>
        
        {/* Subtle decorative floor reflection effect */}
        <div className="mt-8 text-center">
          <p className="text-white/20 text-xs tracking-widest font-light uppercase">
            Platform Administrators Only
          </p>
        </div>
      </div>
    </div>
  );
}