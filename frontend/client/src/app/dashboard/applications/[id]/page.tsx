"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import StatusBadge from "@/components/StatusBadge";
import { applicationsApi } from "@/lib/api";
import type { CandidateApplicationDetail } from "@/lib/types";
import { formatDate, formatDateTime } from "@/lib/dateUtils";
import toast from "react-hot-toast";

type ApplicationSnapshot = {
  fullName?: string;
  email?: string;
  phone?: string;
  yearsOfExperience?: number;
};

function humanize(value?: string) {
  if (!value) return "—";
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function CandidateApplicationDetailPage() {
  const params = useParams();
  const applicationId = params.id as string;

  const [application, setApplication] =
    useState<CandidateApplicationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadApplication = async () => {
      try {
        const data = await applicationsApi.getMyApplication(applicationId);
        setApplication(data);
      } catch {
        toast.error("Failed to load your application");
      } finally {
        setIsLoading(false);
      }
    };

    if (applicationId) {
      loadApplication();
    }
  }, [applicationId]);

  const handleDownload = async () => {
    if (!application?.originalFilename) return;

    try {
      const blob = await applicationsApi.downloadMyFile(application.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = application.originalFilename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download your submitted CV");
    }
  };

  if (isLoading) {
    return (
      <ProtectedRoute requiredRole="CANDIDATE">
        <div
          className="min-h-screen w-full bg-cover bg-center bg-fixed relative flex items-center justify-center px-4"
          style={{ backgroundImage: "url(/bk2.jpg)" }}
        >
          <div className="absolute inset-0 bg-slate-950/88 backdrop-blur-[3px]" />
          <div className="relative z-10 w-full max-w-md rounded-[2rem] border border-white/10 bg-white/5 p-8 backdrop-blur-3xl">
            <div className="space-y-4 animate-pulse">
              <div className="h-6 w-32 rounded bg-white/10" />
              <div className="h-12 w-full rounded-2xl bg-white/10" />
              <div className="h-40 w-full rounded-[2rem] bg-white/10" />
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (!application) {
    return (
      <ProtectedRoute requiredRole="CANDIDATE">
        <div
          className="min-h-screen w-full bg-cover bg-center bg-fixed relative flex items-center justify-center px-4"
          style={{ backgroundImage: "url(/bk2.jpg)" }}
        >
          <div className="absolute inset-0 bg-slate-950/88 backdrop-blur-[3px]" />
          <div className="relative z-10 w-full max-w-md rounded-[2rem] border border-white/10 bg-white/5 p-8 text-center backdrop-blur-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-white/35">
              Application
            </p>
            <h1 className="mt-3 text-2xl font-black text-white">
              Submission Unavailable
            </h1>
            <p className="mt-3 text-sm text-white/55">
              This application could not be loaded.
            </p>
            <Link
              href="/dashboard"
              className="mt-6 inline-flex rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-white/90"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  const snapshot = application.candidateProfileSnapshot as
    | ApplicationSnapshot
    | undefined;
  const job = application.job;
  const portfolioLinks = application.portfolioLinks?.filter(Boolean) ?? [];
  const submittedDetails = [
    { label: "Applicant", value: snapshot?.fullName || application.candidateName },
    { label: "Email", value: snapshot?.email || application.candidateEmail },
    { label: "Phone", value: snapshot?.phone || application.contactPhone },
    {
      label: "Experience",
      value:
        snapshot?.yearsOfExperience != null
          ? `${snapshot.yearsOfExperience} year${snapshot.yearsOfExperience === 1 ? "" : "s"}`
          : undefined,
    },
  ].filter((item) => item.value);

  return (
    <ProtectedRoute requiredRole="CANDIDATE">
      <div
        className="min-h-screen w-full bg-cover bg-center bg-fixed relative flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8"
        style={{ backgroundImage: "url(/bk2.jpg)" }}
      >
        <div className="absolute inset-0 bg-slate-950/88 backdrop-blur-[3px]" />
        <div className="fixed top-[-10%] right-[-10%] h-[45%] w-[45%] rounded-full bg-cyan-500/10 blur-[140px] pointer-events-none" />
        <div className="fixed bottom-[-10%] left-[-10%] h-[45%] w-[45%] rounded-full bg-emerald-500/10 blur-[140px] pointer-events-none" />

        <div className="relative z-10 w-full max-w-6xl">
          <nav className="mb-8 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-white/35">
            <Link href="/dashboard" className="transition hover:text-white">
              Dashboard
            </Link>
            <span>/</span>
            <span className="text-white/70">Application</span>
          </nav>

          <div className="mb-10 flex flex-col gap-6 rounded-[2rem] border border-white/10 bg-white/5 p-8 backdrop-blur-3xl lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-cyan-300/70">
                My Submission
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
                {job?.title || "Application Details"}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-white/55">
                {job?.organizationName && <span>{job.organizationName}</span>}
                {job?.location && <span>{job.location}</span>}
                {job?.employmentType && <span>{humanize(job.employmentType)}</span>}
              </div>
            </div>

            <div className="space-y-3 rounded-[1.5rem] border border-white/10 bg-black/20 p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">
                Current Status
              </p>
              <StatusBadge status={application.status} type="application" />
              {application.createdAt && (
                <p className="text-sm text-white/55">
                  Applied on {formatDate(application.createdAt)}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="space-y-8 lg:col-span-2">
              <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 backdrop-blur-3xl">
                <h2 className="text-xs font-black uppercase tracking-[0.3em] text-white/40">
                  Role Snapshot
                </h2>
                <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300/70">
                      Position
                    </p>
                    <p className="mt-2 text-base font-semibold text-white">
                      {job?.title || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300/70">
                      Company
                    </p>
                    <p className="mt-2 text-base font-semibold text-white">
                      {job?.organizationName || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300/70">
                      Location
                    </p>
                    <p className="mt-2 text-base font-semibold text-white">
                      {job?.location || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300/70">
                      Experience Level
                    </p>
                    <p className="mt-2 text-base font-semibold text-white">
                      {humanize(job?.experienceLevel)}
                    </p>
                  </div>
                </div>
              </section>

              <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 backdrop-blur-3xl">
                <h2 className="text-xs font-black uppercase tracking-[0.3em] text-white/40">
                  Submitted Information
                </h2>
                <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
                  {submittedDetails.map((item) => (
                    <div key={item.label}>
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300/70">
                        {item.label}
                      </p>
                      <p className="mt-2 break-words text-base font-semibold text-white">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              {application.coverLetter && (
                <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 backdrop-blur-3xl">
                  <h2 className="text-xs font-black uppercase tracking-[0.3em] text-white/40">
                    Cover Letter
                  </h2>
                  <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-black/20 p-6">
                    <p className="whitespace-pre-wrap text-sm leading-7 text-white/70">
                      {application.coverLetter}
                    </p>
                  </div>
                </section>
              )}

              {portfolioLinks.length > 0 && (
                <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 backdrop-blur-3xl">
                  <h2 className="text-xs font-black uppercase tracking-[0.3em] text-white/40">
                    Portfolio Links
                  </h2>
                  <div className="mt-5 flex flex-wrap gap-3">
                    {portfolioLinks.map((link) => (
                      <a
                        key={link}
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
                      >
                        {link.replace(/^https?:\/\//, "")}
                      </a>
                    ))}
                  </div>
                </section>
              )}
            </div>

            <div className="space-y-8">
              <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 backdrop-blur-3xl">
                <h2 className="text-xs font-black uppercase tracking-[0.3em] text-white/40">
                  Timeline
                </h2>
                <div className="mt-6 space-y-5">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300/70">
                      Submitted
                    </p>
                    <p className="mt-2 text-sm font-semibold text-white">
                      {formatDateTime(application.createdAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300/70">
                      Last Updated
                    </p>
                    <p className="mt-2 text-sm font-semibold text-white">
                      {formatDateTime(application.updatedAt)}
                    </p>
                  </div>
                  {application.rejectedAt && (
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300/70">
                        Rejected
                      </p>
                      <p className="mt-2 text-sm font-semibold text-white">
                        {formatDateTime(application.rejectedAt)}
                      </p>
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 backdrop-blur-3xl">
                <h2 className="text-xs font-black uppercase tracking-[0.3em] text-white/40">
                  Submitted CV
                </h2>
                {application.originalFilename ? (
                  <button
                    onClick={handleDownload}
                    className="mt-5 flex w-full items-center justify-between gap-4 rounded-[1.25rem] border border-white/10 bg-black/20 px-4 py-4 text-left transition hover:border-cyan-400/40 hover:bg-cyan-500/10"
                  >
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300/70">
                        File
                      </p>
                      <p className="mt-2 truncate text-sm font-semibold text-white">
                        {application.originalFilename}
                      </p>
                    </div>
                    <span className="text-xs font-black uppercase tracking-[0.25em] text-white/60">
                      Download
                    </span>
                  </button>
                ) : (
                  <p className="mt-5 text-sm text-white/55">
                    No file was attached to this application.
                  </p>
                )}
              </section>

              <section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 backdrop-blur-3xl">
                <h2 className="text-xs font-black uppercase tracking-[0.3em] text-white/40">
                  Status Update
                </h2>
                <div className="mt-5 space-y-4">
                  <div className="rounded-[1.25rem] border border-white/10 bg-black/20 p-4">
                    <p className="text-sm font-semibold text-white">
                      Current stage: {humanize(application.status)}
                    </p>
                  </div>
                  {application.rejectionReason && (
                    <div className="rounded-[1.25rem] border border-red-400/20 bg-red-500/10 p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-red-200/75">
                        Recruiter Note
                      </p>
                      <p className="mt-2 text-sm leading-6 text-red-100">
                        {application.rejectionReason}
                      </p>
                    </div>
                  )}
                  {job?.id && (
                    <Link
                      href={`/jobs/${job.id}`}
                      className="inline-flex rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
                    >
                      View job posting
                    </Link>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
