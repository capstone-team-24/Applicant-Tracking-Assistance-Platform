"use client";

import Link from "next/link";
import type { Job } from "@/lib/types";
import StatusBadge from "./StatusBadge";
import { formatDate, parseDate } from "@/lib/dateUtils";

interface JobCardProps {
  job: Job;
  showStatus?: boolean;
  recruiterView?: boolean;
}

export default function JobCard({ job, showStatus = false, recruiterView = false }: JobCardProps) {
  const linkHref = recruiterView ? `/recruiter/jobs/${job.id}` : `/jobs/${job.id}`;

  return (
    <div className="group relative bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-6 hover:bg-white/15 hover:border-white/30 transition-all duration-300 shadow-xl shadow-black/5">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-xl font-bold text-white tracking-tight leading-tight group-hover:text-purple-200 transition-colors">
              {job.title}
            </h3>
            {showStatus && <StatusBadge status={job.status} type="job" />}
          </div>

          {job.organizationName && (
            <div className="flex items-center gap-1.5 mb-3">
              <svg className="w-3.5 h-3.5 text-white/40 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
              </svg>
              <span className="text-[11px] font-bold text-white/40 uppercase tracking-widest">
                {job.organizationName}
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/50 mb-4 font-medium">
            {job.location && (
              <span className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-md border border-white/5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                </svg>
                {job.location}
              </span>
            )}
            {job.employmentType && (
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 opacity-70" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
                {job.employmentType.replace("_", " ")}
              </span>
            )}
            {job.experienceLevel && (
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 opacity-70" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                </svg>
                {job.experienceLevel}
              </span>
            )}
            {recruiterView && job.applicationCount !== undefined && (
              <span className="flex items-center gap-1.5 text-purple-300 font-bold">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                </svg>
                {job.applicationCount} apps
              </span>
            )}
          </div>

          {job.skills && job.skills.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {job.skills.slice(0, 6).map((skill, i) => (
                <span
                  key={i}
                  className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/10 text-white/80 border border-white/10 shadow-sm"
                >
                  {skill}
                </span>
              ))}
              {job.skills.length > 6 && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-black/20 text-white/40 border border-white/5">
                  +{job.skills.length - 6} more
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-5 border-t border-white/10 mt-auto">
        <div className="flex flex-col gap-1">
          {job.createdAt && (
            <span className="text-[11px] font-bold uppercase tracking-widest text-white/30">
              {formatDate(job.createdAt)}
            </span>
          )}
          {job.applicationDeadline && (
            <span className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest ${(parseDate(job.applicationDeadline) || new Date()) < new Date()
                ? "text-red-400"
                : "text-amber-400"
              }`}>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
              {(parseDate(job.applicationDeadline) || new Date()) < new Date()
                ? "Closed"
                : `Apply by ${formatDate(job.applicationDeadline)}`
              }
            </span>
          )}
        </div>
        <Link
          href={linkHref}
          className="inline-flex items-center px-5 py-2 text-xs font-black uppercase tracking-widest text-black bg-white rounded-xl hover:bg-white/90 active:scale-95 transition-all shadow-lg shadow-white/5"
        >
          {recruiterView ? "Manage" : "View Job"}
          <svg className="ml-1.5 w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </Link>
      </div>
    </div>
  );
}