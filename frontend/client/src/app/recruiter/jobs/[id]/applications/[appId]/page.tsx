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
  const [isSendingOA, setIsSendingOA] = useState(false);
  const [isSendingInterview, setIsSendingInterview] = useState(false);

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

  const handleSendOA = async () => {
    if (!jobAssessment) {
      toast.error("No assessment configured for this job.");
      return;
    }
    setIsSendingOA(true);
    try {
      const res = await applicationsApi.sendOA(appId, {
        assessmentToken: jobAssessment.accessToken,
        assessmentTitle: jobAssessment.title,
        timeLimitMinutes: jobAssessment.timeLimitMinutes,
      });
      if (res.sent > 0) {
        toast.success("OA invite sent successfully!");
        // Refresh application status
        const updated = await applicationsApi.getApplication(appId);
        setApplication(updated);
      } else {
        toast.error(res.skippedReasons?.[0] || "Could not send OA invite.");
      }
    } catch {
      toast.error("Failed to send OA invite");
    } finally {
      setIsSendingOA(false);
    }
  };

  const handleSendInterviewInvite = async () => {
    setIsSendingInterview(true);
    try {
      const res = await applicationsApi.sendInterviewInvite(appId);
      if (res.sent > 0) {
        toast.success("Interview invite sent successfully!");
        const updated = await applicationsApi.getApplication(appId);
        setApplication(updated);
      } else {
        toast.error(res.skippedReasons?.[0] || "Could not send interview invite.");
      }
    } catch {
      toast.error("Failed to send interview invite");
    } finally {
      setIsSendingInterview(false);
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
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ── Breadcrumb ──────────────────────────────────────────────────── */}
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link
            href="/dashboard"
            className="hover:text-primary-600 transition-colors"
          >
            Dashboard
          </Link>
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m8.25 4.5 7.5 7.5-7.5 7.5"
            />
          </svg>
          <Link
            href={`/recruiter/jobs/${jobId}`}
            className="hover:text-primary-600 transition-colors"
          >
            Job
          </Link>
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m8.25 4.5 7.5 7.5-7.5 7.5"
            />
          </svg>
          <span className="text-gray-900 truncate max-w-[200px]">
            {application.candidateName || "Application"}
          </span>
        </nav>

        {/* ── Candidate header ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-lg flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900 truncate">
              {application.candidateName || "Unknown Candidate"}
            </h1>
            <p className="text-sm text-gray-500">
              {application.candidateEmail}
            </p>
          </div>
          <StatusBadge status={application.status} type="application" />
        </div>

        {/* ── Two-column layout ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column (2/3) */}
          <div className="lg:col-span-2 space-y-5">
            {/* Contact information */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">
                Contact Information
              </h3>
              <dl className="space-y-3">
                <div className="flex gap-3">
                  <dt className="text-sm text-gray-500 w-32 flex-shrink-0">
                    Email
                  </dt>
                  <dd className="text-sm text-gray-900 break-all">
                    {application.candidateEmail}
                  </dd>
                </div>
                {application.contactPhone && (
                  <div className="flex gap-3">
                    <dt className="text-sm text-gray-500 w-32 flex-shrink-0">
                      Phone
                    </dt>
                    <dd className="text-sm text-gray-900">
                      {application.contactPhone}
                    </dd>
                  </div>
                )}
                {application.createdAt && (
                  <div className="flex gap-3">
                    <dt className="text-sm text-gray-500 w-32 flex-shrink-0">
                      Applied
                    </dt>
                    <dd className="text-sm text-gray-900">
                      {formatDate(application.createdAt)}
                    </dd>
                  </div>
                )}
                {snapshot?.yearsOfExperience != null && (
                  <div className="flex gap-3">
                    <dt className="text-sm text-gray-500 w-32 flex-shrink-0">
                      Experience
                    </dt>
                    <dd className="text-sm text-gray-900">
                      {String(snapshot.yearsOfExperience)} year
                      {snapshot.yearsOfExperience !== 1 ? "s" : ""}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Cover letter */}
            {application.coverLetter && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  Cover Letter
                </h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {application.coverLetter}
                </p>
              </div>
            )}

            {/* Portfolio links */}
            {application.portfolioLinks &&
              application.portfolioLinks.filter(Boolean).length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">
                    Portfolio / Links
                  </h3>
                  <ul className="space-y-2">
                    {application.portfolioLinks
                      .filter(Boolean)
                      .map((link, i) => (
                        <li key={i}>
                          <a
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary-600 hover:text-primary-500 hover:underline break-all"
                          >
                            {link}
                          </a>
                        </li>
                      ))}
                  </ul>
                </div>
              )}

            {/* Assessment score */}
            {jobAssessment && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">
                  Online Assessment —{" "}
                  <span className="font-normal text-gray-500">
                    {jobAssessment.title}
                  </span>
                </h3>

                {candidateSubmission ? (
                  <div>
                    {/* Score summary */}
                    <div className="flex items-center gap-5 mb-4">
                      <div className="text-center">
                        <p
                          className={`text-4xl font-bold ${
                            (candidateSubmission.score ?? 0) >= 70
                              ? "text-green-600"
                              : (candidateSubmission.score ?? 0) >= 40
                                ? "text-yellow-600"
                                : "text-red-600"
                          }`}
                        >
                          {candidateSubmission.score != null
                            ? `${Math.round(candidateSubmission.score)}%`
                            : "—"}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">Score</p>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <StatusBadge
                            status={candidateSubmission.status}
                            type="assessment"
                          />
                        </div>
                        {candidateSubmission.submittedAt && (
                          <p className="text-xs text-gray-400">
                            Submitted{" "}
                            {formatDateTime(candidateSubmission.submittedAt)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Per-question breakdown */}
                    {candidateSubmission.scoringDetails &&
                      candidateSubmission.scoringDetails.length > 0 && (
                        <div className="border-t border-gray-100 pt-3 space-y-2">
                          <p className="text-xs font-medium text-gray-500 mb-2">
                            Score breakdown
                          </p>
                          {candidateSubmission.scoringDetails.map((d, i) => (
                            <div
                              key={d.questionId}
                              className="flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">
                                  Q{i + 1}
                                </span>
                                <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                                  {d.questionType}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-24 bg-gray-100 rounded-full h-1.5">
                                  <div
                                    className="bg-primary-500 h-1.5 rounded-full"
                                    style={{
                                      width: `${(d.score / d.maxScore) * 100}%`,
                                    }}
                                  />
                                </div>
                                <span className="text-xs font-medium text-gray-700 w-12 text-right">
                                  {d.score}/{d.maxScore}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 text-sm text-gray-500 py-2">
                    <svg
                      className="w-5 h-5 text-gray-300 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                      />
                    </svg>
                    Candidate has not taken the assessment yet.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right column (1/3) */}
          <div className="space-y-5">
            {/* Composite score & rank */}
            {(application.compositeScore != null ||
              application.rankingPosition != null) && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
                {application.rankingPosition != null && (
                  <>
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                      Ranking Position
                    </p>
                    <p className="text-4xl font-bold text-primary-600">
                      #{application.rankingPosition}
                    </p>
                  </>
                )}
                {application.compositeScore != null && (
                  <div
                    className={
                      application.rankingPosition != null
                        ? "mt-3 pt-3 border-t border-gray-100"
                        : ""
                    }
                  >
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                      Composite Score
                    </p>
                    <p className="text-3xl font-bold text-gray-800">
                      {Math.round(application.compositeScore)}
                      <span className="text-sm font-normal text-gray-400">
                        /100
                      </span>
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* CV / file download */}
            {application.originalFilename && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  Submitted File
                </h3>
                <button
                  onClick={handleDownload}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-primary-600 hover:bg-primary-50 hover:border-primary-200 transition-colors"
                >
                  <svg
                    className="w-4 h-4 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
                    />
                  </svg>
                  <span className="truncate">
                    {application.originalFilename}
                  </span>
                </button>
              </div>
            )}

            {/* Status actions */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">
                Update Status
              </h3>
              <p className="text-xs text-gray-400 mb-4">
                Current:{" "}
                <StatusBadge status={application.status} type="application" />
              </p>

              <div className="space-y-2">
                {STATUS_ACTIONS.map(
                  ({ label, status, colorClass, description }) => {
                    const isCurrent = application.status === status;
                    const isUpdating = updatingStatus === status;
                    const isDisabled = isCurrent || updatingStatus !== null;

                    return (
                      <button
                        key={status}
                        onClick={() =>
                          !isCurrent &&
                          !updatingStatus &&
                          handleStatusUpdate(status)
                        }
                        disabled={isDisabled}
                        title={description}
                        className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-medium transition-colors
                          ${colorClass}
                          ${isDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                      >
                        <span>{label}</span>
                        {isCurrent && (
                          <span className="text-xs font-normal opacity-80 ml-2">
                            Current
                          </span>
                        )}
                        {isUpdating && (
                          <svg
                            className="animate-spin h-4 w-4 ml-2"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                            />
                          </svg>
                        )}
                      </button>
                    );
                  },
                )}
              </div>

              {/* Withdraw — kept separate as a destructive-neutral action */}
              <div className="mt-3 pt-3 border-t border-gray-100">
                <button
                  onClick={() => handleStatusUpdate("WITHDRAWN")}
                  disabled={
                    application.status === "WITHDRAWN" ||
                    updatingStatus !== null
                  }
                  className="w-full px-4 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {application.status === "WITHDRAWN"
                    ? "Withdrawn"
                    : "Mark as Withdrawn"}
                </button>
              </div>
            </div>

            {/* Manual Invites */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">
                Manual Invites
              </h3>
              <p className="text-xs text-gray-400 mb-4">
                Override AI ranking to manually send invites to this candidate.
              </p>

              <div className="space-y-2">
                {/* Send OA */}
                <button
                  id="send-oa-btn"
                  onClick={handleSendOA}
                  disabled={isSendingOA || !jobAssessment || updatingStatus !== null}
                  title={!jobAssessment ? "No assessment configured for this job" : "Send OA invite to this candidate"}
                  className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
                    </svg>
                    Send OA Invite
                  </span>
                  {isSendingOA && (
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                </button>

                {!jobAssessment && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
                    Create an assessment first
                  </p>
                )}

                {/* Send Interview Invite */}
                <button
                  id="send-interview-btn"
                  onClick={handleSendInterviewInvite}
                  disabled={isSendingInterview || updatingStatus !== null}
                  title="Send interview invite to this candidate"
                  className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                    </svg>
                    Send Interview Invite
                  </span>
                  {isSendingInterview && (
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
