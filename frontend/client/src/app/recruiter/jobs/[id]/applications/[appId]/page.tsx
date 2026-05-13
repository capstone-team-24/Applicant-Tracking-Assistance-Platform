"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { applicationsApi, assessmentsApi } from "@/lib/api";
import type {
  Application,
  Assessment,
  AssessmentSubmission,
} from "@/lib/types";
import ProtectedRoute from "@/components/ProtectedRoute";
import StatusBadge from "@/components/StatusBadge";
import toast from "react-hot-toast";
import { formatDate, formatDateTime } from "@/lib/dateUtils";

const STATUS_ACTIONS: {
  label: string;
  status: string;
  colorClass: string;
  description: string;
}[] = [
  {
    label: "Make Offer",
    status: "OFFERED",
    colorClass: "bg-green-600 hover:bg-green-700 text-white",
    description: "Extend a job offer to this candidate",
  },
  {
    label: "Reject",
    status: "REJECTED",
    colorClass: "bg-red-600 hover:bg-red-700 text-white",
    description: "Decline this application",
  },
];

export default function ApplicationDetailPage() {
  const params = useParams();
  const appId = params.appId as string;
  const jobId = params.id as string;

  const [application, setApplication] = useState<Application | null>(null);
  const [jobAssessment, setJobAssessment] = useState<Assessment | null>(null);
  const [candidateSubmission, setCandidateSubmission] =
    useState<AssessmentSubmission | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const app = await applicationsApi.getApplication(appId);
        setApplication(app);

        // Load the job's assessment and find this candidate's submission
        try {
          const assessments = await assessmentsApi.getAssessmentsByJob(jobId);
          if (assessments.length > 0) {
            const assessment = assessments[0];
            setJobAssessment(assessment);

            const submissions = await assessmentsApi.getSubmissions(
              assessment.id,
            );
            const mine = submissions.find(
              (s) => s.candidateId === app.candidateAuthUserId,
            );
            if (mine) setCandidateSubmission(mine);
          }
        } catch {
          // assessment data is optional — don't fail the page
        }
      } catch {
        toast.error("Failed to load application details");
      } finally {
        setIsLoading(false);
      }
    };

    if (appId && jobId) load();
  }, [appId, jobId]);

  const handleStatusUpdate = async (newStatus: string) => {
    if (!application) return;
    setUpdatingStatus(newStatus);
    try {
      const updated = await applicationsApi.updateStatus(appId, newStatus);
      setApplication((prev) =>
        prev ? { ...prev, status: updated.status } : null,
      );
      toast.success(
        `Status updated to ${newStatus.replace(/_/g, " ").toLowerCase()}`,
      );
    } catch {
      toast.error("Failed to update status");
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleDownload = async () => {
    if (!application?.originalFilename) return;
    try {
      const blob = await applicationsApi.downloadFile(appId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = application.originalFilename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download file");
    }
  };

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <ProtectedRoute requiredRole="RECRUITER">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-48" />
            <div className="h-8 bg-gray-200 rounded w-1/3" />
            <div className="grid grid-cols-3 gap-6 mt-6">
              <div className="col-span-2 space-y-4">
                <div className="h-40 bg-gray-200 rounded-xl" />
                <div className="h-32 bg-gray-200 rounded-xl" />
              </div>
              <div className="space-y-4">
                <div className="h-32 bg-gray-200 rounded-xl" />
                <div className="h-48 bg-gray-200 rounded-xl" />
              </div>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (!application) {
    return (
      <ProtectedRoute requiredRole="RECRUITER">
        <div className="max-w-5xl mx-auto px-4 py-16 text-center">
          <svg
            className="mx-auto w-16 h-16 text-gray-300 mb-4"
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
          <p className="text-gray-600 mb-4">Application not found.</p>
          <Link
            href={`/recruiter/jobs/${jobId}`}
            className="text-primary-600 font-medium hover:text-primary-500"
          >
            Back to job
          </Link>
        </div>
      </ProtectedRoute>
    );
  }

  const snapshot = application.candidateProfileSnapshot as
    | Record<string, unknown>
    | undefined;

  const initials = (application.candidateName || "?")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

 return (
    <ProtectedRoute requiredRole="RECRUITER">
      <div 
        className="min-h-screen w-full bg-cover bg-center bg-fixed relative flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8 transition-all duration-500"
        style={{ backgroundImage: `url(/bk2.jpg)`}}
      >
        {/* Liquid Overlays */}
        <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-[2px]" />
        <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 w-full max-w-6xl">
          {/* ── Breadcrumb ── */}
          <nav className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400 mb-8 ml-2">
            <Link href="/dashboard" className="hover:text-blue-400 transition-colors">
              Dashboard
            </Link>
            <span className="text-gray-600">/</span>
            <Link href={`/recruiter/jobs/${jobId}`} className="hover:text-blue-400 transition-colors">
              Job
            </Link>
            <span className="text-gray-600">/</span>
            <span className="text-white truncate max-w-[200px]">
              {application.candidateName || "Application"}
            </span>
          </nav>

          {/* ── Candidate Header ── */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 px-2">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-3xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-2xl shadow-lg shadow-blue-900/20 backdrop-blur-md">
                {initials}
              </div>
              <div className="min-w-0">
                <h1 className="text-4xl font-bold text-white tracking-tight drop-shadow-md">
                  {application.candidateName || "Unknown Candidate"}
                </h1>
                <p className="text-gray-400 font-medium mt-1">
                  {application.candidateEmail}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-xl">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Status</span>
              <StatusBadge status={application.status} type="application" />
            </div>
          </div>

          {/* ── Two-column Layout ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* LEFT COLUMN */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* Contact Information */}
              <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8 backdrop-blur-3xl shadow-xl">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6 border-b border-white/10 pb-4">
                  Contact Information
                </h3>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div className="space-y-1">
                    <dt className="text-[10px] font-bold text-blue-400 uppercase tracking-tighter">Email Address</dt>
                    <dd className="text-white font-medium break-all">{application.candidateEmail}</dd>
                  </div>
                  {application.contactPhone && (
                    <div className="space-y-1">
                      <dt className="text-[10px] font-bold text-blue-400 uppercase tracking-tighter">Phone Number</dt>
                      <dd className="text-white font-medium">{application.contactPhone}</dd>
                    </div>
                  )}
                  {application.createdAt && (
                    <div className="space-y-1">
                      <dt className="text-[10px] font-bold text-blue-400 uppercase tracking-tighter">Applied On</dt>
                      <dd className="text-white font-medium">{formatDate(application.createdAt)}</dd>
                    </div>
                  )}
                  {snapshot?.yearsOfExperience != null && (
                    <div className="space-y-1">
                      <dt className="text-[10px] font-bold text-blue-400 uppercase tracking-tighter">Experience</dt>
                      <dd className="text-white font-medium">
                        {String(snapshot.yearsOfExperience)} year
                        {snapshot.yearsOfExperience !== 1 ? "s" : ""}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Cover Letter */}
              {application.coverLetter && (
                <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8 backdrop-blur-3xl shadow-xl">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Cover Letter</h3>
                  <div className="bg-white/5 rounded-2xl p-6 border border-white/5">
                    <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed italic">
                      "{application.coverLetter}"
                    </p>
                  </div>
                </div>
              )}

              {/* Portfolio Links */}
              {application.portfolioLinks && application.portfolioLinks.filter(Boolean).length > 0 && (
                <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8 backdrop-blur-3xl shadow-xl">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Portfolio / Links</h3>
                  <div className="flex flex-wrap gap-3">
                    {application.portfolioLinks.filter(Boolean).map((link, i) => (
                      <a
                        key={i}
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs font-bold text-blue-400 hover:bg-blue-500/20 transition-all"
                      >
                        {link.replace(/^https?:\/\//, '')}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Assessment Score */}
              {jobAssessment && (
                <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8 backdrop-blur-3xl shadow-xl">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">
                    Assessment: <span className="text-white">{jobAssessment.title}</span>
                  </h3>

                  {candidateSubmission ? (
                    <div className="space-y-8">
                      <div className="flex items-center gap-8 bg-white/5 p-6 rounded-2xl border border-white/5">
                        <div className="text-center">
                          <p className={`text-5xl font-black ${(candidateSubmission.score ?? 0) >= 70 ? "text-emerald-400" : (candidateSubmission.score ?? 0) >= 40 ? "text-amber-400" : "text-rose-400"}`}>
                            {candidateSubmission.score != null ? `${Math.round(candidateSubmission.score)}%` : "—"}
                          </p>
                          <p className="text-[10px] font-bold text-gray-500 uppercase mt-1">Final Score</p>
                        </div>
                        <div className="h-12 w-px bg-white/10" />
                        <div className="flex-1">
                          <StatusBadge status={candidateSubmission.status} type="assessment" />
                          {candidateSubmission.submittedAt && (
                            <p className="text-xs text-gray-500 mt-2 font-medium">
                              Submitted {formatDateTime(candidateSubmission.submittedAt)}
                            </p>
                          )}
                        </div>
                      </div>

                      {candidateSubmission.scoringDetails && candidateSubmission.scoringDetails.length > 0 && (
                        <div className="space-y-3">
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Score Breakdown</p>
                          {candidateSubmission.scoringDetails.map((d, i) => (
                            <div key={d.questionId} className="flex items-center justify-between bg-white/5 p-4 rounded-xl border border-white/5 transition-hover hover:bg-white/10">
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-gray-500">Q{i + 1}</span>
                                <span className="text-[10px] px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-md font-bold uppercase tracking-tighter border border-blue-500/20">
                                  {d.questionType}
                                </span>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="w-32 bg-white/10 rounded-full h-1.5 overflow-hidden">
                                  <div 
                                    className="bg-blue-500 h-full rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                                    style={{ width: `${(d.score / d.maxScore) * 100}%` }}
                                  />
                                </div>
                                <span className="text-xs font-bold text-white w-12 text-right">
                                  {d.score}/{d.maxScore}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-4 text-sm text-gray-400 bg-white/5 p-6 rounded-2xl border border-white/5 border-dashed">
                      <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                      </svg>
                      Assessment pending candidate action.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* RIGHT COLUMN */}
            <div className="space-y-8">
              
              {/* Ranking & Composite */}
              {(application.compositeScore != null || application.rankingPosition != null) && (
                <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8 backdrop-blur-3xl shadow-xl text-center relative overflow-hidden group">
                   <div className="absolute inset-0 bg-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                   {application.rankingPosition != null && (
                    <div className="mb-6">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Ranking Position</p>
                      <p className="text-6xl font-black text-blue-500 drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                        #{application.rankingPosition}
                      </p>
                    </div>
                  )}
                  {application.compositeScore != null && (
                    <div className={application.rankingPosition != null ? "pt-6 border-t border-white/10" : ""}>
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Composite Score</p>
                      <p className="text-4xl font-bold text-white">
                        {Math.round(application.compositeScore)}
                        <span className="text-lg font-medium text-gray-500 ml-1">/100</span>
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Submitted File */}
              {application.originalFilename && (
                <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8 backdrop-blur-3xl shadow-xl">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Submitted File</h3>
                  <button
                    onClick={handleDownload}
                    className="w-full flex items-center gap-3 px-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-sm font-bold text-blue-400 hover:bg-blue-600/10 hover:border-blue-500/50 transition-all group"
                  >
                    <svg className="w-5 h-5 flex-shrink-0 text-blue-500 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    <span className="truncate">{application.originalFilename}</span>
                  </button>
                </div>
              )}

              {/* Status Actions */}
              <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8 backdrop-blur-3xl shadow-xl">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Update Status</h3>
                <div className="space-y-3">
                  {STATUS_ACTIONS.map(({ label, status, colorClass, description }) => {
                    const isCurrent = application.status === status;
                    const isUpdating = updatingStatus === status;
                    const isDisabled = isCurrent || updatingStatus !== null;

                    return (
                      <button
                        key={status}
                        onClick={() => !isCurrent && !updatingStatus && handleStatusUpdate(status)}
                        disabled={isDisabled}
                        title={description}
                        className={`w-full flex items-center justify-between px-5 py-3.5 rounded-2xl text-sm font-bold transition-all border
                          ${isCurrent ? "bg-white/10 border-white/20 text-white cursor-default" : "bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:text-white cursor-pointer"}
                          ${isDisabled && !isCurrent ? "opacity-20 grayscale" : ""}`}
                      >
                        <span className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${colorClass.split(' ')[0]}`} />
                          {label}
                        </span>
                        {isCurrent && <span className="text-[10px] font-black uppercase text-blue-400 tracking-tighter">Active</span>}
                        {isUpdating && <svg className="animate-spin h-4 w-4 text-blue-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-6 pt-6 border-t border-white/10">
                  <button
                    onClick={() => handleStatusUpdate("WITHDRAWN")}
                    disabled={application.status === "WITHDRAWN" || updatingStatus !== null}
                    className="w-full px-4 py-3 rounded-xl text-xs font-bold text-gray-500 border border-white/5 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/30 disabled:opacity-20 transition-all uppercase tracking-widest"
                  >
                    {application.status === "WITHDRAWN" ? "Withdrawn" : "Withdraw Application"}
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );}