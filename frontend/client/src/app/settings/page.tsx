"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import CandidateProfileEditor from "@/components/CandidateProfileEditor";
import FileUpload from "@/components/FileUpload";
import ProtectedRoute from "@/components/ProtectedRoute";
import { authApi, integrationsApi, profilesApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { ChangePasswordData, Profile } from "@/lib/types";
import toast from "react-hot-toast";

function completionItems(profile: Profile | null) {
  return [
    Boolean(profile?.firstName && profile?.lastName),
    Boolean(profile?.headline),
    Boolean(profile?.bio),
    Boolean(profile?.phone),
    Boolean(profile?.cvUrl),
    Boolean(profile?.linkedinUrl || profile?.portfolioUrl || profile?.websiteUrl),
  ];
}

function CandidateSettingsContent() {
  const { user, updateUser, logout } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingCv, setIsUploadingCv] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState<ChangePasswordData & { confirmPassword: string }>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const profileProgress = useMemo(() => {
    const items = completionItems(profile);
    const completed = items.filter(Boolean).length;
    return Math.round((completed / items.length) * 100);
  }, [profile]);

  useEffect(() => {
    const load = async () => {
      try {
        const [profileData, integrationData] = await Promise.all([
          profilesApi.getMe(),
          integrationsApi.getGoogleIntegrationStatus(),
        ]);
        setProfile(profileData);
        setIsConnected(integrationData.connected);
      } catch (error) {
        console.error(error);
        toast.error("Failed to load your settings");
      } finally {
        setIsLoadingProfile(false);
      }
    };

    load();
  }, []);

  const handleProfileSave = async (data: Partial<Profile>) => {
    setIsSavingProfile(true);
    try {
      const updated = await profilesApi.updateProfile(data);
      setProfile(updated);
      if (user) {
        updateUser({
          ...user,
          firstName: updated.firstName || user.firstName,
          lastName: updated.lastName || user.lastName,
        });
      }
      toast.success("Profile updated");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to update profile");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleCvUpload = async (file: File) => {
    if (!profile?.id) return;
    setIsUploadingCv(true);
    try {
      const updated = await profilesApi.uploadCv(profile.id, file);
      setProfile(updated);
      toast.success("CV uploaded successfully");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to upload CV");
    } finally {
      setIsUploadingCv(false);
    }
  };

  const handleConnectCalendar = async () => {
    setIsConnectingGoogle(true);
    try {
      const response = await integrationsApi.getGoogleAuthUrl();
      window.location.href = response.url;
    } catch (error) {
      console.error(error);
      toast.error("Failed to start Google Calendar connection");
      setIsConnectingGoogle(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    setIsChangingPassword(true);
    try {
      await authApi.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      toast.success("Password updated. Please sign in again.");
      await authApi.logout();
      logout();
      window.location.href = "/login";
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to change password");
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="min-h-screen px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="rounded-[2rem] border border-white/15 bg-white/10 p-8 shadow-2xl backdrop-blur-2xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/45">
                Candidate Settings
              </p>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-white">
                Manage your profile, security, and calendar sync
              </h1>
              <p className="mt-3 max-w-2xl text-white/60">
                Keep your candidate profile ready for applications and move interview calendar access into one place.
              </p>
            </div>
            <div className="min-w-[240px] rounded-[1.5rem] border border-white/10 bg-black/20 p-5">
              <div className="flex items-center justify-between text-sm text-white/60">
                <span>Profile completion</span>
                <span className="font-bold text-white">{profileProgress}%</span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-white/10">
                <div className="h-2 rounded-full bg-emerald-400 transition-all" style={{ width: `${profileProgress}%` }} />
              </div>
              <Link href="/account/setup" className="mt-4 inline-block text-sm font-semibold text-emerald-300 hover:text-emerald-200">
                Open guided account setup
              </Link>
            </div>
          </div>
        </section>

        <div className="grid gap-8 xl:grid-cols-[1.4fr,0.9fr]">
          <section className="rounded-[2rem] border border-white/15 bg-white/10 p-8 shadow-2xl backdrop-blur-2xl">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white">Edit Profile</h2>
              <p className="mt-2 text-white/55">
                This information is used to prefill applications and present a stronger candidate summary.
              </p>
            </div>
            {isLoadingProfile ? (
              <div className="space-y-4 animate-pulse">
                <div className="h-12 rounded-2xl bg-white/10" />
                <div className="h-12 rounded-2xl bg-white/10" />
                <div className="h-36 rounded-2xl bg-white/10" />
              </div>
            ) : (
              <CandidateProfileEditor
                profile={profile}
                isSaving={isSavingProfile}
                onSave={handleProfileSave}
              />
            )}
          </section>

          <div className="space-y-8">
            <section className="rounded-[2rem] border border-white/15 bg-white/10 p-8 shadow-2xl backdrop-blur-2xl">
              <h2 className="text-2xl font-bold text-white">Resume</h2>
              <p className="mt-2 text-white/55">
                Upload the CV you want to reuse across job applications.
              </p>
              <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-black/20 p-5 text-sm text-white/60">
                {profile?.cvUrl ? "A CV is already on file. Uploading again will replace it." : "No CV uploaded yet."}
              </div>
              <div className="mt-6">
                <FileUpload onFileSelect={handleCvUpload} label="Candidate CV" hint={isUploadingCv ? "Uploading..." : "PDF, DOC, or DOCX up to 10MB"} />
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/15 bg-white/10 p-8 shadow-2xl backdrop-blur-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-white">Google Calendar</h2>
                  <p className="mt-2 text-white/55">
                    Automatically add booked interviews to your calendar.
                  </p>
                </div>
                {isConnected && (
                  <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">
                    Connected
                  </span>
                )}
              </div>
              <button
                onClick={handleConnectCalendar}
                disabled={isConnectingGoogle || isConnected === true}
                className={`mt-6 w-full rounded-2xl px-5 py-4 text-sm font-bold transition ${
                  isConnected
                    ? "cursor-not-allowed border border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                    : "bg-blue-600 text-white hover:bg-blue-500"
                }`}
              >
                {isConnectingGoogle ? "Connecting..." : isConnected ? "Google Calendar Connected" : "Connect Google Calendar"}
              </button>
            </section>

            <section className="rounded-[2rem] border border-white/15 bg-white/10 p-8 shadow-2xl backdrop-blur-2xl">
              <h2 className="text-2xl font-bold text-white">Change Password</h2>
              <p className="mt-2 text-white/55">
                Updating your password signs out your existing sessions for safety.
              </p>
              <form onSubmit={handlePasswordChange} className="mt-6 space-y-4">
                {[
                  ["currentPassword", "Current Password"],
                  ["newPassword", "New Password"],
                  ["confirmPassword", "Confirm New Password"],
                ].map(([name, label]) => (
                  <div key={name} className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
                      {label}
                    </label>
                    <input
                      type="password"
                      value={passwordData[name as keyof typeof passwordData]}
                      onChange={(e) =>
                        setPasswordData((prev) => ({ ...prev, [name]: e.target.value }))
                      }
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                      required
                    />
                  </div>
                ))}
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="w-full rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 transition hover:bg-slate-100 disabled:opacity-50"
                >
                  {isChangingPassword ? "Updating password..." : "Update Password"}
                </button>
              </form>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CandidateSettingsPage() {
  return (
    <ProtectedRoute requiredRole="CANDIDATE">
      <CandidateSettingsContent />
    </ProtectedRoute>
  );
}
