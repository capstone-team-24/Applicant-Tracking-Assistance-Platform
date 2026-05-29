"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { authApi } from "@/lib/api";
import NotificationBell from "@/components/NotificationBell";
import toast from "react-hot-toast";

export default function Navbar() {
  const { user, isLoggedIn, isCandidate, isRecruiter, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore logout API errors
    }
    logout();
    toast.success("Logged out successfully");
    router.push("/");
  };

  const isActive = (path: string) =>
    pathname === path || pathname.startsWith(path + "/");

  // Refined glassmorphic link classes for better text rendering
  const linkClass = (path: string) =>
    `px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 ${
      isActive(path)
        ? "bg-white/10 text-white shadow-[0_4px_12px_rgba(0,0,0,0.1)] border border-white/30"
        : "text-white hover:bg-white/15"
    }`;

  return (
    <div className="sticky top-0 z-50">
      {/* The Fix: Gradient Backing.
        This provides a dark base layer *just* under the navbar area, 
        ensuring the white glass and text remain readable even if the
        underlying background image is bright/white.
      */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 via-black/30 to-transparent pointer-events-none" />

      {/* Main Glassmorphic Nav */}
      <nav className="relative bg-white/10 backdrop-blur-xl border-b border-white/20 shadow-[0_8px_32px_0_rgba(31,38,135,0.2)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo and main nav */}
            <div className="flex items-center">
              <Link href="/" className="flex-shrink-0 group">
                <span className="text-white text-2xl font-black tracking-tighter group-hover:text-purple-300 transition-colors drop-shadow-md">
                  ATS
                </span>
              </Link>
              <div className="hidden md:block ml-10">
                <div className="flex items-center space-x-2">
                  <Link href="/" className={linkClass("/")}>
                    Home
                  </Link>
                  <Link href="/jobs" className={linkClass("/jobs")}>
                    Jobs
                  </Link>
                  {isLoggedIn && (
                    <Link href="/dashboard" className={linkClass("/dashboard")}>
                      Dashboard
                    </Link>
                  )}
                  {isCandidate && (
                    <Link href="/settings" className={linkClass("/settings")}>
                      Settings
                    </Link>
                  )}
                  {isRecruiter && (
                    <>
                      <Link
                        href="/recruiter/jobs/new"
                        className={linkClass("/recruiter/jobs/new")}
                      >
                        Post a Job
                      </Link>
                      <Link
                        href="/recruiter/settings"
                        className={linkClass("/recruiter/settings")}
                      >
                        Settings
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Right side */}
            <div className="hidden md:flex items-center space-x-4">
              {isLoggedIn ? (
                <>
                  <NotificationBell />
                  <div className="flex flex-col items-end mr-2">
                    <span className="text-white text-sm font-bold leading-none drop-shadow">
                      {user?.firstName} {user?.lastName}
                    </span>
                    <span className="text-[10px] uppercase tracking-widest text-white/70 font-black mt-1.5">
                      {user?.role}
                    </span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="px-5 py-2 rounded-xl text-sm font-bold text-white bg-white/5 border border-white/15 hover:bg-red-500/30 hover:border-red-500/50 transition-all shadow-inner"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="px-5 py-2 rounded-xl text-sm font-bold text-white/90 hover:text-white transition-colors"
                  >
                    Login
                  </Link>
                  <Link
                    href="/signup"
                    className="px-6 py-2.5 rounded-xl text-sm font-bold bg-white text-black hover:bg-opacity-90 transition-all shadow-lg shadow-white/10"
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="inline-flex items-center justify-center p-2.5 rounded-xl text-white hover:bg-white/15 transition-colors border border-white/15"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu - Glassmorphic dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-black/5 backdrop-blur-2xl border-t border-white/10 animate-in slide-in-from-top-4 duration-300">
            <div className="px-4 pt-4 pb-6 space-y-2">
              <Link href="/" className={`block ${linkClass("/")}`} onClick={() => setMobileMenuOpen(false)}>
                Home
              </Link>
              <Link href="/jobs" className={`block ${linkClass("/jobs")}`} onClick={() => setMobileMenuOpen(false)}>
                Jobs
              </Link>
              {isLoggedIn && (
                <Link href="/dashboard" className={`block ${linkClass("/dashboard")}`} onClick={() => setMobileMenuOpen(false)}>
                  Dashboard
                </Link>
              )}
              {isCandidate && (
                <Link href="/settings" className={`block ${linkClass("/settings")}`} onClick={() => setMobileMenuOpen(false)}>
                  Settings
                </Link>
              )}
              {isRecruiter && (
                <>
                  <Link href="/recruiter/jobs/new" className={`block ${linkClass("/recruiter/jobs/new")}`} onClick={() => setMobileMenuOpen(false)}>
                    Post a Job
                  </Link>
                  <Link href="/recruiter/settings" className={`block ${linkClass("/recruiter/settings")}`} onClick={() => setMobileMenuOpen(false)}>
                    Settings
                  </Link>
                </>
              )}
              
              <div className="pt-5 border-t border-white/10 mt-5">
                {isLoggedIn ? (
                  <div className="space-y-4">
                    <div className="px-4">
                      <NotificationBell />
                    </div>
                    <div className="px-4 text-white/60 text-xs font-black uppercase tracking-widest">
                      Logged in as {user?.firstName} ({user?.role})
                    </div>
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        handleLogout();
                      }}
                      className="block w-full text-center px-4 py-3 rounded-xl text-sm font-bold text-white bg-red-500/30 border border-red-500/40"
                    >
                      Logout
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <Link
                      href="/login"
                      className="text-center px-4 py-3 rounded-xl text-sm font-bold text-white bg-white/5 border border-white/15"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Login
                    </Link>
                    <Link
                      href="/signup"
                      className="text-center px-4 py-3 rounded-xl text-sm font-bold bg-white text-black"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Sign Up
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>
    </div>
  );
}
