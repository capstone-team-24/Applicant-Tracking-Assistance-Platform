"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import CandidateProfileEditor from "@/components/CandidateProfileEditor";
import FileUpload from "@/components/FileUpload";
import ProtectedRoute from "@/components/ProtectedRoute";
import { profilesApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Profile } from "@/lib/types";
import toast from "react-hot-toast";

function getSetupSteps(profile: Profile | null) {
  return [
    { label: "Name and contact details", done: Boolean(profile?.firstName && profile?.lastName && profile?.phone) },
    { label: "Professional summary", done: Boolean(profile?.headline && profile?.bio) },
    { label: "Experience snapshot", done: profile?.yearsOfExperience != null },
    { label: "Links and portfolio", done: Boolean(profile?.linkedinUrl || profile?.portfolioUrl || profile?.websiteUrl) },
    { label: "Upload your CV", done: Boolean(profile?.cvUrl) },
  ];
}

function AccountSetupContent() {
  const { user, updateUser } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingCv, setIsUploadingCv] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const data = await profilesApi.getMe();
        setProfile(data);
      } catch (error) {
        console.error(error);
        toast.error("Failed to load your profile");
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, []);

  const steps = useMemo(() => getSetupSteps(profile), [profile]);
  const progress = useMemo(() => {
    const complete = steps.filter((step) => step.done).length;
    return Math.round((complete / steps.length) * 100);
  }, [steps]);

  const handleSave = async (data: Partial<Profile>) => {
    setIsSaving(true);
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
      toast.success("Account setup progress saved");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to save account setup");
    } finally {
      setIsSaving(false);
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

  return (
    <div className="min-h-screen px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="grid gap-8 rounded-[2rem] border border-white/15 bg-white/10 p-8 shadow-2xl backdrop-blur-2xl lg:grid-cols-[1.2fr,0.8fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/45">
              Candidate Onboarding
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-white">
              Build an account that is ready to apply
            </h1>
            <p className="mt-4 max-w-2xl text-white/60">
              Add the details recruiters expect to see, upload your CV once, and use the same profile across applications.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 text-sm text-white/60">
              <span className="rounded-full border border-white/10 bg-black/20 px-4 py-2">Application autofill</span>
              <span className="rounded-full border border-white/10 bg-black/20 px-4 py-2">Profile summary</span>
              <span className="rounded-full border border-white/10 bg-black/20 px-4 py-2">CV reuse</span>
            </div>
          </div>
          <div className="rounded-[1.75rem] border border-white/10 bg-black/20 p-6">
            <div className="flex items-center justify-between text-white/60">
              <span>Setup progress</span>
              <span className="font-bold text-white">{progress}%</span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-white/10">
              <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-6 space-y-3">
              {steps.map((step) => (
                <div key={step.label} className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-sm">
                  <span className="text-white/70">{step.label}</span>
                  <span className={step.done ? "text-emerald-300" : "text-white/30"}>
                    {step.done ? "Done" : "Pending"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="grid gap-8 xl:grid-cols-[1.35fr,0.85fr]">
          <section className="rounded-[2rem] border border-white/15 bg-white/10 p-8 shadow-2xl backdrop-blur-2xl">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white">Your Candidate Profile</h2>
              <p className="mt-2 text-white/55">
                A strong headline, summary, and relevant links make your applications easier to review.
              </p>
            </div>
            {isLoading ? (
              <div className="space-y-4 animate-pulse">
                <div className="h-12 rounded-2xl bg-white/10" />
                <div className="h-12 rounded-2xl bg-white/10" />
                <div className="h-36 rounded-2xl bg-white/10" />
              </div>
            ) : (
              <CandidateProfileEditor
                profile={profile}
                isSaving={isSaving}
                onSave={handleSave}
                submitLabel="Save account setup"
              />
            )}
          </section>

          <div className="space-y-8">
            <section className="rounded-[2rem] border border-white/15 bg-white/10 p-8 shadow-2xl backdrop-blur-2xl">
              <h2 className="text-2xl font-bold text-white">Upload CV</h2>
              <p className="mt-2 text-white/55">
                This file can be reused in future applications and gives recruiters immediate context.
              </p>
              <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-black/20 p-5 text-sm text-white/60">
                {profile?.cvUrl ? "Your profile already has a CV. Upload a new one any time." : "No CV on file yet."}
              </div>
              <div className="mt-6">
                <FileUpload onFileSelect={handleCvUpload} label="Primary CV" hint={isUploadingCv ? "Uploading..." : "PDF, DOC, or DOCX up to 10MB"} />
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/15 bg-white/10 p-8 shadow-2xl backdrop-blur-2xl">
              <h2 className="text-2xl font-bold text-white">Next Step</h2>
              <p className="mt-2 text-white/55">
                Finish here, then visit settings whenever you want to connect Google Calendar or change your password.
              </p>
              <button
                onClick={() => router.push("/settings")}
                className="mt-6 w-full rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-900 transition hover:bg-slate-100"
              >
                Continue to Settings
              </button>
              <button
                onClick={() => router.push("/dashboard")}
                className="mt-3 w-full rounded-2xl border border-white/15 bg-white/5 px-5 py-4 text-sm font-bold text-white transition hover:bg-white/10"
              >
                Go to Dashboard
              </button>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AccountSetupPage() {
  return (
    <ProtectedRoute requiredRole="CANDIDATE">
      <AccountSetupContent />
    </ProtectedRoute>
  );
}
