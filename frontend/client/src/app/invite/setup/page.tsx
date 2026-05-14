"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { inviteApi } from "@/lib/api";
import type { InviteTokenResponse } from "@/lib/types";
import { formatDateTime } from "@/lib/dateUtils";

type Step = "loading" | "form" | "success" | "error";

// ── Shared Background Component ────────────────────────────────────────────
function GlassPageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen w-full bg-cover bg-center bg-fixed relative flex flex-col items-center justify-center py-12 px-4"
      style={{ backgroundImage: `url(/bk2.jpg)` }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[3px]" />
      <div className="relative z-10 w-full max-w-md">
        {children}
      </div>
    </div>
  );
}

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

  const loginPath = invite?.role === "ORG_ADMIN" ? "/org/login" : "/login";

  /* ── Render states ── */
  if (step === "loading") {
    return (
      <GlassPageWrapper>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-4 border-white/20 border-t-white animate-spin" />
          <p className="text-white/60 text-sm font-medium tracking-widest uppercase">Validating Invite</p>
        </div>
      </GlassPageWrapper>
    );
  }

  if (step === "error") {
    return (
      <GlassPageWrapper>
        <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[32px] p-8 text-center shadow-2xl">
          <div className="w-16 h-16 bg-red-500/20 border border-red-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Invite Unavailable</h1>
          <p className="text-white/60 text-sm leading-relaxed mb-6">{errorMsg}</p>
          <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">
            If you believe this is an error, please ask your administrator for a new link.
          </p>
        </div>
      </GlassPageWrapper>
    );
  }

  if (step === "success") {
    return (
      <GlassPageWrapper>
        <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[32px] p-8 text-center shadow-2xl">
          <div className="relative w-20 h-20 mx-auto mb-8">
            <div className="absolute inset-0 rounded-full bg-white/20 animate-ping" />
            <div className="relative w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-2xl">
              <svg className="w-10 h-10 text-slate-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Account Ready!</h1>
          <p className="text-white/60 text-lg mb-8">
            Welcome, <span className="text-white font-black italic">{firstName}</span>.
          </p>
          <button
            onClick={() => router.push(loginPath)}
            className="w-full py-4 bg-white text-slate-900 font-black uppercase tracking-widest text-xs rounded-2xl hover:scale-[1.02] transition-all shadow-xl shadow-white/10"
          >
            Continue to Login
          </button>
        </div>
      </GlassPageWrapper>
    );
  }

  /* ── Main setup form ── */
  const roleLabel = invite?.role === "ORG_ADMIN" ? "Organization Admin" : "Recruiter";

  return (
    <GlassPageWrapper>
      {/* Role badge */}
      <div className="flex justify-center mb-6">
        <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 border border-white/20 rounded-full text-white text-[10px] font-black uppercase tracking-[0.2em]">
          <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
          {roleLabel} Invite
        </span>
      </div>

      <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[40px] p-8 md:p-10 shadow-2xl relative overflow-hidden">
        {/* Title */}
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter mb-2 italic">Set Up Account</h1>
          <p className="text-white/50 text-sm font-medium">
            You&apos;ve been invited as a <span className="text-white">{roleLabel}</span>
          </p>
        </div>

        {/* Email display (read-only) */}
        <div className="mb-8 p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-3">
          <svg className="w-4 h-4 text-white/40 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span className="text-sm text-white/80 font-bold">{invite?.email}</span>
          <span className="ml-auto text-[9px] font-black uppercase tracking-widest text-white/30 border border-white/10 px-2 py-1 rounded-lg">Secure</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">First Name</label>
              <input
                id="invite-first-name"
                type="text"
                required
                autoFocus
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jane"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Last Name</label>
              <input
                id="invite-last-name"
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Smith"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Password</label>
            <div className="relative">
              <input
                id="invite-password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 pr-12 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            {/* Password strength bar — color-coded from your version */}
            {password.length > 0 && (
              <div className="flex gap-1.5 px-1 pt-1">
                {[8, 12, 16].map((threshold) => (
                  <div
                    key={threshold}
                    className={`h-1 flex-1 rounded-full transition-all duration-500 ${password.length >= threshold
                        ? threshold === 8
                          ? "bg-red-400"
                          : threshold === 12
                            ? "bg-yellow-400"
                            : "bg-green-400"
                        : "bg-white/10"
                      }`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Confirm password */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Confirm Password</label>
            <input
              id="invite-confirm-password"
              type={showPassword ? "text" : "password"}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              className={`w-full bg-white/5 border rounded-2xl px-5 py-3.5 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 transition-all ${confirmPassword && confirmPassword !== password
                  ? "border-red-500/50 focus:ring-red-500/20"
                  : "border-white/10 focus:ring-white/20"
                }`}
            />
            {confirmPassword && confirmPassword !== password && (
              <p className="text-[10px] text-red-400 font-bold uppercase tracking-wider ml-1">Passwords do not match</p>
            )}
          </div>

          {/* Field error */}
          {fieldError && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-xs text-red-400 font-bold uppercase tracking-wide">
              {fieldError}
            </div>
          )}

          {/* Submit */}
          <button
            id="invite-submit"
            type="submit"
            disabled={submitting}
            className="w-full py-4 bg-white text-slate-900 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-slate-100 disabled:opacity-50 transition-all flex items-center justify-center gap-3 shadow-xl"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-slate-900/30 border-t-slate-900 animate-spin" />
                Processing
              </>
            ) : (
              "Create Account"
            )}
          </button>
        </form>

        {/* Expiry hint — uses your formatDateTime util */}
        {invite?.expiresAt && (
          <p className="mt-8 text-center text-[10px] text-white/30 font-bold uppercase tracking-widest">
            Expires: {formatDateTime(invite.expiresAt)}
          </p>
        )}
      </div>
    </GlassPageWrapper>
  );
}

// ── Suspense fallback ──────────────────────────────────────────────────────
function InviteSetupFallback() {
  return (
    <GlassPageWrapper>
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-4 border-white/20 border-t-white animate-spin" />
        <p className="text-white/60 text-sm font-medium tracking-widest uppercase">Loading</p>
      </div>
    </GlassPageWrapper>
  );
}

// ── Default export ─────────────────────────────────────────────────────────
export default function InviteSetupPage() {
  return (
    <Suspense fallback={<InviteSetupFallback />}>
      <InviteSetupContent />
    </Suspense>
  );
}