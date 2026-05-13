"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { inviteApi } from "@/lib/api";
import type { InviteTokenResponse } from "@/lib/types";
import { formatDateTime } from "@/lib/dateUtils";

type Step = "loading" | "form" | "success" | "error";

// ── Inner component that uses useSearchParams() ────────────────────────────
function InviteSetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [step, setStep] = useState<Step>("loading");
  const [invite, setInvite] = useState<InviteTokenResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState("");

  /* ── Load invite metadata on mount ── */
  useEffect(() => {
    if (!token) {
      setErrorMsg("No invite token found in the URL.");
      setStep("error");
      return;
    }

    inviteApi
      .validateInvite(token)
      .then((data) => {
        setInvite(data);
        // Pre-fill name if the admin provided it (recruiter case)
        if (data.firstName) setFirstName(data.firstName);
        if (data.lastName) setLastName(data.lastName);
        setStep("form");
      })
      .catch((err) => {
        const msg =
          err?.response?.data?.message ??
          err?.message ??
          "This invite link is invalid or has expired.";
        setErrorMsg(msg);
        setStep("error");
      });
  }, [token]);

  /* ── Submit handler ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldError("");

    if (password !== confirmPassword) {
      setFieldError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setFieldError("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    try {
      await inviteApi.acceptInvite({ token, firstName, lastName, password });
      setStep("success");
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setFieldError(
        e.response?.data?.message ?? "Something went wrong. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const loginPath =
    invite?.role === "ORG_ADMIN" ? "/org/login" : "/login";

  /* ── Render states ── */
  if (step === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-purple-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-4 border-purple-500/30 border-t-purple-500 animate-spin" />
          <p className="text-slate-400 text-sm">Validating your invite…</p>
        </div>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-purple-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-800/60 border border-slate-700/50 rounded-2xl p-8 text-center backdrop-blur-sm shadow-2xl">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Invite Unavailable</h1>
          <p className="text-slate-400 text-sm leading-relaxed">{errorMsg}</p>
          <p className="mt-4 text-xs text-slate-500">
            If you believe this is an error, please ask your administrator to send a new invite.
          </p>
        </div>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-purple-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-800/60 border border-slate-700/50 rounded-2xl p-8 text-center backdrop-blur-sm shadow-2xl">
          {/* Success ring animation */}
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full bg-purple-500/20 animate-ping" />
            <div className="relative w-20 h-20 bg-gradient-to-br from-purple-500 to-purple-700 rounded-full flex items-center justify-center shadow-lg shadow-purple-900/40">
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Account Created!</h1>
          <p className="text-slate-400 text-sm">
            Welcome, <span className="text-white font-medium">{firstName}</span>. Your account is ready.
          </p>
          <button
            onClick={() => router.push(loginPath)}
            className="mt-8 w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-purple-900/30 hover:shadow-purple-900/50"
          >
            Continue to Login
          </button>
        </div>
      </div>
    );
  }

  /* ── Main setup form ── */
  const roleLabel = invite?.role === "ORG_ADMIN" ? "Organization Admin" : "Recruiter";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-purple-950 flex items-center justify-center p-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-purple-900/20 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Header badge */}
        <div className="flex justify-center mb-6">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-full text-purple-300 text-xs font-medium">
            <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse" />
            {roleLabel} Invite
          </span>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-8 backdrop-blur-sm shadow-2xl">
          {/* Title */}
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-white mb-1">Set Up Your Account</h1>
            <p className="text-slate-400 text-sm">
              You&apos;ve been invited as a{" "}
              <span className="text-purple-300 font-medium">{roleLabel}</span>
            </p>
          </div>

          {/* Email display (read-only) */}
          <div className="mb-6 p-3 bg-slate-700/40 border border-slate-600/40 rounded-xl flex items-center gap-3">
            <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="text-sm text-slate-300">{invite?.email}</span>
            <span className="ml-auto text-xs text-slate-500 border border-slate-600 px-1.5 py-0.5 rounded">Locked</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  First Name
                </label>
                <input
                  id="invite-first-name"
                  type="text"
                  required
                  autoFocus
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Jane"
                  className="w-full bg-slate-700/60 border border-slate-600/60 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/60 focus:border-transparent transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Last Name
                </label>
                <input
                  id="invite-last-name"
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Smith"
                  className="w-full bg-slate-700/60 border border-slate-600/60 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/60 focus:border-transparent transition"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Create Password
              </label>
              <div className="relative">
                <input
                  id="invite-password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full bg-slate-700/60 border border-slate-600/60 rounded-xl px-4 py-2.5 pr-11 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/60 focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {/* Password strength bar */}
              {password.length > 0 && (
                <div className="mt-2 flex gap-1">
                  {[8, 12, 16].map((threshold) => (
                    <div
                      key={threshold}
                      className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                        password.length >= threshold
                          ? threshold === 8
                            ? "bg-red-500"
                            : threshold === 12
                            ? "bg-yellow-500"
                            : "bg-green-500"
                          : "bg-slate-700"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Confirm Password
              </label>
              <input
                id="invite-confirm-password"
                type={showPassword ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                className={`w-full bg-slate-700/60 border rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/60 focus:border-transparent transition ${
                  confirmPassword && confirmPassword !== password
                    ? "border-red-500/60"
                    : "border-slate-600/60"
                }`}
              />
              {confirmPassword && confirmPassword !== password && (
                <p className="mt-1 text-xs text-red-400">Passwords do not match</p>
              )}
            </div>

            {/* Field error */}
            {fieldError && (
              <div className="p-3 bg-red-900/30 border border-red-700/40 rounded-xl text-sm text-red-300">
                {fieldError}
              </div>
            )}

            {/* Submit */}
            <button
              id="invite-submit"
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-purple-900/30 hover:shadow-purple-900/50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Creating account…
                </>
              ) : (
                "Create Account"
              )}
            </button>
          </form>

          {/* Expiry hint */}
          {invite?.expiresAt && (
            <p className="mt-5 text-center text-xs text-slate-600">
              This invite expires on{" "}
              {formatDateTime(invite.expiresAt)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Suspense fallback shown during SSR/static generation ──────────────────
function InviteSetupFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-purple-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-4 border-purple-500/30 border-t-purple-500 animate-spin" />
        <p className="text-slate-400 text-sm">Loading…</p>
      </div>
    </div>
  );
}

// ── Default export: wraps content in Suspense (required by Next.js 14) ────
export default function InviteSetupPage() {
  return (
    <Suspense fallback={<InviteSetupFallback />}>
      <InviteSetupContent />
    </Suspense>
  );
}
