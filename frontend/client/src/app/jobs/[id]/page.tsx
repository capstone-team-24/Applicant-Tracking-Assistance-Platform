"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { jobsApi } from "@/lib/api";
import type { Job } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import { formatDate, parseDate } from "@/lib/dateUtils";

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
        setError("Failed to load job details. The job may not exist or has been removed.");
      } finally {
        setIsLoading(false);
      }
    };
    if (jobId) fetchJob();
  }, [jobId]);

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="animate-pulse space-y-8">
          <div className="h-4 bg-white/5 rounded-full w-24" />
          <div className="h-64 bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10" />
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 h-96 bg-white/5 rounded-3xl border border-white/10" />
            <div className="h-64 bg-white/5 rounded-3xl border border-white/10" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        <div className="bg-white/5 backdrop-blur-2xl rounded-3xl border border-white/10 p-12 shadow-2xl">
          <svg className="mx-auto w-16 h-16 text-white/20 mb-6" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          <h2 className="text-2xl font-black text-white mb-3">Job Not Found</h2>
          <p className="text-white/50 mb-8 font-medium">{error}</p>
          <Link
            href="/jobs"
            className="inline-flex items-center px-8 py-3 bg-white text-black font-black uppercase tracking-widest text-xs rounded-xl hover:bg-white/90 transition-all"
          >
            Back to Jobs
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-8 ml-2">
        <Link href="/jobs" className="hover:text-white transition-colors">
          Jobs
        </Link>
        <svg className="w-3 h-3 opacity-30" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
        <span className="text-white/20 truncate max-w-[200px]">{job.title}</span>
      </nav>

      {/* Hero Header Card */}
      <div className="relative overflow-hidden bg-white/10 backdrop-blur-2xl rounded-[2.5rem] border border-white/20 p-8 lg:p-12 mb-8 shadow-2xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/5 rounded-full blur-3xl opacity-50" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-8">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-4 mb-6">
              <StatusBadge status={job.status} type="job" />
              {job.createdAt && (
                <span className="text-[10px] font-black uppercase tracking-widest text-white/30 bg-white/5 px-3 py-1 rounded-full border border-white/5">
                  Posted {formatDate(job.createdAt)}
                </span>
              )}
              {job.applicationDeadline && (
                <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${
                  (parseDate(job.applicationDeadline) || new Date()) < new Date()
                    ? "bg-red-500/10 text-red-400 border-red-500/20"
                    : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                }`}>
                  {(parseDate(job.applicationDeadline) || new Date()) < new Date() ? "Closed" : `Apply by ${formatDate(job.applicationDeadline)}`}
                </span>
              )}
            </div>
            
            <h1 className="text-4xl lg:text-5xl font-black text-white tracking-tighter mb-8 leading-none">
              {job.title}
            </h1>

            <div className="flex flex-wrap items-center gap-6 text-sm font-bold text-white/60">
              {job.location && (
                <span className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/10 text-white/40">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                    </svg>
                  </div>
                  {job.location}
                </span>
              )}
              {job.employmentType && (
                <span className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/10 text-white/40">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387" />
                    </svg>
                  </div>
                  {job.employmentType.replace("_", " ")}
                </span>
              )}
            </div>
          </div>

          {job.status === "PUBLISHED" && (
            <Link
              href={`/jobs/${job.id}/apply`}
              className="inline-flex items-center px-10 py-5 bg-white text-black font-black uppercase tracking-[0.2em] text-xs rounded-2xl hover:bg-white/90 hover:scale-[1.02] active:scale-95 transition-all shadow-2xl shadow-white/10"
            >
              Apply Now
              <svg className="ml-3 w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </Link>
          )}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          {/* Skills Section - High Visibility */}
          {job.skills && job.skills.length > 0 && (
            <div className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 p-8 shadow-lg">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-6">
                Technical Stack
              </h3>
              <div className="flex flex-wrap gap-3">
                {job.skills.map((skill, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-bold bg-white/10 text-white border border-white/10 shadow-lg"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          <div className="bg-white/5 backdrop-blur-md rounded-[2rem] border border-white/10 p-8 lg:p-10 shadow-xl">
            <h2 className="text-xl font-black text-white mb-8 tracking-tight flex items-center gap-3">
              <span className="w-1.5 h-6 bg-white rounded-full" />
              Job Description
            </h2>
            <div className="prose prose-invert max-w-none text-white/70 whitespace-pre-line leading-relaxed font-medium selection:bg-white selection:text-black">
              {job.description}
            </div>
          </div>

          {/* Requirements */}
          {job.requirements && (
            <div className="bg-white/5 backdrop-blur-md rounded-[2rem] border border-white/10 p-8 lg:p-10 shadow-xl">
              <h2 className="text-xl font-black text-white mb-8 tracking-tight flex items-center gap-3">
                <span className="w-1.5 h-6 bg-white/40 rounded-full" />
                Key Requirements
              </h2>
              <div className="prose prose-invert max-w-none text-white/70 whitespace-pre-line leading-relaxed font-medium italic">
                {job.requirements}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Info */}
        <div className="lg:col-span-4 space-y-6">
          <div className="sticky top-8 space-y-6">
            <div className="bg-white/10 backdrop-blur-xl rounded-[2rem] border border-white/20 p-8 shadow-2xl">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-8 text-center">
                Overview
              </h3>
              <div className="space-y-8">
                <div className="text-center group">
                  <p className="text-[9px] font-black uppercase tracking-widest text-white/20 group-hover:text-white/40 transition-colors mb-1">
                    Seniority
                  </p>
                  <p className="text-lg font-bold text-white">
                    {job.experienceLevel || "Not Specified"}
                  </p>
                </div>
                <div className="w-full h-px bg-white/5" />
                <div className="text-center group">
                  <p className="text-[9px] font-black uppercase tracking-widest text-white/20 group-hover:text-white/40 transition-colors mb-1">
                    Contract
                  </p>
                  <p className="text-lg font-bold text-white">
                    {job.employmentType?.replace("_", " ") || "Full Time"}
                  </p>
                </div>
                <div className="w-full h-px bg-white/5" />
                <div className="text-center group">
                  <p className="text-[9px] font-black uppercase tracking-widest text-white/20 group-hover:text-white/40 transition-colors mb-1">
                    Location
                  </p>
                  <p className="text-lg font-bold text-white">
                    {job.location || "Remote"}
                  </p>
                </div>
                {job.applicationDeadline && (
                  <>
                    <div className="w-full h-px bg-white/5" />
                    <div className="text-center group">
                      <p className="text-[9px] font-black uppercase tracking-widest text-white/20 group-hover:text-white/40 transition-colors mb-1">
                        Deadline
                      </p>
                      <p className={`text-lg font-bold ${
                        (parseDate(job.applicationDeadline) || new Date()) < new Date() ? "text-red-400" : "text-amber-400"
                      }`}>
                        {formatDate(job.applicationDeadline)}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Quick Apply Floating Call to Action */}
            <div className="p-1 bg-gradient-to-br from-white/20 to-white/5 rounded-[2rem]">
              <div className="bg-slate-950 rounded-[1.9rem] p-8 text-center border border-white/5 shadow-inner">
                <p className="text-xs font-bold text-white/50 mb-6 leading-relaxed">
                  Ready to join the mission at Infamous Designs?
                </p>
                <Link
                  href={`/jobs/${job.id}/apply`}
                  className="block w-full py-4 bg-white text-black font-black uppercase tracking-[0.2em] text-[10px] rounded-xl hover:bg-white/80 active:scale-95 transition-all shadow-xl shadow-white/5"
                >
                  Start Application
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}