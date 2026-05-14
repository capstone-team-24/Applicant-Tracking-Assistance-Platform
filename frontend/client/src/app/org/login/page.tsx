"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authApi } from "@/lib/api";
import { storeAuthData } from "@/lib/auth";
import toast from "react-hot-toast";

export default function OrgLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await authApi.login(email, password);

      if (response.role !== "ORG_ADMIN" && response.role !== "RECRUITER") {
        setError("Access denied. Please use the Candidate Portal.");
        setLoading(false);
        return;
      }

      const user = {
        id: response.userId,
        email: response.email,
        firstName: response.firstName,
        lastName: response.lastName,
        role: response.role as "CANDIDATE" | "RECRUITER",
        orgId: response.orgId,
      };
      storeAuthData(response.accessToken, response.refreshToken, user);

      toast.success("Welcome to the Admin Portal");
      if (response.role === "ORG_ADMIN") {
        router.push("/org/dashboard");
      } else {
        router.push("/recruiter");
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || "Login failed. Your account may be suspended.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-cover bg-center bg-fixed"
      style={{ backgroundImage: `url(/admin.jpg)` }}
    >
      <div className="w-full max-w-md">
        {/* Glass Card Container */}
        <div className="bg-slate-900/40 backdrop-blur-2xl rounded-3xl p-8 border border-white/10 shadow-2xl">

          {/* Header Section */}
          <div className="text-center mb-8">
            <div className="mb-4">
              <span className="inline-block bg-white/10 text-white text-[10px] font-bold px-3 py-1 rounded-full tracking-widest uppercase border border-white/20">
                Organization Portal
              </span>
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Staff Login</h1>
            <p className="mt-2 text-sm text-white/60">
              Manage your organization and talent
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 bg-red-500/20 border border-red-500/50 rounded-xl p-4 animate-pulse">
              <p className="text-red-200 text-xs text-center font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-xs font-bold text-white/70 uppercase tracking-wider mb-1.5 ml-1">
                Corporate Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 transition-all focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/10"
                placeholder="name@company.com"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-bold text-white/70 uppercase tracking-wider mb-1.5 ml-1"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 transition-all focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-3 flex items-center text-white/60 hover:text-white focus:outline-none"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    // Eye-off icon
                    <svg xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-5.523 0-10-4.477-10-10 
               0-1.086.174-2.13.5-3.1m3.1 3.1a7.978 7.978 0 00-.5 3c0 
               4.418 3.582 8 8 8 1.086 0 2.13-.174 3.1-.5m3.1-3.1a7.978 
               7.978 0 00.5-3c0-4.418-3.582-8-8-8-1.086 0-2.13.174-3.1.5m3.1 
               3.1L3 3m0 0l18 18" />
                    </svg>
                  ) : (
                    // Eye icon
                    <svg xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 
               8.268 2.943 9.542 7-1.274 4.057-5.065 
               7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>


            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-white text-slate-900 font-bold rounded-xl hover:bg-slate-200 transition-all shadow-xl shadow-black/20 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-slate-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Authenticating...
                </span>
              ) : (
                "Staff Log In"
              )}
            </button>
          </form>

          {/* Footer Link */}
          <div className="mt-8 text-center border-t border-white/5 pt-6">
            <Link
              href="/login"
              className="text-xs font-medium text-white/40 hover:text-white transition-colors underline underline-offset-4"
            >
              Switch to Candidate Portal
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}