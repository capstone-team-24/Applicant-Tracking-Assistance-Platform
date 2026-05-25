"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { jobsApi } from "@/lib/api";
import type { Job } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import { formatDate, parseDate } from "@/lib/dateUtils";

// ── Shared Background Wrapper ─────────────────────────────────────────────
function GlassPageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen w-full bg-cover bg-center bg-fixed relative flex flex-col items-center py-12 px-4"
      style={{ backgroundImage: `url(/bk2.jpg)` }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" />

      {/* Ambient Blobs */}
      <div className="fixed top-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-6xl">
        {children}
      </div>
    </div>
  );
}

export default function JobDetailPage() {
  const params = useParams();
  const jobId = params.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchJob = async () => {
      try {
        const data = await jobsApi.getJob(jobId);
        setJob(data);
      } catch {
        setError(
          "Failed to load job details. The job may not exist or has been removed."
        );
      } finally {
        setIsLoading(false);
      }
    };

    if (jobId) fetchJob();
  }, [jobId]);

  const isDeadlinePassed =
    job?.applicationDeadline &&
    (parseDate(job.applicationDeadline) || new Date()) < new Date();

  if (isLoading) {
    return (
      <GlassPageWrapper>
        <div className="animate-pulse space-y-8">
          <div className="h-4 bg-white/5 rounded-full w-24 ml-2" />

          <div className="h-64 bg-white/10 backdrop-blur-2xl rounded-[3rem] border border-white/20" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 space-y-8">
              <div className="h-32 bg-white/5 rounded-3xl border border-white/10" />
              <div className="h-96 bg-white/5 rounded-3xl border border-white/10" />
            </div>

            <div className="lg:col-span-4 h-80 bg-white/5 rounded-3xl border border-white/10" />
          </div>
        </div>
      </GlassPageWrapper>
    );
  }

  if (error || !job) {
    return (
      <GlassPageWrapper>
        <div className="max-w-xl mx-auto mt-24 text-center">
          <div className="bg-white/10 backdrop-blur-3xl rounded-[3rem] border border-white/20 p-12 shadow-2xl">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-8 border border-white/10">
              <svg
                className="w-10 h-10 text-white/40"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
                />
              </svg>
            </div>

            <h2 className="text-3xl font-black text-white mb-4 italic tracking-tighter uppercase">
              Job Not Found
            </h2>

            <p className="text-white/50 mb-10 font-medium text-sm leading-relaxed">
              {error}
            </p>

            <Link
              href="/jobs"
              className="inline-flex items-center px-12 py-5 bg-white text-black font-black uppercase tracking-[0.25em] text-[10px] rounded-2xl hover:scale-105 transition-all shadow-xl shadow-white/5"
            >
              Return to Listings
            </Link>
          </div>
        </div>
      </GlassPageWrapper>
    );
  }

  return (
    <GlassPageWrapper>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] text-white/30 mb-8 ml-4">
        <Link
          href="/jobs"
          className="hover:text-white transition-colors"
        >
          Jobs
        </Link>

        <span className="text-white/10 text-xs">/</span>

        <span className="text-white/60 truncate max-w-[200px] italic">
          {job.title}
        </span>
      </nav>

      {/* Hero Card */}
      <div className="relative overflow-hidden bg-white/10 backdrop-blur-3xl rounded-[3.5rem] border border-white/20 p-8 lg:p-14 mb-10 shadow-2xl">
        {/* Glow Orb */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-10">
          <div className="flex-1">
            {/* Badges */}
            <div className="flex flex-wrap items-center gap-4 mb-8">
              <StatusBadge status={job.status} type="job" />

              {job.createdAt && (
                <span className="text-[9px] font-black uppercase tracking-widest text-white/40 bg-white/5 px-4 py-1.5 rounded-full border border-white/10">
                  EST. {formatDate(job.createdAt)}
                </span>
              )}

              {job.applicationDeadline && (
                <span
                  className={`text-[9px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full border ${
                    isDeadlinePassed
                      ? "bg-red-500/10 text-red-400 border-red-500/20"
                      : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                  }`}
                >
                  {isDeadlinePassed
                    ? "Applications Closed"
                    : `Apply by ${formatDate(job.applicationDeadline)}`}
                </span>
              )}
            </div>

            {/* Title */}
            <h1 className="text-4xl lg:text-6xl font-black text-white tracking-tighter mb-4 leading-[0.9] italic">
              {job.title}
            </h1>

            {/* Org name */}
            {job.organizationName && (
              <div className="flex items-center gap-2 mb-8">
                <svg className="w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                </svg>
                <span className="text-sm font-black uppercase tracking-[0.2em] text-white/50">
                  {job.organizationName}
                </span>
              </div>
            )}

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-8 text-[11px] font-black uppercase tracking-widest text-white/50">
              {job.location && (
                <span className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 text-white">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"
                      />
                    </svg>
                  </div>

                  {job.location}
                </span>
              )}

              {job.employmentType && (
                <span className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 text-white">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25"
                      />
                    </svg>
                  </div>

                  {job.employmentType.replace("_", " ")}
                </span>
              )}
            </div>
          </div>

          {/* CTA */}
          {job.status === "PUBLISHED" && !isDeadlinePassed && (
            <Link
              href={`/jobs/${job.id}/apply`}
              className="group relative inline-flex items-center px-12 py-6 bg-white text-black font-black uppercase tracking-[0.2em] text-[11px] rounded-2xl hover:scale-[1.05] active:scale-95 transition-all shadow-[0_0_40px_rgba(255,255,255,0.1)]"
            >
              Apply Now

              <svg
                className="ml-4 w-4 h-4 group-hover:translate-x-1 transition-transform"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={3}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
                />
              </svg>
            </Link>
          )}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
        {/* Left */}
        <div className="lg:col-span-8 space-y-10">
          {/* Skills */}
          {job.skills && job.skills.length > 0 && (
            <div className="bg-white/5 backdrop-blur-xl rounded-[2.5rem] border border-white/10 p-8 shadow-xl">
              <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30 mb-8 flex items-center gap-4">
                <div className="h-px flex-1 bg-white/10" />
                Technical Stack
                <div className="h-px flex-1 bg-white/10" />
              </h3>

              <div className="flex flex-wrap gap-3">
                {job.skills.map((skill, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-colors"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          <div className="bg-white/5 backdrop-blur-xl rounded-[3rem] border border-white/10 p-10 lg:p-14 shadow-xl">
            <h2 className="text-2xl font-black text-white mb-10 tracking-tight flex items-center gap-4 italic">
              <span className="w-2 h-8 bg-white rounded-full" />
              Role Overview
            </h2>

            <div className="prose prose-invert max-w-none text-white/70 whitespace-pre-line leading-[1.8] font-medium text-base selection:bg-white selection:text-black">
              {job.description}
            </div>
          </div>

          {/* Requirements */}
          {job.requirements && (
            <div className="bg-white/5 backdrop-blur-xl rounded-[3rem] border border-white/10 p-10 lg:p-14 shadow-xl">
              <h2 className="text-2xl font-black text-white mb-10 tracking-tight flex items-center gap-4 italic">
                <span className="w-2 h-8 bg-white/10 rounded-full" />
                Prerequisites
              </h2>

              <div className="prose prose-invert max-w-none text-white/70 whitespace-pre-line leading-[1.8] font-medium italic text-base">
                {job.requirements}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4">
          <div className="sticky top-8 space-y-8">
            {/* Info Card */}
            <div className="bg-white/10 backdrop-blur-3xl rounded-[3rem] border border-white/20 p-10 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />

              <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30 mb-10 text-center">
                Mission Logistics
              </h3>

              <div className="space-y-10">
                {[
                  {
                    label: "Seniority",
                    value: job.experienceLevel || "Not Specified",
                  },
                  {
                    label: "Contract",
                    value:
                      job.employmentType?.replace("_", " ") || "Full Time",
                  },
                  {
                    label: "Location",
                    value: job.location || "Remote",
                  },
                  ...(job.organizationName
                    ? [{ label: "Company", value: job.organizationName }]
                    : []),
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="text-center group"
                  >
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20 group-hover:text-white/50 transition-colors mb-2">
                      {item.label}
                    </p>

                    <p className="text-xl font-bold text-white tracking-tight italic">
                      {item.value}
                    </p>
                  </div>
                ))}

                {job.applicationDeadline && (
                  <div className="text-center group">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20 group-hover:text-white/50 transition-colors mb-2">
                      Deadline
                    </p>

                    <p
                      className={`text-xl font-bold tracking-tight italic ${
                        isDeadlinePassed
                          ? "text-red-400"
                          : "text-amber-300"
                      }`}
                    >
                      {formatDate(job.applicationDeadline)}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* CTA */}
            {!isDeadlinePassed && job.status === "PUBLISHED" && (
              <div className="p-1 bg-white/10 rounded-[3rem] border border-white/10">
                <div className="bg-black/40 backdrop-blur-md rounded-[2.8rem] p-10 text-center shadow-inner">
                  <p className="text-xs font-bold text-white/40 mb-8 leading-relaxed italic uppercase tracking-wider">
                    Ready to join the collective at Infamous Designs?
                  </p>

                  <Link
                    href={`/jobs/${job.id}/apply`}
                    className="block w-full py-5 bg-white text-black font-black uppercase tracking-[0.25em] text-[10px] rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-white/5"
                  >
                    Initiate Application
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </GlassPageWrapper>
  );
}