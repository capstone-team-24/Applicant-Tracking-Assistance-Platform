"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { jobsApi, applicationsApi, profilesApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Job, Profile } from "@/lib/types";
import FileUpload from "@/components/FileUpload";
import toast from "react-hot-toast";

interface FormErrors {
  candidateName?: string;
  candidateEmail?: string;
  phone?: string;
  coverLetter?: string;
}

// ── Shared Background Wrapper ─────────────────────────────────────────────
function GlassPageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div 
      className="min-h-screen w-full bg-cover bg-center bg-fixed relative flex flex-col items-center py-12 px-4"
      style={{ backgroundImage: `url(/bk2.jpg)` }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[3px]" />
      <div className="relative z-10 w-full max-w-4xl">
        {children}
      </div>
    </div>
  );
}

export default function ApplyPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;
  const { user, isLoggedIn } = useAuth();

  const [job, setJob] = useState<Job | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoadingJob, setIsLoadingJob] = useState(true);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [useProfileData, setUseProfileData] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});

  const [formData, setFormData] = useState({
    candidateName: "",
    candidateEmail: "",
    phone: "",
    coverLetter: "",
    portfolioUrl: "",
    linkedinUrl: "",
  });

  useEffect(() => {
    const fetchJob = async () => {
      try {
        const data = await jobsApi.getJob(jobId);
        setJob(data);
      } catch {
        toast.error("Failed to load job details");
      } finally {
        setIsLoadingJob(false);
      }
    };
    if (jobId) fetchJob();
  }, [jobId]);

  useEffect(() => {
    if (isLoggedIn && user) {
      setFormData((prev) => ({
        ...prev,
        candidateName: `${user.firstName} ${user.lastName}`,
        candidateEmail: user.email,
      }));

      const fetchProfile = async () => {
        setIsLoadingProfile(true);
        try {
          const data = await profilesApi.getMe();
          setProfile(data);
        } catch {
          // No profile yet
          setProfile(null);
        } finally {
          setIsLoadingProfile(false);
        }
      };
      fetchProfile();
    } else {
      setProfile(null);
      setIsLoadingProfile(false);
    }
  }, [isLoggedIn, user]);

  useEffect(() => {
    if (useProfileData && profile) {
      const profileName = [profile.firstName, profile.lastName]
        .filter(Boolean)
        .join(" ")
        .trim();

      setFormData((prev) => ({
        ...prev,
        candidateName: profileName || prev.candidateName,
        candidateEmail: profile.email || prev.candidateEmail,
        phone: profile.phone || prev.phone,
        portfolioUrl: profile.portfolioUrl || prev.portfolioUrl,
        linkedinUrl: profile.linkedinUrl || prev.linkedinUrl,
      }));
    }
  }, [useProfileData, profile]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    if (!formData.candidateName.trim())
      newErrors.candidateName = "Full name is required";
    if (!formData.candidateEmail.trim()) {
      newErrors.candidateEmail = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.candidateEmail)) {
      newErrors.candidateEmail = "Please enter a valid email";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    if (!isLoggedIn) {
      toast.error("Please log in to apply for this job");
      router.push("/login");
      return;
    }

    setIsSubmitting(true);
    try {
      const submitData = new FormData();
      const requestPayload = {
        candidateAuthUserId: user?.id || null,
        coverLetter: formData.coverLetter || null,
        portfolioLinks: [formData.portfolioUrl, formData.linkedinUrl].filter(Boolean),
        contactPhone: formData.phone || null,
        useProfileData: useProfileData,
      };
      submitData.append(
        "request",
        new Blob([JSON.stringify(requestPayload)], { type: "application/json" })
      );
      if (resumeFile) submitData.append("file", resumeFile);

      await applicationsApi.apply(jobId, submitData);
      toast.success("Application submitted successfully!");
      router.push(`/jobs/${jobId}`);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(
        err.response?.data?.message || "Failed to submit application"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const profileName = profile
    ? [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim()
    : "";
  const accountName = user ? `${user.firstName} ${user.lastName}`.trim() : "";
  const autoFillFields = [
    { label: "Name", value: profileName || accountName },
    { label: "Email", value: profile?.email || user?.email },
    { label: "Phone", value: profile?.phone },
    { label: "Portfolio", value: profile?.portfolioUrl },
    { label: "LinkedIn", value: profile?.linkedinUrl },
  ];
  const readyAutoFillFields = autoFillFields.filter((field) => field.value);
  const missingAutoFillFields = autoFillFields.filter((field) => !field.value);

  if (isLoadingJob) {
    return (
      <GlassPageWrapper>
        <div className="animate-pulse space-y-8 mt-12">
          <div className="h-12 bg-white/10 rounded-3xl w-2/3" />
          <div className="space-y-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-white/5 rounded-[2rem] border border-white/10" />
            ))}
          </div>
        </div>
      </GlassPageWrapper>
    );
  }

  if (!job) {
    return (
      <GlassPageWrapper>
        <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[40px] p-12 text-center shadow-2xl mt-24">
          <h2 className="text-2xl font-black text-white mb-6 uppercase tracking-widest italic">Job Not Found</h2>
          <Link
            href="/jobs"
            className="inline-flex items-center px-10 py-4 bg-white text-slate-900 font-black uppercase tracking-widest text-[10px] rounded-2xl hover:scale-105 transition-all"
          >
            Back to Jobs
          </Link>
        </div>
      </GlassPageWrapper>
    );
  }

  return (
    <GlassPageWrapper>
      {/* Navigation Breadcrumb */}
      <nav className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.25em] text-white/40 mb-10 ml-4">
        <Link href="/jobs" className="hover:text-white transition-colors">Jobs</Link>
        <span className="text-white/20">/</span>
        <Link href={`/jobs/${job.id}`} className="hover:text-white transition-colors truncate max-w-[150px]">
          {job.title}
        </Link>
        <span className="text-white/20">/</span>
        <span className="text-white">Apply</span>
      </nav>

      <div className="bg-white/10 backdrop-blur-3xl border border-white/20 rounded-[3rem] p-8 lg:p-14 shadow-2xl relative overflow-hidden">
        {/* Decorative Radial Gradient */}
        <div className="absolute top-0 right-0 -mr-32 -mt-32 w-96 h-96 bg-white/5 rounded-full blur-[120px] pointer-events-none" />

        <header className="mb-12 relative z-10">
          <h1 className="text-4xl lg:text-5xl font-black text-white tracking-tighter mb-4 italic">
            Apply for {job.title}
          </h1>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-white/10 border border-white/10 rounded-lg text-[9px] font-black text-white/60 uppercase tracking-widest">
              {job.location || "Remote"}
            </span>
            <span className="px-3 py-1 bg-white/10 border border-white/10 rounded-lg text-[9px] font-black text-white/60 uppercase tracking-widest">
              {job.employmentType?.replace("_", " ")}
            </span>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="space-y-10 relative z-10">
          {/* Profile auto-fill */}
          {isLoggedIn && (
            isLoadingProfile ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="h-4 w-48 animate-pulse rounded bg-white/10" />
                <div className="mt-3 h-3 w-full max-w-md animate-pulse rounded bg-white/10" />
              </div>
            ) : profile ? (
              <button
                type="button"
                aria-pressed={useProfileData}
                onClick={() => setUseProfileData((current) => !current)}
                className={`w-full rounded-2xl p-6 text-left transition-all ${useProfileData
                  ? "bg-emerald-500/10 border border-emerald-400/50 shadow-lg shadow-emerald-950/20"
                  : "bg-white/5 border border-white/10 hover:bg-white/[0.08]"
                  }`}
              >
                <span className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <span className="flex items-start gap-4">
                    <span className={`mt-0.5 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${useProfileData ? "bg-emerald-300 border-emerald-300" : "border-white/20"}`}>
                      {useProfileData && (
                        <svg className="w-4 h-4 text-emerald-950" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <span>
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-black uppercase tracking-[0.15em] text-white">
                          Profile auto-fill
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${useProfileData ? "bg-emerald-300 text-emerald-950" : "bg-white/10 text-white/50"}`}>
                          {useProfileData ? "On - copied" : "Off"}
                        </span>
                      </span>
                      <span className="mt-2 block text-sm text-white/60 leading-relaxed">
                        {useProfileData
                          ? "Saved profile fields have been copied into this application. Review or edit them before submitting."
                          : "Turn this on to copy saved profile fields into the application form."}
                      </span>
                    </span>
                  </span>
                  <span className="text-xs font-semibold text-white/50">
                    {readyAutoFillFields.length} of {autoFillFields.length} fields ready
                  </span>
                </span>

                <span className="mt-4 flex flex-wrap gap-2">
                  {autoFillFields.map((field) => (
                    <span
                      key={field.label}
                      className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${field.value
                        ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200"
                        : "border-amber-300/30 bg-amber-400/10 text-amber-200"
                        }`}
                    >
                      {field.label}: {field.value ? "ready" : "missing"}
                    </span>
                  ))}
                </span>

                {missingAutoFillFields.length > 0 && (
                  <span className="mt-3 block text-xs text-amber-100/80">
                    Missing in your profile: {missingAutoFillFields.map((field) => field.label).join(", ")}. Empty fields can still be filled manually.
                  </span>
                )}
              </button>
            ) : (
              <div className="rounded-2xl border border-amber-300/30 bg-amber-400/10 p-6">
                <p className="text-[11px] font-black uppercase tracking-[0.15em] text-amber-100">
                  No saved profile found
                </p>
                <p className="mt-2 text-sm text-white/60">
                  Complete your profile to enable application auto-fill. You can still submit this application manually.
                </p>
                <Link href="/account/setup" className="mt-4 inline-flex text-xs font-bold uppercase tracking-widest text-amber-100 underline">
                  Complete Profile
                </Link>
              </div>
            )
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Name */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">Full Name</label>
              <input
                name="candidateName"
                type="text"
                value={formData.candidateName}
                onChange={handleChange}
                className={`w-full px-6 py-4 bg-white/5 border rounded-2xl text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all ${
                  errors.candidateName ? "border-red-500/50 bg-red-500/5" : "border-white/10"
                }`}
                placeholder="Jonathan Leoul"
              />
              {errors.candidateName && <p className="text-[9px] font-bold text-red-400 mt-1 uppercase tracking-tighter">{errors.candidateName}</p>}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">Email Address</label>
              <input
                name="candidateEmail"
                type="email"
                value={formData.candidateEmail}
                onChange={handleChange}
                className={`w-full px-6 py-4 bg-white/5 border rounded-2xl text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all ${
                  errors.candidateEmail ? "border-red-500/50 bg-red-500/5" : "border-white/10"
                }`}
                placeholder="contact@phantom.works"
              />
              {errors.candidateEmail && <p className="text-[9px] font-bold text-red-400 mt-1 uppercase tracking-tighter">{errors.candidateEmail}</p>}
            </div>
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">Phone Number</label>
            <input
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handleChange}
              className={`w-full px-6 py-4 bg-white/5 border rounded-2xl text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all ${useProfileData && profile?.phone ? "border-emerald-400/50" : "border-white/10"}`}
              placeholder="+1 (000) 000-0000"
            />
            {useProfileData && profile?.phone && (
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">Auto-filled from profile. You can edit it.</p>
            )}
          </div>

          {/* Cover Letter */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">Cover Letter</label>
            <textarea
              name="coverLetter"
              rows={5}
              value={formData.coverLetter}
              onChange={handleChange}
              className="w-full px-6 py-5 bg-white/5 border border-white/10 rounded-[2rem] text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all resize-none text-sm leading-relaxed"
              placeholder="Briefly describe why you are the right choice..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">Portfolio URL</label>
              <input
                name="portfolioUrl"
                type="url"
                value={formData.portfolioUrl}
                onChange={handleChange}
                className={`w-full px-6 py-4 bg-white/5 border rounded-2xl text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all ${useProfileData && profile?.portfolioUrl ? "border-emerald-400/50" : "border-white/10"}`}
                placeholder="https://portfolio.works"
              />
              {useProfileData && profile?.portfolioUrl && (
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">Auto-filled from profile.</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">LinkedIn Profile</label>
              <input
                name="linkedinUrl"
                type="url"
                value={formData.linkedinUrl}
                onChange={handleChange}
                className={`w-full px-6 py-4 bg-white/5 border rounded-2xl text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all ${useProfileData && profile?.linkedinUrl ? "border-emerald-400/50" : "border-white/10"}`}
                placeholder="https://linkedin.com/in/user"
              />
              {useProfileData && profile?.linkedinUrl && (
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">Auto-filled from profile.</p>
              )}
            </div>
          </div>

          {/* File Upload Section */}
          <div className="p-1 bg-white/5 rounded-[2.5rem] border border-white/10">
            <FileUpload
              onFileSelect={(file) => setResumeFile(file)}
              label="Resume / CV"
              hint="PDF, DOC, or DOCX up to 10MB"
              accept=".pdf,.doc,.docx"
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-8 pt-10 border-t border-white/10">
            <Link
              href={`/jobs/${job.id}`}
              className="text-[10px] font-black uppercase tracking-widest text-white/30 hover:text-white transition-colors"
            >
              Cancel Application
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-14 py-5 bg-white text-slate-900 font-black uppercase tracking-[0.2em] text-[11px] rounded-2xl hover:bg-slate-100 active:scale-[0.98] transition-all shadow-2xl shadow-white/10 disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
                  Processing
                </div>
              ) : "Submit Application"}
            </button>
          </div>
        </form>
      </div>
    </GlassPageWrapper>
  );
}
