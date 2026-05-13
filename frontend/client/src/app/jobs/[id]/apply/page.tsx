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

export default function ApplyPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;
  const { user, isLoggedIn } = useAuth();

  const [job, setJob] = useState<Job | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoadingJob, setIsLoadingJob] = useState(true);
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
        try {
          const data = await profilesApi.getMe();
          setProfile(data);
        } catch {
          // No profile yet
        }
      };
      fetchProfile();
    }
  }, [isLoggedIn, user]);

  useEffect(() => {
    if (useProfileData && profile) {
      setFormData((prev) => ({
        ...prev,
        phone: profile.phone || prev.phone,
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

  if (isLoadingJob) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="animate-pulse space-y-8">
          <div className="h-12 bg-white/5 rounded-2xl w-3/4" />
          <div className="space-y-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-white/5 rounded-2xl border border-white/5" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        <div className="bg-white/5 backdrop-blur-2xl rounded-3xl border border-white/10 p-12 shadow-2xl">
          <h2 className="text-2xl font-black text-white mb-6 uppercase tracking-widest">
            Job Not Found
          </h2>
          <Link
            href="/jobs"
            className="inline-flex items-center px-8 py-3 bg-white text-black font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-white/90 transition-all"
          >
            Back to Jobs
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-10 ml-2">
        <Link href="/jobs" className="hover:text-white transition-colors">Jobs</Link>
        <svg className="w-3 h-3 opacity-30" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
        <Link href={`/jobs/${job.id}`} className="hover:text-white transition-colors truncate max-w-[150px]">
          {job.title}
        </Link>
        <svg className="w-3 h-3 opacity-30" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
        <span className="text-white/20">Apply</span>
      </nav>

      <div className="relative overflow-hidden bg-white/5 backdrop-blur-3xl rounded-[2.5rem] border border-white/10 p-8 lg:p-12 shadow-2xl">
        {/* Abstract Background Element */}
        <div className="absolute top-0 right-0 -mr-24 -mt-24 w-80 h-80 bg-white/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10">
          <header className="mb-12">
            <h1 className="text-3xl lg:text-4xl font-black text-white tracking-tighter mb-3">
              Apply for {job.title}
            </h1>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/40 flex items-center gap-2">
              <span className="w-2 h-2 bg-white/20 rounded-full" />
              {job.location && `${job.location} • `}
              {job.employmentType?.replace("_", " ")}
            </p>
          </header>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Use profile data checkbox */}
            {isLoggedIn && profile && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-colors group">
                <label className="flex items-center gap-4 cursor-pointer">
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      checked={useProfileData}
                      onChange={(e) => setUseProfileData(e.target.checked)}
                      className="peer appearance-none w-5 h-5 border-2 border-white/20 rounded-md checked:bg-white checked:border-transparent transition-all cursor-pointer"
                    />
                    <svg className="absolute w-3 h-3 text-black hidden peer-checked:block left-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-[11px] font-black uppercase tracking-widest text-white/60 group-hover:text-white transition-colors">
                    Auto-fill using my profile data
                  </span>
                </label>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Name */}
              <div className="space-y-2">
                <label htmlFor="candidateName" className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">
                  Full Name <span className="text-white/20">*</span>
                </label>
                <input
                  id="candidateName"
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
                <label htmlFor="candidateEmail" className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">
                  Email Address <span className="text-white/20">*</span>
                </label>
                <input
                  id="candidateEmail"
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
              <label htmlFor="phone" className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">
                Phone Number
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
                placeholder="+1 (000) 000-0000"
              />
            </div>

            {/* Cover Letter */}
            <div className="space-y-2">
              <label htmlFor="coverLetter" className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">
                Cover Letter
              </label>
              <textarea
                id="coverLetter"
                name="coverLetter"
                rows={6}
                value={formData.coverLetter}
                onChange={handleChange}
                className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-[2rem] text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all resize-none font-medium text-sm leading-relaxed"
                placeholder="Briefly describe why you are the right choice for Infamous Designs..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Portfolio URL */}
              <div className="space-y-2">
                <label htmlFor="portfolioUrl" className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">
                  Portfolio URL
                </label>
                <input
                  id="portfolioUrl"
                  name="portfolioUrl"
                  type="url"
                  value={formData.portfolioUrl}
                  onChange={handleChange}
                  className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
                  placeholder="https://portfolio.works"
                />
              </div>

              {/* LinkedIn URL */}
              <div className="space-y-2">
                <label htmlFor="linkedinUrl" className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">
                  LinkedIn Profile
                </label>
                <input
                  id="linkedinUrl"
                  name="linkedinUrl"
                  type="url"
                  value={formData.linkedinUrl}
                  onChange={handleChange}
                  className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
                  placeholder="https://linkedin.com/in/user"
                />
              </div>
            </div>

            {/* File Upload - Wrapped in glassmorphic styling if needed */}
            <div className="p-1 bg-white/5 rounded-[2rem] border border-white/5">
               <FileUpload
                onFileSelect={(file) => setResumeFile(file)}
                label="Resume / CV"
                hint="PDF, DOC, or DOCX up to 10MB"
                accept=".pdf,.doc,.docx"
              />
            </div>

            {/* Submit Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-8 border-t border-white/5">
              <Link
                href={`/jobs/${job.id}`}
                className="text-[10px] font-black uppercase tracking-widest text-white/30 hover:text-white transition-colors"
              >
                Cancel Application
              </Link>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto px-12 py-5 bg-white text-black font-black uppercase tracking-[0.25em] text-[10px] rounded-[1.2rem] hover:bg-white/80 active:scale-95 transition-all shadow-xl shadow-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-3">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Processing
                  </span>
                ) : (
                  "Submit Application"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}