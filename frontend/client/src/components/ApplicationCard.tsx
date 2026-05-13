"use client";

import Link from "next/link";
import type { Application, AssessmentSubmission } from "@/lib/types";
import StatusBadge from "./StatusBadge";
import { formatDate } from "@/lib/dateUtils";

interface ApplicationCardProps {
  application: Application;
  jobId?: string;
  showJobInfo?: boolean;
  oaSubmission?: AssessmentSubmission;
}

export default function ApplicationCard({
  application,
  jobId,
  showJobInfo = false,
  oaSubmission,
}: ApplicationCardProps) {
  const detailHref = jobId
    ? `/recruiter/jobs/${jobId}/applications/${application.id}`
    : `/recruiter/jobs/${application.jobId}/applications/${application.id}`;

  return (
    <div className="group relative bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-6 hover:bg-white/15 hover:border-white/30 transition-all duration-300 shadow-xl shadow-black/10">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h4 className="text-lg font-bold text-white tracking-tight leading-tight group-hover:text-purple-200 transition-colors">
              {application.candidateName}
            </h4>
            <StatusBadge status={application.status} type="application" />
          </div>
          
          <p className="text-sm text-white/50 mb-3 font-medium">
            {application.candidateEmail}
          </p>

          {showJobInfo && application.job && (
            <div className="inline-flex items-center px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-xs font-bold text-white/80 mb-3">
              <span className="text-white/40 uppercase tracking-widest mr-2 text-[9px]">Role:</span>
              {application.job.title}
            </div>
          )}

          {application.createdAt && (
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/30">
              Applied {formatDate(application.createdAt)}
            </p>
          )}
        </div>

        {/* Scores & OA Section */}
        <div className="flex flex-col items-end gap-3">
          {application.compositeScore !== undefined && application.compositeScore !== null && (
            <div className="text-right bg-white/5 p-3 rounded-xl border border-white/10 min-w-[80px]">
              <div className="text-3xl font-black text-white leading-none">
                {Math.round(application.compositeScore)}
              </div>
              <div className="text-[9px] font-black uppercase tracking-widest text-white/40 mt-1">
                Score
              </div>
            </div>
          )}
          
          {oaSubmission && (
            <div className="text-right">
              <div className="mb-1">
                <span className="text-[10px] font-black uppercase tracking-tighter text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded border border-indigo-500/30">
                  OA: {oaSubmission.status.replace("_", " ")}
                </span>
              </div>
              {oaSubmission.score !== undefined && oaSubmission.score !== null && (
                <div className="text-lg font-bold text-indigo-200">
                  {Math.round(oaSubmission.score)}
                  <span className="text-[10px] text-white/30 font-black tracking-widest ml-1">/100</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {application.coverLetter && (
        <div className="mt-5 p-4 bg-black/20 rounded-xl border border-white/5">
          <p className="text-sm text-white/60 line-clamp-2 leading-relaxed italic font-medium">
            "{application.coverLetter}"
          </p>
        </div>
      )}

      <div className="mt-6 flex items-center justify-end">
        <Link
          href={detailHref}
          className="inline-flex items-center px-5 py-2 text-xs font-black uppercase tracking-widest text-black bg-white rounded-xl hover:bg-white/90 active:scale-95 transition-all shadow-lg shadow-white/5"
        >
          View Details
          <svg className="ml-2 w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </Link>
      </div>
    </div>
  );
}